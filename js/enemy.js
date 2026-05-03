import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

const STATE = { PATROL: 0, ALERT: 1, ATTACK: 2 };

export class Enemy {
    constructor(scene, world, position) {
        this.scene = scene;
        this.world = world;
        this.terrain = null;

        this.maxHealth = 100;
        this.health = 100;
        this.speed = 4;
        this.state = STATE.PATROL;
        this.isDead = false;
        this.faction = 'enemy';

        this.spawnPos = position.clone();
        this.waypoints = [];
        this.currentWaypoint = 0;
        this.shootTimer = 1 + Math.random() * 2;
        this.alertTimer = 0;
        this.animTimer = Math.random() * 10;

        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.initPhysics(position);
        this.initVisuals();
        this.initHealthBar();

        // Waypoints generated lazily on first update (terrain may not be set yet)
        this._waypointsReady = false;
    }

    _buildWaypoints() {
        this._waypointsReady = true;
        const spread = 60;
        for (let i = 0; i < 6; i++) {
            const x = this.spawnPos.x + (Math.random() - 0.5) * spread;
            const z = this.spawnPos.z + (Math.random() - 0.5) * spread;
            const y = this.terrain ? this.terrain.getHeight(x, z) + 1 : this.spawnPos.y;
            this.waypoints.push(new THREE.Vector3(x, y, z));
        }
    }

    initPhysics(position) {
        this.body = new CANNON.Body({
            mass: 80,
            shape: new CANNON.Box(new CANNON.Vec3(0.4, 0.9, 0.4)),
            position: new CANNON.Vec3(position.x, position.y, position.z),
            fixedRotation: true,
            linearDamping: 0.5
        });
        this.world.addBody(this.body);
        this.body.mesh = this.group;
        this.body.onHit = (damage) => this.takeDamage(damage);
    }

    initVisuals() {
        const uniformMat = new THREE.MeshStandardMaterial({ color: 0x4a4e4d });
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xdbac98 });
        const gearMat = new THREE.MeshStandardMaterial({ color: 0x222222 });

        this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.3), uniformMat);
        this.torso.position.y = 0.4;
        this.torso.castShadow = true;
        this.group.add(this.torso);

        this.head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), skinMat);
        this.head.position.y = 0.85;
        this.group.add(this.head);

        const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.15, 8), gearMat);
        helmet.position.y = 1.0;
        helmet.castShadow = true;
        this.group.add(helmet);

        this.leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), uniformMat);
        this.leftLeg.position.set(-0.15, 0, 0);
        this.group.add(this.leftLeg);

        this.rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), uniformMat);
        this.rightLeg.position.set(0.15, 0, 0);
        this.group.add(this.rightLeg);

        this.armGroup = new THREE.Group();
        this.armGroup.position.y = 0.6;
        this.group.add(this.armGroup);

        const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.15), uniformMat);
        armL.position.set(-0.35, -0.1, 0);
        this.armGroup.add(armL);

        const armR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.15), uniformMat);
        armR.position.set(0.35, -0.1, 0);
        this.armGroup.add(armR);

        this.weapon = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 1.0), gearMat);
        this.weapon.position.set(0.2, -0.2, -0.4);
        this.armGroup.add(this.weapon);
    }

    initHealthBar() {
        const bar = new THREE.Mesh(
            new THREE.PlaneGeometry(1.2, 0.15),
            new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide })
        );
        bar.position.y = 1.6;
        this.healthBar = bar;
        this.group.add(bar);

        const bg = new THREE.Mesh(
            new THREE.PlaneGeometry(1.3, 0.2),
            new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide })
        );
        bg.position.set(0, 1.6, -0.01);
        this.group.add(bg);
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.health -= amount;
        const pct = Math.max(0, this.health / this.maxHealth);
        this.healthBar.scale.x = pct;
        this.healthBar.material.color.setHSL(pct * 0.3, 1, 0.5);

        // Become alert/aggressive when hit
        this.state = STATE.ALERT;
        this.alertTimer = 12;

        if (this.health <= 0) this._die();
    }

    _die() {
        this.isDead = true;
        this.scene.remove(this.group);
        this.world.removeBody(this.body);
        if (window.game) window.game.onEnemyKilled();

        // Ragdoll
        const parts = [
            { mesh: this.torso, size: [0.6, 0.7, 0.3] },
            { mesh: this.head, size: [0.25, 0.25, 0.25] },
            { mesh: this.leftLeg, size: [0.2, 0.5, 0.2] },
            { mesh: this.rightLeg, size: [0.2, 0.5, 0.2] }
        ];
        parts.forEach(p => {
            const wp = new THREE.Vector3();
            p.mesh.getWorldPosition(wp);
            const rb = new CANNON.Body({
                mass: 5,
                shape: new CANNON.Box(new CANNON.Vec3(p.size[0] / 2, p.size[1] / 2, p.size[2] / 2)),
                position: new CANNON.Vec3(wp.x, wp.y, wp.z)
            });
            rb.velocity.set((Math.random() - 0.5) * 4, 4 + Math.random() * 3, (Math.random() - 0.5) * 4);
            rb.angularVelocity.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
            this.world.addBody(rb);
            const m = p.mesh.clone();
            this.scene.add(m);
            const tick = () => {
                m.position.copy(rb.position);
                m.quaternion.copy(rb.quaternion);
                if (rb.position.y > -10) requestAnimationFrame(tick);
                else { this.scene.remove(m); try { this.world.removeBody(rb); } catch (_) {} }
            };
            tick();
            setTimeout(() => { this.scene.remove(m); try { this.world.removeBody(rb); } catch (_) {} }, 6000);
        });
    }

    _snapToTerrain(x, z) {
        return this.terrain ? this.terrain.getHeight(x, z) + 1 : this.body.position.y;
    }

    _doPatrol(delta, myPos) {
        if (this.waypoints.length === 0) return;
        const target = this.waypoints[this.currentWaypoint];
        const dx = target.x - myPos.x;
        const dz = target.z - myPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 3) {
            this.currentWaypoint = (this.currentWaypoint + 1) % this.waypoints.length;
        } else {
            const spd = this.speed * 0.55;
            this.body.velocity.x = (dx / dist) * spd;
            this.body.velocity.z = (dz / dist) * spd;
            this.group.lookAt(target.x, this.group.position.y, target.z);
        }
    }

    _doAlert(delta, playerPos, myPos) {
        this.alertTimer -= delta;
        if (this.alertTimer <= 0) this.state = STATE.PATROL;

        const dx = playerPos.x - myPos.x;
        const dz = playerPos.z - myPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        this.group.lookAt(playerPos.x, this.group.position.y, playerPos.z);
        this.armGroup.rotation.x = 0;

        if (dist > 22) {
            this.body.velocity.x = (dx / dist) * this.speed;
            this.body.velocity.z = (dz / dist) * this.speed;
        } else {
            this.body.velocity.x *= 0.6;
            this.body.velocity.z *= 0.6;
            this.state = STATE.ATTACK;
        }
    }

    _doAttack(delta, playerPos, myPos, player) {
        const dx = playerPos.x - myPos.x;
        const dz = playerPos.z - myPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        this.group.lookAt(playerPos.x, this.group.position.y, playerPos.z);
        this.armGroup.rotation.x = -1.2;
        this.body.velocity.x *= 0.7;
        this.body.velocity.z *= 0.7;

        if (dist > 80) { this.state = STATE.ALERT; this.alertTimer = 10; return; }

        this.shootTimer -= delta;
        if (this.shootTimer <= 0) {
            this.shootTimer = 1.2 + Math.random() * 1.8;
            this._fireAt(playerPos, player);
        }
    }

    _fireAt(targetPos, player) {
        const startPos = new THREE.Vector3();
        this.torso.getWorldPosition(startPos);
        startPos.y += 0.5;

        const dir = new THREE.Vector3().subVectors(targetPos, startPos).normalize();
        dir.x += (Math.random() - 0.5) * 0.08;
        dir.z += (Math.random() - 0.5) * 0.08;
        dir.normalize();

        const bullet = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 4, 4),
            new THREE.MeshBasicMaterial({ color: 0xff4400 })
        );
        bullet.position.copy(startPos);
        this.scene.add(bullet);

        const t0 = Date.now();
        const step = () => {
            if (Date.now() - t0 > 2000 || this.isDead) { this.scene.remove(bullet); return; }
            bullet.position.add(dir.clone().multiplyScalar(1.3));
            if (player && !player.isDead && bullet.position.distanceTo(player.body.position) < 2) {
                player.takeDamage(8);
                this.scene.remove(bullet);
                return;
            }
            requestAnimationFrame(step);
        };
        step();
    }

    update(delta, playerPos, player) {
        if (this.isDead) return;
        if (!this._waypointsReady) this._buildWaypoints();

        const myPos = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);

        // Terrain snap
        const groundY = this._snapToTerrain(this.body.position.x, this.body.position.z);
        if (this.body.position.y < groundY) {
            this.body.position.y = groundY;
            this.body.velocity.y = Math.max(0, this.body.velocity.y);
        }

        const dist = myPos.distanceTo(playerPos);

        // State transitions
        if (this.state === STATE.PATROL && dist < 120) { this.state = STATE.ALERT; this.alertTimer = 15; }

        switch (this.state) {
            case STATE.PATROL: this._doPatrol(delta, myPos); break;
            case STATE.ALERT: this._doAlert(delta, playerPos, myPos); break;
            case STATE.ATTACK: this._doAttack(delta, playerPos, myPos, player); break;
        }

        // Sync group to physics body
        this.group.position.set(this.body.position.x, this.body.position.y, this.body.position.z);
        if (player && player.camera) this.healthBar.lookAt(player.camera.position);

        // Walk animation
        const spd = Math.sqrt(this.body.velocity.x ** 2 + this.body.velocity.z ** 2);
        this.animTimer += delta * (spd + 0.5);
        if (spd > 0.5) {
            this.leftLeg.position.z = Math.sin(this.animTimer * 5) * 0.2;
            this.rightLeg.position.z = Math.cos(this.animTimer * 5) * 0.2;
            this.torso.position.y = 0.4 + Math.abs(Math.sin(this.animTimer * 10)) * 0.05;
        }
    }
}

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

const STATE = { PATROL: 0, ALERT: 1, ATTACK: 2 };

export class Enemy {
    constructor(scene, world, terrain, position) {
        this.scene = scene;
        this.world = world;
        this.terrain = terrain;

        this.maxHealth = 100;
        this.health = 100;
        this.speed = 8;
        this.state = STATE.PATROL;
        this.isDead = false;
        this.faction = 'enemy';
        this.awarenessDistance = 120;

        this.spawnPos = position.clone();
        this.waypoints = [];
        this.currentWaypoint = 0;
        this.shootTimer = 1 + Math.random() * 2;
        this.alertTimer = 0;
        this.animTimer = Math.random() * 10;

        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.healthBarGroup = new THREE.Group();
        this.scene.add(this.healthBarGroup);

        this.initPhysics(position);
        // Sync group to spawn position immediately so meshes appear at correct spot
        this.group.position.set(position.x, position.y, position.z);
        this.initVisuals();
        this.initHealthBar();
        console.log('[Enemy] spawned at', position.x.toFixed(1), position.y.toFixed(1), position.z.toFixed(1));

        this.group.layers.enable(1);
        this.group.traverse(child => {
            child.layers.enable(1);
        });

        // Waypoints generated lazily on first update (terrain may not be set yet)
        this._waypointsReady = false;
    }

    _buildWaypoints() {
        this._waypointsReady = true;
        const spread = 60;
        for (let i = 0; i < 6; i++) {
            const x = this.spawnPos.x + (Math.random() - 0.5) * spread;
            const z = this.spawnPos.z + (Math.random() - 0.5) * spread;
            const y = this.terrain ? this.terrain.getHeight(x, z) + 0.9 : this.spawnPos.y;
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
        // Body center is at this.body.position.y, which is kept at groundY + 0.9 by the physics system.
        // This means the bottom of the physics body is at groundY.
        // The visual group is centered at the body position.
        // Therefore, a mesh's world position is its relative position + this.body.position.
        // To make the legs touch the ground, their bottom edge must be at a relative Y of -0.9.
        // For a leg mesh of height 0.9, its center must be at y = -0.9 + (0.9 / 2) = -0.45.
        // The requested -0.65 with a height of 0.5 would result in a bottom of -0.9, which is also correct. Let's use that.
        const legHeight = 0.5;
        const legY = -0.65; // Centered to touch the bottom at -0.9

        const uniformMat = new THREE.MeshStandardMaterial({ color: 0x4a4e4d });
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xdbac98 });
        const gearMat = new THREE.MeshStandardMaterial({ color: 0x222222 });

        this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.3), uniformMat);
        this.torso.position.y = -0.05;
        this.torso.castShadow = true;
        this.group.add(this.torso);

        this.head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), skinMat);
        this.head.position.y = 0.425;
        this.group.add(this.head);

        const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.15, 8), gearMat);
        helmet.position.y = 0.625;
        helmet.castShadow = true;
        this.group.add(helmet);

        this.leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, legHeight, 0.2), uniformMat);
        this.leftLeg.position.set(-0.15, legY, 0);
        this.group.add(this.leftLeg);

        this.rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, legHeight, 0.2), uniformMat);
        this.rightLeg.position.set(0.15, legY, 0);
        this.group.add(this.rightLeg);

        this.armGroup = new THREE.Group();
        this.armGroup.position.y = 0.15;
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
        bar.position.y = 1.2; // FIX: Health bar position adjusted
        this.healthBar = bar;
        this.healthBarGroup.add(bar);

        const bg = new THREE.Mesh(
            new THREE.PlaneGeometry(1.3, 0.2),
            new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide })
        );
        bg.position.set(0, 1.2, -0.01); // FIX: Health bar position adjusted
        this.healthBarBg = bg;
        this.healthBarGroup.add(bg);
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

    destroy() {
        this._die();
    }

    _die() {
        if (this.isDead) return;
        this.isDead = true;
        if (window.game) window.game.onEnemyKilled();

        const partData = [
            { mesh: this.torso, size: [0.6, 0.7, 0.3] },
            { mesh: this.head, size: [0.25, 0.25, 0.25] },
            { mesh: this.leftLeg, size: [0.2, 0.5, 0.2] },
            { mesh: this.rightLeg, size: [0.2, 0.5, 0.2] }
        ].map(p => {
            const worldPos = new THREE.Vector3();
            p.mesh.getWorldPosition(worldPos);
            return { ...p, worldPos, worldQuat: p.mesh.getWorldQuaternion(new THREE.Quaternion()) };
        });

        // FIX: Dispose of geometries and materials to prevent memory leaks
        this.group.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                if (child.material.isMaterial) child.material.dispose();
            }
        });
        this.scene.remove(this.group);
        
        this.healthBarGroup.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
        this.scene.remove(this.healthBarGroup);
        this.world.removeBody(this.body);

        const ragdollStartTime = Date.now();
        partData.forEach(pd => {
            const m = pd.mesh.clone();
            m.position.copy(pd.worldPos);
            m.quaternion.copy(pd.worldQuat);
            this.scene.add(m);

            const rb = new CANNON.Body({
                mass: 5,
                shape: new CANNON.Box(new CANNON.Vec3(pd.size[0] / 2, pd.size[1] / 2, pd.size[2] / 2)),
                position: new CANNON.Vec3(pd.worldPos.x, pd.worldPos.y, pd.worldPos.z),
                quaternion: new CANNON.Quaternion(pd.worldQuat.x, pd.worldQuat.y, pd.worldQuat.z, pd.worldQuat.w)
            });
            rb.velocity.set((Math.random() - 0.5) * 4, Math.random() * 4, (Math.random() - 0.5) * 4);
            rb.angularVelocity.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
            this.world.addBody(rb);

            const tick = () => {
                if (!this.scene.getObjectById(m.id)) {
                    if (this.world.bodies.includes(rb)) this.world.removeBody(rb);
                    return;
                }
                m.position.copy(rb.position);
                m.quaternion.copy(rb.quaternion);
                if (rb.sleepState < 2 && (Date.now() - ragdollStartTime) < 6000) {
                    requestAnimationFrame(tick);
                } else {
                    this.scene.remove(m);
                    // FIX: Dispose of ragdoll part geometry and material
                    m.geometry.dispose();
                    if (m.material.isMaterial) m.material.dispose();
                    if (this.world.bodies.includes(rb)) this.world.removeBody(rb);
                }
            };
            tick();
        });
    }

    _snapToTerrain(x, z) {
        return this.terrain ? this.terrain.getHeight(x, z) : this.body.position.y;
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
            if (Date.now() - t0 > 2000 || this.isDead) { 
                this.scene.remove(bullet); 
                bullet.geometry.dispose();
                bullet.material.dispose();
                return; 
            }
            bullet.position.add(dir.clone().multiplyScalar(1.3));
            if (player && !player.isDead && bullet.position.distanceTo(player.body.position) < 2) {
                player.takeDamage(8);
                this.scene.remove(bullet);
                bullet.geometry.dispose();
                bullet.material.dispose();
                return;
            }
            requestAnimationFrame(step);
        };
        step();
    }

    update(delta, playerPos, player) {
        if (this.isDead) return;
        if (!this._waypointsReady && this.terrain) this._buildWaypoints();

        const myPos = this.body.position;

        // Terrain snap
        const groundY = this._snapToTerrain(myPos.x, myPos.z);
        const halfHeight = this.body.shapes[0].halfExtents.y;
        if (myPos.y < groundY + halfHeight) {
            myPos.y = groundY + halfHeight;
            this.body.velocity.y = Math.max(0, this.body.velocity.y);
        }

        const distToPlayer = myPos.distanceTo(playerPos);

        // State transitions
        if (this.state === STATE.PATROL && distToPlayer < this.awarenessDistance) {
            // FIX: Add Field-of-View check for more realistic awareness
            const forward = new THREE.Vector3();
            this.group.getWorldDirection(forward);
            const toPlayer = new THREE.Vector3().subVectors(playerPos, myPos).normalize();
            const dot = forward.dot(toPlayer);

            // Aware if player is in ~120 degree FOV or very close
            if (dot > 0.5 || distToPlayer < 10) {
                this.state = STATE.ALERT;
                this.alertTimer = 15;
            }
        }

        switch (this.state) {
            case STATE.PATROL: this._doPatrol(delta, myPos); break;
            case STATE.ALERT: this._doAlert(delta, playerPos, myPos); break;
            case STATE.ATTACK: this._doAttack(delta, playerPos, myPos, player); break;
        }

        this.group.position.copy(myPos);
        this.healthBarGroup.position.copy(myPos);

        if (player && player.camera) {
            this.healthBar.quaternion.copy(player.camera.quaternion);
            this.healthBarBg.quaternion.copy(player.camera.quaternion);
        }

        const spd = Math.sqrt(this.body.velocity.x ** 2 + this.body.velocity.z ** 2);
        this.animTimer += delta * (spd + 0.5);
        if (spd > 0.5) {
            this.leftLeg.position.z = Math.sin(this.animTimer * 5) * 0.2;
            this.rightLeg.position.z = Math.cos(this.animTimer * 5) * 0.2;
            this.torso.position.y = -0.05 + Math.abs(Math.sin(this.animTimer * 10)) * 0.05;
        }
    }
}

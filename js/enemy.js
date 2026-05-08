import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

const STATE = { PATROL: 0, ALERT: 1, ATTACK: 2 };
const ENEMY_GROUP = 2;
const PLAYER_GROUP = 1;
const GROUND_GROUP = 4;

export class Enemy {
    constructor(scene, world, terrain, position, game) {
        this.scene = scene;
        this.world = world;
        this.terrain = terrain;
        this.game = game;

        this.maxHealth = 100;
        this.health = 100;
        this.speed = 8;
        this.state = STATE.PATROL;
        this.isDead = false;
        this.faction = 'enemy';
        this.awarenessDistance = 250;

        this.spawnPos = position.clone();
        this.waypoints = [];
        this.currentWaypoint = 0;
        this.shootTimer = 1 + Math.random() * 2;
        this.alertTimer = 0;
        this.animTimer = Math.random() * 10;
        this.bullets = [];

        this.group = new THREE.Group();
        this.group.userData.gameEntity = this;
        this.scene.add(this.group);

        this.healthBarGroup = new THREE.Group();
        this.scene.add(this.healthBarGroup);

        this.initPhysics(position);
        this.group.position.set(position.x, position.y, position.z);
        this.initVisuals();
        this.initHealthBar();
        
        this.group.traverse(child => {
            child.userData.gameEntity = this;
        });

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
            linearDamping: 0.5,
            collisionFilterGroup: ENEMY_GROUP,
            collisionFilterMask: PLAYER_GROUP | GROUND_GROUP | ENEMY_GROUP
        });
        this.world.addBody(this.body);
        this.body.mesh = this.group;
        this.body.userData = { gameEntity: this };
        this.body.onHit = (damage) => this.takeDamage(damage);
    }

    initVisuals() {
        const legHeight = 0.5;
        const legY = -0.65;

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
        this.weapon.position.set(0, -0.2, -0.4);
        this.armGroup.add(this.weapon);
    }

    initHealthBar() {
        const bar = new THREE.Mesh(
            new THREE.PlaneGeometry(1.2, 0.15),
            new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide })
        );
        bar.position.y = 1.2;
        this.healthBar = bar;
        this.healthBarGroup.add(bar);

        const bg = new THREE.Mesh(
            new THREE.PlaneGeometry(1.3, 0.2),
            new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide })
        );
        bg.position.set(0, 1.2, -0.01);
        this.healthBarBg = bg;
        this.healthBarGroup.add(bg);
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.health -= amount;
        const pct = Math.max(0, this.health / this.maxHealth);
        this.healthBar.scale.x = pct;
        this.healthBar.material.color.setHSL(pct * 0.3, 1, 0.5);

        this.state = STATE.ALERT;
        this.alertTimer = 12;

        if (this.health <= 0) this.destroy();
    }

    destroy() {
        if (this.isDead) return;
        this.isDead = true;
        if (this.game) this.game.onEnemyKilled(this);

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

        const ragdolls = partData.map(pd => {
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
            
            return { mesh: m, body: rb, life: 6.0 };
        });

        if (this.game) {
            this.game.addRagdolls(ragdolls);
        }
    }

    _snapToTerrain(x, z) {
        return this.terrain ? this.terrain.getHeight(x, z) : this.body.position.y;
    }

    _doPatrol(delta, myPos) {
        if (this.waypoints.length === 0) return;
        const target = this.waypoints[this.currentWaypoint];
        const dx = target.x - myPos.x;
        const dz = target.z - myPos.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < 9) {
            this.currentWaypoint = (this.currentWaypoint + 1) % this.waypoints.length;
        } else {
            const dist = Math.sqrt(distSq);
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
        this.weapon.getWorldPosition(startPos);

        const dir = new THREE.Vector3().subVectors(targetPos, startPos).normalize();
        dir.x += (Math.random() - 0.5) * 0.1;
        dir.y += (Math.random() - 0.5) * 0.1;
        dir.z += (Math.random() - 0.5) * 0.1;
        dir.normalize();

        const bulletSpeed = 120;
        window.game.projectiles.spawnProjectile(startPos, dir, bulletSpeed, 8, this);
    }

    update(delta, playerPos, player) {
        if (this.isDead) return;
        if (!this._waypointsReady && this.terrain) this._buildWaypoints();

        const myPos = this.body.position;

        const groundY = this._snapToTerrain(myPos.x, myPos.z);
        const halfHeight = this.body.shapes[0].halfExtents.y;

        // Anti-Phasing: Teleport back if way below ground
        if (myPos.y < groundY - 10) {
            myPos.y = groundY + 5;
            this.body.velocity.y = 0;
        }

        if (myPos.y < groundY + halfHeight) {
            myPos.y = groundY + halfHeight;
            this.body.velocity.y = Math.max(0, this.body.velocity.y);
        }

        const distToPlayer = myPos.distanceTo(playerPos);

        if (this.state === STATE.PATROL && distToPlayer < this.awarenessDistance) {
            const forward = new THREE.Vector3();
            this.group.getWorldDirection(forward);
            const toPlayer = new THREE.Vector3().subVectors(playerPos, myPos).normalize();
            const dot = forward.dot(toPlayer);

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

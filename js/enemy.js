import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { VFX } from './vfx.js';

const STATE = { PATROL: 0, ALERT: 1, ATTACK: 2 };
const ENEMY_GROUP = 2;
const PLAYER_GROUP = 1;
const GROUND_GROUP = 4;

export class Enemy {
    constructor(scene, world, terrain, position, game, modelPath, fast = false) {
        this.scene = scene;
        this.world = world;
        this.terrain = terrain;
        this.game = game;
        this.modelPath = modelPath;
        this.isFast = fast;

        this.maxHealth = fast ? 300 : 100;
        this.health = this.maxHealth;
        this.speed = fast ? 70 : 12; 
        this.state = STATE.PATROL;
        this.isDead = false;
        this.faction = 'enemy';
        this.awarenessDistance = fast ? 800 : 250;

        this.spawnPos = position.clone();
        this.waypoints = [];
        this.currentWaypoint = 0;
        this.shootTimer = fast ? 0.3 : 1 + Math.random() * 2;
        this.alertTimer = 0;
        this.animTimer = Math.random() * 10;
        this.bullets = [];

        this.group = new THREE.Group();
        this.group.userData.gameEntity = this;
        this.scene.add(this.group);

        // Required placeholders to prevent runtime errors during async load
        this.armGroup = new THREE.Group();
        this.head = new THREE.Object3D();
        this.torso = new THREE.Object3D();
        this.leftLeg = new THREE.Object3D();
        this.rightLeg = new THREE.Object3D();
        this.group.add(this.armGroup);
        this.weapon = new THREE.Object3D(); // Added placeholder
        this.group.add(this.weapon);

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
        const spread = this.isFast ? 150 : 60;
        for (let i = 0; i < 6; i++) {
            const x = this.spawnPos.x + (Math.random() - 0.5) * spread;
            const z = this.spawnPos.z + (Math.random() - 0.5) * spread;
            const y = this.terrain ? this.terrain.getHeight(x, z) + 0.9 : this.spawnPos.y;
            this.waypoints.push(new THREE.Vector3(x, y, z));
        }
    }

    initPhysics(position) {
        const height = this.isFast ? 1.8 : 0.9;
        const radius = this.isFast ? 0.6 : 0.4;
        this.body = new CANNON.Body({
            mass: this.isFast ? 150 : 80,
            shape: new CANNON.Box(new CANNON.Vec3(radius, height, radius)),
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
        if (this.modelPath) {
            const loader = new GLTFLoader();
            loader.load(this.modelPath, (gltf) => {
                const model = gltf.scene;
                model.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if (this.isFast && child.material) {
                            child.material.color.multiplyScalar(0.5); 
                        }
                    }
                });
                
                if (this.isFast) model.scale.set(2.5, 2.5, 2.5);
                else model.scale.set(1, 1, 1);

                model.position.y = this.isFast ? -1.8 : -0.9;
                this.group.add(model);
                this.model = model;
            }, undefined, (error) => {
                console.error("Failed to load enemy model:", error);
                this._fallbackVisuals();
            });
        } else {
            this._fallbackVisuals();
        }
    }

    _fallbackVisuals() {
        const legHeight = 0.5;
        const legY = -0.65;
        const uniformMat = new THREE.MeshStandardMaterial({ color: this.isFast ? 0x220000 : 0x4a4e4d });
        const skinMat = new THREE.MeshStandardMaterial({ color: this.isFast ? 0x660000 : 0xdbac98 });
        const gearMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

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

        const ag = new THREE.Group();
        ag.position.y = 0.15;
        this.group.add(ag);
        this.armGroup = ag;

        const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.15), uniformMat);
        armL.position.set(-0.35, -0.1, 0);
        this.armGroup.add(armL);

        const armR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.15), uniformMat);
        armR.position.set(0.35, -0.1, 0);
        this.armGroup.add(armR);

        this.weapon = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 1.0), gearMat);
        this.weapon.position.set(0, -0.2, -0.4);
        this.armGroup.add(this.weapon);

        if (this.isFast) this.group.scale.set(1.5, 1.5, 1.5);
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

        let partData = [];
        if (this.torso && this.head && this.torso.isMesh) {
            partData = [
                { mesh: this.torso, size: [0.6, 0.7, 0.3] },
                { mesh: this.head, size: [0.25, 0.25, 0.25] },
                { mesh: this.leftLeg, size: [0.2, 0.5, 0.2] },
                { mesh: this.rightLeg, size: [0.2, 0.5, 0.2] }
            ].map(p => {
                const worldPos = new THREE.Vector3();
                p.mesh.getWorldPosition(worldPos);
                return { ...p, worldPos, worldQuat: p.mesh.getWorldQuaternion(new THREE.Quaternion()) };
            });
        }

        this.group.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material && child.material.isMaterial) child.material.dispose();
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

        if (partData.length > 0) {
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
            if (this.game) this.game.addRagdolls(ragdolls);
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
        if (this.armGroup) this.armGroup.rotation.x = 0;

        if (dist > 22) {
            this.body.velocity.x = (dx / dist) * this.speed;
            this.body.velocity.z = (dz / dist) * this.speed;
        } else {
            this.body.velocity.x *= 0.6;
            this.body.velocity.z *= 0.6;
        }
    }

    _doAttack(delta, playerPos, myPos) {
        const dx = playerPos.x - myPos.x;
        const dz = playerPos.z - myPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        this.group.lookAt(playerPos.x, this.group.position.y, playerPos.z);
        
        if (this.armGroup) {
            this.armGroup.rotation.x = -1.2;
        }

        if (dist > 25) {
            this.body.velocity.x = (dx / dist) * this.speed;
            this.body.velocity.z = (dz / dist) * this.speed;
        } else {
            this.body.velocity.x *= 0.8;
            this.body.velocity.z *= 0.8;
        }

        this.shootTimer -= delta;
        if (this.shootTimer <= 0) {
            this.shoot(playerPos);
            this.shootTimer = this.isFast ? 0.3 : 1.5 + Math.random();
        }
    }

    shoot(playerPos) {
        if (this.isDead) return;
        const muzzlePos = new THREE.Vector3();
        if (this.weapon) this.weapon.getWorldPosition(muzzlePos);
        else muzzlePos.copy(this.group.position).add(new THREE.Vector3(0, 0.5, -0.5).applyQuaternion(this.group.quaternion));
        
        const dir = playerPos.clone().sub(muzzlePos).normalize();
        this.game.projectiles.spawnProjectile(muzzlePos, dir, 400, 15, this);
    }

    update(delta, playerPos, player) {
        if (this.isDead) return;

        if (!this._waypointsReady && this.terrain && this.terrain.isLoaded) {
            this._buildWaypoints();
        }

        const myPos = this.body.position;

        const groundY = this._snapToTerrain(myPos.x, myPos.z);
        const halfHeight = this.isFast ? 1.8 : 0.9;

        if (myPos.y < groundY - 10) {
            myPos.y = groundY + 5;
            this.body.velocity.y = 0;
        }

        if (myPos.y < groundY + halfHeight) {
            myPos.y = groundY + halfHeight;
            this.body.velocity.y = Math.max(0, this.body.velocity.y);
        }

        const distToPlayer = myPos.distanceTo(new CANNON.Vec3(playerPos.x, playerPos.y, playerPos.z));

        if (distToPlayer < this.awarenessDistance) {
            this.state = STATE.ATTACK;
        } else if (this.state === STATE.ATTACK) {
            this.state = STATE.ALERT;
            this.alertTimer = 12;
        }

        if (this.state === STATE.PATROL) this._doPatrol(delta, myPos);
        else if (this.state === STATE.ALERT) this._doAlert(delta, playerPos, myPos);
        else if (this.state === STATE.ATTACK) this._doAttack(delta, playerPos, myPos);

        this.group.position.set(myPos.x, myPos.y, myPos.z);
        this.group.quaternion.set(this.body.quaternion.x, this.body.quaternion.y, this.body.quaternion.z, this.body.quaternion.w);

        this.healthBarGroup.position.set(myPos.x, myPos.y + (this.isFast ? 3.0 : 1.8), myPos.z);
        this.healthBarGroup.lookAt(player.camera.position);

        this.animTimer += delta * (this.state === STATE.PATROL ? 1 : 2);
        if (!this.model) {
            this.leftLeg.position.z = Math.sin(this.animTimer * 5) * 0.2;
            this.rightLeg.position.z = Math.cos(this.animTimer * 5) * 0.2;
            this.torso.position.y = -0.05 + Math.abs(Math.sin(this.animTimer * 10)) * 0.05;
        }
    }
}

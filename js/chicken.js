import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const STATE = { IDLE: 0, WANDER: 1, PANIC: 2, DEAD: 3 };

export class Chicken {
    constructor(scene, world, terrain, position, game) {
        this.scene = scene;
        this.world = world;
        this.terrain = terrain;
        this.game = game;

        this.state = STATE.IDLE;
        this.timer = Math.random() * 2;
        this.health = 10;
        this.isDead = false;

        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.initPhysics(position);
        this.initVisuals();
        
        console.log('[Chaos Chicken] Spawned and ready for chaos.');
    }

    initPhysics(position) {
        this.body = new CANNON.Body({
            mass: 5,
            shape: new CANNON.Box(new CANNON.Vec3(0.2, 0.3, 0.25)),
            position: new CANNON.Vec3(position.x, position.y, position.z),
            linearDamping: 0.9,
            angularDamping: 0.9
        });
        this.world.addBody(this.body);
        this.body.onHit = (damage) => this.takeDamage(damage);
    }

    initVisuals() {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0xffffcc }));
        body.position.y = 0.2;
        body.castShadow = true;
        this.group.add(body);
        
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), new THREE.MeshStandardMaterial({ color: 0xffffff }));
        head.position.set(0, 0.5, -0.2);
        this.group.add(head);
        
        const comb = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.15, 0.15), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
        comb.position.set(0, 0.7, -0.2);
        this.group.add(comb);
        
        const beak = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0xffa500 }));
        beak.position.set(0, 0.5, -0.35);
        this.group.add(beak);

        this.group.layers.enable(1); // Minimap visibility
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.health -= amount;
        this.state = STATE.PANIC;
        this.timer = 5.0;
        
        if (this.game && this.game.audio) {
            this.game.audio.play('chicken_squawk');
        }

        if (this.health <= 0) this.die();
    }

    die() {
        if (this.isDead) return;
        this.isDead = true;
        this.state = STATE.DEAD;
        
        if (this.game && this.game.particles) {
            for(let i=0; i<40; i++) {
                const pos = this.group.position.clone();
                const vel = new THREE.Vector3((Math.random()-0.5)*15, Math.random()*20, (Math.random()-0.5)*15);
                const color = Math.random() > 0.5 ? 0xffff00 : 0xffffff;
                this.game.particles.spawnParticle?.(pos, vel, color, 0.8);
            }
        }

        if (this.game && this.game.audio) {
            this.game.audio.play('chicken_squawk');
        }

        if (this.game && this.game.showNotification) {
            this.game.showNotification("KFC: CHICKEN OBLITERATED");
        }

        this.body.mass = 2;
        this.body.updateMassProperties();
        this.body.applyImpulse(new CANNON.Vec3(0, 15, 0), this.body.position);
        this.body.angularVelocity.set(Math.random()*20, Math.random()*20, Math.random()*20);

        setTimeout(() => {
            this.destroy();
        }, 8000);
    }

    update(delta, playerPos) {
        if (this.isDead) {
            this.group.position.copy(this.body.position);
            this.group.quaternion.copy(this.body.quaternion);
            return;
        }

        const myPos = this.body.position;
        const distToPlayer = playerPos ? new THREE.Vector3(myPos.x, myPos.y, myPos.z).distanceTo(playerPos) : 1000;

        if (distToPlayer < 12 && this.state !== STATE.PANIC) {
            this.state = STATE.PANIC;
            this.timer = 5.0;
            if (this.game && this.game.audio && Math.random() < 0.3) this.game.audio.play('chicken_squawk');
        }

        this.timer -= delta;
        if (this.timer <= 0) {
            if (this.state === STATE.IDLE) {
                this.state = STATE.WANDER;
                this.timer = 2 + Math.random() * 4;
                this.targetAngle = Math.random() * Math.PI * 2;
            } else {
                this.state = STATE.IDLE;
                this.timer = 1 + Math.random() * 3;
            }
        }

        if (this.state === STATE.WANDER) {
            let center = new THREE.Vector3();
            let count = 0;
            if (this.game && this.game.chickens) {
                this.game.chickens.forEach(other => {
                    if (other !== this && !other.isDead) {
                        const dist = other.body.position.distanceTo(this.body.position);
                        if (dist < 15) {
                            center.add(new THREE.Vector3(other.body.position.x, 0, other.body.position.z));
                            count++;
                        }
                    }
                });
            }

            const speed = 2.5;
            if (count > 0) {
                center.divideScalar(count);
                const toCenter = center.sub(new THREE.Vector3(myPos.x, 0, myPos.z)).normalize();
                this.targetAngle = Math.atan2(toCenter.x, toCenter.z);
            }

            this.body.velocity.x = Math.sin(this.targetAngle) * speed;
            this.body.velocity.z = Math.cos(this.targetAngle) * speed;
            this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, this.targetAngle + Math.PI, 0.1);

            if (Math.random() < 0.005 && this.game && this.game.audio) this.game.audio.play('chicken_squawk');
        } else if (this.state === STATE.PANIC) {
            const speed = 7;
            const escapeDir = new THREE.Vector3(myPos.x - playerPos.x, 0, myPos.z - playerPos.z).normalize();
            this.body.velocity.x = escapeDir.x * speed;
            this.body.velocity.z = escapeDir.z * speed;
            this.group.rotation.y = Math.atan2(escapeDir.x, escapeDir.z) + Math.PI;
            
            if (Math.random() < 0.08 && Math.abs(this.body.velocity.y) < 0.2) {
                this.body.velocity.y = 6;
                if (this.game && this.game.audio && Math.random() < 0.2) this.game.audio.play('chicken_squawk');
            }
        }

        const groundY = this.terrain.getHeight(myPos.x, myPos.z);
        if (myPos.y < groundY + 0.3) {
            myPos.y = groundY + 0.3;
            this.body.velocity.y = Math.max(0, this.body.velocity.y);
        }

        this.group.position.copy(myPos);
        
        if (this.state === STATE.IDLE) {
            this.group.rotation.x = Math.sin(Date.now() * 0.01) * 0.2;
        } else {
            this.group.rotation.x = 0;
        }
    }

    destroy() {
        if (this.group) {
            this.scene.remove(this.group);
            this.group.traverse(child => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                        else child.material.dispose();
                    }
                }
            });
        }
        if (this.body && this.world) {
            this.world.removeBody(this.body);
            this.body = null;
        }
    }
}

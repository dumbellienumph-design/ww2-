import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Ally {
    constructor(scene, world, terrain, position, audio) {
        this.scene = scene;
        this.world = world;
        this.terrain = terrain;
        this.audio = audio;
        this.health = 100;
        this.speed = 6;
        this.isDead = false;
        
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.initPhysics(position);
        this.initVisuals();
    }

    initPhysics(position) {
        this.body = new CANNON.Body({
            mass: 80, shape: new CANNON.Box(new CANNON.Vec3(0.4, 0.9, 0.4)),
            position: new CANNON.Vec3(position.x, position.y, position.z),
            fixedRotation: true, linearDamping: 0.5
        });
        this.world.addBody(this.body);
        this.body.mesh = this.group;
        this.body.onHit = (damage) => this.takeDamage(damage);
    }

    initVisuals() {
        this.group.position.copy(this.body.position);

        const olive = new THREE.MeshStandardMaterial({ color: 0x3b4d2b });
        const faceMat = new THREE.MeshStandardMaterial({ color: 0xdbac98 });

        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), olive);
        torso.castShadow = true; torso.receiveShadow = true;
        this.group.add(torso);

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), faceMat);
        head.position.y = 0.55;
        this.group.add(head);

        const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), olive);
        helmet.position.y = 0.65;
        helmet.scale.set(1.1, 0.8, 1.1);
        helmet.castShadow = true;
        this.group.add(helmet);
        
        const legGeo = new THREE.BoxGeometry(0.2, 0.9, 0.2);
        this.legL = new THREE.Mesh(legGeo, olive);
        this.legL.position.set(-0.15, -0.65, 0);
        this.group.add(this.legL);
        this.legR = new THREE.Mesh(legGeo, olive);
        this.legR.position.set(0.15, -0.65, 0);
        this.group.add(this.legR);
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0 && !this.isDead) {
            this._die();
        }
    }
    
    _die() {
        if(this.isDead) return;
        this.isDead = true;
        
        this.group.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });
        
        this.scene.remove(this.group);
        if(this.body) this.world.removeBody(this.body);
    }

    destroy(){
        this._die();
    }

    update(delta, playerPos, enemies, objectives, isPlayerActive) {
        if (this.isDead || !isPlayerActive) {
            if(this.body) this.body.velocity.set(0,0,0);
            return;
        };

        if (this.terrain) {
            const groundY = this.terrain.getHeight(this.body.position.x, this.body.position.z);
            const halfHeight = 0.9;
            if (this.body.position.y < groundY + halfHeight) {
                this.body.position.y = groundY + halfHeight;
                this.body.velocity.y = Math.max(0, this.body.velocity.y);
            }
        }
        
        this.group.position.copy(this.body.position);

        const currentPos = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
        const distToPlayer = currentPos.distanceTo(playerPos);
        const dirToPlayer = new THREE.Vector3().subVectors(playerPos, currentPos).normalize();
        
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.group.quaternion);
        const angle = forward.angleTo(dirToPlayer);
        
        const FOV = Math.PI / 1.5; // 120 degrees

        if (distToPlayer > 10 && distToPlayer < 150 && angle < FOV) {
            this.group.lookAt(playerPos.x, this.group.position.y, playerPos.z);
            const moveDir = new THREE.Vector3().subVectors(playerPos, currentPos).normalize();
            this.body.velocity.x = moveDir.x * this.speed;
            this.body.velocity.z = moveDir.z * this.speed;
        } else {
            this.body.velocity.x *= 0.5;
            this.body.velocity.z *= 0.5;
        }
}
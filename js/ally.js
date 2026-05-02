import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Ally {
    constructor(scene, world, position, audio) {
        this.scene = scene;
        this.world = world;
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
        const olive = new THREE.MeshStandardMaterial({ color: 0x3b4d2b });
        const faceMat = new THREE.MeshStandardMaterial({ color: 0xdbac98 });

        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), olive);
        torso.position.y = 0.4;
        torso.castShadow = true; torso.receiveShadow = true;
        this.group.add(torso);

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), faceMat);
        head.position.y = 0.9;
        this.group.add(head);

        const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), olive);
        helmet.position.y = 1.0;
        helmet.scale.set(1.1, 0.8, 1.1);
        helmet.castShadow = true;
        this.group.add(helmet);
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0 && !this.isDead) {
            this.isDead = true;
            this.group.rotation.x = Math.PI / 2.2;
            this.body.mass = 0; this.body.type = CANNON.Body.STATIC;
        }
    }

    update(delta, playerPos, enemies, objectives, isPlayerActive) {
        if (this.isDead || !isPlayerActive) return;

        // --- HOLISTIC REALISM: GROUND CLAMPING ---
        if (window.game && window.game.terrain && window.game.terrain.getHeight) {
            const groundY = window.game.terrain.getHeight(this.body.position.x, this.body.position.z);
            this.body.position.y = THREE.MathUtils.lerp(this.body.position.y, groundY + 0.9, 0.2);
            this.body.velocity.y = 0; 
        }

        const currentPos = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
        const distToPlayer = currentPos.distanceTo(playerPos);
        
        if (distToPlayer > 10) {
            this.group.lookAt(playerPos.x, this.group.position.y, playerPos.z);
            const moveDir = new THREE.Vector3().subVectors(playerPos, currentPos).normalize();
            this.body.velocity.x = moveDir.x * this.speed;
            this.body.velocity.z = moveDir.z * this.speed;
        } else {
            this.body.velocity.set(0, 0, 0);
        }
    }
}
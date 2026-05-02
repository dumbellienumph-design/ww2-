import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

export class Enemy {
    constructor(scene, world, position, audio, type = 'infantry') {
        this.scene = scene;
        this.world = world;
        this.maxHealth = 100;
        this.health = 100;
        this.speed = 4;
        this.isDead = false;
        
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.animTimer = Math.random() * 10;
        
        this.initPhysics(position);
        this.initDetailedVisuals();
        this.initHealthBar();
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

    initDetailedVisuals() {
        const uniformMat = new THREE.MeshStandardMaterial({ color: 0x4a4e4d }); 
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xdbac98 }); 
        const gearMat = new THREE.MeshStandardMaterial({ color: 0x222222 }); 

        // 1. Torso
        this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.3), uniformMat);
        this.torso.position.y = 0.4;
        this.torso.castShadow = true;
        this.group.add(this.torso);

        // 2. Head & Helmet
        this.head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), skinMat);
        this.head.position.y = 0.85;
        this.group.add(this.head);

        const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.15, 8), gearMat);
        helmet.position.y = 1.0;
        helmet.castShadow = true;
        this.group.add(helmet);

        // 3. Legs
        this.leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), uniformMat);
        this.leftLeg.position.set(-0.15, 0, 0);
        this.group.add(this.leftLeg);

        this.rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), uniformMat);
        this.rightLeg.position.set(0.15, 0, 0);
        this.group.add(this.rightLeg);

        // 4. Arms
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
        const barGeo = new THREE.PlaneGeometry(1.2, 0.15);
        const barMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
        this.healthBar = new THREE.Mesh(barGeo, barMat);
        this.healthBar.position.y = 1.5;
        this.group.add(this.healthBar);

        const bgGeo = new THREE.PlaneGeometry(1.3, 0.2);
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
        const bg = new THREE.Mesh(bgGeo, bgMat);
        bg.position.set(0, 1.5, -0.01);
        this.group.add(bg);
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.health -= amount;
        
        // Update Health Bar
        const percent = Math.max(0, this.health / this.maxHealth);
        this.healthBar.scale.x = percent;
        this.healthBar.material.color.setHSL(percent * 0.3, 1, 0.5);

        // Flinch
        this.group.position.y += 0.1;

        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        this.isDead = true;
        this.scene.remove(this.group);
        this.world.removeBody(this.body);

        // --- RAGDOLL COLLAPSE ---
        const parts = [
            { mesh: this.torso, size: [0.6, 0.7, 0.3] },
            { mesh: this.head, size: [0.25, 0.25, 0.25] },
            { mesh: this.leftLeg, size: [0.2, 0.5, 0.2] },
            { mesh: this.rightLeg, size: [0.2, 0.5, 0.2] },
            { mesh: this.weapon, size: [0.08, 0.1, 1.0] }
        ];

        parts.forEach(p => {
            const worldPos = new THREE.Vector3();
            p.mesh.getWorldPosition(worldPos);
            
            const partBody = new CANNON.Body({
                mass: 5,
                shape: new CANNON.Box(new CANNON.Vec3(p.size[0]/2, p.size[1]/2, p.size[2]/2)),
                position: new CANNON.Vec3(worldPos.x, worldPos.y, worldPos.z)
            });
            partBody.velocity.set((Math.random()-0.5)*5, 5, (Math.random()-0.5)*5);
            partBody.angularVelocity.set(Math.random()*10, Math.random()*10, Math.random()*10);
            
            this.world.addBody(partBody);
            
            const partMesh = p.mesh.clone();
            this.scene.add(partMesh);
            
            const updatePart = () => {
                partMesh.position.copy(partBody.position);
                partMesh.quaternion.copy(partBody.quaternion);
                if (partBody.position.y > -5) requestAnimationFrame(updatePart);
                else { this.scene.remove(partMesh); this.world.removeBody(partBody); }
            };
            updatePart();
            
            setTimeout(() => { this.scene.remove(partMesh); this.world.removeBody(partBody); }, 5000);
        });
    }

    update(delta, playerPos, player) {
        if (this.isDead) return;

        const currentPos = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
        const dist = currentPos.distanceTo(playerPos);

        // Look at player
        this.group.lookAt(playerPos.x, this.group.position.y, playerPos.z);
        if (this.healthBar) this.healthBar.lookAt(player.camera.position);

        // Animation
        const moveSpeed = this.body.velocity.length();
        this.animTimer += delta * (moveSpeed + 1);
        
        if (moveSpeed > 0.5) {
            this.leftLeg.position.z = Math.sin(this.animTimer * 5) * 0.2;
            this.rightLeg.position.z = Math.cos(this.animTimer * 5) * 0.2;
            this.torso.position.y = 0.4 + Math.abs(Math.sin(this.animTimer * 10)) * 0.05;
        }

        if (dist < 150) {
            const moveDir = new THREE.Vector3().subVectors(playerPos, currentPos).normalize();
            if (dist > 20) {
                this.body.velocity.x = moveDir.x * this.speed;
                this.body.velocity.z = moveDir.z * this.speed;
                this.armGroup.rotation.x = 0;
            } else {
                this.body.velocity.set(0, 0, 0);
                this.armGroup.rotation.x = -1.2;
                if (Math.random() > 0.98) this.shoot(playerPos, player);
            }
        }
    }

    shoot(targetPos, player) {
        const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial({color: 0xff0000}));
        const startPos = new THREE.Vector3();
        this.torso.getWorldPosition(startPos); startPos.y += 0.5;
        bullet.position.copy(startPos);
        this.scene.add(bullet);
        const dir = new THREE.Vector3().subVectors(targetPos, startPos).normalize();
        const startTime = Date.now();
        const anim = () => {
            if (Date.now() - startTime > 2000 || this.isDead) { this.scene.remove(bullet); return; }
            bullet.position.add(dir.clone().multiplyScalar(1.5));
            if (bullet.position.distanceTo(player.body.position) < 1.5) {
                player.takeDamage(5); this.scene.remove(bullet); return;
            }
            requestAnimationFrame(anim);
        };
        anim();
    }
}
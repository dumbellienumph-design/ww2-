import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

export class Tank {
    constructor(scene, world, terrain, position, audio, particles) {
        this.scene = scene;
        this.world = world;
        this.terrain = terrain;
        this.audio = audio;
        this.particles = particles;
        
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.initPhysics(position);
        this.initVisuals();
        
        this.group.layers.enable(1);
        this.group.traverse(child => {
            child.layers.enable(1);
        });

        this.isOccupied = false;
        this.isSniperMode = false;
        this.currentTurretYaw = 0;
        this.currentBarrelPitch = 0;
        this.traverseSpeed = 0.4; 
        this.elevationSpeed = 0.2;

        this.initAimingReticle();
        
        this.maxHealth = 200;
        this.health = 200;
        this.maxFuel = 100;
        this.fuel = 100;
        this.ammo = 40;
        this.isDestroyed = false;
        
        this.exhaustTimer = 0;
        this.damageTimer = 0;

        this.body.onHit = (damage) => this.takeDamage(damage);
    }

    takeDamage(amount) {
        if(this.isDestroyed) return;
        this.health -= amount;
        if(this.health <= 0) {
            this.health = 0;
            this.isDestroyed = true;
            VFX.createExplosion(this.scene, this.world, this.group.position, 15, 100, this.audio);
        }
    }

    initAimingReticle() {
        const reticleGeo = new THREE.RingGeometry(0.5, 0.6, 32);
        const reticleMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false, transparent: true, opacity: 0.8 });
        this.reticle = new THREE.Mesh(reticleGeo, reticleMat);
        this.reticle.renderOrder = 999;
        this.scene.add(this.reticle);
        this.reticle.visible = false;
    }

    initPhysics(position) {
        const hullShape = new CANNON.Box(new CANNON.Vec3(2.6, 1.0, 4));
        this.body = new CANNON.Body({
            mass: 25000, 
            shape: hullShape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            linearDamping: 0.2,
            angularDamping: 0.1
        });
        this.body.shapeOffsets[0].set(0, 0.5, 0);
        this.body.userData = { gameEntity: this };
        this.world.addBody(this.body);
        this.body.mesh = this.group;
    }

    initVisuals() {
        const tigerGrey = new THREE.MeshStandardMaterial({ 
            color: 0x2f3131, 
            roughness: 0.9, 
            metalness: 0.1,
            flatShading: false
        });
        const darkSteel = new THREE.MeshStandardMaterial({ 
            color: 0x111111, 
            metalness: 0.6, 
            roughness: 0.5 
        });
        const rustMetal = new THREE.MeshStandardMaterial({ 
            color: 0x2d2424, 
            metalness: 0.3, 
            roughness: 0.8 
        });
        const vOffset = -0.5;
        const mainHull = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.3, 7.5), tigerGrey);
        mainHull.position.y = 0.65 + vOffset;
        this.group.add(mainHull);
        const frontArmor = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.2, 0.4), tigerGrey);
        frontArmor.position.set(0, 1.4 + vOffset, -3.2);
        this.group.add(frontArmor);
        const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
        wheelGeo.rotateZ(Math.PI / 2);
        for (let i = 0; i < 8; i++) {
            const wz = -3.2 + i * 0.95;
            const xPos = (i % 2 === 0) ? 2.3 : 1.9;
            const wl = new THREE.Mesh(wheelGeo, darkSteel);
            wl.position.set(-xPos, 0.2, wz);
            this.group.add(wl);
            const wr = wl.clone();
            wr.position.x = xPos;
            this.group.add(wr);
        }
        this.turretGroup = new THREE.Group();
        this.turretGroup.position.set(0, 1.6 + vOffset, 0);
        this.group.add(this.turretGroup);
        const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.9, 1.2, 16), tigerGrey);
        this.turretGroup.add(turretBase);
        const mantlet = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.6), tigerGrey);
        mantlet.position.set(0, 0, -1.8);
        this.turretGroup.add(mantlet);
        this.barrelGroup = new THREE.Group();
        this.barrelGroup.position.set(0, 0, -1.8);
        this.turretGroup.add(this.barrelGroup);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 5.5), rustMetal);
        barrel.rotateX(Math.PI / 2);
        barrel.position.z = -2.75;
        this.barrelGroup.add(barrel);
        const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 12), darkSteel);
        brake.rotateX(Math.PI / 2);
        brake.position.z = -5.8;
        this.barrelGroup.add(brake);

        this.exhaustL = new THREE.Object3D(); this.exhaustL.position.set(-0.8, 1.0 + vOffset, 3.8); this.group.add(this.exhaustL);
        this.exhaustR = new THREE.Object3D(); this.exhaustR.position.set(0.8, 1.0 + vOffset, 3.8); this.group.add(this.exhaustR);

        this.chaseCameraAnchor = new THREE.Object3D();
        this.chaseCameraAnchor.position.set(0, 6, 12); 
        this.group.add(this.chaseCameraAnchor);
        this.sniperCameraAnchor = new THREE.Object3D();
        this.sniperCameraAnchor.position.set(0, 0.3, -1.5); 
        this.turretGroup.add(this.sniperCameraAnchor);
    }

    update(delta, controls, camera) {
        this.group.position.copy(this.body.position);
        this.group.quaternion.copy(this.body.quaternion);

        if(this.isDestroyed) {
            this.body.velocity.set(0, 0, 0);
            this.body.angularVelocity.set(0, 0, 0);
            if(this.particles) {
                const worldPos = new THREE.Vector3(); this.turretGroup.getWorldPosition(worldPos);
                this.particles.createFire(worldPos);
                this.particles.createExhaustSmoke(worldPos, new THREE.Vector3(0, 2, 0), true);
            }
            return;
        }

        if (!this.isOccupied) {
            if(this.reticle) this.reticle.visible = false;
            return;
        }

        const ctrl = controls.moveState || controls;
        const speed = this.body.velocity.length();

        if(speed > 1) this.fuel -= delta * 0.1; 
        
        let moveForward = ctrl.forward && this.fuel > 0;
        let moveBackward = ctrl.backward && this.fuel > 0;

        this.damageTimer += delta;
        if (this.damageTimer > 0.2 && !this.isDestroyed) {
            const worldPosL = new THREE.Vector3(); this.exhaustL.getWorldPosition(worldPosL);
            const worldPosR = new THREE.Vector3(); this.exhaustR.getWorldPosition(worldPosR);
            const smokeVel = new THREE.Vector3(0, 1, 2).applyQuaternion(this.group.quaternion);
            
            if(this.particles) {
                if(this.health < 100) this.particles.createExhaustSmoke(worldPosL, smokeVel, true);
                else if (moveForward) this.particles.createExhaustSmoke(worldPosL, smokeVel, false);
                
                if(this.health < 50) this.particles.createFire(worldPosR, 0.5, 0.5);
            }
            this.damageTimer = 0;
        }

        if (this.audio && typeof this.audio.play === 'function') {
            this.audio.play('tank_engine');
        }

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.group.quaternion);
        let targetSpeed = 0;
        if (moveForward) targetSpeed = 15;
        else if (moveBackward) targetSpeed = -10;

        const currentY = this.body.velocity.y;
        this.body.velocity.x = forward.x * targetSpeed;
        this.body.velocity.z = forward.z * targetSpeed;
        this.body.velocity.y = currentY; 

        const turnSpeed = 1.5;
        if (ctrl.left) this.body.angularVelocity.y = turnSpeed;
        else if (ctrl.right) this.body.angularVelocity.y = -turnSpeed;
        else this.body.angularVelocity.y *= 0.5;

        this.body.angularVelocity.x *= 0.1;
        this.body.angularVelocity.z *= 0.1;

        if (this.terrain) {
            const pos = this.body.position;
            const groundY = this.terrain.getHeight(pos.x, pos.z);
            const halfHeight = 0.5;
            
            // --- Advanced Grounding (Slope Alignment) ---
            const offset = 3.0; // Distance to sample from center
            const hF = this.terrain.getHeight(pos.x, pos.z - offset);
            const hB = this.terrain.getHeight(pos.x, pos.z + offset);
            const hL = this.terrain.getHeight(pos.x - offset, pos.z);
            const hR = this.terrain.getHeight(pos.x + offset, pos.z);

            const pitch = Math.atan2(hF - hB, offset * 2);
            const roll = Math.atan2(hR - hL, offset * 2);

            // Anti-Phasing: Teleport back if way below ground
            if (this.body.position.y < groundY - 10) {
                this.body.position.y = groundY + 5;
                this.body.velocity.y = 0;
            }

            // Smoothly align physics body to terrain
            const targetQuat = new CANNON.Quaternion();
            const currentEuler = new THREE.Euler().setFromQuaternion(this.group.quaternion, 'YXZ');
            targetQuat.setFromEuler(pitch, currentEuler.y, roll, 'YXZ');
            this.body.quaternion.slerp(targetQuat, 0.1, this.body.quaternion);

            if (this.body.position.y < groundY + halfHeight) {
                this.body.position.y = groundY + halfHeight;
                this.body.velocity.y = Math.max(0, this.body.velocity.y);
            }
        }

        const camEuler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        const hullEuler = new THREE.Euler().setFromQuaternion(this.group.quaternion, 'YXZ');

        let targetYaw = camEuler.y - hullEuler.y;
        let targetPitch = camEuler.x;

        let yawDiff = targetYaw - this.currentTurretYaw;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        
        const stepY = this.traverseSpeed * delta;
        if (Math.abs(yawDiff) < stepY) this.currentTurretYaw = targetYaw;
        else this.currentTurretYaw += Math.sign(yawDiff) * stepY;
        this.turretGroup.rotation.y = this.currentTurretYaw;

        targetPitch = Math.max(-0.35, Math.min(0.17, targetPitch));
        let pitchDiff = targetPitch - this.currentBarrelPitch;
        const stepX = this.elevationSpeed * delta;
        if (Math.abs(pitchDiff) < stepX) this.currentBarrelPitch = targetPitch;
        else this.currentBarrelPitch += Math.sign(pitchDiff) * stepX;
        this.barrelGroup.rotation.x = this.currentBarrelPitch;

        if(this.reticle) {
            this.reticle.visible = true;
            const rayDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.barrelGroup.getWorldQuaternion(new THREE.Quaternion()));
            const rayOrigin = new THREE.Vector3();
            this.barrelGroup.getWorldPosition(rayOrigin);
            this.reticle.position.copy(rayOrigin).add(rayDir.multiplyScalar(50));
            this.reticle.lookAt(camera.position);
            const isAimed = Math.abs(yawDiff) < 0.05 && Math.abs(pitchDiff) < 0.05;
            this.reticle.material.color.setHex(isAimed ? 0x00ff00 : 0xff0000);
        }

        if (ctrl.shoot && this.ammo > 0) {
            this.fire();
            ctrl.shoot = false;
        }
    }

    fire() {
        if (this.ammo <= 0) return;
        this.ammo--;
        
        if(this.audio && typeof this.audio.play === 'function') this.audio.play('tank_fire');
        const tip = new THREE.Vector3(0, 0, -6.5).applyMatrix4(this.barrelGroup.matrixWorld);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.barrelGroup.getWorldQuaternion(new THREE.Quaternion()));
        if(this.particles) this.particles.createMuzzleFlash(tip, dir, true);

        this.barrelGroup.position.z += 0.4;
        setTimeout(() => this.barrelGroup.position.z -= 0.4, 60);
        
        window.game.projectiles.spawnProjectile(tip, dir, 130, 250, this, false, true); 
    }

    destroy() {
        if (this.isDestroyed) return;
        this.isDestroyed = true;

        if (this.body && this.world) {
            this.world.removeBody(this.body);
            this.body = null;
        }

        if (this.group) {
            this.scene.remove(this.group);
            this.group.traverse(child => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];
                        materials.forEach(m => {
                            if (m.map) m.map.dispose();
                            if (m.lightMap) m.lightMap.dispose();
                            if (m.bumpMap) m.bumpMap.dispose();
                            if (m.normalMap) m.normalMap.dispose();
                            if (m.specularMap) m.specularMap.dispose();
                            if (m.envMap) m.envMap.dispose();
                            m.dispose();
                        });
                    }
                }
            });
        }
        
        if (this.reticle) {
            this.scene.remove(this.reticle);
            if (this.reticle.geometry) this.reticle.geometry.dispose();
            if (this.reticle.material) this.reticle.material.dispose();
        }
    }
}

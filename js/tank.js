import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

export class Tank {
    constructor(scene, world, position, audio, particles) {
        this.scene = scene;
        this.world = world;
        this.audio = audio;
        this.particles = particles;
        
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.initPhysics(position);
        this.initVisuals();
        this.initMinimapIcon();
        
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

    initMinimapIcon() {
        const iconGeo = new THREE.BoxGeometry(6, 1, 6);
        const iconMat = new THREE.MeshBasicMaterial({ color: 0x0000ff });
        this.minimapIcon = new THREE.Mesh(iconGeo, iconMat);
        this.minimapIcon.position.set(0, 100, 0);
        this.minimapIcon.layers.set(1);
        this.group.add(this.minimapIcon);
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
        this.world.addBody(this.body);
        this.body.mesh = this.group;
    }

    initVisuals() {
        const tigerGrey = new THREE.MeshStandardMaterial({ color: 0x4a4e4d, roughness: 0.8, metalness: 0.2 });
        const darkSteel = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.4 });
        const rustMetal = new THREE.MeshStandardMaterial({ color: 0x3d3535, metalness: 0.5, roughness: 0.7 });
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
            if(this.audio && typeof this.audio.stop === 'function') this.audio.stop('tank_engine');
            return;
        }

        const speed = this.body.velocity.length();

        // --- FUEL DEGRADATION ---
        if(speed > 1) this.fuel -= delta * 0.1; 
        if(this.fuel <= 0) { this.fuel = 0; controls.forward = false; controls.backward = false; }

        // --- VISUAL DAMAGE STATES ---
        this.damageTimer += delta;
        if (this.damageTimer > 0.2) {
            const worldPosL = new THREE.Vector3(); this.exhaustL.getWorldPosition(worldPosL);
            const worldPosR = new THREE.Vector3(); this.exhaustR.getWorldPosition(worldPosR);
            const smokeVel = new THREE.Vector3(0, 1, 2).applyQuaternion(this.group.quaternion);
            
            if(this.particles) {
                if(this.health < 100) this.particles.createExhaustSmoke(worldPosL, smokeVel, true);
                else this.particles.createExhaustSmoke(worldPosL, smokeVel, false);
                
                if(this.health < 50) this.particles.createFire(worldPosR);
            }
            this.damageTimer = 0;
        }

        if (this.audio && typeof this.audio.play === 'function') {
            this.audio.play('tank_engine');
            const pitchRate = 1.0 + (speed / 15) * 0.8;
            if (typeof this.audio.setPlaybackRate === 'function') this.audio.setPlaybackRate('tank_engine', pitchRate);
        }

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.group.quaternion);
        let targetSpeed = 0;
        if (controls.forward && this.fuel > 0) targetSpeed = 15;
        else if (controls.backward && this.fuel > 0) targetSpeed = -10;

        const currentY = this.body.velocity.y;
        this.body.velocity.x = forward.x * targetSpeed;
        this.body.velocity.z = forward.z * targetSpeed;
        this.body.velocity.y = currentY; 

        const turnSpeed = 1.5;
        if (controls.left) this.body.angularVelocity.y = turnSpeed;
        else if (controls.right) this.body.angularVelocity.y = -turnSpeed;
        else this.body.angularVelocity.y *= 0.5;

        this.body.angularVelocity.x *= 0.1;
        this.body.angularVelocity.z *= 0.1;

        // --- TERRAIN NORMAL ALIGNMENT ---
        if (window.game && window.game.terrain) {
            const rayOrigin = new CANNON.Vec3(this.body.position.x, this.body.position.y + 5, this.body.position.z);
            const rayTarget = new CANNON.Vec3(this.body.position.x, this.body.position.y - 5, this.body.position.z);
            // Since we don't have a raycast easily here, we can approximate the normal
            const epsilon = 0.5;
            const hL = window.game.terrain.getHeight(this.body.position.x - epsilon, this.body.position.z);
            const hR = window.game.terrain.getHeight(this.body.position.x + epsilon, this.body.position.z);
            const hF = window.game.terrain.getHeight(this.body.position.x, this.body.position.z - epsilon);
            const hB = window.game.terrain.getHeight(this.body.position.x, this.body.position.z + epsilon);
            
            const normal = new THREE.Vector3(hL - hR, 2 * epsilon, hF - hB).normalize();
            const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
            
            // Blend the terrain normal with the current heading (Y-rotation)
            const headingQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.body.quaternion.y, 0, 'YXZ'));
            // This is a bit complex to do perfectly with Cannon-es quats, so we'll just let physics handle most of it
            // but we can apply a small torque to help it align.
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

        if (controls.shoot && this.ammo > 0) {
            this.fire();
            controls.shoot = false;
        }
    }

    fire() {
        this.ammo--;
        if(this.audio && typeof this.audio.play === 'function') this.audio.play('tank_fire');
        const tip = new THREE.Vector3(0, 0, -6.5).applyMatrix4(this.barrelGroup.matrixWorld);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.barrelGroup.getWorldQuaternion(new THREE.Quaternion()));
        if(this.particles) this.particles.createMuzzleFlash(tip, dir, true);

        this.barrelGroup.position.z += 0.4;
        setTimeout(() => this.barrelGroup.position.z -= 0.4, 60);
        const shellMesh = new THREE.Mesh(new THREE.SphereGeometry(0.4), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
        this.scene.add(shellMesh);
        const shellBody = new CANNON.Body({
            mass: 25, shape: new CANNON.Sphere(0.4),
            position: new CANNON.Vec3(tip.x, tip.y, tip.z),
            velocity: new CANNON.Vec3(dir.x * 130, dir.y * 130, dir.z * 130)
        });
        this.world.addBody(shellBody);
        shellBody.mesh = shellMesh;
        shellBody.addEventListener('collide', (e) => {
            VFX.createExplosion(this.scene, this.world, shellBody.position.clone(), 15, 250, this.audio);
            setTimeout(() => { if (shellBody.world) { this.world.removeBody(shellBody); this.scene.remove(shellMesh); } }, 20);
        });
        setTimeout(() => { if(shellBody.world) { this.world.removeBody(shellBody); this.scene.remove(shellMesh); } }, 5000);
    }
}
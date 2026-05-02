import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

export class Helicopter {
    constructor(scene, world, position, audio, particles) {
        this.scene = scene;
        this.world = world;
        this.audio = audio;
        this.particles = particles;
        
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.initPhysics(position);
        this.initVisuals();
        
        this.isOccupied = false;
        this.isSniperMode = false; 

        // --- 5.2 FLIGHT DYNAMICS ---
        this.maxHealth = 150;
        this.health = 150;
        this.maxFuel = 100;
        this.fuel = 100;
        this.ammo = 1000;
        this.isDestroyed = false;

        this.enginePower = 0;
        this.targetAltitude = 15;
        this.yaw = 0;
        this.pitch = 0;
        this.roll = 0;

        this.fireTimer = 0;
        this.damageTimer = 0;

        this.body.onHit = (damage) => this.takeDamage(damage);
    }

    takeDamage(amount) {
        if(this.isDestroyed) return;
        this.health -= amount;
        if(this.health <= 0) {
            this.health = 0;
            this.isDestroyed = true;
            VFX.createExplosion(this.scene, this.world, this.group.position, 12, 100, this.audio);
            this.body.mass = 5000; // Drop like a rock
        }
    }

    initPhysics(position) {
        const shape = new CANNON.Box(new CANNON.Vec3(2, 1.2, 5));
        this.body = new CANNON.Body({
            mass: 0, // Kinematic/Static until occupied
            shape: shape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            linearDamping: 0.8,
            angularDamping: 0.8
        });
        this.world.addBody(this.body);
        this.body.mesh = this.group;
    }

    initVisuals() {
        const armyGreen = new THREE.MeshStandardMaterial({ color: 0x2e3b23, roughness: 0.8 });
        const darkMetal = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8 });
        const cockpitGlass = new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.5 });

        const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(1.5, 6, 4, 8), armyGreen);
        fuselage.rotation.x = Math.PI / 2;
        this.group.add(fuselage);

        const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 16, 0, Math.PI, 0, Math.PI), cockpitGlass);
        cockpit.position.set(0, 0.2, -3.5);
        cockpit.rotation.x = -Math.PI / 2;
        this.group.add(cockpit);

        this.rotorGroup = new THREE.Group();
        this.rotorGroup.position.y = 1.8;
        this.group.add(this.rotorGroup);
        const bladeGeo = new THREE.BoxGeometry(10, 0.05, 0.4);
        const blade1 = new THREE.Mesh(bladeGeo, darkMetal);
        this.rotorGroup.add(blade1);
        const blade2 = blade1.clone(); blade2.rotation.y = Math.PI / 2;
        this.rotorGroup.add(blade2);

        this.tailGroup = new THREE.Group();
        this.tailGroup.position.set(0, 0, 4.5);
        this.group.add(this.tailGroup);
        const tailBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.8, 4), armyGreen);
        tailBoom.rotation.x = Math.PI / 2; tailBoom.position.z = 2;
        this.tailGroup.add(tailBoom);
        this.tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 0.3), darkMetal);
        this.tailRotor.position.set(0.5, 0, 4);
        this.tailGroup.add(this.tailRotor);

        this.chaseCameraAnchor = new THREE.Object3D();
        this.chaseCameraAnchor.position.set(0, 5, 15);
        this.group.add(this.chaseCameraAnchor);
    }

    update(delta, controls, camera) {
        if(this.isDestroyed) {
            this.rotorGroup.rotation.y *= 0.95;
            if(this.particles) {
                const worldPos = new THREE.Vector3(); this.group.getWorldPosition(worldPos);
                this.particles.createFire(worldPos);
            }
            return;
        }

        if (!this.isOccupied) {
            this.body.mass = 0; this.body.type = CANNON.Body.STATIC;
            this.enginePower = THREE.MathUtils.lerp(this.enginePower, 0, 0.05);
            this.rotorGroup.rotation.y += this.enginePower * delta * 20;
            this.tailRotor.rotation.x += this.enginePower * delta * 25;
            if(this.audio && typeof this.audio.stop === 'function') this.audio.stop('heli_engine');
            return;
        }

        this.body.mass = 5000; this.body.type = CANNON.Body.DYNAMIC;

        const speed = this.body.velocity.length();
        if(this.audio && typeof this.audio.play === 'function') {
            this.audio.play('heli_engine');
            const pitchRate = 0.5 + (this.enginePower * 0.5) + (speed / 50);
            if (typeof this.audio.setPlaybackRate === 'function') this.audio.setPlaybackRate('heli_engine', pitchRate);
        }

        if(this.fuel > 0) this.enginePower = THREE.MathUtils.lerp(this.enginePower, 1, 0.02);
        else this.enginePower = THREE.MathUtils.lerp(this.enginePower, 0, 0.05);

        this.fuel -= delta * 0.2 * this.enginePower;

        this.rotorGroup.rotation.y += this.enginePower * delta * 40;
        this.tailRotor.rotation.x += this.enginePower * delta * 45;

        const lift = this.enginePower * 25 * 5000; 
        const gravity = 25 * 5000;
        let liftForce = gravity; 

        if (controls.forward) { this.pitch = THREE.MathUtils.lerp(this.pitch, 0.4, 0.05); }
        else if (controls.backward) { this.pitch = THREE.MathUtils.lerp(this.pitch, -0.3, 0.05); }
        else { this.pitch = THREE.MathUtils.lerp(this.pitch, 0, 0.05); }

        if (controls.left) { this.yaw += delta * 1.5; this.roll = THREE.MathUtils.lerp(this.roll, 0.3, 0.05); }
        else if (controls.right) { this.yaw -= delta * 1.5; this.roll = THREE.MathUtils.lerp(this.roll, -0.3, 0.05); }
        else { this.roll = THREE.MathUtils.lerp(this.roll, 0, 0.05); }

        const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, this.yaw, this.roll, 'YXZ'));
        this.body.quaternion.copy(quat);

        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.group.quaternion);
        this.body.applyForce(new CANNON.Vec3(up.x * liftForce, up.y * liftForce, up.z * liftForce), this.body.position);

        if (controls.shoot && this.ammo > 0) {
            this.fire();
        }
    }

    fire() {
        this.fireTimer += 0.016;
        if (this.fireTimer < 0.1) return;
        this.fireTimer = 0;
        this.ammo--;
        if(this.audio && typeof this.audio.play === 'function') this.audio.play('heli_fire', { randomPitch: true });
        
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.group.quaternion);
        const offset = new THREE.Vector3(2, -1, -4).applyQuaternion(this.group.quaternion);
        const tip = this.group.position.clone().add(offset);
        if(this.particles) this.particles.createMuzzleFlash(tip, dir, false);

        const ray = new THREE.Raycaster(tip, dir, 0, 300);
        const intersects = ray.intersectObjects(this.scene.children, true);
        if (intersects.length > 0) {
            const hitBody = this.findPhysicsBody(intersects[0].object);
            if (hitBody && hitBody.onHit) hitBody.onHit(20);
        }
    }

    findPhysicsBody(mesh) {
        let obj = mesh;
        while(obj) {
            const body = this.world.bodies.find(b => b.mesh === obj);
            if(body) return body;
            obj = obj.parent;
        }
        return null;
    }
}
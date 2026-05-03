import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

export class Player {
    constructor(scene, world, domElement, audio, particles) {
        this.scene = scene;
        this.world = world;
        this.domElement = domElement;
        this.audio = audio;
        this.particles = particles;

        this.baseFOV = 75;
        this.camera = new THREE.PerspectiveCamera(this.baseFOV, window.innerWidth / window.innerHeight, 0.1, 5000);
        this.camera.rotation.order = 'YXZ';
        this.camera.layers.enable(1);

        this.walkSpeed = 20;
        this.health = 100;
        this.maxHealth = 100;
        this.bandages = 3;
        this.isDead = false;
        this.isSprinting = false;
        this.lastDamageTime = -99999;
        this.footstepTimer = 0;
        this.canJump = false;
        this.terrain = null;

        this.moveState = {
            forward: false, backward: false, left: false, right: false,
            jump: false, shoot: false, ads: false
        };

        this.weapons = [{
            name: 'M1 Garand', fireRate: 0.45, damage: 35,
            capacity: 8, ammo: 8, reserve: 48,
            reloadTime: 2.2, adsFOV: 65, length: 0.8, color: 0x221100
        }];
        this.currentWeaponIndex = 0;
        this.projectiles = [];
        this.fireTimer = 0;
        this.pitch = 0;
        this.yaw = 0;

        this.initPhysics();
        this.initControls();
        this.initWeaponVisuals();
        this.updateAmmoUI();
        this.updateHealthUI();
        this.updateBandageUI();
    }

    initPhysics() {
        const material = new CANNON.Material("playerMaterial");
        this.body = new CANNON.Body({
            mass: 80,
            shape: new CANNON.Sphere(1.5),
            fixedRotation: true,
            linearDamping: 0.5,
            position: new CANNON.Vec3(0, 100, 0),
            material: material
        });
        this.body.addEventListener('collide', (e) => { if (e.contact.ni.y > 0.4) this.canJump = true; });
        this.world.addBody(this.body);
        const groundMat = new CANNON.Material("groundMaterial");
        this.world.bodies.forEach(b => { if (b.mass === 0) b.material = groundMat; });
        const cm = new CANNON.ContactMaterial(material, groundMat, {
            friction: 2.0, restitution: 0.0,
            contactEquationStiffness: 1e8, contactEquationRelaxation: 3
        });
        this.world.addContactMaterial(cm);
    }

    initControls() {
        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === this.domElement) {
                const s = 0.002;
                this.yaw -= e.movementX * s;
                this.pitch -= e.movementY * s;
                this.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.pitch));
            }
        });
        document.addEventListener('keydown', (e) => this.onKey(e.code, true));
        document.addEventListener('keyup', (e) => this.onKey(e.code, false));
        document.addEventListener('mousedown', (e) => {
            if (document.pointerLockElement === this.domElement && e.button === 0) this.moveState.shoot = true;
        });
        document.addEventListener('mouseup', (e) => {
            if (document.pointerLockElement === this.domElement && e.button === 0) this.moveState.shoot = false;
        });
    }

    onKey(code, isPressed) {
        switch (code) {
            case 'KeyW': this.moveState.forward = isPressed; break;
            case 'KeyS': this.moveState.backward = isPressed; break;
            case 'KeyA': this.moveState.left = isPressed; break;
            case 'KeyD': this.moveState.right = isPressed; break;
            case 'Space': this.moveState.jump = isPressed; break;
            case 'ShiftLeft': case 'ShiftRight': this.isSprinting = isPressed; break;
            case 'KeyF': if (isPressed) this.useBandage(); break;
        }
    }

    initWeaponVisuals() {
        this.gunGroup = new THREE.Group();
        this.gunGroup.layers.set(1);

        const steel = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.3 });
        const walnut = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.8 });

        const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
            const m = new THREE.Mesh(geo, mat);
            m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.layers.set(1);
            this.gunGroup.add(m); return m;
        };

        add(new THREE.BoxGeometry(0.08, 0.12, 0.45), steel);
        add(new THREE.CylinderGeometry(0.02, 0.025, 0.35), steel, 0, 0, -0.4, Math.PI / 2, 0, 0);
        add(new THREE.BoxGeometry(0.005, 0.03, 0.02), steel, 0, 0.035, -0.55);
        const stock = add(new THREE.BoxGeometry(0.07, 0.15, 0.3), walnut, 0, -0.05, 0.35);
        stock.rotation.x = -0.15;
        const grip = add(new THREE.BoxGeometry(0.06, 0.18, 0.08), walnut, 0, -0.15, 0.1);
        grip.rotation.x = -0.3;
        add(new THREE.BoxGeometry(0.07, 0.05, 0.25), walnut, 0, -0.06, -0.2);
        add(new THREE.BoxGeometry(0.05, 0.15, 0.06), steel, 0, -0.15, 0.05);
        add(new THREE.TorusGeometry(0.04, 0.005, 8, 16, Math.PI), steel, 0, -0.08, 0.05, 0, Math.PI / 2, 0);
        add(new THREE.BoxGeometry(0.06, 0.03, 0.04), steel, 0, 0.07, 0.15);

        this.muzzle = new THREE.Object3D();
        this.muzzle.position.z = -0.6;
        this.gunGroup.add(this.muzzle);

        this.muzzleLight = new THREE.PointLight(0xffaa44, 0, 15);
        this.muzzleLight.layers.set(1);
        this.muzzle.add(this.muzzleLight);

        this.gunGroup.position.set(0.4, -0.4, -0.6);
        this.camera.add(this.gunGroup);
        this.scene.add(this.camera);
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.health = Math.max(0, this.health - amount);
        this.lastDamageTime = Date.now();
        this.updateHealthUI();

        const overlay = document.getElementById('suppression-overlay');
        if (overlay) { overlay.classList.add('active'); setTimeout(() => overlay.classList.remove('active'), 350); }

        if (this.health <= 0) this._die();
    }

    _die() {
        this.isDead = true;
        if (window.game) window.game.endGame(false);
    }

    useBandage() {
        if (this.bandages <= 0 || this.health >= this.maxHealth || this.isDead) return;
        this.bandages--;
        this.health = Math.min(this.maxHealth, this.health + 30);
        this.updateHealthUI();
        this.updateBandageUI();
    }

    updateHealthUI() {
        const pct = (this.health / this.maxHealth) * 100;
        const bar = document.getElementById('health-bar');
        if (bar) { bar.style.width = pct + '%'; bar.classList.toggle('bleeding', pct < 30); }
    }

    updateAmmoUI() {
        const w = this.weapons[this.currentWeaponIndex];
        const el = document.getElementById('ammo');
        if (el) el.textContent = `AMMO: ${w.ammo}/${w.reserve}`;
    }

    updateBandageUI() {
        const el = document.getElementById('medic-status');
        if (el) el.textContent = `BANDAGES: ${this.bandages} | ${this.bandages > 0 ? 'READY' : 'DEPLETED'}`;
    }

    update(delta, terrain) {
        if (this.isDead) return;
        this.terrain = terrain;

        const groundY = terrain.getHeight(this.body.position.x, this.body.position.z);
        const minY = groundY + 1.5;
        this.canJump = (this.body.position.y <= minY + 0.2);
        if (this.body.position.y < minY) {
            this.body.position.y = minY;
            this.body.velocity.y = Math.max(this.body.velocity.y, 0);
        }

        // Terrain-slope-aware movement
        const pos = this.body.position;
        const eps = 1.0;
        const normal = new THREE.Vector3(
            terrain.getHeight(pos.x - eps, pos.z) - terrain.getHeight(pos.x + eps, pos.z),
            2 * eps,
            terrain.getHeight(pos.x, pos.z - eps) - terrain.getHeight(pos.x, pos.z + eps)
        ).normalize();

        const yawQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.yaw, 0));
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(yawQuat);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(yawQuat);
        const wishDir = new THREE.Vector3();
        if (this.moveState.left) wishDir.sub(right);
        else if (this.moveState.right) wishDir.add(right);
        if (this.moveState.forward) wishDir.add(forward);
        else if (this.moveState.backward) wishDir.sub(forward);

        const isMoving = wishDir.length() > 0;
        const speed = this.walkSpeed * (this.isSprinting ? 1.8 : 1);

        if (isMoving) {
            wishDir.normalize();
            const slope = wishDir.clone().sub(normal.clone().multiplyScalar(wishDir.dot(normal))).normalize();
            this.body.velocity.x = slope.x * speed;
            this.body.velocity.z = slope.z * speed;
            if (this.canJump && !this.moveState.jump) this.body.velocity.y = slope.y * speed;

            this.footstepTimer += delta;
            if (this.footstepTimer >= (this.isSprinting ? 0.28 : 0.48)) {
                this.footstepTimer = 0;
                if (this.audio) this.audio.playFootstep();
            }
        } else {
            this.body.velocity.x *= 0.5;
            this.body.velocity.z *= 0.5;
            this.footstepTimer = 0;
        }

        if (this.moveState.jump && this.canJump) { this.body.velocity.y = 16; this.canJump = false; }

        // Shooting
        const w = this.weapons[this.currentWeaponIndex];
        if (this.moveState.shoot) {
            this.fireTimer += delta;
            if (this.fireTimer >= w.fireRate) { this.shoot(); this.fireTimer = 0; }
        } else {
            this.fireTimer = w.fireRate;
        }

        // Muzzle flash decay
        if (this.muzzleLight.intensity > 0) {
            this.muzzleLight.intensity *= 0.6;
            if (this.muzzleLight.intensity < 0.1) this.muzzleLight.intensity = 0;
        }

        // Health regen after 5s with no damage
        if ((Date.now() - this.lastDamageTime) > 5000 && this.health < this.maxHealth) {
            this.health = Math.min(this.maxHealth, this.health + delta * 3);
            this.updateHealthUI();
        }

        this.camera.rotation.set(this.pitch, this.yaw, 0);
        this.camera.position.set(pos.x, pos.y + 1.8, pos.z);

        // Advance projectile tracers
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.life -= delta;
            p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
            if (p.life <= 0) { this.scene.remove(p.mesh); this.projectiles.splice(i, 1); }
        }
    }

    shoot() {
        const w = this.weapons[this.currentWeaponIndex];
        if (w.ammo <= 0) return;
        w.ammo--;
        this.updateAmmoUI();

        if (this.audio) this.audio.playGunshot();

        const muzzlePos = new THREE.Vector3();
        this.muzzle.getWorldPosition(muzzlePos);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        this.muzzleLight.intensity = 40 + Math.random() * 20;
        if (this.particles) this.particles.createMuzzleFlash(muzzlePos, dir);

        const raycaster = new THREE.Raycaster(this.camera.position, dir, 0, 1000);
        raycaster.layers.set(0);
        const intersects = raycaster.intersectObjects(this.scene.children, true);
        let targetPoint = this.camera.position.clone().add(dir.clone().multiplyScalar(100));

        let didHit = false;
        if (intersects.length > 0) {
            const hit = intersects[0];
            targetPoint = hit.point;
            didHit = true;
            if (hit.face) VFX.createImpactVFX(this.scene, hit.point, hit.face.normal);
            if (this.terrain && hit.object.name === '') this.terrain.paintAt(hit.point, 1.5);
            const body = this._findPhysicsBody(hit.object);
            if (body && body.onHit) body.onHit(w.damage);
        }

        // Tracer
        const tracer = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.04, 2.5),
            new THREE.MeshBasicMaterial({ color: 0xffffaa })
        );
        tracer.layers.set(1);
        tracer.position.copy(muzzlePos);
        tracer.lookAt(targetPoint);
        this.scene.add(tracer);
        const dist = muzzlePos.distanceTo(targetPoint);
        this.projectiles.push({
            mesh: tracer,
            velocity: new THREE.Vector3().subVectors(targetPoint, muzzlePos).normalize().multiplyScalar(400),
            life: dist / 400
        });

        // Hitmarker
        const hm = document.getElementById('hitmarker');
        if (hm && didHit) {
            hm.classList.add('active');
            setTimeout(() => hm.classList.remove('active'), 150);
        }
    }

    _findPhysicsBody(mesh) {
        let obj = mesh;
        while (obj) {
            const body = this.world.bodies.find(b => b.mesh === obj);
            if (body) return body;
            obj = obj.parent;
        }
        return null;
    }

    requestPointerLock() { this.domElement.requestPointerLock(); }
}

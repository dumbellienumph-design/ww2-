import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

export class Player {
    constructor(scene, world, domElement, audio, particles, terrain) {
        this.scene = scene;
        this.world = world;
        this.domElement = domElement;
        this.audio = audio;
        this.particles = particles;
        this.terrain = terrain;

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        
        this.moveState = { forward: false, backward: false, left: false, right: false, jump: false, shoot: false, ads: false };
        this.walkSpeed = 45;
        this.sprintSpeed = 75;
        this.isSprinting = false;
        this.canJump = false;
        this.jumpBuffer = 0;
        this.footstepTimer = 0;

        this.health = 100;
        this.maxHealth = 100;
        this.isDead = false;
        this.lastDamageTime = 0;
        this.healthRegenDelay = 5.0; 
        this.healthRegenRate = 10.0;
        
        this.bandages = 3;
        this.isReloading = false;
        this.reloadTimer = 0;
        this.autoReloadTimer = 0;
        this.suppressionOverlayTimer = 0;
        this.hitmarkerTimer = 0;

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

        // Recoil system
        this.recoilY = 0;
        this.recoilX = 0;
        this.recoilVelY = 0;
        this.recoilVelX = 0;
        this.shakeAmount = 0;

        this.initPhysics();
        this.initControls();
        this.initWeaponVisuals();
        this.updateAmmoUI();
        this.updateHealthUI();
        this.updateBandageUI();
    }

    initPhysics() {
        const material = new CANNON.Material("playerMaterial");
        const PLAYER_GROUP = 1;

        this.body = new CANNON.Body({
            mass: 80,
            shape: new CANNON.Sphere(1.5),
            fixedRotation: true,
            linearDamping: 0.5,
            position: new CANNON.Vec3(0, 100, 0),
            material: material,
            collisionFilterGroup: PLAYER_GROUP,
            collisionFilterMask: -1 // Collide with everything
        });

        this.body.userData = { isPlayer: true, gameEntity: this };
        this.body.addEventListener('collide', (e) => { if (e.contact.ni.y > 0.1) this.canJump = true; });
        this.world.addBody(this.body);

        const groundMat = new CANNON.Material("groundMaterial");
        this.world.bodies.forEach(b => { if (b.mass === 0) b.material = groundMat; });
        const cm = new CANNON.ContactMaterial(material, groundMat, {
            friction: 5.0, 
            restitution: 0.0,
            contactEquationStiffness: 1e8,
            contactEquationRelaxation: 3
        });
        this.world.addContactMaterial(cm);
    }

    initControls() {
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);

        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
        document.addEventListener('mousedown', this.handleMouseDown);
        document.addEventListener('mouseup', this.handleMouseUp);
    }

    destroy() {
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        document.removeEventListener('mousedown', this.handleMouseDown);
        document.removeEventListener('mouseup', this.handleMouseUp);

        if (this._lockTimer) clearTimeout(this._lockTimer);
        if (this.camera) this.scene.remove(this.camera);
        if (this.body) this.world.removeBody(this.body);
    }

    handleMouseMove(e) {
        if (document.pointerLockElement === this.domElement && !window.game.isPaused) {
            const s = 0.002;
            this.yaw -= e.movementX * s;
            this.pitch -= e.movementY * s;
            this.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.pitch));
        }
    }

    handleKeyDown(e) { this.onKey(e.code, true); }
    handleKeyUp(e) { this.onKey(e.code, false); }
    handleMouseDown(e) {
        if (document.pointerLockElement === this.domElement && e.button === 0 && !window.game.isPaused) {
            this.moveState.shoot = true;
        }
    }
    handleMouseUp(e) {
        if (e.button === 0) this.moveState.shoot = false;
    }

    onKey(code, isDown) {
        if (code === 'KeyW') this.moveState.forward = isDown;
        if (code === 'KeyS') this.moveState.backward = isDown;
        if (code === 'KeyA') this.moveState.left = isDown;
        if (code === 'KeyD') this.moveState.right = isDown;
        if (code === 'Space') { 
            this.moveState.jump = isDown;
            if (isDown) this.jumpBuffer = 0.15; // Buffer jump for 150ms
        }
        if (code === 'ShiftLeft') this.isSprinting = isDown;
        if (code === 'KeyR' && isDown) this.reload();
        if (code === 'KeyF' && isDown) this.useBandage();
        
        if (code === 'KeyE' && isDown) this.tryEnterTank();
        if (code === 'KeyQ' && isDown) this.exitTank();
        if (code === 'MouseButtonRight' || code === 'ControlLeft') this.moveState.ads = isDown;
    }

    tryEnterTank() {
        if (this.isDriving) return;
        const mt = window.game.modernTank;
        if (mt && !mt.isOccupied && !mt.isDestroyed) {
            const dist = this.body.position.distanceTo(mt.body.position);
            if (dist < 10) {
                this.enterTank(mt);
                return;
            }
        }
        window.game.spawnedTanks.forEach(t => {
            if (!t.isOccupied && !t.isDestroyed) {
                const dist = this.body.position.distanceTo(t.body.position);
                if (dist < 10) this.enterTank(t);
            }
        });
    }

    enterTank(tank) {
        this.drivingTank = tank;
        tank.isOccupied = true;
        this.isDriving = true;
        this.body.mass = 0;
        this.body.type = CANNON.Body.KINEMATIC;
        this.body.collisionFilterMask = 0; 
        this.gunGroup.visible = false;
        
        const hint = document.getElementById('tactical-notify');
        if (hint) {
            const el = document.createElement('div');
            el.className = 'xp-popup';
            el.textContent = 'VEHICLE ENTERED';
            hint.appendChild(el);
            setTimeout(() => el.remove(), 1500);
        }
    }

    exitTank() {
        if (!this.drivingTank) return;
        const tank = this.drivingTank;
        tank.isOccupied = false;
        this.isDriving = false;
        this.drivingTank = null;
        
        this.body.mass = 80;
        this.body.type = CANNON.Body.DYNAMIC;
        this.body.collisionFilterMask = -1;
        
        const exitOffset = new THREE.Vector3(5, 2, 0).applyQuaternion(tank.group.quaternion);
        this.body.position.set(tank.body.position.x + exitOffset.x, tank.body.position.y + exitOffset.y, tank.body.position.z + exitOffset.z);
        this.body.velocity.set(0, 0, 0);
        
        this.gunGroup.visible = true;
    }

    initWeaponVisuals() {
        this.gunGroup = new THREE.Group();
        this.gunGroup.layers.set(1);

        const steel = new THREE.MeshStandardMaterial({ 
            color: 0x1a1c1a, 
            metalness: 0.95, 
            roughness: 0.25,
            flatShading: false
        });
        const walnut = new THREE.MeshStandardMaterial({ 
            color: 0x2a1b15, 
            roughness: 0.95, 
            metalness: 0.05 
        });

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
        this.lastDamageTime = window.game.elapsedTime;
        this.updateHealthUI();

        const overlay = document.getElementById('suppression-overlay');
        if (overlay) {
            overlay.classList.add('active');
            this.suppressionOverlayTimer = 0.35;
        }

        if (this.health <= 0) this._die();
    }

    _die() {
        this.isDead = true;
        if (window.game) window.game.endGame(false);
    }

    useBandage() {
        if (this.bandages <= 0 || this.health >= this.maxHealth || this.isDead || this.isReloading) return;
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
        if (!el) return;
        el.textContent = this.isReloading ? 'RELOADING...' : `AMMO: ${w.ammo}/${w.reserve}`;
    }

    reload() {
        const w = this.weapons[this.currentWeaponIndex];
        if (this.isReloading || w.ammo >= w.capacity || w.reserve <= 0) return;
        
        this.isReloading = true;
        this.reloadTimer = w.reloadTime;
        this.updateAmmoUI();
    }

    updateBandageUI() {
        const el = document.getElementById('medic-status');
        if (el) el.textContent = `BANDAGES: ${this.bandages} | ${this.bandages > 0 ? 'READY' : 'DEPLETED'}`;
    }

    update(delta) {
        if (this.isDead) return;

        if (this.isDriving && this.drivingTank) {
            this.drivingTank.update(delta, this.moveState, this.camera);
            this.body.position.copy(this.drivingTank.body.position);
            const anchor = this.moveState.ads ? this.drivingTank.sniperCameraAnchor : this.drivingTank.chaseCameraAnchor;
            const targetPos = new THREE.Vector3();
            anchor.getWorldPosition(targetPos);
            const targetQuat = new THREE.Quaternion();
            anchor.getWorldQuaternion(targetQuat);

            this.camera.position.lerp(targetPos, 0.1);
            if (this.moveState.ads) {
                this.camera.quaternion.slerp(targetQuat, 0.1);
            } else {
                this.camera.rotation.set(this.pitch, this.yaw, 0);
            }
            return;
        }

        if (this.jumpBuffer > 0) this.jumpBuffer -= delta;

        if (this.suppressionOverlayTimer > 0) {
            this.suppressionOverlayTimer -= delta;
            if (this.suppressionOverlayTimer <= 0) {
                const overlay = document.getElementById('suppression-overlay');
                if (overlay) overlay.classList.remove('active');
            }
        }
        if (this.hitmarkerTimer > 0) {
            this.hitmarkerTimer -= delta;
            if (this.hitmarkerTimer <= 0) {
                const hm = document.getElementById('hitmarker');
                if (hm) hm.classList.remove('active');
            }
        }
        if (this.autoReloadTimer > 0) {
            this.autoReloadTimer -= delta;
            if (this.autoReloadTimer <= 0) {
                this.reload();
            }
        }
        if (this.isReloading) {
            this.reloadTimer -= delta;
            if (this.reloadTimer <= 0) {
                const w = this.weapons[this.currentWeaponIndex];
                const needed = w.capacity - w.ammo;
                const take = Math.min(needed, w.reserve);
                w.ammo += take;
                w.reserve -= take;
                this.isReloading = false;
                this.updateAmmoUI();
            }
        }

        const groundY = this.terrain ? this.terrain.getHeight(this.body.position.x, this.body.position.z) : 0;
        const minY = groundY + 1.5;
        
        if (this.body.position.y < groundY - 10) {
            this.body.position.y = groundY + 5;
            this.body.velocity.y = 0;
        }

        this.canJump = (this.body.position.y <= minY + 1.25);

        if (this.body.position.y < minY) {
            this.body.position.y = minY;
            this.body.velocity.y = Math.max(this.body.velocity.y, 0);
        }

        const pos = this.body.position;
        const eps = 1.0;
        const normal = new THREE.Vector3(
            this.terrain.getHeight(pos.x - eps, pos.z) - this.terrain.getHeight(pos.x + eps, pos.z),
            2 * eps,
            this.terrain.getHeight(pos.x, pos.z - eps) - this.terrain.getHeight(pos.x, pos.z + eps)
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
        const speed = this.isSprinting ? this.sprintSpeed : this.walkSpeed;

        if (isMoving) {
            wishDir.normalize();
            const slope = wishDir.clone().sub(normal.clone().multiplyScalar(wishDir.dot(normal))).normalize();
            this.body.velocity.x = slope.x * speed;
            this.body.velocity.z = slope.z * speed;

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

        if (this.jumpBuffer > 0 && this.canJump) {
            this.body.velocity.y = 17;
            this.jumpBuffer = 0;
            this.canJump = false;
        }

        const w = this.weapons[this.currentWeaponIndex];
        if (this.moveState.shoot && !this.isReloading) {
            this.fireTimer += delta;
            if (this.fireTimer >= w.fireRate) { this.shoot(); this.fireTimer = 0; }
        } else {
            this.fireTimer = w.fireRate;
        }

        if (this.muzzleLight.intensity > 0) {
            this.muzzleLight.intensity *= (1 - 40 * delta);
            if (this.muzzleLight.intensity < 0.1) this.muzzleLight.intensity = 0;
        }

        if ((window.game.elapsedTime - this.lastDamageTime) > this.healthRegenDelay && this.health < this.maxHealth) {
            this.health = Math.min(this.maxHealth, this.health + this.healthRegenRate * delta);
            this.updateHealthUI();
        }

        this.recoilVelY -= this.recoilY * 40 * delta;
        this.recoilVelX -= this.recoilX * 40 * delta;
        this.recoilVelY *= (1 - 10 * delta);
        this.recoilVelX *= (1 - 10 * delta);
        this.recoilY += this.recoilVelY * delta;
        this.recoilX += this.recoilVelX * delta;
        
        this.shakeAmount *= (1 - 10 * delta);
        const shakeX = (Math.random() - 0.5) * this.shakeAmount;
        const shakeY = (Math.random() - 0.5) * this.shakeAmount;

        this.camera.rotation.set(this.pitch + this.recoilY + shakeY, this.yaw + this.recoilX + shakeX, 0);
        this.camera.position.set(pos.x, pos.y + 1.8, pos.z);
    }

    shoot() {
        const w = this.weapons[this.currentWeaponIndex];
        if (w.ammo <= 0 || this.isReloading) return;
        w.ammo--;
        this.updateAmmoUI();
        
        this.recoilVelY += 0.15 + Math.random() * 0.1;
        this.recoilVelX += (Math.random() - 0.5) * 0.1;
        this.shakeAmount = 0.05;

        if (w.ammo === 0) { this.autoReloadTimer = 0.1; return; }

        if (this.audio) this.audio.playGunshot();

        const muzzlePos = new THREE.Vector3();
        this.muzzle.getWorldPosition(muzzlePos);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);

        this.muzzleLight.intensity = 40 + Math.random() * 20;
        if (this.particles) this.particles.createMuzzleFlash(muzzlePos, dir);

        const tracerSpeed = 800;
        window.game.projectiles.spawnProjectile(muzzlePos, dir, tracerSpeed, w.damage, this, true);

        const raycaster = new THREE.Raycaster(this.camera.position, dir, 0.1, 2000);
        raycaster.layers.enableAll();

        const intersects = raycaster.intersectObjects(this.scene.children, true);
        if (intersects.length > 0) {
            const hit = intersects.find(h => !h.object.layers.test(this.camera.layers));
            if (hit) {
                if (hit.face) VFX.createImpactVFX(this.scene, hit.point, hit.face.normal);

                const hitObject = this._findPhysicsBody(hit.object);
                if (hitObject && hitObject.onHit) {
                    hitObject.onHit(w.damage);
                } else if (this.terrain && hit.object === this.terrain.mesh) {
                    this.terrain.paintAt(hit.point, 1.5);
                }

                const hm = document.getElementById('hitmarker');   
                if (hm) {
                    hm.classList.add('active');
                    this.hitmarkerTimer = 0.15;
                }
            }
        }
    }

    _findPhysicsBody(mesh) {
        let obj = mesh;
        while (obj) {
            if (obj.userData.gameEntity) return obj.userData.gameEntity;
            if (obj.userData.physicsBody) return obj.userData.physicsBody;
            const body = this.world.bodies.find(b => b.mesh === obj);
            if (body) {
                if (body.userData && body.userData.gameEntity) return body.userData.gameEntity;
                return body;
            }
            obj = obj.parent;
        }
        return null;
    }

    requestPointerLock() {
        const elapsed = (window.game ? window.game.elapsedTime * 1000 : 0) - (window.game?._lockLostTime ?? 0);
        const delay = Math.max(0, 1000 - elapsed);
        clearTimeout(this._lockTimer);
        this._lockTimer = setTimeout(() => {
            try { this.domElement.requestPointerLock(); } catch (_) {}
        }, delay);
    }
}

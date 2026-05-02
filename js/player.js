import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

export class Player {
    constructor(scene, world, domElement, audio, particles) {
        this.scene = scene;
        this.world = world;
        this.domElement = domElement;
        this.particles = particles;
        
        this.baseFOV = 75;
        this.camera = new THREE.PerspectiveCamera(this.baseFOV, window.innerWidth / window.innerHeight, 0.1, 5000);
        this.camera.rotation.order = 'YXZ';
        this.camera.layers.enable(1);
        
        this.walkSpeed = 20;
        this.health = 100;
        this.canJump = false;

        this.moveState = {
            forward: false, backward: false, left: false, right: false,
            jump: false, shoot: false, ads: false
        };

        this.weapons = [{ 
            name: 'Thompson M1A1', fireRate: 0.1, damage: 30, 
            capacity: 30, ammo: 30, reserve: 120, 
            reloadTime: 2.0, adsFOV: 65, length: 0.8, color: 0x221100 
        }];
        this.currentWeaponIndex = 0;
        this.projectiles = []; 
        this.fireTimer = 0;
        this.pitch = 0;
        this.yaw = 0;
        this.shakeOffset = new THREE.Vector3();

        this.initPhysics();
        this.initControls();
        this.initWeaponVisuals();
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
        this.world.bodies.forEach(b => { if(b.mass === 0) b.material = groundMat; });
        const cm = new CANNON.ContactMaterial(material, groundMat, { friction: 2.0, restitution: 0.0, contactEquationStiffness: 1e8, contactEquationRelaxation: 3 });
        this.world.addContactMaterial(cm);
    }

    initControls() {
        document.addEventListener('mousemove', (e) => { if (document.pointerLockElement === this.domElement) { const s = 0.002; this.yaw -= e.movementX * s; this.pitch -= e.movementY * s; this.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.pitch)); } });
        document.addEventListener('keydown', (e) => this.onKey(e.code, true));
        document.addEventListener('keyup', (e) => this.onKey(e.code, false));
        document.addEventListener('mousedown', (e) => { if (document.pointerLockElement === this.domElement && e.button === 0) this.moveState.shoot = true; });
        document.addEventListener('mouseup', (e) => { if (document.pointerLockElement === this.domElement && e.button === 0) this.moveState.shoot = false; });
    }

    onKey(code, isPressed) {
        switch (code) {
            case 'KeyW': this.moveState.forward = isPressed; break;
            case 'KeyS': this.moveState.backward = isPressed; break;
            case 'KeyA': this.moveState.left = isPressed; break;
            case 'KeyD': this.moveState.right = isPressed; break;
            case 'Space': this.moveState.jump = isPressed; break;
        }
    }

    initWeaponVisuals() {
        this.gunGroup = new THREE.Group();
        this.gunGroup.layers.set(1);
        
        // --- MATERIALS ---
        const steel = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.3 });
        const walnut = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.8 });

        const createPart = (geo, mat, x=0, y=0, z=0, rotX=0, rotY=0, rotZ=0) => {
            const m = new THREE.Mesh(geo, mat);
            m.position.set(x, y, z);
            m.rotation.set(rotX, rotY, rotZ);
            m.layers.set(1);
            this.gunGroup.add(m);
            return m;
        };

        // 1. Receiver (Steel)
        createPart(new THREE.BoxGeometry(0.08, 0.12, 0.45), steel, 0, 0, 0);
        // Bolt Slot (Steel)
        createPart(new THREE.BoxGeometry(0.02, 0.04, 0.2), steel, 0.035, 0.02, 0.05);

        // 2. Barrel Assembly (Steel)
        createPart(new THREE.CylinderGeometry(0.02, 0.025, 0.35), steel, 0, 0, -0.4, Math.PI/2, 0, 0);
        // Front Sight
        createPart(new THREE.BoxGeometry(0.005, 0.03, 0.02), steel, 0, 0.035, -0.55);

        // 3. Furniture (Walnut)
        // Buttstock (Iconic curve)
        const stock = createPart(new THREE.BoxGeometry(0.07, 0.15, 0.3), walnut, 0, -0.05, 0.35);
        stock.rotation.x = -0.15;
        // Pistol Grip
        const grip = createPart(new THREE.BoxGeometry(0.06, 0.18, 0.08), walnut, 0, -0.15, 0.1);
        grip.rotation.x = -0.3;
        // Foregrip (Horizontal handguard)
        createPart(new THREE.BoxGeometry(0.07, 0.05, 0.25), walnut, 0, -0.06, -0.2);

        // 4. Details
        // Stick Magazine
        createPart(new THREE.BoxGeometry(0.05, 0.3, 0.12), steel, 0, -0.2, -0.05);
        // Trigger Guard
        createPart(new THREE.TorusGeometry(0.04, 0.005, 8, 16, Math.PI), steel, 0, -0.08, 0.05, 0, Math.PI/2, 0);
        // Rear Sight Protective Ears
        createPart(new THREE.BoxGeometry(0.06, 0.03, 0.04), steel, 0, 0.07, 0.15);

        this.muzzle = new THREE.Object3D(); 
        this.muzzle.position.z = -0.6;
        this.gunGroup.add(this.muzzle);

        this.muzzleLight = new THREE.PointLight(0xffaa44, 0, 15);
        this.muzzleLight.layers.set(1);
        this.muzzle.add(this.muzzleLight);
        
        // Final position in camera view
        this.gunGroup.position.set(0.4, -0.4, -0.6);
        this.camera.add(this.gunGroup);
        this.scene.add(this.camera);
    }

    update(delta, terrain) {
        this.terrain = terrain; 
        const groundY = terrain.getHeight(this.body.position.x, this.body.position.z);
        const minPlayerY = groundY + 1.5; 
        this.canJump = (this.body.position.y <= minPlayerY + 0.2);
        if (this.body.position.y < minPlayerY) { this.body.position.y = minPlayerY; this.body.velocity.y = Math.max(this.body.velocity.y, 0); }

        const pos = this.body.position;
        const eps = 1.0;
        const hL = terrain.getHeight(pos.x - eps, pos.z);
        const hR = terrain.getHeight(pos.x + eps, pos.z);
        const hF = terrain.getHeight(pos.x, pos.z - eps);
        const hB = terrain.getHeight(pos.x, pos.z + eps);
        const normal = new THREE.Vector3(hL - hR, 2 * eps, hF - hB).normalize();
        
        const yawQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.yaw, 0));
        const forward = new THREE.Vector3(0,0,-1).applyQuaternion(yawQuat);
        const right = new THREE.Vector3(1,0,0).applyQuaternion(yawQuat);
        const wishDir = new THREE.Vector3(0,0,0);
        if(this.moveState.left) wishDir.sub(right); else if(this.moveState.right) wishDir.add(right);
        if(this.moveState.forward) wishDir.add(forward); else if(this.moveState.backward) wishDir.sub(forward);

        if (wishDir.length() > 0) {
            wishDir.normalize();
            const dot = wishDir.dot(normal);
            const moveVector = new THREE.Vector3().subVectors(wishDir, normal.clone().multiplyScalar(dot)).normalize();
            const speed = this.walkSpeed;
            this.body.velocity.x = moveVector.x * speed; this.body.velocity.z = moveVector.z * speed;
            if (this.canJump && !this.moveState.jump) this.body.velocity.y = moveVector.y * speed;
        } else { this.body.velocity.x *= 0.5; this.body.velocity.z *= 0.5; }

        if (this.moveState.jump && this.canJump) { this.body.velocity.y = 16; this.canJump = false; }
        if(this.moveState.shoot) { this.fireTimer += delta; if(this.fireTimer >= this.weapons[this.currentWeaponIndex].fireRate) { this.shoot(); this.fireTimer = 0; } } else { this.fireTimer = this.weapons[this.currentWeaponIndex].fireRate; }
        if (this.muzzleLight.intensity > 0) { this.muzzleLight.intensity *= 0.6; if (this.muzzleLight.intensity < 0.1) this.muzzleLight.intensity = 0; }
        
        this.camera.rotation.set(this.pitch, this.yaw, 0);
        this.camera.position.set(this.body.position.x, this.body.position.y + 1.8, this.body.position.z);

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i]; p.life -= delta;
            p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
            if (p.life <= 0) { this.scene.remove(p.mesh); this.projectiles.splice(i, 1); }
        }
    }

    shoot() {
        const w = this.weapons[this.currentWeaponIndex];
        const muzzlePos = new THREE.Vector3(); 
        this.muzzle.getWorldPosition(muzzlePos);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        this.muzzleLight.intensity = 40 + Math.random() * 20;
        if (this.particles) this.particles.createMuzzleFlash(muzzlePos, dir);
        const raycaster = new THREE.Raycaster(this.camera.position, dir, 0, 1000);
        raycaster.layers.set(0);
        const intersects = raycaster.intersectObjects(this.scene.children, true);
        let targetPoint = this.camera.position.clone().add(dir.clone().multiplyScalar(100));
        if (intersects.length > 0) {
            const hit = intersects[0];
            targetPoint = hit.point;
            VFX.createImpactVFX(this.scene, hit.point, hit.face.normal);
            if (this.terrain && (hit.object.name === 'terrain' || hit.object.name === '')) this.terrain.paintAt(hit.point, 1.5);
            const body = this.findPhysicsBody(hit.object);
            if (body && body.onHit) body.onHit(w.damage);
        }
        const tracer = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 3), new THREE.MeshBasicMaterial({color: 0xffffff}));
        tracer.layers.set(1);
        tracer.position.copy(muzzlePos); tracer.lookAt(targetPoint);
        this.scene.add(tracer);
        const dist = muzzlePos.distanceTo(targetPoint);
        this.projectiles.push({ mesh: tracer, velocity: new THREE.Vector3().subVectors(targetPoint, muzzlePos).normalize().multiplyScalar(400), life: dist / 400 });
    }

    findPhysicsBody(mesh) { let obj = mesh; while(obj) { const body = this.world.bodies.find(b => b.mesh === obj); if(body) return body; obj = obj.parent; } return null; }
    requestPointerLock() { this.domElement.requestPointerLock(); }
}
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

export class Base {
    constructor(scene, world, position, audio, particles, terrain, isEnemy = false) {
        this.scene = scene;
        this.world = world;
        this.position = position;
        this.particles = particles;
        this.terrain = terrain;
        this.isEnemy = isEnemy;
        
        // Update position Y based on terrain
        this.position.y = this.terrain.getHeight(position.x, position.z);

        this.group = new THREE.Group();
        this.group.position.set(position.x, this.position.y, position.z);
        this.scene.add(this.group);

        this.initMaterials();
        // Remove createGround() - terrain is the ground
        
        // --- PHASE 5: ARCHITECTURAL RESTORATION ---
        this.createHighDetailBuildings();
        this.createFortifications();
        
        if (isEnemy) {
            this.createCommandCenter();
        } else {
            this.createSpawnPad();
        }

        this.createBattlefieldCover();
    }

    initMaterials() {
        // High-fidelity materials with better roughness/metalness
        this.mudMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1.0 });
        this.concreteMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.8 });
        this.armyGrayMat = new THREE.MeshStandardMaterial({ color: 0x5a5e5a, roughness: 0.7 });
        this.armyGreenMat = new THREE.MeshStandardMaterial({ color: 0x2e3b23, roughness: 0.9 });
        this.windowMat = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.9, roughness: 0.1 });
        this.trimMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
        this.sandbagMat = new THREE.MeshStandardMaterial({ color: 0x8b7355 });
    }

    createGround() {
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(250, 250), this.mudMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.group.add(ground);
    }

    createHighDetailBuildings() {
        if (!this.isEnemy) {
            // Allied Base Setup
            this.createProBuilding(30, 0, -40, 18, 10, 24, this.armyGrayMat); // Barracks
            this.createProBuilding(-50, 0, 10, 14, 7, 18, this.armyGreenMat); // Supply
            this.createWatchtower(-20, 0, -60);
        } else {
            // Enemy Base Setup
            this.createProBuilding(-30, 0, 40, 20, 9, 20, this.armyGrayMat); // Outpost
        }
    }

    createProBuilding(x, y, z, w, h, l, mat) {
        const bGroup = new THREE.Group();
        bGroup.position.set(x, y, z);
        this.group.add(bGroup);

        // Main Shell
        const main = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
        main.position.y = h/2;
        main.castShadow = true; main.receiveShadow = true;
        bGroup.add(main);

        // Roof with Overhang
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1.5, 0.8, l + 1.5), this.trimMat);
        roof.position.y = h + 0.4;
        roof.castShadow = true;
        bGroup.add(roof);

        // Corner Trim (The "Professional" touch)
        const trimW = 0.4;
        const corners = [
            { x: w/2, z: l/2 }, { x: -w/2, z: l/2 },
            { x: w/2, z: -l/2 }, { x: -w/2, z: -l/2 }
        ];
        corners.forEach(c => {
            const trim = new THREE.Mesh(new THREE.BoxGeometry(trimW, h + 0.2, trimW), this.trimMat);
            trim.position.set(c.x, h/2, c.z);
            bGroup.add(trim);
        });

        // Windows
        const winCount = 3;
        for(let i=0; i<winCount; i++) {
            const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 1.5), this.windowMat);
            const winPos = (i - (winCount-1)/2) * (l/winCount * 1.5);
            win.position.set(w/2 + 0.05, h * 0.6, winPos);
            bGroup.add(win);
            
            // Window Frame
            const frame = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.2, 1.7), this.trimMat);
            frame.position.copy(win.position);
            bGroup.add(frame);
        }

        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(w/2, h/2, l/2)) });
        body.position.set(this.position.x + x, this.position.y + h/2, this.position.z + z);
        body.mesh = main;
        this.world.addBody(body);
    }

    createWatchtower(x, y, z) {
        const tw = new THREE.Group();
        tw.position.set(x, y, z);
        this.group.add(tw);

        const legs = [
            {x: 2, z: 2}, {x: -2, z: 2}, {x: 2, z: -2}, {x: -2, z: -2}
        ];
        legs.forEach(l => {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 12, 0.4), this.trimMat);
            leg.position.set(l.x, 6, l.z);
            tw.add(leg);
        });

        const platform = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 6), this.concreteMat);
        platform.position.y = 12;
        tw.add(platform);

        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(3, 6, 3)) });
        body.position.set(this.position.x + x, this.position.y + 6, this.position.z + z);
        this.world.addBody(body);
    }

    createCommandCenter() {
        const w=30, h=18, l=30;
        const bGroup = new THREE.Group();
        bGroup.position.set(0, 0, 0);
        this.group.add(bGroup);

        const main = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), this.armyGrayMat);
        main.position.y = h/2;
        main.castShadow = true; main.receiveShadow = true;
        bGroup.add(main);

        // Top Bunker Section
        const bunker = new THREE.Mesh(new THREE.BoxGeometry(w-6, 5, l-6), this.concreteMat);
        bunker.position.y = h + 2.5;
        bunker.castShadow = true;
        bGroup.add(bunker);

        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(w/2, h/2 + 2.5, l/2)) });
        body.position.set(this.position.x, this.position.y + h/2, this.position.z);
        body.mesh = main;
        body.health = 3000;
        body.onHit = (damage) => {
            body.health -= damage;
            if (body.health <= 0 && !this.isDestroyed) {
                this.isDestroyed = true;
                VFX.createExplosion(this.scene, this.world, body.position, 60, 0, null);
                this.group.remove(bGroup);
                this.world.removeBody(body);
                if(window.game) window.game.endGame(true);
            }
        };
        this.world.addBody(body);
        this.hqBody = body;
    }

    createBattlefieldCover() {
        if (this.isEnemy) return;
        for (let i = 0; i < 20; i++) {
            const x = 60 + Math.random() * 180;
            const z = (Math.random() - 0.5) * 250;
            if (Math.random() > 0.5) this.createDragonsTooth(x, 0, z);
            else this.createSandbagWall(x, 0, z, Math.random() * Math.PI);
        }
    }

    createDragonsTooth(x, y, z) {
        const mesh = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.5, 4), this.concreteMat);
        mesh.position.set(x, 1.25, z);
        mesh.rotation.y = Math.PI / 4;
        mesh.castShadow = true; mesh.receiveShadow = true;
        this.group.add(mesh);
        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(0.8, 1.25, 0.8)) });
        body.position.set(this.position.x + x, this.position.y + 1.25, this.position.z + z);
        this.world.addBody(body);
    }

    createSandbagWall(x, y, z, rot) {
        const wall = new THREE.Group();
        wall.position.set(x, 0.4, z);
        wall.rotation.y = rot;
        for(let i=0; i<3; i++) {
            for(let j=0; j<2; j++) {
                const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.6, 4, 8), this.sandbagMat);
                bag.rotation.z = Math.PI / 2;
                bag.position.set((i-1)*0.7, j*0.5, 0);
                bag.castShadow = true;
                wall.add(bag);
            }
        }
        this.group.add(wall);
        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(1.2, 0.6, 0.4)) });
        body.position.set(this.position.x + x, this.position.y + 0.6, this.position.z + z);
        body.quaternion.setFromEuler(0, rot, 0);
        this.world.addBody(body);
    }

    createFortifications() {
        for(let i=0; i<5; i++) {
            this.createWallSeg(80, 0, -40 + i*20);
        }
    }

    createWallSeg(x, y, z) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 18), this.concreteMat);
        mesh.position.set(x, 3, z);
        mesh.castShadow = true; mesh.receiveShadow = true;
        this.group.add(mesh);
        const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(1, 3, 9)) });
        body.position.set(this.position.x + x, this.position.y + 3, this.position.z + z);
        this.world.addBody(body);
    }

    createSpawnPad() {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(30, 0.2, 30), this.concreteMat);
        pad.position.set(0, 0.1, 55); 
        pad.receiveShadow = true;
        this.group.add(pad);
    }

    update(delta, time) {}
}
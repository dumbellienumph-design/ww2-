import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

export class Grenade {
    constructor(scene, world, position, velocity, audio) {
        this.scene = scene;
        this.world = world;
        this.audio = audio;
        
        this.isExploded = false;
        this.fuseTime = 3.0;
        this.timer = 0;

        this.initPhysics(position, velocity);
        this.initVisuals();
    }

    initPhysics(position, velocity) {
        const shape = new CANNON.Sphere(0.2);
        this.body = new CANNON.Body({
            mass: 2,
            shape: shape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            velocity: new CANNON.Vec3(velocity.x, velocity.y, velocity.z),
            linearDamping: 0.1,
            angularDamping: 0.1
        });
        this.world.addBody(this.body);
    }

    initVisuals() {
        this.mesh = new THREE.Group();
        
        const oliveDrab = new THREE.MeshStandardMaterial({ color: 0x3b3d2e });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8 });

        // Segmented Pineapple Body
        const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), oliveDrab);
        body.scale.y = 1.3;
        this.mesh.add(body);

        // Add 3D "bumps" for segmentation
        const bumpGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
        for(let i=0; i<12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const bump = new THREE.Mesh(bumpGeo, oliveDrab);
            bump.position.set(Math.cos(angle) * 0.18, (Math.random()-0.5)*0.2, Math.sin(angle) * 0.18);
            this.mesh.add(bump);
        }

        // Top Fuse / Lever
        const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.15), metalMat);
        fuse.position.y = 0.25;
        this.mesh.add(fuse);

        const lever = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.05), metalMat);
        lever.position.set(0.08, 0.15, 0);
        lever.rotation.z = -0.2;
        this.mesh.add(lever);

        // Pull Ring
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.01, 8, 16), metalMat);
        ring.position.set(-0.1, 0.3, 0);
        this.mesh.add(ring);

        this.scene.add(this.mesh);
    }

    update(delta) {
        if (this.isExploded) return;

        this.timer += delta;
        this.mesh.position.copy(this.body.position);
        this.mesh.quaternion.copy(this.body.quaternion);

        if (this.timer >= this.fuseTime) {
            this.explode();
        }
    }

    explode() {
        this.isExploded = true;
        VFX.createExplosion(this.scene, this.world, this.mesh.position, 8, 100, this.audio);
        this.scene.remove(this.mesh);
        this.world.removeBody(this.body);
    }
}
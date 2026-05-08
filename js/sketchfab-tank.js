
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import * as JSZip from 'jszip';
import { Tank } from './tank.js';
class SketchfabTank extends Tank {
    constructor(scene, world, terrain, position, audio, particles, modelPath) {
        super(scene, world, terrain, position, audio, particles, modelPath);
        this.fileMap = new Map();
    }

    initVisuals() {
        if (this.modelPath) {
            this.loadLocalModel();
        } else {
            this._fallbackVisuals();
        }
    }

    async loadLocalModel() {
        const loader = new GLTFLoader();
        loader.load(this.modelPath, (gltf) => {
            this.model = gltf.scene;
            this.model.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.layers.enable(1);
                }
            });

            this.model.scale.set(0.02, 0.02, 0.02);
            this.model.position.y = -0.5;
            this.group.add(this.model);

            this.model.traverse(child => {
                if (child.name.toLowerCase().includes('turret')) this.turretGroup = child;
                if (child.name.toLowerCase().includes('barrel') || child.name.toLowerCase().includes('gun')) this.barrelGroup = child;
            });

            if (!this.turretGroup) this.turretGroup = this.model;
            if (!this.barrelGroup) this.barrelGroup = this.turretGroup;

            this.chaseCameraAnchor = new THREE.Object3D();
            this.chaseCameraAnchor.position.set(0, 6, 12);
            this.group.add(this.chaseCameraAnchor);

            this.sniperCameraAnchor = new THREE.Object3D();
            this.sniperCameraAnchor.position.set(0, 0.5, -1.0);
            this.turretGroup.add(this.sniperCameraAnchor);
        });
    }

    _fallbackVisuals() {
        // Temporary fallback visuals
        const geo = new THREE.BoxGeometry(4, 2, 6);
        const mat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 0.5;
        this.group.add(mesh);

        this.turretGroup = new THREE.Group();
        this.turretGroup.position.y = 1.0;
        this.group.add(this.turretGroup);

        this.barrelGroup = new THREE.Group();
        this.turretGroup.add(this.barrelGroup);

        this.chaseCameraAnchor = new THREE.Object3D();
        this.chaseCameraAnchor.position.set(0, 6, 12);
        this.group.add(this.chaseCameraAnchor);

        this.sniperCameraAnchor = new THREE.Object3D();
        this.sniperCameraAnchor.position.set(0, 0.5, -1.0);
        this.turretGroup.add(this.sniperCameraAnchor);
    }
    revokeObjectUrls() {
        for (const url of this.fileMap.values()) URL.revokeObjectURL(url);
        this.fileMap.clear();
    }

    destroy() {
        super.destroy();
        this.revokeObjectUrls();
    }
}

export { SketchfabTank };


import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as JSZip from 'jszip';
import { Tank } from './tank.js';

class SketchfabTank extends Tank {
    constructor(scene, world, terrain, position, audio, particles) {
        super(scene, world, terrain, position, audio, particles);
        this.fileMap = new Map();
        this.loadModel(position);
    }

    initVisuals() {
        // We load the visuals asynchronously in loadModel
    }

    async loadModel(position) {
        // NOTE: Remote Sketchfab loading is disabled due to security (hardcoded tokens) 
        // and reliability (403 errors).
        // TODO: Download model locally to /models/ folder and load via GLTFLoader directly.
        
        console.warn('SketchfabTank: Remote loading disabled. Use local assets for production.');
        
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


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
        const modelId = '4da28587d5c545859776499cc54b6670';
        const sketchfabApiUrl = `https://api.sketchfab.com/v3/models/${modelId}/download`;
        const token = '95c2bd7500c04ef89c668b73c56237fd';

        try {
            const response = await fetch(sketchfabApiUrl, {
                headers: { 'Authorization': `Token ${token}` }
            });
            if (!response.ok) throw new Error(`Sketchfab API request failed: ${response.statusText}`);

            const data = await response.json();
            const downloadUrl = data.gltf.url;

            const zipResponse = await fetch(downloadUrl);
            const zipBuffer = await zipResponse.arrayBuffer();
            const zip = await JSZip.loadAsync(zipBuffer);
            
            let gltfFileName = null;
            for (const fileName in zip.files) {
                const blob = await zip.files[fileName].async('blob');
                const blobUrl = URL.createObjectURL(blob);
                this.fileMap.set(fileName, blobUrl);
                if (fileName.endsWith('.gltf')) gltfFileName = fileName;
            }

            const loadingManager = new THREE.LoadingManager();
            loadingManager.setURLModifier((url) => {
                const parts = url.split('/');
                const fileName = parts.pop();
                const found = Array.from(this.fileMap.keys()).find(key => key.endsWith(fileName));
                return found ? this.fileMap.get(found) : url;
            });

            const loader = new GLTFLoader(loadingManager);
            loader.load(this.fileMap.get(gltfFileName), (gltf) => {
                this.model = gltf.scene;
                this.model.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.layers.enable(1); // minimap
                    }
                });

                const box = new THREE.Box3().setFromObject(this.model);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());

                // Scale to fit game dimensions (~5m wide)
                const scale = 5 / size.x;
                this.model.scale.setScalar(scale);
                
                // Offset by -0.5 to align with physics body center + shape offset
                this.model.position.y = -(center.y - box.min.y) * scale - 0.5;
                
                this.group.add(this.model);

                // Setup Turret/Barrel from Model Parts (Heuristic search)
                this.model.traverse(child => {
                    if (child.name.toLowerCase().includes('turret')) this.turretGroup = child;
                    if (child.name.toLowerCase().includes('barrel') || child.name.toLowerCase().includes('gun')) this.barrelGroup = child;
                });

                // Fallbacks if not found by name
                if (!this.turretGroup) this.turretGroup = this.model;
                if (!this.barrelGroup) this.barrelGroup = this.turretGroup;

                // Setup Anchors
                this.chaseCameraAnchor = new THREE.Object3D();
                this.chaseCameraAnchor.position.set(0, 5, 10);
                this.group.add(this.chaseCameraAnchor);

                this.sniperCameraAnchor = new THREE.Object3D();
                this.sniperCameraAnchor.position.set(0, 1.2, -1.0);
                this.turretGroup.add(this.sniperCameraAnchor);

                this.revokeObjectUrls();
                
                // Add a simple minimap icon (Yellow square)
                const iconGeo = new THREE.PlaneGeometry(10, 10);
                const iconMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
                const icon = new THREE.Mesh(iconGeo, iconMat);
                icon.rotation.x = -Math.PI / 2;
                icon.position.y = 50;
                icon.layers.set(1);
                this.group.add(icon);

            });
        } catch (error) {
            console.error('Failed to load Sketchfab model:', error);
            this.revokeObjectUrls();
        }
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

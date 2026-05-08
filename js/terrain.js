import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Terrain {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.size = 1000;
        this.resolution = 256; 
        this.elementSize = this.size / this.resolution;
        this.isLoaded = false;

        // Fallback flat matrix until image loads
        this.matrix = [];
        for (let i = 0; i <= this.resolution; i++) {
            this.matrix[i] = [];
            for (let j = 0; j <= this.resolution; j++) {
                this.matrix[i][j] = 0;
            }
        }

        const geometry = new THREE.PlaneGeometry(this.size, this.size, this.resolution, this.resolution);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x3d4d3d, 
            roughness: 1.0,
            metalness: 0.0
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.receiveShadow = true;
        this.mesh.layers.enable(1); 
        this.scene.add(this.mesh);

        const hfShape = new CANNON.Heightfield(this.matrix, { elementSize: this.elementSize });
        this.body = new CANNON.Body({ mass: 0 });
        this.body.addShape(hfShape);
        this.world.addBody(this.body);
        this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.body.position.set(-this.size / 2, 0, this.size / 2);

        this.loadAssets();
        this.addBoundaries();
    }

    async loadAssets() {
        const loader = new THREE.TextureLoader();
        
        try {
            // Load Textures
            const [rockTex, grassTex] = await Promise.all([
                loader.loadAsync('models/terrain/rock.jpg'),
                loader.loadAsync('models/terrain/grass.jpg')
            ]);
            
            rockTex.wrapS = rockTex.wrapT = THREE.RepeatWrapping;
            rockTex.repeat.set(20, 20);
            grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
            grassTex.repeat.set(20, 20);

            // Update Material to be more professional (Simple splatting logic via vertex colors or just better blending)
            this.mesh.material.map = rockTex;
            this.mesh.material.needsUpdate = true;

            // Load Heightmap
            const img = new Image();
            img.src = 'models/terrain/heightmap.png';
            await new Promise((resolve) => img.onload = resolve);

            const canvas = document.createElement('canvas');
            canvas.width = this.resolution + 1;
            canvas.height = this.resolution + 1;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

            const vertices = this.mesh.geometry.attributes.position.array;
            const displacementScale = 180; // High for mountains

            for (let i = 0; i <= this.resolution; i++) {
                for (let j = 0; j <= this.resolution; j++) {
                    const imgIdx = (j * canvas.width + i) * 4;
                    const height = (data[imgIdx] / 255) * displacementScale;
                    
                    this.matrix[i][this.resolution - j] = height; // Sync with Cannon orientation

                    const vIdx = (j * (this.resolution + 1) + i) * 3;
                    vertices[vIdx + 2] = height;
                }
            }

            this.mesh.geometry.attributes.position.needsUpdate = true;
            this.mesh.geometry.computeVertexNormals();

            // Update Physics Body
            this.world.removeBody(this.body);
            const hfShape = new CANNON.Heightfield(this.matrix, { elementSize: this.elementSize });
            this.body = new CANNON.Body({ mass: 0 });
            this.body.addShape(hfShape);
            this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
            this.body.position.set(-this.size / 2, 0, this.size / 2);
            this.world.addBody(this.body);

            this.isLoaded = true;
            console.log("[Terrain] High-quality mountainous region installed.");

        } catch (e) {
            console.error("[Terrain] Asset load failed:", e);
        }
    }

    getHeight(x, z) {
        if (!this.isLoaded) return 0;
        const halfSize = this.size / 2;
        if (x < -halfSize || x > halfSize || z < -halfSize || z > halfSize) return 0;

        const gx = (x + halfSize) / this.elementSize;
        const gz = (halfSize - z) / this.elementSize;
        
        const ix = Math.floor(gx);
        const iz = Math.floor(gz);
        
        if (ix >= 0 && ix < this.resolution && iz >= 0 && iz < this.resolution) {
            const fx = gx - ix;
            const fz = gz - iz;
            const h00 = this.matrix[ix][this.resolution - iz];
            const h10 = this.matrix[ix+1][this.resolution - iz];
            const h01 = this.matrix[ix][this.resolution - (iz+1)];
            const h11 = this.matrix[ix+1][this.resolution - (iz+1)];
            
            // Bilinear interpolation
            const h0 = h00 * (1 - fx) + h10 * fx;
            const h1 = h01 * (1 - fx) + h11 * fx;
            return h0 * (1 - fz) + h1 * fz;
        }
        return 0;
    }

    addBoundaries() {
        const half = this.size / 2;
        const thickness = 10;
        const height = 500;
        const wallShape = new CANNON.Box(new CANNON.Vec3(half, height, thickness));
        
        const north = new CANNON.Body({ mass: 0 });
        north.addShape(wallShape);
        north.position.set(0, height, -half - thickness);
        this.world.addBody(north);

        const south = new CANNON.Body({ mass: 0 });
        south.addShape(wallShape);
        south.position.set(0, height, half + thickness);
        this.world.addBody(south);

        const sideShape = new CANNON.Box(new CANNON.Vec3(thickness, height, half));
        const west = new CANNON.Body({ mass: 0 });
        west.addShape(sideShape);
        west.position.set(-half - thickness, height, 0);
        this.world.addBody(west);

        const east = new CANNON.Body({ mass: 0 });
        east.addShape(sideShape);
        east.position.set(half + thickness, height, 0);
        this.world.addBody(east);
    }

    deformAt(point, radius, depth) {
        if (!this.isLoaded) return;
        const res = this.resolution;
        const size = this.size;
        const posAttr = this.mesh.geometry.attributes.position;    
        const gx = Math.round((point.x + size/2) / this.elementSize);
        const gz = Math.round((size/2 - point.z) / this.elementSize);
        const gridRadius = Math.ceil(radius / this.elementSize) + 1;
        let changed = false;
        for (let i = gx - gridRadius; i <= gx + gridRadius; i++) { 
            for (let j = gz - gridRadius; j <= gz + gridRadius; j++) {
                if (i >= 0 && i <= res && j >= 0 && j <= res) {    
                    const dx = (i - gx) * this.elementSize;        
                    const dz = (j - gz) * this.elementSize;        
                    if (dx*dx + dz*dz < radius * radius) {
                        changed = true;
                        const strength = 1 - Math.sqrt(dx*dx + dz*dz) / radius;
                        const deform = depth * strength;
                        this.matrix[i][this.resolution - j] -= deform;
                        const vIdx = j * (res + 1) + i;
                        posAttr.setZ(vIdx, posAttr.getZ(vIdx) - deform);
                    }
                }
            }
        }
        if (changed) {
            posAttr.needsUpdate = true;
            this.mesh.geometry.computeVertexNormals();
            // Re-sync physics is heavy, but necessary for deformation
            this.world.removeBody(this.body);
            const hfShape = new CANNON.Heightfield(this.matrix, { elementSize: this.elementSize });
            this.body = new CANNON.Body({ mass: 0 });
            this.body.addShape(hfShape);
            this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
            this.body.position.set(-this.size / 2, 0, this.size / 2);
            this.world.addBody(this.body);
        }
    }

    paintAt(point, radius) {
        // Not used with textures yet
    }

    destroy() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
        }
        if (this.body && this.world) {
            this.world.removeBody(this.body);
        }
    }
}

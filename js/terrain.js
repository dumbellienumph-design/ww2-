import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import perlin from 'https://esm.sh/gh/joeiddon/perlin';

export class Terrain {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.size = 1000;
        this.resolution = 128;
        this.elementSize = this.size / this.resolution;

        this.getBaseHeight = (x, z) => {
            const nx = x / 500, nz = z / 500;        
            let h = perlin.noise(nx, 0, nz) * 200;
            h += perlin.noise(nx * 4, 0, nz * 4) * 40;

            const dist = Math.sqrt(x*x + z*z);
            const plateauRadius = 150;
            const transitionWidth = 100;
            const t = Math.max(0, (dist - plateauRadius) / transitionWidth);
            const smoothT = Math.min(1, t * t * (3 - 2 * t)); 

            const centerHeight = 5; 
            const mountainess = (perlin.noise(nx*2, 0, nz*2) * 0.5 + 0.5); 
            const plateauHeight = centerHeight + mountainess * 15; 

            h = h * smoothT + plateauHeight * (1 - smoothT);       
            return h;
        };

        this.getHeight = (x, z) => {
            const halfSize = this.size / 2;
            if (x < -halfSize || x > halfSize || z < -halfSize || z > halfSize) return this.getBaseHeight(x, z);

            const gx = (x + halfSize) / this.elementSize;
            const gz = (halfSize - z) / this.elementSize;
            
            const ix = Math.floor(gx);
            const iz = Math.floor(gz);
            
            if (ix >= 0 && ix < this.resolution && iz >= 0 && iz < this.resolution) {
                // Bilinear interpolation for smooth height
                const fx = gx - ix;
                const fz = gz - iz;
                
                const h00 = this.matrix[ix][iz];
                const h10 = this.matrix[ix+1][iz];
                const h01 = this.matrix[ix][iz+1];
                const h11 = this.matrix[ix+1][iz+1];
                
                const h0 = h00 * (1 - fx) + h10 * fx;
                const h1 = h01 * (1 - fx) + h11 * fx;
                
                return h0 * (1 - fz) + h1 * fz;
            }

            return this.getBaseHeight(x, z);
        };

        const geometry = new THREE.PlaneGeometry(this.size, this.size, this.resolution, this.resolution);
        const vertices = geometry.attributes.position.array;
        geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vertices.length), 3));
        const colors = geometry.attributes.color.array;

        this.matrix = [];
        for (let i = 0; i <= this.resolution; i++) {
            this.matrix[i] = [];
            for (let j = 0; j <= this.resolution; j++) {
                const worldX = -this.size / 2 + i * this.elementSize;
                const worldZ = this.size / 2 - j * this.elementSize;
                const h = this.getBaseHeight(worldX, worldZ);
                this.matrix[i][j] = h;
                const vIdx = (j * (this.resolution + 1) + i) * 3;
                vertices[vIdx + 2] = h;
                const cIdx = vIdx;
                if (h < 5) { colors[cIdx] = 0.3; colors[cIdx+1] = 0.25; colors[cIdx+2] = 0.2; }
                else if (h < 80) { colors[cIdx] = 0.1; colors[cIdx+1] = 0.3; colors[cIdx+2] = 0.1; }
                else if (h < 150) { colors[cIdx] = 0.4; colors[cIdx+1] = 0.4; colors[cIdx+2] = 0.4; }
                else { colors[cIdx] = 0.95; colors[cIdx+1] = 0.95; colors[cIdx+2] = 1.0; }
            }
        }

        geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1.0 });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.receiveShadow = true;
        this.mesh.layers.enable(1); // minimap visibility
        this.scene.add(this.mesh);

        const hfShape = new CANNON.Heightfield(this.matrix, { elementSize: this.elementSize });
        const groundMaterial = new CANNON.Material("groundMaterial");
        this.body = new CANNON.Body({ mass: 0, material: groundMaterial });
        this.body.addShape(hfShape);
        this.world.addBody(this.body);
        this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.body.position.set(-this.size / 2, 0, this.size / 2);
    }

    deformAt(point, radius, depth) {
        const res = this.resolution;
        const size = this.size;
        const posAttr = this.mesh.geometry.attributes.position;    
        const colorAttr = this.mesh.geometry.attributes.color;     
        const gx = Math.round((point.x + size/2) / this.elementSize);
        const gz = Math.round((size/2 - point.z) / this.elementSize);
        const gridRadius = Math.ceil(radius / this.elementSize) + 1;
        let changed = false;
        for (let i = gx - gridRadius; i <= gx + gridRadius; i++) { 
            for (let j = gz - gridRadius; j <= gz + gridRadius; j++) {
                if (i >= 0 && i <= res && j >= 0 && j <= res) {    
                    const dx = (i - gx) * this.elementSize;        
                    const dz = (j - gz) * this.elementSize;        
                    const distSq = dx*dx + dz*dz;
                    const rSq = radius * radius;
                    if (distSq < rSq) {
                        changed = true;
                        const strength = 1 - Math.sqrt(distSq) / radius;
                        const deform = depth * strength;
                        this.matrix[i][j] -= deform;
                        const vIdx = j * (res + 1) + i;
                        posAttr.setZ(vIdx, posAttr.getZ(vIdx) - deform);
                        colorAttr.setXYZ(vIdx, 0.2, 0.15, 0.1);    
                    }
                }
            }
        }
        if (changed) {
            posAttr.needsUpdate = true;
            colorAttr.needsUpdate = true;
            this.mesh.geometry.computeVertexNormals();
            this.body.shapes[0].update(); 
            this.body.aabbNeedsUpdate = true;
        }
    }

    paintAt(point, radius) {
        const res = this.resolution;
        const size = this.size;
        const colorAttr = this.mesh.geometry.attributes.color;
        const gx = Math.round((point.x + size/2) / this.elementSize);
        const gz = Math.round((size/2 - point.z) / this.elementSize);
        const gridRadius = Math.ceil(radius / this.elementSize) + 1;
        let changed = false;
        for (let i = gx - gridRadius; i <= gx + gridRadius; i++) {
            for (let j = gz - gridRadius; j <= gz + gridRadius; j++) {
                if (i >= 0 && i <= res && j >= 0 && j <= res) {
                    const dx = (i - gx) * this.elementSize;
                    const dz = (j - gz) * this.elementSize;
                    if (dx*dx + dz*dz < radius*radius) {
                        colorAttr.setXYZ(j * (res + 1) + i, 0.2, 0.15, 0.1);
                        changed = true;
                    }
                }
            }
        }
        if (changed) colorAttr.needsUpdate = true;
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

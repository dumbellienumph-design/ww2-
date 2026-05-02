import * as THREE from 'three';
import * as CANNON from 'cannon-es';

class Noise {
    constructor() {
        this.p = new Uint8Array(512);
        this.permutation = new Uint8Array([151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,162,114,249,2,153,181,171,136,101,24,150,15,9,14,213,24,160,252,121,31,90,21,33,66,10,163,51,90,120,247,202,54,101,155,52,92,21,174,113,29,117,103,60,252,126,191,163,222,97,21,67,121,13,45,21,15,221,227,129,28,1,167,251,34,241,157,24,46,59,126,169,119,91,128,73,2,131,7,125,214,158,95,33,18,110,14,233,149,116,163,167,162,54,91,102,145,15,19,26,148,126,247,204,116,142,208,167,31,67,110,21,149,5,153,171,222,238,174,243,192,239,247,201,155,41,92,116,31,121,167,150,231,115,221,120,33,66,158,202,252,174,126,101,147,139,101,247,30,140,142,103,24,162,167,191,102,108,163,251]);
        for (let i = 0; i < 256; i++) this.p[256 + i] = this.p[i] = this.permutation[i];
    }
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(t, a, b) { return a + t * (b - a); }
    grad(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    noise(x, y, z) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;
        x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
        const u = this.fade(x), v = this.fade(y), w = this.fade(z);
        const A = this.p[X] + Y, AA = this.p[A] + Z, AB = this.p[A + 1] + Z;
        const B = this.p[X + 1] + Y, BA = this.p[B] + Z, BB = this.p[B + 1] + Z;
        return this.lerp(w, this.lerp(v, this.lerp(u, this.grad(this.p[AA], x, y, z), this.grad(this.p[BA], x - 1, y, z)), this.lerp(u, this.grad(this.p[AB], x, y - 1, z), this.grad(this.p[BB], x - 1, y - 1, z))), this.lerp(v, this.lerp(u, this.grad(this.p[AA + 1], x, y, z - 1), this.grad(this.p[BA + 1], x - 1, y, z - 1)), this.lerp(u, this.grad(this.p[AB + 1], x, y - 1, z - 1), this.grad(this.p[BB + 1], x - 1, y - 1, z - 1))));
    }
}
const perlin = new Noise();

export class Terrain {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.size = 2000;
        this.resolution = 256;
        this.elementSize = this.size / this.resolution;

        this.getHeight = (x, z) => {
            const nx = x / 500, nz = z / 500;
            // High-magnitude mountains for testing
            let h = perlin.noise(nx, 0, nz) * 200;
            h += perlin.noise(nx * 4, 0, nz * 4) * 40;
            const dist = Math.sqrt(x*x + z*z);
            if (dist < 200) h *= Math.pow(dist / 200, 2); 
            return h;
        };

        this.init();
    }

    init() {
        const geometry = new THREE.PlaneGeometry(this.size, this.size, this.resolution, this.resolution);
        const vertices = geometry.attributes.position.array;
        geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vertices.length), 3));
        const colors = geometry.attributes.color.array;

        const matrix = [];
        for (let i = 0; i <= this.resolution; i++) {
            matrix[i] = [];
            for (let j = 0; j <= this.resolution; j++) {
                const worldX = -this.size / 2 + i * this.elementSize;
                const worldZ = -this.size / 2 + j * this.elementSize;
                const h = this.getHeight(worldX, worldZ);
                matrix[i][j] = h;

                // Indexing for THREE.PlaneGeometry
                // Row j, Col i
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
        this.scene.add(this.mesh);

        // Cannon-es Heightfield mapping
        const hfShape = new CANNON.Heightfield(matrix, { elementSize: this.elementSize });
        this.body = new CANNON.Body({ mass: 0 });
        this.body.addShape(hfShape);
        // Rotate Local Z (height) to World Y (up)
        this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        // Position min-corner at (-size/2, 0, -size/2)
        this.body.position.set(-this.size / 2, 0, -this.size / 2);
        this.world.addBody(this.body);

        // --- INVISIBLE BOUNDARY WALLS ---
        this.addBoundaryWalls();
    }

    paintAt(point, radius) {
        const res = this.resolution;
        const size = this.size;
        const colorAttr = this.mesh.geometry.attributes.color;
        
        // Convert world X/Z to grid indices i (column) and j (row)
        const gx = Math.round((point.x + size/2) / this.elementSize);
        const gz = Math.round((point.z + size/2) / this.elementSize);
        
        // Calculate the range of indices to check
        const gridRadius = Math.ceil(radius / this.elementSize) + 1;
        
        for (let i = gx - gridRadius; i <= gx + gridRadius; i++) {
            for (let j = gz - gridRadius; j <= gz + gridRadius; j++) {
                if (i >= 0 && i <= res && j >= 0 && j <= res) {
                    const vIdx = j * (res + 1) + i;
                    
                    // Physical distance check for circular splat
                    const dx = (i - gx) * this.elementSize;
                    const dz = (j - gz) * this.elementSize;
                    if (dx*dx + dz*dz < radius * radius) {
                        // Change to bright blue
                        colorAttr.setXYZ(vIdx, 0.0, 0.4, 1.0);
                    }
                }
            }
        }
        colorAttr.needsUpdate = true;
    }

    addBoundaryWalls() {
        const wallThickness = 10;
        const wallHeight = 500;
        const halfSize = this.size / 2;

        const wallMaterial = new CANNON.Material("wallMaterial");
        const createWall = (x, z, width, depth) => {
            const body = new CANNON.Body({
                mass: 0,
                shape: new CANNON.Box(new CANNON.Vec3(width / 2, wallHeight / 2, depth / 2)),
                position: new CANNON.Vec3(x, wallHeight / 2, z),
                material: wallMaterial
            });
            // Link a visual-less mesh just for naming
            body.mesh = { name: 'boundary' }; 
            this.world.addBody(body);
        };

        // North Wall
        createWall(0, -halfSize - wallThickness / 2, this.size, wallThickness);
        // South Wall
        createWall(0, halfSize + wallThickness / 2, this.size, wallThickness);
        // East Wall
        createWall(halfSize + wallThickness / 2, 0, wallThickness, this.size);
        // West Wall
        createWall(-halfSize - wallThickness / 2, 0, wallThickness, this.size);
    }
}
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Vegetation {
    constructor(scene, world, terrain) {
        this.scene = scene;
        this.world = world;
        this.terrain = terrain;
        
        this.grassCount = 150000; // Increased quantity
        this.objects = []; 
        this.grass = null;
        this.windTime = 0;
        
        this.init();
    }

    init() {
        this.createGrass();
    }

    createGrass() {
        // Shorter grass height: 0.4 instead of 1.0
        const bladeGeo = new THREE.PlaneGeometry(0.3, 0.4, 1, 2);
        bladeGeo.translate(0, 0.2, 0);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x3d5a1e, side: THREE.DoubleSide, roughness: 1.0
        });

        material.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = { value: 0 };
            shader.vertexShader = `
                uniform float uTime;
                ${shader.vertexShader}
            `.replace(
                `#include <begin_vertex>`,
                `#include <begin_vertex>
                float wind = sin(uTime * 1.8 + position.x * 0.5 + position.z * 0.5) * (position.y * 0.4);
                transformed.x += wind;
                `
            );
            this.grassShader = shader;
        };

        const instancedMesh = new THREE.InstancedMesh(bladeGeo, material, this.grassCount);
        const dummy = new THREE.Object3D();
        const area = this.terrain.size;

        for (let i = 0; i < this.grassCount; i++) {
            const x = (Math.random() - 0.5) * area;
            const z = (Math.random() - 0.5) * area;
            const y = this.terrain.getHeight(x, z);
            
            if (y < 85) {
                dummy.position.set(x, y, z);
                dummy.rotation.y = Math.random() * Math.PI;
                const s = 0.8 + Math.random() * 0.7;
                dummy.scale.set(s, s, s);
            } else {
                dummy.position.set(0, -1000, 0);
            }
            
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedMesh.receiveShadow = true;
        instancedMesh.name = 'grass';
        
        // --- NON-CORPOREAL FIX ---
        // Completely disables raycasting for this object so bullets pass through without calculation
        instancedMesh.raycast = () => {}; 
        
        this.scene.add(instancedMesh);
        this.grass = instancedMesh;
    }

    update(delta) {
        this.windTime += delta;
        if (this.grassShader) this.grassShader.uniforms.uTime.value = this.windTime;
    }
}
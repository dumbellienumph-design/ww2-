import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Vegetation {
    constructor(scene, world, terrain) {
        this.scene = scene;
        this.world = world;
        this.terrain = terrain;
        
        this.grassCount = 150000;
        this.objects = []; 
        this.grass = null;
        this.windTime = 0;
        
        this.init();
    }

    init() {
        this.createGrass();
    }

    createGrass() {
        const bladeGeo = new THREE.PlaneGeometry(0.3, 0.4, 1, 2);
        bladeGeo.translate(0, 0.2, 0); // CRITICAL: Pivot at bottom
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x224422, side: THREE.DoubleSide, roughness: 1.0
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

        const positions = this.terrain.mesh.geometry.attributes.position.array;
        const normals = this.terrain.mesh.geometry.attributes.normal.array;
        const vertexCount = positions.length / 3;

        const instancedMesh = new THREE.InstancedMesh(bladeGeo, material, vertexCount);
        const dummy = new THREE.Object3D();
        const up = new THREE.Vector3(0, 1, 0);
        const randQuat = new THREE.Quaternion();
        const normal = new THREE.Vector3();
        let count = 0;

        for (let i = 0; i < vertexCount; i++) {
            if (Math.random() > 0.85) continue;

            const worldX = positions[i * 3];
            const worldZ = -positions[i * 3 + 1];
            
            // Randomize the pattern
            const jitterX = (Math.random() - 0.5) * this.terrain.elementSize * 0.8;
            const jitterZ = (Math.random() - 0.5) * this.terrain.elementSize * 0.8;
            const finalX = worldX + jitterX;
            const finalZ = worldZ + jitterZ;

            // Maintain 0 Distance
            const finalY = this.terrain.getHeight(finalX, finalZ);
            
            // Exclude Mountain Tops
            if (finalY >= 5 && finalY < 75) {
                const hL = this.terrain.getHeight(finalX - 0.2, finalZ);
                const hR = this.terrain.getHeight(finalX + 0.2, finalZ);
                const hD = this.terrain.getHeight(finalX, finalZ - 0.2);
                const hU = this.terrain.getHeight(finalX, finalZ + 0.2);
                normal.set(hL - hR, 0.4, hD - hU).normalize();

                dummy.position.set(finalX, finalY, finalZ);
                dummy.quaternion.setFromUnitVectors(up, normal);
                randQuat.setFromAxisAngle(up, Math.random() * Math.PI);
                dummy.quaternion.multiply(randQuat);

                const s = 0.8 + Math.random() * 0.7;
                dummy.scale.set(s, s, s);
                dummy.updateMatrix();
                instancedMesh.setMatrixAt(count, dummy.matrix);
                count++;
            }
        }
        
        instancedMesh.count = count;
        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedMesh.castShadow = false;
        instancedMesh.receiveShadow = false;
        instancedMesh.name = 'grass';
        instancedMesh.raycast = () => {}; 
        
        this.scene.add(instancedMesh);
        this.grass = instancedMesh;
    }

    update(delta) {
        this.windTime += delta;
        if (this.grassShader) this.grassShader.uniforms.uTime.value = this.windTime;
    }
}

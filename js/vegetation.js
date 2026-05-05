import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Vegetation {
    constructor(scene, world, terrain) {
        this.scene = scene;
        this.world = world;
        this.terrain = terrain;
        
        this.grassCount = 40000;
        this.treeInstances = [];
        this.objects = []; 
        this.grass = null;
        this.windTime = 0;
        
        this.init();
    }

    init() {
        this.createGrass();
        this.createTrees();
    }

    createTrees() {
        const treeCount = 2000;
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4d3a2a, roughness: 1 });
        const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2d4d2d, roughness: 1 });

        const trunkGeo = new THREE.CylinderGeometry(0.5, 0.5, 8, 8);
        const leavesGeo = new THREE.ConeGeometry(4, 12, 8);

        const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
        const leavesMesh = new THREE.InstancedMesh(leavesGeo, leavesMat, treeCount);
        trunkMesh.castShadow = true;
        leavesMesh.castShadow = true;

        const dummy = new THREE.Object3D();
        let count = 0;

        for (let i = 0; i < treeCount; i++) {
            const x = (Math.random() - 0.5) * this.terrain.size;
            const z = (Math.random() - 0.5) * this.terrain.size;
            const y = this.terrain.getHeight(x, z);

            if (y > 10 && y < 60) { // Forest areas
                dummy.position.set(x, y, z);
                const scale = 0.8 + Math.random() * 0.7;
                dummy.scale.set(scale, scale, scale);
                dummy.rotation.y = Math.random() * Math.PI;
                dummy.updateMatrix();

                trunkMesh.setMatrixAt(count, dummy.matrix);

                dummy.position.y += 8 * scale; // Move leaves up
                dummy.updateMatrix();
                leavesMesh.setMatrixAt(count, dummy.matrix);

                this.treeInstances.push({
                    position: new CANNON.Vec3(x, y + 4 * scale, z),
                    scale: scale,
                    body: null
                });

                count++;
            }
        }

        trunkMesh.count = count;
        leavesMesh.count = count;
        trunkMesh.instanceMatrix.needsUpdate = true;
        leavesMesh.instanceMatrix.needsUpdate = true;

        this.scene.add(trunkMesh);
        this.scene.add(leavesMesh);
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
            if (finalY >= 0 && finalY < 75) {
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
        instancedMesh.receiveShadow = true;
        instancedMesh.name = 'grass';
        instancedMesh.raycast = () => {}; 
        
        this.scene.add(instancedMesh);
        this.grass = instancedMesh;
    }

    destroy() {
        if (this.grass) {
            this.scene.remove(this.grass);
            this.grass.geometry.dispose();
            this.grass.material.dispose();
        }
        this.scene.traverse(child => {
            if (child instanceof THREE.InstancedMesh) {
                this.scene.remove(child);
                child.geometry.dispose();
                child.material.dispose();
            }
        });
        this.world.bodies.filter(b => b.isTree).forEach(b => this.world.removeBody(b));
    }

    update(delta, playerPos) {
        this.windTime += delta;
        if (this.grassShader) this.grassShader.uniforms.uTime.value = this.windTime;

        if (playerPos) {
            const cullDistSq = 100 * 100;
            this.treeInstances.forEach(tree => {
                const dx = tree.position.x - playerPos.x;
                const dz = tree.position.z - playerPos.z;
                const distSq = dx * dx + dz * dz;

                if (distSq < cullDistSq) {
                    if (!tree.body) {
                        const shape = new CANNON.Box(new CANNON.Vec3(0.5 * tree.scale, 4 * tree.scale, 0.5 * tree.scale));
                        tree.body = new CANNON.Body({ mass: 0, shape: shape });
                        tree.body.isTree = true;
                        tree.body.position.copy(tree.position);
                        this.world.addBody(tree.body);
                    }
                } else {
                    if (tree.body) {
                        this.world.removeBody(tree.body);
                        tree.body = null;
                    }
                }
            });
        }
    }
}

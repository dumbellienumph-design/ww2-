import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class VFX {
    static activeEffects = [];
    
    // Shared Resources
    static partGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    static impactGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    static chunkGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    static chunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2817 });

    static update(delta) {
        for (let i = this.activeEffects.length - 1; i >= 0; i--) {
            if (this.activeEffects[i].update(delta)) {
                this.activeEffects.splice(i, 1);
            }
        }
    }

    static createExplosion(scene, world, position, radius = 5, damage = 50, audio = null) {
        const geo = new THREE.SphereGeometry(radius, 16, 16);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.8 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(position);
        scene.add(mesh);

        const particleCount = 15; // Reduced from 25 for performance
        const particles = [];
        for(let i=0; i<particleCount; i++) {
            const pMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
            const p = new THREE.Mesh(this.partGeo, pMat);
            p.position.copy(position);
            const dir = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5) + 0.5, (Math.random() - 0.5)).normalize();
            p.userData.velocity = dir.multiplyScalar(Math.random() * 30 + 15);
            scene.add(p);
            particles.push({ mesh: p, mat: pMat });
        }

        this.createBurnMark(scene, position, radius);
        this.spawnDirtChunks(scene, world, position, Math.floor(radius * 1.0));

        if (window.game && window.game.terrain) {
            window.game.terrain.deformAt(position, radius, radius * 0.4);
        }

        if (audio && typeof audio.play === 'function') {
            audio.play('explosion_blast', { randomPitch: true });
        }

        const duration = 0.6;
        let elapsed = 0;

        this.activeEffects.push({
            update: (delta) => {
                elapsed += delta;
                const progress = elapsed / duration;
                if (progress >= 1) {
                    scene.remove(mesh);
                    geo.dispose();
                    mat.dispose();
                    particles.forEach(p => {
                        scene.remove(p.mesh);
                        p.mat.dispose();
                    });
                    return true;
                }
                mesh.scale.set(progress * 2.5, progress * 2.5, progress * 2.5);
                mesh.material.opacity = 1 - progress;
                particles.forEach(p => {
                    p.mesh.position.add(p.mesh.userData.velocity.clone().multiplyScalar(delta));
                    p.mesh.userData.velocity.y -= 31.25 * delta;
                    p.mesh.userData.velocity.multiplyScalar(Math.pow(0.96, delta * 60)); 
                });
                return false;
            }
        });

        // Physical explosion force
        world.bodies.forEach(body => {
            const dist = body.position.distanceTo(new CANNON.Vec3(position.x, position.y, position.z));
            if (dist < radius) {
                if (body.userData?.gameEntity?.takeDamage) {
                    body.userData.gameEntity.takeDamage(damage * (1 - (dist / radius)));
                } else if (body.onHit) {
                    body.onHit(damage * (1 - (dist / radius)));
                }
                const dir = body.position.vsub(new CANNON.Vec3(position.x, position.y, position.z)).unit();
                body.applyImpulse(dir.scale(15000 * (1 - dist/radius)), body.position);
            }
        });
    }

    static spawnDirtChunks(scene, world, position, count) {
        for (let i = 0; i < count; i++) {
            const size = 0.2 + Math.random() * 0.4;
            const body = new CANNON.Body({
                mass: 1,
                shape: new CANNON.Box(new CANNON.Vec3(size/2, size/2, size/2)),
                position: new CANNON.Vec3(
                    position.x + (Math.random()-0.5) * 2,
                    position.y + 1,
                    position.z + (Math.random()-0.5) * 2
                )
            });
            
            body.velocity.set((Math.random() - 0.5) * 15, 10 + Math.random() * 15, (Math.random() - 0.5) * 15);
            body.angularVelocity.set(Math.random()*10, Math.random()*10, Math.random()*10);
            
            const mesh = new THREE.Mesh(this.chunkGeo, this.chunkMat);
            mesh.scale.set(size/0.4, size/0.4, size/0.4);
            scene.add(mesh);
            world.addBody(body);
            
            let elapsed = 0;
            const lifespan = 4.0 + Math.random() * 2.0;
            
            this.activeEffects.push({
                update: (delta) => {
                    elapsed += delta;
                    if (elapsed > lifespan) {
                        scene.remove(mesh);
                        world.removeBody(body);
                        return true;
                    }
                    mesh.position.copy(body.position);
                    mesh.quaternion.copy(body.quaternion);
                    return false;
                }
            });
        }
    }

    static createBurnMark(scene, position, radius) {
        const geo = new THREE.CircleGeometry(radius * 0.8, 16);
        const mat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
        const mark = new THREE.Mesh(geo, mat);
        mark.rotation.x = -Math.PI / 2;
        mark.position.copy(position);
        mark.position.y = (window.game?.terrain?.getHeight(position.x, position.z) || position.y) + 0.15;
        
        scene.add(mark);
        
        let elapsed = 0;
        const duration = 15.0; // Reduced from 25
        this.activeEffects.push({
            update: (delta) => {
                elapsed += delta;
                if (elapsed > duration) {
                    scene.remove(mark);
                    geo.dispose();
                    mat.dispose();
                    return true;
                }
                return false;
            }
        });
    }

    static createImpactVFX(scene, position, normal) {
        const color = 0x00aaff;
        const count = 4; // Reduced from 6
        
        for(let i=0; i<count; i++) {
            const pMat = new THREE.MeshBasicMaterial({ color: color });
            const p = new THREE.Mesh(this.impactGeo, pMat);
            p.position.copy(position);
            const bounce = normal.clone().add(new THREE.Vector3((Math.random()-0.5)*2, (Math.random()-0.5)*2, (Math.random()-0.5)*2)).normalize();
            p.userData.velocity = bounce.multiplyScalar(Math.random() * 8 + 4);
            scene.add(p);
            
            let elapsed = 0;
            const duration = 0.4;

            this.activeEffects.push({
                update: (delta) => {
                    elapsed += delta;
                    if (elapsed >= duration) {
                        scene.remove(p);
                        pMat.dispose();
                        return true;
                    }
                    p.position.add(p.userData.velocity.clone().multiplyScalar(delta));
                    p.userData.velocity.y -= 25 * delta;
                    return false;
                }
            });
        }
    }

    static destroy() {
        this.activeEffects = [];
    }
}

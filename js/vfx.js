import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class VFX {
    static createExplosion(scene, world, position, radius = 5, damage = 50, audio = null) {
        const geo = new THREE.SphereGeometry(radius);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.8 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(position);
        scene.add(mesh);

        const particleCount = 25;
        const particles = [];
        const partGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        for(let i=0; i<particleCount; i++) {
            const pMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
            const p = new THREE.Mesh(partGeo, pMat);
            p.position.copy(position);
            const dir = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5) + 0.5, (Math.random() - 0.5)).normalize();
            p.userData.velocity = dir.multiplyScalar(Math.random() * 30 + 15);
            scene.add(p);
            particles.push(p);
        }

        this.createBurnMark(scene, position, radius);

        if (audio && typeof audio.play === 'function') {
            audio.play('explosion_blast', { randomPitch: true });
        }

        const startTime = Date.now();
        const duration = 600;
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;
            if (progress >= 1) {
                scene.remove(mesh);
                particles.forEach(p => scene.remove(p));
                return;
            }
            mesh.scale.set(progress * 2.5, progress * 2.5, progress * 2.5);
            mesh.material.opacity = 1 - progress;
            particles.forEach(p => {
                p.position.add(p.userData.velocity.clone().multiplyScalar(0.016));
                p.userData.velocity.y -= 0.5; 
                p.userData.velocity.multiplyScalar(0.96); 
            });
            requestAnimationFrame(animate);
        };
        animate();

        world.bodies.forEach(body => {
            const dist = body.position.distanceTo(new CANNON.Vec3(position.x, position.y, position.z));
            if (dist < radius) {
                if (body.onHit) body.onHit(damage * (1 - (dist / radius)));
                const dir = body.position.vsub(new CANNON.Vec3(position.x, position.y, position.z)).unit();
                body.applyImpulse(dir.scale(15000 * (1 - dist/radius)), body.position);
            }
        });
    }

    static createBurnMark(scene, position, radius) {
        const mark = new THREE.Mesh(
            new THREE.CircleGeometry(radius * 0.8, 16),
            new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })
        );
        mark.rotation.x = -Math.PI / 2;
        mark.position.copy(position);
        mark.position.y = 0.15; 
        scene.add(mark);
        setTimeout(() => scene.remove(mark), 25000);
    }

    // --- BULLET IMPACT EFFECTS ---
    static createBulletHole(scene, hit) {
        // System replaced by vertex-painting in terrain.js
    }

    static createImpactVFX(scene, position, normal, type = 'paint') {
        const color = 0x00aaff; // Bright blue particles
        const count = 6;
        const partGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        
        for(let i=0; i<count; i++) {
            const p = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color: color }));
            p.position.copy(position);
            const bounce = normal.clone().add(new THREE.Vector3((Math.random()-0.5)*2, (Math.random()-0.5)*2, (Math.random()-0.5)*2)).normalize();
            p.userData.velocity = bounce.multiplyScalar(Math.random() * 8 + 4);
            scene.add(p);
            
            const start = Date.now();
            const anim = () => {
                const elapsed = (Date.now() - start) / 500;
                if(elapsed < 1) {
                    p.position.add(p.userData.velocity.clone().multiplyScalar(0.016));
                    p.userData.velocity.y -= 0.4;
                    requestAnimationFrame(anim);
                } else { scene.remove(p); }
            };
            anim();
        }
    }
}
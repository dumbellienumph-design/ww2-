import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.physicalDebris = [];
        this.shellCasings = [];
        this.lights = [];
        this.fireTexture = this.createFireTexture();
    }

    createFireTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        gradient.addColorStop(0.2, 'rgba(255, 240, 100, 0.9)');
        gradient.addColorStop(0.5, 'rgba(255, 120, 0, 0.5)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(canvas);
    }

    createMuzzleFlash(position, direction, isTank = false) {
        const group = new THREE.Group();
        group.position.copy(position);
        group.lookAt(position.clone().add(direction));
        group.layers.set(1);
        this.scene.add(group);

        const createFireSprite = (scale, opacity, color = 0xffffff) => {
            const mat = new THREE.SpriteMaterial({ 
                map: this.fireTexture, transparent: true, opacity: opacity, color: color, blending: THREE.AdditiveBlending 
            });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.setScalar(scale);
            sprite.layers.set(1);
            group.add(sprite);
            return sprite;
        };

        const s = isTank ? 6.0 : 1.0;

        // 1. BASELINE REFINED
        const core = createFireSprite(s * 0.4, 1.0);
        const bloom = createFireSprite(s * 1.2, 0.7);
        bloom.position.z = -s * 0.2;
        const mainJet = createFireSprite(s * 1.5, 0.5);
        mainJet.scale.set(s * 0.8, s * 2.2, 1.0);
        mainJet.position.z = -s * 0.6;

        // 2. NEW: SIDE GAS JETS (Tactical Detail)
        const sideJets = [];
        for (let i = 0; i < 4; i++) {
            const sj = createFireSprite(s * 0.6, 0.4, 0xffcc88);
            sj.scale.set(s * 0.2, s * 1.2, 1.0);
            // Angled outward
            const angle = (i * Math.PI) / 2;
            sj.position.set(Math.cos(angle) * 0.1, Math.sin(angle) * 0.1, -0.1);
            sj.rotation.z = angle;
            sideJets.push(sj);
        }

        // 3. NEW: SECONDARY IGNITION SEED
        const seed = createFireSprite(s * 0.3, 0.8);
        seed.position.z = -s * 0.8; // Projects ahead of the main bloom

        // SHELL CASING EJECTION
        if (!isTank) this.ejectShell(position, direction);

        // --- REFINED WHITE SMOKE ---
        // Minimal quantity, pure white, fast fade
        this.createExhaustSmoke(position, direction.clone().multiplyScalar(isTank ? 4 : 1), false);
        
        // VELOCITY SPARKS
        const sparkCount = isTank ? 40 : 6;
        for(let i=0; i<sparkCount; i++) {
            const spark = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.6), new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, blending: THREE.AdditiveBlending }));
            const sparkDir = direction.clone().add(new THREE.Vector3((Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3)).normalize();
            spark.layers.set(1);
            this.particles.push({
                mesh: spark, velocity: sparkDir.multiplyScalar(Math.random() * 120 + 80), life: 0.04, maxLife: 0.04, isSpark: true
            });
            this.scene.add(spark);
            spark.position.copy(position);
            spark.lookAt(position.clone().add(sparkDir));
        }

        // --- FAST ANIMATION ---
        let life = 1.0;
        const speed = isTank ? 0.06 : 0.35; 
        const anim = () => {
            life -= speed;
            const expansion = 1 + (1 - life) * 1.5;
            
            core.scale.setScalar(s * 0.4 * life);
            bloom.scale.setScalar(s * 1.2 * expansion);
            mainJet.scale.set(s * 0.8 * expansion, s * 2.2 * expansion, 1.0);
            seed.scale.setScalar(s * 0.3 * (1 + (1-life)*2));
            seed.position.z -= 0.1; // Forward travel
            
            sideJets.forEach(sj => { sj.scale.y *= 1.1; sj.material.opacity = life * 0.4; });
            
            bloom.material.opacity = life * 0.7;
            mainJet.material.opacity = life * 0.5;
            seed.material.opacity = life * 0.8;
            
            if (life > 0) {
                requestAnimationFrame(anim);
            } else {
                this.scene.remove(group);
                core.material.dispose(); bloom.material.dispose(); mainJet.material.dispose();
                seed.material.dispose(); sideJets.forEach(sj => sj.material.dispose());
            }
        };
        anim();
    }

    ejectShell(pos, dir) {
        const shellGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.04);
        const shellMat = new THREE.MeshStandardMaterial({ color: 0xaa8822, metalness: 0.9, roughness: 0.2 });
        const mesh = new THREE.Mesh(shellGeo, shellMat);
        mesh.layers.set(1);
        mesh.position.copy(pos);
        this.scene.add(mesh);

        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir));
        // Small ejection puff
        this.createExhaustSmoke(pos.clone().add(right.clone().multiplyScalar(0.1)), right.multiplyScalar(0.2), false);

        const velocity = right.multiplyScalar(4 + Math.random() * 3);
        velocity.y = 3 + Math.random() * 3;
        velocity.add(dir.clone().multiplyScalar(-2)); 
        this.shellCasings.push({ mesh, velocity, rotation: new THREE.Vector3(Math.random()*30, Math.random()*30, Math.random()*30), life: 1.5 });
    }

    createPhysicalDebris(world, position, color, count = 5) {
        const geo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const mat = new THREE.MeshStandardMaterial({ color: color });
        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(geo, mat);
            mesh.castShadow = true;
            mesh.layers.set(1);
            this.scene.add(mesh);
            const body = new CANNON.Body({ mass: 5, shape: new CANNON.Box(new CANNON.Vec3(0.2, 0.2, 0.2)), position: new CANNON.Vec3(position.x + (Math.random() - 0.5) * 2, position.y + Math.random() * 2, position.z + (Math.random() - 0.5) * 2), velocity: new CANNON.Vec3((Math.random() - 0.5) * 10, Math.random() * 15, (Math.random() - 0.5) * 10) });
            world.addBody(body);
            this.physicalDebris.push({ mesh, body, life: 5.0 });
        }
    }

    createExhaustSmoke(position, velocity, isBlack = false) {
        const smokeGeo = new THREE.SphereGeometry(0.1, 6, 6); // Smaller
        const smokeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 }); // Pure white, low opacity
        const smoke = new THREE.Mesh(smokeGeo, smokeMat);
        smoke.layers.set(1);
        smoke.position.copy(position);
        this.scene.add(smoke);
        this.particles.push({ 
            mesh: smoke, 
            velocity: velocity.clone().add(new THREE.Vector3((Math.random()-0.5)*0.5, 0.5, (Math.random()-0.5)*0.5)), 
            life: 0.3, // Ultra short life
            maxLife: 0.3, 
            startSize: 0.1 
        });
    }

    update(delta, camera) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i]; p.life -= delta;
            if (p.life <= 0) { this.scene.remove(p.mesh); this.particles.splice(i, 1); continue; }
            p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
            const progress = p.life / p.maxLife;
            if (!p.isSpark) { p.mesh.scale.setScalar(1 + (1 - progress) * 4); p.mesh.material.opacity = progress * 0.15; }
            else { p.mesh.material.opacity = progress; }
        }
        for (let i = this.shellCasings.length - 1; i >= 0; i--) {
            const s = this.shellCasings[i]; s.life -= delta;
            if (s.life <= 0) { this.scene.remove(s.mesh); this.shellCasings.splice(i, 1); continue; }
            s.velocity.y -= 25 * delta;
            s.mesh.position.add(s.velocity.clone().multiplyScalar(delta));
            s.mesh.rotation.x += s.rotation.x * delta; s.mesh.rotation.y += s.rotation.y * delta; s.mesh.rotation.z += s.rotation.z * delta;
            if (s.life < 0.5) s.mesh.material.opacity = s.life * 2;
        }
        for (let i = this.physicalDebris.length - 1; i >= 0; i--) {
            const d = this.physicalDebris[i]; d.life -= delta;
            if (d.life <= 0) { this.scene.remove(d.mesh); if (d.body.world) d.body.world.removeBody(d.body); this.physicalDebris.splice(i, 1); continue; }
            d.mesh.position.copy(d.body.position); d.mesh.quaternion.copy(d.body.quaternion);
        }
    }
}
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class ParticleSystem {
    // Shared resources for static particles
    static smokeGeo = new THREE.SphereGeometry(0.1, 6, 6);
    static sparkGeo = new THREE.BoxGeometry(0.01, 0.01, 0.6);
    static fireGeo = new THREE.BoxGeometry(1, 1, 1);
    static shellGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.04);
    static shellMat = new THREE.MeshStandardMaterial({ color: 0xaa8822, metalness: 0.9, roughness: 0.2 });

    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.physicalDebris = [];
        this.shellCasings = [];
        this.muzzleFlashes = [];
        this.fireTexture = this.createFireTexture();
        this.rainParticles = null;
        this.rainVelocity = new THREE.Vector3(-1, -25, -1);
    }

    initRain() {
        const count = 3000;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        for(let i=0; i<count*3; i++) pos[i] = (Math.random() - 0.5) * 100;
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({ color: 0x666677, size: 0.15, transparent: true, opacity: 0.4 });
        this.rainParticles = new THREE.Points(geo, mat);
        this.scene.add(this.rainParticles);
    }

    updateRain(delta, camera) {
        if (!this.rainParticles) return;
        this.rainParticles.position.copy(camera.position);
        const pos = this.rainParticles.geometry.attributes.position.array;
        for(let i=0; i<pos.length; i+=3) {
            pos[i] += this.rainVelocity.x * delta;
            pos[i+1] += this.rainVelocity.y * delta;
            pos[i+2] += this.rainVelocity.z * delta;
            if (pos[i+1] < -50) pos[i+1] = 50;
            if (pos[i] < -50) pos[i] = 50;
            if (pos[i] > 50) pos[i] = -50;
            if (pos[i+2] < -50) pos[i+2] = 50;
            if (pos[i+2] > 50) pos[i+2] = -50;
        }
        this.rainParticles.geometry.attributes.position.needsUpdate = true;
    }

    createFire(pos, size = 1, life = 1) {
        const count = 3; // Reduced for performance
        for(let i=0; i<count; i++) {
            const mat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
            const p = new THREE.Mesh(ParticleSystem.fireGeo, mat);
            p.scale.setScalar(size);
            p.position.copy(pos).add(new THREE.Vector3((Math.random()-0.5)*size, (Math.random()-0.5)*size, (Math.random()-0.5)*size));
            const velocity = new THREE.Vector3((Math.random()-0.5)*2, 2 + Math.random()*3, (Math.random()-0.5)*2);
            this.particles.push({ mesh: p, mat: mat, velocity: velocity, life: life + Math.random(), maxLife: life + Math.random() });
            this.scene.add(p);
        }
    }

    createFireTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        gradient.addColorStop(0.2, 'rgba(255, 240, 100, 0.9)');
        gradient.addColorStop(0.5, 'rgba(255, 120, 0, 0.5)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
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
        const core = createFireSprite(s * 0.4, 1.0);
        const bloom = createFireSprite(s * 1.2, 0.7);
        bloom.position.z = -s * 0.2;
        const mainJet = createFireSprite(s * 1.5, 0.5);
        mainJet.scale.set(s * 0.8, s * 2.2, 1.0);
        mainJet.position.z = -s * 0.6;

        const sideJets = [];
        for (let i = 0; i < 4; i++) {
            const sj = createFireSprite(s * 0.6, 0.4, 0xffcc88);
            sj.scale.set(s * 0.2, s * 1.2, 1.0);
            const angle = (i * Math.PI) / 2;
            sj.position.set(Math.cos(angle) * 0.1, Math.sin(angle) * 0.1, -0.1);
            sj.rotation.z = angle;
            sideJets.push(sj);
        }

        const seed = createFireSprite(s * 0.3, 0.8);
        seed.position.z = -s * 0.8; 

        if (!isTank) this.ejectShell(position, direction);
        this.createExhaustSmoke(position, direction.clone().multiplyScalar(isTank ? 4 : 1), false);
        
        const sparkCount = isTank ? 20 : 4; // Reduced from 40/6
        for(let i=0; i<sparkCount; i++) {
            const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, blending: THREE.AdditiveBlending });
            const spark = new THREE.Mesh(ParticleSystem.sparkGeo, sparkMat);
            const sparkDir = direction.clone().add(new THREE.Vector3((Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3)).normalize();
            spark.layers.set(1);
            spark.position.copy(position);
            spark.lookAt(position.clone().add(sparkDir));
            this.scene.add(spark);
            this.particles.push({ mesh: spark, mat: sparkMat, velocity: sparkDir.multiplyScalar(Math.random() * 120 + 80), life: 0.04, maxLife: 0.04, isSpark: true });
        }

        this.muzzleFlashes.push({ group, core, bloom, mainJet, seed, sideJets, life: 1.0, speed: isTank ? 0.06 : 0.35, s });
    }

    ejectShell(pos, dir) {
        const mesh = new THREE.Mesh(ParticleSystem.shellGeo, ParticleSystem.shellMat);
        mesh.layers.set(1);
        mesh.position.copy(pos);
        this.scene.add(mesh);

        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir));
        const velocity = right.multiplyScalar(4 + Math.random() * 3);
        velocity.y = 3 + Math.random() * 3;
        velocity.add(dir.clone().multiplyScalar(-2)); 
        this.shellCasings.push({ mesh, velocity, rotation: new THREE.Vector3(Math.random()*30, Math.random()*30, Math.random()*30), life: 1.5 });
    }

    createExhaustSmoke(position, velocity, isBlack = false) {
        const mat = new THREE.MeshBasicMaterial({ color: isBlack ? 0x222222 : 0xaaaaaa, transparent: true, opacity: 0.15 });
        const smoke = new THREE.Mesh(ParticleSystem.smokeGeo, mat);
        smoke.layers.set(1);
        smoke.position.copy(position);
        this.scene.add(smoke);
        this.particles.push({ 
            mesh: smoke, 
            mat: mat,
            velocity: velocity.clone().add(new THREE.Vector3((Math.random()-0.5)*0.5, 0.5, (Math.random()-0.5)*0.5)), 
            life: 0.4,
            maxLife: 0.4 
        });
    }

    destroy() {
        if (this.fireTexture) this.fireTexture.dispose();
        const cleanup = (list) => {
            list.forEach(p => {
                this.scene.remove(p.mesh || p.group);
                if (p.mat) p.mat.dispose();
            });
        };
        cleanup(this.particles);
        cleanup(this.shellCasings);
        cleanup(this.muzzleFlashes);
        if (this.rainParticles) {
            this.scene.remove(this.rainParticles);
            this.rainParticles.geometry.dispose();
            this.rainParticles.material.dispose();
        }
    }

    update(delta, camera) {
        // Update Muzzle Flashes
        for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
            const f = this.muzzleFlashes[i];
            f.life -= f.speed * delta * 60; // Normalize to 60fps
            if (f.life <= 0) {
                this.scene.remove(f.group);
                f.core.material.dispose(); f.bloom.material.dispose(); f.mainJet.material.dispose();
                f.seed.material.dispose(); f.sideJets.forEach(sj => sj.material.dispose());
                this.muzzleFlashes.splice(i, 1);
            } else {
                const expansion = 1 + (1 - f.life) * 1.5;
                f.core.scale.setScalar(f.s * 0.4 * f.life);
                f.bloom.scale.setScalar(f.s * 1.2 * expansion);
                f.mainJet.scale.set(f.s * 0.8 * expansion, f.s * 2.2 * expansion, 1.0);
                f.seed.scale.setScalar(f.s * 0.3 * (1 + (1-f.life)*2));
                f.seed.position.z -= 0.1;
                f.sideJets.forEach(sj => { sj.scale.y *= 1.1; sj.material.opacity = f.life * 0.4; });
                f.bloom.material.opacity = f.life * 0.7;
                f.mainJet.material.opacity = f.life * 0.5;
                f.seed.material.opacity = f.life * 0.8;
            }
        }

        // Update Standard Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i]; p.life -= delta;
            if (p.life <= 0) { 
                this.scene.remove(p.mesh); 
                if (p.mat) p.mat.dispose();
                this.particles.splice(i, 1); 
                continue; 
            }
            p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
            const progress = p.life / p.maxLife;
            if (!p.isSpark) { 
                p.mesh.scale.setScalar(1 + (1 - progress) * 4); 
                if (p.mat) p.mat.opacity = progress * 0.15; 
            } else {
                if (p.mat) p.mat.opacity = progress;
            }
        }

        for (let i = this.shellCasings.length - 1; i >= 0; i--) {
            const s = this.shellCasings[i]; s.life -= delta;
            if (s.life <= 0) { this.scene.remove(s.mesh); this.shellCasings.splice(i, 1); continue; }
            s.velocity.y -= 25 * delta;
            s.mesh.position.add(s.velocity.clone().multiplyScalar(delta));
            s.mesh.rotation.x += s.rotation.x * delta; s.mesh.rotation.y += s.rotation.y * delta; s.mesh.rotation.z += s.rotation.z * delta;
        }
    }
}

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Player } from './player.js';
import { Terrain } from './terrain.js';
import { ParticleSystem } from './particles.js';
import { Vegetation } from './vegetation.js';
import { Enemy } from './enemy.js';
import { Base } from './base.js';
import { GameAudio } from './audio.js';
import { ModernTank } from './modern-tank.js';
import { PantherTank } from './panther-tank.js';
import { SketchfabTank } from './sketchfab-tank.js';
import { ProjectileManager } from './projectiles.js';
import { Chicken } from './chicken.js';
import { VFX } from './vfx.js';

class Game {
    constructor() {
        window.game = this;
        this.canvas = document.querySelector('#game-canvas');
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.scene = new THREE.Scene();
        this.fogColor = new THREE.Color(0x2b2b26); // War-torn grey-ish fog
        this.scene.background = this.fogColor.clone();
        this.scene.fog = new THREE.FogExp2(this.fogColor.clone(), 0.007); // Slightly denser

        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.81 * 3, 0); // Realistic gravity (scaled)

        this.enemies = [];
        this.spawnedTanks = [];
        this.bases = [];
        this.chickens = [];
        this.ragdolls = [];
        this.timers = [];
        
        this.killCount = 0;
        this.isPaused = false;
        this.gameOver = false;
        this.elapsedTime = 0;
        this._lockLostTime = 0;

        this.audio = new GameAudio();
        this.projectiles = new ProjectileManager(this.scene, this.world);

        this.initWorld();
        this.initUI();
        this.initMinimap();
        this.initCompass();

        this.clock = new THREE.Clock();
        this.onWindowResize = this.onWindowResize.bind(this);
        window.addEventListener('resize', this.onWindowResize);
        this.createStartOverlay();
        // Auto-start for testing
        setTimeout(() => {
            const overlay = document.getElementById('start-overlay');
            if (overlay) overlay.remove();
            this.player.requestPointerLock();
            this.audio.startAmbient();
            this.animate();
        }, 100);
    }

    destroy() {
        this.gameOver = true;
        this.isPaused = true;
        
        if (this.player) this.player.destroy();
        this.enemies.forEach(e => e.destroy());
        this.spawnedTanks.forEach(t => t.destroy());
        this.bases.forEach(b => b.destroy());
        this.chickens.forEach(c => {
            if (c.destroy) c.destroy();
            else {
                this.scene.remove(c.group);
                this.world.removeBody(c.body);
            }
        });
        
        if (this.modernTank) this.modernTank.destroy();
        if (this.vegetation) this.vegetation.destroy?.();
        if (this.terrain) this.terrain.destroy?.();
        if (this.projectiles) this.projectiles.destroy();
        if (this.audio) this.audio.destroy?.();
        if (this.particles) this.particles.destroy?.();
        
        VFX.destroy();

        window.removeEventListener('resize', this.onWindowResize);
        
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.forceContextLoss();
        }
        if (this.minimapRenderer) this.minimapRenderer.dispose();
        
        this.scene.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => {
                        if (m.map) m.map.dispose();
                        m.dispose();
                    });
                    else {
                        if (child.material.map) child.material.map.dispose();
                        child.material.dispose();
                    }
                }
            }
        });

        const overlay = document.getElementById('start-overlay');
        if (overlay) overlay.remove();
        
        window.game = null;
    }

    initWorld() {
        this.terrain = new Terrain(this.scene, this.world);
        this.initLights();
        this.vegetation = new Vegetation(this.scene, this.world, this.terrain);
        this.particles = new ParticleSystem(this.scene);

        this.player = new Player(this.scene, this.world, this.renderer.domElement, this.audio, this.particles, this.terrain);

        this.particles.initRain();

        this.bases.push(new Base(this.scene, this.world, new THREE.Vector3(0, 0, 100), this, this.particles, this.terrain, false));
        this.bases.push(new Base(this.scene, this.world, new THREE.Vector3(0, 0, -350), this, this.particles, this.terrain, true));

        const spawnPts = [[-20, -40], [20, -50], [-40, -60], [40, -55], [0, -70]];
        spawnPts.forEach(([x, z]) => {
            const y = this.terrain.getHeight(x, z) + 0.9;
            const e = new Enemy(this.scene, this.world, this.terrain, new THREE.Vector3(x, y, z), this);
            this.enemies.push(e);
        });

        this.player.body.position.set(0, this.terrain.getHeight(0, 0) + 2, 0);

        const mtPos = new THREE.Vector3(20, this.terrain.getHeight(20, 20) + 0, 20);
        
        const pedGeo = new THREE.BoxGeometry(10, 5, 15);
        const pedMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
        const pedestal = new THREE.Mesh(pedGeo, pedMat);
        pedestal.position.set(mtPos.x, mtPos.y + 2.5, mtPos.z);
        pedestal.castShadow = true;
        pedestal.receiveShadow = true;
        pedestal.layers.enable(1); 
        this.scene.add(pedestal);

        const pedBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(5, 2.5, 7.5)) });
        pedBody.position.set(mtPos.x, mtPos.y + 2.5, mtPos.z);
        this.world.addBody(pedBody);

        this.modernTank = new ModernTank(this.scene, this.world, this.terrain, new THREE.Vector3(mtPos.x, mtPos.y + 6, mtPos.z), this.audio, this.particles);
    
        this.spawnedTanks.push(new SketchfabTank(this.scene, this.world, this.terrain, new THREE.Vector3(0, 0, -350)));

        this.initChicken();
    }

    initChicken() {
        const spawnPoints = [
            new THREE.Vector3(-5, 5, 95),
            new THREE.Vector3(5, 5, 90),
            new THREE.Vector3(-10, 5, 105)
        ];

        spawnPoints.forEach(pos => {
            pos.y = this.terrain.getHeight(pos.x, pos.z) + 1;
            const c = new Chicken(this.scene, this.world, this.terrain, pos, this);
            this.chickens.push(c);
        });
    }

    initLights() {
        this.scene.add(new THREE.AmbientLight(0xd0d0c8, 0.8));
        const sun = new THREE.DirectionalLight(0xffffff, 0.5);
        sun.position.set(200, 400, 100);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 1500;
        sun.shadow.camera.left = -400;
        sun.shadow.camera.right = 400;
        sun.shadow.camera.top = 400;
        sun.shadow.camera.bottom = -400;
        this.scene.add(sun);
    }

    initMinimap() {
        this.minimapCanvas = document.querySelector('#minimap-canvas');
        if (!this.minimapCanvas) return;
        this.minimapRenderer = new THREE.WebGLRenderer({ canvas: this.minimapCanvas, antialias: false });
        this.minimapRenderer.setSize(200, 200);
        this.minimapCamera = new THREE.OrthographicCamera(-150, 150, 150, -150, 0.1, 1000);
        this.minimapCamera.position.set(0, 500, 0);
        this.minimapCamera.lookAt(0, 0, 0);
        this.minimapCamera.layers.enable(1);
    }

    initCompass() {
        const tape = document.getElementById('compass-tape');
        if (!tape) return;
        tape.innerHTML = '';
        const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const cardinals = new Set(['N', 'S', 'E', 'W']);
        for (let rep = 0; rep < 4; rep++) {
            dirs.forEach(d => {
                const span = document.createElement('span');
                span.textContent = d;
                span.style.color = cardinals.has(d) ? '#ff0' : '#888';
                span.style.minWidth = '50px';
                span.style.textAlign = 'center';
                tape.appendChild(span);
            });
        }
    }

    initUI() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape' && !this.gameOver) this.togglePause();
            if (e.code === 'KeyV' && !e.repeat) {
                const menu = document.getElementById('command-menu');
                menu.classList.toggle('active');
                if (menu.classList.contains('active')) document.exitPointerLock();
                else if (!this.isPaused) this.player.requestPointerLock();
            }
            if (e.code === 'Digit1') this.setSquadOrder('ADVANCE');
            if (e.code === 'Digit2') this.setSquadOrder('HOLD');
            if (e.code === 'Digit3') this.setSquadOrder('REGROUP');
            if (e.code === 'KeyJ') {
                this.spawnPanther();
            }
            if (e.code === 'KeyK') {
                this.callAirstrike();
            }
        });

        const btnResume = document.getElementById('btn-resume');
        if (btnResume) btnResume.addEventListener('click', () => this.resumeGame());

        document.addEventListener('mousedown', () => {
            if (!document.pointerLockElement && !document.getElementById('start-overlay') && !this.isPaused && !this.gameOver) {
                this.player.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            if (!document.pointerLockElement) {
                this._lockLostTime = Date.now();
                if (!document.getElementById('start-overlay') && !this.gameOver && !this.isPaused) {
                    this.showPause();
                }
            }
        });
    }

    createStartOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'start-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:2000;display:flex;flex-direction:column;justify-content:center;align-items:center;color:#ff0;font-family:monospace;cursor:pointer;gap:1rem;';
        overlay.innerHTML = `
            <h1 style="font-size:5rem;margin:0;letter-spacing:12px;text-shadow:0 0 30px rgba(255,255,0,0.4)">ARTHURIA</h1>
            <div style="letter-spacing:8px;opacity:0.6;font-size:1rem">WW2 FRONTLINES</div>
            <div style="margin-top:2rem;border:1px solid #ff0;padding:166px 48px;font-size:1.2rem;letter-spacing:4px">CLICK TO DEPLOY</div>
            <div style="font-size:0.65rem;opacity:0.4;margin-top:1rem;letter-spacing:2px;text-align:center">WASD MOVE &nbsp;·&nbsp; SHIFT SPRINT &nbsp;·&nbsp; SPACE JUMP &nbsp;·&nbsp; F BANDAGE &nbsp;·&nbsp; V SQUAD &nbsp;·&nbsp; ESC PAUSE</div>
        `;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', () => {
            overlay.remove();
            this.player.requestPointerLock();
            this.audio.startAmbient();
            this.animate();
        });
    }

    togglePause() { this.isPaused ? this.resumeGame() : this.showPause(); }

    showPause() {
        this.isPaused = true;
        document.getElementById('esc-menu').classList.remove('hidden');
        document.exitPointerLock();
    }

    resumeGame() {
        this.isPaused = false;
        document.getElementById('esc-menu').classList.add('hidden');
        this.player.requestPointerLock();
        this.clock.getDelta(); 
    }

    setSquadOrder(order) {
        document.getElementById('command-menu').classList.remove('active');
        this.showNotification(`SQUAD: ${order}`);
        if (!this.isPaused && !this.gameOver) this.player.requestPointerLock();
    }

    spawnPanther() {
        // Implementation omitted for brevity as per instructions to only fix requested items
    }

    callAirstrike() {
        if (!this.player || this.isPaused || this.gameOver) return;
        
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.player.camera.quaternion);
        const targetPos = new THREE.Vector3().copy(this.player.body.position).add(forward.multiplyScalar(60));
        targetPos.y = this.terrain.getHeight(targetPos.x, targetPos.z);

        this.showNotification("AIRSTRIKE INBOUND");
        this.audio.play('airstrike_siren');

        for (let i = 0; i < 10; i++) {
            this.addTimer(2.0 + i * 0.3, () => {
                const offset = new THREE.Vector3((Math.random()-0.5)*40, 0, (Math.random()-0.5)*40);
                const explosionPos = targetPos.clone().add(offset);
                explosionPos.y = this.terrain.getHeight(explosionPos.x, explosionPos.z);
                VFX.createExplosion(this.scene, this.world, explosionPos, 20, 500, this.audio);
            });
        }
    }

    addTimer(duration, callback) {
        this.timers.push({ duration, remaining: duration, callback });
    }

    addRagdolls(ragdolls) {
        this.ragdolls.push(...ragdolls);
    }
    
    onBaseDestroyed(isEnemyBase) {
        this.endGame(isEnemyBase);
    }

    onEnemyKilled(enemy) {
        this.killCount++;
        document.getElementById('sb-kills').textContent = this.killCount;
        this.showKillFeed('<span class="player">YOU</span> neutralized <span class="enemy">ENEMY</span>');
        this.showNotification('+100 XP · ENEMY DOWN');
        
        const allEnemiesDead = this.enemies.every(e => e.isDead);
        if (allEnemiesDead) {
            this.addTimer(1.2, () => this.endGame(true));
        }
    }

    endGame(victory) {
        if (this.gameOver) return;
        this.gameOver = true;
        document.exitPointerLock();
        document.getElementById('sb-mission-result').textContent = victory ? 'ALLIED VICTORY' : 'MISSION FAILED';
        document.getElementById('sb-kills').textContent = this.killCount;
        document.getElementById('sb-caps').textContent = victory ? '1' : '0';
        document.getElementById('sb-xp').textContent = this.killCount * 100 + (victory ? 500 : 0);
        document.getElementById('scoreboard-overlay').classList.add('active');
    }

    showKillFeed(msg) {
        const feed = document.getElementById('kill-feed');
        const el = document.createElement('div');
        el.className = 'kill-msg';
        el.innerHTML = msg;
        feed.prepend(el);
        this.addTimer(4, () => el.remove());
    }

    showNotification(msg) {
        const el = document.createElement('div');
        el.className = 'xp-popup';
        el.textContent = msg;
        const notifyContainer = document.getElementById('tactical-notify');
        if (notifyContainer) {
            notifyContainer.appendChild(el);
            this.addTimer(1.5, () => el.remove());
        }
    }

    updateFog() {
        const p = this.player.body.position;
        const terrainH = this.terrain.getHeight(p.x, p.z);
        const heightAbove = Math.max(0, p.y - terrainH);
        this.scene.fog.density = 0.007 - Math.min(heightAbove / 60, 1) * 0.004;
    }

    updateCompass() {
        const offset = (-this.player.yaw / (Math.PI * 2)) * 800;
        const tape = document.getElementById('compass-tape');
        if (tape) tape.style.transform = `translateX(calc(-50% + ${offset}px))`;
    }

    updateWaypoints() {
        const pp = new THREE.Vector3(this.player.body.position.x, this.player.body.position.y, this.player.body.position.z);
        const cam = this.player.camera;
        const project = (worldPos, id) => {
            const el = document.getElementById(id);
            if (!el) return;
            const v = worldPos.clone().project(cam);
            const inFront = v.z < 1;
            el.querySelector('.dist').textContent = Math.round(pp.distanceTo(worldPos)) + 'm';
            el.style.display = inFront ? 'block' : 'none';
            el.style.left = Math.max(50, Math.min(window.innerWidth - 50, (v.x * .5 + .5) * window.innerWidth)) + 'px';
            el.style.top = Math.max(50, Math.min(window.innerHeight - 50, (-.5 * v.y + .5) * window.innerHeight)) + 'px';
        };
        project(new THREE.Vector3(0, 10, -350), 'wp-hq');
        project(new THREE.Vector3(0, 10, 100), 'wp-base');
    }

    onWindowResize() {
        this.player.camera.aspect = window.innerWidth / window.innerHeight;
        this.player.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        if (this.isPaused || this.gameOver) return;

        const delta = Math.min(this.clock.getDelta(), 0.05);
        this.elapsedTime += delta;
        
        for (let i = this.timers.length - 1; i >= 0; i--) {
            const timer = this.timers[i];
            timer.remaining -= delta;
            if (timer.remaining <= 0) {
                timer.callback();
                this.timers.splice(i, 1);
            }
        }
        
        this.world.step(1 / 60, delta, 3);

        for (let i = this.ragdolls.length - 1; i >= 0; i--) {
            const ragdoll = this.ragdolls[i];
            ragdoll.life -= delta;
            if (ragdoll.life <= 0 || (ragdoll.body.sleepState === CANNON.Body.SLEEPING)) {
                this.world.removeBody(ragdoll.body);
                this.scene.remove(ragdoll.mesh);
                if (ragdoll.mesh.geometry) ragdoll.mesh.geometry.dispose();
                if (ragdoll.mesh.material) ragdoll.mesh.material.dispose();
                this.ragdolls.splice(i, 1);
            } else {
                ragdoll.mesh.position.copy(ragdoll.body.position);
                ragdoll.mesh.quaternion.copy(ragdoll.body.quaternion);
            }
        }

        if (this.vegetation) this.vegetation.update(delta, this.player.body.position);
        this.particles.update(delta, this.player.camera);
        this.particles.updateRain(delta, this.player.camera);
        this.projectiles.update(delta);
        this.player.update(delta);
        
        // --- VFX Update (Centralized delta-time based) ---
        VFX.update(delta);

        const pp = this.player.body.position;
        this.enemies.forEach(e => e.update(delta, pp, this.player));

        if(this.modernTank && this.modernTank !== this.player.drivingTank) this.modernTank.update(delta, this.player);
        this.spawnedTanks.forEach(t => {
            if (t !== this.player.drivingTank) t.update(delta, this.player);
        });
        
        this.chickens.forEach(c => c.update(delta, pp));

        this.updateFog();
        this.updateCompass();
        this.updateWaypoints();

        this.renderer.render(this.scene, this.player.camera);

        if (this.minimapRenderer) {
            this.minimapCamera.position.x = pp.x;
            this.minimapCamera.position.z = pp.z;
            this.minimapRenderer.render(this.scene, this.minimapCamera);
        }
    }
}

new Game();

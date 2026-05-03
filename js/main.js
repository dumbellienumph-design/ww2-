import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Player } from './player.js';
import { Terrain } from './terrain.js';
import { ParticleSystem } from './particles.js';
import { Vegetation } from './vegetation.js';
import { Enemy } from './enemy.js';
import { Base } from './base.js';
import { GameAudio } from './audio.js';

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
        this.fogColor = new THREE.Color(0x5a5e5b);
        this.scene.background = this.fogColor.clone();
        this.scene.fog = new THREE.FogExp2(this.fogColor.clone(), 0.004);

        this.world = new CANNON.World();
        this.world.gravity.set(0, -25, 0);

        this.enemies = [];
        this.killCount = 0;
        this.isPaused = false;
        this.gameOver = false;

        this.audio = new GameAudio();

        this.initWorld();
        this.initUI();
        this.initMinimap();
        this.initCompass();

        window.addEventListener('resize', () => this.onWindowResize());
        this.clock = new THREE.Clock();
        this.createStartOverlay();
    }

    initWorld() {
        this.terrain = new Terrain(this.scene, this.world);
        this.initLights();
        this.vegetation = new Vegetation(this.scene, this.world, this.terrain);
        this.particles = new ParticleSystem(this.scene);

        this.player = new Player(this.scene, this.world, this.renderer.domElement, this.audio, this.particles);

        // Allied base (south/spawn side) and enemy base (north/objective)
        new Base(this.scene, this.world, new THREE.Vector3(0, 0, 100), null, this.particles, this.terrain, false);
        new Base(this.scene, this.world, new THREE.Vector3(0, 0, -350), null, this.particles, this.terrain, true);

        // Spawn 5 enemies near enemy base
        const spawnPts = [[-40, -270], [40, -290], [-90, -330], [90, -310], [0, -380]];
        spawnPts.forEach(([x, z]) => {
            const y = this.terrain.getHeight(x, z) + 1;
            const e = new Enemy(this.scene, this.world, new THREE.Vector3(x, y, z));
            e.terrain = this.terrain;
            this.enemies.push(e);
        });

        this.player.body.position.set(0, this.terrain.getHeight(0, 0) + 2, 0);
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
        });

        const btnResume = document.getElementById('btn-resume');
        if (btnResume) btnResume.addEventListener('click', () => this.resumeGame());

        document.addEventListener('mousedown', () => {
            if (!document.pointerLockElement && !document.getElementById('start-overlay') && !this.isPaused && !this.gameOver) {
                this.player.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            if (!document.pointerLockElement && !document.getElementById('start-overlay') && !this.gameOver && !this.isPaused) {
                this.showPause();
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
            <div style="margin-top:2rem;border:1px solid #ff0;padding:16px 48px;font-size:1.2rem;letter-spacing:4px">CLICK TO DEPLOY</div>
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
        this.clock.getDelta(); // discard accumulated delta during pause
    }

    setSquadOrder(order) {
        document.getElementById('command-menu').classList.remove('active');
        this.showNotification(`SQUAD: ${order}`);
        if (!this.isPaused && !this.gameOver) this.player.requestPointerLock();
    }

    onEnemyKilled() {
        this.killCount++;
        document.getElementById('sb-kills').textContent = this.killCount;
        this.showKillFeed('<span class="player">YOU</span> neutralized <span class="enemy">ENEMY</span>');
        this.showNotification('+100 XP · ENEMY DOWN');
        if (this.killCount >= 5) setTimeout(() => this.endGame(true), 1200);
    }

    endGame(victory) {
        if (this.gameOver) return;
        this.gameOver = true;
        document.exitPointerLock();
        document.getElementById('sb-mission-result').textContent = victory ? 'ALLIED VICTORY' : 'MISSION FAILED';
        document.getElementById('sb-kills').textContent = this.killCount;
        document.getElementById('sb-caps').textContent = victory ? '1' : '0';
        document.getElementById('sb-xp').textContent = this.killCount * 100;
        document.getElementById('scoreboard-overlay').classList.add('active');
    }

    showKillFeed(msg) {
        const feed = document.getElementById('kill-feed');
        const el = document.createElement('div');
        el.className = 'kill-msg';
        el.innerHTML = msg;
        feed.prepend(el);
        setTimeout(() => el.remove(), 4000);
    }

    showNotification(msg) {
        const el = document.createElement('div');
        el.className = 'xp-popup';
        el.textContent = msg;
        document.getElementById('tactical-notify').appendChild(el);
        setTimeout(() => el.remove(), 1500);
    }

    updateFog() {
        const p = this.player.body.position;
        const terrainH = this.terrain.getHeight(p.x, p.z);
        const heightAbove = Math.max(0, p.y - terrainH);
        // Higher elevation = less fog
        this.scene.fog.density = 0.007 - Math.min(heightAbove / 60, 1) * 0.004;
    }

    updateCompass() {
        // Each full rotation = 800px on the tape
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
        this.world.step(1 / 60, delta, 3);

        if (this.vegetation) this.vegetation.update(delta);
        this.particles.update(delta, this.player.camera);
        this.player.update(delta, this.terrain);

        const pp = new THREE.Vector3(this.player.body.position.x, this.player.body.position.y, this.player.body.position.z);
        this.enemies.forEach(e => e.update(delta, pp, this.player));

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

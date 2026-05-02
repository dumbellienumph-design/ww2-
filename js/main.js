import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Player } from './player.js';
import { Terrain } from './terrain.js';
import { Vegetation } from './vegetation.js';
import { ParticleSystem } from './particles.js';

class Game {
    constructor() {
        window.game = this;
        this.canvas = document.querySelector('#game-canvas');
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1c1a);
        this.scene.fog = new THREE.FogExp2(0x1a1c1a, 0.002);
        
        this.world = new CANNON.World();
        this.world.gravity.set(0, -25, 0); // Stronger gravity for grounded feel

        this.initWorld();
        this.initUI();
        
        window.addEventListener('resize', () => this.onWindowResize());
        this.clock = new THREE.Clock();
        this.createStartOverlay();
    }

    createStartOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'start-overlay';
        overlay.style = 'position:fixed; top:0; left:0; width:100%; height:100%; background:#000; z-index:2000; display:flex; justify-content:center; align-items:center; color:#ff0; font-family:monospace; cursor:pointer;';
        overlay.innerHTML = '<h1 style="letter-spacing:10px;">CLICK TO EXPLORE</h1>';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', () => {
            overlay.remove();
            this.player.requestPointerLock();
            this.animate();
        });
    }

    initUI() {
        document.addEventListener('mousedown', () => {
            if (!document.pointerLockElement && !document.getElementById('start-overlay')) {
                this.player.requestPointerLock();
            }
        });
    }

    initWorld() {
        this.terrain = new Terrain(this.scene, this.world);
        this.initLights();
        this.vegetation = new Vegetation(this.scene, this.world, this.terrain);
        this.particles = new ParticleSystem(this.scene);
        
        this.player = new Player(this.scene, this.world, this.renderer.domElement, null, this.particles);
        
        // --- SAFE SPAWN ---
        const startX = 0, startZ = 0;
        const startY = this.terrain.getHeight(startX, startZ) + 5;
        this.player.body.position.set(startX, startY, startZ);
    }

    initLights() {
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
        const sun = new THREE.DirectionalLight(0xffffff, 1.2);
        sun.position.set(100, 300, 100);
        sun.castShadow = true;
        sun.shadow.camera.left = -500;
        sun.shadow.camera.right = 500;
        sun.shadow.camera.top = 500;
        sun.shadow.camera.bottom = -500;
        sun.shadow.camera.far = 2000;
        sun.shadow.mapSize.set(2048, 2048);
        this.scene.add(sun);
    }

    onWindowResize() {
        this.player.camera.aspect = window.innerWidth / window.innerHeight;
        this.player.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        let delta = Math.min(this.clock.getDelta(), 0.05);
        
        // --- GLOBAL TIME SCALE ---
        // Multiplies the speed of physics, movement, and animations
        const timeScale = 1.4;
        delta *= timeScale;

        // --- PHYSICS STABILITY FIX ---
        this.world.step(1/60, delta, 10);
        
        if (this.vegetation) this.vegetation.update(delta);
        this.particles.update(delta, this.player.camera);

        this.player.update(delta, this.terrain);

        this.renderer.render(this.scene, this.player.camera);
    }
}
new Game();

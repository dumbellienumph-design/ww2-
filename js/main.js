import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Player } from './player.js';
import { Terrain } from './terrain.js';
import { ParticleSystem } from './particles.js';
import { Vegetation } from './vegetation.js';
import { ModernTank } from './modern-tank.js';

class Game {
    constructor() {
        window.game = this;
        this.canvas = document.querySelector('#game-canvas');
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = false;

        this.scene = new THREE.Scene();
        // Overcast/Battleship Grey Atmosphere
        const overcastColor = 0x5a5e5b;
        this.scene.background = new THREE.Color(overcastColor);
        this.scene.fog = new THREE.FogExp2(overcastColor, 0.002);

        this.world = new CANNON.World();
        this.world.gravity.set(0, -25, 0);

        this.initWorld();
        this.initUI();
        this.initMinimap();

        window.addEventListener('resize', () => this.onWindowResize());
        this.clock = new THREE.Clock();
        this.createStartOverlay();
    }

    initMinimap() {
        this.minimapCanvas = document.querySelector('#minimap-canvas');
        if (!this.minimapCanvas) return;
        this.minimapRenderer = new THREE.WebGLRenderer({ canvas: this.minimapCanvas, antialias: true });
        this.minimapRenderer.setSize(200, 200);
        
        this.minimapCamera = new THREE.OrthographicCamera(-150, 150, 150, -150, 0.1, 1000);
        this.minimapCamera.position.set(0, 500, 0);
        this.minimapCamera.lookAt(0, 0, 0);
        this.minimapCamera.layers.enable(1); 
    }

    createStartOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'start-overlay';
        overlay.style = 'position:fixed; top:0; left:0; width:100%; height:100%; background:#000; z-index:2000; display:flex; justify-content:center; align-items:center; color:#ff0; font-family:monospace; cursor:pointer;';
        overlay.innerHTML = '<h1 style="letter-spacing:10px;">CLICK TO EXPLORE</h1>';
        document.body.appendChild(overlay);
        
        const start = () => {
            overlay.remove();
            this.player.requestPointerLock();
            this.animate();
            window.removeEventListener('click', start);
        };
        overlay.addEventListener('click', start);
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
        
        // --- MODERN MBT SPAWN (30 METERS ABOVE GROUND) ---
        const tankX = 0, tankZ = -20;
        const tankY = this.terrain.getHeight(tankX, tankZ) + 30.0; // 30 METERS ABOVE GROUND
        this.modernTank = new ModernTank(this.scene, this.world, new THREE.Vector3(tankX, tankY, tankZ), null, this.particles);

        // --- PLAYER SPAWN ---
        const startX = 0, startZ = 0;
        const playerSpawnY = this.terrain.getHeight(startX, startZ);
        this.player.body.position.set(startX, playerSpawnY + 2.0, startZ); 
    }

    initLights() {
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const sun = new THREE.DirectionalLight(0xffffff, 0.6);
        sun.position.set(100, 300, 100);
        sun.castShadow = true;
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
        delta *= 1.4;
        this.world.step(1/60, delta, 50); // High precision
        if (this.vegetation) this.vegetation.update(delta);
        this.particles.update(delta, this.player.camera);
        this.player.update(delta, this.terrain);
        if (this.modernTank) {
            this.modernTank.update(delta, { forward: false, backward: false, left: false, right: false, shoot: false }, this.player.camera);
        }
        this.renderer.render(this.scene, this.player.camera);
        if (this.minimapRenderer && this.minimapCamera) {
            this.minimapCamera.position.x = this.player.body.position.x;
            this.minimapCamera.position.z = this.player.body.position.z;
            this.minimapRenderer.render(this.scene, this.minimapCamera);
        }
    }
}
new Game();

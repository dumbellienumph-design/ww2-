import * as THREE from 'three';
import { Tank } from './tank.js';

export class PantherTank extends Tank {
    constructor(scene, world, terrain, position, audio, particles) {
        super(scene, world, terrain, position, audio, particles);
    }
    initVisuals() {
        const textureLoader = new THREE.TextureLoader();
        // Base path for Panther textures
        const texPath = 'models/panther/';
        
        const mainTex = textureLoader.load(texPath + 'pantherA.jpg');
        const wheelTex = textureLoader.load(texPath + 'panther_OuterW.jpg');
        const treadTex = textureLoader.load(texPath + 'panther_tread.jpg');

        const pantherMaterial = new THREE.MeshStandardMaterial({ map: mainTex, roughness: 0.8, metalness: 0.2 });
        const wheelMaterial = new THREE.MeshStandardMaterial({ map: wheelTex });
        const treadMaterial = new THREE.MeshStandardMaterial({ map: treadTex });
        const darkSteel = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.4 });

        const vOffset = -0.5;
        this.group.clear();

        // Hull - Sloped like a Panther
        const hullGroup = new THREE.Group();
        hullGroup.position.y = 0.6 + vOffset;
        this.group.add(hullGroup);

        const hullMain = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.2, 7.5), pantherMaterial);
        hullGroup.add(hullMain);

        const glacis = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.4, 3.5), pantherMaterial);
        glacis.rotation.x = -0.7;
        glacis.position.set(0, 0.6, -3.2);
        hullGroup.add(glacis);

        // Tracks/Wheels
        const trackL = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 8.0), treadMaterial);
        trackL.position.set(-2.0, -0.2, 0);
        hullGroup.add(trackL);
        const trackR = trackL.clone();
        trackR.position.x = 2.0;
        hullGroup.add(trackR);

        // Turret
        this.turretGroup = new THREE.Group();
        this.turretGroup.position.set(0, 1.6 + vOffset, 0);
        this.group.add(this.turretGroup);

        const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 1.0, 8), pantherMaterial);
        this.turretGroup.add(turretBase);

        const mantlet = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.8, 16), darkSteel);
        mantlet.rotation.z = Math.PI / 2;
        mantlet.position.set(0, 0, -1.8);
        this.turretGroup.add(mantlet);

        // Barrel
        this.barrelGroup = new THREE.Group();
        this.barrelGroup.position.set(0, 0, -1.8);
        this.turretGroup.add(this.barrelGroup);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 6.0), darkSteel);
        barrel.rotateX(Math.PI / 2);
        barrel.position.z = -3.0;
        this.barrelGroup.add(barrel);

        const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 12), darkSteel);
        muzzle.rotateX(Math.PI / 2);
        muzzle.position.z = -6.0;
        this.barrelGroup.add(muzzle);

        this.group.layers.enable(1);
        this.group.traverse(child => {
            child.layers.enable(1);
        });
    }
}

import * as THREE from 'three';
import { Tank } from './tank.js';

export class ModernTank extends Tank {
    constructor(scene, world, terrain, position, audio, particles) {
        super(scene, world, terrain, position, audio, particles);
    }
    initVisuals() {
        // Materials as per description
        const matteGrey = new THREE.MeshStandardMaterial({ 
            color: 0x888899, // Battleship/Steel grey
            roughness: 0.9, 
            metalness: 0.2 
        });
        const darkRubber = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0, metalness: 0.0 });
        const sensorGlass = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x002222, roughness: 0.1 });
        const crewSkin = new THREE.MeshStandardMaterial({ color: 0xd2b48c });
        const crewHair = new THREE.MeshStandardMaterial({ color: 0x221100 }); // Dark hair

        const vOffset = -0.5;
        
        this.group.clear(); // Clear default visuals
        
        // --- HULL (Extremely Angular/Faceted) ---
        const hullGroup = new THREE.Group();
        hullGroup.position.y = 0.6 + vOffset;
        this.group.add(hullGroup);

        // Main hull box
        const hullMainGeo = new THREE.BoxGeometry(5.2, 1.2, 8.5);
        const hullMain = new THREE.Mesh(hullMainGeo, matteGrey);
        hullGroup.add(hullMain);

        // Sharply raked glacis plate (front)
        const glacisGeo = new THREE.BoxGeometry(5.2, 0.2, 3.5);
        const glacis = new THREE.Mesh(glacisGeo, matteGrey);
        glacis.rotation.x = -0.6;
        glacis.position.set(0, 0.6, -3.8);
        hullGroup.add(glacis);

        // Angled side skirts (multi-layered aesthetic)
        const skirtGeo = new THREE.BoxGeometry(0.3, 0.8, 8.8);
        const skirtL = new THREE.Mesh(skirtGeo, matteGrey);
        skirtL.position.set(-2.7, -0.2, 0);
        hullGroup.add(skirtL);
        const skirtR = skirtL.clone();
        skirtR.position.x = 2.7;
        hullGroup.add(skirtR);

        // Tracks (Visible below skirts)
        const trackGeo = new THREE.BoxGeometry(1.0, 0.6, 8.2);
        const trackL = new THREE.Mesh(trackGeo, darkRubber);
        trackL.position.set(-2.1, -0.4, 0);
        hullGroup.add(trackL);
        const trackR = trackL.clone();
        trackR.position.x = 2.1;
        hullGroup.add(trackR);

        // --- TURRET (Large, Low-profile, Trapezoidal) ---
        this.turretGroup = new THREE.Group();
        this.turretGroup.position.set(0, 1.3 + vOffset, -0.5);
        this.group.add(this.turretGroup);

        // Main Turret Body (Trapezoidal look via scaling or custom geo - using boxes for now)
        const turretMainGeo = new THREE.BoxGeometry(3.8, 0.8, 5.5);
        const turretMain = new THREE.Mesh(turretMainGeo, matteGrey);
        this.turretGroup.add(turretMain);

        // Recessed panels/vents on sides
        const ventGeo = new THREE.BoxGeometry(0.1, 0.4, 2.0);
        const ventL = new THREE.Mesh(ventGeo, darkRubber);
        ventL.position.set(-1.91, 0, 0);
        this.turretGroup.add(ventL);
        const ventR = ventL.clone();
        ventR.position.x = 1.91;
        this.turretGroup.add(ventR);

        // Flat top equipment (Laser rangefinder, Sensors, EW modules)
        const rangeFinder = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.5), matteGrey);
        rangeFinder.position.set(-1.2, 0.6, -1.5);
        this.turretGroup.add(rangeFinder);
        
        const sensorLens = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), sensorGlass);
        sensorLens.position.set(-1.2, 0.6, -1.76);
        this.turretGroup.add(sensorLens);

        const cylindricalSensor = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 12), matteGrey);
        cylindricalSensor.position.set(0, 0.8, 1.5);
        this.turretGroup.add(cylindricalSensor);

        const ewModule = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), matteGrey);
        ewModule.position.set(1.0, 0.7, 0.5);
        this.turretGroup.add(ewModule);

        // --- CREW (Driver/Commander Hatch Open) ---
        const hatchBase = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.1, 16), matteGrey);
        hatchBase.position.set(0.8, 0.45, -0.5);
        this.turretGroup.add(hatchBase);
        
        const hatchLid = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 16), matteGrey);
        hatchLid.position.set(0.8, 0.5, 0.1);
        hatchLid.rotation.x = 1.5;
        this.turretGroup.add(hatchLid);

        // Crew Member (Short dark hair, shoulders up)
        const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.3), darkRubber);
        shoulders.position.set(0.8, 0.4, -0.5);
        this.turretGroup.add(shoulders);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.22), crewSkin);
        head.position.set(0.8, 0.7, -0.5);
        this.turretGroup.add(head);

        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), crewHair);
        hair.position.set(0.8, 0.72, -0.5);
        this.turretGroup.add(hair);

        // --- GUN (Long, Smooth, Thick, Slightly Left) ---
        this.barrelGroup = new THREE.Group();
        this.barrelGroup.position.set(-0.4, 0.1, -2.5); // Slightly left of center
        this.turretGroup.add(this.barrelGroup);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 7.5), matteGrey);
        barrel.rotateX(Math.PI / 2);
        barrel.position.z = -3.75;
        this.barrelGroup.add(barrel);

        // Cylindrical muzzle brake/evacuator near tip
        const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.2, 16), darkRubber);
        muzzleBrake.rotateX(Math.PI / 2);
        muzzleBrake.position.z = -7.0;
        this.barrelGroup.add(muzzleBrake);

        // Anchors for Camera
        this.chaseCameraAnchor = new THREE.Object3D();
        this.chaseCameraAnchor.position.set(0, 6, 12);
        this.group.add(this.chaseCameraAnchor);
        this.sniperCameraAnchor = new THREE.Object3D();
        this.sniperCameraAnchor.position.set(0, 0.5, -1.0);
        this.turretGroup.add(this.sniperCameraAnchor);

        // Exhausts
        this.exhaustL = new THREE.Object3D(); this.exhaustL.position.set(-1.0, 1.0 + vOffset, 4.0); this.group.add(this.exhaustL);
        this.exhaustR = new THREE.Object3D(); this.exhaustR.position.set(1.0, 1.0 + vOffset, 4.0); this.group.add(this.exhaustR);
        
        this.group.layers.enable(1);
        this.group.traverse(child => {
            child.layers.enable(1);
        });
    }
}


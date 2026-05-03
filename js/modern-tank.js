import * as THREE from 'three';
import { Tank } from './tank.js';

export class ModernTank extends Tank {
    initVisuals() {
        const matteGrey = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9, metalness: 0.1 });
        const darkRubber = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0, metalness: 0.0 });
        const sensorGlass = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x002222, roughness: 0.1 });
        const crewSkin = new THREE.MeshStandardMaterial({ color: 0xd2b48c });

        const vOffset = -0.5;
        
        // Hull - Extremely Angular
        this.group.clear(); // Clear default visuals if any
        
        const hullGeo = new THREE.BoxGeometry(5.2, 1.2, 8.5);
        // Slanted front armor
        const hull = new THREE.Mesh(hullGeo, matteGrey);
        hull.position.y = 0.6 + vOffset;
        this.group.add(hull);

        const frontSlantGeo = new THREE.BoxGeometry(5.2, 0.8, 2.5);
        const frontSlant = new THREE.Mesh(frontSlantGeo, matteGrey);
        frontSlant.rotation.x = -0.4;
        frontSlant.position.set(0, 0.8 + vOffset, -3.8);
        this.group.add(frontSlant);

        // Tracks - Rubber Tracks
        const trackGeo = new THREE.BoxGeometry(0.8, 0.8, 8.8);
        const trackL = new THREE.Mesh(trackGeo, darkRubber);
        trackL.position.set(-2.2, 0.4 + vOffset, 0);
        this.group.add(trackL);
        const trackR = trackL.clone();
        trackR.position.x = 2.2;
        this.group.add(trackR);

        // Turret Group
        this.turretGroup = new THREE.Group();
        this.turretGroup.position.set(0, 1.4 + vOffset, -0.5);
        this.group.add(this.turretGroup);

        // Turret - Angular/Matte
        const turretGeo = new THREE.BoxGeometry(3.5, 1.0, 5.0);
        const turretMain = new THREE.Mesh(turretGeo, matteGrey);
        this.turretGroup.add(turretMain);

        const turretSideL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 4.0), matteGrey);
        turretSideL.position.set(-1.8, 0, 0);
        turretSideL.rotation.y = 0.1;
        this.turretGroup.add(turretSideL);
        const turretSideR = turretSideL.clone();
        turretSideR.position.x = 1.8;
        turretSideR.rotation.y = -0.1;
        this.turretGroup.add(turretSideR);

        // Open Hatch
        const hatchBase = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 16), matteGrey);
        hatchBase.position.set(0.8, 0.6, 0.5);
        this.turretGroup.add(hatchBase);
        
        const hatchLid = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16), matteGrey);
        hatchLid.position.set(0.8, 0.7, 1.0);
        hatchLid.rotation.x = 1.5;
        this.turretGroup.add(hatchLid);

        // Crew Member (Simple Head/Shoulders)
        const crewHead = new THREE.Mesh(new THREE.SphereGeometry(0.25), crewSkin);
        crewHead.position.set(0.8, 0.9, 0.5);
        this.turretGroup.add(crewHead);
        const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), darkRubber);
        helmet.position.set(0.8, 0.95, 0.5);
        this.turretGroup.add(helmet);

        // Complex Turret Sensors
        const sensorBox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.4), matteGrey);
        sensorBox.position.set(-1.0, 0.8, -1.0);
        this.turretGroup.add(sensorBox);
        const sensorLens = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.1), sensorGlass);
        sensorLens.position.set(-1.0, 0.9, -1.25);
        this.turretGroup.add(sensorLens);

        // Barrel Group
        this.barrelGroup = new THREE.Group();
        this.barrelGroup.position.set(0, 0.1, -2.5);
        this.turretGroup.add(this.barrelGroup);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 6.5), matteGrey);
        barrel.rotateX(Math.PI / 2);
        barrel.position.z = -3.25;
        this.barrelGroup.add(barrel);

        const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 12), darkRubber);
        muzzleBrake.rotateX(Math.PI / 2);
        muzzleBrake.position.z = -6.5;
        this.barrelGroup.add(muzzleBrake);

        // Anchors for Camera
        this.chaseCameraAnchor = new THREE.Object3D();
        this.chaseCameraAnchor.position.set(0, 6, 12);
        this.group.add(this.chaseCameraAnchor);
        this.sniperCameraAnchor = new THREE.Object3D();
        this.sniperCameraAnchor.position.set(0, 0.5, -1.0);
        this.turretGroup.add(this.sniperCameraAnchor);
        
        // Minimap Icon
        this.initMinimapIcon();
    }
}

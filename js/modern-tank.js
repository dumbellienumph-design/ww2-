import * as THREE from 'three';
import { Tank } from './tank.js';

export class ModernTank extends Tank {
    constructor(scene, world, terrain, position, audio, particles) {
        super(scene, world, terrain, position, audio, particles);
    }
    initVisuals() {
        const matteGrey = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.9, metalness: 0.2 });
        const darkRubber = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0, metalness: 0.0 });
        const whiteRubber = new THREE.MeshStandardMaterial({ color: 0xdddddd });
        const sensorGlass = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x002222, roughness: 0.1 });
        const crewSkin = new THREE.MeshStandardMaterial({ color: 0xd2b48c });
        const crewHair = new THREE.MeshStandardMaterial({ color: 0x221100 });

        const vOffset = -0.5;
        this.group.clear();
        
        // --- HULL ---
        const hullGroup = new THREE.Group();
        hullGroup.position.y = 0.6 + vOffset;
        this.group.add(hullGroup);

        const hullMain = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.2, 8.5), matteGrey);
        hullGroup.add(hullMain);

        const glacis = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.2, 3.5), matteGrey);
        glacis.rotation.x = -0.6;
        glacis.position.set(0, 0.6, -3.8);
        hullGroup.add(glacis);

        // Lower hull front wedge/chevron
        const chevron = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.6, 0.2), matteGrey);
        chevron.position.set(0, -0.3, -4.2);
        chevron.rotation.x = 0.3;
        hullGroup.add(chevron);

        const skirtL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 8.8), matteGrey);
        skirtL.position.set(-2.7, -0.2, 0);
        hullGroup.add(skirtL);
        const skirtR = skirtL.clone(); skirtR.position.x = 2.7; hullGroup.add(skirtR);

        // --- ROAD WHEELS (Refined with rims) ---
        const wheelTireGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 16);
        wheelTireGeo.rotateZ(Math.PI / 2);
        const wheelRimGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.32, 16);
        wheelRimGeo.rotateZ(Math.PI / 2);

        for (let i = 0; i < 6; i++) {
            const wz = -2.8 + i * 1.2;
            const wlGroup = new THREE.Group();
            wlGroup.position.set(-2.1, -0.4, wz);
            
            const tire = new THREE.Mesh(wheelTireGeo, darkRubber);
            const rim = new THREE.Mesh(wheelRimGeo, whiteRubber);
            wlGroup.add(tire);
            wlGroup.add(rim);
            
            hullGroup.add(wlGroup);
            const wrGroup = wlGroup.clone(); wrGroup.position.x = 2.1; hullGroup.add(wrGroup);
        }

        const trackL = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 8.2), darkRubber);
        trackL.position.set(-2.1, -0.4, 0);
        hullGroup.add(trackL);
        const trackR = trackL.clone(); trackR.position.x = 2.1; hullGroup.add(trackR);

        // --- CREW (Moved to Hull so they don't rotate with turret) ---
        const driverGroup = new THREE.Group();
        driverGroup.position.set(-0.8, 0.6, -1.5); // Positioned on hull
        hullGroup.add(driverGroup);

        const hatchBase = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.1, 16), matteGrey);
        hatchBase.position.y = 0.1;
        driverGroup.add(hatchBase);
        
        const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.3), darkRubber);
        shoulders.position.y = 0.3;
        driverGroup.add(shoulders);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.22), crewSkin);
        head.position.y = 0.6;
        driverGroup.add(head);

        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), crewHair);
        hair.position.y = 0.02; // relative to head
        head.add(hair); // Attached to head

        // --- TURRET (Trapezoidal) ---
        this.turretGroup = new THREE.Group();
        this.turretGroup.position.set(0, 1.3 + vOffset, -0.5);
        this.group.add(this.turretGroup);

        const turretGeo = new THREE.CylinderGeometry(2.5, 3.8, 0.8, 4);
        turretGeo.rotateY(Math.PI / 4);
        const turretMain = new THREE.Mesh(turretGeo, matteGrey);
        turretMain.scale.set(1.0, 1.0, 1.4);
        this.turretGroup.add(turretMain);

        // Recessed side vents
        const ventGeo = new THREE.BoxGeometry(0.1, 0.4, 2.0);
        const ventL = new THREE.Mesh(ventGeo, darkRubber);
        ventL.position.set(-1.9, 0, 0); this.turretGroup.add(ventL);
        const ventR = ventL.clone(); ventR.position.x = 1.9; this.turretGroup.add(ventR);
        
        // Additional vents
        const ventL2 = ventL.clone(); ventL2.position.z = 1.2; this.turretGroup.add(ventL2);
        const ventR2 = ventR.clone(); ventR2.position.z = 1.2; this.turretGroup.add(ventR2);

        // Detailed Equipment
        // Laser rangefinder (left)
        const rfGroup = new THREE.Group();
        rfGroup.position.set(-1.2, 0.6, -1.5);
        this.turretGroup.add(rfGroup);
        const rangeFinder = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.5), matteGrey);
        rfGroup.add(rangeFinder);
        const rfLens = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), sensorGlass);
        rfLens.position.set(0, 0, -0.26); rfGroup.add(rfLens);
        const rfDetail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.1), darkRubber);
        rfDetail.position.set(0.2, 0.15, -0.2); rfGroup.add(rfDetail);
        
        // Cylindrical sensor (center-rear)
        const sensorGroup = new THREE.Group();
        sensorGroup.position.set(0, 0.8, 1.5);
        this.turretGroup.add(sensorGroup);
        const cylindricalSensor = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 12), matteGrey);
        sensorGroup.add(cylindricalSensor);
        const sensorTop = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.1, 12), darkRubber);
        sensorTop.position.y = 0.4; sensorGroup.add(sensorTop);

        // EW modules
        const ewGroup = new THREE.Group();
        ewGroup.position.set(1.0, 0.7, 0.5);
        this.turretGroup.add(ewGroup);
        const ewModule = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), matteGrey);
        ewGroup.add(ewModule);
        const ewAntenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2), darkRubber);
        ewAntenna.position.set(0.2, 0.6, 0.2); ewGroup.add(ewAntenna);

        // --- GUN ---
        this.barrelGroup = new THREE.Group();
        this.barrelGroup.position.set(-0.4, 0.1, -2.5); 
        this.turretGroup.add(this.barrelGroup);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 7.5), matteGrey);
        barrel.rotateX(Math.PI / 2); barrel.position.z = -3.75;
        this.barrelGroup.add(barrel);

        const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.2, 16), darkRubber);
        muzzleBrake.rotateX(Math.PI / 2); muzzleBrake.position.z = -7.0;
        this.barrelGroup.add(muzzleBrake);

        // Anchors
        this.chaseCameraAnchor = new THREE.Object3D(); this.chaseCameraAnchor.position.set(0, 6, 12); this.group.add(this.chaseCameraAnchor);
        this.sniperCameraAnchor = new THREE.Object3D(); this.sniperCameraAnchor.position.set(0, 0.5, -1.0); this.turretGroup.add(this.sniperCameraAnchor);
        
        // Exhausts
        this.exhaustL = new THREE.Object3D(); this.exhaustL.position.set(-1.0, 1.0 + vOffset, 4.0); this.group.add(this.exhaustL);
        this.exhaustR = new THREE.Object3D(); this.exhaustR.position.set(1.0, 1.0 + vOffset, 4.0); this.group.add(this.exhaustR);

        // Minimap Icon
        const icon = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 6), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
        icon.position.y = 50; icon.layers.set(1); this.group.add(icon);

        this.group.layers.enable(1);
        this.group.traverse(child => { child.layers.enable(1); });

        // Idea 3: Antenna Physics - Setup
        this.antenna = ewAntenna;
        this.antennaTime = 0;
    }

    update(delta, controls, camera) {
        super.update(delta, controls, camera);
        if (this.isDestroyed) return;

        const ctrl = controls.moveState || controls;
        const isMoving = ctrl.forward || ctrl.backward || ctrl.left || ctrl.right;
        const speed = this.body.velocity.length();

        // Idea 1: Dynamic Exhaust
        this.exhaustTimer += delta;
        if (this.exhaustTimer > (isMoving ? 0.05 : 0.2)) {
            const worldPosL = new THREE.Vector3(); this.exhaustL.getWorldPosition(worldPosL);
            const worldPosR = new THREE.Vector3(); this.exhaustR.getWorldPosition(worldPosR);
            const smokeVel = new THREE.Vector3(0, 1.5, 2).applyQuaternion(this.group.quaternion);
            
            if (this.particles) {
                // Thicker smoke when moving or high throttle
                const isHeavy = isMoving || speed > 5;
                this.particles.createExhaustSmoke(worldPosL, smokeVel, isHeavy);
                this.particles.createExhaustSmoke(worldPosR, smokeVel, isHeavy);
            }
            this.exhaustTimer = 0;
        }

        // Idea 3: Antenna Sway
        this.antennaTime += delta * (speed * 0.5 + 1);
        this.antenna.rotation.z = Math.sin(this.antennaTime * 4) * 0.05 * (speed / 15 + 0.1);
        this.antenna.rotation.x = Math.cos(this.antennaTime * 3) * 0.03 * (speed / 15 + 0.1);

        // Idea 4: Tread Dust
        if (isMoving && speed > 2 && this.particles) {
            if (Math.random() > 0.7) {
                const dustPos = this.group.position.clone();
                dustPos.y += 0.5;
                // Simple dust puff
                this.particles.createExhaustSmoke(dustPos, new THREE.Vector3(0, 0.5, 0), false);
            }
        }
    }

    fire() {
        super.fire();
        // Idea 2: Muzzle Smoke
        if (this.particles) {
            const tip = new THREE.Vector3(0, 0, -8.0).applyMatrix4(this.barrelGroup.matrixWorld);
            const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.barrelGroup.getWorldQuaternion(new THREE.Quaternion()));
            // Spawn a lingering smoke cloud at the tip
            for(let i=0; i<5; i++) {
                const cloudVel = dir.clone().multiplyScalar(2).add(new THREE.Vector3((Math.random()-0.5)*2, (Math.random()-0.5)*2, (Math.random()-0.5)*2));
                this.particles.createExhaustSmoke(tip, cloudVel, true);
            }
        }
    }
}

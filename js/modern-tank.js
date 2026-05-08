import * as THREE from 'three';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { Tank } from './tank.js';

export class ModernTank extends Tank {
    constructor(scene, world, terrain, position, audio, particles, modelPath) {
        super(scene, world, terrain, position, audio, particles, modelPath);
        this.antennaTime = 0;
    }

    initVisuals() {
        this.antenna = new THREE.Object3D(); // Initialize early
        if (this.modelPath) {
            const loader = new GLTFLoader();
            loader.load(this.modelPath, (gltf) => {
                const model = gltf.scene;
                model.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        child.layers.enable(1);
                    }
                });

                model.scale.set(0.02, 0.02, 0.02);
                model.position.y = -0.5;
                this.group.add(model);

                model.traverse(child => {
                    if (child.name.toLowerCase().includes('turret')) this.turretGroup = child;
                    if (child.name.toLowerCase().includes('barrel') || child.name.toLowerCase().includes('gun')) this.barrelGroup = child;
                    if (child.name.toLowerCase().includes('antenna')) this.antenna = child;
                });

                if (!this.turretGroup) this.turretGroup = model;
                if (!this.barrelGroup) this.barrelGroup = this.turretGroup;

                this.chaseCameraAnchor = new THREE.Object3D();
                this.chaseCameraAnchor.position.set(0, 6, 12);
                this.group.add(this.chaseCameraAnchor);

                this.sniperCameraAnchor = new THREE.Object3D();
                this.sniperCameraAnchor.position.set(0, 0.5, -1.0);
                this.turretGroup.add(this.sniperCameraAnchor);
            });
        } else {
            this._fallbackVisuals();
        }
    }

    _fallbackVisuals() {
        const matteGrey = new THREE.MeshStandardMaterial({ 
            color: 0x3a3d3d, 
            roughness: 0.95, 
            metalness: 0.05 
        });
        const darkRubber = new THREE.MeshStandardMaterial({ 
            color: 0x0a0a0a, 
            roughness: 1.0, 
            metalness: 0.0 
        });
        const whiteRubber = new THREE.MeshStandardMaterial({ 
            color: 0x888888 
        });
        const sensorGlass = new THREE.MeshStandardMaterial({ 
            color: 0x004444, 
            emissive: 0x001111, 
            roughness: 0.1 
        });
        const crewSkin = new THREE.MeshStandardMaterial({ color: 0xd2b48c });
        const crewHair = new THREE.MeshStandardMaterial({ color: 0x221100 });

        const vOffset = -0.5;
        this.group.clear();
        
        const hullGroup = new THREE.Group();
        hullGroup.position.y = 0.6 + vOffset;
        this.group.add(hullGroup);

        const hullMain = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.2, 8.5), matteGrey);
        hullGroup.add(hullMain);

        const glacis = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.2, 3.5), matteGrey);
        glacis.rotation.x = -0.6;
        glacis.position.set(0, 0.6, -3.8);
        hullGroup.add(glacis);

        const chevron = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.6, 0.2), matteGrey);
        chevron.position.set(0, -0.3, -4.2);
        chevron.rotation.x = 0.3;
        hullGroup.add(chevron);

        const skirtL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 8.8), matteGrey);
        skirtL.position.set(-2.7, -0.2, 0);
        hullGroup.add(skirtL);
        const skirtR = skirtL.clone(); skirtR.position.x = 2.7; hullGroup.add(skirtR);

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

        const driverGroup = new THREE.Group();
        driverGroup.position.set(-0.8, 0.6, -1.5); 
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
        hair.position.y = 0.02; head.add(hair);

        this.turretGroup = new THREE.Group();
        this.turretGroup.position.set(0, 1.3 + vOffset, -0.5);
        this.group.add(this.turretGroup);

        const turretGeo = new THREE.CylinderGeometry(2.5, 3.8, 0.8, 4);
        turretGeo.rotateY(Math.PI / 4);
        const turretMain = new THREE.Mesh(turretGeo, matteGrey);
        turretMain.scale.set(1.0, 1.0, 1.4);
        this.turretGroup.add(turretMain);

        const ventGeo = new THREE.BoxGeometry(0.1, 0.4, 2.0);
        const ventL = new THREE.Mesh(ventGeo, darkRubber);
        ventL.position.set(-1.9, 0, 0); this.turretGroup.add(ventL);
        const ventR = ventL.clone(); ventR.position.x = 1.9; this.turretGroup.add(ventR);

        const rfGroup = new THREE.Group();
        rfGroup.position.set(-1.2, 0.6, -1.5);
        this.turretGroup.add(rfGroup);
        const rangeFinder = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.5), matteGrey);
        rfGroup.add(rangeFinder);
        const rfLens = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), sensorGlass);
        rfLens.position.set(0, 0, -0.26); rfGroup.add(rfLens);

        const sensorGroup = new THREE.Group();
        sensorGroup.position.set(0, 0.8, 1.5);
        this.turretGroup.add(sensorGroup);
        const cylindricalSensor = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 12), matteGrey);
        sensorGroup.add(cylindricalSensor);

        const ewGroup = new THREE.Group();
        ewGroup.position.set(1.0, 0.7, 0.5);
        this.turretGroup.add(ewGroup);
        const ewModule = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), matteGrey);
        ewGroup.add(ewModule);
        this.antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2), darkRubber);
        this.antenna.position.set(0.2, 0.6, 0.2); ewGroup.add(this.antenna);

        this.barrelGroup = new THREE.Group();
        this.barrelGroup.position.set(-0.4, 0.1, -2.5); 
        this.turretGroup.add(this.barrelGroup);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 7.5), matteGrey);
        barrel.rotateX(Math.PI / 2); barrel.position.z = -3.75;
        this.barrelGroup.add(barrel);

        const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.2, 16), darkRubber);
        muzzleBrake.rotateX(Math.PI / 2); muzzleBrake.position.z = -7.0;
        this.barrelGroup.add(muzzleBrake);

        this.chaseCameraAnchor = new THREE.Object3D(); this.chaseCameraAnchor.position.set(0, 6, 12); this.group.add(this.chaseCameraAnchor);
        this.sniperCameraAnchor = new THREE.Object3D(); this.sniperCameraAnchor.position.set(0, 0.5, -1.0); this.turretGroup.add(this.sniperCameraAnchor);
        
        this.exhaustL = new THREE.Object3D(); this.exhaustL.position.set(-1.0, 1.0 + vOffset, 4.0); this.group.add(this.exhaustL);
        this.exhaustR = new THREE.Object3D(); this.exhaustR.position.set(1.0, 1.0 + vOffset, 4.0); this.group.add(this.exhaustR);
    }

    update(delta, controls, camera) {
        super.update(delta, controls, camera);
        if (this.isDestroyed) return;

        const ctrl = controls.moveState || controls;
        const isMoving = ctrl.forward || ctrl.backward || ctrl.left || ctrl.right;
        const speed = this.body.velocity.length();

        this.exhaustTimer += delta;
        if (this.exhaustTimer > (isMoving ? 0.05 : 0.2)) {
            const worldPosL = new THREE.Vector3(); this.exhaustL.getWorldPosition(worldPosL);
            const worldPosR = new THREE.Vector3(); this.exhaustR.getWorldPosition(worldPosR);
            const smokeVel = new THREE.Vector3(0, 1.5, 2).applyQuaternion(this.group.quaternion);
            if (this.particles) {
                const isHeavy = isMoving || speed > 5;
                this.particles.createExhaustSmoke(worldPosL, smokeVel, isHeavy);
                this.particles.createExhaustSmoke(worldPosR, smokeVel, isHeavy);
            }
            this.exhaustTimer = 0;
        }

        if (this.antenna && this.antenna.rotation) {
            this.antennaTime += delta * (speed * 0.5 + 1);
            this.antenna.rotation.z = Math.sin(this.antennaTime * 4) * 0.05 * (speed / 15 + 0.1);
            this.antenna.rotation.x = Math.cos(this.antennaTime * 3) * 0.03 * (speed / 15 + 0.1);
        }
    }
}

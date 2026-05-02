import * as THREE from 'three';

export class Objective {
    constructor(scene, name, position, audio) {
        this.scene = scene;
        this.name = name;
        this.position = new THREE.Vector3(position.x, position.y, position.z);
        this.audio = audio;
        
        this.radius = 15;
        this.owner = 'neutral'; // neutral, allied, enemy
        this.progress = 0; // -100 (enemy) to 100 (allied)
        this.captureSpeed = 20;

        this.initVisuals();
    }

    initVisuals() {
        const flagPoleGeo = new THREE.CylinderGeometry(0.1, 0.1, 10);
        const flagPoleMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        this.pole = new THREE.Mesh(flagPoleGeo, flagPoleMat);
        this.pole.position.copy(this.position);
        this.pole.position.y += 5;
        this.scene.add(this.pole);

        const flagGeo = new THREE.PlaneGeometry(3, 2);
        this.flagMat = new THREE.MeshBasicMaterial({ color: 0x888888, side: THREE.DoubleSide });
        this.flag = new THREE.Mesh(flagGeo, this.flagMat);
        this.flag.position.set(1.5, 4, 0);
        this.pole.add(this.flag);

        const ringGeo = new THREE.RingGeometry(this.radius - 0.5, this.radius, 32);
        this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
        this.ring = new THREE.Mesh(ringGeo, this.ringMat);
        this.ring.rotation.x = -Math.PI / 2;
        this.ring.position.copy(this.position);
        this.ring.position.y = 0.1;
        this.scene.add(this.ring);
    }

    update(delta, allies, enemies) {
        let alliedIn = 0;
        let enemiesIn = 0;

        allies.forEach(a => {
            const pos = a.body ? a.body.position : a.position;
            if (this.position.distanceTo(new THREE.Vector3(pos.x, 0, pos.z)) < this.radius) alliedIn++;
        });

        enemies.forEach(e => {
            if (e.isDead) return;
            const pos = e.body.position;
            if (this.position.distanceTo(new THREE.Vector3(pos.x, 0, pos.z)) < this.radius) enemiesIn++;
        });

        if (alliedIn > 0 && enemiesIn === 0) {
            this.progress = Math.min(100, this.progress + this.captureSpeed * delta);
        } else if (enemiesIn > 0 && alliedIn === 0) {
            this.progress = Math.max(-100, this.progress - this.captureSpeed * delta);
        }

        const oldOwner = this.owner;
        if (this.progress >= 100) this.owner = 'allied';
        else if (this.progress <= -100) this.owner = 'enemy';
        else this.owner = 'neutral';

        if (this.owner !== oldOwner) {
            if (this.audio && typeof this.audio.play === 'function') this.audio.play('reinforcement');
            this.updateFlagColor();
        }

        this.flag.rotation.y += delta * 2;
    }

    updateFlagColor() {
        if (this.owner === 'allied') {
            this.flagMat.color.setHex(0x00ff00);
            this.ringMat.color.setHex(0x00ff00);
        } else if (this.owner === 'enemy') {
            this.flagMat.color.setHex(0xff0000);
            this.ringMat.color.setHex(0xff0000);
        } else {
            this.flagMat.color.setHex(0x888888);
            this.ringMat.color.setHex(0xffffff);
        }
    }
}
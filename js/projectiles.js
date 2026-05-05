import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

export class ProjectileManager {
    static bulletGeo = new THREE.SphereGeometry(0.1, 4, 4);
    static bulletMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
    static tracerGeo = new THREE.BoxGeometry(0.04, 0.04, 2.5);
    static tracerMat = new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true, opacity: 0.8 });
    static shellGeo = new THREE.CylinderGeometry(0.1, 0.3, 1.0, 8);
    static shellMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.5, roughness: 0.2 });

    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.projectiles = [];
    }

    spawnProjectile(startPos, dir, speed, damage, owner, isTracer = false, isShell = false) {
        if (isTracer) {
            this._spawnTracer(startPos, dir, speed, damage, owner);
        } else if (isShell) {
            this._spawnShell(startPos, dir, speed, damage, owner);
        } else {
            this._spawnPhysicsBullet(startPos, dir, speed, damage, owner);
        }
    }

    _spawnShell(startPos, dir, speed, damage, owner) {
        const shellBody = new CANNON.Body({
            mass: 25,
            shape: new CANNON.Sphere(0.4),
            position: new CANNON.Vec3(startPos.x, startPos.y, startPos.z),
            velocity: new CANNON.Vec3(dir.x * speed, dir.y * speed, dir.z * speed),
            collisionFilterGroup: 8,
            collisionFilterMask: -1 ^ 8
        });

        const shellMesh = new THREE.Mesh(ProjectileManager.shellGeo, ProjectileManager.shellMat);
        shellMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        shellMesh.position.copy(startPos);
        shellMesh.castShadow = true;
        this.scene.add(shellMesh);

        shellBody.userData = { 
            damage, 
            owner, 
            mesh: shellMesh, 
            life: 5.0, 
            isShell: true
        };

        shellBody.addEventListener("collide", (e) => {
            VFX.createExplosion(this.scene, this.world, shellBody.position.clone(), 15, damage, window.game?.audio);
            shellBody.userData.life = 0;
        });

        this.world.addBody(shellBody);
        this.projectiles.push(shellBody);
    }

    _spawnPhysicsBullet(startPos, dir, speed, damage, owner) {
        const body = new CANNON.Body({
            mass: 0.1,
            shape: new CANNON.Sphere(0.1),
            position: new CANNON.Vec3(startPos.x, startPos.y, startPos.z),
            velocity: new CANNON.Vec3(dir.x * speed, dir.y * speed, dir.z * speed),
            collisionFilterGroup: 8,
            collisionFilterMask: -1 ^ 8
        });

        const mesh = new THREE.Mesh(ProjectileManager.bulletGeo, ProjectileManager.bulletMat);
        mesh.position.copy(startPos);
        this.scene.add(mesh);

        body.userData = { damage, owner, mesh, life: 2.0 };

        body.addEventListener("collide", (e) => {
            const hitEntity = e.body.userData?.gameEntity;
            if (hitEntity && hitEntity !== owner && hitEntity.takeDamage) {
                hitEntity.takeDamage(damage);
            }
            VFX.createImpactVFX(this.scene, body.position, new THREE.Vector3().copy(e.contact.ni).negate());
            body.userData.life = 0;
        });

        this.world.addBody(body);
        this.projectiles.push(body);
    }

    _spawnTracer(startPos, dir, speed, damage, owner) {
        const tracer = new THREE.Mesh(ProjectileManager.tracerGeo, ProjectileManager.tracerMat);
        tracer.layers.set(1);
        tracer.position.copy(startPos);
        tracer.lookAt(startPos.clone().add(dir));
        this.scene.add(tracer);

        this.projectiles.push({
            isTracer: true,
            mesh: tracer,
            velocity: dir.clone().multiplyScalar(speed),
            life: 1.5
        });
    }

    update(delta) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            
            if (p instanceof CANNON.Body) {
                p.userData.life -= delta;
                const mesh = p.userData.mesh;
                
                if (p.userData.life <= 0) {
                    this.world.removeBody(p);
                    if (mesh) this.scene.remove(mesh);
                    this.projectiles.splice(i, 1);
                } else {
                    if (mesh) mesh.position.copy(p.position);
                }
            } else {
                p.life -= delta;
                if (p.life <= 0) {
                    this.scene.remove(p.mesh);
                    this.projectiles.splice(i, 1);
                } else {
                    p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
                }
            }
        }
    }

    destroy() {
        this.projectiles.forEach(p => {
            if (p instanceof CANNON.Body) {
                const mesh = p.userData.mesh;
                this.world.removeBody(p);
                if (mesh) this.scene.remove(mesh);
            } else {
                this.scene.remove(p.mesh);
            }
        });
        this.projectiles = [];
    }
}

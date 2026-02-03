import * as THREE from 'three';
import { clamp } from '../utils/math';

export class Camera {
    public camera: THREE.PerspectiveCamera;

    private pitch: number = 0;
    private yaw: number = 0;
    private sensitivity: number = 0.002;

    constructor(aspect: number) {
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.rotation.order = 'YXZ';
    }

    public rotate(deltaX: number, deltaY: number): void {
        this.yaw -= deltaX * this.sensitivity;
        this.pitch -= deltaY * this.sensitivity;

        // Clamp pitch to prevent flipping
        this.pitch = clamp(this.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);

        this.camera.rotation.x = this.pitch;
        this.camera.rotation.y = this.yaw;
    }

    public setPosition(x: number, y: number, z: number): void {
        this.camera.position.set(x, y, z);
    }

    public getForward(): THREE.Vector3 {
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.camera.quaternion);
        forward.y = 0;
        forward.normalize();
        return forward;
    }

    public getRight(): THREE.Vector3 {
        const right = new THREE.Vector3(1, 0, 0);
        right.applyQuaternion(this.camera.quaternion);
        right.y = 0;
        right.normalize();
        return right;
    }

    public getYaw(): number {
        return this.yaw;
    }

    public resize(aspect: number): void {
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
    }
}

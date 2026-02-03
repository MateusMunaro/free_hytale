import * as THREE from 'three';
import { Camera } from './Camera';
import { InputManager } from './InputManager';
import { World } from '../world/World';

export interface PlayerConfig {
    walkSpeed: number;
    sprintSpeed: number;
    jumpForce: number;
    gravity: number;
    eyeHeight: number;
    playerHeight: number;
    playerWidth: number;
    stepHeight: number; // Auto-step height like Minecraft
}

const DEFAULT_PLAYER_CONFIG: PlayerConfig = {
    walkSpeed: 4.3,
    sprintSpeed: 5.6,
    jumpForce: 8.5,
    gravity: 28,
    eyeHeight: 1.62,
    playerHeight: 1.8,
    playerWidth: 0.6,
    stepHeight: 0.6 // Can auto-climb blocks up to this height
};

interface AABB {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
}

export class Player {
    public position: THREE.Vector3;
    public velocity: THREE.Vector3;
    public camera: Camera;

    private inputManager: InputManager;
    private world: World;
    private config: PlayerConfig;
    private onGround: boolean = false;

    constructor(
        inputManager: InputManager,
        world: World,
        aspect: number,
        config: Partial<PlayerConfig> = {}
    ) {
        this.inputManager = inputManager;
        this.world = world;
        this.config = { ...DEFAULT_PLAYER_CONFIG, ...config };

        this.position = new THREE.Vector3(0, 80, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.camera = new Camera(aspect);

        this.spawnAtSurface();
    }

    private spawnAtSurface(): void {
        const height = this.world.getHeightAt(0, 0);
        this.position.y = height + 3;
    }

    public update(deltaTime: number): void {
        const input = this.inputManager.getState();

        // Limit delta time to prevent physics issues
        deltaTime = Math.min(deltaTime, 0.05);

        // Update camera rotation
        this.camera.rotate(input.mouseDeltaX, input.mouseDeltaY);
        this.inputManager.resetMouseDelta();

        // Calculate movement direction
        const moveDir = new THREE.Vector3();

        if (input.forward) moveDir.add(this.camera.getForward());
        if (input.backward) moveDir.sub(this.camera.getForward());
        if (input.right) moveDir.add(this.camera.getRight());
        if (input.left) moveDir.sub(this.camera.getRight());

        // Apply movement
        if (moveDir.lengthSq() > 0) {
            moveDir.normalize();
            const speed = input.sprint ? this.config.sprintSpeed : this.config.walkSpeed;

            // Ground movement is instant, air movement is slower
            if (this.onGround) {
                this.velocity.x = moveDir.x * speed;
                this.velocity.z = moveDir.z * speed;
            } else {
                // Air control (reduced)
                const airControl = 0.02;
                this.velocity.x += moveDir.x * speed * airControl;
                this.velocity.z += moveDir.z * speed * airControl;

                // Limit air speed
                const horizontalSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
                if (horizontalSpeed > speed) {
                    this.velocity.x = (this.velocity.x / horizontalSpeed) * speed;
                    this.velocity.z = (this.velocity.z / horizontalSpeed) * speed;
                }
            }
        } else if (this.onGround) {
            // Friction when grounded and not moving
            this.velocity.x *= 0.6;
            this.velocity.z *= 0.6;

            if (Math.abs(this.velocity.x) < 0.001) this.velocity.x = 0;
            if (Math.abs(this.velocity.z) < 0.001) this.velocity.z = 0;
        }

        // Jump
        if (input.jump && this.onGround) {
            this.velocity.y = this.config.jumpForce;
            this.onGround = false;
        }

        // Gravity
        this.velocity.y -= this.config.gravity * deltaTime;
        this.velocity.y = Math.max(this.velocity.y, -78); // Terminal velocity

        // Move with collision
        this.moveWithCollision(deltaTime);

        // Update camera
        this.camera.setPosition(
            this.position.x,
            this.position.y + this.config.eyeHeight,
            this.position.z
        );
    }

    private getPlayerAABB(x: number, y: number, z: number): AABB {
        const hw = this.config.playerWidth / 2;
        return {
            minX: x - hw,
            minY: y,
            minZ: z - hw,
            maxX: x + hw,
            maxY: y + this.config.playerHeight,
            maxZ: z + hw
        };
    }

    private getBlockAABB(bx: number, by: number, bz: number): AABB {
        return {
            minX: bx,
            minY: by,
            minZ: bz,
            maxX: bx + 1,
            maxY: by + 1,
            maxZ: bz + 1
        };
    }

    private aabbIntersects(a: AABB, b: AABB): boolean {
        return (
            a.minX < b.maxX && a.maxX > b.minX &&
            a.minY < b.maxY && a.maxY > b.minY &&
            a.minZ < b.maxZ && a.maxZ > b.minZ
        );
    }

    private getCollidingBlocks(aabb: AABB): Array<{ x: number; y: number; z: number }> {
        const blocks: Array<{ x: number; y: number; z: number }> = [];

        const minBX = Math.floor(aabb.minX);
        const maxBX = Math.floor(aabb.maxX);
        const minBY = Math.floor(aabb.minY);
        const maxBY = Math.floor(aabb.maxY);
        const minBZ = Math.floor(aabb.minZ);
        const maxBZ = Math.floor(aabb.maxZ);

        for (let bx = minBX; bx <= maxBX; bx++) {
            for (let by = minBY; by <= maxBY; by++) {
                for (let bz = minBZ; bz <= maxBZ; bz++) {
                    if (this.world.isBlockSolid(bx, by, bz)) {
                        const blockAABB = this.getBlockAABB(bx, by, bz);
                        if (this.aabbIntersects(aabb, blockAABB)) {
                            blocks.push({ x: bx, y: by, z: bz });
                        }
                    }
                }
            }
        }

        return blocks;
    }

    private moveWithCollision(deltaTime: number): void {
        // Move X axis
        this.position.x += this.velocity.x * deltaTime;
        this.resolveCollisionX();

        // Move Z axis
        this.position.z += this.velocity.z * deltaTime;
        this.resolveCollisionZ();

        // Try auto-step if we hit a wall
        if (this.velocity.x !== 0 || this.velocity.z !== 0) {
            this.tryAutoStep();
        }

        // Move Y axis
        const wasOnGround = this.onGround;
        this.position.y += this.velocity.y * deltaTime;
        this.resolveCollisionY();

        // Check if we landed
        if (!wasOnGround && this.onGround) {
            this.velocity.y = 0;
        }
    }

    private resolveCollisionX(): void {
        const aabb = this.getPlayerAABB(this.position.x, this.position.y, this.position.z);
        const blocks = this.getCollidingBlocks(aabb);

        for (const block of blocks) {
            const blockAABB = this.getBlockAABB(block.x, block.y, block.z);

            if (this.velocity.x > 0) {
                // Moving right, push left
                this.position.x = blockAABB.minX - this.config.playerWidth / 2 - 0.001;
            } else if (this.velocity.x < 0) {
                // Moving left, push right
                this.position.x = blockAABB.maxX + this.config.playerWidth / 2 + 0.001;
            }

            this.velocity.x = 0;
        }
    }

    private resolveCollisionZ(): void {
        const aabb = this.getPlayerAABB(this.position.x, this.position.y, this.position.z);
        const blocks = this.getCollidingBlocks(aabb);

        for (const block of blocks) {
            const blockAABB = this.getBlockAABB(block.x, block.y, block.z);

            if (this.velocity.z > 0) {
                // Moving forward, push back
                this.position.z = blockAABB.minZ - this.config.playerWidth / 2 - 0.001;
            } else if (this.velocity.z < 0) {
                // Moving back, push forward
                this.position.z = blockAABB.maxZ + this.config.playerWidth / 2 + 0.001;
            }

            this.velocity.z = 0;
        }
    }

    private resolveCollisionY(): void {
        const aabb = this.getPlayerAABB(this.position.x, this.position.y, this.position.z);
        const blocks = this.getCollidingBlocks(aabb);

        this.onGround = false;

        for (const block of blocks) {
            const blockAABB = this.getBlockAABB(block.x, block.y, block.z);

            if (this.velocity.y < 0) {
                // Falling, land on top
                this.position.y = blockAABB.maxY;
                this.velocity.y = 0;
                this.onGround = true;
            } else if (this.velocity.y > 0) {
                // Jumping, hit ceiling
                this.position.y = blockAABB.minY - this.config.playerHeight - 0.001;
                this.velocity.y = 0;
            }
        }

        // Extra ground check (look slightly below)
        if (!this.onGround && this.velocity.y <= 0) {
            const groundCheck = this.getPlayerAABB(
                this.position.x,
                this.position.y - 0.05,
                this.position.z
            );
            const groundBlocks = this.getCollidingBlocks(groundCheck);

            if (groundBlocks.length > 0) {
                // Snap to ground
                let highestBlock = groundBlocks[0].y;
                for (const block of groundBlocks) {
                    if (block.y > highestBlock) highestBlock = block.y;
                }
                this.position.y = highestBlock + 1;
                this.velocity.y = 0;
                this.onGround = true;
            }
        }
    }

    private tryAutoStep(): void {
        if (!this.onGround) return;

        // Check if there's a wall in front
        const moveDir = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
        if (moveDir.lengthSq() < 0.001) return;
        moveDir.normalize();

        const checkDist = 0.1;
        const testX = this.position.x + moveDir.x * checkDist;
        const testZ = this.position.z + moveDir.z * checkDist;

        // Check for collision at current height
        const currentAABB = this.getPlayerAABB(testX, this.position.y, testZ);
        const currentBlocks = this.getCollidingBlocks(currentAABB);

        if (currentBlocks.length === 0) return; // No wall, nothing to step

        // Try stepping up
        for (let stepY = 0.1; stepY <= this.config.stepHeight; stepY += 0.1) {
            const steppedAABB = this.getPlayerAABB(testX, this.position.y + stepY, testZ);
            const steppedBlocks = this.getCollidingBlocks(steppedAABB);

            if (steppedBlocks.length === 0) {
                // Can step up! Move player up
                this.position.y += stepY;
                this.position.x = testX;
                this.position.z = testZ;
                return;
            }
        }
    }

    public getPosition(): THREE.Vector3 {
        return this.position.clone();
    }

    public setPosition(x: number, y: number, z: number): void {
        this.position.set(x, y, z);
        this.camera.setPosition(x, y + this.config.eyeHeight, z);
    }

    public resize(aspect: number): void {
        this.camera.resize(aspect);
    }
}

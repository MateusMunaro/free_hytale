import * as THREE from 'three';
import { World } from '../world/World';
import { BlockType } from '../world/BlockTypes';
import { Inventory } from '../inventory/Inventory';
import { ItemCategory } from '../inventory/ItemTypes';
import { getVec3Pool } from '../utils/Vector3Pool';

/**
 * Block breaking configuration per block type
 */
interface BlockBreakData {
    baseTime: number;  // Base time to break in seconds
    toolRequired: boolean;
    preferredTool: 'pickaxe' | 'axe' | 'shovel' | 'none';
    drops: { itemId: number; quantity: number; chance: number }[];
}

const BLOCK_BREAK_DATA: Partial<Record<BlockType, BlockBreakData>> = {
    [BlockType.GRASS]: {
        baseTime: 0.6,
        toolRequired: false,
        preferredTool: 'shovel',
        drops: [{ itemId: BlockType.DIRT, quantity: 1, chance: 1 }]
    },
    [BlockType.DIRT]: {
        baseTime: 0.5,
        toolRequired: false,
        preferredTool: 'shovel',
        drops: [{ itemId: BlockType.DIRT, quantity: 1, chance: 1 }]
    },
    [BlockType.STONE]: {
        baseTime: 1.5,
        toolRequired: true,
        preferredTool: 'pickaxe',
        drops: [{ itemId: BlockType.COBBLESTONE, quantity: 1, chance: 1 }]
    },
    [BlockType.COBBLESTONE]: {
        baseTime: 1.5,
        toolRequired: true,
        preferredTool: 'pickaxe',
        drops: [{ itemId: BlockType.COBBLESTONE, quantity: 1, chance: 1 }]
    },
    [BlockType.WOOD]: {
        baseTime: 2.0,
        toolRequired: false,
        preferredTool: 'axe',
        drops: [{ itemId: BlockType.WOOD, quantity: 1, chance: 1 }]
    },
    [BlockType.LEAVES]: {
        baseTime: 0.2,
        toolRequired: false,
        preferredTool: 'none',
        drops: [{ itemId: 204, quantity: 1, chance: 0.05 }] // Chance for sticks
    },
    [BlockType.SAND]: {
        baseTime: 0.5,
        toolRequired: false,
        preferredTool: 'shovel',
        drops: [{ itemId: BlockType.SAND, quantity: 1, chance: 1 }]
    },
    [BlockType.GRAVEL]: {
        baseTime: 0.6,
        toolRequired: false,
        preferredTool: 'shovel',
        drops: [{ itemId: BlockType.GRAVEL, quantity: 1, chance: 1 }]
    },
    [BlockType.COAL_ORE]: {
        baseTime: 3.0,
        toolRequired: true,
        preferredTool: 'pickaxe',
        drops: [{ itemId: 200, quantity: 1, chance: 1 }] // Coal
    },
    [BlockType.IRON_ORE]: {
        baseTime: 3.0,
        toolRequired: true,
        preferredTool: 'pickaxe',
        drops: [{ itemId: BlockType.IRON_ORE, quantity: 1, chance: 1 }]
    },
    [BlockType.GOLD_ORE]: {
        baseTime: 3.0,
        toolRequired: true,
        preferredTool: 'pickaxe',
        drops: [{ itemId: BlockType.GOLD_ORE, quantity: 1, chance: 1 }]
    },
    [BlockType.DIAMOND_ORE]: {
        baseTime: 5.0,
        toolRequired: true,
        preferredTool: 'pickaxe',
        drops: [{ itemId: 203, quantity: 1, chance: 1 }] // Diamond
    },
    [BlockType.SNOW]: {
        baseTime: 0.2,
        toolRequired: false,
        preferredTool: 'shovel',
        drops: [{ itemId: BlockType.SNOW_BLOCK, quantity: 1, chance: 1 }]
    }
};

/**
 * Tool speed multipliers by tier
 */
const TOOL_SPEED_MULTIPLIERS: Record<number, number> = {
    100: 2,   // Wooden Pickaxe
    101: 4,   // Stone Pickaxe  
    102: 6,   // Iron Pickaxe
    103: 8,   // Diamond Pickaxe
    110: 1.5, // Wooden Sword
    111: 2,   // Stone Sword
    112: 3,   // Iron Sword
    113: 4    // Diamond Sword
};

/**
 * Mining/Block Breaking System
 */
export class MiningSystem {
    private world: World;
    private inventory: Inventory;
    private camera: THREE.Camera;

    private targetBlock: { x: number; y: number; z: number } | null = null;
    private breakProgress: number = 0;
    private maxBreakTime: number = 0;
    private isBreaking: boolean = false;

    private raycaster: THREE.Raycaster;
    private maxReach: number = 5; // Max block reach distance

    private onBreakProgressCallbacks: Array<(progress: number) => void> = [];
    private onBlockBrokenCallbacks: Array<(x: number, y: number, z: number, drops: { itemId: number; quantity: number }[]) => void> = [];

    constructor(world: World, inventory: Inventory, camera: THREE.Camera) {
        this.world = world;
        this.inventory = inventory;
        this.camera = camera;
        this.raycaster = new THREE.Raycaster();
    }

    /**
     * Update camera reference
     */
    public setCamera(camera: THREE.Camera): void {
        this.camera = camera;
    }

    /**
     * Get block at crosshair using raycasting
     * Uses Vector3Pool to avoid allocations
     */
    public getTargetBlock(): { x: number; y: number; z: number; face: THREE.Vector3 } | null {
        const pool = getVec3Pool();

        // Acquire vectors from pool instead of creating new ones
        const origin = pool.acquire();
        const direction = pool.acquire();
        const tempPos = pool.acquire();
        const stepVec = pool.acquire();

        try {
            // Cast ray from camera center
            this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

            origin.copy(this.raycaster.ray.origin);
            direction.copy(this.raycaster.ray.direction);

            // Step through the ray to find blocks
            const step = 0.1;

            for (let d = 0; d < this.maxReach; d += step) {
                stepVec.copy(direction).multiplyScalar(d);
                tempPos.copy(origin).add(stepVec);

                const bx = Math.floor(tempPos.x);
                const by = Math.floor(tempPos.y);
                const bz = Math.floor(tempPos.z);

                const block = this.world.getBlock(bx, by, bz);
                if (block !== BlockType.AIR && block !== BlockType.WATER && block !== BlockType.LAVA) {
                    // Calculate face normal - this one we return so it's not pooled
                    const face = new THREE.Vector3();

                    // Determine which face was hit
                    const centerX = bx + 0.5;
                    const centerY = by + 0.5;
                    const centerZ = bz + 0.5;

                    const diffX = tempPos.x - centerX;
                    const diffY = tempPos.y - centerY;
                    const diffZ = tempPos.z - centerZ;

                    const ax = Math.abs(diffX);
                    const ay = Math.abs(diffY);
                    const az = Math.abs(diffZ);

                    if (ax > ay && ax > az) {
                        face.set(Math.sign(diffX), 0, 0);
                    } else if (ay > ax && ay > az) {
                        face.set(0, Math.sign(diffY), 0);
                    } else {
                        face.set(0, 0, Math.sign(diffZ));
                    }

                    return { x: bx, y: by, z: bz, face };
                }
            }

            return null;
        } finally {
            // Always return vectors to pool
            pool.releaseMany(origin, direction, tempPos, stepVec);
        }
    }


    /**
     * Start breaking a block
     */
    public startBreaking(): void {
        const target = this.getTargetBlock();
        if (!target) return;

        const blockType = this.world.getBlock(target.x, target.y, target.z);
        if (blockType === BlockType.AIR || blockType === BlockType.BEDROCK) return;

        this.targetBlock = { x: target.x, y: target.y, z: target.z };
        this.breakProgress = 0;
        this.isBreaking = true;

        // Calculate break time
        this.maxBreakTime = this.calculateBreakTime(blockType);
    }

    /**
     * Continue breaking the block
     */
    public updateBreaking(deltaTime: number): void {
        if (!this.isBreaking || !this.targetBlock) return;

        // Check if still looking at same block
        const target = this.getTargetBlock();
        if (!target ||
            target.x !== this.targetBlock.x ||
            target.y !== this.targetBlock.y ||
            target.z !== this.targetBlock.z) {
            this.stopBreaking();
            return;
        }

        // Increase progress
        this.breakProgress += deltaTime;

        // Notify progress
        const progress = Math.min(this.breakProgress / this.maxBreakTime, 1);
        this.onBreakProgressCallbacks.forEach(cb => cb(progress));

        // Check if block is broken
        if (this.breakProgress >= this.maxBreakTime) {
            this.breakBlock();
        }
    }

    /**
     * Stop breaking
     */
    public stopBreaking(): void {
        this.isBreaking = false;
        this.targetBlock = null;
        this.breakProgress = 0;
        this.onBreakProgressCallbacks.forEach(cb => cb(0));
    }

    /**
     * Break the block and collect drops
     */
    private breakBlock(): void {
        if (!this.targetBlock) return;

        const blockType = this.world.getBlock(
            this.targetBlock.x,
            this.targetBlock.y,
            this.targetBlock.z
        );

        // Get drops
        const drops = this.getDrops(blockType);

        // Remove block from world
        this.world.setBlock(
            this.targetBlock.x,
            this.targetBlock.y,
            this.targetBlock.z,
            BlockType.AIR
        );

        // Add drops to inventory
        for (const drop of drops) {
            this.inventory.addItem(drop.itemId, drop.quantity);
        }

        // Notify listeners
        this.onBlockBrokenCallbacks.forEach(cb =>
            cb(this.targetBlock!.x, this.targetBlock!.y, this.targetBlock!.z, drops)
        );

        // Reset
        this.stopBreaking();
    }

    /**
     * Calculate break time based on block and equipped tool
     */
    private calculateBreakTime(blockType: BlockType): number {
        const data = BLOCK_BREAK_DATA[blockType];
        if (!data) return 1.0; // Default 1 second

        let breakTime = data.baseTime;

        // Check equipped tool
        const selectedItem = this.inventory.getSelectedItem();
        if (selectedItem && selectedItem.category === ItemCategory.TOOL) {
            const speedMultiplier = TOOL_SPEED_MULTIPLIERS[selectedItem.id] || 1;
            breakTime = breakTime / speedMultiplier;
        } else if (data.toolRequired) {
            // No proper tool, takes much longer
            breakTime = breakTime * 5;
        }

        return breakTime;
    }

    /**
     * Get drops for a block type
     */
    private getDrops(blockType: BlockType): { itemId: number; quantity: number }[] {
        const data = BLOCK_BREAK_DATA[blockType];
        if (!data) {
            // Default: drop the block itself
            return [{ itemId: blockType, quantity: 1 }];
        }

        // Check if tool is required
        if (data.toolRequired) {
            const selectedItem = this.inventory.getSelectedItem();
            if (!selectedItem || selectedItem.category !== ItemCategory.TOOL) {
                return []; // No drops without proper tool
            }
        }

        // Process drops with chance
        const drops: { itemId: number; quantity: number }[] = [];
        for (const drop of data.drops) {
            if (Math.random() <= drop.chance) {
                drops.push({ itemId: drop.itemId, quantity: drop.quantity });
            }
        }

        return drops;
    }

    /**
     * Place a block
     */
    public placeBlock(): boolean {
        const target = this.getTargetBlock();
        if (!target) return false;

        // Get selected item
        const selectedItem = this.inventory.getSelectedItem();
        if (!selectedItem || selectedItem.category !== ItemCategory.BLOCK) {
            return false;
        }

        // Calculate position to place block
        const placeX = target.x + target.face.x;
        const placeY = target.y + target.face.y;
        const placeZ = target.z + target.face.z;

        // Check if position is valid (not inside player)
        // TODO: Add player collision check

        // Check if position is air
        if (this.world.getBlock(placeX, placeY, placeZ) !== BlockType.AIR) {
            return false;
        }

        // Place block
        this.world.setBlock(placeX, placeY, placeZ, selectedItem.blockType!);

        // Remove item from inventory
        this.inventory.useSelectedItem(1);

        return true;
    }

    /**
     * Get current break progress (0-1)
     */
    public getBreakProgress(): number {
        if (!this.isBreaking || this.maxBreakTime === 0) return 0;
        return Math.min(this.breakProgress / this.maxBreakTime, 1);
    }

    /**
     * Check if currently breaking
     */
    public isCurrentlyBreaking(): boolean {
        return this.isBreaking;
    }

    /**
     * Register callback for break progress
     */
    public onBreakProgress(callback: (progress: number) => void): void {
        this.onBreakProgressCallbacks.push(callback);
    }

    /**
     * Register callback for block broken
     */
    public onBlockBroken(callback: (x: number, y: number, z: number, drops: { itemId: number; quantity: number }[]) => void): void {
        this.onBlockBrokenCallbacks.push(callback);
    }
}

import * as THREE from 'three';

/**
 * Block Types for the Voxel World
 * Extended for Hytale-style terrain generation
 */
export enum BlockType {
    AIR = 0,
    GRASS = 1,
    DIRT = 2,
    STONE = 3,
    SAND = 4,
    WATER = 5,
    WOOD = 6,
    LEAVES = 7,
    SNOW = 8,
    BEDROCK = 9,
    GRAVEL = 10,
    CLAY = 11,
    ICE = 12,
    PACKED_ICE = 13,
    DEEPSLATE = 14,
    COBBLESTONE = 15,
    MOSS_STONE = 16,
    RED_SAND = 17,
    TERRACOTTA = 18,
    GRANITE = 19,
    DIORITE = 20,
    ANDESITE = 21,
    COAL_ORE = 22,
    IRON_ORE = 23,
    GOLD_ORE = 24,
    DIAMOND_ORE = 25,
    LAVA = 26,
    SNOW_BLOCK = 27,
    PODZOL = 28,
    COARSE_DIRT = 29,
    // Vegetation blocks
    TALL_GRASS = 30,
    FERN = 31,
    DEAD_BUSH = 32,
    FLOWER_RED = 33,
    FLOWER_YELLOW = 34,
    FLOWER_BLUE = 35,
    FLOWER_WHITE = 36,
    MUSHROOM_RED = 37,
    MUSHROOM_BROWN = 38
}

export interface BlockData {
    id: BlockType;
    name: string;
    solid: boolean;
    transparent: boolean;
    color: THREE.Color;
    emissive?: THREE.Color;
    roughness: number;
    climbable?: boolean;
    liquid?: boolean;
}

export const BLOCKS: Record<BlockType, BlockData> = {
    [BlockType.AIR]: {
        id: BlockType.AIR,
        name: 'Air',
        solid: false,
        transparent: true,
        color: new THREE.Color(0x000000),
        roughness: 1
    },
    [BlockType.GRASS]: {
        id: BlockType.GRASS,
        name: 'Grass',
        solid: true,
        transparent: false,
        color: new THREE.Color(0x5a8f3c),
        roughness: 0.9
    },
    [BlockType.DIRT]: {
        id: BlockType.DIRT,
        name: 'Dirt',
        solid: true,
        transparent: false,
        color: new THREE.Color(0x8b6c42),
        roughness: 1
    },
    [BlockType.STONE]: {
        id: BlockType.STONE,
        name: 'Stone',
        solid: true,
        transparent: false,
        color: new THREE.Color(0x7a7a7a),
        roughness: 0.8
    },
    [BlockType.SAND]: {
        id: BlockType.SAND,
        name: 'Sand',
        solid: true,
        transparent: false,
        color: new THREE.Color(0xe8d4a8),
        roughness: 1
    },
    [BlockType.WATER]: {
        id: BlockType.WATER,
        name: 'Water',
        solid: false,
        transparent: true,
        color: new THREE.Color(0x3498db),
        roughness: 0.1,
        liquid: true
    },
    [BlockType.WOOD]: {
        id: BlockType.WOOD,
        name: 'Wood',
        solid: true,
        transparent: false,
        color: new THREE.Color(0x6b4423),
        roughness: 0.85
    },
    [BlockType.LEAVES]: {
        id: BlockType.LEAVES,
        name: 'Leaves',
        solid: true,
        transparent: true,
        color: new THREE.Color(0x2e7d32),
        roughness: 0.95
    },
    [BlockType.SNOW]: {
        id: BlockType.SNOW,
        name: 'Snow',
        solid: true,
        transparent: false,
        color: new THREE.Color(0xffffff),
        roughness: 0.7
    },
    [BlockType.BEDROCK]: {
        id: BlockType.BEDROCK,
        name: 'Bedrock',
        solid: true,
        transparent: false,
        color: new THREE.Color(0x2c2c2c),
        roughness: 1
    },
    [BlockType.GRAVEL]: {
        id: BlockType.GRAVEL,
        name: 'Gravel',
        solid: true,
        transparent: false,
        color: new THREE.Color(0x8f8f8f),
        roughness: 0.95
    },
    [BlockType.CLAY]: {
        id: BlockType.CLAY,
        name: 'Clay',
        solid: true,
        transparent: false,
        color: new THREE.Color(0xa4a8b8),
        roughness: 0.85
    },
    [BlockType.ICE]: {
        id: BlockType.ICE,
        name: 'Ice',
        solid: true,
        transparent: true,
        color: new THREE.Color(0xaed9f5),
        roughness: 0.1
    },
    [BlockType.PACKED_ICE]: {
        id: BlockType.PACKED_ICE,
        name: 'Packed Ice',
        solid: true,
        transparent: false,
        color: new THREE.Color(0x7eb4d1),
        roughness: 0.15
    },
    [BlockType.DEEPSLATE]: {
        id: BlockType.DEEPSLATE,
        name: 'Deepslate',
        solid: true,
        transparent: false,
        color: new THREE.Color(0x4a4a52),
        roughness: 0.75
    },
    [BlockType.COBBLESTONE]: {
        id: BlockType.COBBLESTONE,
        name: 'Cobblestone',
        solid: true,
        transparent: false,
        color: new THREE.Color(0x6a6a6a),
        roughness: 0.9
    },
    [BlockType.MOSS_STONE]: {
        id: BlockType.MOSS_STONE,
        name: 'Mossy Stone',
        solid: true,
        transparent: false,
        color: new THREE.Color(0x5a7a5a),
        roughness: 0.85
    },
    [BlockType.RED_SAND]: {
        id: BlockType.RED_SAND,
        name: 'Red Sand',
        solid: true,
        transparent: false,
        color: new THREE.Color(0xc2703e),
        roughness: 1
    },
    [BlockType.TERRACOTTA]: {
        id: BlockType.TERRACOTTA,
        name: 'Terracotta',
        solid: true,
        transparent: false,
        color: new THREE.Color(0xba6d48),
        roughness: 0.8
    },
    [BlockType.GRANITE]: {
        id: BlockType.GRANITE,
        name: 'Granite',
        solid: true,
        transparent: false,
        color: new THREE.Color(0x9a7762),
        roughness: 0.75
    },
    [BlockType.DIORITE]: {
        id: BlockType.DIORITE,
        name: 'Diorite',
        solid: true,
        transparent: false,
        color: new THREE.Color(0xb8b8b8),
        roughness: 0.75
    },
    [BlockType.ANDESITE]: {
        id: BlockType.ANDESITE,
        name: 'Andesite',
        solid: true,
        transparent: false,
        color: new THREE.Color(0x8a8a8a),
        roughness: 0.75
    },
    [BlockType.COAL_ORE]: {
        id: BlockType.COAL_ORE,
        name: 'Coal Ore',
        solid: true,
        transparent: false,
        color: new THREE.Color(0x3a3a3a),
        roughness: 0.8
    },
    [BlockType.IRON_ORE]: {
        id: BlockType.IRON_ORE,
        name: 'Iron Ore',
        solid: true,
        transparent: false,
        color: new THREE.Color(0xb87333),
        roughness: 0.8
    },
    [BlockType.GOLD_ORE]: {
        id: BlockType.GOLD_ORE,
        name: 'Gold Ore',
        solid: true,
        transparent: false,
        color: new THREE.Color(0xffd700),
        roughness: 0.6
    },
    [BlockType.DIAMOND_ORE]: {
        id: BlockType.DIAMOND_ORE,
        name: 'Diamond Ore',
        solid: true,
        transparent: false,
        color: new THREE.Color(0x00ffff),
        roughness: 0.4,
        emissive: new THREE.Color(0x003333)
    },
    [BlockType.LAVA]: {
        id: BlockType.LAVA,
        name: 'Lava',
        solid: false,
        transparent: true,
        color: new THREE.Color(0xff4500),
        emissive: new THREE.Color(0xff2200),
        roughness: 0.3,
        liquid: true
    },
    [BlockType.SNOW_BLOCK]: {
        id: BlockType.SNOW_BLOCK,
        name: 'Snow Block',
        solid: true,
        transparent: false,
        color: new THREE.Color(0xf0f8ff),
        roughness: 0.85
    },
    [BlockType.PODZOL]: {
        id: BlockType.PODZOL,
        name: 'Podzol',
        solid: true,
        transparent: false,
        color: new THREE.Color(0x6b4423),
        roughness: 0.9
    },
    [BlockType.COARSE_DIRT]: {
        id: BlockType.COARSE_DIRT,
        name: 'Coarse Dirt',
        solid: true,
        transparent: false,
        color: new THREE.Color(0x7a5a32),
        roughness: 1
    },
    // Vegetation blocks
    [BlockType.TALL_GRASS]: {
        id: BlockType.TALL_GRASS,
        name: 'Tall Grass',
        solid: false,
        transparent: true,
        color: new THREE.Color(0x7cb342),
        roughness: 1
    },
    [BlockType.FERN]: {
        id: BlockType.FERN,
        name: 'Fern',
        solid: false,
        transparent: true,
        color: new THREE.Color(0x558b2f),
        roughness: 1
    },
    [BlockType.DEAD_BUSH]: {
        id: BlockType.DEAD_BUSH,
        name: 'Dead Bush',
        solid: false,
        transparent: true,
        color: new THREE.Color(0x8b7355),
        roughness: 1
    },
    [BlockType.FLOWER_RED]: {
        id: BlockType.FLOWER_RED,
        name: 'Red Flower',
        solid: false,
        transparent: true,
        color: new THREE.Color(0xdc143c),
        roughness: 1
    },
    [BlockType.FLOWER_YELLOW]: {
        id: BlockType.FLOWER_YELLOW,
        name: 'Yellow Flower',
        solid: false,
        transparent: true,
        color: new THREE.Color(0xffd700),
        roughness: 1
    },
    [BlockType.FLOWER_BLUE]: {
        id: BlockType.FLOWER_BLUE,
        name: 'Blue Flower',
        solid: false,
        transparent: true,
        color: new THREE.Color(0x4169e1),
        roughness: 1
    },
    [BlockType.FLOWER_WHITE]: {
        id: BlockType.FLOWER_WHITE,
        name: 'White Flower',
        solid: false,
        transparent: true,
        color: new THREE.Color(0xffffff),
        roughness: 1
    },
    [BlockType.MUSHROOM_RED]: {
        id: BlockType.MUSHROOM_RED,
        name: 'Red Mushroom',
        solid: false,
        transparent: true,
        color: new THREE.Color(0xb22222),
        roughness: 1
    },
    [BlockType.MUSHROOM_BROWN]: {
        id: BlockType.MUSHROOM_BROWN,
        name: 'Brown Mushroom',
        solid: false,
        transparent: true,
        color: new THREE.Color(0x8b4513),
        roughness: 1
    }
};

export function getBlock(type: BlockType): BlockData {
    return BLOCKS[type];
}

export function isBlockSolid(type: BlockType): boolean {
    return BLOCKS[type]?.solid ?? false;
}

export function isBlockTransparent(type: BlockType): boolean {
    return BLOCKS[type]?.transparent ?? true;
}

export function isBlockLiquid(type: BlockType): boolean {
    return BLOCKS[type]?.liquid ?? false;
}

import { BlockType, BLOCKS } from '../world/BlockTypes';

/**
 * Item Types for the Inventory System
 * Items can be blocks, tools, or other collectibles
 */

export enum ItemCategory {
    BLOCK = 'block',
    TOOL = 'tool',
    MATERIAL = 'material',
    FOOD = 'food',
    MISC = 'misc'
}

export interface ItemData {
    id: number;
    name: string;
    category: ItemCategory;
    stackSize: number;
    color: string;
    icon?: string;
    blockType?: BlockType;
    durability?: number;
}

// Create items from blocks
function createBlockItem(blockType: BlockType): ItemData {
    const block = BLOCKS[blockType];
    return {
        id: blockType,
        name: block.name,
        category: ItemCategory.BLOCK,
        stackSize: 64,
        color: '#' + block.color.getHexString(),
        blockType: blockType
    };
}

// All available items
export const ITEMS: Record<number, ItemData> = {
    // Block items (using same IDs as BlockType)
    [BlockType.GRASS]: createBlockItem(BlockType.GRASS),
    [BlockType.DIRT]: createBlockItem(BlockType.DIRT),
    [BlockType.STONE]: createBlockItem(BlockType.STONE),
    [BlockType.SAND]: createBlockItem(BlockType.SAND),
    [BlockType.WOOD]: createBlockItem(BlockType.WOOD),
    [BlockType.LEAVES]: createBlockItem(BlockType.LEAVES),
    [BlockType.SNOW]: createBlockItem(BlockType.SNOW),
    [BlockType.GRAVEL]: createBlockItem(BlockType.GRAVEL),
    [BlockType.CLAY]: createBlockItem(BlockType.CLAY),
    [BlockType.COBBLESTONE]: createBlockItem(BlockType.COBBLESTONE),
    [BlockType.MOSS_STONE]: createBlockItem(BlockType.MOSS_STONE),
    [BlockType.RED_SAND]: createBlockItem(BlockType.RED_SAND),
    [BlockType.TERRACOTTA]: createBlockItem(BlockType.TERRACOTTA),
    [BlockType.GRANITE]: createBlockItem(BlockType.GRANITE),
    [BlockType.DIORITE]: createBlockItem(BlockType.DIORITE),
    [BlockType.ANDESITE]: createBlockItem(BlockType.ANDESITE),
    [BlockType.COAL_ORE]: createBlockItem(BlockType.COAL_ORE),
    [BlockType.IRON_ORE]: createBlockItem(BlockType.IRON_ORE),
    [BlockType.GOLD_ORE]: createBlockItem(BlockType.GOLD_ORE),
    [BlockType.DIAMOND_ORE]: createBlockItem(BlockType.DIAMOND_ORE),
    [BlockType.SNOW_BLOCK]: createBlockItem(BlockType.SNOW_BLOCK),
    [BlockType.PODZOL]: createBlockItem(BlockType.PODZOL),
    [BlockType.COARSE_DIRT]: createBlockItem(BlockType.COARSE_DIRT),

    // Tools (IDs starting from 100)
    100: {
        id: 100,
        name: 'Wooden Pickaxe',
        category: ItemCategory.TOOL,
        stackSize: 1,
        color: '#8B4513',
        icon: '⛏️',
        durability: 60
    },
    101: {
        id: 101,
        name: 'Stone Pickaxe',
        category: ItemCategory.TOOL,
        stackSize: 1,
        color: '#7a7a7a',
        icon: '⛏️',
        durability: 132
    },
    102: {
        id: 102,
        name: 'Iron Pickaxe',
        category: ItemCategory.TOOL,
        stackSize: 1,
        color: '#b87333',
        icon: '⛏️',
        durability: 251
    },
    103: {
        id: 103,
        name: 'Diamond Pickaxe',
        category: ItemCategory.TOOL,
        stackSize: 1,
        color: '#00ffff',
        icon: '⛏️',
        durability: 1562
    },
    110: {
        id: 110,
        name: 'Wooden Sword',
        category: ItemCategory.TOOL,
        stackSize: 1,
        color: '#8B4513',
        icon: '🗡️',
        durability: 60
    },
    111: {
        id: 111,
        name: 'Stone Sword',
        category: ItemCategory.TOOL,
        stackSize: 1,
        color: '#7a7a7a',
        icon: '🗡️',
        durability: 132
    },
    112: {
        id: 112,
        name: 'Iron Sword',
        category: ItemCategory.TOOL,
        stackSize: 1,
        color: '#b87333',
        icon: '🗡️',
        durability: 251
    },
    113: {
        id: 113,
        name: 'Diamond Sword',
        category: ItemCategory.TOOL,
        stackSize: 1,
        color: '#00ffff',
        icon: '🗡️',
        durability: 1562
    },

    // Materials (IDs starting from 200)
    200: {
        id: 200,
        name: 'Coal',
        category: ItemCategory.MATERIAL,
        stackSize: 64,
        color: '#2a2a2a',
        icon: '�ite'
    },
    201: {
        id: 201,
        name: 'Iron Ingot',
        category: ItemCategory.MATERIAL,
        stackSize: 64,
        color: '#d4d4d4',
        icon: '🔩'
    },
    202: {
        id: 202,
        name: 'Gold Ingot',
        category: ItemCategory.MATERIAL,
        stackSize: 64,
        color: '#ffd700',
        icon: '🪙'
    },
    203: {
        id: 203,
        name: 'Diamond',
        category: ItemCategory.MATERIAL,
        stackSize: 64,
        color: '#00ffff',
        icon: '💎'
    },
    204: {
        id: 204,
        name: 'Stick',
        category: ItemCategory.MATERIAL,
        stackSize: 64,
        color: '#8B4513',
        icon: '🪵'
    }
};

export function getItem(id: number): ItemData | undefined {
    return ITEMS[id];
}

export function isBlockItem(item: ItemData): boolean {
    return item.category === ItemCategory.BLOCK && item.blockType !== undefined;
}

export function getItemsByCategory(category: ItemCategory): ItemData[] {
    return Object.values(ITEMS).filter(item => item.category === category);
}

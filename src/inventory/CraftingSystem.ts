import { Inventory } from './Inventory';
import { BlockType } from '../world/BlockTypes';

/**
 * Crafting Recipe Interface
 */
export interface CraftingRecipe {
    id: string;
    name: string;
    resultItemId: number;
    resultQuantity: number;
    ingredients: { itemId: number; quantity: number }[];
    category: string;
}

/**
 * All available crafting recipes
 */
export const RECIPES: CraftingRecipe[] = [
    // Wooden Pickaxe - 3 wood planks + 2 sticks
    {
        id: 'wooden_pickaxe',
        name: 'Picareta de Madeira',
        resultItemId: 100,
        resultQuantity: 1,
        ingredients: [
            { itemId: BlockType.WOOD, quantity: 3 },
            { itemId: 204, quantity: 2 } // Sticks
        ],
        category: 'tools'
    },
    // Stone Pickaxe - 3 cobblestone + 2 sticks
    {
        id: 'stone_pickaxe',
        name: 'Picareta de Pedra',
        resultItemId: 101,
        resultQuantity: 1,
        ingredients: [
            { itemId: BlockType.COBBLESTONE, quantity: 3 },
            { itemId: 204, quantity: 2 }
        ],
        category: 'tools'
    },
    // Iron Pickaxe - 3 iron ingots + 2 sticks
    {
        id: 'iron_pickaxe',
        name: 'Picareta de Ferro',
        resultItemId: 102,
        resultQuantity: 1,
        ingredients: [
            { itemId: 201, quantity: 3 }, // Iron Ingot
            { itemId: 204, quantity: 2 }
        ],
        category: 'tools'
    },
    // Diamond Pickaxe - 3 diamonds + 2 sticks
    {
        id: 'diamond_pickaxe',
        name: 'Picareta de Diamante',
        resultItemId: 103,
        resultQuantity: 1,
        ingredients: [
            { itemId: 203, quantity: 3 }, // Diamond
            { itemId: 204, quantity: 2 }
        ],
        category: 'tools'
    },
    // Wooden Sword - 2 wood + 1 stick
    {
        id: 'wooden_sword',
        name: 'Espada de Madeira',
        resultItemId: 110,
        resultQuantity: 1,
        ingredients: [
            { itemId: BlockType.WOOD, quantity: 2 },
            { itemId: 204, quantity: 1 }
        ],
        category: 'tools'
    },
    // Sticks - 2 wood = 4 sticks
    {
        id: 'sticks',
        name: 'Galhos',
        resultItemId: 204,
        resultQuantity: 4,
        ingredients: [
            { itemId: BlockType.WOOD, quantity: 2 }
        ],
        category: 'materials'
    }
];

/**
 * Crafting System Class
 */
export class CraftingSystem {
    private inventory: Inventory;

    constructor(inventory: Inventory) {
        this.inventory = inventory;
    }

    /**
     * Get all available recipes
     */
    public getRecipes(): CraftingRecipe[] {
        return RECIPES;
    }

    /**
     * Get recipes that can be crafted with current inventory
     */
    public getAvailableRecipes(): CraftingRecipe[] {
        return RECIPES.filter(recipe => this.canCraft(recipe));
    }

    /**
     * Check if a recipe can be crafted
     */
    public canCraft(recipe: CraftingRecipe): boolean {
        for (const ingredient of recipe.ingredients) {
            const count = this.inventory.countItem(ingredient.itemId);
            if (count < ingredient.quantity) {
                return false;
            }
        }
        return true;
    }

    /**
     * Craft an item
     */
    public craft(recipe: CraftingRecipe): boolean {
        if (!this.canCraft(recipe)) {
            return false;
        }

        // Check if we have space for the result
        if (!this.inventory.hasSpaceFor(recipe.resultItemId, recipe.resultQuantity)) {
            return false;
        }

        // Remove ingredients
        for (const ingredient of recipe.ingredients) {
            this.removeItems(ingredient.itemId, ingredient.quantity);
        }

        // Add result
        this.inventory.addItem(recipe.resultItemId, recipe.resultQuantity);

        return true;
    }

    /**
     * Remove items from inventory (helper for crafting)
     */
    private removeItems(itemId: number, quantity: number): void {
        let remaining = quantity;
        const hotbar = this.inventory.getHotbar();
        const mainInventory = this.inventory.getMainInventory();

        // Remove from main inventory first
        for (let i = 0; i < mainInventory.length && remaining > 0; i++) {
            if (mainInventory[i].itemId === itemId) {
                const remove = Math.min(remaining, mainInventory[i].quantity);
                const newQty = mainInventory[i].quantity - remove;
                if (newQty <= 0) {
                    this.inventory.clearSlot(false, i);
                } else {
                    this.inventory.setMainSlot(i, itemId, newQty);
                }
                remaining -= remove;
            }
        }

        // Then remove from hotbar
        for (let i = 0; i < hotbar.length && remaining > 0; i++) {
            if (hotbar[i].itemId === itemId) {
                const remove = Math.min(remaining, hotbar[i].quantity);
                const newQty = hotbar[i].quantity - remove;
                if (newQty <= 0) {
                    this.inventory.clearSlot(true, i);
                } else {
                    this.inventory.setHotbarSlot(i, itemId, newQty);
                }
                remaining -= remove;
            }
        }
    }

    /**
     * Get recipe by ID
     */
    public getRecipeById(id: string): CraftingRecipe | undefined {
        return RECIPES.find(r => r.id === id);
    }

    /**
     * Get recipes by category
     */
    public getRecipesByCategory(category: string): CraftingRecipe[] {
        return RECIPES.filter(r => r.category === category);
    }
}

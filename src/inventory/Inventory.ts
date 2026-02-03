import { ItemData, getItem, ITEMS, ItemCategory } from './ItemTypes';
import { BlockType } from '../world/BlockTypes';

/**
 * Inventory Slot Interface
 */
export interface InventorySlot {
    itemId: number | null;
    quantity: number;
}

/**
 * Inventory Configuration
 */
export interface InventoryConfig {
    hotbarSize: number;
    inventoryRows: number;
    inventoryCols: number;
}

const DEFAULT_INVENTORY_CONFIG: InventoryConfig = {
    hotbarSize: 9,
    inventoryRows: 3,
    inventoryCols: 9
};

/**
 * Main Inventory Class
 * Manages player inventory with hotbar and main storage
 */
export class Inventory {
    private hotbar: InventorySlot[];
    private mainInventory: InventorySlot[];
    private selectedSlot: number = 0;
    private config: InventoryConfig;

    private onChangeCallbacks: Array<() => void> = [];

    constructor(config: Partial<InventoryConfig> = {}) {
        this.config = { ...DEFAULT_INVENTORY_CONFIG, ...config };

        // Initialize hotbar
        this.hotbar = Array(this.config.hotbarSize).fill(null).map(() => ({
            itemId: null,
            quantity: 0
        }));

        // Initialize main inventory
        const mainSlots = this.config.inventoryRows * this.config.inventoryCols;
        this.mainInventory = Array(mainSlots).fill(null).map(() => ({
            itemId: null,
            quantity: 0
        }));

        // Give player some starting items
        this.addStartingItems();
    }

    private addStartingItems(): void {
        // Start with some basic materials for crafting
        // Player needs to craft their own tools!
        this.setHotbarSlot(0, BlockType.WOOD, 16);    // Wood to make sticks
        this.setHotbarSlot(1, 204, 8);                // Some sticks
        this.setHotbarSlot(2, BlockType.COBBLESTONE, 16); // Cobblestone for stone tools

        // Empty slots for collected materials
        // Slots 3-8 empty
    }

    /**
     * Get the currently selected hotbar slot index
     */
    public getSelectedSlot(): number {
        return this.selectedSlot;
    }

    /**
     * Set the selected hotbar slot
     */
    public setSelectedSlot(slot: number): void {
        if (slot >= 0 && slot < this.config.hotbarSize) {
            this.selectedSlot = slot;
            this.notifyChange();
        }
    }

    /**
     * Cycle to next hotbar slot
     */
    public nextSlot(): void {
        this.selectedSlot = (this.selectedSlot + 1) % this.config.hotbarSize;
        this.notifyChange();
    }

    /**
     * Cycle to previous hotbar slot
     */
    public previousSlot(): void {
        this.selectedSlot = (this.selectedSlot - 1 + this.config.hotbarSize) % this.config.hotbarSize;
        this.notifyChange();
    }

    /**
     * Get the currently selected item
     */
    public getSelectedItem(): ItemData | null {
        const slot = this.hotbar[this.selectedSlot];
        if (slot.itemId !== null) {
            return getItem(slot.itemId) || null;
        }
        return null;
    }

    /**
     * Get the hotbar slots
     */
    public getHotbar(): InventorySlot[] {
        return [...this.hotbar];
    }

    /**
     * Get the main inventory slots
     */
    public getMainInventory(): InventorySlot[] {
        return [...this.mainInventory];
    }

    /**
     * Get item data for a slot
     */
    public getItemForSlot(slot: InventorySlot): ItemData | null {
        if (slot.itemId !== null) {
            return getItem(slot.itemId) || null;
        }
        return null;
    }

    /**
     * Set a specific hotbar slot
     */
    public setHotbarSlot(index: number, itemId: number, quantity: number): boolean {
        if (index < 0 || index >= this.config.hotbarSize) return false;

        const item = getItem(itemId);
        if (!item) return false;

        this.hotbar[index] = {
            itemId,
            quantity: Math.min(quantity, item.stackSize)
        };
        this.notifyChange();
        return true;
    }

    /**
     * Set a specific main inventory slot
     */
    public setMainSlot(index: number, itemId: number, quantity: number): boolean {
        if (index < 0 || index >= this.mainInventory.length) return false;

        const item = getItem(itemId);
        if (!item) return false;

        this.mainInventory[index] = {
            itemId,
            quantity: Math.min(quantity, item.stackSize)
        };
        this.notifyChange();
        return true;
    }

    /**
     * Add item to inventory (finds first available slot)
     */
    public addItem(itemId: number, quantity: number): number {
        const item = getItem(itemId);
        if (!item) return quantity;

        let remaining = quantity;

        // First, try to stack with existing items in hotbar
        for (let i = 0; i < this.hotbar.length && remaining > 0; i++) {
            const slot = this.hotbar[i];
            if (slot.itemId === itemId && slot.quantity < item.stackSize) {
                const canAdd = Math.min(remaining, item.stackSize - slot.quantity);
                slot.quantity += canAdd;
                remaining -= canAdd;
            }
        }

        // Then try to stack in main inventory
        for (let i = 0; i < this.mainInventory.length && remaining > 0; i++) {
            const slot = this.mainInventory[i];
            if (slot.itemId === itemId && slot.quantity < item.stackSize) {
                const canAdd = Math.min(remaining, item.stackSize - slot.quantity);
                slot.quantity += canAdd;
                remaining -= canAdd;
            }
        }

        // Find empty slots in hotbar
        for (let i = 0; i < this.hotbar.length && remaining > 0; i++) {
            if (this.hotbar[i].itemId === null) {
                const canAdd = Math.min(remaining, item.stackSize);
                this.hotbar[i] = { itemId, quantity: canAdd };
                remaining -= canAdd;
            }
        }

        // Find empty slots in main inventory
        for (let i = 0; i < this.mainInventory.length && remaining > 0; i++) {
            if (this.mainInventory[i].itemId === null) {
                const canAdd = Math.min(remaining, item.stackSize);
                this.mainInventory[i] = { itemId, quantity: canAdd };
                remaining -= canAdd;
            }
        }

        if (remaining !== quantity) {
            this.notifyChange();
        }

        return remaining; // Return items that couldn't be added
    }

    /**
     * Remove item from the selected hotbar slot
     */
    public useSelectedItem(amount: number = 1): boolean {
        const slot = this.hotbar[this.selectedSlot];
        if (slot.itemId === null || slot.quantity < amount) return false;

        slot.quantity -= amount;
        if (slot.quantity <= 0) {
            slot.itemId = null;
            slot.quantity = 0;
        }
        this.notifyChange();
        return true;
    }

    /**
     * Swap two slots (for drag and drop)
     */
    public swapSlots(
        fromHotbar: boolean,
        fromIndex: number,
        toHotbar: boolean,
        toIndex: number
    ): void {
        const fromArray = fromHotbar ? this.hotbar : this.mainInventory;
        const toArray = toHotbar ? this.hotbar : this.mainInventory;

        if (fromIndex < 0 || fromIndex >= fromArray.length) return;
        if (toIndex < 0 || toIndex >= toArray.length) return;

        const temp = { ...fromArray[fromIndex] };
        fromArray[fromIndex] = { ...toArray[toIndex] };
        toArray[toIndex] = temp;
        this.notifyChange();
    }

    /**
     * Clear a slot
     */
    public clearSlot(isHotbar: boolean, index: number): void {
        const array = isHotbar ? this.hotbar : this.mainInventory;
        if (index >= 0 && index < array.length) {
            array[index] = { itemId: null, quantity: 0 };
            this.notifyChange();
        }
    }

    /**
     * Get inventory config
     */
    public getConfig(): InventoryConfig {
        return { ...this.config };
    }

    /**
     * Check if inventory has space for an item
     */
    public hasSpaceFor(itemId: number, quantity: number): boolean {
        const item = getItem(itemId);
        if (!item) return false;

        let space = 0;

        // Check for stackable slots
        const allSlots = [...this.hotbar, ...this.mainInventory];
        for (const slot of allSlots) {
            if (slot.itemId === null) {
                space += item.stackSize;
            } else if (slot.itemId === itemId) {
                space += item.stackSize - slot.quantity;
            }
            if (space >= quantity) return true;
        }

        return space >= quantity;
    }

    /**
     * Count total of an item in inventory
     */
    public countItem(itemId: number): number {
        let count = 0;
        const allSlots = [...this.hotbar, ...this.mainInventory];
        for (const slot of allSlots) {
            if (slot.itemId === itemId) {
                count += slot.quantity;
            }
        }
        return count;
    }

    /**
     * Register a callback for inventory changes
     */
    public onChange(callback: () => void): void {
        this.onChangeCallbacks.push(callback);
    }

    /**
     * Notify all listeners of inventory change
     */
    private notifyChange(): void {
        for (const callback of this.onChangeCallbacks) {
            callback();
        }
    }

    /**
     * Get all available items for creative mode
     */
    public static getAllItems(): ItemData[] {
        return Object.values(ITEMS);
    }

    /**
     * Get items by category
     */
    public static getItemsByCategory(category: ItemCategory): ItemData[] {
        return Object.values(ITEMS).filter(item => item.category === category);
    }
}

import { Inventory, InventorySlot } from './Inventory';
import { getItem, ItemData, ItemCategory } from './ItemTypes';

/**
 * Inventory UI Component
 * Renders the hotbar and full inventory interface
 */
export class InventoryUI {
    private inventory: Inventory;
    private container: HTMLElement | null = null;
    private hotbarElement: HTMLElement | null = null;
    private inventoryPanel: HTMLElement | null = null;
    private isInventoryOpen: boolean = false;

    private draggedSlot: { isHotbar: boolean; index: number } | null = null;
    private tooltipElement: HTMLElement | null = null;

    constructor(inventory: Inventory) {
        this.inventory = inventory;
        this.createUI();
        this.setupEventListeners();

        // Listen for inventory changes
        this.inventory.onChange(() => this.render());
    }

    private createUI(): void {
        // Create main container
        this.container = document.createElement('div');
        this.container.id = 'inventory-container';
        this.container.innerHTML = `
            <div class="hotbar" id="hotbar">
                ${this.createHotbarHTML()}
            </div>
            <div class="inventory-panel" id="inventory-panel" style="display: none;">
                <div class="inventory-header">
                    <h2>📦 Inventário</h2>
                    <button class="close-btn" id="close-inventory">✕</button>
                </div>
                <div class="inventory-content">
                    <div class="inventory-grid" id="inventory-grid">
                        ${this.createInventoryGridHTML()}
                    </div>
                    <div class="inventory-hotbar" id="inventory-hotbar">
                        ${this.createHotbarHTML()}
                    </div>
                </div>
            </div>
            <div class="item-tooltip" id="item-tooltip" style="display: none;"></div>
        `;

        // Get references
        const hud = document.getElementById('hud');
        if (hud) {
            hud.appendChild(this.container);
        } else {
            document.body.appendChild(this.container);
        }

        this.hotbarElement = document.getElementById('hotbar');
        this.inventoryPanel = document.getElementById('inventory-panel');
        this.tooltipElement = document.getElementById('item-tooltip');

        // Initial render
        this.render();
    }

    private createHotbarHTML(): string {
        const hotbar = this.inventory.getHotbar();
        const selected = this.inventory.getSelectedSlot();

        return hotbar.map((slot, index) => {
            const item = slot.itemId !== null ? getItem(slot.itemId) : null;
            const isSelected = index === selected;

            return `
                <div class="inventory-slot hotbar-slot ${isSelected ? 'selected' : ''}" 
                     data-type="hotbar" 
                     data-index="${index}">
                    ${this.renderSlotContent(item, slot.quantity)}
                    <span class="slot-number">${index + 1}</span>
                </div>
            `;
        }).join('');
    }

    private createInventoryGridHTML(): string {
        const mainInventory = this.inventory.getMainInventory();

        return mainInventory.map((slot, index) => {
            const item = slot.itemId !== null ? getItem(slot.itemId) : null;

            return `
                <div class="inventory-slot" 
                     data-type="inventory" 
                     data-index="${index}">
                    ${this.renderSlotContent(item, slot.quantity)}
                </div>
            `;
        }).join('');
    }

    private renderSlotContent(item: ItemData | null | undefined, quantity: number): string {
        if (!item) return '';

        const displayIcon = item.icon || '';
        const bgColor = item.color || '#666';

        return `
            <div class="slot-item" style="background-color: ${bgColor}">
                ${displayIcon ? `<span class="item-icon">${displayIcon}</span>` : ''}
            </div>
            ${quantity > 1 ? `<span class="item-count">${quantity}</span>` : ''}
        `;
    }

    private setupEventListeners(): void {
        // Close button
        document.getElementById('close-inventory')?.addEventListener('click', () => {
            this.closeInventory();
        });

        // Slot interactions
        this.container?.addEventListener('mousedown', (e) => this.handleSlotMouseDown(e));
        this.container?.addEventListener('mouseup', (e) => this.handleSlotMouseUp(e));
        this.container?.addEventListener('mouseover', (e) => this.handleSlotHover(e));
        this.container?.addEventListener('mouseout', () => this.hideTooltip());

        // Hotbar number keys are handled by InputManager
    }

    private handleSlotMouseDown(e: MouseEvent): void {
        const slot = (e.target as HTMLElement).closest('.inventory-slot') as HTMLElement;
        if (!slot) return;

        const type = slot.dataset.type;
        const index = parseInt(slot.dataset.index || '0');

        // Only allow dragging from inventory panel slots
        if (this.isInventoryOpen) {
            this.draggedSlot = {
                isHotbar: type === 'hotbar',
                index
            };
            slot.classList.add('dragging');
        }
    }

    private handleSlotMouseUp(e: MouseEvent): void {
        const slot = (e.target as HTMLElement).closest('.inventory-slot') as HTMLElement;

        if (this.draggedSlot && slot) {
            const type = slot.dataset.type;
            const index = parseInt(slot.dataset.index || '0');

            // Swap slots
            const toHotbar = type === 'hotbar';
            this.inventory.swapSlots(
                this.draggedSlot.isHotbar,
                this.draggedSlot.index,
                toHotbar,
                index
            );
        }

        // Clear dragging state
        document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
        this.draggedSlot = null;
    }

    private handleSlotHover(e: MouseEvent): void {
        const slot = (e.target as HTMLElement).closest('.inventory-slot') as HTMLElement;
        if (!slot) return;

        const type = slot.dataset.type;
        const index = parseInt(slot.dataset.index || '0');

        let inventorySlot: InventorySlot | null = null;

        if (type === 'hotbar') {
            const hotbar = this.inventory.getHotbar();
            inventorySlot = hotbar[index];
        } else {
            const main = this.inventory.getMainInventory();
            inventorySlot = main[index];
        }

        if (inventorySlot && inventorySlot.itemId !== null) {
            const item = getItem(inventorySlot.itemId);
            if (item) {
                this.showTooltip(item, inventorySlot.quantity, e.clientX, e.clientY);
            }
        } else {
            this.hideTooltip();
        }
    }

    private showTooltip(item: ItemData, quantity: number, x: number, y: number): void {
        if (!this.tooltipElement) return;

        const categoryLabel = this.getCategoryLabel(item.category);
        const durabilityInfo = item.durability ? `<div class="tooltip-durability">Durabilidade: ${item.durability}</div>` : '';

        this.tooltipElement.innerHTML = `
            <div class="tooltip-title">${item.icon || ''} ${item.name}</div>
            <div class="tooltip-category">${categoryLabel}</div>
            ${durabilityInfo}
            <div class="tooltip-quantity">Quantidade: ${quantity}/${item.stackSize}</div>
        `;

        this.tooltipElement.style.display = 'block';
        this.tooltipElement.style.left = `${x + 15}px`;
        this.tooltipElement.style.top = `${y + 15}px`;
    }

    private hideTooltip(): void {
        if (this.tooltipElement) {
            this.tooltipElement.style.display = 'none';
        }
    }

    private getCategoryLabel(category: ItemCategory): string {
        const labels: Record<ItemCategory, string> = {
            [ItemCategory.BLOCK]: '🧱 Bloco',
            [ItemCategory.TOOL]: '🔧 Ferramenta',
            [ItemCategory.MATERIAL]: '📦 Material',
            [ItemCategory.FOOD]: '🍖 Comida',
            [ItemCategory.MISC]: '📋 Diversos'
        };
        return labels[category] || category;
    }

    /**
     * Open the full inventory panel
     */
    public openInventory(): void {
        if (this.inventoryPanel) {
            this.inventoryPanel.style.display = 'flex';
            this.isInventoryOpen = true;
            this.render();
        }
    }

    /**
     * Close the inventory panel
     */
    public closeInventory(): void {
        if (this.inventoryPanel) {
            this.inventoryPanel.style.display = 'none';
            this.isInventoryOpen = false;
        }
    }

    /**
     * Toggle inventory visibility
     */
    public toggleInventory(): void {
        if (this.isInventoryOpen) {
            this.closeInventory();
        } else {
            this.openInventory();
        }
    }

    /**
     * Check if inventory is open
     */
    public isOpen(): boolean {
        return this.isInventoryOpen;
    }

    /**
     * Render/update the UI
     */
    public render(): void {
        // Update hotbar
        if (this.hotbarElement) {
            this.hotbarElement.innerHTML = this.createHotbarHTML();
        }

        // Update inventory panel if open
        if (this.isInventoryOpen) {
            const inventoryHotbar = document.getElementById('inventory-hotbar');
            const inventoryGrid = document.getElementById('inventory-grid');

            if (inventoryHotbar) {
                inventoryHotbar.innerHTML = this.createHotbarHTML();
            }
            if (inventoryGrid) {
                inventoryGrid.innerHTML = this.createInventoryGridHTML();
            }
        }
    }

    /**
     * Update selected slot visual
     */
    public updateSelection(): void {
        const selectedIndex = this.inventory.getSelectedSlot();

        // Update hotbar selection
        document.querySelectorAll('.hotbar-slot').forEach((slot, index) => {
            slot.classList.toggle('selected', index === selectedIndex);
        });
    }

    /**
     * Show/hide the hotbar
     */
    public showHotbar(show: boolean): void {
        if (this.hotbarElement) {
            this.hotbarElement.style.display = show ? 'flex' : 'none';
        }
    }

    /**
     * Dispose of UI elements
     */
    public dispose(): void {
        this.container?.remove();
    }
}

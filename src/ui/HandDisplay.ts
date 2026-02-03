import { Inventory } from '../inventory/Inventory';
import { ItemCategory } from '../inventory/ItemTypes';

/**
 * Hand Display Component
 * Shows the currently held item in first-person view
 */
export class HandDisplay {
    private container: HTMLElement | null = null;
    private inventory: Inventory;
    private handElement: HTMLElement | null = null;
    private itemElement: HTMLElement | null = null;
    private isSwinging: boolean = false;

    constructor(inventory: Inventory) {
        this.inventory = inventory;
        this.createDisplay();

        // Update when inventory changes
        this.inventory.onChange(() => this.updateHand());
    }

    private createDisplay(): void {
        this.container = document.createElement('div');
        this.container.id = 'hand-display';
        this.container.innerHTML = `
            <div class="hand-wrapper">
                <div class="player-hand">
                    <div class="hand-item"></div>
                </div>
            </div>
        `;

        const hud = document.getElementById('hud');
        if (hud) {
            hud.appendChild(this.container);
        } else {
            document.body.appendChild(this.container);
        }

        this.handElement = this.container.querySelector('.player-hand');
        this.itemElement = this.container.querySelector('.hand-item');

        this.updateHand();
    }

    /**
     * Update the hand display with current item
     */
    public updateHand(): void {
        if (!this.itemElement || !this.handElement) return;

        const selectedItem = this.inventory.getSelectedItem();

        if (selectedItem) {
            // Show item
            if (selectedItem.icon) {
                this.itemElement.innerHTML = `<span class="held-item-icon">${selectedItem.icon}</span>`;
            } else {
                // Show colored block
                this.itemElement.innerHTML = `<div class="held-item-block" style="background-color: ${selectedItem.color}"></div>`;
            }
            this.itemElement.title = selectedItem.name;

            // Add glow for special items
            if (selectedItem.category === ItemCategory.TOOL) {
                this.handElement.classList.add('holding-tool');
            } else {
                this.handElement.classList.remove('holding-tool');
            }
        } else {
            // Empty hand
            this.itemElement.innerHTML = '';
            this.itemElement.title = '';
            this.handElement.classList.remove('holding-tool');
        }
    }

    /**
     * Play swing animation (when mining)
     */
    public swing(): void {
        if (this.isSwinging || !this.handElement) return;

        this.isSwinging = true;
        this.handElement.classList.add('swinging');

        setTimeout(() => {
            this.handElement?.classList.remove('swinging');
            this.isSwinging = false;
        }, 200);
    }

    /**
     * Play mining animation (continuous)
     */
    public startMining(): void {
        if (!this.handElement) return;
        this.handElement.classList.add('mining');
    }

    /**
     * Stop mining animation
     */
    public stopMining(): void {
        if (!this.handElement) return;
        this.handElement.classList.remove('mining');
    }

    /**
     * Show/hide hand display
     */
    public setVisible(visible: boolean): void {
        if (this.container) {
            this.container.style.display = visible ? 'block' : 'none';
        }
    }

    /**
     * Dispose of display
     */
    public dispose(): void {
        this.container?.remove();
    }
}

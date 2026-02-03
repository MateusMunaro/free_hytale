/**
 * Block Break Progress Indicator
 * Shows progress bar when mining a block
 */
export class BreakIndicator {
    private container: HTMLElement | null = null;
    private progressFill: HTMLElement | null = null;

    constructor() {
        this.createIndicator();
    }

    private createIndicator(): void {
        this.container = document.createElement('div');
        this.container.id = 'break-indicator';
        this.container.innerHTML = `
            <div class="break-progress-container">
                <div class="break-progress-bar">
                    <div class="break-progress-fill"></div>
                </div>
            </div>
        `;
        this.container.style.display = 'none';

        const hud = document.getElementById('hud');
        if (hud) {
            hud.appendChild(this.container);
        } else {
            document.body.appendChild(this.container);
        }

        this.progressFill = this.container.querySelector('.break-progress-fill');
    }

    /**
     * Update progress (0-1)
     */
    public setProgress(progress: number): void {
        if (!this.container || !this.progressFill) return;

        if (progress <= 0) {
            this.container.style.display = 'none';
        } else {
            this.container.style.display = 'block';
            this.progressFill.style.width = `${progress * 100}%`;

            // Change color based on progress
            if (progress < 0.33) {
                this.progressFill.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
            } else if (progress < 0.66) {
                this.progressFill.style.background = 'linear-gradient(90deg, #eab308, #facc15)';
            } else {
                this.progressFill.style.background = 'linear-gradient(90deg, #22c55e, #4ade80)';
            }
        }
    }

    /**
     * Hide indicator
     */
    public hide(): void {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }

    /**
     * Dispose
     */
    public dispose(): void {
        this.container?.remove();
    }
}

export class HUD {
    private debugInfo: HTMLElement | null;
    private hudElement: HTMLElement | null;
    private loadingScreen: HTMLElement | null;
    private startScreen: HTMLElement | null;

    constructor() {
        this.debugInfo = document.querySelector('.debug-info');
        this.hudElement = document.getElementById('hud');
        this.loadingScreen = document.getElementById('loading-screen');
        this.startScreen = document.getElementById('start-screen');
    }

    public showLoading(): void {
        if (this.loadingScreen) {
            this.loadingScreen.style.display = 'flex';
        }
        if (this.startScreen) {
            this.startScreen.style.display = 'none';
        }
        if (this.hudElement) {
            this.hudElement.style.display = 'none';
        }
    }

    public showStartScreen(): void {
        if (this.loadingScreen) {
            this.loadingScreen.style.display = 'none';
        }
        if (this.startScreen) {
            this.startScreen.style.display = 'flex';
        }
        if (this.hudElement) {
            this.hudElement.style.display = 'none';
        }
    }

    public showGame(): void {
        if (this.loadingScreen) {
            this.loadingScreen.style.display = 'none';
        }
        if (this.startScreen) {
            this.startScreen.style.display = 'none';
        }
        if (this.hudElement) {
            this.hudElement.style.display = 'block';
        }
    }

    public updateDebugInfo(data: {
        fps: number;
        x: number;
        y: number;
        z: number;
        chunksLoaded: number;
        chunksRendered: number;
    }): void {
        if (!this.debugInfo) return;

        this.debugInfo.innerHTML = `
      <span class="fps">FPS: ${data.fps.toFixed(0)}</span>
      <span class="pos">X: ${data.x.toFixed(1)} Y: ${data.y.toFixed(1)} Z: ${data.z.toFixed(1)}</span>
      <span class="chunks">Chunks: ${data.chunksRendered}/${data.chunksLoaded}</span>
    `;
    }
}

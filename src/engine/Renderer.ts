import * as THREE from 'three';
import { Sky } from '../graphics/Sky';

export interface RendererConfig {
    antialias: boolean;
    shadows: boolean;
    fog: boolean;
    fogColor: number;
    fogNear: number;
    fogFar: number;
}

const DEFAULT_RENDERER_CONFIG: RendererConfig = {
    antialias: true,
    shadows: true,
    fog: true,
    fogColor: 0x89cff0,
    fogNear: 50,
    fogFar: 200
};

export class Renderer {
    public renderer: THREE.WebGLRenderer;
    public scene: THREE.Scene;
    public sky: Sky;

    private canvas: HTMLCanvasElement;
    private config: RendererConfig;

    constructor(canvas: HTMLCanvasElement, config: Partial<RendererConfig> = {}) {
        this.canvas = canvas;
        this.config = { ...DEFAULT_RENDERER_CONFIG, ...config };

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: this.config.antialias,
            powerPreference: 'high-performance'
        });

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        // Shadows
        if (this.config.shadows) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }

        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.config.fogColor);

        // Fog
        if (this.config.fog) {
            this.scene.fog = new THREE.Fog(
                this.config.fogColor,
                this.config.fogNear,
                this.config.fogFar
            );
        }

        // Create sky
        this.sky = new Sky(this.scene);

        // Handle resize
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    private handleResize(): void {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.renderer.setSize(width, height);
    }

    public render(camera: THREE.PerspectiveCamera): void {
        this.renderer.render(this.scene, camera);
    }

    public getAspect(): number {
        return window.innerWidth / window.innerHeight;
    }

    public dispose(): void {
        this.renderer.dispose();
        this.sky.dispose();
        window.removeEventListener('resize', this.handleResize.bind(this));
    }
}

import * as THREE from 'three';
import { BlockType } from '../world/BlockTypes';

interface TextureSet {
    top: THREE.Texture;
    side: THREE.Texture;
    bottom: THREE.Texture;
}

/**
 * Enhanced Texture Manager with procedural textures and variation support
 * Creates high-quality, varied textures for a more natural look
 */
export class TextureManager {
    private textures: Map<BlockType, TextureSet> = new Map();
    private grassVariations: THREE.Texture[] = [];
    private textureSize: number = 128; // Increased for more detail

    constructor() {
        this.generateAllTextures();
        this.generateGrassVariations();
    }

    private generateAllTextures(): void {
        // Generate textures for each block type
        this.textures.set(BlockType.GRASS, this.createGrassTextures());
        this.textures.set(BlockType.DIRT, this.createDirtTextures());
        this.textures.set(BlockType.STONE, this.createStoneTextures());
        this.textures.set(BlockType.SAND, this.createSandTextures());
        this.textures.set(BlockType.WOOD, this.createWoodTextures());
        this.textures.set(BlockType.LEAVES, this.createLeavesTextures());
        this.textures.set(BlockType.SNOW, this.createSnowTextures());
        this.textures.set(BlockType.BEDROCK, this.createBedrockTextures());
        this.textures.set(BlockType.WATER, this.createWaterTextures());

        // Vegetation textures
        this.textures.set(BlockType.TALL_GRASS, this.createTallGrassTextures());
        this.textures.set(BlockType.FERN, this.createFernTextures());
        this.textures.set(BlockType.DEAD_BUSH, this.createDeadBushTextures());
        this.textures.set(BlockType.FLOWER_RED, this.createFlowerTextures(0xdc143c, 0x228b22));
        this.textures.set(BlockType.FLOWER_YELLOW, this.createFlowerTextures(0xffd700, 0x228b22));
        this.textures.set(BlockType.FLOWER_BLUE, this.createFlowerTextures(0x4169e1, 0x228b22));
        this.textures.set(BlockType.FLOWER_WHITE, this.createFlowerTextures(0xffffff, 0x228b22));
        this.textures.set(BlockType.MUSHROOM_RED, this.createMushroomTextures(0xb22222, 0xffffff));
        this.textures.set(BlockType.MUSHROOM_BROWN, this.createMushroomTextures(0x8b4513, 0xf5f5dc));
    }

    private generateGrassVariations(): void {
        // Create 4 grass variations for more natural look
        for (let i = 0; i < 4; i++) {
            const variation = this.createGrassVariationTexture(i);
            this.grassVariations.push(variation);
        }
    }

    private createCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
        const canvas = document.createElement('canvas');
        canvas.width = this.textureSize;
        canvas.height = this.textureSize;
        const ctx = canvas.getContext('2d')!;
        return { canvas, ctx };
    }

    private canvasToTexture(canvas: HTMLCanvasElement): THREE.Texture {
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestMipmapLinearFilter;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.generateMipmaps = true;
        return texture;
    }

    /**
     * Improved noise with Perlin-like smoothness
     */
    private addPerlinNoise(ctx: CanvasRenderingContext2D, intensity: number = 0.1, scale: number = 1): void {
        const imageData = ctx.getImageData(0, 0, this.textureSize, this.textureSize);
        const data = imageData.data;

        for (let y = 0; y < this.textureSize; y++) {
            for (let x = 0; x < this.textureSize; x++) {
                const i = (y * this.textureSize + x) * 4;
                // Simple value noise with interpolation
                const nx = x / scale;
                const ny = y / scale;
                const noise = (Math.sin(nx * 12.9898 + ny * 78.233) * 43758.5453 % 1 - 0.5) * 255 * intensity;

                data[i] = Math.max(0, Math.min(255, data[i] + noise));
                data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
                data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Add color variation for more natural look
     */
    private addColorVariation(ctx: CanvasRenderingContext2D, hueRange: number = 10, satRange: number = 0.1, lightRange: number = 0.1): void {
        const imageData = ctx.getImageData(0, 0, this.textureSize, this.textureSize);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i] / 255;
            const g = data[i + 1] / 255;
            const b = data[i + 2] / 255;

            // Convert to HSL
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            let h = 0, s = 0, l = (max + min) / 2;

            if (max !== min) {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

                switch (max) {
                    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                    case g: h = ((b - r) / d + 2) / 6; break;
                    case b: h = ((r - g) / d + 4) / 6; break;
                }
            }

            // Apply variation
            h += (Math.random() - 0.5) * (hueRange / 360);
            s = Math.max(0, Math.min(1, s + (Math.random() - 0.5) * satRange));
            l = Math.max(0, Math.min(1, l + (Math.random() - 0.5) * lightRange));

            // Convert back to RGB
            let r2: number, g2: number, b2: number;
            if (s === 0) {
                r2 = g2 = b2 = l;
            } else {
                const hue2rgb = (p: number, q: number, t: number) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1 / 6) return p + (q - p) * 6 * t;
                    if (t < 1 / 2) return q;
                    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                    return p;
                };
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                r2 = hue2rgb(p, q, h + 1 / 3);
                g2 = hue2rgb(p, q, h);
                b2 = hue2rgb(p, q, h - 1 / 3);
            }

            data[i] = Math.round(r2 * 255);
            data[i + 1] = Math.round(g2 * 255);
            data[i + 2] = Math.round(b2 * 255);
        }

        ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Draw grass blades for realistic grass texture
     */
    private drawGrassBlades(ctx: CanvasRenderingContext2D, density: number = 150): void {
        const colors = [
            '#4a8f2c', '#5a9f3c', '#6aaf4c', '#7abf5c',
            '#4a7f2c', '#3a6f1c', '#5aaf3c', '#6abf4c'
        ];

        for (let i = 0; i < density; i++) {
            const x = Math.random() * this.textureSize;
            const y = Math.random() * this.textureSize;
            const height = 3 + Math.random() * 6;
            const width = 1 + Math.random() * 2;
            const color = colors[Math.floor(Math.random() * colors.length)];

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - width / 2, y - height);
            ctx.lineTo(x + width / 2, y - height);
            ctx.closePath();
            ctx.fill();
        }
    }

    private createGrassVariationTexture(variation: number): THREE.Texture {
        const { canvas, ctx } = this.createCanvas();

        // Base colors vary by variation
        const baseColors = ['#5a9f3c', '#4a8f2c', '#6aaf4c', '#5aaf3c'];
        ctx.fillStyle = baseColors[variation % baseColors.length];
        ctx.fillRect(0, 0, this.textureSize, this.textureSize);

        // Add different grass patterns per variation
        this.drawGrassBlades(ctx, 180 + variation * 20);

        // Add subtle variation
        this.addColorVariation(ctx, 15, 0.15, 0.1);
        this.addPerlinNoise(ctx, 0.08, 8);

        return this.canvasToTexture(canvas);
    }

    private createGrassTextures(): TextureSet {
        // TOP - Detailed grass with blades
        const { canvas: topCanvas, ctx: topCtx } = this.createCanvas();

        // Gradient base
        const gradient = topCtx.createRadialGradient(
            this.textureSize / 2, this.textureSize / 2, 0,
            this.textureSize / 2, this.textureSize / 2, this.textureSize / 1.5
        );
        gradient.addColorStop(0, '#5aaf4c');
        gradient.addColorStop(1, '#4a8f3c');
        topCtx.fillStyle = gradient;
        topCtx.fillRect(0, 0, this.textureSize, this.textureSize);

        // Draw detailed grass blades
        this.drawGrassBlades(topCtx, 250);

        // Add small details
        for (let i = 0; i < 100; i++) {
            const x = Math.random() * this.textureSize;
            const y = Math.random() * this.textureSize;
            const shade = Math.random();
            topCtx.fillStyle = `rgba(${70 + shade * 50}, ${160 + shade * 40}, ${50 + shade * 30}, 0.7)`;
            topCtx.fillRect(x, y, 2 + Math.random() * 3, 2 + Math.random() * 3);
        }

        this.addColorVariation(topCtx, 20, 0.15, 0.12);
        this.addPerlinNoise(topCtx, 0.06, 10);

        // SIDE - Dirt with grass layer on top
        const { canvas: sideCanvas, ctx: sideCtx } = this.createCanvas();

        // Dirt base
        const dirtGradient = sideCtx.createLinearGradient(0, 20, 0, this.textureSize);
        dirtGradient.addColorStop(0, '#8b6c42');
        dirtGradient.addColorStop(0.3, '#7b5c32');
        dirtGradient.addColorStop(1, '#6b4c22');
        sideCtx.fillStyle = dirtGradient;
        sideCtx.fillRect(0, 0, this.textureSize, this.textureSize);

        // Grass layer on top
        const grassGradient = sideCtx.createLinearGradient(0, 0, 0, 25);
        grassGradient.addColorStop(0, '#5aaf4c');
        grassGradient.addColorStop(1, '#4a8f3c');
        sideCtx.fillStyle = grassGradient;
        sideCtx.fillRect(0, 0, this.textureSize, 18);

        // Hanging grass
        for (let x = 0; x < this.textureSize; x += 3) {
            const height = 12 + Math.random() * 16;
            const hue = Math.random() * 30;
            sideCtx.fillStyle = `hsl(${100 + hue}, 60%, ${30 + Math.random() * 15}%)`;
            sideCtx.fillRect(x, 15, 2, height);
        }

        // Dirt texture details
        for (let i = 0; i < 150; i++) {
            const x = Math.random() * this.textureSize;
            const y = 25 + Math.random() * (this.textureSize - 25);
            const colors = ['#7a5c32', '#9b7c52', '#6b4c22', '#ab8c62', '#5b3c12'];
            sideCtx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
            sideCtx.fillRect(x, y, 3 + Math.random() * 5, 3 + Math.random() * 5);
        }

        // Add small roots
        sideCtx.strokeStyle = '#4a3c22';
        sideCtx.lineWidth = 1;
        for (let i = 0; i < 15; i++) {
            const x = Math.random() * this.textureSize;
            const y = 25 + Math.random() * 20;
            sideCtx.beginPath();
            sideCtx.moveTo(x, y);
            sideCtx.quadraticCurveTo(
                x + (Math.random() - 0.5) * 15,
                y + 10,
                x + (Math.random() - 0.5) * 20,
                y + 15 + Math.random() * 15
            );
            sideCtx.stroke();
        }

        this.addPerlinNoise(sideCtx, 0.1, 6);

        // BOTTOM - Rich dirt texture
        const { canvas: bottomCanvas, ctx: bottomCtx } = this.createCanvas();
        bottomCtx.fillStyle = '#8b6c42';
        bottomCtx.fillRect(0, 0, this.textureSize, this.textureSize);

        for (let i = 0; i < 120; i++) {
            const x = Math.random() * this.textureSize;
            const y = Math.random() * this.textureSize;
            const colors = ['#7a5c32', '#9b7c52', '#6b4c22', '#ab8c62'];
            bottomCtx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
            bottomCtx.fillRect(x, y, 4 + Math.random() * 6, 4 + Math.random() * 6);
        }

        this.addPerlinNoise(bottomCtx, 0.12, 8);

        return {
            top: this.canvasToTexture(topCanvas),
            side: this.canvasToTexture(sideCanvas),
            bottom: this.canvasToTexture(bottomCanvas)
        };
    }

    private createDirtTextures(): TextureSet {
        const createDirt = () => {
            const { canvas, ctx } = this.createCanvas();

            // Gradient base for depth
            const gradient = ctx.createRadialGradient(
                this.textureSize / 2, this.textureSize / 2, 0,
                this.textureSize / 2, this.textureSize / 2, this.textureSize
            );
            gradient.addColorStop(0, '#9b7c52');
            gradient.addColorStop(1, '#7b5c32');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, this.textureSize, this.textureSize);

            // Layered dirt patches for depth
            for (let layer = 0; layer < 3; layer++) {
                const count = 60 - layer * 15;
                for (let i = 0; i < count; i++) {
                    const x = Math.random() * this.textureSize;
                    const y = Math.random() * this.textureSize;
                    const colors = ['#7a5c32', '#9b7c52', '#6b4c22', '#ab8c62', '#5b3c12', '#bb9c72'];
                    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
                    const size = 3 + layer * 2 + Math.random() * (4 + layer * 2);
                    ctx.fillRect(x, y, size, size);
                }
            }

            // Small stones and pebbles
            for (let i = 0; i < 25; i++) {
                const x = Math.random() * this.textureSize;
                const y = Math.random() * this.textureSize;
                const gray = 80 + Math.random() * 40;
                ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
                ctx.beginPath();
                ctx.ellipse(x, y, 1.5 + Math.random() * 2, 1 + Math.random() * 1.5, Math.random() * Math.PI, 0, Math.PI * 2);
                ctx.fill();
            }

            this.addColorVariation(ctx, 8, 0.1, 0.1);
            this.addPerlinNoise(ctx, 0.12, 6);
            return this.canvasToTexture(canvas);
        };

        const texture = createDirt();
        return { top: texture, side: texture, bottom: texture };
    }

    private createStoneTextures(): TextureSet {
        const createStone = () => {
            const { canvas, ctx } = this.createCanvas();

            // Base with subtle gradient
            const gradient = ctx.createLinearGradient(0, 0, this.textureSize, this.textureSize);
            gradient.addColorStop(0, '#8a8a8a');
            gradient.addColorStop(0.5, '#7a7a7a');
            gradient.addColorStop(1, '#6a6a6a');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, this.textureSize, this.textureSize);

            // Large stone variations
            for (let i = 0; i < 40; i++) {
                const x = Math.random() * this.textureSize;
                const y = Math.random() * this.textureSize;
                const gray = 90 + Math.random() * 80;
                ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
                const size = 8 + Math.random() * 15;
                ctx.beginPath();
                ctx.ellipse(x, y, size, size * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
                ctx.fill();
            }

            // Medium details
            for (let i = 0; i < 80; i++) {
                const x = Math.random() * this.textureSize;
                const y = Math.random() * this.textureSize;
                const colors = ['#6a6a6a', '#8a8a8a', '#5a5a5a', '#9a9a9a', '#7a7a7a'];
                ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
                ctx.fillRect(x, y, 4 + Math.random() * 8, 4 + Math.random() * 8);
            }

            // Cracks
            ctx.strokeStyle = '#4a4a4a';
            ctx.lineWidth = 1;
            for (let i = 0; i < 12; i++) {
                ctx.beginPath();
                const startX = Math.random() * this.textureSize;
                const startY = Math.random() * this.textureSize;
                ctx.moveTo(startX, startY);

                let x = startX, y = startY;
                for (let j = 0; j < 3 + Math.random() * 4; j++) {
                    x += (Math.random() - 0.5) * 20;
                    y += (Math.random() - 0.5) * 20;
                    ctx.lineTo(x, y);
                }
                ctx.stroke();
            }

            // Mineral specks
            for (let i = 0; i < 15; i++) {
                const x = Math.random() * this.textureSize;
                const y = Math.random() * this.textureSize;
                ctx.fillStyle = Math.random() > 0.5 ? '#a0a0a0' : '#505050';
                ctx.beginPath();
                ctx.arc(x, y, 1, 0, Math.PI * 2);
                ctx.fill();
            }

            this.addPerlinNoise(ctx, 0.08, 8);
            return this.canvasToTexture(canvas);
        };

        const texture = createStone();
        return { top: texture, side: texture, bottom: texture };
    }

    private createSandTextures(): TextureSet {
        const createSand = () => {
            const { canvas, ctx } = this.createCanvas();

            // Base gradient
            const gradient = ctx.createRadialGradient(
                this.textureSize / 2, this.textureSize / 2, 0,
                this.textureSize / 2, this.textureSize / 2, this.textureSize
            );
            gradient.addColorStop(0, '#f8e4b8');
            gradient.addColorStop(1, '#e8d4a8');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, this.textureSize, this.textureSize);

            // Individual sand grains
            const grainColors = ['#d8c498', '#f8e4b8', '#c8b488', '#ffe4c8', '#e8d4a8', '#f0dca0'];
            for (let i = 0; i < 500; i++) {
                const x = Math.random() * this.textureSize;
                const y = Math.random() * this.textureSize;
                ctx.fillStyle = grainColors[Math.floor(Math.random() * grainColors.length)];
                ctx.fillRect(x, y, 1 + Math.random(), 1 + Math.random());
            }

            // Larger sand clumps
            for (let i = 0; i < 30; i++) {
                const x = Math.random() * this.textureSize;
                const y = Math.random() * this.textureSize;
                ctx.fillStyle = Math.random() > 0.5 ? '#d8c498' : '#c8b488';
                ctx.beginPath();
                ctx.arc(x, y, 2 + Math.random() * 3, 0, Math.PI * 2);
                ctx.fill();
            }

            this.addColorVariation(ctx, 5, 0.05, 0.08);
            this.addPerlinNoise(ctx, 0.06, 12);
            return this.canvasToTexture(canvas);
        };

        const texture = createSand();
        return { top: texture, side: texture, bottom: texture };
    }

    private createWoodTextures(): TextureSet {
        // TOP/BOTTOM - Tree rings
        const createRings = () => {
            const { canvas, ctx } = this.createCanvas();
            ctx.fillStyle = '#8b6423';
            ctx.fillRect(0, 0, this.textureSize, this.textureSize);

            const cx = this.textureSize / 2;
            const cy = this.textureSize / 2;

            // Draw rings with varying thickness
            for (let r = 4; r < this.textureSize / 2; r += 3 + Math.random() * 2) {
                const brightness = r % 8 < 4 ? 0.85 : 1.15;
                ctx.strokeStyle = `rgb(${Math.floor(107 * brightness)}, ${Math.floor(68 * brightness)}, ${Math.floor(19 * brightness)})`;
                ctx.lineWidth = 1 + Math.random();
                ctx.beginPath();
                ctx.arc(cx + (Math.random() - 0.5) * 3, cy + (Math.random() - 0.5) * 3, r, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Add some radial cracks
            ctx.strokeStyle = '#5b4413';
            ctx.lineWidth = 0.5;
            for (let i = 0; i < 4; i++) {
                const angle = Math.random() * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(
                    cx + Math.cos(angle) * this.textureSize / 2,
                    cy + Math.sin(angle) * this.textureSize / 2
                );
                ctx.stroke();
            }

            this.addPerlinNoise(ctx, 0.08, 6);
            return this.canvasToTexture(canvas);
        };

        // SIDE - Bark texture
        const createBark = () => {
            const { canvas, ctx } = this.createCanvas();
            ctx.fillStyle = '#6b4423';
            ctx.fillRect(0, 0, this.textureSize, this.textureSize);

            // Vertical bark ridges
            for (let x = 0; x < this.textureSize; x += 6 + Math.random() * 4) {
                const offset = Math.random() * 3;
                const width = 4 + Math.random() * 4;

                // Dark groove
                ctx.fillStyle = '#4b2413';
                ctx.fillRect(x + offset, 0, 2, this.textureSize);

                // Ridge
                ctx.fillStyle = '#7b5433';
                ctx.fillRect(x + offset + 2, 0, width, this.textureSize);

                // Highlight
                ctx.fillStyle = '#8b6443';
                ctx.fillRect(x + offset + 3, 0, 1, this.textureSize);
            }

            // Horizontal bark details
            for (let i = 0; i < 50; i++) {
                const x = Math.random() * this.textureSize;
                const y = Math.random() * this.textureSize;
                ctx.fillStyle = Math.random() > 0.5 ? '#4b2403' : '#8b5433';
                ctx.fillRect(x, y, 8 + Math.random() * 10, 2 + Math.random() * 3);
            }

            this.addPerlinNoise(ctx, 0.1, 8);
            return this.canvasToTexture(canvas);
        };

        const rings = createRings();
        return { top: rings, side: createBark(), bottom: rings };
    }

    private createLeavesTextures(): TextureSet {
        const createLeaves = () => {
            const { canvas, ctx } = this.createCanvas();
            ctx.fillStyle = '#2e7d32';
            ctx.fillRect(0, 0, this.textureSize, this.textureSize);

            // Multiple layers of leaves
            const leafColors = ['#1e6d22', '#3e8d42', '#4e9d52', '#2e7d32', '#388e3c', '#43a047'];

            for (let layer = 0; layer < 3; layer++) {
                for (let i = 0; i < 80; i++) {
                    const x = Math.random() * this.textureSize;
                    const y = Math.random() * this.textureSize;
                    ctx.fillStyle = leafColors[Math.floor(Math.random() * leafColors.length)];

                    // Draw leaf shape
                    ctx.beginPath();
                    const size = 3 + Math.random() * 5;
                    ctx.ellipse(x, y, size, size * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Add some darker spots (shadows/holes)
            for (let i = 0; i < 50; i++) {
                const x = Math.random() * this.textureSize;
                const y = Math.random() * this.textureSize;
                ctx.fillStyle = '#1a5a1a';
                ctx.beginPath();
                ctx.arc(x, y, 1 + Math.random() * 2, 0, Math.PI * 2);
                ctx.fill();
            }

            // Light highlights
            for (let i = 0; i < 30; i++) {
                const x = Math.random() * this.textureSize;
                const y = Math.random() * this.textureSize;
                ctx.fillStyle = 'rgba(100, 200, 100, 0.3)';
                ctx.beginPath();
                ctx.arc(x, y, 1 + Math.random(), 0, Math.PI * 2);
                ctx.fill();
            }

            this.addColorVariation(ctx, 15, 0.1, 0.08);
            this.addPerlinNoise(ctx, 0.12, 6);
            return this.canvasToTexture(canvas);
        };

        const texture = createLeaves();
        return { top: texture, side: texture, bottom: texture };
    }

    private createSnowTextures(): TextureSet {
        const createSnow = () => {
            const { canvas, ctx } = this.createCanvas();

            // Base white with subtle blue tint
            const gradient = ctx.createRadialGradient(
                this.textureSize / 2, this.textureSize / 2, 0,
                this.textureSize / 2, this.textureSize / 2, this.textureSize
            );
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(1, '#f0f5ff');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, this.textureSize, this.textureSize);

            // Snow texture variation
            for (let i = 0; i < 300; i++) {
                const x = Math.random() * this.textureSize;
                const y = Math.random() * this.textureSize;
                const gray = 235 + Math.random() * 20;
                ctx.fillStyle = `rgb(${gray}, ${gray}, ${Math.min(255, gray + 5)})`;
                ctx.fillRect(x, y, 2 + Math.random() * 2, 2 + Math.random() * 2);
            }

            // Sparkles
            for (let i = 0; i < 30; i++) {
                const x = Math.random() * this.textureSize;
                const y = Math.random() * this.textureSize;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(x, y, 0.5 + Math.random() * 1, 0, Math.PI * 2);
                ctx.fill();
            }

            // Subtle shadows
            for (let i = 0; i < 20; i++) {
                const x = Math.random() * this.textureSize;
                const y = Math.random() * this.textureSize;
                ctx.fillStyle = 'rgba(200, 210, 230, 0.3)';
                const size = 5 + Math.random() * 8;
                ctx.beginPath();
                ctx.ellipse(x, y, size, size * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            this.addPerlinNoise(ctx, 0.03, 12);
            return this.canvasToTexture(canvas);
        };

        const texture = createSnow();
        return { top: texture, side: texture, bottom: texture };
    }

    private createBedrockTextures(): TextureSet {
        const createBedrock = () => {
            const { canvas, ctx } = this.createCanvas();
            ctx.fillStyle = '#2c2c2c';
            ctx.fillRect(0, 0, this.textureSize, this.textureSize);

            // Chaotic pattern
            for (let i = 0; i < 150; i++) {
                const x = Math.random() * this.textureSize;
                const y = Math.random() * this.textureSize;
                const colors = ['#1c1c1c', '#3c3c3c', '#0c0c0c', '#4c4c4c', '#2a2a2a'];
                ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
                const size = 4 + Math.random() * 12;
                ctx.beginPath();
                const sides = 3 + Math.floor(Math.random() * 4);
                ctx.moveTo(x + size, y);
                for (let s = 1; s <= sides; s++) {
                    const angle = (s / sides) * Math.PI * 2;
                    ctx.lineTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
                }
                ctx.fill();
            }

            this.addPerlinNoise(ctx, 0.15, 4);
            return this.canvasToTexture(canvas);
        };

        const texture = createBedrock();
        return { top: texture, side: texture, bottom: texture };
    }

    private createWaterTextures(): TextureSet {
        const createWater = () => {
            const { canvas, ctx } = this.createCanvas();

            // Base water color with gradient
            const gradient = ctx.createLinearGradient(0, 0, this.textureSize, this.textureSize);
            gradient.addColorStop(0, '#3498db');
            gradient.addColorStop(0.5, '#2980b9');
            gradient.addColorStop(1, '#3498db');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, this.textureSize, this.textureSize);

            // Wave patterns
            ctx.strokeStyle = '#2980b9';
            ctx.lineWidth = 2;
            for (let y = 0; y < this.textureSize; y += 10) {
                ctx.beginPath();
                for (let x = 0; x < this.textureSize; x += 3) {
                    const offset = Math.sin(x * 0.15 + y * 0.08) * 3;
                    if (x === 0) {
                        ctx.moveTo(x, y + offset);
                    } else {
                        ctx.lineTo(x, y + offset);
                    }
                }
                ctx.stroke();
            }

            // Highlights
            for (let i = 0; i < 50; i++) {
                const x = Math.random() * this.textureSize;
                const y = Math.random() * this.textureSize;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.fillRect(x, y, 4 + Math.random() * 6, 2);
            }

            return this.canvasToTexture(canvas);
        };

        const texture = createWater();
        return { top: texture, side: texture, bottom: texture };
    }

    // === VEGETATION TEXTURES ===

    private createTallGrassTextures(): TextureSet {
        const createTallGrass = () => {
            const { canvas, ctx } = this.createCanvas();

            // Transparent background
            ctx.clearRect(0, 0, this.textureSize, this.textureSize);

            // Draw grass blades
            const grassColors = ['#7cb342', '#8bc34a', '#689f38', '#558b2f', '#9ccc65'];

            for (let i = 0; i < 15; i++) {
                const baseX = 8 + (i / 15) * (this.textureSize - 16);
                const baseY = this.textureSize;
                const height = this.textureSize * (0.6 + Math.random() * 0.35);
                const width = 2 + Math.random() * 3;
                const bendDirection = (Math.random() - 0.5) * 20;

                ctx.fillStyle = grassColors[Math.floor(Math.random() * grassColors.length)];
                ctx.beginPath();
                ctx.moveTo(baseX - width / 2, baseY);

                // Create curved blade
                const cp1x = baseX + bendDirection * 0.3;
                const cp1y = baseY - height * 0.5;
                const tipX = baseX + bendDirection * 1.2;
                const tipY = baseY - height;

                ctx.quadraticCurveTo(cp1x - width / 2, cp1y, tipX, tipY);
                ctx.lineTo(tipX + 1, tipY);
                ctx.quadraticCurveTo(cp1x + width / 2, cp1y, baseX + width / 2, baseY);
                ctx.closePath();
                ctx.fill();
            }

            return this.canvasToTexture(canvas);
        };

        const texture = createTallGrass();
        return { top: texture, side: texture, bottom: texture };
    }

    private createFernTextures(): TextureSet {
        const createFern = () => {
            const { canvas, ctx } = this.createCanvas();
            ctx.clearRect(0, 0, this.textureSize, this.textureSize);

            const fernColor = '#558b2f';
            const darkFernColor = '#33691e';

            // Main stem
            const stemX = this.textureSize / 2;
            ctx.strokeStyle = darkFernColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(stemX, this.textureSize);
            ctx.lineTo(stemX, this.textureSize * 0.15);
            ctx.stroke();

            // Draw fronds
            for (let y = this.textureSize * 0.2; y < this.textureSize * 0.9; y += 8) {
                const size = (1 - (y / this.textureSize)) * 25 + 5;

                // Left frond
                ctx.fillStyle = fernColor;
                ctx.beginPath();
                ctx.moveTo(stemX - 2, y);
                ctx.quadraticCurveTo(stemX - size, y - 3, stemX - size * 1.2, y + 2);
                ctx.lineTo(stemX - 2, y + 3);
                ctx.closePath();
                ctx.fill();

                // Right frond
                ctx.beginPath();
                ctx.moveTo(stemX + 2, y);
                ctx.quadraticCurveTo(stemX + size, y - 3, stemX + size * 1.2, y + 2);
                ctx.lineTo(stemX + 2, y + 3);
                ctx.closePath();
                ctx.fill();
            }

            return this.canvasToTexture(canvas);
        };

        const texture = createFern();
        return { top: texture, side: texture, bottom: texture };
    }

    private createDeadBushTextures(): TextureSet {
        const createDeadBush = () => {
            const { canvas, ctx } = this.createCanvas();
            ctx.clearRect(0, 0, this.textureSize, this.textureSize);

            const bushColor = '#8b7355';
            const darkBushColor = '#6b5335';

            // Draw branches
            const drawBranch = (x: number, y: number, angle: number, length: number, depth: number) => {
                if (depth === 0 || length < 3) return;

                const endX = x + Math.cos(angle) * length;
                const endY = y + Math.sin(angle) * length;

                ctx.strokeStyle = depth > 1 ? bushColor : darkBushColor;
                ctx.lineWidth = depth * 0.5;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(endX, endY);
                ctx.stroke();

                // Branch out
                const branchAngle = angle + (Math.random() - 0.5) * 1.2;
                drawBranch(endX, endY, branchAngle - 0.4, length * 0.7, depth - 1);
                drawBranch(endX, endY, branchAngle + 0.4, length * 0.7, depth - 1);
            };

            // Main branches from center bottom
            const centerX = this.textureSize / 2;
            const centerY = this.textureSize;

            for (let i = 0; i < 5; i++) {
                const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
                drawBranch(centerX, centerY, angle, 30 + Math.random() * 20, 4);
            }

            return this.canvasToTexture(canvas);
        };

        const texture = createDeadBush();
        return { top: texture, side: texture, bottom: texture };
    }

    private createFlowerTextures(petalColor: number, stemColor: number): TextureSet {
        const createFlower = () => {
            const { canvas, ctx } = this.createCanvas();
            ctx.clearRect(0, 0, this.textureSize, this.textureSize);

            const cx = this.textureSize / 2;
            const cy = this.textureSize * 0.35;

            // Stem
            ctx.strokeStyle = `#${stemColor.toString(16).padStart(6, '0')}`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(cx, this.textureSize);
            ctx.quadraticCurveTo(cx - 5, this.textureSize * 0.7, cx, cy + 10);
            ctx.stroke();

            // Leaves on stem
            ctx.fillStyle = '#228b22';
            ctx.beginPath();
            ctx.ellipse(cx - 8, this.textureSize * 0.65, 8, 4, -0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(cx + 8, this.textureSize * 0.75, 8, 4, 0.3, 0, Math.PI * 2);
            ctx.fill();

            // Petals
            ctx.fillStyle = `#${petalColor.toString(16).padStart(6, '0')}`;
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
                const petalX = cx + Math.cos(angle) * 12;
                const petalY = cy + Math.sin(angle) * 12;

                ctx.beginPath();
                ctx.ellipse(petalX, petalY, 10, 6, angle, 0, Math.PI * 2);
                ctx.fill();
            }

            // Center
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(cx, cy, 6, 0, Math.PI * 2);
            ctx.fill();

            return this.canvasToTexture(canvas);
        };

        const texture = createFlower();
        return { top: texture, side: texture, bottom: texture };
    }

    private createMushroomTextures(capColor: number, spotColor: number): TextureSet {
        const createMushroom = () => {
            const { canvas, ctx } = this.createCanvas();
            ctx.clearRect(0, 0, this.textureSize, this.textureSize);

            const cx = this.textureSize / 2;

            // Stem
            ctx.fillStyle = '#f5f5dc';
            ctx.beginPath();
            ctx.moveTo(cx - 8, this.textureSize);
            ctx.lineTo(cx - 6, this.textureSize * 0.5);
            ctx.lineTo(cx + 6, this.textureSize * 0.5);
            ctx.lineTo(cx + 8, this.textureSize);
            ctx.closePath();
            ctx.fill();

            // Cap
            ctx.fillStyle = `#${capColor.toString(16).padStart(6, '0')}`;
            ctx.beginPath();
            ctx.ellipse(cx, this.textureSize * 0.4, 25, 18, 0, Math.PI, 0);
            ctx.closePath();
            ctx.fill();

            // Spots on cap
            ctx.fillStyle = `#${spotColor.toString(16).padStart(6, '0')}`;
            const spots = [
                { x: -10, y: -5, r: 4 },
                { x: 8, y: -8, r: 3 },
                { x: 0, y: -12, r: 5 },
                { x: 15, y: -3, r: 3 },
                { x: -15, y: -10, r: 2 }
            ];

            for (const spot of spots) {
                ctx.beginPath();
                ctx.arc(cx + spot.x, this.textureSize * 0.4 + spot.y, spot.r, 0, Math.PI * 2);
                ctx.fill();
            }

            return this.canvasToTexture(canvas);
        };

        const texture = createMushroom();
        return { top: texture, side: texture, bottom: texture };
    }

    // === PUBLIC METHODS ===

    public getTextures(blockType: BlockType): TextureSet | undefined {
        return this.textures.get(blockType);
    }

    /**
     * Get a grass variation texture based on world position
     * This creates variety in the grass appearance across the terrain
     */
    public getGrassVariation(worldX: number, worldZ: number): THREE.Texture {
        // Use position-based hash to select variation
        const hash = Math.abs(Math.sin(worldX * 12.9898 + worldZ * 78.233) * 43758.5453);
        const index = Math.floor(hash % this.grassVariations.length);
        return this.grassVariations[index];
    }

    public dispose(): void {
        for (const textureSet of this.textures.values()) {
            textureSet.top.dispose();
            textureSet.side.dispose();
            textureSet.bottom.dispose();
        }
        this.textures.clear();

        for (const texture of this.grassVariations) {
            texture.dispose();
        }
        this.grassVariations = [];
    }
}

// Singleton instance
let textureManagerInstance: TextureManager | null = null;

export function getTextureManager(): TextureManager {
    if (!textureManagerInstance) {
        textureManagerInstance = new TextureManager();
    }
    return textureManagerInstance;
}

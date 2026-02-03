/**
 * Advanced Terrain Generator - Hytale-Style
 * 
 * Uses "Noise Splines" concept for realistic terrain:
 * - Continentalness: Ocean vs Land (macro scale)
 * - Erosion: Terrain roughness (mountains vs plains)
 * - Peaks & Valleys: Ridge noise for sharp mountain peaks
 * - 3D Cave Systems: Swiss cheese algorithm for natural caves
 * 
 * This produces coherent landscapes where plains are truly flat
 * and mountains rise dramatically, unlike simple heightmap noise.
 */

import { NoiseGenerator } from '../utils/noise';
import { BlockType } from './BlockTypes';

/**
 * Biome data for terrain coloring and block selection
 */
export interface BiomeData {
    temperature: number;  // -1 (cold) to 1 (hot)
    humidity: number;     // -1 (dry) to 1 (wet)
    name: string;
}

/**
 * Column data calculated once per X,Z position
 */
interface ColumnInfo {
    terrainHeight: number;
    biome: BiomeData;
    continentalness: number;
    erosion: number;
    isOcean: boolean;
    isBeach: boolean;
    isMountain: boolean;
    isRiver: boolean;
}

/**
 * Configuration for terrain generation
 */
export interface TerrainConfig {
    seed: number;
    waterLevel: number;
    worldHeight: number;
    baseHeight: number;
    // Cave generation
    caveThreshold: number;
    caveScale: number;
    // Feature toggles
    generateCaves: boolean;
    generateOres: boolean;
    generateRivers: boolean;
}

export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
    seed: 12345,
    waterLevel: 64,
    worldHeight: 256,
    baseHeight: 70,
    caveThreshold: -0.4,
    caveScale: 40,
    generateCaves: true,
    generateOres: true,
    generateRivers: true
};

/**
 * Terrain Generator using Noise Splines
 * Designed to run in Web Workers for non-blocking generation
 */
export class TerrainGenerator {
    private noise: NoiseGenerator;
    private config: TerrainConfig;

    // Cache for column info (height + biome calculated once per column)
    private columnCache: Map<string, ColumnInfo> = new Map();

    constructor(config: Partial<TerrainConfig> = {}) {
        this.config = { ...DEFAULT_TERRAIN_CONFIG, ...config };
        this.noise = new NoiseGenerator(this.config.seed);
    }

    /**
     * Generate chunk data as Uint8Array (block IDs)
     * This is the main function called by Chunk or Web Worker
     */
    public generateChunkData(chunkX: number, chunkZ: number, chunkSize: number = 16): Uint8Array {
        const worldHeight = this.config.worldHeight;
        const data = new Uint8Array(chunkSize * worldHeight * chunkSize);

        for (let x = 0; x < chunkSize; x++) {
            for (let z = 0; z < chunkSize; z++) {
                // Global coordinates
                const globalX = (chunkX * chunkSize) + x;
                const globalZ = (chunkZ * chunkSize) + z;

                // Calculate column info once per X,Z
                const columnInfo = this.calculateColumnInfo(globalX, globalZ);

                for (let y = 0; y < worldHeight; y++) {
                    const index = (y * chunkSize * chunkSize) + (z * chunkSize) + x;
                    data[index] = this.determineBlock(globalX, y, globalZ, columnInfo);
                }
            }
        }

        // Clear cache after chunk generation to save memory
        this.columnCache.clear();

        return data;
    }

    /**
     * Calculate height and biome for a column (X, Z)
     * Uses Noise Splines for Hytale-style terrain
     */
    private calculateColumnInfo(x: number, z: number): ColumnInfo {
        const cacheKey = `${x},${z}`;
        const cached = this.columnCache.get(cacheKey);
        if (cached) return cached;

        // === MACRO STRUCTURE ===

        // Continentalness: Low frequency, defines Ocean vs Land
        // Range: -1 (deep ocean) to 1 (far inland)
        const continentalness = this.noise.getContinentalness(x, z);

        // Erosion: Determines terrain smoothness
        // High erosion = flat plains, Low erosion = mountains
        const erosion = this.noise.getErosion(x, z);

        // Peaks & Valleys: Ridge noise for sharp mountain peaks
        const peaksValleys = this.noise.getPeaksAndValleys(x, z);

        // Weirdness: Unusual terrain features
        const weirdness = this.noise.getWeirdness(x, z);

        // === SPLINE LOGIC (Hytale/Minecraft Style) ===

        let baseHeight = this.config.baseHeight;
        let heightMultiplier = 0;
        let isOcean = false;
        let isBeach = false;
        let isMountain = false;

        if (continentalness < -0.4) {
            // Deep Ocean
            isOcean = true;
            heightMultiplier = 8;
            baseHeight = 25; // Ocean floor
        } else if (continentalness < -0.2) {
            // Shallow Ocean / Coast
            isOcean = true;
            heightMultiplier = 12;
            baseHeight = 45;
        } else if (continentalness < 0.0) {
            // Beach / Coastal Plains
            isBeach = true;
            heightMultiplier = 6;
            baseHeight = this.config.waterLevel - 1;
        } else if (continentalness < 0.3) {
            // Lowlands / Plains
            // Low erosion = gentle rolling hills
            heightMultiplier = 15 + (1 - erosion) * 10;
            baseHeight = 68;
        } else if (continentalness < 0.6) {
            // Midlands / Hills / Forests
            // Erosion affects terrain variation
            heightMultiplier = 25 + (1 - erosion) * 20;
            baseHeight = 72;
        } else if (continentalness < 0.8) {
            // Highlands / Foothills
            heightMultiplier = 45 + (1 - erosion) * 30;
            baseHeight = 78;
            isMountain = erosion < 0;
        } else {
            // Mountains / Peaks
            isMountain = true;
            // Use peaksValleys (ridge noise) for dramatic mountain shapes
            // This creates sharp Alps-style peaks instead of rounded hills
            const peakFactor = peaksValleys * peaksValleys; // Sharper peaks
            heightMultiplier = 80 + peakFactor * 100;
            baseHeight = 85;
        }

        // Apply terrain detail noise
        const detailNoise = this.noise.getFBM2D(x, z, 4, 0.5, 2, 150);

        // Final terrain height with weirdness adding variation
        let terrainHeight = baseHeight + (detailNoise * heightMultiplier);

        // Add extra detail for mountains
        if (isMountain) {
            const mountainDetail = this.noise.getFBM2D(x, z, 6, 0.5, 2, 50);
            terrainHeight += mountainDetail * 15;
        }

        // Clamp height
        terrainHeight = Math.max(1, Math.min(this.config.worldHeight - 10, terrainHeight));

        // === BIOMES ===
        const temperature = this.noise.getTemperature(x, z);
        const humidity = this.noise.getHumidity(x, z);

        // Adjust temperature based on height (higher = colder)
        const heightFactor = Math.max(0, (terrainHeight - 100) / 100);
        const adjustedTemp = temperature - heightFactor * 0.5;

        const biome = this.determineBiome(adjustedTemp, humidity, terrainHeight, isOcean, isBeach);

        // River detection (using weirdness as river paths)
        const isRiver = !isOcean && !isBeach &&
            this.config.generateRivers &&
            Math.abs(weirdness) < 0.08 &&
            terrainHeight < this.config.waterLevel + 15;

        const info: ColumnInfo = {
            terrainHeight: Math.floor(terrainHeight),
            biome,
            continentalness,
            erosion,
            isOcean,
            isBeach,
            isMountain,
            isRiver
        };

        this.columnCache.set(cacheKey, info);
        return info;
    }

    /**
     * Determine biome based on temperature and humidity
     */
    private determineBiome(temp: number, humidity: number, height: number, isOcean: boolean, isBeach: boolean): BiomeData {
        if (isOcean) {
            if (temp < -0.5) return { temperature: temp, humidity, name: 'frozen_ocean' };
            return { temperature: temp, humidity, name: 'ocean' };
        }

        if (isBeach) {
            if (temp < -0.3) return { temperature: temp, humidity, name: 'snowy_beach' };
            return { temperature: temp, humidity, name: 'beach' };
        }

        // High altitude biomes
        if (height > 140) {
            return { temperature: temp, humidity, name: 'mountain_peaks' };
        }
        if (height > 110) {
            if (temp < -0.2) return { temperature: temp, humidity, name: 'snowy_slopes' };
            return { temperature: temp, humidity, name: 'stony_peaks' };
        }

        // Temperature-based biomes
        if (temp < -0.5) {
            // Very cold
            if (humidity > 0.2) return { temperature: temp, humidity, name: 'snowy_taiga' };
            return { temperature: temp, humidity, name: 'snowy_plains' };
        }

        if (temp < -0.2) {
            // Cold
            if (humidity > 0.3) return { temperature: temp, humidity, name: 'taiga' };
            return { temperature: temp, humidity, name: 'cold_plains' };
        }

        if (temp < 0.3) {
            // Temperate
            if (humidity > 0.5) return { temperature: temp, humidity, name: 'jungle' };
            if (humidity > 0.2) return { temperature: temp, humidity, name: 'forest' };
            if (humidity > -0.2) return { temperature: temp, humidity, name: 'plains' };
            return { temperature: temp, humidity, name: 'savanna' };
        }

        if (temp < 0.6) {
            // Warm
            if (humidity > 0.3) return { temperature: temp, humidity, name: 'jungle' };
            if (humidity > 0) return { temperature: temp, humidity, name: 'savanna' };
            return { temperature: temp, humidity, name: 'desert' };
        }

        // Hot
        if (humidity > 0.4) return { temperature: temp, humidity, name: 'jungle' };
        if (humidity > -0.3) return { temperature: temp, humidity, name: 'badlands' };
        return { temperature: temp, humidity, name: 'desert' };
    }

    /**
     * Determine which block to place at a position
     */
    private determineBlock(x: number, y: number, z: number, column: ColumnInfo): BlockType {
        const { terrainHeight, biome, isOcean, isBeach, isMountain, isRiver } = column;

        // === BEDROCK LAYER ===
        if (y <= 0) return BlockType.BEDROCK;
        if (y <= 3) {
            // Random bedrock pattern
            const bedrockNoise = Math.abs(this.noise.getNoise3D(x, y, z, 5));
            if (bedrockNoise < 0.3 + y * 0.1) return BlockType.BEDROCK;
        }

        // === CAVES (3D Swiss Cheese) ===
        if (this.config.generateCaves && y <= terrainHeight && y > 5) {
            if (this.isCave(x, y, z, terrainHeight)) {
                // Cave air (or water/lava at low levels)
                if (y <= this.config.waterLevel - 10 && y < 20) {
                    return BlockType.LAVA;
                }
                return BlockType.AIR;
            }
        }

        // === ABOVE TERRAIN ===
        if (y > terrainHeight) {
            // River water
            if (isRiver && y <= this.config.waterLevel) {
                return BlockType.WATER;
            }
            // Ocean/lake water
            if (y <= this.config.waterLevel) {
                return BlockType.WATER;
            }
            return BlockType.AIR;
        }

        // === SURFACE LAYER ===
        if (y >= terrainHeight - 4) {
            return this.getSurfaceBlock(x, y, z, terrainHeight, biome, isOcean, isBeach, isMountain);
        }

        // === DEEP UNDERGROUND ===
        if (y < 10) {
            // Deepslate layer
            return BlockType.DEEPSLATE;
        }

        // === STONE VARIANTS AND ORES ===
        return this.getUndergroundBlock(x, y, z);
    }

    /**
     * Check if position should be a cave
     */
    private isCave(x: number, y: number, z: number, surfaceHeight: number): boolean {
        // Main cave noise (Swiss cheese)
        const caveNoise1 = this.noise.getCaveNoise(x, y, z, this.config.caveScale);
        const caveNoise2 = this.noise.getCaveNoise(x, y * 2, z, this.config.caveScale * 0.5);

        // Combine for varied cave shapes
        const combined = (caveNoise1 + caveNoise2 * 0.5) / 1.5;

        // Threshold varies by depth (larger caves deeper)
        const depthFactor = 1 - (y / surfaceHeight);
        const threshold = this.config.caveThreshold - depthFactor * 0.1;

        // Don't carve caves too close to surface
        if (surfaceHeight - y < 5) return false;

        return combined < threshold;
    }

    /**
     * Get surface block based on biome
     */
    private getSurfaceBlock(
        x: number, y: number, z: number,
        terrainHeight: number,
        biome: BiomeData,
        isOcean: boolean,
        isBeach: boolean,
        isMountain: boolean
    ): BlockType {
        const depthBelowSurface = terrainHeight - y;
        const isTopLayer = y === terrainHeight;

        // Beach sand
        if (isBeach || (y <= this.config.waterLevel + 3 && y >= this.config.waterLevel - 5)) {
            if (biome.temperature < -0.3) return BlockType.SNOW;
            return BlockType.SAND;
        }

        // Ocean floor
        if (isOcean) {
            if (depthBelowSurface <= 2) {
                const gravelChance = this.noise.getNoise3D(x, y, z, 10);
                if (gravelChance > 0.3) return BlockType.GRAVEL;
                if (biome.temperature < -0.3) return BlockType.GRAVEL;
                return BlockType.SAND;
            }
            return BlockType.STONE;
        }

        // Mountain tops
        if (isMountain && terrainHeight > 130) {
            if (isTopLayer) return BlockType.SNOW;
            if (depthBelowSurface <= 2) return BlockType.SNOW_BLOCK;
            return BlockType.STONE;
        }

        // Stony peaks
        if (terrainHeight > 110) {
            const stoneChance = this.noise.getNoise3D(x, y, z, 8);
            if (stoneChance > -0.2) return BlockType.STONE;
            return BlockType.GRAVEL;
        }

        // Biome-specific surface
        switch (biome.name) {
            case 'desert':
            case 'badlands':
                if (biome.name === 'badlands' && depthBelowSurface > 1) {
                    return BlockType.TERRACOTTA;
                }
                return BlockType.SAND;

            case 'snowy_plains':
            case 'snowy_taiga':
            case 'snowy_slopes':
            case 'snowy_beach':
                if (isTopLayer) return BlockType.SNOW;
                if (depthBelowSurface <= 3) return BlockType.DIRT;
                return BlockType.STONE;

            case 'frozen_ocean':
                if (y >= this.config.waterLevel - 1) return BlockType.ICE;
                return BlockType.WATER;

            case 'taiga':
                if (isTopLayer) return BlockType.PODZOL;
                if (depthBelowSurface <= 3) return BlockType.DIRT;
                return BlockType.STONE;

            case 'jungle':
                if (isTopLayer) {
                    const mossy = this.noise.getNoise3D(x, y, z, 6);
                    if (mossy > 0.3) return BlockType.MOSS_STONE;
                    return BlockType.GRASS;
                }
                if (depthBelowSurface <= 4) return BlockType.DIRT;
                return BlockType.STONE;

            case 'savanna':
                if (isTopLayer) return BlockType.GRASS;
                if (depthBelowSurface <= 2) return BlockType.COARSE_DIRT;
                if (depthBelowSurface <= 4) return BlockType.DIRT;
                return BlockType.STONE;

            default:
                // Plains, forest, hills, etc.
                if (isTopLayer) return BlockType.GRASS;
                if (depthBelowSurface <= 3) return BlockType.DIRT;
                return BlockType.STONE;
        }
    }

    /**
     * Get underground block (stone variants and ores)
     */
    private getUndergroundBlock(x: number, y: number, z: number): BlockType {
        // Stone variants distribution
        const variantNoise = this.noise.getNoise3D(x, y, z, 30);

        if (variantNoise > 0.6) {
            const subNoise = this.noise.getNoise3D(x + 1000, y, z, 15);
            if (subNoise > 0.3) return BlockType.GRANITE;
            if (subNoise < -0.3) return BlockType.DIORITE;
            return BlockType.ANDESITE;
        }

        // Ore generation
        if (this.config.generateOres) {
            const ore = this.checkForOre(x, y, z);
            if (ore !== BlockType.AIR) return ore;
        }

        // Occasional gravel
        const gravelNoise = this.noise.getNoise3D(x, y + 500, z, 20);
        if (gravelNoise > 0.7) return BlockType.GRAVEL;

        return BlockType.STONE;
    }

    /**
     * Check if there should be an ore at this position
     */
    private checkForOre(x: number, y: number, z: number): BlockType {
        // Different scales and thresholds for each ore type
        // Rarer ores have higher thresholds and depth requirements

        // Coal: Common, all heights
        const coalNoise = this.noise.getNoise3D(x, y, z, 8);
        if (coalNoise > 0.72 && y > 5 && y < 128) {
            return BlockType.COAL_ORE;
        }

        // Iron: Common, lower half
        const ironNoise = this.noise.getNoise3D(x + 1000, y, z, 7);
        if (ironNoise > 0.75 && y > 5 && y < 64) {
            return BlockType.IRON_ORE;
        }

        // Gold: Rare, deep
        const goldNoise = this.noise.getNoise3D(x + 2000, y, z, 6);
        if (goldNoise > 0.82 && y > 5 && y < 32) {
            return BlockType.GOLD_ORE;
        }

        // Diamond: Very rare, very deep
        const diamondNoise = this.noise.getNoise3D(x + 3000, y, z, 5);
        if (diamondNoise > 0.88 && y > 2 && y < 16) {
            return BlockType.DIAMOND_ORE;
        }

        return BlockType.AIR; // No ore
    }

    // === PUBLIC API (for compatibility with existing code) ===

    /**
     * Get terrain height at a position (for external use)
     */
    public getHeight(worldX: number, worldZ: number): number {
        const column = this.calculateColumnInfo(worldX, worldZ);
        return column.terrainHeight;
    }

    /**
     * Get biome at a position
     */
    public getBiome(worldX: number, worldZ: number): string {
        const column = this.calculateColumnInfo(worldX, worldZ);
        return column.biome.name;
    }

    /**
     * Check if position has a cave
     */
    public hasCave(worldX: number, worldY: number, worldZ: number): boolean {
        if (!this.config.generateCaves) return false;
        if (worldY < 5 || worldY > 128) return false;

        const surfaceHeight = this.getHeight(worldX, worldZ);
        return this.isCave(worldX, worldY, worldZ, surfaceHeight);
    }

    /**
     * Get block at world position (for external use)
     */
    public getBlockAt(worldX: number, worldY: number, worldZ: number): BlockType {
        const column = this.calculateColumnInfo(worldX, worldZ);
        return this.determineBlock(worldX, worldY, worldZ, column);
    }

    /**
     * Check if a tree should be placed at this position
     */
    public shouldPlaceTree(worldX: number, worldZ: number): boolean {
        const column = this.calculateColumnInfo(worldX, worldZ);

        // No trees in certain biomes
        if (column.isOcean || column.isBeach) return false;
        if (column.biome.name === 'desert' || column.biome.name === 'badlands') return false;
        if (column.biome.name.includes('snowy_plains')) return false;
        if (column.terrainHeight > 120) return false; // Too high

        // Tree density based on biome
        let threshold = 0.985;
        if (column.biome.name === 'forest') threshold = 0.97;
        if (column.biome.name === 'jungle') threshold = 0.95;
        if (column.biome.name === 'taiga' || column.biome.name === 'snowy_taiga') threshold = 0.975;
        if (column.biome.name === 'savanna') threshold = 0.995;

        // Deterministic hash for tree placement
        const hash = Math.abs(Math.sin(worldX * 12.9898 + worldZ * 78.233) * 43758.5453);
        return (hash % 1) > threshold;
    }

    /**
     * Check if vegetation (tall grass, flowers, etc.) should be placed at this position
     */
    public shouldPlaceVegetation(worldX: number, worldZ: number): boolean {
        const column = this.calculateColumnInfo(worldX, worldZ);

        // No vegetation in certain biomes
        if (column.isOcean || column.isBeach) return false;
        if (column.biome.name === 'desert') return false;
        if (column.biome.name === 'badlands') return false;
        if (column.biome.name.includes('snowy')) return false;
        if (column.terrainHeight > 130) return false;

        // Vegetation density based on biome
        let threshold = 0.75; // Default 25% coverage

        switch (column.biome.name) {
            case 'plains':
                threshold = 0.55; // 45% coverage - lots of grass
                break;
            case 'forest':
                threshold = 0.65; // 35% coverage
                break;
            case 'jungle':
                threshold = 0.45; // 55% coverage - very dense
                break;
            case 'taiga':
                threshold = 0.70; // 30% coverage
                break;
            case 'savanna':
                threshold = 0.80; // 20% coverage - sparse
                break;
        }

        // Deterministic hash for vegetation placement
        const hash = Math.abs(Math.sin(worldX * 23.1407 + worldZ * 56.7891) * 28461.3254);
        return (hash % 1) > threshold;
    }

    /**
     * Get the type of vegetation to place at this position
     */
    public getVegetationType(worldX: number, worldZ: number): BlockType {
        const column = this.calculateColumnInfo(worldX, worldZ);

        // Use deterministic hash for vegetation type selection
        const hash = Math.abs(Math.sin(worldX * 45.2893 + worldZ * 89.1247) * 19283.4756);
        const value = hash % 1;

        // Desert-like biomes get dead bush
        if (column.biome.name === 'badlands' || column.biome.name === 'savanna') {
            if (value > 0.95) return BlockType.DEAD_BUSH;
            return BlockType.TALL_GRASS;
        }

        // Jungle gets ferns and flowers
        if (column.biome.name === 'jungle') {
            if (value < 0.3) return BlockType.FERN;
            if (value < 0.35) return BlockType.FLOWER_RED;
            if (value < 0.40) return BlockType.FLOWER_WHITE;
            if (value < 0.42) return BlockType.MUSHROOM_RED;
            if (value < 0.44) return BlockType.MUSHROOM_BROWN;
            return BlockType.TALL_GRASS;
        }

        // Taiga gets ferns and mushrooms
        if (column.biome.name === 'taiga' || column.biome.name === 'snowy_taiga') {
            if (value < 0.25) return BlockType.FERN;
            if (value < 0.30) return BlockType.MUSHROOM_BROWN;
            if (value < 0.33) return BlockType.MUSHROOM_RED;
            return BlockType.TALL_GRASS;
        }

        // Forest gets varied vegetation
        if (column.biome.name === 'forest') {
            if (value < 0.15) return BlockType.FERN;
            if (value < 0.20) return BlockType.FLOWER_BLUE;
            if (value < 0.24) return BlockType.FLOWER_WHITE;
            if (value < 0.27) return BlockType.MUSHROOM_BROWN;
            return BlockType.TALL_GRASS;
        }

        // Plains - mostly grass with flowers
        if (value < 0.08) return BlockType.FLOWER_RED;
        if (value < 0.14) return BlockType.FLOWER_YELLOW;
        if (value < 0.18) return BlockType.FLOWER_BLUE;
        if (value < 0.21) return BlockType.FLOWER_WHITE;

        return BlockType.TALL_GRASS;
    }

    /**
     * Get random tree height for the biome
     */
    public getTreeHeight(worldX?: number, worldZ?: number): number {
        if (worldX !== undefined && worldZ !== undefined) {
            const biome = this.getBiome(worldX, worldZ);
            if (biome === 'jungle') return 8 + Math.floor(Math.random() * 6);
            if (biome === 'taiga' || biome === 'snowy_taiga') return 6 + Math.floor(Math.random() * 4);
        }
        return 4 + Math.floor(Math.random() * 3);
    }

    /**
     * Get the water level
     */
    public getWaterLevel(): number {
        return this.config.waterLevel;
    }

    /**
     * Get grass variation index for a position (0-3)
     * Used for texture variation
     */
    public getGrassVariation(worldX: number, worldZ: number): number {
        const hash = Math.abs(Math.sin(worldX * 12.9898 + worldZ * 78.233) * 43758.5453);
        return Math.floor(hash % 4);
    }
}


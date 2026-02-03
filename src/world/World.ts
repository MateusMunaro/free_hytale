import * as THREE from 'three';
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT } from './Chunk';
import { TerrainGenerator, TerrainConfig } from './TerrainGenerator';
import { createChunkKey } from '../utils/math';
import { BlockType, isBlockSolid as checkBlockSolid } from './BlockTypes';
import { LRUCache } from '../utils/LRUCache';

export interface WorldConfig {
    renderDistance: number;
    terrainConfig?: Partial<TerrainConfig>;
}

const DEFAULT_WORLD_CONFIG: WorldConfig = {
    renderDistance: 6
};

export class World {
    private chunks: Map<string, Chunk> = new Map();
    private terrainGenerator: TerrainGenerator;
    private config: WorldConfig;
    private scene: THREE.Scene;

    // Cache for block lookups - LRU evicts least recently used entries
    private blockCache = new LRUCache<string, BlockType>(15000);

    public chunksLoaded: number = 0;
    public chunksRendered: number = 0;

    constructor(scene: THREE.Scene, config: Partial<WorldConfig> = {}) {
        this.scene = scene;
        this.config = { ...DEFAULT_WORLD_CONFIG, ...config };
        this.terrainGenerator = new TerrainGenerator(this.config.terrainConfig);
    }

    public update(playerX: number, playerZ: number): void {
        const playerChunkX = Math.floor(playerX / CHUNK_SIZE);
        const playerChunkZ = Math.floor(playerZ / CHUNK_SIZE);

        const chunksToLoad: { x: number; z: number; dist: number }[] = [];
        const chunksToUnload: string[] = [];

        const rd = this.config.renderDistance;
        for (let dx = -rd; dx <= rd; dx++) {
            for (let dz = -rd; dz <= rd; dz++) {
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist <= rd) {
                    chunksToLoad.push({
                        x: playerChunkX + dx,
                        z: playerChunkZ + dz,
                        dist
                    });
                }
            }
        }

        chunksToLoad.sort((a, b) => a.dist - b.dist);

        let generatedThisFrame = 0;
        const maxGeneratePerFrame = 2;

        for (const { x, z } of chunksToLoad) {
            const key = createChunkKey(x, z);

            if (!this.chunks.has(key)) {
                const chunk = new Chunk(x, z, this.terrainGenerator);
                this.chunks.set(key, chunk);
            }

            const chunk = this.chunks.get(key)!;

            if (!chunk.isGenerated && generatedThisFrame < maxGeneratePerFrame) {
                chunk.generate();
                generatedThisFrame++;
            }

            if (chunk.isGenerated && !chunk.isBuilt && generatedThisFrame < maxGeneratePerFrame) {
                chunk.buildMesh();

                for (const mesh of chunk.meshes) {
                    this.scene.add(mesh);
                }
                if (chunk.waterMesh) {
                    this.scene.add(chunk.waterMesh);
                }

                generatedThisFrame++;
            }
        }

        const loadedKeys = new Set(chunksToLoad.map(c => createChunkKey(c.x, c.z)));

        for (const key of this.chunks.keys()) {
            if (!loadedKeys.has(key)) {
                chunksToUnload.push(key);
            }
        }

        for (const key of chunksToUnload) {
            const chunk = this.chunks.get(key)!;

            for (const mesh of chunk.meshes) {
                this.scene.remove(mesh);
            }
            if (chunk.waterMesh) {
                this.scene.remove(chunk.waterMesh);
            }

            chunk.dispose();
            this.chunks.delete(key);

            // Clear cache for unloaded chunks
            this.clearChunkCache(key);
        }

        this.chunksLoaded = this.chunks.size;
        this.chunksRendered = Array.from(this.chunks.values()).filter(c => c.isBuilt).length;
        // LRU Cache handles size management automatically
    }

    private clearChunkCache(chunkKey: string): void {
        // LRU Cache has efficient prefix-based deletion
        this.blockCache.deleteByPrefix(chunkKey + '_');
    }

    public getHeightAt(x: number, z: number): number {
        return this.terrainGenerator.getHeight(x, z);
    }

    public getWaterLevel(): number {
        return this.terrainGenerator.getWaterLevel();
    }

    public getBiome(x: number, z: number): string {
        return this.terrainGenerator.getBiome(x, z);
    }

    public getBlockAt(worldX: number, worldY: number, worldZ: number): BlockType {
        // Clamp Y
        if (worldY < 0) return BlockType.BEDROCK;
        if (worldY >= CHUNK_HEIGHT) return BlockType.AIR;

        const bx = Math.floor(worldX);
        const by = Math.floor(worldY);
        const bz = Math.floor(worldZ);

        const chunkX = Math.floor(bx / CHUNK_SIZE);
        const chunkZ = Math.floor(bz / CHUNK_SIZE);
        const chunkKey = createChunkKey(chunkX, chunkZ);

        // Check cache first (LRU cache automatically tracks hits/misses)
        const cacheKey = `${chunkKey}_${bx}_${by}_${bz}`;
        const cached = this.blockCache.get(cacheKey);
        if (cached !== undefined) {
            return cached;
        }

        // Get from chunk if loaded
        const chunk = this.chunks.get(chunkKey);
        if (chunk && chunk.isGenerated) {
            // Convert to local coordinates properly
            let localX = bx - chunkX * CHUNK_SIZE;
            let localZ = bz - chunkZ * CHUNK_SIZE;

            const block = chunk.getBlock(localX, by, localZ);
            this.blockCache.set(cacheKey, block);
            return block;
        }

        // Fall back to terrain generator
        const block = this.terrainGenerator.getBlockAt(bx, by, bz);
        this.blockCache.set(cacheKey, block);
        return block;
    }

    public isBlockSolid(worldX: number, worldY: number, worldZ: number): boolean {
        const block = this.getBlockAt(worldX, worldY, worldZ);
        // Use the solid property from BlockTypes BLOCKS record
        // This correctly handles all blocks including vegetation (solid: false)
        return checkBlockSolid(block);
    }

    /**
     * Alias for getBlockAt for compatibility
     */
    public getBlock(worldX: number, worldY: number, worldZ: number): BlockType {
        return this.getBlockAt(worldX, worldY, worldZ);
    }

    /**
     * Set a block at the given world position
     */
    public setBlock(worldX: number, worldY: number, worldZ: number, blockType: BlockType): boolean {
        // Clamp Y
        if (worldY < 0 || worldY >= CHUNK_HEIGHT) return false;

        const bx = Math.floor(worldX);
        const by = Math.floor(worldY);
        const bz = Math.floor(worldZ);

        const chunkX = Math.floor(bx / CHUNK_SIZE);
        const chunkZ = Math.floor(bz / CHUNK_SIZE);
        const chunkKey = createChunkKey(chunkX, chunkZ);

        // Get the chunk
        const chunk = this.chunks.get(chunkKey);
        if (!chunk || !chunk.isGenerated) return false;

        // Convert to local coordinates
        let localX = bx - chunkX * CHUNK_SIZE;
        let localZ = bz - chunkZ * CHUNK_SIZE;

        // Set the block
        chunk.setBlock(localX, by, localZ, blockType);

        // Clear cache for this position
        const cacheKey = `${chunkKey}_${bx}_${by}_${bz}`;
        this.blockCache.delete(cacheKey);

        // Rebuild the chunk mesh
        this.rebuildChunk(chunk);

        return true;
    }

    /**
     * Rebuild a chunk's mesh after modification
     */
    private rebuildChunk(chunk: Chunk): void {
        // Remove old meshes
        for (const mesh of chunk.meshes) {
            this.scene.remove(mesh);
        }
        if (chunk.waterMesh) {
            this.scene.remove(chunk.waterMesh);
        }

        // Rebuild
        chunk.rebuildMesh();

        // Add new meshes
        for (const mesh of chunk.meshes) {
            this.scene.add(mesh);
        }
        if (chunk.waterMesh) {
            this.scene.add(chunk.waterMesh);
        }
    }

    public dispose(): void {
        for (const chunk of this.chunks.values()) {
            for (const mesh of chunk.meshes) {
                this.scene.remove(mesh);
            }
            if (chunk.waterMesh) {
                this.scene.remove(chunk.waterMesh);
            }
            chunk.dispose();
        }
        this.chunks.clear();
        this.blockCache.clear();
    }

    /**
     * Get cache statistics for debugging
     */
    public getCacheStats() {
        return this.blockCache.getStats();
    }
}

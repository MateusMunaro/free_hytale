import * as THREE from 'three';
import { BlockType, isBlockTransparent } from './BlockTypes';
import { TerrainGenerator } from './TerrainGenerator';
import { getTextureManager } from '../graphics/TextureManager';
import { getMaterialPool } from '../utils/MaterialPool';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 256; // Increased for Hytale-style terrain with taller mountains

// Face directions with proper UV mapping for individual blocks
const FACES = {
    // Top face (+Y)
    top: {
        dir: [0, 1, 0] as [number, number, number],
        vertices: [
            { pos: [0, 1, 0], uv: [0, 1] },
            { pos: [0, 1, 1], uv: [0, 0] },
            { pos: [1, 1, 1], uv: [1, 0] },
            { pos: [1, 1, 0], uv: [1, 1] },
        ]
    },
    // Bottom face (-Y)
    bottom: {
        dir: [0, -1, 0] as [number, number, number],
        vertices: [
            { pos: [0, 0, 1], uv: [0, 0] },
            { pos: [0, 0, 0], uv: [0, 1] },
            { pos: [1, 0, 0], uv: [1, 1] },
            { pos: [1, 0, 1], uv: [1, 0] },
        ]
    },
    // Front face (+Z)
    front: {
        dir: [0, 0, 1] as [number, number, number],
        vertices: [
            { pos: [0, 0, 1], uv: [1, 1] },
            { pos: [1, 0, 1], uv: [0, 1] },
            { pos: [1, 1, 1], uv: [0, 0] },
            { pos: [0, 1, 1], uv: [1, 0] },
        ]
    },
    // Back face (-Z)
    back: {
        dir: [0, 0, -1] as [number, number, number],
        vertices: [
            { pos: [1, 0, 0], uv: [1, 1] },
            { pos: [0, 0, 0], uv: [0, 1] },
            { pos: [0, 1, 0], uv: [0, 0] },
            { pos: [1, 1, 0], uv: [1, 0] },
        ]
    },
    // Right face (+X)
    right: {
        dir: [1, 0, 0] as [number, number, number],
        vertices: [
            { pos: [1, 0, 1], uv: [1, 1] },
            { pos: [1, 0, 0], uv: [0, 1] },
            { pos: [1, 1, 0], uv: [0, 0] },
            { pos: [1, 1, 1], uv: [1, 0] },
        ]
    },
    // Left face (-X)
    left: {
        dir: [-1, 0, 0] as [number, number, number],
        vertices: [
            { pos: [0, 0, 0], uv: [1, 1] },
            { pos: [0, 0, 1], uv: [0, 1] },
            { pos: [0, 1, 1], uv: [0, 0] },
            { pos: [0, 1, 0], uv: [1, 0] },
        ]
    }
};

interface GeometryData {
    positions: number[];
    normals: number[];
    uvs: number[];
    indices: number[];
}

interface BlockMeshData {
    top: GeometryData;
    side: GeometryData;
    bottom: GeometryData;
}

// Vegetation block types that render as cross-billboards
// Using Set for O(1) lookup instead of Array O(n)
const VEGETATION_SET = new Set<BlockType>([
    BlockType.TALL_GRASS,
    BlockType.FERN,
    BlockType.DEAD_BUSH,
    BlockType.FLOWER_RED,
    BlockType.FLOWER_YELLOW,
    BlockType.FLOWER_BLUE,
    BlockType.FLOWER_WHITE,
    BlockType.MUSHROOM_RED,
    BlockType.MUSHROOM_BROWN
]);

function isVegetationBlock(blockType: BlockType): boolean {
    return VEGETATION_SET.has(blockType);  // O(1) lookup
}

export class Chunk {
    public readonly x: number;
    public readonly z: number;
    public meshes: THREE.Mesh[] = [];
    public waterMesh: THREE.Mesh | null = null;
    public isGenerated: boolean = false;
    public isBuilt: boolean = false;

    private blocks: Uint8Array;
    private terrainGenerator: TerrainGenerator;

    constructor(x: number, z: number, terrainGenerator: TerrainGenerator) {
        this.x = x;
        this.z = z;
        this.terrainGenerator = terrainGenerator;
        this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    }

    public generate(): void {
        if (this.isGenerated) return;

        const worldX = this.x * CHUNK_SIZE;
        const worldZ = this.z * CHUNK_SIZE;

        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                const wx = worldX + lx;
                const wz = worldZ + lz;

                for (let y = 0; y < CHUNK_HEIGHT; y++) {
                    const blockType = this.terrainGenerator.getBlockAt(wx, y, wz);
                    this.setBlock(lx, y, lz, blockType);
                }

                // Place trees
                if (this.terrainGenerator.shouldPlaceTree(wx, wz)) {
                    this.placeTree(lx, wz, this.terrainGenerator.getHeight(wx, wz));
                }
                // Place vegetation (grass, flowers, etc.)
                else if (this.terrainGenerator.shouldPlaceVegetation(wx, wz)) {
                    this.placeVegetation(lx, lz, wx, wz);
                }
            }
        }

        this.isGenerated = true;
    }

    /**
     * Place vegetation (tall grass, flowers, etc.) on surface
     */
    private placeVegetation(lx: number, lz: number, wx: number, wz: number): void {
        const surfaceY = this.terrainGenerator.getHeight(wx, wz);

        // Check if surface is grass block (vegetation only grows on grass)
        const surfaceBlock = this.getBlock(lx, surfaceY, lz);
        if (surfaceBlock !== BlockType.GRASS) return;

        // Get vegetation type for this position
        const vegetationType = this.terrainGenerator.getVegetationType(wx, wz);

        // Place vegetation one block above surface
        const vegY = surfaceY + 1;
        if (vegY < CHUNK_HEIGHT) {
            this.setBlock(lx, vegY, lz, vegetationType);
        }
    }

    private placeTree(lx: number, wz: number, surfaceY: number): void {
        if (surfaceY < 35) return;

        const treeHeight = this.terrainGenerator.getTreeHeight();
        const localZ = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

        for (let y = 1; y <= treeHeight; y++) {
            const ty = surfaceY + y;
            if (ty < CHUNK_HEIGHT) {
                this.setBlock(lx, ty, localZ, BlockType.WOOD);
            }
        }

        const leafStart = surfaceY + treeHeight - 1;
        for (let dy = 0; dy <= 2; dy++) {
            const radius = dy === 0 ? 2 : dy === 1 ? 2 : 1;
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    const nlx = lx + dx;
                    const nlz = localZ + dz;
                    const ny = leafStart + dy;

                    if (nlx >= 0 && nlx < CHUNK_SIZE &&
                        nlz >= 0 && nlz < CHUNK_SIZE &&
                        ny < CHUNK_HEIGHT) {
                        if (dx === 0 && dz === 0 && dy < 2) continue;
                        if (Math.abs(dx) === radius && Math.abs(dz) === radius && Math.random() > 0.5) continue;
                        this.setBlock(nlx, ny, nlz, BlockType.LEAVES);
                    }
                }
            }
        }
    }

    public getBlock(x: number, y: number, z: number): BlockType {
        if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
            return BlockType.AIR;
        }
        return this.blocks[x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_HEIGHT];
    }

    public setBlock(x: number, y: number, z: number, type: BlockType): void {
        if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
            return;
        }
        this.blocks[x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_HEIGHT] = type;
    }

    private createEmptyGeometry(): GeometryData {
        return { positions: [], normals: [], uvs: [], indices: [] };
    }

    private addFace(
        geometry: GeometryData,
        face: typeof FACES.top,
        x: number, y: number, z: number
    ): void {
        const baseIndex = geometry.positions.length / 3;

        // Add vertices with individual UVs per block (0-1 range)
        for (const vertex of face.vertices) {
            geometry.positions.push(
                x + vertex.pos[0],
                y + vertex.pos[1],
                z + vertex.pos[2]
            );
            geometry.normals.push(face.dir[0], face.dir[1], face.dir[2]);
            // Each block face gets full 0-1 UV range
            geometry.uvs.push(vertex.uv[0], vertex.uv[1]);
        }

        // Two triangles per face
        geometry.indices.push(
            baseIndex, baseIndex + 1, baseIndex + 2,
            baseIndex, baseIndex + 2, baseIndex + 3
        );
    }

    public buildMesh(): void {
        if (!this.isGenerated) return;

        const textureManager = getTextureManager();

        // Group geometry by block type and face type (top/side/bottom)
        const blockMeshes = new Map<BlockType, BlockMeshData>();
        const waterGeometry = this.createEmptyGeometry();
        const vegetationGeometry = new Map<BlockType, GeometryData>();

        // Process all blocks
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let y = 0; y < CHUNK_HEIGHT; y++) {
                for (let z = 0; z < CHUNK_SIZE; z++) {
                    const block = this.getBlock(x, y, z);
                    if (block === BlockType.AIR) continue;

                    const isWater = block === BlockType.WATER;
                    const isVegetation = isVegetationBlock(block);

                    // Handle vegetation separately with cross-billboard geometry
                    if (isVegetation) {
                        if (!vegetationGeometry.has(block)) {
                            vegetationGeometry.set(block, this.createEmptyGeometry());
                        }
                        this.addCrossBillboard(vegetationGeometry.get(block)!, x, y, z);
                        continue;
                    }

                    // Get or create mesh data for this block type
                    if (!isWater && !blockMeshes.has(block)) {
                        blockMeshes.set(block, {
                            top: this.createEmptyGeometry(),
                            side: this.createEmptyGeometry(),
                            bottom: this.createEmptyGeometry()
                        });
                    }

                    // Check each face
                    // Top (+Y)
                    if (this.shouldRenderFace(x, y + 1, z, block, isWater)) {
                        if (isWater) {
                            this.addFace(waterGeometry, FACES.top, x, y, z);
                        } else {
                            this.addFace(blockMeshes.get(block)!.top, FACES.top, x, y, z);
                        }
                    }

                    // Bottom (-Y)
                    if (this.shouldRenderFace(x, y - 1, z, block, isWater)) {
                        if (isWater) {
                            this.addFace(waterGeometry, FACES.bottom, x, y, z);
                        } else {
                            this.addFace(blockMeshes.get(block)!.bottom, FACES.bottom, x, y, z);
                        }
                    }

                    // Front (+Z)
                    if (this.shouldRenderFace(x, y, z + 1, block, isWater)) {
                        if (isWater) {
                            this.addFace(waterGeometry, FACES.front, x, y, z);
                        } else {
                            this.addFace(blockMeshes.get(block)!.side, FACES.front, x, y, z);
                        }
                    }

                    // Back (-Z)
                    if (this.shouldRenderFace(x, y, z - 1, block, isWater)) {
                        if (isWater) {
                            this.addFace(waterGeometry, FACES.back, x, y, z);
                        } else {
                            this.addFace(blockMeshes.get(block)!.side, FACES.back, x, y, z);
                        }
                    }

                    // Right (+X)
                    if (this.shouldRenderFace(x + 1, y, z, block, isWater)) {
                        if (isWater) {
                            this.addFace(waterGeometry, FACES.right, x, y, z);
                        } else {
                            this.addFace(blockMeshes.get(block)!.side, FACES.right, x, y, z);
                        }
                    }

                    // Left (-X)
                    if (this.shouldRenderFace(x - 1, y, z, block, isWater)) {
                        if (isWater) {
                            this.addFace(waterGeometry, FACES.left, x, y, z);
                        } else {
                            this.addFace(blockMeshes.get(block)!.side, FACES.left, x, y, z);
                        }
                    }
                }
            }
        }

        // Create Three.js meshes for each block type
        for (const [blockType, meshData] of blockMeshes) {
            const textureSet = textureManager.getTextures(blockType);

            // Create mesh for top faces
            if (meshData.top.positions.length > 0) {
                const mesh = this.createMesh(meshData.top, textureSet?.top, blockType, 'top');
                this.meshes.push(mesh);
            }

            // Create mesh for side faces
            if (meshData.side.positions.length > 0) {
                const mesh = this.createMesh(meshData.side, textureSet?.side, blockType, 'side');
                this.meshes.push(mesh);
            }

            // Create mesh for bottom faces
            if (meshData.bottom.positions.length > 0) {
                const mesh = this.createMesh(meshData.bottom, textureSet?.bottom, blockType, 'bottom');
                this.meshes.push(mesh);
            }
        }

        // Create vegetation meshes with cross-billboard geometry
        for (const [blockType, geometry] of vegetationGeometry) {
            if (geometry.positions.length > 0) {
                const mesh = this.createVegetationMesh(geometry, blockType);
                this.meshes.push(mesh);
            }
        }

        // Create water mesh using MaterialPool
        if (waterGeometry.positions.length > 0) {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(waterGeometry.positions, 3));
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(waterGeometry.normals, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(waterGeometry.uvs, 2));
            geometry.setIndex(waterGeometry.indices);
            geometry.computeBoundingSphere();

            // Use pooled material instead of creating new one
            const material = getMaterialPool().getWaterMaterial();

            this.waterMesh = new THREE.Mesh(geometry, material);
            this.waterMesh.position.set(this.x * CHUNK_SIZE, 0, this.z * CHUNK_SIZE);
        }

        this.isBuilt = true;
    }

    /**
     * Add cross-billboard geometry for vegetation
     * Creates two crossed planes that look good from any angle
     */
    private addCrossBillboard(geometry: GeometryData, x: number, y: number, z: number): void {
        const baseIndex = geometry.positions.length / 3;

        // Offset for centering (vegetation is smaller than full block)
        const inset = 0.1;
        const height = 0.9; // Slightly shorter than full block

        // First diagonal plane (SW to NE)
        geometry.positions.push(
            x + inset, y, z + inset,           // bottom-left
            x + 1 - inset, y, z + 1 - inset,   // bottom-right
            x + 1 - inset, y + height, z + 1 - inset, // top-right
            x + inset, y + height, z + inset   // top-left
        );

        // Second diagonal plane (NW to SE)
        geometry.positions.push(
            x + 1 - inset, y, z + inset,       // bottom-left
            x + inset, y, z + 1 - inset,       // bottom-right
            x + inset, y + height, z + 1 - inset, // top-right
            x + 1 - inset, y + height, z + inset  // top-left
        );

        // Normals (up-facing for better lighting)
        for (let i = 0; i < 8; i++) {
            geometry.normals.push(0, 1, 0);
        }

        // UVs for both planes - corrected orientation (0,0 at bottom-left, 1,1 at top-right)
        for (let i = 0; i < 2; i++) {
            geometry.uvs.push(
                0, 0,  // bottom-left
                1, 0,  // bottom-right  
                1, 1,  // top-right
                0, 1   // top-left
            );
        }

        // Indices for both planes (both sides)
        // First plane - front
        geometry.indices.push(
            baseIndex, baseIndex + 1, baseIndex + 2,
            baseIndex, baseIndex + 2, baseIndex + 3
        );
        // First plane - back
        geometry.indices.push(
            baseIndex + 2, baseIndex + 1, baseIndex,
            baseIndex + 3, baseIndex + 2, baseIndex
        );
        // Second plane - front
        geometry.indices.push(
            baseIndex + 4, baseIndex + 5, baseIndex + 6,
            baseIndex + 4, baseIndex + 6, baseIndex + 7
        );
        // Second plane - back
        geometry.indices.push(
            baseIndex + 6, baseIndex + 5, baseIndex + 4,
            baseIndex + 7, baseIndex + 6, baseIndex + 4
        );
    }

    /**
     * Create mesh for vegetation (transparent, double-sided)
     * Uses MaterialPool for efficient material reuse
     */
    private createVegetationMesh(geometry: GeometryData, blockType: BlockType): THREE.Mesh {
        const bufferGeometry = new THREE.BufferGeometry();
        bufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(geometry.positions, 3));
        bufferGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(geometry.normals, 3));
        bufferGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(geometry.uvs, 2));
        bufferGeometry.setIndex(geometry.indices);
        bufferGeometry.computeBoundingSphere();

        // Use pooled material instead of creating new one
        const material = getMaterialPool().getVegetationMaterial(blockType);

        const mesh = new THREE.Mesh(bufferGeometry, material);
        mesh.position.set(this.x * CHUNK_SIZE, 0, this.z * CHUNK_SIZE);
        mesh.castShadow = false; // Vegetation doesn't cast good shadows
        mesh.receiveShadow = true;

        return mesh;
    }

    private shouldRenderFace(nx: number, ny: number, nz: number, currentBlock: BlockType, isWater: boolean): boolean {
        const neighbor = this.getBlock(nx, ny, nz);

        // Always render if neighbor is air
        if (neighbor === BlockType.AIR) return true;

        // Vegetation blocks should be seen through
        if (isVegetationBlock(neighbor)) return true;

        // For water, only render against non-water blocks
        if (isWater) {
            return neighbor !== BlockType.WATER;
        }

        // For solid blocks, render if neighbor is transparent (but not same type)
        if (isBlockTransparent(neighbor) && neighbor !== currentBlock) {
            return true;
        }

        return false;
    }

    /**
     * Creates a mesh for block faces using MaterialPool for material reuse
     */
    private createMesh(geometry: GeometryData, texture: THREE.Texture | undefined, blockType: BlockType, faceType: 'top' | 'side' | 'bottom' = 'side'): THREE.Mesh {
        const bufferGeometry = new THREE.BufferGeometry();
        bufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(geometry.positions, 3));
        bufferGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(geometry.normals, 3));
        bufferGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(geometry.uvs, 2));
        bufferGeometry.setIndex(geometry.indices);
        bufferGeometry.computeBoundingSphere();

        // Use pooled material instead of creating new one
        const material = getMaterialPool().getBlockMaterial(blockType, faceType, texture);

        const mesh = new THREE.Mesh(bufferGeometry, material);
        mesh.position.set(this.x * CHUNK_SIZE, 0, this.z * CHUNK_SIZE);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        return mesh;
    }

    /**
     * Rebuild mesh after block modification
     */
    public rebuildMesh(): void {
        // Dispose current geometry only - materials are from the pool and reused
        for (const mesh of this.meshes) {
            mesh.geometry.dispose();
            // Note: Don't dispose material - it's from MaterialPool and shared
        }
        this.meshes = [];

        if (this.waterMesh) {
            this.waterMesh.geometry.dispose();
            // Note: Don't dispose water material - it's from MaterialPool
            this.waterMesh = null;
        }

        // Mark as not built so buildMesh can run again
        this.isBuilt = false;

        // Rebuild
        this.buildMesh();
    }

    public dispose(): void {
        // Dispose geometry only - materials are from the pool and shared
        for (const mesh of this.meshes) {
            mesh.geometry.dispose();
            // Note: Don't dispose material - it's from MaterialPool
        }
        this.meshes = [];

        if (this.waterMesh) {
            this.waterMesh.geometry.dispose();
            // Note: Don't dispose water material - it's from MaterialPool
            this.waterMesh = null;
        }
    }
}

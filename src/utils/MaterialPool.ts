import * as THREE from 'three';
import { BlockType, BLOCKS } from '../world/BlockTypes';
import { getTextureManager } from '../graphics/TextureManager';

/**
 * Pool de materiais Three.js para reutilização
 * Evita criação de materiais duplicados - grande impacto em draw calls
 */
export class MaterialPool {
    private static instance: MaterialPool;
    private materials: Map<string, THREE.Material> = new Map();
    private vegetationMaterials: Map<BlockType, THREE.Material> = new Map();
    private waterMaterial: THREE.Material | null = null;
    private initialized: boolean = false;

    private constructor() { }

    public static getInstance(): MaterialPool {
        if (!MaterialPool.instance) {
            MaterialPool.instance = new MaterialPool();
        }
        return MaterialPool.instance;
    }

    /**
     * Inicializa o pool (deve ser chamado após TextureManager estar pronto)
     */
    public initialize(): void {
        if (this.initialized) return;
        this.initialized = true;
    }

    /**
     * Obtém material para um tipo de bloco e face
     */
    public getBlockMaterial(
        blockType: BlockType,
        faceType: 'top' | 'side' | 'bottom',
        texture?: THREE.Texture
    ): THREE.Material {
        const key = `${blockType}_${faceType}`;

        if (!this.materials.has(key)) {
            const textureManager = getTextureManager();
            const textureSet = textureManager.getTextures(blockType);
            const blockData = BLOCKS[blockType];
            const isLeaves = blockType === BlockType.LEAVES;

            const material = new THREE.MeshStandardMaterial({
                map: texture ?? textureSet?.[faceType],
                roughness: blockData?.roughness ?? 0.85,
                metalness: 0.0,
                transparent: isLeaves,
                alphaTest: isLeaves ? 0.1 : 0,
                side: isLeaves ? THREE.DoubleSide : THREE.FrontSide
            });

            this.materials.set(key, material);
        }

        return this.materials.get(key)!;
    }

    /**
     * Obtém material para vegetação
     */
    public getVegetationMaterial(blockType: BlockType): THREE.Material {
        if (!this.vegetationMaterials.has(blockType)) {
            const textureManager = getTextureManager();
            const textureSet = textureManager.getTextures(blockType);
            const blockData = BLOCKS[blockType];

            const material = new THREE.MeshStandardMaterial({
                map: textureSet?.side,
                transparent: true,
                alphaTest: 0.1,
                roughness: blockData?.roughness ?? 0.9,
                metalness: 0.0,
                side: THREE.DoubleSide,
                depthWrite: true
            });

            this.vegetationMaterials.set(blockType, material);
        }

        return this.vegetationMaterials.get(blockType)!;
    }

    /**
     * Obtém material para água
     */
    public getWaterMaterial(): THREE.Material {
        if (!this.waterMaterial) {
            const textureManager = getTextureManager();
            const textureSet = textureManager.getTextures(BlockType.WATER);

            this.waterMaterial = new THREE.MeshStandardMaterial({
                map: textureSet?.top,
                transparent: true,
                opacity: 0.7,
                roughness: 0.1,
                metalness: 0.3,
                side: THREE.DoubleSide
            });
        }

        return this.waterMaterial;
    }

    /**
     * Estatísticas do pool
     */
    public getStats(): { blockMaterials: number; vegetationMaterials: number; total: number } {
        return {
            blockMaterials: this.materials.size,
            vegetationMaterials: this.vegetationMaterials.size,
            total: this.materials.size + this.vegetationMaterials.size + (this.waterMaterial ? 1 : 0)
        };
    }

    /**
     * Limpa todos os materiais (use apenas quando necessário)
     */
    public dispose(): void {
        this.materials.forEach(m => m.dispose());
        this.materials.clear();

        this.vegetationMaterials.forEach(m => m.dispose());
        this.vegetationMaterials.clear();

        this.waterMaterial?.dispose();
        this.waterMaterial = null;

        this.initialized = false;
    }
}

// Helper function
export function getMaterialPool(): MaterialPool {
    return MaterialPool.getInstance();
}

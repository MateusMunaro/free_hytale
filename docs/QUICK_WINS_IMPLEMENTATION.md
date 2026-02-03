# 🚀 Quick Wins - Guia de Implementação

Este documento contém código pronto para implementar as otimizações de "Quick Wins" identificadas na análise de performance.

---

## 1. Material Pool

### Criar arquivo: `src/utils/MaterialPool.ts`

```typescript
import * as THREE from 'three';
import { BlockType, BLOCKS } from '../world/BlockTypes';
import { getTextureManager } from '../graphics/TextureManager';

/**
 * Pool de materiais Three.js para reutilização
 * Evita criação de materiais duplicados
 */
export class MaterialPool {
    private static instance: MaterialPool;
    private materials: Map<string, THREE.Material> = new Map();
    private vegetationMaterials: Map<BlockType, THREE.Material> = new Map();
    private waterMaterial: THREE.Material | null = null;

    private constructor() {}

    public static getInstance(): MaterialPool {
        if (!MaterialPool.instance) {
            MaterialPool.instance = new MaterialPool();
        }
        return MaterialPool.instance;
    }

    /**
     * Obtém material para um tipo de bloco e face
     */
    public getBlockMaterial(
        blockType: BlockType,
        faceType: 'top' | 'side' | 'bottom'
    ): THREE.Material {
        const key = `${blockType}_${faceType}`;
        
        if (!this.materials.has(key)) {
            const textureManager = getTextureManager();
            const textureSet = textureManager.getTextures(blockType);
            const blockData = BLOCKS[blockType];
            const isLeaves = blockType === BlockType.LEAVES;

            const material = new THREE.MeshStandardMaterial({
                map: textureSet?.[faceType],
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
    public getStats(): { blockMaterials: number; vegetationMaterials: number } {
        return {
            blockMaterials: this.materials.size,
            vegetationMaterials: this.vegetationMaterials.size
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
    }
}

// Helper function
export function getMaterialPool(): MaterialPool {
    return MaterialPool.getInstance();
}
```

### Como aplicar no Chunk.ts

Substituir criação de materiais inline por chamadas ao pool:

```typescript
// ANTES (Chunk.ts linha ~534)
const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: blockData?.roughness ?? 0.85,
    metalness: 0.0,
    // ...
});

// DEPOIS
import { getMaterialPool } from '../utils/MaterialPool';

// Na função createMesh(), substituir por:
const material = getMaterialPool().getBlockMaterial(blockType, faceType);
```

---

## 2. Object Pool para Arrays

### Criar arquivo: `src/utils/ObjectPool.ts`

```typescript
/**
 * Pool genérico de objetos reutilizáveis
 * Reduz pressão no Garbage Collector
 */
export class ObjectPool<T> {
    private pool: T[] = [];
    private factory: () => T;
    private reset: (obj: T) => void;
    private maxSize: number;

    constructor(
        factory: () => T,
        reset: (obj: T) => void,
        initialSize: number = 10,
        maxSize: number = 100
    ) {
        this.factory = factory;
        this.reset = reset;
        this.maxSize = maxSize;

        // Pre-populate pool
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(factory());
        }
    }

    /**
     * Obtém objeto do pool ou cria novo
     */
    public acquire(): T {
        if (this.pool.length > 0) {
            return this.pool.pop()!;
        }
        return this.factory();
    }

    /**
     * Devolve objeto ao pool
     */
    public release(obj: T): void {
        if (this.pool.length < this.maxSize) {
            this.reset(obj);
            this.pool.push(obj);
        }
    }

    /**
     * Tamanho atual do pool
     */
    public size(): number {
        return this.pool.length;
    }
}

/**
 * Pool especializado para arrays
 */
export class ArrayPool<T> {
    private pool: T[][] = [];
    private maxSize: number;

    constructor(initialSize: number = 20, maxSize: number = 100) {
        this.maxSize = maxSize;
        for (let i = 0; i < initialSize; i++) {
            this.pool.push([]);
        }
    }

    public acquire(): T[] {
        return this.pool.pop() || [];
    }

    public release(arr: T[]): void {
        if (this.pool.length < this.maxSize) {
            arr.length = 0;  // Clear array
            this.pool.push(arr);
        }
    }

    public size(): number {
        return this.pool.length;
    }
}

/**
 * Pool para GeometryData usado no meshing
 */
export interface GeometryData {
    positions: number[];
    normals: number[];
    uvs: number[];
    indices: number[];
}

export class GeometryDataPool {
    private static instance: GeometryDataPool;
    private pool: GeometryData[] = [];
    private maxSize: number = 50;

    private constructor() {
        for (let i = 0; i < 10; i++) {
            this.pool.push(this.createEmpty());
        }
    }

    public static getInstance(): GeometryDataPool {
        if (!GeometryDataPool.instance) {
            GeometryDataPool.instance = new GeometryDataPool();
        }
        return GeometryDataPool.instance;
    }

    private createEmpty(): GeometryData {
        return {
            positions: [],
            normals: [],
            uvs: [],
            indices: []
        };
    }

    public acquire(): GeometryData {
        if (this.pool.length > 0) {
            return this.pool.pop()!;
        }
        return this.createEmpty();
    }

    public release(data: GeometryData): void {
        if (this.pool.length < this.maxSize) {
            data.positions.length = 0;
            data.normals.length = 0;
            data.uvs.length = 0;
            data.indices.length = 0;
            this.pool.push(data);
        }
    }
}
```

### Como aplicar no Player.ts

```typescript
// ANTES (Player.ts linha ~170)
private getCollidingBlocks(aabb: AABB): Array<{ x: number; y: number; z: number }> {
    const blocks: Array<...> = [];  // Alocação a cada chamada
    // ...
    return blocks;
}

// DEPOIS
import { ArrayPool } from '../utils/ObjectPool';

// No construtor:
private blockArrayPool = new ArrayPool<{ x: number; y: number; z: number }>(10, 50);
private tempBlockArray: Array<{ x: number; y: number; z: number }> = [];

private getCollidingBlocks(aabb: AABB): Array<{ x: number; y: number; z: number }> {
    // Reutiliza array
    this.tempBlockArray.length = 0;
    
    // ... mesmo código, mas usando this.tempBlockArray
    
    return this.tempBlockArray;
}
```

---

## 3. LRU Cache

### Criar arquivo: `src/utils/LRUCache.ts`

```typescript
/**
 * Least Recently Used Cache
 * Mantém os itens mais recentemente acessados
 */
export class LRUCache<K, V> {
    private cache: Map<K, V>;
    private maxSize: number;
    private hits: number = 0;
    private misses: number = 0;

    constructor(maxSize: number = 10000) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }

    /**
     * Obtém valor do cache
     */
    public get(key: K): V | undefined {
        const value = this.cache.get(key);
        
        if (value !== undefined) {
            // Move para o fim (mais recentemente usado)
            this.cache.delete(key);
            this.cache.set(key, value);
            this.hits++;
            return value;
        }
        
        this.misses++;
        return undefined;
    }

    /**
     * Define valor no cache
     */
    public set(key: K, value: V): void {
        // Se já existe, remove para atualizar posição
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        // Se cheio, remove o mais antigo (primeiro)
        else if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
        
        this.cache.set(key, value);
    }

    /**
     * Verifica se chave existe
     */
    public has(key: K): boolean {
        return this.cache.has(key);
    }

    /**
     * Remove chave do cache
     */
    public delete(key: K): boolean {
        return this.cache.delete(key);
    }

    /**
     * Limpa o cache
     */
    public clear(): void {
        this.cache.clear();
    }

    /**
     * Tamanho atual
     */
    public size(): number {
        return this.cache.size;
    }

    /**
     * Estatísticas
     */
    public getStats(): { size: number; hits: number; misses: number; hitRate: number } {
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? this.hits / total : 0
        };
    }

    /**
     * Remove entradas que começam com prefixo
     */
    public deleteByPrefix(prefix: string): number {
        if (typeof prefix !== 'string') return 0;
        
        const keysToDelete: K[] = [];
        for (const key of this.cache.keys()) {
            if (typeof key === 'string' && key.startsWith(prefix)) {
                keysToDelete.push(key);
            }
        }
        
        for (const key of keysToDelete) {
            this.cache.delete(key);
        }
        
        return keysToDelete.length;
    }
}
```

### Como aplicar no World.ts

```typescript
// ANTES (World.ts)
private blockCache: Map<string, BlockType> = new Map();

// ...

if (this.blockCache.size > 10000) {
    this.blockCache.clear();  // Descarta TODO o cache
}

// DEPOIS
import { LRUCache } from '../utils/LRUCache';

private blockCache = new LRUCache<string, BlockType>(15000);

// Remover a verificação de tamanho - LRU gerencia automaticamente
// O cache antigo será substituído pelo novo
```

---

## 4. Set para Vegetação

### Modificar arquivo: `src/world/Chunk.ts`

```typescript
// ANTES (Chunk.ts linhas 87-101)
const VEGETATION_BLOCKS = [
    BlockType.TALL_GRASS,
    BlockType.FERN,
    BlockType.DEAD_BUSH,
    BlockType.FLOWER_RED,
    BlockType.FLOWER_YELLOW,
    BlockType.FLOWER_BLUE,
    BlockType.FLOWER_WHITE,
    BlockType.MUSHROOM_RED,
    BlockType.MUSHROOM_BROWN
];

function isVegetationBlock(blockType: BlockType): boolean {
    return VEGETATION_BLOCKS.includes(blockType);  // O(n)
}

// DEPOIS
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
    return VEGETATION_SET.has(blockType);  // O(1)
}
```

---

## 5. Vector3 Pool

### Criar arquivo: `src/utils/Vector3Pool.ts`

```typescript
import * as THREE from 'three';

/**
 * Pool de Vector3 para operações temporárias
 * Evita alocação constante de vetores
 */
export class Vector3Pool {
    private static instance: Vector3Pool;
    private pool: THREE.Vector3[] = [];
    private inUse: Set<THREE.Vector3> = new Set();
    private maxSize: number = 100;

    private constructor() {
        // Pre-allocate
        for (let i = 0; i < 20; i++) {
            this.pool.push(new THREE.Vector3());
        }
    }

    public static getInstance(): Vector3Pool {
        if (!Vector3Pool.instance) {
            Vector3Pool.instance = new Vector3Pool();
        }
        return Vector3Pool.instance;
    }

    /**
     * Obtém vetor do pool
     */
    public acquire(): THREE.Vector3 {
        let vec: THREE.Vector3;
        
        if (this.pool.length > 0) {
            vec = this.pool.pop()!;
        } else {
            vec = new THREE.Vector3();
        }
        
        this.inUse.add(vec);
        return vec;
    }

    /**
     * Devolve vetor ao pool
     */
    public release(vec: THREE.Vector3): void {
        if (this.inUse.has(vec)) {
            this.inUse.delete(vec);
            vec.set(0, 0, 0);
            
            if (this.pool.length < this.maxSize) {
                this.pool.push(vec);
            }
        }
    }

    /**
     * Devolve múltiplos vetores
     */
    public releaseMany(...vecs: THREE.Vector3[]): void {
        for (const vec of vecs) {
            this.release(vec);
        }
    }

    /**
     * Cria vetor temporário que é devolvido automaticamente
     * Use com try-finally para garantir devolução
     */
    public temp(x: number = 0, y: number = 0, z: number = 0): THREE.Vector3 {
        return this.acquire().set(x, y, z);
    }

    public getStats(): { pooled: number; inUse: number } {
        return {
            pooled: this.pool.length,
            inUse: this.inUse.size
        };
    }
}

// Singleton helper
export function getVec3Pool(): Vector3Pool {
    return Vector3Pool.getInstance();
}
```

### Como aplicar no MiningSystem.ts

```typescript
// ANTES (MiningSystem.ts linha ~157)
const origin = this.raycaster.ray.origin.clone();
const direction = this.raycaster.ray.direction.clone();
const tempPos = origin.clone();
// Esses vetores nunca são reutilizados!

// DEPOIS
import { getVec3Pool } from '../utils/Vector3Pool';

public getTargetBlock(): ... {
    const pool = getVec3Pool();
    const origin = pool.acquire().copy(this.raycaster.ray.origin);
    const direction = pool.acquire().copy(this.raycaster.ray.direction);
    const tempPos = pool.acquire();
    
    try {
        // ... resto do código
        
        return result;
    } finally {
        pool.releaseMany(origin, direction, tempPos);
    }
}
```

---

## 6. Performance Metrics

### Criar arquivo: `src/utils/PerformanceMetrics.ts`

```typescript
/**
 * Sistema de métricas de performance
 */
export class PerformanceMetrics {
    private static instance: PerformanceMetrics;
    
    // Frame timing
    private frameStart: number = 0;
    private frameTimes: number[] = [];
    private maxSamples: number = 60;
    
    // Custom timers
    private timers: Map<string, { start: number; total: number; count: number }> = new Map();
    
    // Counters
    private counters: Map<string, number> = new Map();

    private constructor() {}

    public static getInstance(): PerformanceMetrics {
        if (!PerformanceMetrics.instance) {
            PerformanceMetrics.instance = new PerformanceMetrics();
        }
        return PerformanceMetrics.instance;
    }

    // === Frame Timing ===
    
    public beginFrame(): void {
        this.frameStart = performance.now();
    }

    public endFrame(): void {
        const frameTime = performance.now() - this.frameStart;
        this.frameTimes.push(frameTime);
        
        if (this.frameTimes.length > this.maxSamples) {
            this.frameTimes.shift();
        }
    }

    public getFPS(): number {
        if (this.frameTimes.length === 0) return 0;
        const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        return 1000 / avg;
    }

    public getAverageFrameTime(): number {
        if (this.frameTimes.length === 0) return 0;
        return this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    }

    // === Custom Timers ===
    
    public startTimer(name: string): void {
        if (!this.timers.has(name)) {
            this.timers.set(name, { start: 0, total: 0, count: 0 });
        }
        this.timers.get(name)!.start = performance.now();
    }

    public endTimer(name: string): number {
        const timer = this.timers.get(name);
        if (!timer) return 0;
        
        const elapsed = performance.now() - timer.start;
        timer.total += elapsed;
        timer.count++;
        
        return elapsed;
    }

    public getTimerAverage(name: string): number {
        const timer = this.timers.get(name);
        if (!timer || timer.count === 0) return 0;
        return timer.total / timer.count;
    }

    // === Counters ===
    
    public increment(name: string, amount: number = 1): void {
        this.counters.set(name, (this.counters.get(name) || 0) + amount);
    }

    public getCounter(name: string): number {
        return this.counters.get(name) || 0;
    }

    public resetCounters(): void {
        this.counters.clear();
    }

    // === Report ===
    
    public getReport(): object {
        const timerReport: Record<string, { avg: number; count: number }> = {};
        this.timers.forEach((timer, name) => {
            timerReport[name] = {
                avg: timer.count > 0 ? timer.total / timer.count : 0,
                count: timer.count
            };
        });

        return {
            fps: this.getFPS().toFixed(1),
            avgFrameTime: this.getAverageFrameTime().toFixed(2) + 'ms',
            timers: timerReport,
            counters: Object.fromEntries(this.counters),
            memory: this.getMemoryInfo()
        };
    }

    private getMemoryInfo(): object | null {
        // Chrome only
        if ((performance as any).memory) {
            const mem = (performance as any).memory;
            return {
                usedHeap: (mem.usedJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
                totalHeap: (mem.totalJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
            };
        }
        return null;
    }

    /**
     * Log report to console
     */
    public logReport(): void {
        console.table(this.getReport());
    }
}

// Helper
export function getMetrics(): PerformanceMetrics {
    return PerformanceMetrics.getInstance();
}
```

### Como usar no Engine.ts

```typescript
import { getMetrics } from '../utils/PerformanceMetrics';

private gameLoop = (): void => {
    const metrics = getMetrics();
    metrics.beginFrame();
    
    // Em diferentes partes do update:
    metrics.startTimer('world_update');
    this.world.update(pos.x, pos.z);
    metrics.endTimer('world_update');
    
    metrics.startTimer('render');
    this.render();
    metrics.endTimer('render');
    
    metrics.endFrame();
    
    // A cada segundo, log metrics
    if (this.frameCount % 60 === 0) {
        console.log('Performance:', metrics.getReport());
    }
};
```

---

## Resumo de Arquivos a Criar

| Arquivo | Propósito |
|---------|-----------|
| `src/utils/MaterialPool.ts` | Pool de materiais Three.js |
| `src/utils/ObjectPool.ts` | Pools genéricos para arrays/objetos |
| `src/utils/LRUCache.ts` | Cache com eviction inteligente |
| `src/utils/Vector3Pool.ts` | Pool de vetores Three.js |
| `src/utils/PerformanceMetrics.ts` | Métricas de performance |

## Ordem de Implementação Sugerida

1. **PerformanceMetrics** - Para medir o impacto das outras mudanças
2. **LRUCache** - Substituição simples do cache existente
3. **MaterialPool** - Grande impacto com mudança moderada
4. **Set para Vegetação** - Mudança de uma linha
5. **ObjectPool / Vector3Pool** - Requer mais refatoração

---

*Documento gerado em: 2026-01-21*

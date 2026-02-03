# 🎮 Análise de Performance - HytaleFree

## Sumário Executivo

Este documento apresenta uma análise detalhada dos gargalos de performance identificados no projeto HytaleFree, um jogo voxel 3D estilo Hytale desenvolvido com Three.js e TypeScript. A análise inclui propostas de otimização e uma arquitetura híbrida utilizando WebAssembly para máxima performance.

---

## 📊 Índice

1. [Arquitetura Atual](#arquitetura-atual)
2. [Gargalos Identificados](#gargalos-identificados)
3. [Análise Detalhada por Módulo](#análise-detalhada-por-módulo)
4. [Propostas de Otimização](#propostas-de-otimização)
5. [Arquitetura Proposta com WebAssembly](#arquitetura-proposta-com-webassembly)
6. [Roadmap de Implementação](#roadmap-de-implementação)
7. [Métricas e Benchmarks](#métricas-e-benchmarks)

---

## 🏗️ Arquitetura Atual

```
┌─────────────────────────────────────────────────────────────────┐
│                         ENGINE (TypeScript)                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Player    │  │   World     │  │      Renderer           │  │
│  │  - Physics  │  │  - Chunks   │  │   - Three.js Scene      │  │
│  │  - Camera   │  │  - Terrain  │  │   - Materials           │  │
│  │  - Input    │  │  - Mining   │  │   - Lighting            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Chunk     │  │  Terrain    │  │    TextureManager       │  │
│  │  - 16x256x16│  │  Generator  │  │   - Canvas Textures     │  │
│  │  - Meshing  │  │  - Noise    │  │   - Procedural Gen      │  │
│  │  - Geometry │  │  - Biomes   │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │      Three.js         │
                  │   WebGL Renderer      │
                  └───────────────────────┘
```

### Stack Atual
- **Runtime**: Browser (JavaScript/TypeScript)
- **Renderização**: Three.js v0.160.0
- **Build Tool**: Vite 5.0
- **Tipagem**: TypeScript 5.3

---

## 🔴 Gargalos Identificados

### Classificação de Severidade
- 🔴 **CRÍTICO** - Impacto direto no FPS, causa stuttering
- 🟠 **ALTO** - Impacto significativo, causa lag ocasional
- 🟡 **MÉDIO** - Impacto moderado, afeta escalabilidade
- 🟢 **BAIXO** - Impacto menor, otimização nice-to-have

---

### 1. 🔴 CRÍTICO: Geração de Chunks Síncrona

**Arquivo**: `src/world/Chunk.ts` (linhas 121-149)

```typescript
// PROBLEMA: Loop triplo aninhado executado na main thread
public generate(): void {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
            for (let y = 0; y < CHUNK_HEIGHT; y++) {  // 256 iterações!
                const blockType = this.terrainGenerator.getBlockAt(wx, y, wz);
                this.setBlock(lx, y, lz, blockType);
            }
        }
    }
}
```

**Impacto**:
- Cada chunk processa **16 × 256 × 16 = 65.536 blocos**
- Cálculos de ruído Simplex são computacionalmente intensivos
- Causa **frame drops** quando chunks são gerados

**Dados**:
- ~5-15ms por chunk em CPUs modernas
- Com `renderDistance: 6`, até 169 chunks podem precisar de geração
- **Total teórico**: até 2.5 segundos de blocking

---

### 2. 🔴 CRÍTICO: Meshing de Chunks Não Otimizado

**Arquivo**: `src/world/Chunk.ts` (linhas 249-343)

```typescript
// PROBLEMA: Greedy meshing não implementado
// Cada face é processada individualmente
public buildMesh(): void {
    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {  // 256!
            for (let z = 0; z < CHUNK_SIZE; z++) {
                // 6 verificações de face por bloco
                if (this.shouldRenderFace(x, y + 1, z, block, isWater)) { ... }
                if (this.shouldRenderFace(x, y - 1, z, block, isWater)) { ... }
                // ... mais 4 faces
            }
        }
    }
}
```

**Impacto**:
- **Sem Greedy Meshing**: faces redundantes consomem GPU
- **Array temporários**: muitas alocações de memória
- **65.536 × 6 = 393.216** verificações de face por chunk

---

### 3. 🔴 CRÍTICO: Cálculos de Noise em JavaScript

**Arquivo**: `src/utils/noise.ts`

```typescript
// PROBLEMA: Simplex Noise puro em JavaScript
noise2D(x: number, y: number): number {
    // 50+ operações matemáticas por chamada
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    // ... muitas operações
}

// FBM amplifica o problema
fbm(x: number, y: number, octaves: number = 6, ...): number {
    for (let i = 0; i < octaves; i++) {
        value += this.noise2D(x * frequency, y * frequency) * amplitude;
        // ... 
    }
}
```

**Impacto**:
- **6+ octaves** por cálculo de FBM
- Chamado **milhares de vezes** por chunk
- JavaScript NÃO é otimizado para SIMD

---

### 4. 🟠 ALTO: Criação Excessiva de Materiais Three.js

**Arquivo**: `src/world/Chunk.ts` (linhas 523-549)

```typescript
// PROBLEMA: Novo material criado para CADA mesh de chunk
private createMesh(geometry: GeometryData, texture: THREE.Texture | undefined, blockType: BlockType): THREE.Mesh {
    const material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: blockData?.roughness ?? 0.85,
        // ...
    });
    // Material não é reutilizado!
}
```

**Impacto**:
- Com 169 chunks × ~10 meshes/chunk = **1.690 materiais**
- Cada material = **shader separado** (possível)
- **Draw calls aumentam exponencialmente**

---

### 5. 🟠 ALTO: Colisão com Verificação Exaustiva

**Arquivo**: `src/player/Player.ts` (linhas 170-194)

```typescript
// PROBLEMA: Itera sobre todos os blocos no AABB
private getCollidingBlocks(aabb: AABB): Array<{ x: number; y: number; z: number }> {
    const blocks: Array<...> = [];  // Alocação a cada chamada
    
    for (let bx = minBX; bx <= maxBX; bx++) {
        for (let by = minBY; by <= maxBY; by++) {
            for (let bz = minBZ; bz <= maxBZ; bz++) {
                if (this.world.isBlockSolid(bx, by, bz)) {  // Lookup custoso
                    // ...
                }
            }
        }
    }
}
```

**Impacto**:
- Chamado **3-4 vezes por frame** (X, Z, Y, autoStep)
- Cada `isBlockSolid()` faz lookup no chunk + cache
- Alocação de array a cada chamada = **GC pressure**

---

### 6. 🟠 ALTO: TextureManager Gera Todas as Texturas no Start

**Arquivo**: `src/graphics/TextureManager.ts`

```typescript
// PROBLEMA: 1000+ linhas de geração procedural síncrona
constructor() {
    this.generateAllTextures();  // Bloqueia o carregamento inicial
    this.generateGrassVariations();
}
```

**Impacto**:
- **40+ texturas** geradas via Canvas2D
- Cada textura = **128×128 pixels** com múltiplos passes
- Tempo de inicialização: **200-500ms**

---

### 7. 🟡 MÉDIO: Cache de Blocos com Limite Arbitrário

**Arquivo**: `src/world/World.ts` (linhas 118-121)

```typescript
// PROBLEMA: Cache limpo completamente quando atinge limite
if (this.blockCache.size > 10000) {
    this.blockCache.clear();  // Descarta TODO o cache
}
```

**Impacto**:
- **Cold cache** após limpeza = spike de lookups
- Não usa LRU ou estratégia inteligente
- 10.000 entries pode ser muito ou pouco dependendo do scenario

---

### 8. 🟡 MÉDIO: Geração de Terreno Recalcula Column Info

**Arquivo**: `src/world/TerrainGenerator.ts`

```typescript
// PROBLEMA: Cache por coluna, mas limpo após cada chunk
public generateChunkData(...): Uint8Array {
    // ...
    this.columnCache.clear();  // Colisão entre chunks adjacentes
}
```

**Impacto**:
- Chunks adjacentes **recalculam** colunas de borda
- **~64 colunas redundantes** por chunk (bordas)

---

### 9. 🟡 MÉDIO: Raycasting com Step Fixo

**Arquivo**: `src/player/MiningSystem.ts` (linhas 148-195)

```typescript
// PROBLEMA: Step de 0.1 pode ser muito fino ou grosso
const step = 0.1;
for (let d = 0; d < this.maxReach; d += step) {
    // 50 iterações para maxReach=5
    tempPos.copy(origin).add(direction.clone().multiplyScalar(d));
    // Alocações de Vector3 em cada iteração
}
```

**Impacto**:
- **50 iterações × 2 vector clones** = 100+ alocações/frame
- Algoritmo DDA seria mais eficiente

---

### 10. 🟢 BAIXO: Verificação de Vegetação com Array.includes()

**Arquivo**: `src/world/Chunk.ts` (linha 99-101)

```typescript
function isVegetationBlock(blockType: BlockType): boolean {
    return VEGETATION_BLOCKS.includes(blockType);  // O(n) lookup
}
```

**Impacto**:
- Chamado para cada bloco durante meshing
- Array.includes() é O(n), Set seria O(1)

---

## 📈 Análise Detalhada por Módulo

### Módulo: World/Chunk System

| Componente | CPU % Est. | Memória | Gargalo Principal |
|------------|-----------|---------|-------------------|
| Chunk.generate() | 25-35% | Alto (temp arrays) | Loops síncronos |
| Chunk.buildMesh() | 30-40% | Alto | Sem greedy mesh |
| TerrainGenerator | 15-20% | Médio | Noise JS |
| World.getBlockAt() | 5-10% | Baixo | Cache miss |

### Módulo: Rendering

| Componente | GPU % Est. | Draw Calls | Gargalo Principal |
|------------|-----------|------------|-------------------|
| Chunk meshes | 40-50% | Alto | Materiais duplicados |
| Water | 10-15% | Médio | Transparência |
| Vegetation | 5-10% | Alto | Alpha cutout |
| Sky | 5% | Baixo | - |

### Módulo: Physics/Player

| Componente | CPU % Est. | Alocações/frame | Gargalo Principal |
|------------|-----------|-----------------|-------------------|
| Collision | 5-10% | Alto | Loops + arrays |
| Raycasting | 3-5% | Alto | Vector clones |
| Input | 1% | Baixo | - |

---

## 🚀 Propostas de Otimização

### Nível 1: Quick Wins (1-2 dias cada)

#### 1.1 Material Pool
```typescript
// ANTES: Material por mesh
const material = new THREE.MeshStandardMaterial({...});

// DEPOIS: Pool de materiais
class MaterialPool {
    private static materials: Map<string, THREE.Material> = new Map();
    
    static get(blockType: BlockType, faceType: string): THREE.Material {
        const key = `${blockType}_${faceType}`;
        if (!this.materials.has(key)) {
            this.materials.set(key, this.createMaterial(blockType, faceType));
        }
        return this.materials.get(key)!;
    }
}
```

**Redução esperada**: 80-90% menos materiais

#### 1.2 Object Pool para Arrays
```typescript
// Pool de arrays reutilizáveis
class ArrayPool<T> {
    private pool: T[][] = [];
    
    get(): T[] {
        return this.pool.pop() || [];
    }
    
    release(arr: T[]): void {
        arr.length = 0;
        this.pool.push(arr);
    }
}
```

#### 1.3 Set para Vegetação
```typescript
const VEGETATION_SET = new Set([
    BlockType.TALL_GRASS,
    BlockType.FERN,
    // ...
]);

function isVegetationBlock(blockType: BlockType): boolean {
    return VEGETATION_SET.has(blockType);  // O(1)
}
```

#### 1.4 LRU Cache
```typescript
class LRUCache<K, V> {
    private cache: Map<K, V> = new Map();
    private maxSize: number;
    
    get(key: K): V | undefined {
        const value = this.cache.get(key);
        if (value !== undefined) {
            // Move to end (most recently used)
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }
}
```

---

### Nível 2: Otimizações Estruturais (1-2 semanas)

#### 2.1 Web Workers para Chunk Generation

```typescript
// ChunkWorker.ts
self.onmessage = (e) => {
    const { chunkX, chunkZ, seed } = e.data;
    const generator = new TerrainGenerator({ seed });
    const data = generator.generateChunkData(chunkX, chunkZ);
    self.postMessage({ chunkX, chunkZ, data }, [data.buffer]);
};

// World.ts
class World {
    private workers: Worker[] = [];
    private pendingChunks: Map<string, Promise<Uint8Array>> = new Map();
    
    constructor() {
        // Pool de workers
        const numWorkers = navigator.hardwareConcurrency || 4;
        for (let i = 0; i < numWorkers; i++) {
            this.workers.push(new Worker('ChunkWorker.js'));
        }
    }
    
    async generateChunkAsync(x: number, z: number): Promise<Uint8Array> {
        const worker = this.getAvailableWorker();
        return new Promise((resolve) => {
            worker.postMessage({ chunkX: x, chunkZ: z, seed: this.seed });
            worker.onmessage = (e) => resolve(e.data.data);
        });
    }
}
```

**Benefício**: Desbloqueia main thread, geração paralela

#### 2.2 Greedy Meshing

```typescript
class GreedyMesher {
    mesh(chunk: Chunk): GeometryData[] {
        const geometries: GeometryData[] = [];
        
        // Para cada direção (6 faces)
        for (const axis of [0, 1, 2]) {
            for (const direction of [-1, 1]) {
                geometries.push(
                    this.meshSlice(chunk, axis, direction)
                );
            }
        }
        
        return geometries;
    }
    
    private meshSlice(chunk: Chunk, axis: number, dir: number): GeometryData {
        // Algoritmo greedy combina faces adjacentes do mesmo tipo
        // Reduz drasticamente o número de quads
    }
}
```

**Redução esperada**: 60-80% menos vértices

#### 2.3 DDA Raycasting

```typescript
class DDAraycast {
    cast(origin: THREE.Vector3, direction: THREE.Vector3, maxDist: number) {
        // Digital Differential Analyzer - mais eficiente que stepping
        const step = direction.clone().normalize();
        const tDelta = new THREE.Vector3(
            Math.abs(1 / step.x),
            Math.abs(1 / step.y),
            Math.abs(1 / step.z)
        );
        
        // ... implementação DDA
    }
}
```

---

### Nível 3: WebAssembly (ver próxima seção)

---

## 🔷 Arquitetura Proposta com WebAssembly

### Visão Geral

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (TypeScript)                          │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│   │   Game Engine   │  │    UI/Input     │  │    Three.js Renderer    │ │
│   │   Orchestrator  │  │    Manager      │  │    (GPU Rendering)      │ │
│   └────────┬────────┘  └────────┬────────┘  └────────────┬────────────┘ │
└────────────┼─────────────────────┼──────────────────────┼───────────────┘
             │                     │                      │
             ▼                     ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        SHARED MEMORY BUFFER                              │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  SharedArrayBuffer (Chunk Data, Player State, Mesh Vertices)    │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
             │                     │                      │
             ▼                     ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         WASM CORE (Rust/C++)                             │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │  TerrainGen     │  │   Meshing       │  │     Physics/Collision   │  │
│  │  - Noise SIMD   │  │   - Greedy      │  │     - AABB Broadphase   │  │
│  │  - Biomes       │  │   - Culling     │  │     - Narrowphase       │  │
│  │  - Caves        │  │   - LOD         │  │     - Raycasting        │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │   Chunk Store   │  │    Pathfinding  │  │       Utilities         │  │
│  │   - Octree      │  │    - A* / JPS   │  │     - Math (SIMD)       │  │
│  │   - Compression │  │    - NavMesh    │  │     - Hash Functions    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Componentes WASM Propostos

#### 1. TerrainGenerator WASM (Rust)

```rust
// terrain_generator.rs
use wasm_bindgen::prelude::*;
use simd_noise::NoiseBuilder;

#[wasm_bindgen]
pub struct TerrainGenerator {
    seed: u64,
    noise: NoiseBuilder,
}

#[wasm_bindgen]
impl TerrainGenerator {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u64) -> TerrainGenerator {
        TerrainGenerator {
            seed,
            noise: NoiseBuilder::gradient_3d_offset(seed as f32, 0.0, 0.0, 0.0),
        }
    }
    
    /// Gera chunk completo, retorna Uint8Array
    #[wasm_bindgen]
    pub fn generate_chunk(&self, chunk_x: i32, chunk_z: i32) -> Vec<u8> {
        let mut data = vec![0u8; 16 * 256 * 16];
        
        // SIMD-accelerated noise generation
        for x in 0..16 {
            for z in 0..16 {
                let world_x = chunk_x * 16 + x;
                let world_z = chunk_z * 16 + z;
                
                let height = self.calculate_height(world_x, world_z);
                // ... populate data
            }
        }
        
        data
    }
    
    fn calculate_height(&self, x: i32, z: i32) -> f32 {
        // Use SIMD-accelerated noise
        self.noise.fbm_2d(x as f32 * 0.01, z as f32 * 0.01, 6, 0.5, 2.0)
    }
}
```

**Ganho esperado**: 5-10x mais rápido que JS

#### 2. GreedyMesher WASM (Rust)

```rust
#[wasm_bindgen]
pub struct GreedyMesher {
    // Buffers pré-alocados
    vertices: Vec<f32>,
    normals: Vec<f32>,
    uvs: Vec<f32>,
    indices: Vec<u32>,
}

#[wasm_bindgen]
impl GreedyMesher {
    #[wasm_bindgen]
    pub fn mesh_chunk(&mut self, chunk_data: &[u8]) -> MeshResult {
        self.clear_buffers();
        
        // Greedy mesh each axis
        self.mesh_axis(chunk_data, Axis::X, 1);
        self.mesh_axis(chunk_data, Axis::X, -1);
        self.mesh_axis(chunk_data, Axis::Y, 1);
        self.mesh_axis(chunk_data, Axis::Y, -1);
        self.mesh_axis(chunk_data, Axis::Z, 1);
        self.mesh_axis(chunk_data, Axis::Z, -1);
        
        MeshResult {
            vertices: self.vertices.clone(),
            normals: self.normals.clone(),
            uvs: self.uvs.clone(),
            indices: self.indices.clone(),
        }
    }
}
```

#### 3. PhysicsEngine WASM

```rust
#[wasm_bindgen]
pub struct PhysicsEngine {
    world_access: WorldAccessor,
}

#[wasm_bindgen]
impl PhysicsEngine {
    /// Resolve collision e retorna nova posição
    #[wasm_bindgen]
    pub fn resolve_movement(
        &self,
        pos_x: f32, pos_y: f32, pos_z: f32,
        vel_x: f32, vel_y: f32, vel_z: f32,
        delta_time: f32
    ) -> PositionResult {
        let aabb = self.create_player_aabb(pos_x, pos_y, pos_z);
        
        // Broadphase: octree query
        let candidates = self.world_access.query_aabb(&aabb);
        
        // Narrowphase: resolve individual collisions
        // ... collision resolution
        
        PositionResult { x, y, z, on_ground }
    }
    
    /// DDA Raycast (muito mais eficiente)
    #[wasm_bindgen]
    pub fn raycast(
        &self,
        origin_x: f32, origin_y: f32, origin_z: f32,
        dir_x: f32, dir_y: f32, dir_z: f32,
        max_distance: f32
    ) -> RaycastResult {
        // Digital Differential Analyzer
        // ...
    }
}
```

### Estrutura de Arquivos Proposta

```
hytale_free/
├── src/                          # TypeScript (Frontend)
│   ├── engine/
│   │   ├── Engine.ts
│   │   ├── WasmBridge.ts        # Interface com WASM
│   │   └── Renderer.ts
│   ├── world/
│   │   ├── World.ts             # Orquestra chunks
│   │   ├── ChunkManager.ts      # Gerencia loading/unloading
│   │   └── BlockTypes.ts
│   ├── player/
│   │   ├── Player.ts            # Usa PhysicsEngine WASM
│   │   └── InputManager.ts
│   └── ...
│
├── wasm/                         # Rust WASM Core
│   ├── Cargo.toml
│   ├── src/
│   │   ├── lib.rs               # Entry point
│   │   ├── terrain/
│   │   │   ├── mod.rs
│   │   │   ├── noise.rs         # SIMD Simplex
│   │   │   ├── generator.rs
│   │   │   └── biomes.rs
│   │   ├── meshing/
│   │   │   ├── mod.rs
│   │   │   ├── greedy.rs
│   │   │   └── culling.rs
│   │   ├── physics/
│   │   │   ├── mod.rs
│   │   │   ├── collision.rs
│   │   │   └── raycast.rs
│   │   └── utils/
│   │       ├── mod.rs
│   │       ├── simd.rs
│   │       └── octree.rs
│   └── pkg/                      # Build output
│       └── hytale_wasm.js
│
├── workers/                      # Web Workers
│   ├── ChunkGeneratorWorker.ts
│   └── MeshingWorker.ts
│
└── docs/
    └── PERFORMANCE_ANALYSIS.md
```

### Interface TypeScript-WASM

```typescript
// src/engine/WasmBridge.ts
import init, { 
    TerrainGenerator, 
    GreedyMesher, 
    PhysicsEngine 
} from '../../wasm/pkg/hytale_wasm';

export class WasmBridge {
    private static instance: WasmBridge;
    private terrainGen!: TerrainGenerator;
    private mesher!: GreedyMesher;
    private physics!: PhysicsEngine;
    
    private constructor() {}
    
    static async initialize(): Promise<WasmBridge> {
        if (!WasmBridge.instance) {
            await init();  // Load WASM module
            WasmBridge.instance = new WasmBridge();
            WasmBridge.instance.terrainGen = new TerrainGenerator(12345);
            WasmBridge.instance.mesher = new GreedyMesher();
            WasmBridge.instance.physics = new PhysicsEngine();
        }
        return WasmBridge.instance;
    }
    
    generateChunk(x: number, z: number): Uint8Array {
        return this.terrainGen.generate_chunk(x, z);
    }
    
    meshChunk(data: Uint8Array): MeshData {
        return this.mesher.mesh_chunk(data);
    }
    
    resolveMovement(pos: Vec3, vel: Vec3, dt: number): MovementResult {
        return this.physics.resolve_movement(
            pos.x, pos.y, pos.z,
            vel.x, vel.y, vel.z,
            dt
        );
    }
}
```

### Pipeline de Build

```json
// package.json
{
  "scripts": {
    "build:wasm": "cd wasm && wasm-pack build --target web",
    "build": "npm run build:wasm && tsc && vite build",
    "dev": "npm run build:wasm && vite"
  }
}
```

---

## 📅 Roadmap de Implementação

### Fase 1: Quick Wins (Semana 1)
- [ ] Material Pool
- [ ] Object Pool para arrays
- [ ] LRU Cache
- [ ] Set para vegetação lookup

**Meta**: +20-30% FPS

### Fase 2: Web Workers (Semana 2-3)
- [ ] Worker pool para chunk generation
- [ ] Transferable objects (zero-copy)
- [ ] Priority queue para chunks

**Meta**: Eliminar stuttering

### Fase 3: WASM Core - Terrain (Semana 4-5)
- [ ] Setup Rust + wasm-pack
- [ ] TerrainGenerator em Rust
- [ ] SIMD noise implementation
- [ ] Integração com Workers

**Meta**: 5x mais rápido terrain gen

### Fase 4: WASM Core - Meshing (Semana 6-7)
- [ ] GreedyMesher em Rust
- [ ] Face culling otimizado
- [ ] Buffer reutilização

**Meta**: 60-80% menos vértices

### Fase 5: WASM Core - Physics (Semana 8)
- [ ] PhysicsEngine em Rust
- [ ] DDA raycasting
- [ ] AABB collision otimizado

**Meta**: Physics zero-cost na main thread

### Fase 6: Polish (Semana 9-10)
- [ ] LOD system
- [ ] Frustum culling avançado
- [ ] Profiling e fine-tuning

---

## 📊 Métricas e Benchmarks

### Métricas a Monitorar

```typescript
class PerformanceMetrics {
    // Frame timing
    frameTime: number;
    fps: number;
    
    // Chunk metrics
    chunkGenTime: number;
    chunkMeshTime: number;
    activeChunks: number;
    
    // Memory
    jsHeapSize: number;
    wasmMemory: number;
    
    // Render
    drawCalls: number;
    triangles: number;
    
    // Physics
    collisionChecks: number;
    raycastTime: number;
}
```

### Targets de Performance

| Métrica | Atual (Est.) | Target Fase 1 | Target Final |
|---------|-------------|---------------|--------------|
| FPS | 30-45 | 50-60 | 60+ stable |
| Chunk Gen | 10-15ms | 8-10ms | <2ms (WASM) |
| Mesh Build | 15-25ms | 10-15ms | <5ms (WASM) |
| Draw Calls | 500+ | 200 | <100 |
| Memory | 500MB+ | 400MB | 300MB |

### Como Medir

```typescript
// Adicionar ao Engine.ts
private measurePerformance(): void {
    // Frame timing
    const now = performance.now();
    this.metrics.frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;
    
    // Memory (Chrome only)
    if (performance.memory) {
        this.metrics.jsHeapSize = performance.memory.usedJSHeapSize;
    }
    
    // Renderer info
    const info = this.renderer.info;
    this.metrics.drawCalls = info.render.calls;
    this.metrics.triangles = info.render.triangles;
}
```

---

## 🛠️ Ferramentas Recomendadas

### Profiling
- **Chrome DevTools Performance**: Frame timing, JS profiling
- **Memory tab**: Heap snapshots, allocation timeline
- **Spector.js**: GPU debugging

### WASM Development
- **wasm-pack**: Build Rust to WASM
- **wasm-opt**: Optimize WASM binary
- **twiggy**: Analyze WASM size

### Benchmarking
- **benchmark.js**: Micro-benchmarks
- **stats.js**: Real-time FPS overlay

---

## ✅ Checklist de Refatoração

### Preparação
- [ ] Adicionar métricas de performance
- [ ] Criar benchmark suite
- [ ] Documentar baseline atual

### Fase 1 - Quick Wins
- [ ] Implementar MaterialPool
- [ ] Implementar ArrayPool
- [ ] Trocar Array.includes por Set.has
- [ ] Implementar LRUCache

### Fase 2 - Workers
- [ ] Criar ChunkGeneratorWorker
- [ ] Usar Transferable para zero-copy
- [ ] Implementar priority queue

### Fase 3+ - WASM
- [ ] Setup projeto Rust
- [ ] Implementar TerrainGenerator WASM
- [ ] Implementar GreedyMesher WASM
- [ ] Implementar PhysicsEngine WASM
- [ ] Integrar com frontend

---

## 📚 Referências

1. [Voxel Engine Optimization - 0fps.net](https://0fps.net/2012/06/30/meshing-in-a-minecraft-game/)
2. [Greedy Meshing Algorithm](https://0fps.net/2012/06/30/meshing-in-a-minecraft-game/)
3. [Simplex Noise SIMD](https://github.com/Auburn/FastNoise2)
4. [wasm-bindgen Documentation](https://rustwasm.github.io/wasm-bindgen/)
5. [Three.js Performance Tips](https://threejs.org/manual/#en/optimize-lots-of-objects)

---

*Documento gerado em: 2026-01-21*
*Versão: 1.0*

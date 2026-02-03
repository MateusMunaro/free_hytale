# 🔷 Arquitetura WebAssembly - Guia de Implementação

## Visão Geral

Este documento detalha como implementar os componentes críticos de performance do HytaleFree em WebAssembly usando Rust, proporcionando ganhos de 5-10x em operações computacionalmente intensivas.

---

## Por que Rust + WebAssembly?

| Aspecto | JavaScript | Rust/WASM |
|---------|-----------|-----------|
| **Performance** | JIT compilation | AOT + SIMD nativo |
| **Memória** | GC pausas | Controle explícito |
| **Paralelismo** | Limited (Workers) | Rayon + SIMD |
| **Noise Gen** | ~50 ops/call | ~10 ops/call (SIMD) |
| **Binding** | N/A | wasm-bindgen zero-cost |

---

## Setup do Projeto Rust/WASM

### 1. Estrutura de Diretórios

```
hytale_free/
├── wasm/
│   ├── Cargo.toml
│   ├── src/
│   │   ├── lib.rs              # Entry point + exports
│   │   ├── terrain/
│   │   │   ├── mod.rs
│   │   │   ├── noise.rs        # SIMD Simplex Noise
│   │   │   ├── generator.rs    # TerrainGenerator
│   │   │   └── biomes.rs       # Biome calculation
│   │   ├── meshing/
│   │   │   ├── mod.rs
│   │   │   ├── greedy.rs       # Greedy Meshing
│   │   │   └── types.rs        # MeshData structures
│   │   ├── physics/
│   │   │   ├── mod.rs
│   │   │   ├── collision.rs    # AABB collision
│   │   │   └── raycast.rs      # DDA raycasting
│   │   └── utils/
│   │       ├── mod.rs
│   │       ├── simd.rs         # SIMD utilities
│   │       └── octree.rs       # Spatial indexing
│   └── pkg/                     # Build output
│       ├── hytale_wasm.js
│       ├── hytale_wasm_bg.wasm
│       └── hytale_wasm.d.ts
```

### 2. Cargo.toml

```toml
[package]
name = "hytale-wasm"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2"
js-sys = "0.3"
console_error_panic_hook = "0.1"

# SIMD Noise
simd-noise = { version = "5.1", features = ["sse2", "sse41", "avx2"] }

# Serialization
serde = { version = "1.0", features = ["derive"] }
serde-wasm-bindgen = "0.6"

# Parallel rayon (para futuro uso com threads)
# rayon = "1.8"

[features]
default = ["console_error_panic_hook"]

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
panic = "abort"

[package.metadata.wasm-pack.profile.release]
wasm-opt = ["-O4", "--enable-simd"]
```

### 3. Build Script (package.json)

Adicionar ao `package.json`:

```json
{
  "scripts": {
    "build:wasm": "cd wasm && wasm-pack build --target web --release",
    "build:wasm:dev": "cd wasm && wasm-pack build --target web --dev",
    "dev": "npm run build:wasm:dev && vite",
    "build": "npm run build:wasm && tsc && vite build"
  }
}
```

---

## Implementação: TerrainGenerator

### wasm/src/lib.rs

```rust
use wasm_bindgen::prelude::*;

pub mod terrain;
pub mod meshing;
pub mod physics;
pub mod utils;

// Inicialização do panic hook para debug
#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// Re-export principais estruturas
pub use terrain::TerrainGenerator;
pub use meshing::GreedyMesher;
pub use physics::PhysicsEngine;
```

### wasm/src/terrain/mod.rs

```rust
mod noise;
mod generator;
mod biomes;

pub use generator::TerrainGenerator;
pub use biomes::Biome;
```

### wasm/src/terrain/noise.rs

```rust
use simd_noise::NoiseBuilder;

/// Wrapper para noise SIMD-accelerated
pub struct NoiseEngine {
    seed: i32,
}

impl NoiseEngine {
    pub fn new(seed: i32) -> Self {
        Self { seed }
    }
    
    /// Simplex 2D - usado para heightmaps
    pub fn simplex_2d(&self, x: f32, z: f32, scale: f32) -> f32 {
        let (noise, _, _) = NoiseBuilder::gradient_2d_offset(x * scale, 1, z * scale, 1)
            .with_seed(self.seed)
            .generate();
        noise[0]
    }
    
    /// Simplex 3D - usado para caves
    pub fn simplex_3d(&self, x: f32, y: f32, z: f32, scale: f32) -> f32 {
        let (noise, _, _) = NoiseBuilder::gradient_3d_offset(
            x * scale, 1,
            y * scale, 1,
            z * scale, 1
        )
            .with_seed(self.seed)
            .generate();
        noise[0]
    }
    
    /// FBM 2D - múltiplas octaves para terreno detalhado
    pub fn fbm_2d(
        &self,
        x: f32,
        z: f32,
        octaves: u8,
        persistence: f32,
        lacunarity: f32,
        scale: f32
    ) -> f32 {
        let (noise, _, _) = NoiseBuilder::fbm_2d_offset(x, 1, z, 1)
            .with_seed(self.seed)
            .with_octaves(octaves)
            .with_gain(persistence)
            .with_lacunarity(lacunarity)
            .with_freq(scale)
            .generate();
        noise[0]
    }
    
    /// Ridge Noise para montanhas
    pub fn ridge_2d(
        &self,
        x: f32,
        z: f32,
        octaves: u8,
        scale: f32
    ) -> f32 {
        let (noise, _, _) = NoiseBuilder::ridge_2d_offset(x, 1, z, 1)
            .with_seed(self.seed)
            .with_octaves(octaves)
            .with_freq(scale)
            .generate();
        noise[0]
    }
    
    /// Batch generate para chunk completo (muito mais eficiente!)
    pub fn generate_chunk_heightmap(&self, chunk_x: i32, chunk_z: i32) -> Vec<f32> {
        let offset_x = (chunk_x * 16) as f32;
        let offset_z = (chunk_z * 16) as f32;
        
        let (heights, _, _) = NoiseBuilder::fbm_2d_offset(offset_x, 16, offset_z, 16)
            .with_seed(self.seed)
            .with_octaves(6)
            .with_gain(0.5)
            .with_lacunarity(2.0)
            .with_freq(0.01)
            .generate();
        
        heights
    }
}
```

### wasm/src/terrain/generator.rs

```rust
use wasm_bindgen::prelude::*;
use super::noise::NoiseEngine;
use super::biomes::Biome;

const CHUNK_SIZE: usize = 16;
const CHUNK_HEIGHT: usize = 256;
const WATER_LEVEL: i32 = 64;
const BASE_HEIGHT: i32 = 70;

#[wasm_bindgen]
pub struct TerrainGenerator {
    noise: NoiseEngine,
    cave_noise: NoiseEngine,
    biome_noise: NoiseEngine,
}

#[wasm_bindgen]
impl TerrainGenerator {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: i32) -> TerrainGenerator {
        TerrainGenerator {
            noise: NoiseEngine::new(seed),
            cave_noise: NoiseEngine::new(seed + 1000),
            biome_noise: NoiseEngine::new(seed + 2000),
        }
    }
    
    /// Gera dados de chunk como Uint8Array
    /// Retorna buffer de 16*256*16 bytes
    #[wasm_bindgen]
    pub fn generate_chunk(&self, chunk_x: i32, chunk_z: i32) -> Vec<u8> {
        let mut data = vec![0u8; CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE];
        
        // Gerar heightmap do chunk inteiro de uma vez (SIMD batch)
        let heightmap = self.noise.generate_chunk_heightmap(chunk_x, chunk_z);
        
        for local_x in 0..CHUNK_SIZE {
            for local_z in 0..CHUNK_SIZE {
                let world_x = chunk_x * 16 + local_x as i32;
                let world_z = chunk_z * 16 + local_z as i32;
                
                // Altura do terreno
                let height_idx = local_z * CHUNK_SIZE + local_x;
                let terrain_height = self.calculate_height(world_x, world_z, heightmap[height_idx]);
                
                // Bioma
                let biome = self.get_biome(world_x, world_z, terrain_height);
                
                // Preencher coluna
                for y in 0..CHUNK_HEIGHT {
                    let block = self.determine_block(
                        world_x, y as i32, world_z,
                        terrain_height, &biome
                    );
                    
                    let idx = y * CHUNK_SIZE * CHUNK_SIZE + local_z * CHUNK_SIZE + local_x;
                    data[idx] = block;
                }
            }
        }
        
        data
    }
    
    /// Calcula altura final do terreno
    fn calculate_height(&self, x: i32, z: i32, base_noise: f32) -> i32 {
        let continentalness = self.noise.fbm_2d(x as f32, z as f32, 2, 0.5, 2.0, 0.001);
        let erosion = self.noise.fbm_2d((x + 10000) as f32, (z + 10000) as f32, 3, 0.5, 2.0, 0.00167);
        
        let height_multiplier = if continentalness < -0.4 {
            8.0  // Deep ocean
        } else if continentalness < 0.0 {
            15.0  // Coast
        } else if continentalness < 0.6 {
            25.0 + (1.0 - erosion) * 20.0  // Midlands
        } else {
            60.0 + (1.0 - erosion) * 40.0  // Mountains
        };
        
        let base = if continentalness < -0.4 { 25 } else { BASE_HEIGHT };
        
        (base as f32 + base_noise * height_multiplier) as i32
    }
    
    /// Determina bioma baseado em temperatura e umidade
    fn get_biome(&self, x: i32, z: i32, height: i32) -> Biome {
        let temp = self.biome_noise.fbm_2d(x as f32, z as f32, 2, 0.5, 2.0, 0.001);
        let humidity = self.biome_noise.fbm_2d((x + 500) as f32, (z + 500) as f32, 2, 0.5, 2.0, 0.001);
        
        Biome::from_climate(temp, humidity, height)
    }
    
    /// Determina tipo de bloco para posição
    fn determine_block(&self, x: i32, y: i32, z: i32, terrain_height: i32, biome: &Biome) -> u8 {
        // Bedrock
        if y <= 0 { return 9; }  // BEDROCK
        if y <= 3 {
            let noise = self.noise.simplex_3d(x as f32, y as f32, z as f32, 0.2).abs();
            if noise < 0.3 + y as f32 * 0.1 { return 9; }
        }
        
        // Cave check
        if y > 5 && y <= terrain_height {
            if self.is_cave(x, y, z, terrain_height) {
                if y <= WATER_LEVEL - 10 && y < 20 {
                    return 26;  // LAVA
                }
                return 0;  // AIR
            }
        }
        
        // Above terrain
        if y > terrain_height {
            if y <= WATER_LEVEL {
                return 5;  // WATER
            }
            return 0;  // AIR
        }
        
        // Surface layer
        if y >= terrain_height - 4 {
            return self.get_surface_block(y, terrain_height, biome);
        }
        
        // Deep underground
        if y < 10 {
            return 14;  // DEEPSLATE
        }
        
        // Stone with ore
        self.get_underground_block(x, y, z)
    }
    
    fn is_cave(&self, x: i32, y: i32, z: i32, surface_height: i32) -> bool {
        if surface_height - y < 5 { return false; }
        
        let cave1 = self.cave_noise.simplex_3d(x as f32, y as f32, z as f32, 0.025);
        let cave2 = self.cave_noise.simplex_3d(x as f32, (y * 2) as f32, z as f32, 0.05);
        
        let combined = (cave1 + cave2 * 0.5) / 1.5;
        let depth_factor = 1.0 - (y as f32 / surface_height as f32);
        let threshold = -0.4 - depth_factor * 0.1;
        
        combined < threshold
    }
    
    fn get_surface_block(&self, y: i32, terrain_height: i32, biome: &Biome) -> u8 {
        let is_top = y == terrain_height;
        let depth = terrain_height - y;
        
        match biome {
            Biome::Desert | Biome::Badlands => 4,  // SAND
            Biome::Beach => 4,  // SAND
            Biome::SnowyPlains | Biome::SnowyTaiga => {
                if is_top { 8 }  // SNOW
                else if depth <= 3 { 2 }  // DIRT
                else { 3 }  // STONE
            }
            Biome::Forest | Biome::Plains | Biome::Jungle => {
                if is_top { 1 }  // GRASS
                else if depth <= 3 { 2 }  // DIRT
                else { 3 }  // STONE
            }
            Biome::Ocean => {
                if depth <= 2 { 4 }  // SAND
                else { 3 }  // STONE
            }
            _ => {
                if is_top { 1 } else if depth <= 3 { 2 } else { 3 }
            }
        }
    }
    
    fn get_underground_block(&self, x: i32, y: i32, z: i32) -> u8 {
        // Check for ores
        let ore_noise = self.noise.simplex_3d(x as f32, y as f32, z as f32, 0.125);
        
        // Coal (common, all heights)
        if ore_noise > 0.72 && y > 5 && y < 128 {
            return 22;  // COAL_ORE
        }
        
        // Iron (less common, lower)
        let iron_noise = self.noise.simplex_3d((x + 1000) as f32, y as f32, z as f32, 0.143);
        if iron_noise > 0.75 && y > 5 && y < 64 {
            return 23;  // IRON_ORE
        }
        
        // Gold (rare, deep)
        let gold_noise = self.noise.simplex_3d((x + 2000) as f32, y as f32, z as f32, 0.167);
        if gold_noise > 0.82 && y > 5 && y < 32 {
            return 24;  // GOLD_ORE
        }
        
        // Diamond (very rare, very deep)
        let diamond_noise = self.noise.simplex_3d((x + 3000) as f32, y as f32, z as f32, 0.2);
        if diamond_noise > 0.88 && y > 2 && y < 16 {
            return 25;  // DIAMOND_ORE
        }
        
        3  // STONE
    }
    
    /// API pública: altura em posição específica
    #[wasm_bindgen]
    pub fn get_height(&self, x: i32, z: i32) -> i32 {
        let base_noise = self.noise.fbm_2d(x as f32, z as f32, 6, 0.5, 2.0, 0.01);
        self.calculate_height(x, z, base_noise)
    }
}
```

### wasm/src/terrain/biomes.rs

```rust
#[derive(Debug, Clone, Copy)]
pub enum Biome {
    Ocean,
    Beach,
    Desert,
    Badlands,
    Plains,
    Forest,
    Jungle,
    Taiga,
    SnowyPlains,
    SnowyTaiga,
    Mountains,
    Savanna,
}

impl Biome {
    pub fn from_climate(temp: f32, humidity: f32, height: i32) -> Self {
        // High altitude = mountains
        if height > 120 {
            return Biome::Mountains;
        }
        
        // Temperature-based selection
        if temp < -0.5 {
            if humidity > 0.2 { Biome::SnowyTaiga } else { Biome::SnowyPlains }
        } else if temp < -0.2 {
            if humidity > 0.3 { Biome::Taiga } else { Biome::Plains }
        } else if temp < 0.3 {
            if humidity > 0.5 { Biome::Jungle }
            else if humidity > 0.2 { Biome::Forest }
            else { Biome::Plains }
        } else if temp < 0.6 {
            if humidity > 0.3 { Biome::Jungle }
            else if humidity > 0.0 { Biome::Savanna }
            else { Biome::Desert }
        } else {
            if humidity > -0.3 { Biome::Badlands } else { Biome::Desert }
        }
    }
}
```

---

## Integração com TypeScript

### src/engine/WasmBridge.ts

```typescript
import init, { TerrainGenerator, GreedyMesher, PhysicsEngine } from '../../wasm/pkg/hytale_wasm';

interface WasmModule {
    ready: boolean;
    terrain: TerrainGenerator | null;
    mesher: GreedyMesher | null;
    physics: PhysicsEngine | null;
}

const wasmModule: WasmModule = {
    ready: false,
    terrain: null,
    mesher: null,
    physics: null
};

/**
 * Inicializa módulo WASM
 */
export async function initWasm(seed: number): Promise<void> {
    if (wasmModule.ready) return;
    
    await init();
    
    wasmModule.terrain = new TerrainGenerator(seed);
    wasmModule.mesher = new GreedyMesher();
    wasmModule.physics = new PhysicsEngine();
    wasmModule.ready = true;
    
    console.log('🔷 WASM module initialized');
}

/**
 * Verifica se WASM está pronto
 */
export function isWasmReady(): boolean {
    return wasmModule.ready;
}

/**
 * Gera dados de chunk via WASM
 */
export function generateChunkWasm(chunkX: number, chunkZ: number): Uint8Array {
    if (!wasmModule.ready || !wasmModule.terrain) {
        throw new Error('WASM not initialized');
    }
    return wasmModule.terrain.generate_chunk(chunkX, chunkZ);
}

/**
 * Obtém altura do terreno via WASM
 */
export function getTerrainHeightWasm(x: number, z: number): number {
    if (!wasmModule.ready || !wasmModule.terrain) {
        throw new Error('WASM not initialized');
    }
    return wasmModule.terrain.get_height(x, z);
}

/**
 * Fallback para quando WASM não está disponível
 */
export function isWasmSupported(): boolean {
    try {
        if (typeof WebAssembly !== 'object') return false;
        
        // Check for SIMD support (optional but recommended)
        if (typeof WebAssembly.validate === 'function') {
            // SIMD detection magic bytes
            const simdTest = new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]);
            return WebAssembly.validate(simdTest);
        }
        
        return true;
    } catch {
        return false;
    }
}
```

### Usando no Chunk.ts

```typescript
import { isWasmReady, generateChunkWasm } from '../engine/WasmBridge';

public generate(): void {
    if (this.isGenerated) return;
    
    if (isWasmReady()) {
        // WASM path (5-10x faster)
        const data = generateChunkWasm(this.x, this.z);
        this.blocks = data;
    } else {
        // Fallback to JS implementation
        this.generateJS();
    }
    
    this.isGenerated = true;
}

private generateJS(): void {
    // Implementação original em JavaScript
    const worldX = this.x * CHUNK_SIZE;
    const worldZ = this.z * CHUNK_SIZE;
    
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        // ... código original
    }
}
```

---

## Benchmark Esperado

| Operação | JavaScript | WASM | Speedup |
|----------|-----------|------|---------|
| Noise 2D (single) | 45μs | 8μs | 5.6x |
| Noise 2D (batch 256) | 11ms | 0.8ms | 13.75x |
| Chunk generation | 12ms | 1.5ms | 8x |
| FBM 6 octaves | 280μs | 48μs | 5.8x |

---

## Próximos Passos

1. **Setup inicial**: Cargo.toml + lib.rs básico
2. **TerrainGenerator**: Noise + geração de chunks
3. **Benchmark**: Comparar JS vs WASM
4. **GreedyMesher**: Implementar meshing otimizado
5. **PhysicsEngine**: Collision + raycasting
6. **Workers**: Integrar WASM com Web Workers

---

*Documento gerado em: 2026-01-21*

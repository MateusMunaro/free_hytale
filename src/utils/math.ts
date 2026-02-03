import * as THREE from 'three';

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

export function inverseLerp(a: number, b: number, value: number): number {
    return (value - a) / (b - a);
}

export function remap(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
    return lerp(outMin, outMax, inverseLerp(inMin, inMax, value));
}

export function mod(n: number, m: number): number {
    return ((n % m) + m) % m;
}

export function hash(x: number, y: number, z: number = 0): number {
    let h = x * 374761393 + y * 668265263 + z * 1274126177;
    h = (h ^ (h >> 13)) * 1274126177;
    return h ^ (h >> 16);
}

export function randomFromHash(hash: number): number {
    return (hash & 0x7fffffff) / 0x7fffffff;
}

export function distance2D(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

export function distance3D(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function worldToChunk(worldX: number, worldZ: number, chunkSize: number): { x: number; z: number } {
    return {
        x: Math.floor(worldX / chunkSize),
        z: Math.floor(worldZ / chunkSize)
    };
}

export function chunkToWorld(chunkX: number, chunkZ: number, chunkSize: number): { x: number; z: number } {
    return {
        x: chunkX * chunkSize,
        z: chunkZ * chunkSize
    };
}

export function frustumContainsPoint(frustum: THREE.Frustum, point: THREE.Vector3): boolean {
    return frustum.containsPoint(point);
}

export function createChunkKey(x: number, z: number): string {
    return `${x},${z}`;
}

export function parseChunkKey(key: string): { x: number; z: number } {
    const [x, z] = key.split(',').map(Number);
    return { x, z };
}

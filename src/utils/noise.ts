/**
 * Advanced Noise Generation System
 * Simplex Noise with FBM (Fractal Brownian Motion) and Ridge Noise
 * Designed for realistic, Hytale-style procedural terrain generation
 */

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const F3 = 1 / 3;
const G3 = 1 / 6;

const grad3 = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
];

/**
 * Simplex Noise Generator with seed-based initialization
 */
export class SimplexNoise {
    private perm: number[] = [];
    private permMod12: number[] = [];

    constructor(seed: number = Math.random() * 10000) {
        const p: number[] = [];
        for (let i = 0; i < 256; i++) {
            p[i] = i;
        }

        // Shuffle using seed
        let s = seed;
        for (let i = 255; i > 0; i--) {
            s = (s * 16807) % 2147483647;
            const j = s % (i + 1);
            [p[i], p[j]] = [p[j], p[i]];
        }

        for (let i = 0; i < 512; i++) {
            this.perm[i] = p[i & 255];
            this.permMod12[i] = this.perm[i] % 12;
        }
    }

    private dot2(g: number[], x: number, y: number): number {
        return g[0] * x + g[1] * y;
    }

    private dot3(g: number[], x: number, y: number, z: number): number {
        return g[0] * x + g[1] * y + g[2] * z;
    }

    noise2D(x: number, y: number): number {
        const s = (x + y) * F2;
        const i = Math.floor(x + s);
        const j = Math.floor(y + s);
        const t = (i + j) * G2;
        const X0 = i - t;
        const Y0 = j - t;
        const x0 = x - X0;
        const y0 = y - Y0;

        let i1: number, j1: number;
        if (x0 > y0) {
            i1 = 1;
            j1 = 0;
        } else {
            i1 = 0;
            j1 = 1;
        }

        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1 + 2 * G2;
        const y2 = y0 - 1 + 2 * G2;

        const ii = i & 255;
        const jj = j & 255;
        const gi0 = this.permMod12[ii + this.perm[jj]];
        const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
        const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];

        let n0: number, n1: number, n2: number;

        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 < 0) {
            n0 = 0;
        } else {
            t0 *= t0;
            n0 = t0 * t0 * this.dot2(grad3[gi0], x0, y0);
        }

        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 < 0) {
            n1 = 0;
        } else {
            t1 *= t1;
            n1 = t1 * t1 * this.dot2(grad3[gi1], x1, y1);
        }

        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 < 0) {
            n2 = 0;
        } else {
            t2 *= t2;
            n2 = t2 * t2 * this.dot2(grad3[gi2], x2, y2);
        }

        return 70 * (n0 + n1 + n2);
    }

    noise3D(x: number, y: number, z: number): number {
        const s = (x + y + z) * F3;
        const i = Math.floor(x + s);
        const j = Math.floor(y + s);
        const k = Math.floor(z + s);
        const t = (i + j + k) * G3;
        const X0 = i - t;
        const Y0 = j - t;
        const Z0 = k - t;
        const x0 = x - X0;
        const y0 = y - Y0;
        const z0 = z - Z0;

        let i1: number, j1: number, k1: number;
        let i2: number, j2: number, k2: number;

        if (x0 >= y0) {
            if (y0 >= z0) {
                i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
            } else if (x0 >= z0) {
                i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1;
            } else {
                i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1;
            }
        } else {
            if (y0 < z0) {
                i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1;
            } else if (x0 < z0) {
                i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1;
            } else {
                i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
            }
        }

        const x1 = x0 - i1 + G3;
        const y1 = y0 - j1 + G3;
        const z1 = z0 - k1 + G3;
        const x2 = x0 - i2 + 2 * G3;
        const y2 = y0 - j2 + 2 * G3;
        const z2 = z0 - k2 + 2 * G3;
        const x3 = x0 - 1 + 3 * G3;
        const y3 = y0 - 1 + 3 * G3;
        const z3 = z0 - 1 + 3 * G3;

        const ii = i & 255;
        const jj = j & 255;
        const kk = k & 255;
        const gi0 = this.permMod12[ii + this.perm[jj + this.perm[kk]]];
        const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]]];
        const gi2 = this.permMod12[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2]]];
        const gi3 = this.permMod12[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]];

        let n0: number, n1: number, n2: number, n3: number;

        let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
        if (t0 < 0) {
            n0 = 0;
        } else {
            t0 *= t0;
            n0 = t0 * t0 * this.dot3(grad3[gi0], x0, y0, z0);
        }

        let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
        if (t1 < 0) {
            n1 = 0;
        } else {
            t1 *= t1;
            n1 = t1 * t1 * this.dot3(grad3[gi1], x1, y1, z1);
        }

        let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
        if (t2 < 0) {
            n2 = 0;
        } else {
            t2 *= t2;
            n2 = t2 * t2 * this.dot3(grad3[gi2], x2, y2, z2);
        }

        let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
        if (t3 < 0) {
            n3 = 0;
        } else {
            t3 *= t3;
            n3 = t3 * t3 * this.dot3(grad3[gi3], x3, y3, z3);
        }

        return 32 * (n0 + n1 + n2 + n3);
    }

    /**
     * Fractal Brownian Motion 2D - Accumulates multiple octaves for detailed terrain
     * @param x X coordinate
     * @param y Y coordinate (corresponds to Z in world space)
     * @param octaves Number of noise layers (more = more detail)
     * @param lacunarity Frequency multiplier per octave (typically 2)
     * @param persistence Amplitude multiplier per octave (typically 0.5)
     * @returns Normalized value in range [-1, 1]
     */
    fbm(x: number, y: number, octaves: number = 6, lacunarity: number = 2, persistence: number = 0.5): number {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            value += this.noise2D(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return value / maxValue;
    }

    /**
     * Fractal Brownian Motion 3D - For 3D features like caves
     * @param x X coordinate
     * @param y Y coordinate
     * @param z Z coordinate
     * @param octaves Number of noise layers
     * @param lacunarity Frequency multiplier per octave
     * @param persistence Amplitude multiplier per octave
     * @returns Normalized value in range [-1, 1]
     */
    fbm3D(x: number, y: number, z: number, octaves: number = 4, lacunarity: number = 2, persistence: number = 0.5): number {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            value += this.noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return value / maxValue;
    }
}

/**
 * Advanced Noise Generator with seed-based variants
 * Provides specialized functions for terrain generation
 */
export class NoiseGenerator {
    private noise2D: SimplexNoise;
    private noise3D: SimplexNoise;
    private caveNoise: SimplexNoise;
    private biomeNoise: SimplexNoise;
    private erosionNoise: SimplexNoise;
    private seed: number;

    constructor(seed: number | string) {
        // Convert string seed to number
        this.seed = typeof seed === 'string' ? this.hashString(seed) : seed;

        // Create multiple noise generators with offset seeds for variety
        this.noise2D = new SimplexNoise(this.seed);
        this.noise3D = new SimplexNoise(this.seed + 1000);
        this.caveNoise = new SimplexNoise(this.seed + 2000);
        this.biomeNoise = new SimplexNoise(this.seed + 3000);
        this.erosionNoise = new SimplexNoise(this.seed + 4000);
    }

    /**
     * Hash a string to a numeric seed
     */
    private hashString(str: string): number {
        let h = 0xdeadbeef;
        for (let i = 0; i < str.length; i++) {
            h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
        }
        return ((h ^ h >>> 16) >>> 0);
    }

    /**
     * 2D FBM with scale parameter
     * Returns normalized value in range [-1, 1]
     */
    getFBM2D(x: number, z: number, octaves: number, persistence: number, lacunarity: number, scale: number): number {
        const frequency = 1 / scale;
        return this.noise2D.fbm(x * frequency, z * frequency, octaves, lacunarity, persistence);
    }

    /**
     * 3D noise at specified scale
     * Returns value in range [-1, 1]
     */
    getNoise3D(x: number, y: number, z: number, scale: number): number {
        return this.noise3D.noise3D(x / scale, y / scale, z / scale);
    }

    /**
     * 3D FBM with scale parameter for detailed 3D features
     */
    getFBM3D(x: number, y: number, z: number, octaves: number, persistence: number, lacunarity: number, scale: number): number {
        return this.noise3D.fbm3D(x / scale, y / scale, z / scale, octaves, lacunarity, persistence);
    }

    /**
     * Ridge Noise - Creates sharp peaks (mountains) by taking abs of noise
     * Returns value in range [0, 1] where higher = ridge peak
     */
    getRidgeNoise2D(x: number, z: number, octaves: number, persistence: number, lacunarity: number, scale: number): number {
        let value = 0;
        let amplitude = 1;
        let frequency = 1 / scale;
        let maxValue = 0;
        let weight = 1;

        for (let i = 0; i < octaves; i++) {
            // Ridge noise: |noise| creates sharp ridges
            let n = Math.abs(this.erosionNoise.noise2D(x * frequency, z * frequency));
            // Invert so ridges are high
            n = 1.0 - n;
            // Sharpen the ridges
            n = n * n;
            // Apply weight (previous amplitude affects current)
            n *= weight;
            weight = Math.min(1.0, n * 2);

            value += n * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return value / maxValue;
    }

    /**
     * Cave noise using 3D Swiss Cheese algorithm
     * Returns true if position should be hollow (cave)
     */
    getCaveNoise(x: number, y: number, z: number, scale: number): number {
        return this.caveNoise.noise3D(x / scale, y / scale, z / scale);
    }

    /**
     * Biome temperature noise
     */
    getTemperature(x: number, z: number): number {
        return this.biomeNoise.fbm(x * 0.001, z * 0.001, 2, 2, 0.5);
    }

    /**
     * Biome humidity noise (offset to decorrelate from temperature)
     */
    getHumidity(x: number, z: number): number {
        return this.biomeNoise.fbm((x + 500) * 0.001, (z + 500) * 0.001, 2, 2, 0.5);
    }

    /**
     * Continentalness: Determines ocean vs land at macro scale
     * Returns value in range [-1, 1] where negative = ocean, positive = land
     */
    getContinentalness(x: number, z: number): number {
        return this.getFBM2D(x, z, 2, 0.5, 2, 1000);
    }

    /**
     * Erosion: Determines terrain roughness/smoothness
     * High erosion = flat, low erosion = mountainous
     */
    getErosion(x: number, z: number): number {
        return this.getFBM2D(x + 10000, z + 10000, 3, 0.5, 2, 600);
    }

    /**
     * Peaks and Valleys: Local terrain variation
     */
    getPeaksAndValleys(x: number, z: number): number {
        return this.getRidgeNoise2D(x, z, 4, 0.5, 2, 300);
    }

    /**
     * Weirdness: Controls unusual terrain features
     */
    getWeirdness(x: number, z: number): number {
        return this.getFBM2D(x + 20000, z + 20000, 3, 0.5, 2, 400);
    }
}

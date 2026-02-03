import * as THREE from 'three';

/**
 * Pool de Vector3 para operações temporárias
 * Evita alocação constante de vetores durante raycasting e física
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
     * Cria vetor temporário inicializado
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

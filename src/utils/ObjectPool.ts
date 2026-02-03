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

    public size(): number {
        return this.pool.length;
    }
}

// Helper
export function getGeometryDataPool(): GeometryDataPool {
    return GeometryDataPool.getInstance();
}

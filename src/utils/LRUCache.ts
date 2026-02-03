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

    /**
     * Reset statistics
     */
    public resetStats(): void {
        this.hits = 0;
        this.misses = 0;
    }
}

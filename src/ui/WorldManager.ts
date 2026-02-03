export interface WorldData {
    id: string;
    name: string;
    seed: number;
    createdAt: number;
    lastPlayed: number;
    biome?: string;
    playerPosition?: { x: number; y: number; z: number };
    modifiedBlocks?: Record<string, number>; // For storing block changes
}

const STORAGE_KEY = 'hytalefree_worlds';

export class WorldManager {
    private worlds: Map<string, WorldData> = new Map();

    constructor() {
        this.loadFromStorage();
    }

    private loadFromStorage(): void {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                const worldsArray: WorldData[] = JSON.parse(data);
                worldsArray.forEach(world => {
                    this.worlds.set(world.id, world);
                });
            }
        } catch (error) {
            console.warn('Failed to load worlds from storage:', error);
        }
    }

    private saveToStorage(): void {
        try {
            const worldsArray = Array.from(this.worlds.values());
            localStorage.setItem(STORAGE_KEY, JSON.stringify(worldsArray));
        } catch (error) {
            console.warn('Failed to save worlds to storage:', error);
        }
    }

    public createWorld(name: string, seed?: number): WorldData {
        const id = this.generateId();
        const now = Date.now();

        const world: WorldData = {
            id,
            name,
            seed: seed ?? Math.floor(Math.random() * 1000000),
            createdAt: now,
            lastPlayed: now,
            biome: 'plains',
            modifiedBlocks: {}
        };

        this.worlds.set(id, world);
        this.saveToStorage();

        return world;
    }

    public getWorld(id: string): WorldData | undefined {
        return this.worlds.get(id);
    }

    public getAllWorlds(): WorldData[] {
        return Array.from(this.worlds.values())
            .sort((a, b) => b.lastPlayed - a.lastPlayed);
    }

    public updateWorld(id: string, updates: Partial<WorldData>): void {
        const world = this.worlds.get(id);
        if (world) {
            Object.assign(world, updates);
            this.saveToStorage();
        }
    }

    public updateLastPlayed(id: string): void {
        this.updateWorld(id, { lastPlayed: Date.now() });
    }

    public savePlayerPosition(id: string, position: { x: number; y: number; z: number }): void {
        this.updateWorld(id, { playerPosition: position });
    }

    public saveModifiedBlock(id: string, blockKey: string, blockType: number): void {
        const world = this.worlds.get(id);
        if (world) {
            if (!world.modifiedBlocks) {
                world.modifiedBlocks = {};
            }
            world.modifiedBlocks[blockKey] = blockType;
            this.saveToStorage();
        }
    }

    public deleteWorld(id: string): boolean {
        const deleted = this.worlds.delete(id);
        if (deleted) {
            this.saveToStorage();
        }
        return deleted;
    }

    private generateId(): string {
        return `world_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

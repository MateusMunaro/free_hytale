/**
 * Sistema de métricas de performance
 * Permite medir o impacto das otimizações
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

    private constructor() { }

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

    public getMinFrameTime(): number {
        if (this.frameTimes.length === 0) return 0;
        return Math.min(...this.frameTimes);
    }

    public getMaxFrameTime(): number {
        if (this.frameTimes.length === 0) return 0;
        return Math.max(...this.frameTimes);
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

    public getTimerTotal(name: string): number {
        const timer = this.timers.get(name);
        if (!timer) return 0;
        return timer.total;
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

    public resetTimers(): void {
        this.timers.clear();
    }

    // === Report ===

    public getReport(): object {
        const timerReport: Record<string, { avg: string; count: number }> = {};
        this.timers.forEach((timer, name) => {
            timerReport[name] = {
                avg: (timer.count > 0 ? timer.total / timer.count : 0).toFixed(2) + 'ms',
                count: timer.count
            };
        });

        return {
            fps: this.getFPS().toFixed(1),
            avgFrameTime: this.getAverageFrameTime().toFixed(2) + 'ms',
            minFrameTime: this.getMinFrameTime().toFixed(2) + 'ms',
            maxFrameTime: this.getMaxFrameTime().toFixed(2) + 'ms',
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
        console.log('=== Performance Report ===');
        console.table(this.getReport());
    }

    /**
     * Reset all metrics
     */
    public reset(): void {
        this.frameTimes = [];
        this.timers.clear();
        this.counters.clear();
    }
}

// Helper
export function getMetrics(): PerformanceMetrics {
    return PerformanceMetrics.getInstance();
}

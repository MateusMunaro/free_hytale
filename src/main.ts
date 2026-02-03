import { Engine } from './engine/Engine';

// Entry point
async function main() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

    if (!canvas) {
        console.error('Canvas not found!');
        return;
    }

    // Create and initialize engine
    const engine = new Engine(canvas);

    try {
        await engine.initialize();
        engine.start();

        console.log('🎮 HytaleFree started successfully!');
    } catch (error) {
        console.error('Failed to start game:', error);
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        engine.dispose();
    });
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}

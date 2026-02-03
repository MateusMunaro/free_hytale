import { Renderer } from './Renderer';
import { World } from '../world/World';
import { Player } from '../player/Player';
import { InputManager } from '../player/InputManager';
import { MiningSystem } from '../player/MiningSystem';
import { HUD } from '../ui/HUD';
import { HandDisplay } from '../ui/HandDisplay';
import { BreakIndicator } from '../ui/BreakIndicator';
import { Inventory, InventoryUI } from '../inventory';
import { MainMenu } from '../ui/MainMenu';
import { WorldData, WorldManager } from '../ui/WorldManager';

export class Engine {
    private canvas: HTMLCanvasElement;
    private renderer!: Renderer;
    private world!: World;
    private player!: Player;
    private inputManager!: InputManager;
    private miningSystem!: MiningSystem;
    private hud!: HUD;
    private handDisplay!: HandDisplay;
    private breakIndicator!: BreakIndicator;
    private inventory!: Inventory;
    private inventoryUI!: InventoryUI;
    private mainMenu: MainMenu;
    private worldManager: WorldManager;

    private currentWorldData: WorldData | null = null;
    private isGameInitialized: boolean = false;

    private lastTime: number = 0;
    private deltaTime: number = 0;
    private fps: number = 0;
    private frameCount: number = 0;
    private fpsTime: number = 0;

    private isRunning: boolean = false;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.worldManager = new WorldManager();

        // Initialize main menu first
        this.mainMenu = new MainMenu({
            onPlayWorld: (worldData) => this.startGame(worldData)
        });
    }

    private async initializeGameSystems(worldData: WorldData): Promise<void> {
        // Initialize core systems
        this.renderer = new Renderer(this.canvas);
        this.inputManager = new InputManager(this.canvas);

        // Create world with the seed from worldData
        this.world = new World(this.renderer.scene, {
            renderDistance: 6,
            terrainConfig: { seed: worldData.seed }
        });

        this.player = new Player(
            this.inputManager,
            this.world,
            this.renderer.getAspect()
        );

        // Restore player position if available
        if (worldData.playerPosition) {
            this.player.setPosition(
                worldData.playerPosition.x,
                worldData.playerPosition.y,
                worldData.playerPosition.z
            );
        }

        this.hud = new HUD();

        // Initialize inventory system
        this.inventory = new Inventory();
        this.inventoryUI = new InventoryUI(this.inventory);

        // Initialize mining system
        this.miningSystem = new MiningSystem(
            this.world,
            this.inventory,
            this.player.camera.camera
        );

        // Initialize hand display and break indicator
        this.handDisplay = new HandDisplay(this.inventory);
        this.breakIndicator = new BreakIndicator();

        // Setup mining callbacks
        this.miningSystem.onBreakProgress((progress) => {
            this.breakIndicator.setProgress(progress);
            if (progress > 0) {
                this.handDisplay.startMining();
            } else {
                this.handDisplay.stopMining();
            }
        });

        this.miningSystem.onBlockBroken(() => {
            this.handDisplay.swing();
        });

        // Setup pointer lock callback
        this.inputManager.setPointerLockCallback(() => {
            if (this.inputManager.isLocked()) {
                this.hud.showGame();
                // Close inventory when pointer lock is acquired
                if (this.inventoryUI.isOpen()) {
                    this.inventoryUI.closeInventory();
                }
            } else {
                // When pointer is unlocked, only show pause screen if inventory is NOT open
                if (!this.inventoryUI.isOpen()) {
                    this.hud.showStartScreen();
                }
            }
        });

        // Setup click to resume game
        this.setupStartListener();

        // Handle window resize
        window.addEventListener('resize', () => {
            this.player.resize(this.renderer.getAspect());
        });

        // Handle Escape key for returning to menu
        this.setupEscapeListener();

        this.isGameInitialized = true;
    }

    private setupStartListener(): void {
        const startScreen = document.getElementById('start-screen');
        if (startScreen) {
            startScreen.addEventListener('click', () => {
                this.inputManager.requestPointerLock();
            });
        }
    }

    private setupEscapeListener(): void {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isGameInitialized && !this.inputManager.isLocked()) {
                // Save progress and return to menu
                this.returnToMenu();
            }
        });
    }

    private async startGame(worldData: WorldData): Promise<void> {
        this.currentWorldData = worldData;
        this.mainMenu.hide();

        // Show loading screen
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
            const loadingText = loadingScreen.querySelector('p');
            if (loadingText) {
                loadingText.textContent = `Carregando "${worldData.name}"...`;
            }
        }

        // Initialize game systems if needed
        if (!this.isGameInitialized) {
            await this.initializeGameSystems(worldData);
        }

        // Generate world
        await new Promise(resolve => setTimeout(resolve, 100));

        const pos = this.player.getPosition();
        this.world.update(pos.x, pos.z);

        // Wait for some chunks to load
        let attempts = 0;
        while (this.world.chunksRendered < 4 && attempts < 50) {
            this.world.update(pos.x, pos.z);
            await new Promise(resolve => setTimeout(resolve, 50));
            attempts++;
        }

        // Hide loading and show start screen
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        this.hud.showStartScreen();

        // Start game loop if not running
        if (!this.isRunning) {
            this.start();
        }

        console.log(`🌍 World "${worldData.name}" loaded with seed: ${worldData.seed}`);
    }

    private returnToMenu(): void {
        // Save player position
        if (this.currentWorldData && this.player) {
            const pos = this.player.getPosition();
            this.worldManager.savePlayerPosition(this.currentWorldData.id, {
                x: pos.x,
                y: pos.y,
                z: pos.z
            });
        }

        // Cleanup current game state
        this.disposeGameSystems();

        // Show menu
        this.mainMenu.show();
    }

    private disposeGameSystems(): void {
        if (this.isGameInitialized) {
            this.isRunning = false;
            this.renderer?.dispose();
            this.world?.dispose();
            this.inputManager?.dispose();
            this.inventoryUI?.dispose();
            this.handDisplay?.dispose();
            this.breakIndicator?.dispose();
            this.isGameInitialized = false;
        }
    }

    public async initialize(): Promise<void> {
        // Just show the main menu - game systems are initialized when a world is selected
        console.log('🎮 HytaleFree initialized - Menu ready');
    }

    public start(): void {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.gameLoop();
    }

    private gameLoop = (): void => {
        if (!this.isRunning) return;

        requestAnimationFrame(this.gameLoop);

        const currentTime = performance.now();
        this.deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Cap delta time to prevent huge jumps
        this.deltaTime = Math.min(this.deltaTime, 0.1);

        // Update FPS counter
        this.frameCount++;
        this.fpsTime += this.deltaTime;
        if (this.fpsTime >= 1) {
            this.fps = this.frameCount / this.fpsTime;
            this.frameCount = 0;
            this.fpsTime = 0;
        }

        this.update();
        this.render();
    };

    private update(): void {
        if (!this.isGameInitialized) return;

        const input = this.inputManager.getState();

        // Handle inventory toggle (E key)
        if (input.toggleInventory) {
            this.inventoryUI.toggleInventory();
            // Exit pointer lock when inventory opens to show cursor
            if (this.inventoryUI.isOpen()) {
                this.inputManager.exitPointerLock();
            }
        }

        // Handle hotbar slot selection (number keys)
        if (input.hotbarSlot >= 0) {
            this.inventory.setSelectedSlot(input.hotbarSlot);
        }

        // Handle scroll wheel for hotbar navigation
        if (input.scrollDelta !== 0) {
            if (input.scrollDelta > 0) {
                this.inventory.nextSlot();
            } else {
                this.inventory.previousSlot();
            }
        }

        // Reset inventory inputs
        this.inputManager.resetInventoryInputs();

        // Only update game logic when pointer is locked and inventory is closed
        if (this.inputManager.isLocked() && !this.inventoryUI.isOpen()) {
            this.player.update(this.deltaTime);

            // Handle block breaking (left click)
            if (input.leftClick) {
                if (!this.miningSystem.isCurrentlyBreaking()) {
                    this.miningSystem.startBreaking();
                }
                this.miningSystem.updateBreaking(this.deltaTime);
            } else {
                this.miningSystem.stopBreaking();
            }

            // Handle block placing (right click) - only on click, not hold
            if (input.rightClick) {
                this.miningSystem.placeBlock();
            }
        } else {
            // Stop mining when inventory opens or pointer unlocks
            this.miningSystem.stopBreaking();
        }

        // Always update world (chunk loading)
        const pos = this.player.getPosition();
        this.world.update(pos.x, pos.z);

        // Update sky position
        this.renderer.sky.updateSunPosition(pos);

        // Update HUD
        this.hud.updateDebugInfo({
            fps: this.fps,
            x: pos.x,
            y: pos.y,
            z: pos.z,
            chunksLoaded: this.world.chunksLoaded,
            chunksRendered: this.world.chunksRendered
        });
    }

    private render(): void {
        if (!this.isGameInitialized) return;
        this.renderer.render(this.player.camera.camera);
    }

    public stop(): void {
        this.isRunning = false;
    }

    public dispose(): void {
        this.stop();
        this.disposeGameSystems();
        this.mainMenu.dispose();
    }
}

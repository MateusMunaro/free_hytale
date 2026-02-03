export interface InputState {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    jump: boolean;
    sprint: boolean;
    mouseX: number;
    mouseY: number;
    mouseDeltaX: number;
    mouseDeltaY: number;
    // Inventory controls
    toggleInventory: boolean;
    hotbarSlot: number; // -1 = no change, 0-8 = slot selected
    scrollDelta: number; // Scroll wheel delta for slot navigation
    // Mouse buttons for mining/placing
    leftClick: boolean;  // Break block
    rightClick: boolean; // Place block
}

export class InputManager {
    private state: InputState = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        mouseX: 0,
        mouseY: 0,
        mouseDeltaX: 0,
        mouseDeltaY: 0,
        toggleInventory: false,
        hotbarSlot: -1,
        scrollDelta: 0,
        leftClick: false,
        rightClick: false
    };

    private canvas: HTMLCanvasElement;
    private isPointerLocked: boolean = false;
    private onPointerLockChange: (() => void) | null = null;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.setupListeners();
    }

    private setupListeners(): void {
        // Keyboard events
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        window.addEventListener('keyup', this.handleKeyUp.bind(this));

        // Mouse movement
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));

        // Mouse wheel for hotbar navigation
        document.addEventListener('wheel', this.handleMouseWheel.bind(this));

        // Mouse buttons for breaking/placing
        document.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));

        // Pointer lock
        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement === this.canvas;
            if (this.onPointerLockChange) {
                this.onPointerLockChange();
            }
        });
    }

    private handleKeyDown(event: KeyboardEvent): void {
        this.updateKeyState(event.code, true);
    }

    private handleKeyUp(event: KeyboardEvent): void {
        this.updateKeyState(event.code, false);
    }

    private updateKeyState(code: string, pressed: boolean): void {
        switch (code) {
            case 'KeyW':
            case 'ArrowUp':
                this.state.forward = pressed;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.state.backward = pressed;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.state.left = pressed;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.state.right = pressed;
                break;
            case 'Space':
                this.state.jump = pressed;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.state.sprint = pressed;
                break;
            // Inventory toggle
            case 'KeyE':
                if (pressed) {
                    this.state.toggleInventory = true;
                }
                break;
            // Hotbar number keys (1-9)
            case 'Digit1':
                if (pressed) this.state.hotbarSlot = 0;
                break;
            case 'Digit2':
                if (pressed) this.state.hotbarSlot = 1;
                break;
            case 'Digit3':
                if (pressed) this.state.hotbarSlot = 2;
                break;
            case 'Digit4':
                if (pressed) this.state.hotbarSlot = 3;
                break;
            case 'Digit5':
                if (pressed) this.state.hotbarSlot = 4;
                break;
            case 'Digit6':
                if (pressed) this.state.hotbarSlot = 5;
                break;
            case 'Digit7':
                if (pressed) this.state.hotbarSlot = 6;
                break;
            case 'Digit8':
                if (pressed) this.state.hotbarSlot = 7;
                break;
            case 'Digit9':
                if (pressed) this.state.hotbarSlot = 8;
                break;
        }
    }

    private handleMouseMove(event: MouseEvent): void {
        if (!this.isPointerLocked) return;

        this.state.mouseDeltaX = event.movementX;
        this.state.mouseDeltaY = event.movementY;
        this.state.mouseX += event.movementX;
        this.state.mouseY += event.movementY;
    }

    private handleMouseWheel(event: WheelEvent): void {
        if (!this.isPointerLocked) return;
        this.state.scrollDelta = event.deltaY;
    }

    private handleMouseDown(event: MouseEvent): void {
        if (!this.isPointerLocked) return;

        if (event.button === 0) {
            this.state.leftClick = true;
        } else if (event.button === 2) {
            this.state.rightClick = true;
            event.preventDefault();
        }
    }

    private handleMouseUp(event: MouseEvent): void {
        if (event.button === 0) {
            this.state.leftClick = false;
        } else if (event.button === 2) {
            this.state.rightClick = false;
        }
    }

    public requestPointerLock(): void {
        this.canvas.requestPointerLock();
    }

    public exitPointerLock(): void {
        document.exitPointerLock();
    }

    public setPointerLockCallback(callback: () => void): void {
        this.onPointerLockChange = callback;
    }

    public getState(): InputState {
        return { ...this.state };
    }

    public isLocked(): boolean {
        return this.isPointerLocked;
    }

    public resetMouseDelta(): void {
        this.state.mouseDeltaX = 0;
        this.state.mouseDeltaY = 0;
    }

    public resetInventoryInputs(): void {
        this.state.toggleInventory = false;
        this.state.hotbarSlot = -1;
        this.state.scrollDelta = 0;
    }

    public dispose(): void {
        window.removeEventListener('keydown', this.handleKeyDown.bind(this));
        window.removeEventListener('keyup', this.handleKeyUp.bind(this));
        document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    }
}

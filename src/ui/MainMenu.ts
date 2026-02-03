import { WorldManager, WorldData } from './WorldManager';

export type MenuScreen = 'main' | 'worlds' | 'create-world' | 'settings';

export interface MenuCallbacks {
    onPlayWorld: (worldData: WorldData) => void;
}

export class MainMenu {
    private container: HTMLElement;
    private worldManager: WorldManager;
    private callbacks: MenuCallbacks;
    private _currentScreen: MenuScreen = 'main';

    constructor(callbacks: MenuCallbacks) {
        this.callbacks = callbacks;
        this.worldManager = new WorldManager();
        this.container = this.createContainer();
        document.body.appendChild(this.container);
        this.showMainMenu();
    }

    private createContainer(): HTMLElement {
        const container = document.createElement('div');
        container.id = 'main-menu-container';
        container.className = 'menu-container';
        return container;
    }

    public show(): void {
        this.container.style.display = 'flex';
        this.showMainMenu();
    }

    public hide(): void {
        this.container.style.display = 'none';
    }

    public isVisible(): boolean {
        return this.container.style.display !== 'none';
    }

    private clearContainer(): void {
        this.container.innerHTML = '';
    }

    // ==========================================
    // MAIN MENU SCREEN
    // ==========================================
    private showMainMenu(): void {
        this._currentScreen = 'main';
        this.clearContainer();

        const content = document.createElement('div');
        content.className = 'menu-content main-menu';

        // Logo and Title
        const header = document.createElement('div');
        header.className = 'menu-header';
        header.innerHTML = `
            <div class="logo-container">
                <div class="logo-icon">🎮</div>
                <h1 class="game-title">HytaleFree</h1>
                <p class="game-subtitle">Voxel Adventure</p>
            </div>
        `;

        // Menu Buttons
        const buttons = document.createElement('div');
        buttons.className = 'menu-buttons';

        // Play Button
        const playBtn = this.createMenuButton('Jogar', '🌍', 'primary', () => {
            this.showWorldsMenu();
        });

        // Settings Button (disabled for now)
        const settingsBtn = this.createMenuButton('Configurações', '⚙️', 'secondary', () => {
            this.showSettingsPlaceholder();
        });

        buttons.appendChild(playBtn);
        buttons.appendChild(settingsBtn);

        // Version Info
        const footer = document.createElement('div');
        footer.className = 'menu-footer';
        footer.innerHTML = `
            <span class="version">v0.1.0 Alpha</span>
            <span class="credits">Feito com ❤️ usando Three.js</span>
        `;

        content.appendChild(header);
        content.appendChild(buttons);
        content.appendChild(footer);
        this.container.appendChild(content);
    }

    // ==========================================
    // WORLDS MENU SCREEN
    // ==========================================
    private showWorldsMenu(): void {
        this._currentScreen = 'worlds';
        this.clearContainer();

        const content = document.createElement('div');
        content.className = 'menu-content worlds-menu';

        // Header with back button
        const header = document.createElement('div');
        header.className = 'menu-header-small';

        const backBtn = document.createElement('button');
        backBtn.className = 'back-button';
        backBtn.innerHTML = '← Voltar';
        backBtn.onclick = () => this.showMainMenu();

        const title = document.createElement('h2');
        title.className = 'menu-title';
        title.textContent = 'Selecionar Mundo';

        header.appendChild(backBtn);
        header.appendChild(title);

        // World List Container
        const worldListContainer = document.createElement('div');
        worldListContainer.className = 'world-list-container';

        // Create New World Card
        const createCard = document.createElement('div');
        createCard.className = 'world-card create-world-card';
        createCard.innerHTML = `
            <div class="world-card-icon create-icon">+</div>
            <div class="world-card-info">
                <h3>Criar Novo Mundo</h3>
                <p>Comece uma nova aventura</p>
            </div>
        `;
        createCard.onclick = () => this.showCreateWorldMenu();
        worldListContainer.appendChild(createCard);

        // Existing Worlds
        const worlds = this.worldManager.getAllWorlds();

        if (worlds.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-worlds-message';
            emptyMessage.innerHTML = `
                <div class="empty-icon">🌎</div>
                <p>Você ainda não tem mundos salvos</p>
                <p class="empty-hint">Crie seu primeiro mundo acima!</p>
            `;
            worldListContainer.appendChild(emptyMessage);
        } else {
            worlds.forEach((world: WorldData) => {
                const worldCard = this.createWorldCard(world);
                worldListContainer.appendChild(worldCard);
            });
        }

        content.appendChild(header);
        content.appendChild(worldListContainer);
        this.container.appendChild(content);
    }

    private createWorldCard(world: WorldData): HTMLElement {
        const card = document.createElement('div');
        card.className = 'world-card existing-world-card';

        const icon = document.createElement('div');
        icon.className = 'world-card-icon';
        icon.textContent = this.getBiomeIcon(world.biome || 'plains');

        const info = document.createElement('div');
        info.className = 'world-card-info';

        const nameRow = document.createElement('div');
        nameRow.className = 'world-name-row';

        const name = document.createElement('h3');
        name.textContent = world.name;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'world-delete-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Excluir mundo';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            this.confirmDeleteWorld(world);
        };

        nameRow.appendChild(name);
        nameRow.appendChild(deleteBtn);

        const details = document.createElement('div');
        details.className = 'world-details';

        const lastPlayed = new Date(world.lastPlayed);
        const formattedDate = lastPlayed.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        details.innerHTML = `
            <span class="world-seed">Seed: ${world.seed}</span>
            <span class="world-date">Jogado: ${formattedDate}</span>
        `;

        info.appendChild(nameRow);
        info.appendChild(details);

        card.appendChild(icon);
        card.appendChild(info);

        card.onclick = () => {
            this.worldManager.updateLastPlayed(world.id);
            this.callbacks.onPlayWorld(world);
        };

        return card;
    }

    private getBiomeIcon(biome: string): string {
        const icons: Record<string, string> = {
            'plains': '🌿',
            'forest': '🌲',
            'desert': '🏜️',
            'snow': '❄️',
            'mountains': '⛰️',
            'ocean': '🌊'
        };
        return icons[biome] || '🌍';
    }

    private confirmDeleteWorld(world: WorldData): void {
        const modal = document.createElement('div');
        modal.className = 'confirm-modal';
        modal.innerHTML = `
            <div class="confirm-modal-content">
                <h3>Excluir Mundo</h3>
                <p>Tem certeza que deseja excluir "${world.name}"?</p>
                <p class="warning">Esta ação não pode ser desfeita!</p>
                <div class="confirm-buttons">
                    <button class="cancel-btn">Cancelar</button>
                    <button class="delete-btn">Excluir</button>
                </div>
            </div>
        `;

        this.container.appendChild(modal);

        modal.querySelector('.cancel-btn')!.addEventListener('click', () => {
            modal.remove();
        });

        modal.querySelector('.delete-btn')!.addEventListener('click', () => {
            this.worldManager.deleteWorld(world.id);
            modal.remove();
            this.showWorldsMenu();
        });
    }

    // ==========================================
    // CREATE WORLD SCREEN
    // ==========================================
    private showCreateWorldMenu(): void {
        this._currentScreen = 'create-world';
        this.clearContainer();

        const content = document.createElement('div');
        content.className = 'menu-content create-world-menu';

        // Header
        const header = document.createElement('div');
        header.className = 'menu-header-small';

        const backBtn = document.createElement('button');
        backBtn.className = 'back-button';
        backBtn.innerHTML = '← Voltar';
        backBtn.onclick = () => this.showWorldsMenu();

        const title = document.createElement('h2');
        title.className = 'menu-title';
        title.textContent = 'Criar Novo Mundo';

        header.appendChild(backBtn);
        header.appendChild(title);

        // Form
        const form = document.createElement('div');
        form.className = 'create-world-form';

        // World Name Input
        const nameGroup = this.createInputGroup('Nome do Mundo', 'world-name', 'text', 'Meu Mundo Incrível');

        // Seed Input
        const seedGroup = this.createInputGroup('Seed (opcional)', 'world-seed', 'text', 'Deixe vazio para aleatório');

        // Create Button
        const createBtn = document.createElement('button');
        createBtn.className = 'menu-button primary create-world-btn';
        createBtn.innerHTML = `
            <span class="btn-icon">🚀</span>
            <span class="btn-text">Criar e Jogar</span>
        `;

        createBtn.onclick = () => {
            const nameInput = document.getElementById('world-name') as HTMLInputElement;
            const seedInput = document.getElementById('world-seed') as HTMLInputElement;

            const worldName = nameInput.value.trim() || `Mundo ${this.worldManager.getAllWorlds().length + 1}`;
            const seedValue = seedInput.value.trim();
            const seed = seedValue ? parseInt(seedValue) || this.hashString(seedValue) : Math.floor(Math.random() * 1000000);

            const newWorld = this.worldManager.createWorld(worldName, seed);
            this.callbacks.onPlayWorld(newWorld);
        };

        form.appendChild(nameGroup);
        form.appendChild(seedGroup);
        form.appendChild(createBtn);

        content.appendChild(header);
        content.appendChild(form);
        this.container.appendChild(content);

        // Focus name input
        setTimeout(() => {
            (document.getElementById('world-name') as HTMLInputElement)?.focus();
        }, 100);
    }

    private createInputGroup(label: string, id: string, type: string, placeholder: string): HTMLElement {
        const group = document.createElement('div');
        group.className = 'input-group';

        const labelEl = document.createElement('label');
        labelEl.htmlFor = id;
        labelEl.textContent = label;

        const input = document.createElement('input');
        input.type = type;
        input.id = id;
        input.placeholder = placeholder;
        input.className = 'menu-input';

        group.appendChild(labelEl);
        group.appendChild(input);

        return group;
    }

    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    // ==========================================
    // SETTINGS PLACEHOLDER
    // ==========================================
    private showSettingsPlaceholder(): void {
        this._currentScreen = 'settings';
        this.clearContainer();

        const content = document.createElement('div');
        content.className = 'menu-content settings-menu';

        // Header
        const header = document.createElement('div');
        header.className = 'menu-header-small';

        const backBtn = document.createElement('button');
        backBtn.className = 'back-button';
        backBtn.innerHTML = '← Voltar';
        backBtn.onclick = () => this.showMainMenu();

        const title = document.createElement('h2');
        title.className = 'menu-title';
        title.textContent = 'Configurações';

        header.appendChild(backBtn);
        header.appendChild(title);

        // Placeholder content
        const placeholder = document.createElement('div');
        placeholder.className = 'settings-placeholder';
        placeholder.innerHTML = `
            <div class="coming-soon-icon">🔧</div>
            <h3>Em Breve!</h3>
            <p>As configurações estarão disponíveis em uma próxima atualização.</p>
            <ul class="planned-features">
                <li>🎮 Controles personalizáveis</li>
                <li>🔊 Configurações de áudio</li>
                <li>📺 Opções gráficas</li>
                <li>🌍 Distância de renderização</li>
            </ul>
        `;

        content.appendChild(header);
        content.appendChild(placeholder);
        this.container.appendChild(content);
    }

    // ==========================================
    // HELPER METHODS
    // ==========================================
    private createMenuButton(text: string, icon: string, variant: 'primary' | 'secondary', onClick: () => void): HTMLElement {
        const button = document.createElement('button');
        button.className = `menu-button ${variant}`;
        button.innerHTML = `
            <span class="btn-icon">${icon}</span>
            <span class="btn-text">${text}</span>
        `;
        button.onclick = onClick;
        return button;
    }

    public dispose(): void {
        this.container.remove();
    }
}

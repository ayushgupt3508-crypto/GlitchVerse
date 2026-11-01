
import Phaser from 'phaser';
import { GAME_FONTS } from '../config';
import { AudioManager } from '../systems/AudioManager';

export class LevelSelectScene extends Phaser.Scene {
    private isLeaving = false;
    private backgroundGlitch!: Phaser.GameObjects.Graphics;
    private panels: Phaser.GameObjects.Container[] = [];

    constructor() {
        super('LevelSelectScene');
    }

    create(): void {
        this.isLeaving = false;
        this.panels = [];

        const width = this.scale.width;
        const height = this.scale.height;

        this.cameras.main.setBackgroundColor('#050914');
        this.cameras.main.fadeIn(400);

        // Background grid
        const grid = this.add.graphics().setDepth(-10);
        grid.lineStyle(1, 0x183047, 0.32);

        for (let x = 0; x < width; x += 24) {
            grid.lineBetween(x, 0, x, height);
        }

        for (let y = 0; y < height; y += 24) {
            grid.lineBetween(0, y, width, y);
        }

        // Background glow accents
        const glow = this.add.graphics().setDepth(-9);
        glow.fillStyle(0x00f0ff, 0.035);
        glow.fillCircle(90, 160, 130);
        glow.fillStyle(0x39ff14, 0.025);
        glow.fillCircle(550, 230, 150);

        // Floating particles
        for (let i = 0; i < 35; i++) {
            const particle = this.add.circle(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(0, height),
                Phaser.Math.Between(1, 2),
                0x00f0ff,
                Phaser.Math.FloatBetween(0.15, 0.5)
            ).setDepth(-5);

            this.tweens.add({
                targets: particle,
                y: particle.y - Phaser.Math.Between(15, 45),
                alpha: 0.05,
                duration: Phaser.Math.Between(1800, 3500),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.inOut',
                delay: Phaser.Math.Between(0, 2000)
            });
        }

        // Header
        this.add.text(width / 2, 20, 'CHRONO-EXPEDITION', {
            fontFamily: GAME_FONTS.heading,
            fontSize: '21px',
            fontStyle: 'bold',
            color: '#00f0ff',
            stroke: '#00121c',
            strokeThickness: 4
        }).setOrigin(0.5);

        this.add.text(width / 2, 42,
            '// SELECT YOUR DESTINATION //', {
            fontFamily: GAME_FONTS.mono,
            fontSize: '9px',
            color: '#70e000',
            letterSpacing: 2
        }).setOrigin(0.5);

        // Header divider
        const divider = this.add.graphics();
        divider.lineStyle(1, 0x00f0ff, 0.35);
        divider.lineBetween(45, 55, width - 45, 55);

        // Panel data
        const panels = [
            {
                number: '00',
                title: 'PROLOGUE',
                subtitle: 'THE BEGINNING',
                description: 'Discover the origin of the simulation.',
                icon: '◆',
                color: 0x00f0ff,
                destination: 'StoryScene'
            },
            {
                number: '01',
                title: 'ICE AGE',
                subtitle: '20,000 BCE',
                description: 'Frozen lakes and deadly glaciers.',
                icon: '❄',
                color: 0x55ccff,
                destination: 'GameScene'
            },
            {
                number: '02',
                title: 'STONE AGE',
                subtitle: '10,000 BCE',
                description: 'Volcanic vents and ancient terrain.',
                icon: '▲',
                color: 0xffa533,
                destination: 'Sector2Scene'
            },
            {
                number: '03',
                title: 'MEDIEVAL WORLD',
                subtitle: '1240 CE',
                description: 'Fortresses and hidden dangers.',
                icon: '♜',
                color: 0xb56cff,
                destination: 'Level3Scene'
            },
            {
                number: '04',
                title: 'ANCIENT WORLD',
                subtitle: '2500 BCE',
                description: 'Lost temples and mysterious forests.',
                icon: '✦',
                color: 0x39ff8b,
                destination: 'Level4Scene'
            },
            {
                number: '05',
                title: 'GLITCH REALM',
                subtitle: 'UNKNOWN',
                description: 'Reality fractures. Nothing is stable.',
                icon: '⌘',
                color: 0xff3dce,
                destination: 'Level5Scene'
            }
        ];

        // 3 x 2 panel arrangement
        const cardWidth = 190;
        const cardHeight = 112;
        const gapX = 12;
        const gapY = 12;

        const startX = (width - (cardWidth * 3 + gapX * 2)) / 2
            + cardWidth / 2;
        const startY = 119;

        panels.forEach((panel, index) => {
            const col = index % 3;
            const row = Math.floor(index / 3);

            this.createPanel(
                startX + col * (cardWidth + gapX),
                startY + row * (cardHeight + gapY),
                cardWidth,
                cardHeight,
                panel
            );
        });

        // Footer
        this.createBackButton(75, height - 19);

        this.add.text(width - 10, height - 12,
            'GLITCHVERSE // CHRONO SYSTEM ONLINE', {
            fontFamily: GAME_FONTS.mono,
            fontSize: '11px',
            color: '#64748b'
        }).setOrigin(1, 0.5);

        // Background glitch effect
        this.backgroundGlitch = this.add.graphics()
            .setScrollFactor(0)
            .setDepth(100);

        this.time.addEvent({
            delay: 2800,
            loop: true,
            callback: () => this.triggerGlitch()
        });

        // Entrance animation
        this.panels.forEach((panel, index) => {
            panel.setAlpha(0);
            panel.y += 12;

            this.tweens.add({
                targets: panel,
                alpha: 1,
                y: panel.y - 12,
                duration: 350,
                delay: index * 65,
                ease: 'Back.Out'
            });
        });
    }

    private createPanel(
        x: number,
        y: number,
        w: number,
        h: number,
        panel: {
            number: string;
            title: string;
            subtitle: string;
            description: string;
            icon: string;
            color: number;
            destination: string;
        }
    ): void {
        const color = panel.color;
        const colorHex = '#' + color.toString(16).padStart(6, '0');

        const container = this.add.container(x, y);
        this.panels.push(container);

        const bg = this.add.graphics();

        const drawPanel = (active: boolean) => {
            bg.clear();

            // Outer glow
            if (active) {
                bg.fillStyle(color, 0.12);
                bg.fillRoundedRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 7);
            }

            // Main body
            bg.fillStyle(active ? 0x101d2c : 0x0a1220, 0.98);
            bg.fillRoundedRect(-w / 2, -h / 2, w, h, 5);

            // Main border
            bg.lineStyle(active ? 2.5 : 1.2, color, active ? 1 : 0.7);
            bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 5);

            // Header strip
            bg.fillStyle(color, active ? 0.3 : 0.14);
            bg.fillRoundedRect(
                -w / 2,
                -h / 2,
                w,
                26,
                { tl: 5, tr: 5, bl: 0, br: 0 }
            );

            bg.lineStyle(1, color, 0.45);
            bg.lineBetween(
                -w / 2,
                -h / 2 + 26,
                w / 2,
                -h / 2 + 26
            );

            // Corner accents
            const c = 9;
            bg.lineStyle(2, color, active ? 1 : 0.65);
            bg.lineBetween(-w / 2, -h / 2 + c, -w / 2, -h / 2);
            bg.lineBetween(-w / 2, -h / 2, -w / 2 + c, -h / 2);

            bg.lineBetween(w / 2 - c, -h / 2, w / 2, -h / 2);
            bg.lineBetween(w / 2, -h / 2, w / 2, -h / 2 + c);

            // Bottom accent
            bg.fillStyle(color, active ? 1 : 0.55);
            bg.fillRect(-w / 2 + 9, h / 2 - 4, w - 18, 2);
        };

        drawPanel(false);

        const number = this.add.text(
            -w / 2 + 10,
            -h / 2 + 7,
            `WORLD ${panel.number}`,
            {
                fontFamily: GAME_FONTS.mono,
                fontSize: '8px',
                color: colorHex
            }
        );

        const title = this.add.text(
            0,
            -h / 2 + 17,
            panel.title,
            {
                fontFamily: GAME_FONTS.heading,
                fontSize: panel.title.length > 13 ? '10px' : '12px',
                fontStyle: 'bold',
                color: '#ffffff'
            }
        ).setOrigin(0.5);

        const icon = this.add.text(
            0,
            -12,
            panel.icon,
            {
                fontFamily: GAME_FONTS.heading,
                fontSize: '25px',
                color: colorHex
            }
        ).setOrigin(0.5);

        const era = this.add.text(
            0,
            12,
            panel.subtitle,
            {
                fontFamily: GAME_FONTS.mono,
                fontSize: '12px',
                color: colorHex
            }
        ).setOrigin(0.5);

        const description = this.add.text(
            0,
            31,
            panel.description,
            {
                fontFamily: GAME_FONTS.primary,
                fontSize: '11px',
                color: '#a9b7ca',
                align: 'center',
                wordWrap: { width: w - 16 }
            }
        ).setOrigin(0.5);

        const enterText = this.add.text(
            w / 2 - 10,
            h / 2 - 10,
            'ENTER >',
            {
                fontFamily: GAME_FONTS.mono,
                fontSize: '8px',
                fontStyle: 'bold',
                color: colorHex
            }
        ).setOrigin(1, 0.5);

        const hitArea = this.add.zone(0, 0, w, h)
            .setInteractive({ useHandCursor: true });

        hitArea.on('pointerover', () => {
            if (this.isLeaving) return;

            drawPanel(true);
            container.setScale(1.025);
            AudioManager.playMenuHover();
        });

        hitArea.on('pointerout', () => {
            drawPanel(false);
            container.setScale(1);
        });

        hitArea.on('pointerdown', () => {
            if (this.isLeaving) return;
            container.setScale(0.98);
        });

        hitArea.on('pointerup', () => {
            if (this.isLeaving) return;

            container.setScale(1);
            AudioManager.playMenuSelect();
            this.enterDestination(panel.destination);
        });

        container.add([
            bg,
            number,
            title,
            icon,
            era,
            description,
            enterText,
            hitArea
        ]);
    }

    private createBackButton(x: number, y: number): void {
        const bg = this.add.graphics();

        const draw = (hover: boolean) => {
            bg.clear();

            bg.fillStyle(0x101827, 1);
            bg.fillRoundedRect(-58, -12, 116, 24, 4);

            bg.lineStyle(1.5, hover ? 0xffffff : 0x00f0ff, 1);
            bg.strokeRoundedRect(-58, -12, 116, 24, 4);
        };

        draw(false);

        const text = this.add.text(0, 0, '< MAIN MENU', {
            fontFamily: GAME_FONTS.primary,
            fontSize: '10px',
            fontStyle: 'bold',
            color: '#00f0ff'
        }).setOrigin(0.5);

        const hit = this.add.zone(0, 0, 116, 24)
            .setInteractive({ useHandCursor: true });

        hit.on('pointerover', () => {
            draw(true);
            text.setColor('#ffffff');
            AudioManager.playMenuHover();
        });

        hit.on('pointerout', () => {
            draw(false);
            text.setColor('#00f0ff');
        });

        hit.on('pointerup', () => {
            if (this.isLeaving) return;

            AudioManager.playMenuSelect();
            this.isLeaving = true;
            this.scene.start('MainMenu');
        });

        this.add.container(x, y, [bg, text, hit]);
    }

    private triggerGlitch(): void {
        if (this.isLeaving) return;

        const width = this.scale.width;
        const height = this.scale.height;

        this.backgroundGlitch.clear();

        const strips = Phaser.Math.Between(2, 5);

        for (let i = 0; i < strips; i++) {
            const y = Phaser.Math.Between(55, height - 35);
            const x = Phaser.Math.Between(0, width - 30);
            const stripWidth = Phaser.Math.Between(20, 150);

            this.backgroundGlitch.fillStyle(
                Phaser.Utils.Array.GetRandom([
                    0x00ff41,
                    0x00f0ff,
                    0x39ff14
                ]),
                0.35
            );

            this.backgroundGlitch.fillRect(
                x,
                y,
                stripWidth,
                Phaser.Math.Between(1, 3)
            );
        }

        this.tweens.add({
            targets: this.backgroundGlitch,
            alpha: 0,
            duration: 110,
            onComplete: () => {
                this.backgroundGlitch.clear();
                this.backgroundGlitch.setAlpha(1);
            }
        });
    }

    private enterDestination(sceneKey: string): void {
        if (this.isLeaving) return;

        this.isLeaving = true;

        this.cameras.main.fadeOut(350, 0, 0, 0);

        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start(sceneKey);
        });
    }
}

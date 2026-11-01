import Phaser from 'phaser';
import { GAME_FONTS } from '../config';
import { AudioManager } from '../systems/AudioManager';

export class LevelSelectScene extends Phaser.Scene {
    private isLeaving = false;

    constructor() {
        super('LevelSelectScene');
    }

    create(): void {
        this.isLeaving = false;

        const width = this.scale.width;
        const height = this.scale.height;

        this.cameras.main.setBackgroundColor('#070b14');
        this.cameras.main.fadeIn(350);

        // Background grid
        const grid = this.add.graphics();
        grid.lineStyle(1, 0x162236, 0.35);

        for (let x = 0; x < width; x += 32) {
            grid.lineBetween(x, 0, x, height);
        }

        for (let y = 0; y < height; y += 32) {
            grid.lineBetween(0, y, width, y);
        }

        // Heading
        this.add.text(width / 2, 23, 'CHRONO-EXPEDITION // SELECT DESTINATION', {
            fontFamily: GAME_FONTS.heading,
            fontSize: '19px',
            fontStyle: 'bold',
            color: '#00f0ff',
            stroke: '#040711',
            strokeThickness: 3
        }).setOrigin(0.5);

        this.add.text(width / 2, 46,
            'SIX FRACTURED PATHS  //  ONE REALITY TO RESTORE', {
                fontFamily: GAME_FONTS.mono,
                fontSize: '8px',
                color: '#39ff14',
                letterSpacing: 1
            }).setOrigin(0.5);

        // Panel configuration
        const panels = [
            {
                number: '00',
                title: 'STORY / PROLOGUE',
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
                description: 'Glaciers, frozen lakes and deadly ice.',
                icon: '❄',
                color: 0x55ccff,
                destination: 'GameScene'
            },
            {
                number: '02',
                title: 'STONE AGE',
                subtitle: '10,000 BCE',
                description: 'Volcanic vents and prehistoric terrain.',
                icon: '▲',
                color: 0xffa533,
                destination: 'Sector2Scene'
            },
            {
                number: '03',
                title: 'MEDIEVAL WORLD',
                subtitle: '1240 CE',
                description: 'Ancient fortresses and hidden dangers.',
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

        // Three columns and two rows
        const cardWidth = 190;
        const cardHeight = 112;
        const gapX = 12;
        const gapY = 12;

        const startX = (width - (cardWidth * 3 + gapX * 2)) / 2 + cardWidth / 2;
        const startY = 118;

        panels.forEach((panel, index) => {
            const col = index % 3;
            const row = Math.floor(index / 3);

            const x = startX + col * (cardWidth + gapX);
            const y = startY + row * (cardHeight + gapY);

            this.createPanel(
                x,
                y,
                cardWidth,
                cardHeight,
                panel
            );
        });

        // Main menu button
        this.createBackButton(75, height - 19);

        // Bottom status
        this.add.text(width - 8, height - 12,
            'GLITCHVERSE // CHRONO SYSTEM ONLINE', {
                fontFamily: GAME_FONTS.mono,
                fontSize: '7px',
                color: '#52647c'
            }).setOrigin(1, 0.5);
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

        // Panel background
        const bg = this.add.graphics();

        const drawPanel = (active: boolean) => {
            bg.clear();

            bg.fillStyle(0x0b1220, active ? 1 : 0.94);
            bg.fillRoundedRect(-w / 2, -h / 2, w, h, 5);

            bg.lineStyle(
                active ? 2 : 1,
                color,
                active ? 1 : 0.55
            );

            bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 5);

            // Header
            bg.fillStyle(color, active ? 0.23 : 0.12);
            bg.fillRoundedRect(-w / 2, -h / 2, w, 25, {
                tl: 5,
                tr: 5,
                bl: 0,
                br: 0
            });

            bg.lineStyle(1, color, 0.35);
            bg.lineBetween(
                -w / 2,
                -h / 2 + 25,
                w / 2,
                -h / 2 + 25
            );

            // Bottom accent
            bg.fillStyle(color, active ? 1 : 0.5);
            bg.fillRect(-w / 2 + 8, h / 2 - 4, w - 16, 2);
        };

        drawPanel(false);

        // World number
        const number = this.add.text(
            -w / 2 + 9,
            -h / 2 + 6,
            `WORLD ${panel.number}`,
            {
                fontFamily: GAME_FONTS.mono,
                fontSize: '8px',
                color: colorHex
            }
        );

        // Title
        const title = this.add.text(
            0,
            -h / 2 + 16,
            panel.title,
            {
                fontFamily: GAME_FONTS.heading,
                fontSize: panel.title.length > 13 ? '10px' : '12px',
                fontStyle: 'bold',
                color: '#ffffff'
            }
        ).setOrigin(0.5);

        // Icon
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

        // Era
        const era = this.add.text(
            0,
            12,
            panel.subtitle,
            {
                fontFamily: GAME_FONTS.mono,
                fontSize: '8px',
                color: colorHex
            }
        ).setOrigin(0.5);

        // Description
        const description = this.add.text(
            0,
            31,
            panel.description,
            {
                fontFamily: GAME_FONTS.primary,
                fontSize: '7px',
                color: '#a9b7ca',
                align: 'center',
                wordWrap: { width: w - 16 }
            }
        ).setOrigin(0.5);

        // Selection label
        const enterText = this.add.text(
            w / 2 - 10,
            h / 2 - 16,
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

    private enterDestination(sceneKey: string): void {
        if (this.isLeaving) return;

        this.isLeaving = true;

        this.cameras.main.fadeOut(350, 0, 0, 0);

        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start(sceneKey);
        });
    }
}
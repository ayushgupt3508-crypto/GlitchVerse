
import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';

export interface GameOverCallbacks {
    onRespawn: () => void;
    onRestart: () => void;
    onMainMenu: () => void;
}

export class GameOverScreen extends Phaser.GameObjects.Container {

    private keys: Phaser.Input.Keyboard.Key[] = [];

    constructor(
        scene: Phaser.Scene,
        callbacks: GameOverCallbacks,
        reason = 'DISINTEGRATION IN THE VOID'
    ) {
        super(scene, 0, 0);

        this.setScrollFactor(0);
        this.setDepth(3000);

        const W = scene.scale.width;
        const H = scene.scale.height;
        const cx = W / 2;

        // ==========================================
        // 1. DARK BACKGROUND
        // ==========================================

        const backdrop = scene.add.rectangle(
            cx, H / 2, W, H, 0x04060d, 0.88
        ).setInteractive();

        this.add(backdrop);

        // ==========================================
        // 2. MAGENTA BORDER
        // ==========================================

        const border = scene.add.graphics();

        border.lineStyle(3, 0xff0055, 0.7);
        border.strokeRect(12, 12, W - 24, H - 24);

        border.lineStyle(1, 0xff0055, 0.25);
        border.strokeRect(19, 19, W - 38, H - 38);

        this.add(border);

        // ==========================================
        // 3. GAME OVER TITLE
        // ==========================================

        const titleY = H * 0.20;

        const title = scene.add.text(
            cx,
            titleY,
            'GAME OVER',
            {
                fontFamily: 'Pixel Operator, monospace',
                fontSize: `${Math.min(98, W * 0.07)}px`,
                color: '#ff315c',
                fontStyle: 'bold',
                stroke: '#800020',
                strokeThickness: 5,
                shadow: {
                    offsetX: 0,
                    offsetY: 0,
                    color: '#ff003c',
                    blur: 18,
                    fill: true
                }
            }
        ).setOrigin(0.5);

        this.add(title);

        // Title entrance animation
        title.setAlpha(0);
        title.setScale(0.8);

        scene.tweens.add({
            targets: title,
            alpha: 1,
            scale: 1,
            duration: 500,
            ease: 'Back.easeOut'
        });

        // Occasional subtle glitch flicker
        scene.time.addEvent({
            delay: 1800,
            loop: true,
            callback: () => {
                if (!title.active) return;

                scene.tweens.add({
                    targets: title,
                    alpha: 0.65,
                    duration: 65,
                    yoyo: true,
                    repeat: 1
                });
            }
        });

        // ==========================================
        // 4. DEAD SCIENTIST
        // ==========================================

        const scientistY = H * 0.40;

        if (scene.textures.exists('dead_scientist')) {

            const scientist = scene.add.image(
                cx,
                scientistY,
                'dead_scientist'
            );

            scientist.setDisplaySize(
                Math.min(W * 0.30, 440),
                H * 0.17
            );

            scientist.setOrigin(0.5);
            this.add(scientist);

            // Slight glitch movement
            scene.time.addEvent({
                delay: 2200,
                loop: true,
                callback: () => {
                    if (!scientist.active) return;

                    scientist.x = cx + Phaser.Math.Between(-3, 3);

                    scene.time.delayedCall(80, () => {
                        if (scientist.active) scientist.x = cx;
                    });
                }
            });

        } else {

            // Fallback if the scientist sprite is not imported
            const fallback = scene.add.text(
                cx,
                scientistY,
                '[ SCIENTIST DOWN ]',
                {
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    color: '#00eaff'
                }
            ).setOrigin(0.5);

            this.add(fallback);
        }

        // ==========================================
        // 5. DISINTEGRATION WARNING
        // ==========================================

        const reasonY = H * 0.56;
        const reasonW = Math.min(W * 0.55, 850);
        const reasonH = 42;

        const reasonBg = scene.add.graphics();

        reasonBg.fillStyle(0x080b17, 0.98);
        reasonBg.fillRoundedRect(
            cx - reasonW / 2,
            reasonY - reasonH / 2,
            reasonW,
            reasonH,
            7
        );

        reasonBg.lineStyle(2, 0xff0055, 1);
        reasonBg.strokeRoundedRect(
            cx - reasonW / 2,
            reasonY - reasonH / 2,
            reasonW,
            reasonH,
            7
        );

        this.add(reasonBg);

        const reasonText = scene.add.text(
            cx,
            reasonY,
            `[ ! ] ${reason.toUpperCase()}`,
            {
                fontFamily: 'Pixel Operator, monospace',
                fontSize: '13px',
                color: '#ff6680',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);

        this.add(reasonText);

        // ==========================================
        // BUTTON CREATION HELPER
        // ==========================================

        const createButton = (
            x: number,
            y: number,
            width: number,
            height: number,
            label: string,
            normalBg: number,
            normalBorder: number,
            normalText: string,
            hoverBg: number,
            hoverBorder: number,
            hoverText: string,
            callback: () => void,
            fontSize = '13px'
        ) => {

            const bg = scene.add.graphics();

            const draw = (
                bgColor: number,
                borderColor: number
            ) => {
                bg.clear();

                bg.fillStyle(bgColor, 0.98);
                bg.fillRoundedRect(
                    x - width / 2,
                    y - height / 2,
                    width,
                    height,
                    7
                );

                bg.lineStyle(2, borderColor, 1);
                bg.strokeRoundedRect(
                    x - width / 2,
                    y - height / 2,
                    width,
                    height,
                    7
                );
            };

            draw(normalBg, normalBorder);

            const text = scene.add.text(
                x, y, label,
                {
                    fontFamily: 'Pixel Operator, monospace',
                    fontSize,
                    color: normalText,
                    fontStyle: 'bold'
                }
            ).setOrigin(0.5);

            const hit = scene.add.zone(
                x, y, width, height
            ).setInteractive({
                useHandCursor: true
            });

            hit.on('pointerover', () => {
                draw(hoverBg, hoverBorder);
                text.setColor(hoverText);
                AudioManager.playMenuHover();
            });

            hit.on('pointerout', () => {
                draw(normalBg, normalBorder);
                text.setColor(normalText);
            });

            hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
                p.event.stopPropagation();
                AudioManager.playMenuSelect();
                callback();
            });

            this.add([bg, text, hit]);
        };

        // ==========================================
        // 6. RESPAWN BUTTON
        // ==========================================

        const respawnY = H * 0.70;

        createButton(
            cx,
            respawnY,
            Math.min(W * 0.34, 550),
            45,
            '⟳  RESPAWN [SPACE/ENTER]',
            0x102238,
            0x00eaff,
            '#00eaff',
            0x183b59,
            0xffffff,
            '#ffffff',
            callbacks.onRespawn,
            '15px'
        );

        // ==========================================
        // 7. RESTART AND MENU BUTTONS
        // ==========================================

        const secondaryY = H * 0.845;
        const gap = Math.min(W * 0.16, 250);

        const secondaryW = Math.min(W * 0.23, 360);
        const secondaryH = 40;

        createButton(
            cx - gap,
            secondaryY,
            secondaryW,
            secondaryH,
            '↺ RESTART [R]',
            0x101826,
            0x456477,
            '#bdcbd4',
            0x1b3045,
            0x00eaff,
            '#00eaff',
            callbacks.onRestart,
            '12px'
        );

        createButton(
            cx + gap,
            secondaryY,
            secondaryW,
            secondaryH,
            '⌂ MENU [ESC]',
            0x101826,
            0x456477,
            '#bdcbd4',
            0x1b3045,
            0xffd166,
            '#ffd166',
            callbacks.onMainMenu,
            '12px'
        );

        // ==========================================
        // 8. KEYBOARD SHORTCUTS
        // ==========================================

        if (scene.input.keyboard) {

            const keyboard = scene.input.keyboard;

            const shortcuts = [
                {
                    code: Phaser.Input.Keyboard.KeyCodes.SPACE,
                    action: callbacks.onRespawn
                },
                {
                    code: Phaser.Input.Keyboard.KeyCodes.ENTER,
                    action: callbacks.onRespawn
                },
                {
                    code: Phaser.Input.Keyboard.KeyCodes.R,
                    action: callbacks.onRestart
                },
                {
                    code: Phaser.Input.Keyboard.KeyCodes.ESC,
                    action: callbacks.onMainMenu
                },
                {
                    code: Phaser.Input.Keyboard.KeyCodes.M,
                    action: callbacks.onMainMenu
                }
            ];

            shortcuts.forEach(shortcut => {

                const key = keyboard.addKey(shortcut.code);

                key.once('down', () => {
                    AudioManager.playMenuSelect();
                    shortcut.action();
                });

                this.keys.push(key);
            });
        }

        scene.add.existing(this);
    }

    // ==========================================
    // CLEANUP
    // ==========================================

    public override destroy(fromScene?: boolean): void {

        if (this.scene?.input?.keyboard) {
            this.keys.forEach(key => {
                this.scene.input.keyboard!.removeKey(key);
            });
        }

        this.keys = [];

        super.destroy(fromScene);
    }
}

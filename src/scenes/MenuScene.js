import { Scene } from "phaser";
import { TooltipManager } from "../gameobjects/Tooltips";

export class MenuScene extends Scene {
    constructor() {
        super("MenuScene");
    }

    init(data) {
        this.gameType = data?.gameType || "accounting";
    }

    create() {
        const FIRST_RECTANGLE_HEIGHT = 340;
        const SECOND_RECTANGLE_HEIGHT = 70;
        const vertical_shift_to_center = -SECOND_RECTANGLE_HEIGHT / 2;

        // Background rectangles (theme colors)
        this.add
            .rectangle(
                0,
                this.scale.height / 2 + vertical_shift_to_center,
                this.scale.width,
                FIRST_RECTANGLE_HEIGHT,
                0xdcc89f // gold/tan like button frame
            )
            .setAlpha(1)
            .setOrigin(0, 0.5);

        this.add
            .rectangle(
                0,
                this.scale.height / 2 +
                    FIRST_RECTANGLE_HEIGHT / 2 +
                    SECOND_RECTANGLE_HEIGHT / 2 +
                    vertical_shift_to_center,
                this.scale.width,
                SECOND_RECTANGLE_HEIGHT,
                0x5a2a15 // dark brown bottom
            )
            .setAlpha(0.9)
            .setOrigin(0, 0.5);

        // ----- Control instructions -----
        let instructionText = "";
        if (this.gameType === "debit_credit") {
            instructionText =
                "Move the tiger to grab each account and match it to its normal balance (debit or credit). Incorrect answers are sent to the middle of the screen until placed on the correct road.";
        } else if (this.gameType === "accounting") {
            instructionText =
                "Move the tiger to grab each account and match to the correct accounting element (assets, liabilities, shareholders equity, revenues, expenses). Incorrect answers are sent to the middle of the screen until placed on the correct element road.";
        }

        this.center_instructions = this.add
            .text(
                this.scale.width / 2,
                this.scale.height / 2 - 110 + vertical_shift_to_center,
                instructionText,
                {
                    fontSize: "32px",
                    fontFamily: '"Jersey 10", sans-serif',
                    color: "#7f1a02",
                    align: "center",
                    wordWrap: { width: this.scale.width * 0.8 },
                }
            )
            .setOrigin(0.5);

        // --- Pickup controls ---
        this.pickup_controls_label = this.add
            .text(
                (this.scale.width * 3) / 4,
                this.scale.height / 2 - 20 + vertical_shift_to_center,
                "Pickup Ball:",
                {
                    fontSize: "48px",
                    fontFamily: '"Jersey 10", sans-serif',
                    color: "#7f1a02",
                }
            )
            .setOrigin(0.5);

        // Space bar image
        this.space_bar = this.add.image(
            (this.scale.width * 3) / 4 - 80,
            this.scale.height / 2 + 80 + vertical_shift_to_center,
            "space_bar"
        );
        this._fitToBox(this.space_bar, 520, 110);

        // "or" text
        this.pickup_controls_or = this.add
            .text(
                (this.scale.width * 3) / 4 + 45,
                this.scale.height / 2 + 80 + vertical_shift_to_center,
                "or",
                {
                    fontSize: "24px",
                    fontFamily: '"Jersey 10", sans-serif',
                    color: "#7f1a02",
                }
            )
            .setOrigin(0.5);

        // Primary click image
        this.primary_click = this.add.image(
            (this.scale.width * 3) / 4 + 140,
            this.scale.height / 2 + 80 + vertical_shift_to_center,
            "primary_click"
        );
        this._fitToBox(this.primary_click, 520, 110);

        // --- Movement controls ---
        this.movement_controls_label = this.add
            .text(
                this.scale.width / 4,
                this.scale.height / 2 - 20 + vertical_shift_to_center,
                "Movement:",
                {
                    fontSize: "48px",
                    fontFamily: '"Jersey 10", sans-serif',
                    color: "#7f1a02",
                }
            )
            .setOrigin(0.5);

        // WASD keys
        this.WASD = this.add.image(
            this.scale.width / 4 - 90,
            this.scale.height / 2 + 80 + vertical_shift_to_center,
            "WASD"
        );
        this._fitToBox(this.WASD, 520, 110);

        // "or" text
        this.movement_controls_or = this.add
            .text(
                this.scale.width / 4,
                this.scale.height / 2 + 80 + vertical_shift_to_center,
                "or",
                {
                    fontSize: "24px",
                    fontFamily: '"Jersey 10", sans-serif',
                    color: "#7f1a02",
                }
            )
            .setOrigin(0.5);

        // Arrow keys
        this.arrow_keys = this.add.image(
            this.scale.width / 4 + 90,
            this.scale.height / 2 + 80 + vertical_shift_to_center,
            "arrow_keys"
        );
        this._fitToBox(this.arrow_keys, 520, 110);

        // --- Buttons ---
        this.createStyledButton(
            this.scale.width / 4,
            this.scale.height / 2 +
                FIRST_RECTANGLE_HEIGHT / 2 +
                SECOND_RECTANGLE_HEIGHT / 2 +
                vertical_shift_to_center,
            "Start Game",
            () => {
                //localStorage.setItem("difficulty", "1");
                if (this.game.sfxVolume > 0) {
                    this.sound.play("selection", {
                        volume: this.game.sfxVolume,
                    });
                }
                this.scene.stop("MainScene");
               this.scene.start("SpeedSelect", {
    type: this.gameType,
    isTutorial: false
});
            }
        );

        this.createStyledButton(
            (this.scale.width * 3) / 4,
            this.scale.height / 2 +
                FIRST_RECTANGLE_HEIGHT / 2 +
                SECOND_RECTANGLE_HEIGHT / 2 +
                vertical_shift_to_center,
            "Start Tutorial",
            () => {
                //localStorage.setItem("difficulty", "0");
                if (this.game.sfxVolume > 0) {
                    this.sound.play("selection", {
                        volume: this.game.sfxVolume,
                    });
                }
                this.scene.stop("MainScene");
               this.scene.start("SpeedSelect", {
    type: this.gameType,
    isTutorial: true
});
            
	    }
        );
    }

    createStyledButton(x, y, label, callback, tooltipText) {
        const border = this.add.rectangle(0, 0, 244, 64, 0xdcc89f).setDepth(3);
        const rect = this.add.rectangle(0, 0, 240, 60, 0x7f1a02).setDepth(3);
        const text = this.add
            .text(0, 0, label, {
                fontSize: "22px",
                fontFamily: '"Jersey 10", sans-serif',
                color: "#dcc89f",
            })
            .setOrigin(0.5);

        const container = this.add
            .container(x, y, [border, rect, text])
            .setSize(244, 64)
            .setDepth(3)
            .setInteractive({ useHandCursor: true });

        container.on("pointerover", () => {
            rect.setFillStyle(0xa8321a);
            this.tweens.add({
                targets: container,
                scale: 1.05,
                duration: 150,
                ease: "Power1",
            });
        });

        container.on("pointerout", () => {
            rect.setFillStyle(0x7f1a02);
            this.tweens.add({
                targets: container,
                scale: 1,
                duration: 150,
                ease: "Power1",
            });
        });

        container.on("pointerdown", () => {
            if (this.game.sfxVolume > 0) {
                this.sound.play("selection", { volume: this.game.sfxVolume });
            }
            const tween = this.tweens.add({
                targets: container,
                scale: 0.9,
                duration: 80,
                yoyo: true,
                ease: "Power1",
            });
            tween.once("complete", callback);
        });

        if (tooltipText) {
            this.tooltip.attachTo(container, tooltipText);
        }

        return container;
    }

    // Helper: scale any image to fit max width/height while preserving aspect ratio
    _fitToBox(gameObject, maxW, maxH, padding = 0) {
        const w = gameObject.width;
        const h = gameObject.height;
        if (!w || !h) return;
        const availW = Math.max(1, maxW - padding * 2);
        const availH = Math.max(1, maxH - padding * 2);
        const scale = Math.min(availW / w, availH / h);
        gameObject.setScale(scale);
    }
}


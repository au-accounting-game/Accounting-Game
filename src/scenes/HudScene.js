// src/scenes/HudScene.js
import { Scene } from "phaser";

// The HUD scene is the scene that shows the points and the remaining time.
export class HudScene extends Scene {
    remaining_time = 0;

    remaining_time_text;
    points_text;

    constructor() {
        super("HudScene");
    }

    init(data) {
        this.cameras.main.fadeIn(1000, 0, 0, 0);
        this.remaining_time = data.remaining_time | 0;
    }

    create() {
        const { width, height } = this.scale;

        // Match Level 1/2 styling
        const baseStyle = {
            fontSize: "40px",
            color: "#dcc89f",
            fontFamily: '"Jersey 10", sans-serif',
        };
        const strokeColor = "#7f1a02";
        const strokeThickness = 3;

        // --- Points text (top-left) ---
        this.points_text = this.add
            .text(20, 3, "POINTS: 0000", baseStyle)
            .setOrigin(0, 0)
            .setStroke(strokeColor, strokeThickness)
            .setDepth(999);

        // --- Correct answers counter (below points) ---
this.correct_answers_text = this.add
    .text(20, 45, "Correct: 0/20", baseStyle)
    .setOrigin(0, 0)
    .setStroke(strokeColor, strokeThickness)
    .setDepth(999);

        // --- Time text (top-right) ---
        this.remaining_time_text = this.add
            .text(width - 20, 3, `Time: ${this.remaining_time}s`, baseStyle)
            .setOrigin(1, 0)
            .setStroke(strokeColor, strokeThickness)
            .setDepth(999);

        // --- Floating score popup (center of the screen) ---
        this.plusTextAnchor = { x: width / 2, y: height / 2 };
        this.plusText = this.add
            .text(this.plusTextAnchor.x, this.plusTextAnchor.y, "", {
                fontSize: "48px",
                color: "#dcc89f",
                fontFamily: '"Jersey 10", sans-serif',
            })
            .setOrigin(0.5, 0.5)
            .setStroke(strokeColor, strokeThickness)
            .setDepth(1000)
            .setAlpha(0);
    }

    update_points(points) {
        const v = String(Math.max(0, points | 0)).padStart(3, "0");
        this.points_text?.setText(`POINTS: ${v}`);
    }

    update_correct_answers(count) {
    this.correct_answers_text?.setText(`Correct: ${count}/20`);
}
    update_timeout(timeout) {
        const t = timeout | 0;
        this.remaining_time_text?.setText(`Time: ${t}s`);
    }

    showPointsPopup(points) {
        // Reuse single text object; pop and fade upward
        const t = this.plusText;
        if (!t) return;
        t.setText(`+ ${points}`);
        t.setPosition(this.plusTextAnchor.x, this.plusTextAnchor.y);
        t.setAlpha(1).setScale(1);
        this.tweens.killTweensOf(t);
        this.tweens.add({
            targets: t,
            y: this.plusTextAnchor.y - 50,
            alpha: 0,
            scale: 1.15,
            duration: 700,
            ease: "Quad.easeOut",
        });
    }
}

export default HudScene;


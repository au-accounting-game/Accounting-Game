// src/scenes/StatsScene.js
// Settings -> My Stats: the logged-in player's own results per game.
// Same look as SettingsScene (sky, drifting clouds, red panel).
import { Scene } from "phaser";

// every game, in main menu order (keys match the backend's game names)
const GAMES = [
    { key: "game3-4", label: "Effect of Transactions" },
    { key: "game3-2", label: "Effect of Transactions + NI" },
    { key: "game3-1", label: "Balance the Equation" },
    { key: "game1", label: "Debit/Credit" },
    { key: "game2", label: "5 Elements" },
    { key: "game3-3", label: "Accounting Errors" },
];

// 754 -> "12m 34s"
const formatTime = (seconds) => {
    const s = Math.max(0, Math.round(seconds || 0));
    return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
};

export class StatsScene extends Scene {
    constructor() {
        super("StatsScene");
    }

    create() {
        const { width, height } = this.scale;

        // --- Background ---
        this.add.image(width / 2, height / 2, "home_bg")
            .setOrigin(0.5)
            .setDisplaySize(width, height)
            .setDepth(0);

        // Moving clouds
        this.clouds = [];
        this.cloudSpeed = 0.3;

        const baseSpacing = 550;
        const numClouds = Math.ceil(width / baseSpacing) + 3;

        for (let i = 0; i < numClouds; i++) {
            const xOffset = i * baseSpacing + Phaser.Math.Between(-80, 80);

            const cloud = this.add.image(xOffset, height * 0.5 + Phaser.Math.Between(-40, 40), "home_clouds")
                .setOrigin(0.5)
                .setScale(Phaser.Math.FloatBetween(0.65, 0.85))
                .setDepth(0);

            this.clouds.push(cloud);
        }

        // Stats panel constants
        const panelWidth = 750;
        const panelHeight = 500;
        const panelX = width / 2;
        const panelY = height / 2;

        this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0xa8321a)
            .setStrokeStyle(3, 0x570600);

        this.add.text(panelX, panelY - panelHeight / 2 + 40, "My Stats", {
            fontSize: "50px",
            fill: "#dcc89f",
            fontFamily: '"Jersey 10", sans-serif',
        }).setOrigin(0.5);

        this._makeButton(panelX - panelWidth / 2 + 72.5, panelY - panelHeight / 2 + 35, "Exit",
            () => this.scene.start("SettingsScene"));

        this.statusText = this.add.text(panelX, panelY, "Loading...", {
            fontSize: "32px",
            fontFamily: '"Jersey 10", sans-serif',
            color: "#dcc89f",
            align: "center",
        }).setOrigin(0.5);

        const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        const apiBase = isLocal ? "http://localhost:8000" : "https://accounting-game.cse.eng.auburn.edu/api";

        fetch(`${apiBase}/stats/me`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                // scene may have been left while the fetch was in flight
                if (!this.sys.isActive()) return;

                if (!data.logged_in) {
                    this.statusText.setText("Log in to see your stats.");
                    return;
                }
                this.statusText.destroy();
                this._drawTable(data.games, panelX, panelY - panelHeight / 2 + 105, panelWidth);
            })
            .catch(err => {
                console.error("Failed to load personal stats", err);
                if (this.sys.isActive()) this.statusText.setText("Couldn't load your stats.\nTry again later.");
            });

        // Keyboard Shortcuts
        this._escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this._escKey.on("down", () => this.scene.start("SettingsScene"));
    }

    // one row per game (unplayed games show dashes), then a totals line
    _drawTable(rows, centerX, topY, panelWidth) {
        const byGame = new Map(rows.map(r => [r.game, r]));
        const left = centerX - panelWidth / 2 + 30;
        const cols = [
            { x: left, header: "Game", origin: 0 },
            { x: left + 395, header: "Played", origin: 0.5 },
            { x: left + 490, header: "Best", origin: 0.5 },
            { x: left + 585, header: "Average", origin: 0.5 },
            { x: left + 670, header: "Time", origin: 0.5 },
        ];
        const style = { fontSize: "26px", fontFamily: '"Jersey 10", sans-serif', color: "#dcc89f" };
        const rowH = 44;

        const drawRow = (y, cells, rowStyle) => cells.forEach((cell, i) =>
            this.add.text(cols[i].x, y, cell, rowStyle).setOrigin(cols[i].origin, 0.5));

        drawRow(topY, cols.map(c => c.header), { ...style, color: "#ffffff" });
        this.add.rectangle(centerX, topY + rowH / 2, panelWidth - 40, 2, 0xdcc89f, 0.6);

        GAMES.forEach((game, i) => {
            const r = byGame.get(game.key);
            const cells = r
                ? [game.label, String(r.rounds), String(r.top), String(Math.round(r.avg)), formatTime(r.seconds)]
                : [game.label, "-", "-", "-", "-"];
            drawRow(topY + rowH * (i + 1), cells, r ? style : { ...style, color: "#c9a77a" });
        });

        const totalRounds = rows.reduce((sum, r) => sum + r.rounds, 0);
        const totalSeconds = rows.reduce((sum, r) => sum + r.seconds, 0);
        this.add.text(centerX, topY + rowH * (GAMES.length + 1) + 12,
            `Games played: ${totalRounds}   |   Total time: ${formatTime(totalSeconds)}`, style).setOrigin(0.5);
    }

    // cloud wrap logic
    update() {
        if (!this.clouds) return;

        this.clouds.forEach(cloud => {
            cloud.x -= this.cloudSpeed;

            if (cloud.x < -200) {
                const rightMost = Math.max(...this.clouds.map(c => c.x));

                cloud.x = rightMost + Phaser.Math.Between(350, 600);
                cloud.y = this.scale.height * 0.6 + Phaser.Math.Between(-40, 40);
                cloud.scale = Phaser.Math.FloatBetween(0.65, 0.85);
            }
        });
    }

    // same button as SettingsScene
    _makeButton(x, y, labelText, onClick) {
        const border = this.add.rectangle(0, 0, 129, 54, 0x7f1a02).setDepth(3);
        border.setStrokeStyle(3, 0xdcc89f);
        const rect = this.add.rectangle(0, 0, 125, 50, 0x7f1a02).setDepth(3);
        const label = this.add.text(0, 0, labelText, {
            fontSize: "24px",
            fontFamily: '"Jersey 10", sans-serif',
            color: "#dcc89f",
            align: "center",
        }).setOrigin(0.5).setDepth(3);

        const button = this.add.container(x, y, [border, rect, label]).setDepth(3);
        rect.setInteractive({ useHandCursor: true });

        rect.on("pointerover", () => {
            rect.setFillStyle(0xa8321a);
            this.tweens.add({ targets: button, scale: 1.05, duration: 150, ease: "Power1" });
        });
        rect.on("pointerout", () => {
            rect.setFillStyle(0x7f1a02);
            this.tweens.add({ targets: button, scale: 1, duration: 150, ease: "Power1" });
        });
        rect.on("pointerdown", () => {
            if ((this.game.sfxVolume ?? this.sound.volume) > 0) this.sound.play("selection");
            this.tweens.add({ targets: button, scale: 0.9, duration: 80, yoyo: true, ease: "Power1", onComplete: onClick });
        });
        return button;
    }
}

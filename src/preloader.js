// Class to preload all the assets
export class Preloader extends Phaser.Scene {
    constructor() {
        super({ key: "Preloader" });
    }

    preload() {
        const { width, height } = this.cameras.main;

        // --- Loading bar setup ---
        const progressBox = this.add.graphics();
        const progressBar = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

        const loadingText = this.add
            .text(width / 2, height / 2 - 60, "Loading...", {
                fontSize: "24px",
                fill: "#ffffff",
            })
            .setOrigin(0.5);

        const percentText = this.add
            .text(width / 2, height / 2, "0%", {
                fontSize: "20px",
                fill: "#000000",
            })
            .setOrigin(0.5);

        this.load.on("progress", (value) => {
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
            percentText.setText(parseInt(value * 100) + "%");
        });

        this.load.on("complete", () => {
            loadingText.setText("Loading complete!");
            progressBar.destroy();
            progressBox.destroy();
            percentText.destroy();
        });

        // ----- API URL -----
        this.game.apiBaseUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

        // --- Assets ---
        this.load.setPath("assets");

        // Home Screen
        this.load.image("home_bg", "homeScreen_bg.png");
        this.load.image("home_fg", "homeScreen_fg.png");
        this.load.image("gm3_shared_bg", "level1.jpg");   // ✅ for GM3Level1/2/3 game-over
        this.load.image("gameover_bg",  "gameover.jpg");  // ✅ for MainScene game-over
        this.load.image("home_clouds", "HomeScreenClouds.png");
        this.load.image("home_text", "HomeScreenText.png");
        this.load.image("volumeIcon", "volume.png");

        // Equation Game  
        this.load.image("gm3_level1_bg", "level1.jpg");

        // UI / misc
        this.load.image("logo", "logo.png");
        this.load.image("space_bar", "space_bar.png");
        this.load.image("primary_click", "primary_click.png");
        this.load.image("arrow_keys", "arrow_keys.png");
        this.load.image("WASD", "WASD.png");
        this.load.image("background", "background.png");
        this.load.image("player", "player/aubie.png");

        // Conveyor Belts
        this.load.image("belt", "objects/conveyor-belt/Conveyor_Belt_Base.png");
        this.load.atlas("up-belt", "objects/conveyor-belt/up-belt/up-belt.png", "objects/conveyor-belt/up-belt/up-belt_atlas.json");
        this.load.animation("up-belt-anim", "objects/conveyor-belt/up-belt/up-belt_anim.json");
        this.load.atlas("down-belt", "objects/conveyor-belt/down-belt/down-belt.png", "objects/conveyor-belt/down-belt/down-belt_atlas.json");
        this.load.animation("down-belt-anim", "objects/conveyor-belt/down-belt/down-belt_anim.json");
        this.load.atlas("right-belt", "objects/conveyor-belt/right-belt/right-belt.png", "objects/conveyor-belt/right-belt/right-belt_atlas.json");
        this.load.animation("right-belt-anim", "objects/conveyor-belt/right-belt/right-belt_anim.json");
        this.load.atlas("left-belt", "objects/conveyor-belt/left-belt/left-belt.png", "objects/conveyor-belt/left-belt/left-belt_atlas.json");
        this.load.animation("left-belt-anim", "objects/conveyor-belt/left-belt/left-belt_anim.json");

        // Balls & Basket
        this.load.image("ball", "ball.png");
        this.load.image("basket", "box.png");

        // Enemies
        this.load.atlas("enemy-blue", "enemies/enemy-blue/enemy-blue.png", "enemies/enemy-blue/enemy-blue_atlas.json");
        this.load.animation("enemy-blue-anim", "enemies/enemy-blue/enemy-blue_anim.json");
        this.load.image("enemy-bullet", "enemies/enemy-bullet.png");

        // Fonts
        this.load.bitmapFont("pixelfont", "fonts/pixelfont.png", "fonts/pixelfont.xml");
        this.load.image("knighthawks", "fonts/knight3.png");

        // Audio
        this.load.audio("game_bgm", "music/game_bgm.mp3");
        this.load.audio("menu_bgm", "music/menu_bgm.mp3");
        this.load.audio("game3", "music/game3.mp3");
        this.load.audio("selection", "music/selection_sound.wav");
        this.load.audio("correct", "music/correct_sound.wav");
        this.load.audio("error", "music/error_sound.mp3");

        // Excel file
        this.load.binary("excelData", "UpdatedAccountingElements_v2.26.xlsx");

        //leaderboard icon
        this.load.image('leaderboardIcon', 'trophy_icon.png')
        this.load.image('settingsIcon', 'settingsIcon.png');
        this.load.image('exitIcon', 'exit_icon.png');

        // Debug loader log
        this.load.on("progress", (progress) => {
            console.log("Loading: " + Math.round(progress * 100) + "%");
        });
    }

    create() {
        // --- Bitmap Font Setup ---
        const config = {
            image: "knighthawks",
            width: 31,
            height: 25,
            chars: Phaser.GameObjects.RetroFont.TEXT_SET6,
            charsPerRow: 10,
            spacing: { x: 1, y: 1 },
        };
        this.cache.bitmapFont.add("knighthawks", Phaser.GameObjects.RetroFont.Parse(this, config));

        // Note: the "excelData" binary loaded above is parsed independently
        // by each of GM3Level1/2/3 in their own buildLevel() (each level
        // uses a different sheet/column layout), not here.

        // --- Transition to Splash ---
        this.scene.start("SplashScene");
    }
}

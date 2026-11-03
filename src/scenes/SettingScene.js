import { Scene } from "phaser";

const DEFAULT_SETTINGS = {
    volume: 1.0,
};

export class SettingsScene extends Scene {
    constructor() {
        super("SettingsScene");
    }

    async create() {
        // --- Background ---
        this.add.image(this.scale.width / 2, this.scale.height / 2, "home_bg")
            .setOrigin(0.5)
            .setDisplaySize(this.scale.width, this.scale.height)
            .setDepth(0);

	// Moving clouds
        this.clouds = [];
        this.cloudSpeed = 0.3;

        const baseSpacing = 550;
        const numClouds = Math.ceil(this.scale.width / baseSpacing) + 3;

        for (let i = 0; i < numClouds; i++) {
            const xOffset = i * baseSpacing + Phaser.Math.Between(-80, 80);

            const cloud = this.add.image(
                xOffset,
                this.scale.height * 0.5 + Phaser.Math.Between(-40, 40),
                "home_clouds"
            )
                .setOrigin(0.5)
                .setScale(Phaser.Math.FloatBetween(0.65, 0.85))
                .setDepth(0);

            this.clouds.push(cloud);
        }	
        
        this.volume = parseFloat(localStorage.getItem("volume"));
        if (isNaN(this.volume)) this.volume = DEFAULT_SETTINGS.volume;

        this.game.sfxVolume = Math.max(0, Math.min(1, this.volume));

        // Settings panel constants
        const panelWidth = 750;
        const panelHeight = 500;
        const panelX = this.scale.width / 2;
        const panelY = this.scale.height / 2;

        const panel = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0xa8321a)
            .setStrokeStyle(3, 0x570600);

        // Title
        this.add.text(panelX, panelY - panelHeight / 2 + 40, "Settings", {
            fontSize: "50px",
            fill: "#dcc89f",
            fontFamily: '"Jersey 10", sans-serif',
        }).setOrigin(0.5);

        // Standard Button Creator
        const createButton = (x, y, labelText, onClick) => {
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
                this.tweens.add({
                    targets: button,
                    scale: 0.9,
                    duration: 80,
                    yoyo: true,
                    ease: "Power1",
                    onComplete: onClick
                });
            });
            return button;
        };

        // 1. Exit Button (Top Left)
        createButton(panelX - panelWidth / 2 + 72.5,
                     panelY - panelHeight / 2 + 35,
                     "Exit",
                     () => this.scene.start("MainMenuScene"));

        // My Stats Button (Top Right)
        createButton(panelX + panelWidth / 2 - 72.5,
                     panelY - panelHeight / 2 + 35,
                     "My Stats",
                     () => this.scene.start("StatsScene"));

        // 2. Volume Section (Upper Mid)
        const volumeY = panelY - 60;
        this.add.text(panelX - 180, volumeY, "Volume", {
            fontFamily: '"Jersey 10", sans-serif',
            fontSize: "42px",
            color: "#dcc89f",
        }).setOrigin(0.5);

        this.volumeSlider = this.createVolumeSlider(panelX - 60, volumeY - 20);

        this.volumeDisplay = this.add.text(panelX + 210, volumeY, `${(this.volume * 100).toFixed(0)}%`, {
            fontFamily: '"Jersey 10", sans-serif',
            fontSize: "42px",
            color: "#dcc89f",
        }).setOrigin(0.5);

        // 3. Class picker - only when nobody is logged in (no sections to go by);
        // the main menu and games use the picked class (MainMenuScene)
        if (this.registry.get("loggedIn") !== true) {
            const classY = panelY + 60;
            this.add.text(panelX - 180, classY, "Class", {
                fontFamily: '"Jersey 10", sans-serif',
                fontSize: "42px",
                color: "#dcc89f",
            }).setOrigin(0.5);

            // "" = default menu for every other class
            const classChoices = [
                { label: "Default", value: "" },
                { label: "ACCT 2110", value: "ACCT 2110" },
            ];
            const classButtons = classChoices.map((choice, i) =>
                createButton(panelX - 20 + i * 150, classY, choice.label, () => {
                    if (choice.value) localStorage.setItem("class_view", choice.value);
                    else localStorage.removeItem("class_view");
                    showPicked();
                })
            );
            // the picked class is drawn at full strength, the other dimmed
            const showPicked = () => {
                const picked = localStorage.getItem("class_view") ?? "";
                classButtons.forEach((b, i) => b.setAlpha(classChoices[i].value === picked ? 1 : 0.45));
            };
            showPicked();
        }

	// DELETE LATER (keep for until new dashboards/login working)
	/*
        // 3. Login Test Button (Center)
        createButton(panelX, panelY + 20, "Login Test", () => {
            this.scene.start("LoginScreen");
        });

        // 4. View Switching Row (Bottom)
        const footerY = panelY + panelHeight / 2 - 60;
        const spacing = 160;

        createButton(panelX - spacing, footerY, "Student", () => this.scene.start("MainMenuScene"));
        createButton(panelX, footerY, "Professor", () => this.scene.start("ProfessorDash"));
        createButton(panelX + spacing, footerY, "Admin", () => this.scene.start("AdminDash"));
	*/

	// 5. Logout Button
	const footerY = panelY + panelHeight / 2 - 60;

	createButton(panelX, footerY, "Logout", () => {
    	    // remove logged in flag/status from user
	    sessionStorage.removeItem('sso_completed');	

    	    // MAYBE DELETE LATER: Clear local user data from fake login system (covering all bases)
    	    localStorage.removeItem("game_username");
    	    localStorage.removeItem("game_firstName");
    	    localStorage.removeItem("game_lastName");
    	    localStorage.removeItem("game_section");

    	    this.game.userSection = null;
    	    this.game.userUsername = null;

	    // logout redirect
	    window.location.href = "https://accounting-game.cse.eng.auburn.edu/saml/logout";

	});

        // Keyboard Shortcuts
        this._escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this._escKey.on("down", () => this.scene.start("MainMenuScene"));
    }

    // cloud wrap logic
    update() {
        if (!this.clouds) return;

        const width = this.scale.width;

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

    createVolumeSlider(x, y) {
        const slider = this.add.dom(x - 25, y + 15).createFromHTML(`
            <input type="range" min="0" max="100" value="${this.volume * 100}" style="width: 220px; accent-color: #dcc89f;">
        `);
        slider.setOrigin(0, 0);
        slider.addListener("input");
        slider.on("input", (event) => {
            this.volume = parseFloat(event.target.value) / 100;
            this.updateVolume();
        });
        return slider;
    }

    updateVolume() {
        if (this.volumeDisplay) {
            this.volumeDisplay.setText(`${(this.volume * 100).toFixed(0)}%`);
        }
        localStorage.setItem("volume", this.volume);
        if (this.game.musicManager) this.game.musicManager.setVolume(this.volume);
        this.game.sfxVolume = Math.max(0, Math.min(1, this.volume));
    }
}

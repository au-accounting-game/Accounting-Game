import { Scene } from "phaser";

export class Leaderboard extends Scene {
    constructor() {
        super("Leaderboard");
    }

    init(data) {
        this.gameKey = data.gameKey || "game1";
        this.highlightName = data.highlightName || null; 
        this.scoreScope = "section"; // tab state
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

        // --- Center panel Constants ---
        const panelWidth = 750;
        const panelHeight = 500;
        const panelX = this.scale.width / 2;
        const panelY = this.scale.height / 2;

        // --- (FIXED) Main Container for scaling/alignment ---
        const verticalOffset = 23;
        this.leaderboardContainer = this.add.container(panelX, panelY + verticalOffset);

        const panel = this.add.rectangle(0, 0, panelWidth, panelHeight, 0xa8321a)
            .setStrokeStyle(3, 0x570600);
        this.leaderboardContainer.add(panel);

        // --- Title (Relative to container) ---
        const title = this.add.text(0, -panelHeight / 2 + 40, "Leaderboard", {
            fontSize: "50px",
            fill: "#dcc89f",
            fontFamily: '"Jersey 10", sans-serif',
        }).setOrigin(0.5);
        this.leaderboardContainer.add(title);

        // --- Section/Global Tabs ---
        const tabWidth = 160;
        const tabHeight = 45;
        this.tabs = {};

        const createTab = (relX, label, key) => {
            const tab = this.add.container(relX, -panelHeight / 2 - 25);
            const bg = this.add.graphics();
            const drawTab = (color) => {
                bg.clear();
                bg.fillStyle(color, 1);
                bg.lineStyle(3, 0x570600);
                bg.beginPath();
                bg.moveTo(-tabWidth/2, tabHeight/2);
                bg.lineTo(-tabWidth/2, -tabHeight/2 + 10);
                bg.lineTo(-tabWidth/2 + 30, -tabHeight/2);
                bg.lineTo(tabWidth/2, -tabHeight/2);
                bg.lineTo(tabWidth/2, tabHeight/2);
                bg.closePath();
                bg.fillPath();
                bg.strokePath();
            };
            drawTab(0x7f1a02);
            const text = this.add.text(0, 0, label, {
                fontSize: "28px",
                fontFamily: '"Jersey 10", sans-serif',
                color: "#dcc89f",
            }).setOrigin(0.5);
            tab.add([bg, text]);
            tab.setSize(tabWidth, tabHeight);
            tab.setInteractive({ useHandCursor: true });
            tab.on("pointerdown", () => {
                if (this.scoreScope !== key) {
                    this.scoreScope = key;
                    this.updateTabs();
                    this.loadLeaderboard(this.gameKey);
                }
            });
            tab.draw = drawTab;
            this.tabs[key] = tab;
            this.leaderboardContainer.add(tab);
            return tab;
        };

        const rightEdge = panelWidth / 2;
        createTab(rightEdge - tabWidth/2, "Global", "global");   
        createTab(rightEdge - tabWidth*1.5 - 10, "Section", "section");
        this.updateTabs();

        // --- Mode Buttons ---
        const modes = [
            { label: "Dr. vs. Cr.", key: "game1" },
            { label: "Elements", key: "game2" },
            { label: "Balance", key: "game3-1" },
            { label: "Effects", key: "game3-2" },
            { label: "Errors", key: "game3-3" },
        ];

        const createButton = (relX, relY, labelText, onClick) => {
            const rect = this.add.rectangle(0, 0, 125, 50, 0x7f1a02).setStrokeStyle(3, 0xdcc89f);
            const label = this.add.text(0, 0, labelText, {
                fontSize: "30px",
                fontFamily: '"Jersey 10", sans-serif',
                color: "#dcc89f",
                align: "center",
                //wordWrap: { width: 90, useAdvancedWrap: true },  // wrap text within button width
            }).setOrigin(0.5);

            const button = this.add.container(relX, relY, [rect, label]);
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
                const tween = this.tweens.add({
                    targets: button,
                    scale: 0.9,
                    duration: 80,
                    yoyo: true,
                    ease: "Power1",
                });
                tween.once("complete", onClick);
            });

            return button;
        };

        const buttonRowY = panelHeight / 2 - 35;
        const buttonSpacing = 140;
        const buttonStartX = -((modes.length - 1) * buttonSpacing) / 2;

        modes.forEach((mode, i) => {
            const btn = createButton(buttonStartX + i * buttonSpacing, buttonRowY, mode.label, () => this.loadLeaderboard(mode.key));
            this.leaderboardContainer.add(btn);
        });


        // Exit button
        const exitBtn = createButton(-panelWidth / 2 + 72.5, -panelHeight / 2 + 35, "Exit", () => this.scene.start("MainMenuScene"));
        this.leaderboardContainer.add(exitBtn);


        // Dashboard Arrow

        // for local testing, use localhost. For deployed version, use the production api url
        const isLocalDash = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        const dashApiBase = isLocalDash ? "http://localhost:8000" : "https://accounting-game.cse.eng.auburn.edu/api";

        let userRole = null;
        try {
            const response = await fetch(`${dashApiBase}/fetch-user`);
            userRole = await response.json().then(data => data.role);
        } catch (err) {
            // don't let a failed fetch here (e.g. no local session, network
            // issue) block the rest of scene setup below - just skip the
            // dashboard arrow
            console.error("Failed to fetch user role for dashboard arrow", err);
        }

        console.log("User role fetched from server:", userRole);

        // check type of user (admin, professor, other)
        let dashTarget = userRole === "admin" ? "AdminDash" :
                           userRole === "professor" ? "ProfessorDash" :
                           null;

        console.log("Dashboard target determined:", dashTarget);
        // if admin/prof, draw arrow to correct dashboard
        if (dashTarget) {
            console.log("Drawing dashboard button for role:", userRole);
            const width = 95;
            const height = 40;
            
            const dashRect = this.add.rectangle(0, 0, width, height, 0x7f1a02).setStrokeStyle(3, 0xdcc89f);
            const dashArrow = this.add.text(0, 0, "→", {
                fontSize: "32px",
                fontFamily: '"Jersey 10", sans-serif',
                color: "#dcc89f",
                stroke: "#dcc89f",
                align: "center",
                strokeThickness: 2,
            }).setOrigin(0.5);

            const dashButton = this.add.container(0, 0, [dashRect, dashArrow]);

            console.log("dashButton created", dashButton);
            dashButton.setDepth(9999);
            dashButton.setAlpha(1);
            dashButton.setVisible(true);

            this.leaderboardContainer.add(dashButton);

            // position x and y
            dashButton.x = this.scale.width / 2 - 55;
            dashButton.y = 0;

            dashRect.setInteractive({ useHandCursor: true });
            
            dashRect.on("pointerover", () => {
                dashRect.setFillStyle(0xa8321a);
                this.tweens.add({ targets: dashButton, scale: 1.05, duration: 150, ease: "Power1" });
            });
            dashRect.on("pointerout", () => {
                dashRect.setFillStyle(0x7f1a02);
                this.tweens.add({ targets: dashButton, scale: 1, duration: 150, ease: "Power1" });
            });
            dashRect.on("pointerdown", () => {
                if ((this.game.sfxVolume ?? this.sound.volume) > 0) this.sound.play("selection");
                const tween = this.tweens.add({
                    targets: dashButton,
                    scale: 0.9,
                    duration: 80,
                    yoyo: true,
                    ease: "Power1",
                });
                tween.once("complete", () => this.scene.start(dashTarget));
            });
        }
        

        // --- Scrollable Area Setup ---
        const maskTopY_Rel = -panelHeight / 2 + 80;
        this.maskVisibleHeight = panelHeight - 220;
        this.relMaskTopY = maskTopY_Rel;

        this.tableGroup = this.add.container(0, maskTopY_Rel);
        this.leaderboardContainer.add(this.tableGroup);

        // --- (FIXED) Global Masking ---
        const maskGraphics = this.make.graphics();
        maskGraphics.fillStyle(0xffffff);
        maskGraphics.fillRect(
            panelX - panelWidth / 2 + 40,
            panelY + maskTopY_Rel + verticalOffset, 
            panelWidth - 80,
            this.maskVisibleHeight
        );
        this.tableGroup.setMask(maskGraphics.createGeometryMask());

        // --- Scrollbar (Relative to container) ---
        const scrollX = panelWidth / 2 - 8;
        const trackMargin = 10;
        this.scrollTrack = this.add.rectangle(scrollX, maskTopY_Rel + this.maskVisibleHeight/2, 6, this.maskVisibleHeight, 0x3d0c02);
        this.scrollThumb = this.add.rectangle(scrollX, maskTopY_Rel + trackMargin, 6, 60, 0xdcc89f).setOrigin(0.5, 0);
        this.leaderboardContainer.add([this.scrollTrack, this.scrollThumb]);

        // Dragging logic
        this.scrollThumb.setInteractive({ draggable: true, useHandCursor: true });
        this.input.setDraggable(this.scrollThumb);
        this.scrollThumb.on("drag", (pointer, dragX, dragY) => {
            const trackTop = this.relMaskTopY + trackMargin;
            const trackBottom = this.relMaskTopY + this.maskVisibleHeight - this.scrollThumb.height - trackMargin;
            dragY = Phaser.Math.Clamp(dragY, trackTop, trackBottom);
            this.scrollThumb.y = dragY;

            const overflow = Math.max(0, this.contentHeight - this.maskVisibleHeight);
            const scrollRatio = (dragY - trackTop) / (trackBottom - trackTop);
            this.scrollY = -scrollRatio * overflow;
            this.tableGroup.y = this.relMaskTopY + this.scrollY;
        });

        // Wheel logic
        this.scrollY = 0;
        this.input.on("wheel", (_, __, ___, deltaY) => {
            this.scrollY -= deltaY * 0.25;
            this.updateScroll(this.maskVisibleHeight, this.relMaskTopY);
        });

        this.loadLeaderboard(this.gameKey);
        this.leaderboardContainer.setScale(0.95);
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on("down", () => this.scene.start("MainMenuScene"));
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

    updateScroll(maskVisibleHeight, maskTopY) {
        const overflow = Math.max(0, this.contentHeight - maskVisibleHeight);
        const trackMargin = 10;

        if (overflow <= 0) {
            this.scrollY = 0;
            this.scrollThumb.setVisible(false);
            this.tableGroup.y = maskTopY;
            return;
        }

        this.scrollThumb.setVisible(true);
        const minY = -overflow;
        const maxY = 0;
        this.scrollY = Phaser.Math.Clamp(this.scrollY, minY, maxY);
        this.tableGroup.y = maskTopY + this.scrollY;

        const scrollRatio = -this.scrollY / overflow;
        const trackTop = maskTopY + trackMargin;
        const trackHeight = maskVisibleHeight - this.scrollThumb.height - trackMargin * 2;
        this.scrollThumb.y = trackTop + scrollRatio * trackHeight;
    }

    updateTabs() {
        Object.entries(this.tabs).forEach(([key, tab]) => {
            tab.draw(key === this.scoreScope ? 0xa8321a : 0x7f1a02);
            tab.setDepth(key === this.scoreScope ? 5 : 4);
        });
    }

    async loadLeaderboard(mode) {
        // --- FIX 1: Safety check before calling removeAll ---
        if (this.tableGroup) {
            this.tableGroup.removeAll(true);
        } else {
            // If it doesn't exist, create it so the rest of the function doesn't fail
            this.tableGroup = this.add.container(0, 0); 
        }

        try {
            const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
            const apiBase = isLocal 
                ? "http://localhost:8000" 
                : "https://accounting-game.cse.eng.auburn.edu/api";

            const userResponse = await fetch(`${apiBase}/fetch-user`);
            const userData = await userResponse.json();
            const userSection = userData.sections;

            let url = `${apiBase}/leaderboard/${mode}`;
        
            if (this.scoreScope === "section") {
            if (!userSection || userSection === "default" || userSection === null || userSection === "unknown") {
                console.log("User section is invalid:", userSection);
                this.tableGroup.removeAll(true);
                const msg = this.add.text(0, 20, 
                    "Please enroll in ACCT 2110 or ACCT 5110\nto see section leaderboard", {
                        fontSize: "22px",
                        fill: "#dcc89f",
                        fontFamily: '"Jersey 10", sans-serif',
                        align: "center",
                    }).setOrigin(0.5, 0);
                this.tableGroup.add(msg);
                this.contentHeight = 60;
                this.scrollY = 0;
             this.updateScroll(this.maskVisibleHeight, this.relMaskTopY);
                return;
            }
                url += `?section=${userSection}`;
        }

            const res = await fetch(url);
            if (!res.ok) throw new Error(`Server returned ${res.status}`);

            const data = await res.json();

            data.sort((a, b) => b.score - a.score);

            const rankX = -200, nameX = -30, scoreX = 170;
            const style = { fontSize: "24px", fill: "#dcc89f", fontFamily: '"Jersey 10", sans-serif' };

            this.tableGroup.add([
                this.add.text(rankX, 0, "Rank", style),
                this.add.text(nameX, 0, "Name", style),
                this.add.text(scoreX, 0, "Score", style)
            ]);

            let y = 40;
            data.forEach((entry, i) => {
                const color = (this.highlightName && entry.username === this.highlightName) ? "#570600" : "#dcc89f";
                const rowStyle = { ...style, fontSize: "22px", fill: color };

                // --- FIX: Format username as 3-letter initials ---
                const initials = entry.username.substring(0, 3).toUpperCase();

                this.tableGroup.add([
                    this.add.text(rankX, y, `${i + 1}.`, rowStyle),
                    this.add.text(nameX, y, initials, rowStyle),
                    this.add.text(scoreX, y, entry.score.toString(), rowStyle)
                ]);
                y += 28;
            });

            this.contentHeight = y;
            this.scrollY = 0;
            this.updateScroll(this.maskVisibleHeight, this.relMaskTopY);

        } catch (err) {
            console.error(err);
            const msg = this.add.text(0, 20, "Error loading leaderboard", {
                fontSize: "20px",
                fill: "#ff4444",
                fontFamily: '"Jersey 10", sans-serif',
            }).setOrigin(0.5, 0);
            
            this.tableGroup.add(msg);
            this.contentHeight = 40;
            this.scrollY = 0;
            
            // --- FIX 2: Use the 'this.' prefix for these variables ---
            this.updateScroll(this.maskVisibleHeight, this.relMaskTopY);
        }
    }
}

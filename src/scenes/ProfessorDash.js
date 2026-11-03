import { Scene } from "phaser";

export default class ProfessorDash extends Scene {
    constructor() {
        super("ProfessorDash");
        this.statsContainer = null;
        this.dropdownOptions = null;
        this.isDropdownOpen = false;
        this.currentSection = null;
    }

    create() {
        // Background - Keeping your 0x1a1a1a
        this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x1a1a1a).setOrigin(0);

        this.title = this.add.text(this.scale.width / 2, 50, "Professor Dashboard", {
            fontSize: "42px", fontFamily: '"Jersey 10", sans-serif', color: "#dcc89f"
        }).setOrigin(0.5);

        // --- DYNAMIC DROPDOWN ---
        this.createDropdown(this.scale.width / 2, 110);

        // --- DOWNLOAD CSV BUTTON (Always visible at top right when data is loaded) ---
        this.downloadBtn = this.createTabButton(this.scale.width - 100, 110, "CSV", () => {
            if (this.currentSection) {
                window.open(`https://accounting-game.cse.eng.auburn.edu/api/stats/section/${this.currentSection}/csv`, "_blank");
            }
        }).setVisible(false);

        // Return Button (Bottom)
        this.createTabButton(this.scale.width / 2, this.scale.height - 50, "Return to Student View", () => {
            this.scene.start("MainMenuScene");
        });
    }

    createDropdown(x, y) {
        this.dropdownMain = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, 300, 40, 0x333333).setInteractive({ useHandCursor: true });
        const txt = this.add.text(0, 0, "Select Your Section ▼", {
            fontSize: "20px", fontFamily: '"Jersey 10", sans-serif', color: "#dcc89f"
        }).setOrigin(0.5);

        this.dropdownMain.add([bg, txt]);
        bg.on("pointerdown", () => this.toggleDropdown());

        this.dropdownOptions = this.add.container(x, y + 40).setVisible(false).setDepth(100);
    }

    async toggleDropdown() {
        this.isDropdownOpen = !this.isDropdownOpen;
        this.dropdownOptions.setVisible(this.isDropdownOpen);

        if (this.isDropdownOpen) {
            this.dropdownOptions.removeAll(true);

            // 1. Get sections from localStorage (Match your LoginScreen.js style)
            // Use the key you set in the parser, e.g., 'game_section'
            
            const response = await fetch("https://accounting-game.cse.eng.auburn.edu/api/fetch-user");
            const sectionString = await response.json().then(data => data.sections);

            let sections = sectionString.split(',');

            // 2. Build items (Logic remains the same)
            sections.forEach((id, i) => {
                const optBg = this.add.rectangle(0, i * 42, 300, 40, 0x222222).setInteractive({ useHandCursor: true });
                const optTxt = this.add.text(0, i * 42, `Section ${id}`, {
                    fontSize: "18px", fontFamily: '"Jersey 10", sans-serif', color: "#ffffff"
                }).setOrigin(0.5);

                optBg.on("pointerdown", () => {
                    this.loadSectionData(id);
                    this.toggleDropdown();
                });

                this.dropdownOptions.add([optBg, optTxt]);
            });
        }
    }

    async loadSectionData(sectionId) {
        this.currentSection = sectionId;
        
        if (this.statsContainer) {
            this.statsContainer.destroy();
            this.input.off('wheel'); 
        }

        const GAME_NAMES = { "game1": "Db. vs. Cr.", "game2": "Elements", "game3-1": "Balance", "game3-2": "Effects + NI", "game3-3": "Errors", "game3-4": "Effects" };
        this.statsContainer = this.add.container(this.scale.width / 2, 200);
        this.downloadBtn.setVisible(true);

        // --- THE "X" CLOSE BUTTON ---
        const closeBtn = this.add.text(350, -30, "X", {
            fontSize: "20px", backgroundColor: "#7b241c", padding: 5, color: "#ffffff"
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
          .on("pointerdown", () => {
              this.statsContainer.destroy();
              this.statsContainer = null;
              this.downloadBtn.setVisible(false);
              this.currentSection = null;
          });

        try {
            const response = await fetch(`https://accounting-game.cse.eng.auburn.edu/api/stats/section/${sectionId}`);
            const data = await response.json();

            const timeLookup = {};
            if (data.total_time_records) {
                data.total_time_records.forEach(record => {
                    timeLookup[`${record.user}_${record.game}`] = record.seconds;
                });
            }

            const title = this.add.text(0, -30, `Viewing Section: ${sectionId}`, {
                fontSize: "24px", color: "#dcc89f", fontFamily: '"Jersey 10", sans-serif'
            }).setOrigin(0.5);
            this.statsContainer.add(title);

            let yOffset = 20;
            data.student_breakdown.forEach((s) => {
                const gameName = GAME_NAMES[s.game] || s.game;
                const t = timeLookup[`${s.user}_${s.game}`] || 0;
                const row = `${s.name.padEnd(15)} | ${gameName.padEnd(12)} | Avg: ${s.avg.toFixed(0).padStart(4)} | T: ${String(s.top).padStart(4)} | B: ${String(s.bottom).padStart(4)} | Time: ${t}s`;
                this.statsContainer.add(this.add.text(0, yOffset, row, { fontFamily: "Courier", fontSize: "15px", color: "#ffffff" }).setOrigin(0.5));
                yOffset += 30;
            });

            
            this.setupScrolling(yOffset);
        } catch (e) {
            console.error("Fetch failed", e);
        }
    }

    setupScrolling(contentHeight) {
        const maskVisibleHeight = 300; 
        const maskY = 180;
        const startY = 200;

        const maskShape = this.make.graphics();
        maskShape.fillRect(this.scale.width / 2 - 375, maskY, 750, maskVisibleHeight);
        this.statsContainer.setMask(maskShape.createGeometryMask());

        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
            if (this.statsContainer) {
                this.statsContainer.y -= deltaY * 0.5; 
                const minScroll = startY - Math.max(0, contentHeight - 260);
                this.statsContainer.y = Phaser.Math.Clamp(this.statsContainer.y, minScroll, startY);
            }
        });
    }

    createTabButton(x, y, label, callback) {
        return this.add.text(x, y, label, {
            fontSize: "20px", fontFamily: '"Jersey 10", sans-serif',
            backgroundColor: "#7f1a02", padding: { x: 10, y: 5 }, color: "#dcc89f"
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on("pointerdown", callback);
    }
}

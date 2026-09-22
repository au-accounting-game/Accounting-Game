import { Scene } from "phaser";

export default class AdminDash extends Scene {
    constructor() {
        super("AdminDash");
        this.statsContainer = null;
        this.dropdownOptions = null;
        this.isDropdownOpen = false;
        this.currentEndpoint = null;
    }

    create() {
        // for local testing, use localhost. For deployed version, use the production api url
        const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        this.apiBase = isLocal ? "http://localhost:8000" : "https://accounting-game.cse.eng.auburn.edu/api";

        this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x550000).setOrigin(0);

        this.add.text(this.scale.width / 2, 40, "ADMIN", {
            fontSize: "48px", fontFamily: '"Jersey 10", sans-serif', color: "#dcc89f"
        }).setOrigin(0.5);

        // --- THE DROPDOWN MENU ---
        this.createDropdown(this.scale.width / 2, 100);

        this.downloadBtn = this.createSmallBtn(this.scale.width - 80, 100, "CSV", () => {
            if (this.currentEndpoint) {
                window.open(`${this.apiBase}${this.currentEndpoint}/csv`, "_blank");
            } else {
                alert("Please select a view first to download data.");
            }
        }).setVisible(false); // Only show when data is loaded

        // --- RETURN BUTTON (Bottom) ---
        this.createSmallBtn(this.scale.width / 2, this.scale.height - 40, "Return to Student View", () => {
            this.scene.start("MainMenuScene");
        });
    }

    createDropdown(x, y) {
        // Main button
        this.dropdownMain = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, 300, 40, 0x333333).setInteractive({ useHandCursor: true });
        const txt = this.add.text(0, 0, "Select Session / View ▼", {
            fontSize: "20px", fontFamily: '"Jersey 10", sans-serif', color: "#dcc89f"
        }).setOrigin(0.5);
        this.dropdownMain.add([bg, txt]);

        bg.on("pointerdown", () => this.toggleDropdown());

        // Options container (Hidden by default)
        this.dropdownOptions = this.add.container(x, y + 40).setVisible(false).setDepth(100);
    }

    async toggleDropdown() {
        this.isDropdownOpen = !this.isDropdownOpen;
        this.dropdownOptions.setVisible(this.isDropdownOpen);

        if (this.isDropdownOpen) {
            this.dropdownOptions.removeAll(true);
            
            try {
                // 1. Fetch the dynamic list of sections from your new API
                const res = await fetch(`${this.apiBase}/stats/sections/list`);
                const dynamicSections = await res.json(); // Expected: ["001", "002", "003", "004"...]

                // 2. Build the menu items array
                const menuItems = [];

                // Add the Dynamic Sections first
                dynamicSections.forEach(secId => {
                    menuItems.push({
                        label: `Section ${secId}`,
                        action: () => this.loadData(`/stats/section/${secId}`, `Section ${secId}`, "section")
                    });
                });

                // Add the Static Global Views
                menuItems.push({ label: "Global Tops", action: () => this.loadData('/stats/admin/global-tops', "Global Rankings", "global") });
                menuItems.push({ label: "All Students", action: () => this.loadData('/stats/admin/all-students', "Complete Roster", "all") });
                
                // Add the Danger Zone
                menuItems.push({ label: "Clear All Data", action: () => this.showClearConfirm(), color: "#ff4444" });

                // 3. Render the list
                menuItems.forEach((opt, i) => {
                    const optBg = this.add.rectangle(0, i * 42, 300, 40, 0x222222).setInteractive({ useHandCursor: true });
                    const optTxt = this.add.text(0, i * 42, opt.label, {
                        fontSize: "18px", fontFamily: '"Jersey 10", sans-serif', color: opt.color || "#ffffff"
                    }).setOrigin(0.5);

                    optBg.on("pointerdown", () => {
                        opt.action();
                        this.toggleDropdown();
                    });

                    this.dropdownOptions.add([optBg, optTxt]);
                });

                // Adjust the dropdown background height if the list is long
                // (Optional: add a scroll mask if you end up with 20+ sections)

            } catch (err) {
                console.error("Failed to fetch dynamic sections", err);
            }
        }
    }
    


    async loadData(endpoint, titleLabel, type) {
        if (this.statsContainer) {
            this.statsContainer.destroy();
            this.input.off('wheel'); 
        }

        // game names for the 5 games, coming from spreadsheet
        const GAME_NAMES = {
            "game1":   "Db. vs. Cr.",
            "game2":   "Elements",
            "game3-1": "Balance",
            "game3-2": "Effects",
            "game3-3": "Errors",
        };

        // Move the container slightly lower so the Title (at -60) stays within the mask
        this.statsContainer = this.add.container(this.scale.width / 2, 220);

        this.downloadBtn.setVisible(true);

        // --- NEW: THE "X" CLOSE BUTTON ---
        const closeBtn = this.add.text(350, -80, "X", {
            fontSize: "24px", backgroundColor: "#7b241c", padding: 5, color: "#ffffff"
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
          .on("pointerdown", () => {
              this.statsContainer.destroy();
              this.statsContainer = null;
              this.downloadBtn.setVisible(false);
          });
        this.statsContainer.add(closeBtn);

        this.currentEndpoint = endpoint;

        try {
            const response = await fetch(`${this.apiBase}${endpoint}`);
            const data = await response.json();

            const timeLookup = {};
            if (data.total_time_records) {
                data.total_time_records.forEach(record => {
                    timeLookup[`${record.user}_${record.game}`] = record.seconds;
                });
            }

            let yOffset = 0;
            const rowSpacing = 30;

            // Title is now at -60 relative to container Y (220), putting it at screen Y=160
            const header = this.add.text(0, -60, `--- ${titleLabel} ---`, { 
                fontSize: "24px", color: "#dcc89f", fontFamily: '"Jersey 10", sans-serif' 
            }).setOrigin(0.5);
            this.statsContainer.add(header);

            // 2. DATA RENDERING
            if (type === "global") {
                data.forEach(item => {
                    const gameName = GAME_NAMES[item.game] || item.game;
                    const row = `${gameName.padEnd(12)} | ${item.score.toString().padStart(5)} | ${item.student.padEnd(15)} (Sec ${item.section})`;
                    this.statsContainer.add(this.add.text(0, yOffset, row, { fontFamily: "Courier", fontSize: "16px", color: "#ffffff" }).setOrigin(0.5));
                    yOffset += rowSpacing;
                });
            } else if (type === "all") {
                // Fix: 'all-students' returns a direct list [], not a dictionary
                data.forEach(s => {

                    const gameName = GAME_NAMES[s.game] || s.game;
                    const row = `S${s.section} | ${s.name.padEnd(12)} | ${gameName.padEnd(12)} | Avg: ${s.avg.toFixed(0)} | T: ${s.top} | Time Played: ${s.total_time || 0}s`;
                    this.statsContainer.add(this.add.text(0, yOffset, row, { fontFamily: "Courier", fontSize: "14px", color: "#ffffff" }).setOrigin(0.5));

                    yOffset += rowSpacing;
                });
            } else {
                // Section view uses .student_breakdown
                data.student_breakdown.forEach(s => {

                    const gameName = GAME_NAMES[s.game] || s.game;
                    const t = timeLookup[`${s.user}_${s.game}`] || 0;
                    const row = `${s.name.padEnd(15)} | ${gameName.padEnd(8)} | Avg: ${s.avg.toFixed(0)} | T: ${s.top} | B: ${s.bottom} | Time Played: ${t}s`;

                    this.statsContainer.add(this.add.text(0, yOffset, row, { fontFamily: "Courier", fontSize: "15px", color: "#ffffff" }).setOrigin(0.5));
                    yOffset += rowSpacing;
                });
            }

            this.setupScrolling(yOffset);

            if (this.downloadBtn) this.downloadBtn.destroy();
            this.downloadBtn = this.createSmallBtn(this.scale.width - 80, 100, "CSV", () => {
                window.open(`${this.apiBase}${endpoint}/csv`, "_blank");
            });

        } catch (e) {
            console.error("Admin fetch failed", e);
        }
    }

    setupScrolling(contentHeight) {
        const maskVisibleHeight = 350; // Increased height
        const maskY = 150; // Started higher to include the title
        const startY = 220;

        const maskShape = this.make.graphics();
        // Mask covers area from Y=150 to Y=450
        maskShape.fillRect(this.scale.width / 2 - 500, maskY, 1000, maskVisibleHeight);
        this.statsContainer.setMask(maskShape.createGeometryMask());

        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            if (this.statsContainer) {
                this.statsContainer.y -= deltaY * 0.5; 
                const minScroll = startY - Math.max(0, contentHeight - (maskVisibleHeight - 60));
                this.statsContainer.y = Phaser.Math.Clamp(this.statsContainer.y, minScroll, startY);
            }
        });
    }

    createSmallBtn(x, y, label, callback) {
        return this.add.text(x, y, label, {
		fontSize: "18px", fontFamily: '"Jersey 10", sans-serif', color: "#dcc89f", backgroundColor: "#7f1a02", padding: { x: 8, y: 4 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on("pointerdown", callback);
    }
  
    showClearConfirm() {
    const overlay = this.add.rectangle(
        this.scale.width / 2, this.scale.height / 2,
        this.scale.width, this.scale.height,
        0x000000, 0.7
    ).setDepth(10);

    const box = this.add.rectangle(
        this.scale.width / 2, this.scale.height / 2,
        500, 300, 0x1a1a2e
    ).setDepth(11).setStrokeStyle(2, 0xdcc89f);

    const title = this.add.text(
        this.scale.width / 2, this.scale.height / 2 - 100,
        "⚠ Clear All Data?", {
            fontSize: "28px", fontFamily: '"Jersey 10", sans-serif', color: "#ff4444"
        }
    ).setOrigin(0.5).setDepth(12);

    const msg = this.add.text(
        this.scale.width / 2, this.scale.height / 2 - 50,
        "This will permanently delete all\nstudent profiles and game analytics.\nThis cannot be undone.", {
            fontSize: "16px", fontFamily: '"Jersey 10", sans-serif',
            color: "#ffffff", align: "center"
        }
    ).setOrigin(0.5).setDepth(12);

    const downloadBtn = this.add.text(
        this.scale.width / 2, this.scale.height / 2 + 20,
        "Download Statistics First", {
            fontSize: "18px", fontFamily: '"Jersey 10", sans-serif',
            backgroundColor: "#1a5276", padding: 8, color: "#dcc89f"
        }
    ).setOrigin(0.5).setDepth(12).setInteractive({ useHandCursor: true })
    .on("pointerdown", () => {
        window.open(`${this.apiBase}/stats/admin/all-students/csv`, "_blank");
    });

    const cancelBtn = this.add.text(
        this.scale.width / 2 - 100, this.scale.height / 2 + 80,
        "Cancel", {
            fontSize: "18px", fontFamily: '"Jersey 10", sans-serif',
            backgroundColor: "#333", padding: 8, color: "#dcc89f"
        }
    ).setOrigin(0.5).setDepth(12).setInteractive({ useHandCursor: true })
    .on("pointerdown", () => {
        [overlay, box, title, msg, downloadBtn, cancelBtn, confirmBtn].forEach(o => o.destroy());
    });

    const confirmBtn = this.add.text(
        this.scale.width / 2 + 100, this.scale.height / 2 + 80,
        "Confirm Delete", {
            fontSize: "18px", fontFamily: '"Jersey 10", sans-serif',
            backgroundColor: "#7b241c", padding: 8, color: "#ffffff"
        }
    ).setOrigin(0.5).setDepth(12).setInteractive({ useHandCursor: true })
    .on("pointerdown", () => {
        [overlay, box, title, msg, downloadBtn, cancelBtn, confirmBtn].forEach(o => o.destroy());
        this.clearAllData();
    });
}

async clearAllData() {
    try {
        // for local testing, use localhost. For deployed version, use the production api url
        const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        const apiBase = isLocal ? "http://localhost:8000" : "https://accounting-game.cse.eng.auburn.edu/api";
        const response = await fetch(
            `${apiBase}/admin/clear-data`,
            { method: "DELETE" }
        );
        
        const result = await response.json();
        if (result.status === "success") {
            const msg = this.add.text(
                this.scale.width / 2, this.scale.height / 2,
                "✓ Data cleared successfully", {
                    fontSize: "24px", fontFamily: '"Jersey 10", sans-serif',
                    color: "#00ff00", backgroundColor: "#1a1a2e", padding: 12
                }
            ).setOrigin(0.5).setDepth(13);
            this.time.delayedCall(2000, () => msg.destroy());
            if (this.statsContainer) {
                this.statsContainer.destroy();
                this.statsContainer = null;
            }
        }
    } catch (e) {
        console.error("Clear data failed", e);
        const msg = this.add.text(
            this.scale.width / 2, this.scale.height / 2,
            "✗ Failed to clear data", {
                fontSize: "24px", fontFamily: '"Jersey 10", sans-serif',
                color: "#ff4444", backgroundColor: "#1a1a2e", padding: 12
            }
        ).setOrigin(0.5).setDepth(13);
        this.time.delayedCall(2000, () => msg.destroy());
    }
}
}

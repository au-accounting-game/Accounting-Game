import { Scene } from "phaser";

export default class AdminDash extends Scene {
    constructor() {
        super("AdminDash");
        this.statsContainer = null;
        this.dropdownOptions = null;
        this.isDropdownOpen = false;

        // shared search/sort table state (used by every dropdown view)
        this.currentTableConfig = null;
        this.rowsGroup = null;
        this.statsHeaderText = null;
        this.searchInputEl = null;
        this.searchQuery = "";
        this.sortKey = "name";
        this.sortDir = 1; // 1 = ascending, -1 = descending
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
            if (this.currentTableConfig) {
                this.exportCurrentTableToCsv();
            } else {
                alert("Please select a view first to download data.");
            }
        }).setVisible(false); // Only show when data is loaded

        // --- FOOTER (Bottom) - separated from the scrollable data area by a
        // border, and kept on top of it via depth, so scrolled rows can
        // never visually run into/under the Return button
        const footerY = this.scale.height - 55;
        this.add.rectangle(this.scale.width / 2, footerY, this.scale.width, 1, 0xdcc89f, 0.4).setDepth(30);

        this.createSmallBtn(this.scale.width / 2, this.scale.height - 25, "Return to Student View", () => {
            this.scene.start("MainMenuScene");
        }).setDepth(30);
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
        if (this.searchInputEl) {
            this.searchInputEl.destroy();
            this.searchInputEl = null;
        }
        this.currentTableConfig = null;
        this.rowsGroup = null;
        this.searchQuery = "";
        this.sortKey = null;
        this.sortDir = 1;

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
              if (this.searchInputEl) {
                  this.searchInputEl.destroy();
                  this.searchInputEl = null;
              }
          });
        this.statsContainer.add(closeBtn);

        try {
            const response = await fetch(`${this.apiBase}${endpoint}`);
            const data = await response.json();

            const timeLookup = {};
            if (data.total_time_records) {
                data.total_time_records.forEach(record => {
                    timeLookup[`${record.user}_${record.game}`] = record.seconds;
                });
            }

            // Title is now at -60 relative to container Y (220), putting it at screen Y=160
            this.statsHeaderText = this.add.text(0, -60, `--- ${titleLabel} ---`, {
                fontSize: "24px", color: "#dcc89f", fontFamily: '"Jersey 10", sans-serif'
            }).setOrigin(0.5);
            this.statsContainer.add(this.statsHeaderText);

            // 2. DATA RENDERING - every view shares one searchable/sortable table
            if (type === "global") {
                this.currentTableConfig = this.buildGlobalTableConfig(data, titleLabel, GAME_NAMES);
            } else if (type === "all") {
                this.currentTableConfig = this.buildAllStudentsTableConfig(data, titleLabel, GAME_NAMES);
            } else {
                this.currentTableConfig = this.buildSectionTableConfig(data, titleLabel, GAME_NAMES, timeLookup);
            }
            this.createSearchBox(this.currentTableConfig.searchPlaceholder, () => this.renderCurrentTable());
            this.renderCurrentTable();

            if (this.downloadBtn) this.downloadBtn.destroy();
            this.downloadBtn = this.createSmallBtn(this.scale.width - 80, 100, "CSV", () => {
                this.exportCurrentTableToCsv();
            });

        } catch (e) {
            console.error("Admin fetch failed", e);
        }
    }

    createSearchBox(placeholder, onInput) {
        const input = this.add.dom(150, 100, "input", {
            type: "text",
            fontSize: "16px",
            width: "180px",
        });
        input.setDepth(50);
        input.node.placeholder = placeholder;
        input.node.style.background = "#eadbb7";
        input.node.style.border = "3px solid #7f1a02";
        input.node.style.borderRadius = "8px";
        input.node.style.color = "#6b2a12";
        input.node.style.fontFamily = '"Jersey 10", sans-serif';
        input.node.style.padding = "4px 8px";

        const el = input.node;
        ["keydown", "keyup", "keypress"].forEach(evt =>
            el.addEventListener(evt, e => e.stopPropagation(), { capture: true })
        );
        el.addEventListener("input", () => {
            this.searchQuery = el.value || "";
            onInput();
        });

        this.searchInputEl = input;
    }

    // shared helper: string truncation with ellipsis for column values
    truncateText(str, max) {
        return (str && str.length > max) ? str.slice(0, max - 1) + "…" : (str || "");
    }

    buildAllStudentsTableConfig(data, titleLabel, GAME_NAMES) {
        const truncate = this.truncateText.bind(this);
        return {
            titleLabel,
            rawData: data,
            searchPlaceholder: "Search name or section...",
            emptyMessage: "No students match your search.",
            matchesSearch: (s, q) =>
                (s.name || "").toLowerCase().includes(q) || String(s.section).toLowerCase().includes(q),
            groupKey: s => `${s.name}|${s.section}`,
            // widths sized for the longest realistic value per column
            // (section codes like "2026F_ACCT2110_001" are the long pole),
            // laid out to span evenly around x=0 so the table reads centered
            columns: [
                { key: "section", label: "Section", x: -375, width: 180, isGroupLabel: true, get: s => truncate(String(s.section), 20), sortValue: s => String(s.section).toLowerCase() },
                { key: "name",    label: "Name",    x: -195, width: 150, isGroupLabel: true, get: s => truncate(s.name, 17), sortValue: s => (s.name || "").toLowerCase() },
                { key: "game",    label: "Game",    x: -45,  width: 110, get: s => GAME_NAMES[s.game] || s.game, sortValue: s => (GAME_NAMES[s.game] || s.game).toLowerCase() },
                { key: "rounds",  label: "Rounds",  x: 65,   width: 70,  get: s => String(s.rounds), sortValue: s => s.rounds },
                { key: "avg",     label: "Avg",     x: 135,  width: 70,  get: s => s.avg.toFixed(0), sortValue: s => s.avg },
                { key: "top",     label: "Top",     x: 205,  width: 70,  get: s => String(s.top), sortValue: s => s.top },
                { key: "time",    label: "Time",    x: 275,  width: 100, get: s => `${s.total_time || 0}s`, sortValue: s => s.total_time || 0 },
            ],
        };
    }

    buildGlobalTableConfig(data, titleLabel, GAME_NAMES) {
        const truncate = this.truncateText.bind(this);
        return {
            titleLabel,
            rawData: data,
            searchPlaceholder: "Search student, game, or section...",
            emptyMessage: "No results match your search.",
            matchesSearch: (item, q) =>
                (item.student || "").toLowerCase().includes(q) ||
                String(item.section).toLowerCase().includes(q) ||
                (GAME_NAMES[item.game] || item.game).toLowerCase().includes(q),
            groupKey: null, // already one row per game - no student grouping to do
            columns: [
                { key: "game",    label: "Game",    x: -300, width: 140, get: item => GAME_NAMES[item.game] || item.game, sortValue: item => (GAME_NAMES[item.game] || item.game).toLowerCase() },
                { key: "score",   label: "Score",   x: -160, width: 90,  get: item => String(item.score), sortValue: item => item.score },
                { key: "student", label: "Student", x: -70,  width: 170, get: item => truncate(item.student, 19), sortValue: item => (item.student || "").toLowerCase() },
                { key: "section", label: "Section", x: 100,  width: 200, get: item => truncate(String(item.section), 20), sortValue: item => String(item.section).toLowerCase() },
            ],
        };
    }

    buildSectionTableConfig(data, titleLabel, GAME_NAMES, timeLookup) {
        const truncate = this.truncateText.bind(this);
        return {
            titleLabel,
            rawData: data.student_breakdown,
            searchPlaceholder: "Search name...",
            emptyMessage: "No students match your search.",
            matchesSearch: (s, q) => (s.name || "").toLowerCase().includes(q),
            groupKey: s => `${s.name}|${s.user}`,
            columns: [
                { key: "name",   label: "Name",   x: -365, width: 170, isGroupLabel: true, get: s => truncate(s.name, 19), sortValue: s => (s.name || "").toLowerCase() },
                { key: "game",   label: "Game",   x: -195, width: 110, get: s => GAME_NAMES[s.game] || s.game, sortValue: s => (GAME_NAMES[s.game] || s.game).toLowerCase() },
                { key: "rounds", label: "Rounds", x: -85,  width: 70,  get: s => String(s.rounds), sortValue: s => s.rounds },
                { key: "avg",    label: "Avg",    x: -15,  width: 70,  get: s => s.avg.toFixed(0), sortValue: s => s.avg },
                { key: "top",    label: "Top",    x: 55,   width: 60,  get: s => String(s.top), sortValue: s => s.top },
                { key: "bottom", label: "Bottom", x: 115,  width: 70,  get: s => String(s.bottom), sortValue: s => s.bottom },
                { key: "time",   label: "Time",   x: 185,  width: 110, get: s => `${timeLookup[`${s.user}_${s.game}`] || 0}s`, sortValue: s => timeLookup[`${s.user}_${s.game}`] || 0 },
            ],
        };
    }

    // resolves the active sort column for the given config, falling back to
    // (and correcting) this.sortKey if it doesn't apply to these columns -
    // switching from e.g. "All Students" to "Global Tops" would otherwise
    // leave sortKey pointing at a column that doesn't exist in the new view
    resolveSortColumn(columns) {
        if (!columns.some(c => c.key === this.sortKey)) {
            this.sortKey = columns[0].key;
            this.sortDir = 1;
        }
        return columns.find(c => c.key === this.sortKey);
    }

    // applies the current search query and sort to a config's rawData,
    // without mutating rawData itself - shared by rendering and CSV export
    // so both always show/export exactly the same rows in the same order
    getFilteredSortedRows(config) {
        const { rawData, columns, matchesSearch } = config;
        const q = this.searchQuery.trim().toLowerCase();
        const filtered = q ? rawData.filter(item => matchesSearch(item, q)) : rawData.slice();
        const sortCol = this.resolveSortColumn(columns);
        filtered.sort((a, b) => {
            const va = sortCol.sortValue(a);
            const vb = sortCol.sortValue(b);
            if (va < vb) return -1 * this.sortDir;
            if (va > vb) return 1 * this.sortDir;
            return 0;
        });
        return filtered;
    }

    exportCurrentTableToCsv() {
        const config = this.currentTableConfig;
        if (!config) return;

        const rows = this.getFilteredSortedRows(config);
        const csvEscape = (val) => {
            const s = String(val);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };

        const lines = [config.columns.map(c => csvEscape(c.label)).join(",")];
        rows.forEach(item => {
            lines.push(config.columns.map(c => csvEscape(c.get(item))).join(","));
        });

        const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${config.titleLabel.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    renderCurrentTable() {
        const config = this.currentTableConfig;
        if (!config) return;

        if (this.rowsGroup) {
            this.rowsGroup.destroy();
            this.rowsGroup = null;
        }

        const { titleLabel, rawData, columns, groupKey, emptyMessage } = config;
        const rowSpacing = 28;

        const tableLeft = columns[0].x;
        const lastCol = columns[columns.length - 1];
        const tableRight = lastCol.x + lastCol.width;
        const tableWidth = tableRight - tableLeft;
        const tableCenterX = (tableLeft + tableRight) / 2;

        const filtered = this.getFilteredSortedRows(config);

        this.rowsGroup = this.add.container(0, 0);
        this.statsContainer.add(this.rowsGroup);

        let yOffset = 0;

        // Header row - click a column to sort by it, click again to reverse
        columns.forEach(col => {
            const isActive = this.sortKey === col.key;
            const arrow = isActive ? (this.sortDir === 1 ? " ▲" : " ▼") : "";
            const headerText = this.add.text(col.x, yOffset, col.label + arrow, {
                fontFamily: "Courier", fontSize: "14px",
                color: isActive ? "#dcc89f" : "#a89572",
                fontStyle: "bold",
            }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

            headerText.on("pointerdown", () => {
                if (this.sortKey === col.key) {
                    this.sortDir *= -1;
                } else {
                    this.sortKey = col.key;
                    this.sortDir = 1;
                }
                this.renderCurrentTable();
            });

            this.rowsGroup.add(headerText);
        });
        yOffset += rowSpacing;

        // Data rows - shade by group (e.g. one student's whole block of
        // games) when the view defines a groupKey; otherwise just alternate
        // every row (e.g. Global Tops, which is already one row per game)
        let prevGroupKey = Symbol("initial");
        let groupIndex = -1;
        let autoCounter = 0;
        filtered.forEach(item => {
            const key = groupKey ? groupKey(item) : `__row_${autoCounter++}`;
            const isFirstInGroup = key !== prevGroupKey;
            if (isFirstInGroup) {
                groupIndex++;
                prevGroupKey = key;
            }
            if (groupIndex % 2 === 0) {
                const zebra = this.add.rectangle(tableCenterX, yOffset, tableWidth + 20, rowSpacing, 0xffffff, 0.06);
                this.rowsGroup.add(zebra);
            }
            columns.forEach(col => {
                // group-label columns (e.g. name/section) repeat on every
                // row for the same group - only show them once, on the
                // first row of that group
                const text = (col.isGroupLabel && !isFirstInGroup) ? "" : col.get(item);
                const cell = this.add.text(col.x, yOffset, text, {
                    fontFamily: "Courier", fontSize: "14px", color: "#ffffff",
                }).setOrigin(0, 0.5);
                this.rowsGroup.add(cell);
            });
            yOffset += rowSpacing;
        });

        if (filtered.length === 0) {
            const emptyMsg = this.add.text(tableCenterX, yOffset, emptyMessage, {
                fontFamily: "Courier", fontSize: "14px", color: "#dcc89f",
            }).setOrigin(0.5);
            this.rowsGroup.add(emptyMsg);
            yOffset += rowSpacing;
        }

        const countSuffix = this.searchQuery.trim()
            ? ` (${filtered.length} of ${rawData.length})`
            : ` (${rawData.length})`;
        if (this.statsHeaderText) {
            this.statsHeaderText.setText(`--- ${titleLabel}${countSuffix} ---`);
        }

        this.setupScrolling(yOffset);
        this.statsContainer.y = 220; // reset scroll to top on every filter/sort change
    }

    setupScrolling(contentHeight) {
        // stops well short of the footer border (at scale.height - 55 = 485)
        // so scrolled rows never crowd the Return button
        const maskVisibleHeight = 310;
        const maskY = 150; // Started higher to include the title
        const startY = 220;

        const maskShape = this.make.graphics();
        maskShape.fillRect(this.scale.width / 2 - 500, maskY, 1000, maskVisibleHeight);
        this.statsContainer.setMask(maskShape.createGeometryMask());

        // this can be called repeatedly (e.g. re-rendering rows on every
        // search keystroke), so clear any previous listener first or they'd
        // stack up and make scrolling increasingly erratic
        this.input.off('wheel');
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

import * as XLSX from "xlsx";
import BaseGM3Scene from "./BaseGM3Scene";
import { orderByRecency, markSeen } from "../gameobjects/QuestionHistory";

export default class GM3Level3 extends BaseGM3Scene {
    constructor() {
        super("GM3Level3", { title: "", level: 3, timeLimit: 90 });
        this.currentIndex = 0;
        this.questions = [];
        this._uiNodes = [];
        this.selectors = [];
        this.selections = { Asset: "NE", Liability: "NE", SE: "NE", NI: "NE" };
        this.score = 0; // show as POINTS: 0000
    }

    onTimeUp() {
        this._finishToGameOver("timeup");
    }

    _finishToGameOver(reason = "completed") {
        if (this.timerEvent) this.timerEvent.remove(false);

        // record which questions were actually shown this playthrough, so a
        // replay biases toward fresh ones instead of cycling the same handful
        if (this.apiBase && this.questions.length) {
            markSeen(this.apiBase, "hard", this.questions.slice(0, this.currentIndex + 1));
        }

        this.scene.start("GameOverScene", {
            score: this.score,
            mode: "GM3-Level3",
            reason,
            timeSpentPlaying: Math.floor((this.time.now - this.startTime) / 1000),
        });
    }

    async buildLevel() {
        this.sound.play("game3", {
            loop: true,
            volume: this.game.sfxVolume ?? 1,
        });

        const buf = this.cache.binary.get("excelData");
        if (!buf) return this._failAndBack("Excel file not found.");

        try {
            const wb = XLSX.read(buf, {
                type: "array",
                cellStyles: true,
                cellHTML: true,
            });
            const sheetName = wb.SheetNames.find(
                (n) => n.trim().toLowerCase() === "a=l+se - hard".toLowerCase()
            );
            if (!sheetName)
                return this._failAndBack("Sheet 'A=L+SE - Hard' not found.");
            const sh = wb.Sheets[sheetName];

            const normalizeCode = (cell) => {
                const raw = this._getCellText(cell);
                const t = (raw ?? "").toString().trim().toUpperCase();
                if (!t) return "NE";
                if (t === "O" || t.includes("OPPOSITE")) return "O";
                if (t === "NE" || t.includes("NO EFFECT") || t === "NONE")
                    return "NE";
                if (
                    t === "U" ||
                    t === "UP" ||
                    t === "INCREASE" ||
                    t === "INC" ||
                    t === "RISE"
                )
                    return "U";
                if (
                    /[+\uFF0B]/.test(t) ||
                    t.includes("PLUS") ||
                    t.includes("POSITIVE")
                )
                    return "U";
                if (
                    /[-\u2212\u2012\u2013\u2014\u2015]/.test(t) ||
                    t.includes("MINUS") ||
                    t.includes("NEGATIVE")
                )
                    return "O";
                return "NE";
            };

            const rows = [];
            let emptyStreak = 0;
            const MAX_SCAN_ROWS = 2000;

            for (let r = 4; r <= MAX_SCAN_ROWS; r++) {
                const qCell = sh[`G${r}`];
                const q = this._getCellText(qCell);

                const asset = normalizeCode(sh[`C${r}`]);
                const liab = normalizeCode(sh[`D${r}`]);
                const se = normalizeCode(sh[`E${r}`]);
                const ni = normalizeCode(sh[`F${r}`]);

                const rowAllBlank =
                    !q &&
                    asset === "NE" &&
                    liab === "NE" &&
                    se === "NE" &&
                    ni === "NE";
                if (rowAllBlank) {
                    emptyStreak++;
                    if (emptyStreak >= 10) break;
                    else continue;
                } else emptyStreak = 0;

                if (!q) continue;

                rows.push({
                    question: q,
                    correct: { Asset: asset, Liability: liab, SE: se, NI: ni },
                });
            }

            if (!rows.length)
                return this._failAndBack(
                    "No valid questions found in the sheet."
                );

            const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
            this.apiBase = isLocal ? "http://localhost:8000" : "https://accounting-game.cse.eng.auburn.edu/api";
            this.questions = await orderByRecency(rows, this.apiBase, "hard");
        } catch (e) {
            console.error("GM3Level3 excel parse error:", e);
            return this._failAndBack(
                "Unable to read questions from the sheet."
            );
        }

        const { width, height } = this.scale;

        this.add
            .image(width / 2, height / 2, "gm3_level1_bg")
            .setOrigin(0.5)
            .setDisplaySize(width, height)
            .setDepth(0);

        if (!this.scoreText) {
            this.scoreText = this.add
                .text(20, 2, "", {
                    fontSize: "40px",
                    color: "#dcc89f",
                    fontFamily: '"Jersey 10", sans-serif',
                })
                .setDepth(6)
                .setOrigin(0, 0)
                .setStroke("#7f1a02", 3);
        } else {
            this.scoreText
                .setPosition(20, 2)
                .setOrigin(0, 0)
                .setFontFamily('"Jersey 10", sans-serif')
                .setFontSize(40)
                .setColor("#dcc89f")
                .setStroke("#7f1a02", 3)
                .setDepth(6);
        }
        this._updateScoreUI();

        if (!this.timerText) {
            this.timerText = this.add
                .text(width - 20, 2, "", {
                    fontSize: "40px",
                    color: "#dcc89f",
                    fontFamily: '"Jersey 10", sans-serif',
                })
                .setDepth(6)
                .setOrigin(1, 0)
                .setStroke("#7f1a02", 3);
        } else {
            this.timerText
                .setPosition(width - 20, 2)
                .setOrigin(1, 0)
                .setFontFamily('"Jersey 10", sans-serif')
                .setFontSize(40)
                .setColor("#dcc89f")
                .setStroke("#7f1a02", 3)
                .setDepth(6);
        }
        if (typeof this.timeLeft !== "number") this.timeLeft = 90;
        this._updateTimerUI();

        const qWrapW = Math.min(560, Math.floor(width * 0.6));
        this.qText = this.add
            .text(width / 2, height * 0.26, "", {
                fontSize: "30px",
                color: "#7f1a02",
                fontFamily: '"Jersey 10", sans-serif',
                wordWrap: { width: qWrapW, useAdvanced: true },
                align: "center",
            })
            .setOrigin(0.5)
            .setDepth(6);

        this.plusTextAnchor = { x: width / 2, y: height * 0.51 };
        this.plusText = this.add
            .text(this.plusTextAnchor.x, this.plusTextAnchor.y, "+300", {
                fontSize: "48px",
                color: "#dcc89f",
                fontFamily: '"Jersey 10", sans-serif',
            })
            .setOrigin(0.5)
            .setDepth(15)
            .setStroke("#7f1a02", 3)
            .setAlpha(0);

        const brown = 0x7f1a02;
        const beige = 0xdcc89f;

        const leftX = width * 0.08;
        const EQ_Y = height * 0.57;
        const selY = Math.max(EQ_Y + 90, height * 0.72);

        const labelStyle = {
            fontFamily: '"Jersey 10", sans-serif',
            fontSize: "42px",
            color: "#dcc89f",
            stroke: "#7f1a02",
            strokeThickness: 4,
        };
        const symbolStyle = {
            fontFamily: '"Jersey 10", sans-serif',
            fontSize: "42px",
            color: "#dcc89f",
            stroke: "#7f1a02",
            strokeThickness: 3,
        };

        const lblAsset = this.add
            .text(leftX, EQ_Y, "Asset", labelStyle)
            .setOrigin(0, 0.5)
            .setDepth(6);
        const eq = this.add
            .text(lblAsset.x + lblAsset.width + 20, EQ_Y, "=", symbolStyle)
            .setOrigin(0, 0.5)
            .setDepth(6);
        const lblLiab = this.add
            .text(eq.x + 26, EQ_Y, "Liability", labelStyle)
            .setOrigin(0, 0.5)
            .setDepth(6);
        const plus = this.add
            .text(lblLiab.x + lblLiab.width + 14, EQ_Y, "+", symbolStyle)
            .setOrigin(0, 0.5)
            .setDepth(6);
        const lblSE = this.add
            .text(plus.x + 20, EQ_Y, "Stockholders Equity", labelStyle)
            .setOrigin(0, 0.5)
            .setDepth(6);
        const pipe = this.add
            .text(lblSE.x + lblSE.width + 36, EQ_Y, "|", symbolStyle)
            .setOrigin(0, 0.5)
            .setDepth(6);
        const lblNI = this.add
            .text(pipe.x + 22, EQ_Y, "Net Income", labelStyle)
            .setOrigin(0, 0.5)
            .setDepth(6);

        const boxW = 120,
            boxH = 52;
        const assetCenter = lblAsset.x + lblAsset.width / 2;
        const liabCenter = lblLiab.x + lblLiab.width / 2;
        const seCenter = lblSE.x + lblSE.width / 2;
        const niCenter = lblNI.x + lblNI.width / 2;

        const arrowBase = 42,
            arrowHeight = 28,
            ARROW_V_OFFSET = 14;
        const makeArrowPolygon = (base, heightPx, direction) => {
            const half = base / 2;
            return direction === "up"
                ? [-half, 0, half, 0, 0, -heightPx]
                : [-half, 0, half, 0, 0, heightPx];
        };

        // Canonical order for cycling and display
        const cycleValues = ["NE", "U", "O"];
        const nextOf = (cur) => {
            const i = cycleValues.indexOf(cur);
            return cycleValues[(i + 1) % cycleValues.length];
        };
        const prevOf = (cur) => {
            const i = cycleValues.indexOf(cur);
            return cycleValues[
                (i - 1 + cycleValues.length) % cycleValues.length
            ];
        };

        const makeSelector = (centerX, key) => {
            const container = this.add.container(centerX, selY).setDepth(6);
            const rect = this.add
                .rectangle(0, 0, boxW, boxH, beige, 1)
                .setStrokeStyle(3, brown)
                .setInteractive({ useHandCursor: true });
            container.add(rect);

            const valueText = this.add
                .text(0, 0, this.selections[key], {
                    fontFamily: '"Jersey 10", sans-serif',
                    fontSize: "30px",
                    color: "#7f1a02",
                    align: "center",
                })
                .setOrigin(0.5)
                .setDepth(7);
            container.add(valueText);

            const upPts = makeArrowPolygon(arrowBase, arrowHeight, "up");
            const dnPts = makeArrowPolygon(arrowBase, arrowHeight, "down");

            const upPoly = this.add
                .polygon(20, -boxH / 2 - 5 + ARROW_V_OFFSET, upPts, beige)
                .setStrokeStyle(3, brown)
                .setDepth(7)
                .setInteractive(
                    new Phaser.Geom.Polygon(upPts),
                    Phaser.Geom.Polygon.Contains
                );
            container.add(upPoly);

            const downPoly = this.add
                .polygon(20, boxH / 2 + 5 + ARROW_V_OFFSET, dnPts, beige)
                .setStrokeStyle(3, brown)
                .setDepth(7)
                .setInteractive(
                    new Phaser.Geom.Polygon(dnPts),
                    Phaser.Geom.Polygon.Contains
                );
            container.add(downPoly);

            upPoly.on("pointerover", () => upPoly.setFillStyle(0xefdcbc, 1));
            upPoly.on("pointerout", () => upPoly.setFillStyle(beige, 1));
            downPoly.on("pointerover", () =>
                downPoly.setFillStyle(0xefdcbc, 1)
            );
            downPoly.on("pointerout", () => downPoly.setFillStyle(beige, 1));

            const setValue = (val) => {
                this.selections[key] = val;
                valueText.setText(val);
                this.sound?.play?.("ui_click");
            };

            // Box click = always cycle forward NE -> U -> O
            rect.on("pointerover", () => rect.setFillStyle(0xefdcbc));
            rect.on("pointerout", () => rect.setFillStyle(beige));
            rect.on("pointerdown", () =>
                setValue(nextOf(this.selections[key]))
            );

            // UP arrow = previous in cycle (so NE -> O)
            upPoly.on("pointerdown", () =>
                setValue(prevOf(this.selections[key]))
            );

            // DOWN arrow = next in cycle (so NE -> U)
            downPoly.on("pointerdown", () =>
                setValue(nextOf(this.selections[key]))
            );

            return { container, rect, valueText, upPoly, downPoly, key };
        };

        this.selectors = [
            makeSelector(assetCenter, "Asset"),
            makeSelector(liabCenter, "Liability"),
            makeSelector(seCenter, "SE"),
            makeSelector(niCenter, "NI"),
        ];

        const nextY = selY + 100;
        const nextBtn = this.add
            .rectangle(width / 2, nextY, 180, 50, beige)
            .setStrokeStyle(4, brown)
            .setOrigin(0.5)
            .setDepth(9)
            .setInteractive({ useHandCursor: true });

        const nextTxt = this.add
            .text(width / 2, nextY, "Submit", {
                fontFamily: '"Jersey 10", sans-serif',
                fontSize: "36px",
                color: "#7f1a02",
            })
            .setOrigin(0.5)
            .setDepth(10);

        nextBtn
            .on("pointerover", () => nextBtn.setFillStyle(0xefdcbc))
            .on("pointerout", () => nextBtn.setFillStyle(beige))
            .on("pointerdown", () => this._onSubmit());

        this._uiNodes = [
            this.qText,
            this.timerText,
            this.scoreText,
            lblAsset,
            eq,
            lblLiab,
            plus,
            lblSE,
            pipe,
            lblNI,
            ...this.selectors.map((s) => s.container),
            nextBtn,
            nextTxt,
        ];
        this._setGameplayUIVisible(false);

        this.currentIndex = 0;
        this._showCurrent(false);
        this._showPreStartCard();
    }

    _showPreStartCard() {
        if (this.timerEvent) {
            this.timerEvent.remove(false);
            this.timerEvent = null;
        }
        this._uiNodes?.forEach((n) => n && n.setVisible(false));
        this.input.enabled = true;

        const { width, height } = this.scale;

        const overlay = this.add
            .rectangle(width / 2, height / 2, width, height, 0x000000, 0.25)
            .setDepth(998)
            .setInteractive()
            .setScrollFactor(0);

        const card = this.add
            .container(width / 2, height / 2)
            .setDepth(999)
            .setAlpha(0)
            .setScrollFactor(0);

        const panelW = Math.min(800, Math.floor(width * 0.88));
        const panelH = 280;
        const BEIGE = 0xf5deb3,
            BROWN = 0x7f1a02,
            ACCENT = 0xdcc89f;

        const g = this.add.graphics();
        g.lineStyle(6, BROWN, 1);
        g.fillStyle(BEIGE, 1);
        g.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 18);
        g.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 18);
        card.add(g);

        const message =
            "What is the effect on the financial statement elements?\nClick on up and down arrows or element boxes to indicate change (O=overstated, U=understated, NE=no effect).";
        const title = this.add
            .text(0, -40, message, {
                fontSize: "34px",
                color: "#7f1a02",
                fontFamily: '"Jersey 10", sans-serif',
                align: "center",
                lineSpacing: 6,
                wordWrap: { width: panelW - 48, useAdvanced: true },
            })
            .setOrigin(0.5);
        card.add(title);

        const btnW = 240,
            btnH = 72,
            btnY = 70;

        const btnRect = this.add
            .rectangle(0, btnY, btnW, btnH, BROWN)
            .setOrigin(0.5)
            .setStrokeStyle(4, ACCENT)
            .setDepth(1)
            .setInteractive({ useHandCursor: true });

        const btnTxt = this.add
            .text(0, btnY, "Start", {
                fontSize: "38px",
                color: "#dcc89f",
                fontFamily: '"Jersey 10", sans-serif',
            })
            .setOrigin(0.5)
            .setDepth(2);

        card.add([btnRect, btnTxt]);

        const hoverIn = () => {
            this.tweens.add({
                targets: [btnRect, btnTxt],
                scale: 1.08,
                duration: 120,
                ease: "Quad.easeOut",
            });
            btnRect.setFillStyle(0x9b2d05);
            this.input.setDefaultCursor("pointer");
        };
        const hoverOut = () => {
            this.tweens.add({
                targets: [btnRect, btnTxt],
                scale: 1.0,
                duration: 120,
                ease: "Quad.easeOut",
            });
            btnRect.setFillStyle(BROWN);
            this.input.setDefaultCursor("default");
        };
        const startNow = () => {
            btnRect.disableInteractive();
            this.tweens.add({
                targets: [card, overlay],
                alpha: 0,
                duration: 200,
                ease: "Quad.easeOut",
                onComplete: () => {
                    card.destroy();
                    overlay.destroy();
                    this.input.enabled = true;
                    this._startCountdown();
                },
            });
        };

        btnRect.on("pointerover", hoverIn);
        btnRect.on("pointerout", hoverOut);
        btnRect.on("pointerdown", startNow);
        this.input.keyboard?.once?.("keydown-ENTER", startNow);

        this.tweens.add({
            targets: card,
            alpha: 1,
            duration: 220,
            ease: "Quad.easeOut",
        });
    }

    _showCurrent(show = true) {
        if (this.currentIndex >= this.questions.length)
            return this._finishToGameOver("completed");
        const item = this.questions[this.currentIndex];
        const q = typeof item === "string" ? item : item?.question ?? "";
        this.qText.setText(q);

        this.selections = { Asset: "NE", Liability: "NE", SE: "NE", NI: "NE" };
        this.selectors.forEach((s) =>
            s.valueText.setText(this.selections[s.key])
        );

        if (show) this._setGameplayUIVisible(true);
    }

    _onSubmit() {
        const item = this.questions[this.currentIndex];
        if (!item) return;

        const sel = this.selections;
        const cor = item.correct ?? {
            Asset: "NE",
            Liability: "NE",
            SE: "NE",
            NI: "NE",
        };

        const allMatch =
            sel.Asset === cor.Asset &&
            sel.Liability === cor.Liability &&
            sel.SE === cor.SE &&
            sel.NI === cor.NI;

        const nextBtn = this._uiNodes.find(
            (n) =>
                n &&
                n.type === "Rectangle" &&
                n.width === 180 &&
                n.height === 50
        );

        if (allMatch) {
            this.onScored(300);
            this._updateScoreUI();
            this._showPlusAmount(300);
            this._flashScreen(0x2e7d32, 0.35);
            if (nextBtn) nextBtn.setFillStyle(0x2e7d32);
        } else {
            this._flashScreen(0x8b0000, 0.35);
            if (nextBtn) nextBtn.setFillStyle(0x8b0000);
        }

        if (nextBtn)
            this.time.delayedCall(350, () => nextBtn.setFillStyle(0xdcc89f));

        this.input.enabled = false;
        this.time.delayedCall(650, () => {
            this.currentIndex++;
            this._showCurrent(true);
            this.input.enabled = true;
        });
    }

    _flashScreen(colorHex, maxAlpha = 0.35) {
        const { width, height } = this.scale;
        const overlay = this.add
            .rectangle(width / 2, height / 2, width, height, colorHex, 0)
            .setDepth(50);
        this.tweens.add({
            targets: overlay,
            alpha: maxAlpha,
            duration: 120,
            yoyo: true,
            ease: "Quad.easeOut",
            onComplete: () => overlay.destroy(),
        });
    }

    _startCountdown() {
        this.input.enabled = false;
        if (this.timerEvent) {
            this.timerEvent.remove(false);
            this.timerEvent = null;
        }
        this._uiNodes.forEach((n) => n && n.setVisible(false));

        const { width, height } = this.scale;
        const txt = this.add
            .text(width / 2, height / 2, "3", {
                fontSize: "120px",
                color: "#dcc89f",
                fontFamily: '"Jersey 10", sans-serif',
            })
            .setOrigin(0.5)
            .setDepth(10);

        const pulse = () =>
            this.tweens.add({
                targets: txt,
                scale: 1.2,
                duration: 200,
                yoyo: true,
            });
        const showNum = (n, d) =>
            this.time.delayedCall(d, () => {
                txt.setText(String(n));
                pulse();
            });
        showNum(3, 0);
        showNum(2, 800);
        showNum(1, 1600);

        this.time.delayedCall(2400, () => {
            txt.destroy();

            //time tracking for analytics - store the timestamp of when the level actually starts (after countdown)
            //this.game.levelStartTime = Date.now();
            this.registry.set('levelStartTime', Date.now());
            console.log("Registry Start Time Set:", this.registry.get('levelStartTime'));


            this._setGameplayUIVisible(true, true);

            this.timerEvent = this.time.addEvent({
                delay: 1000,
                loop: true,
                callback: () => {
                    this.timeLeft--;
                    this._updateTimerUI();
                    if (this.timeLeft <= 0) this.onTimeUp();
                },
            });

            this._updateTimerUI();
            this._updateScoreUI();
            this.input.enabled = true;
        });
    }

    _setGameplayUIVisible(visible, fade = false) {
        if (!this._uiNodes?.length) return;
        if (!fade)
            return this._uiNodes.forEach((n) => n && n.setVisible(visible));
        if (visible)
            this._uiNodes.forEach(
                (n) =>
                    n &&
                    (n.setVisible(true),
                    n.setAlpha(0),
                    this.tweens.add({ targets: n, alpha: 1, duration: 350 }))
            );
    }

    _formatScore(n) {
        return String(Math.max(0, n | 0)).padStart(4, "0"); // 4 digits -> "0000"
    }
    _updateScoreUI() {
        if (this.scoreText)
            this.scoreText.setText(`POINTS: ${this._formatScore(this.score)}`);
    }
    _updateTimerUI() {
        if (this.timerText)
            this.timerText.setText(`Time: ${this.timeLeft | 0}s`);
    }
    _showPlusAmount(amount = 300) {
        const t = this.plusText;
        if (!t) return;
        t.setText(`+${amount}`);
        t.setPosition(this.plusTextAnchor.x, this.plusTextAnchor.y);
        t.setAlpha(1).setScale(1);
        this.tweens.killTweensOf(t);
        this.tweens.add({
            targets: t,
            y: this.plusTextAnchor.y - 30,
            alpha: 0,
            scale: 1.15,
            duration: 650,
            ease: "Quad.easeOut",
        });
    }

    _failAndBack(msg) {
        const { width, height } = this.scale;
        this.add
            .text(width / 2, height / 2, msg, {
                fontSize: "18px",
                color: "#ffffff",
                align: "center",
                wordWrap: { width: width * 0.9 },
            })
            .setOrigin(0.5)
            .setDepth(20);
        this.time.delayedCall(2200, () => this.scene.start("GM3LevelSelect"));
    }

    _getCellText(c) {
        if (!c) return "";
        const v = typeof c?.w === "string" ? c.w : c?.v;
        return (v ?? "").toString().trim();
    }
}


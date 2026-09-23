import * as XLSX from "xlsx";
import BaseGM3Scene from "./BaseGM3Scene";
import { orderByRecency, markSeen } from "../gameobjects/QuestionHistory";

export default class GM3Level1 extends BaseGM3Scene {
  constructor() {
    super("GM3Level1", { title: "", level: 1, timeLimit: 90 });
    this.currentIndex = 0;
    this.questions = [];
    
    
    
    //We keep currentCorrect around just in case, but add variables to handle text input states
    this.currentCorrect = -1; 
    this.currentInput = "";         
    this.acceptingInput = false;    // Acts as a gatekeeper so players can't type during countdowns or feedback
    this._uiNodes = [];
    
    this.score = 0; // start score at 0 -> shows as POINTS: 0000
  }

  onTimeUp() { this._finishToGameOver("timeup"); }

  _finishToGameOver(reason = "completed") {
    if (this.timerEvent) this.timerEvent.remove(false);

    // unbind
    this.input.keyboard.off('keydown', this._handleKeydown, this);

    // record which questions were actually shown this playthrough, so a
    // replay biases toward fresh ones instead of cycling the same handful
    if (this.apiBase && this.questions.length) {
      markSeen(this.apiBase, "easy", this.questions.slice(0, this.currentIndex + 1));
    }

    const startTime = this.registry.get('levelStartTime') || Date.now();
    const timeSpentPlaying = Math.floor((Date.now() - startTime) / 1000);
    this.scene.start("GameOverScene", {
        score: this.score,
        mode: "GM3-Level1",
        reason,
        timeSpentPlaying: Math.floor((this.time.now - this.startTime) / 1000),
    });
  }

  async buildLevel() {
    // -------------------------------------------------------------------------
    // 1. Audio and Excel File Loading
    // -------------------------------------------------------------------------
    this.sound.play("game3", { loop: true, volume: this.game.sfxVolume ?? 1 });
    const buf = this.cache.binary.get("excelData");
    if (!buf) return this._failAndBack("Excel file not found.");

    const wb = XLSX.read(buf, { type: "array", cellStyles: true, cellHTML: true });
    const sheetName = wb.SheetNames.find(n => n.trim().toLowerCase() === "a=l+se - easy".toLowerCase());
    if (!sheetName) return this._failAndBack("Sheet 'A=L+SE - Easy' not found.");
    const sh = wb.Sheets[sheetName];

    // -------------------------------------------------------------------------
    // 2. Parsing Questions from Excel
    // -------------------------------------------------------------------------
    const rows = [];
    let emptyStreak = 0;
    const MAX_SCAN_ROWS = 2000;


    
    //This expects:
    //Column F: The Question Text
    //Column K: The Correct Answer (Number only)
    for (let r = 4; r <= MAX_SCAN_ROWS; r++) {
      const qCell = sh[`F${r}`]; 
      const aCell = sh[`K${r}`]; 

      const question = this._getCellText(qCell);
      const rawAnswer = this._getCellText(aCell);

      //Stop if we hit 10 completely empty rows
      //a checker to prevent overscanning 
      if (!question && !rawAnswer) {
        emptyStreak++; 
        if (emptyStreak >= 10) break; 
        continue;
      } 
      emptyStreak = 0;

      //Clean the answer: remove $, commas, spaces, letters, etc
      //e.g., "$1,200" -> "1200"
      //not really needed for current version but here in case of updates 
      const numericCorrect = rawAnswer.replace(/[^0-9]/g, '');

      //Only add row if we have a question AND a valid numeric answer
      if (question && numericCorrect.length > 0) {
        rows.push({ 
          question: question, 
          correctAnswer: numericCorrect 
        });
      }
    }

    if (!rows.length) return this._failAndBack("No valid questions found. Check Col F (Question) and Col K (Answer).");

    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    this.apiBase = isLocal ? "http://localhost:8000" : "https://accounting-game.cse.eng.auburn.edu/api";
    this.questions = await orderByRecency(rows, this.apiBase, "easy");

    // -------------------------------------------------------------------------
    // 3. Scene Setup (Background & HUD)
    // -------------------------------------------------------------------------
    const { width, height } = this.scale;

    // Background
    this.add.image(width / 2, height / 2, "gm3_level1_bg")
      .setOrigin(0.5).setDisplaySize(width, height).setDepth(0);

    // Score Text
    if (!this.scoreText) {
      this.scoreText = this.add.text(20, 16, "", {
        fontSize: "40px", color: "#dcc89f", fontFamily: '"Jersey 10", sans-serif',
      }).setDepth(6).setOrigin(0, 0).setStroke("#dd1e1e", 3);
    } else {
      this.scoreText.setPosition(20, 2).setOrigin(0, 0)
        .setFontFamily('"Jersey 10", sans-serif').setFontSize(40)
        .setColor("#dcc89f").setStroke("#dd1e1e", 3).setDepth(6);
    }
    this._updateScoreUI();

    // Timer Text
    if (!this.timerText) {
      this.timerText = this.add.text(width - 20, 16, "", {
        fontSize: "40px", color: "#dcc89f", fontFamily: '"Jersey 10", sans-serif',
      }).setDepth(6).setOrigin(1, 0).setStroke("#7f1a02", 3);
    } else {
      this.timerText.setPosition(width - 20, 2).setOrigin(1, 0)
        .setFontFamily('"Jersey 10", sans-serif').setFontSize(40)
        .setColor("#dcc89f").setStroke("#7f1a02", 3).setDepth(6);
    }
    if (typeof this.timeLeft !== "number") this.timeLeft = 90;
    this._updateTimerUI();

    // Question Display
    const qWrapW = Math.min(560, Math.floor(width * 0.6));
    this.qText = this.add.text(width / 2, height * 0.26, "", {
      fontSize: "30px",
      color: "#7f1a02",
      fontFamily: '"Jersey 10", sans-serif',
      wordWrap: { width: qWrapW, useAdvanced: true },
      align: "center",
    }).setOrigin(0.5).setDepth(6);

    // -------------------------------------------------------------------------
    // 4. Input UI (Replaces Multiple Choice Grid)
    // -------------------------------------------------------------------------

    // --- NEW TEXT INPUT UI ---
    //change these for the size of the input boz
    const inputBoxW = 300;
    const inputBoxH = 80;
    
    // The visual box container for the input
    //change these values for placeement
    this.inputBox = this.add.rectangle(width / 2, height * 0.65, inputBoxW, inputBoxH, 0xdcc89f)
      .setStrokeStyle(4, 0x7f1a02).setDepth(5);

    // The text object that displays what the user types
    this.inputText = this.add.text(width / 2, height * 0.65, "", {
      fontSize: "48px", color: "#7f1a02", fontFamily: '"Jersey 10", sans-serif',
    }).setOrigin(0.5).setDepth(6);

    // Feedback text (Correct! / Incorrect!)
    this.feedbackText = this.add.text(width / 2, height * 0.80, "", {
      fontSize: "36px", color: "#fcfcfc", fontFamily: '"Jersey 10", sans-serif', align: "center"
    }).setOrigin(0.5).setDepth(6).setAlpha(0);

    // --- BLINKING CURSOR ---
    // A vertical line that simulates a text cursor
    this.cursor = this.add.rectangle(width / 2 + 4, height * 0.65, 4, 40, 0x7f1a02)
      .setDepth(6).setAlpha(0);
    
    // Animate the cursor to blink forever
    this.tweens.add({
      targets: this.cursor,
      alpha: 1,
      duration: 400,
      yoyo: true,
      repeat: -1
    });

    // Floating "+100" Animation Text
    this.plusTextAnchor = { x: width / 2, y: height * 0.51 };
    this.plusText = this.add.text(this.plusTextAnchor.x, this.plusTextAnchor.y, "+100", {
      fontSize: "48px",
      color: "#dcc89f",
      fontFamily: '"Jersey 10", sans-serif',
    }).setOrigin(0.5).setDepth(15).setStroke("#7f1a02", 3).setAlpha(0);



    // --- NEW UI LIST ---
    this._uiNodes = [
      this.qText, this.timerText, this.scoreText, 
      this.inputBox, this.inputText, this.feedbackText, this.cursor
    ];
    
    this._setGameplayUIVisible(false);

    // Setup Keyboard Listener for typing
    // We bind 'this' so the function can access scene variables
    this.input.keyboard.on('keydown', this._handleKeydown, this);

    // Initialize first question
    this.currentIndex = 0;
    this._showCurrent(true);

    // Show the "Click to Start" overlay
    this._showPreStartCard();
  }

  //Keyboard handling logic
  //Listens for numbers, backspace, and the enter key to submit.
  _handleKeydown(event) {
    if (!this.acceptingInput) return; // Ignore typing if not ready

    if (event.key === "Backspace") {
      // Remove the last character
      this.currentInput = this.currentInput.slice(0, -1);
    } else if (event.key === "Enter") {
      // Only submit if they actually typed something
      if (this.currentInput.length > 0) this._submitAnswer();
    } else if (/^[0-9]$/.test(event.key)) {
      // Regex ensures ONLY numbers 0-9 are added to the string
      this.currentInput += event.key;
    }
    
    // Update the visual text on screen
    this.inputText.setText(this.currentInput);
    //cursor 
    this.cursor.x = this.inputText.x + (this.inputText.width / 2) + 4;
  }

  //NEW CODE BLOCK: Submitting and validating the answer
  //Compares the typed input against the purely numeric correct answer from the Excel sheet.
  _submitAnswer() {
    this.acceptingInput = false; // Stop them from typing while feedback is showing
    
    //hide the cursor while feedback is up
    this.cursor.setVisible(false);

    const item = this.questions[this.currentIndex];
    
    if (this.currentInput === item.correctAnswer) {
      this.onScored(100);
      this._updateScoreUI();
      this._showPlus100();
      this.inputBox.setStrokeStyle(4, 0x2e7d32); // Turn box border green
      this.feedbackText.setText("Correct!").setColor("#2e7d32").setAlpha(1);
    } else {
      this.inputBox.setStrokeStyle(4, 0x8b0000); // Turn box border red
      this.feedbackText.setText(`Incorrect!\nCorrect answer: ${item.correctAnswer}`).setColor("#ec1b1b").setAlpha(1);
    }

    // Delay so they can read the feedback, then automatically advance to next question
    this.time.delayedCall(1500, () => {
      this.currentIndex++;
      this._showCurrent(true);
    });
  }

  // --- Pre-start beige card with perfectly aligned button hitbox (Level 1) ---
  _showPreStartCard() {
    if (this.timerEvent) { this.timerEvent.remove(false); this.timerEvent = null; }
    this._uiNodes?.forEach(n => n && n.setVisible(false));
    this.input.enabled = true;

    const { width, height } = this.scale;

    // Block background clicks
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.25)
      .setDepth(998)
      .setInteractive()
      .setScrollFactor(0);

    // Card (no scale to avoid pointer math issues)
    const card = this.add.container(width / 2, height / 2)
      .setDepth(999)
      .setAlpha(0)
      .setScrollFactor(0);

    const panelW = Math.min(720, Math.floor(width * 0.86));
    const panelH = 220;
    const BEIGE = 0xF5DEB3, BROWN = 0x7f1a02, ACCENT = 0xdcc89f;

    const g = this.add.graphics();
    g.lineStyle(6, BROWN, 1);
    g.fillStyle(BEIGE, 1);
    g.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 18);
    g.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 18);
    card.add(g);

    const title = this.add.text(0, -40, "Solve the accounting equation", {
      fontSize: "44px",
      color: "#7f1a02",
      fontFamily: '"Jersey 10", sans-serif',
      align: "center",
      wordWrap: { width: panelW - 40, useAdvanced: true },
    }).setOrigin(0.5);
    card.add(title);

    // Start button (rectangle is the ONLY interactive target)
    const btnW = 240, btnH = 72, btnY = 50;

    const btnRect = this.add.rectangle(0, btnY, btnW, btnH, BROWN)
      .setOrigin(0.5)
      .setStrokeStyle(4, ACCENT)
      .setDepth(1)
      .setInteractive({ useHandCursor: true }); // default hit area = exact rect

    const btnTxt = this.add.text(0, btnY, "Start", {
      fontSize: "38px",
      color: "#dcc89f",
      fontFamily: '"Jersey 10", sans-serif',
    }).setOrigin(0.5).setDepth(2);

    card.add([btnRect, btnTxt]);

    const hoverIn = () => {
      this.tweens.add({ targets: [btnRect, btnTxt], scale: 1.08, duration: 120, ease: "Quad.easeOut" });
      btnRect.setFillStyle(0x9b2d05);
      this.input.setDefaultCursor("pointer");
    };
    const hoverOut = () => {
      this.tweens.add({ targets: [btnRect, btnTxt], scale: 1.0, duration: 120, ease: "Quad.easeOut" });
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
    this.input.keyboard?.once?.("keydown-ENTER", () => {
      if (btnRect && btnRect.active) startNow();
    });

    this.tweens.add({ targets: card, alpha: 1, duration: 220, ease: "Quad.easeOut" });
  }

  _showCurrent(show = true) {
    if (this.currentIndex >= this.questions.length) return this._finishToGameOver("completed");
    const item = this.questions[this.currentIndex];
    
    

    //Reset the input UI for the fresh question
    this.qText.setText(item.question);
    this.currentInput = "";
    this.inputText.setText("");
    this.inputBox.setStrokeStyle(4, 0x7f1a02);
    this.feedbackText.setAlpha(0);
    this.acceptingInput = true; // Let them type again

    //reset curso 
    this.cursor.setVisible(true);
    this.cursor.x = this.inputText.x + 4;

    if (show) this._setGameplayUIVisible(true);
  }

  

  _startCountdown() {
    this.input.enabled = false;
    if (this.timerEvent) { this.timerEvent.remove(false); this.timerEvent = null; }
    this._uiNodes.forEach(n => n && n.setVisible(false));

    const { width, height } = this.scale;
    const txt = this.add.text(width / 2, height / 2, "3", {
      fontSize: "120px",
      color: "#dcc89f",
      fontFamily: '"Jersey 10", sans-serif',
    }).setOrigin(0.5).setDepth(10);

    const pulse = () => this.tweens.add({ targets: txt, scale: 1.2, duration: 200, yoyo: true });
    const showNum = (n, d) => this.time.delayedCall(d, () => { txt.setText(String(n)); pulse(); });
    showNum(3, 0); showNum(2, 800); showNum(1, 1600);

    this.time.delayedCall(2400, () => {
      txt.destroy();


      //time tracking for analytics - store the timestamp of when the level actually starts (after countdown)
      //this.game.levelStartTime = Date.now();

      this.registry.set('levelStartTime', Date.now());
      console.log("Registry Start Time Set:", this.registry.get('levelStartTime'));

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
      this._setGameplayUIVisible(true);
      this.input.enabled = true;
      
      //trigger the flag to allow keyboard input once the game actually begins
      this.acceptingInput = true; 
    });
  }

  _setGameplayUIVisible(visible, fade = false) {
    if (!this._uiNodes?.length) return;
    if (!fade) return this._uiNodes.forEach(n => n && n.setVisible(visible));
    if (visible) this._uiNodes.forEach(n => n && (n.setVisible(true), n.setAlpha(0),
      this.tweens.add({ targets: n, alpha: 1, duration: 350 })));
  }

  // --- UI helpers ---
  _formatScore(n) { 
  return String(Math.max(0, n | 0)).padStart(4, "0"); // 4 digits -> "0000"
}
  _updateScoreUI() { if (this.scoreText) this.scoreText.setText(`POINTS: ${this._formatScore(this.score)}`); }
  _updateTimerUI() { if (this.timerText) this.timerText.setText(`Time: ${this.timeLeft | 0}s`); }
  _showPlus100() {
    const t = this.plusText; if (!t) return;
    t.setText("+100"); t.setPosition(this.plusTextAnchor.x, this.plusTextAnchor.y);
    t.setAlpha(1).setScale(1); this.tweens.killTweensOf(t);
    this.tweens.add({ targets: t, y: this.plusTextAnchor.y - 30, alpha: 0, scale: 1.15, duration: 650, ease: "Quad.easeOut" });
  }

  _failAndBack(msg) {
    const { width, height } = this.scale;
    this.add.text(width / 2, height / 2, msg, {
      fontSize: "18px", color: "#ffffff", align: "center", wordWrap: { width: width * 0.9 },
    }).setOrigin(0.5).setDepth(20);
    this.time.delayedCall(2200, () => this.scene.start("GM3LevelSelect"));
  }

  _getCellText(c) { if (!c) return ""; const v = typeof c.w === "string" ? c.w : c.v; return (v ?? "").toString().trim(); }
}

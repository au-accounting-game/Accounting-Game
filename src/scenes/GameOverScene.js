// src/scenes/GameOverScene.js
import { Scene } from "phaser";

export class GameOverScene extends Scene {
  end_points = 0;

  constructor() {
    super("GameOverScene");
  }

  init(data) {
    this.end_points = (data && (data.points ?? data.score)) || 0;
    this.gameKey = (data && (data.gameKey ?? data.mode)) || "MainScene";
    this.isTutorial = data?.isTutorial ?? false; // tutorial?

    // PULL FROM REGISTRY INSTEAD
    const startTime = this.registry.get('levelStartTime');
    
    if (startTime) {
        this.timeSpentPlaying = Math.floor((Date.now() - startTime) / 1000);
        console.log("Calculated Time from Registry:", this.timeSpentPlaying);
        
        // Clear it so it doesn't persist
        this.registry.remove('levelStartTime');
    } else {
        this.timeSpentPlaying = 0;
        console.warn("Registry was empty!");
    }
}

  _resolveRestartScene() {
    const key = String(this.gameKey || "");
    if (key === "GM3Level1" || key === "GM3-Level1") return "GM3Level1";
    if (key === "GM3Level2" || key === "GM3-Level2") return "GM3Level2";
    if (key === "GM3Level3" || key === "GM3-Level3") return "GM3Level3";
    return "MainScene";
  }

  _suspendKeys() {
    if (this.input?.keyboard) {
      this.input.keyboard.enabled = false;
      this.input.keyboard.clearCaptures?.();
    }
  }

  _resumeKeys() {
    if (this.input?.keyboard) {
      this.input.keyboard.enabled = true;
    }
  }

  async create() {
    const { width, height } = this.scale;
    const centerX = width / 2;
    const centerY = height / 2;

    const maybeMain = this.scene.get("MainScene");
    if (maybeMain?.scene?.isActive()) {
      maybeMain.scene.pause();
    }
    this.input.keyboard?.clearCaptures?.();

    const COLORS = {
      BG_DIM: 0x0b0907,
      PANEL_BEIGE: 0xeadbb7,
      PANEL_BEIGE_HOVER: 0xf0e5c9,
      STROKE_BROWN: 0x7f1a02,
      TEXT_LIGHT: "#efe6d3",
      TEXT_DARK: "#6b2a12",
      OK: 0x2e7d32,
      ERR: 0x8b0000,
      ACCENT: 0xb98a5e,
      BTN_BROWN: 0x7f1a02,
      BTN_BROWN_HOVER: 0x9a2a10,
      BTN_STROKE: 0x4e1a0c,
      BTN_TEXT: "#ffffff",
    };

    const restartScene = this._resolveRestartScene();
    const preferGM3 = restartScene.startsWith("GM3Level");
    const desiredBgKey = preferGM3 ? "gm3_shared_bg" : "gameover_bg";

    let bgKey = desiredBgKey;
    if (!this.textures.exists(bgKey)) {
      if (this.textures.exists(preferGM3 ? "gameover_bg" : "gm3_shared_bg")) {
        bgKey = preferGM3 ? "gameover_bg" : "gm3_shared_bg";
      } else if (this.textures.exists("background")) {
        bgKey = "background";
      }
    }

    this.add.image(0, 0, bgKey).setOrigin(0, 0).setDepth(0)
      .setDisplaySize(width, height);
    this.add.rectangle(centerX, centerY, width, height, COLORS.BG_DIM, 0.46).setDepth(1);

    this._ensureParticleTextures();
    this.add.particles(0, 0, "spark8", {
      x: { min: 0, max: width },
      y: { min: 0, max: 12 },
      lifespan: 1100,
      speedY: { min: 60, max: 120 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: [0xffffff, 0xf6eddc, 0xdcc89f],
      quantity: 1,
      frequency: 120,
      blendMode: "ADD"
    }).setDepth(1.2);

    const panelW = Math.min(660, Math.floor(width * 0.85));
    const panelH = Math.min(600, Math.floor(height * 0.95));

    const shadow = this.add.graphics().setDepth(2);
    shadow.fillStyle(0x000000, 0.20);
    shadow.fillRoundedRect(centerX - panelW / 2 + 8, centerY - panelH / 2 + 10, panelW, panelH, 22);

    const panel = this.add.graphics().setDepth(2.2);
    panel.lineStyle(5, COLORS.STROKE_BROWN, 1);
    panel.fillStyle(COLORS.PANEL_BEIGE, 1);
    panel.strokeRoundedRect(centerX - panelW / 2, centerY - panelH / 2, panelW, panelH, 22);
    panel.fillRoundedRect(centerX - panelW / 2, centerY - panelH / 2, panelW, panelH, 22);

    const inner = this.add.graphics().setDepth(2.3);
    inner.lineStyle(2, COLORS.ACCENT, 0.65);
    inner.strokeRoundedRect(centerX - panelW / 2 + 8, centerY - panelH / 2 + 8, panelW - 16, panelH - 16, 18);

    this.add.text(centerX, centerY - panelH / 2 + 40, "GAME OVER", {
      fontSize: "56px",
      color: COLORS.TEXT_LIGHT,
      fontFamily: '"Jersey 10", sans-serif',
      align: "center",
    }).setOrigin(0.5).setDepth(3).setStroke("#7f1a02", 4);

    const deco = this.add.graphics().setDepth(3);
    deco.lineStyle(3, COLORS.STROKE_BROWN, 0.7);
    deco.beginPath();
    deco.moveTo(centerX - panelW * 0.34, centerY - panelH / 2 + 76);
    deco.lineTo(centerX + panelW * 0.34, centerY - panelH / 2 + 76);
    deco.strokePath();

    this.add.text(centerX, centerY - 150, "YOUR SCORE", {
      fontSize: "28px",
      color: COLORS.TEXT_DARK,
      fontFamily: '"Jersey 10", sans-serif',
      align: "center",
    }).setOrigin(0.5).setDepth(3);

    const scoreText = this.add.text(centerX, centerY - 90, "0", {
      fontSize: "54px",
      color: COLORS.TEXT_LIGHT,
      fontFamily: '"Jersey 10", sans-serif',
      align: "center",
    }).setOrigin(0.5).setDepth(3).setStroke("#7f1a02", 4);

    this.tweens.addCounter({
      from: 0,
      to: Math.max(0, parseInt(this.end_points, 10) || 0),
      duration: 700,
      ease: "Quad.Out",
      onUpdate: (tw) => scoreText.setText(String(Math.floor(tw.getValue()))),
    });

    //const savedUsername = localStorage.getItem("game_username");
    const response = await fetch("https://accounting-game.cse.eng.auburn.edu/api/fetch-user");
    const savedUsername = await response.json().then(data => data.userid);

    // block manual submission if tutorial
    if (this.isTutorial) {
    	this._line(centerX, centerY + 52, "Tutorial mode — leaderboard disabled", 0x8b0000);
    } else if (savedUsername) {
        this._autoSubmitScore(centerX, centerY + 52, savedUsername);
    } else {
        this.showQualificationUI(centerX, centerY + 52);
    }

    this.createMenuButtons(centerX, centerY + panelH / 2 - 40);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this._resumeKeys());
  }

  _line(cx, cy, msg, tintHex) {
    this.add.text(cx, cy, msg, {
      fontSize: "28px",
      color: "#efe6d3",
      fontFamily: '"Jersey 10", sans-serif',
      align: "center",
    }).setOrigin(0.5).setDepth(3).setStroke("#7f1a02", 3).setTint(tintHex);
  }

  _ensureParticleTextures() {
    if (!this.textures.exists("spark8")) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1);
      g.fillCircle(4, 4, 4);
      g.generateTexture("spark8", 8, 8);
      g.destroy();
    }
    if (!this.textures.exists("confetti")) {
      const g2 = this.make.graphics({ x: 0, y: 0, add: false });
      g2.fillStyle(0xffffff, 1);
      g2.fillRect(0, 0, 8, 18);
      g2.generateTexture("confetti", 8, 18);
      g2.destroy();
    }
  }

  _burstConfetti(x, y, qty = 8) {
    const p = this.add.particles(x, y, "confetti", {
      lifespan: 750,
      speed: { min: 80, max: 180 },
      angle: { min: 220, max: 320 },
      rotate: { start: 0, end: 180 },
      scale: { start: 0.9, end: 0.2 },
      gravityY: 280,
      quantity: qty,
      tint: [0xf6eddc, 0xffffff, 0xeadbb7],
      blendMode: "NORMAL"
    }).setDepth(4);
    this.time.delayedCall(760, () => p.destroy());
  }

  _makeBrownButton(x, y, label, onClick) {
    const COLORS = {
      FILL: 0x7f1a02,
      HOVER: 0x9a2a10,
      STROKE: 0x4e1a0c,
      TEXT: "#ffffff",
    };

    const txt = this.add.text(x, y, label, {
      fontSize: "32px",
      color: COLORS.TEXT,
      fontFamily: '"Jersey 10", sans-serif',
      align: "center",
    }).setOrigin(0.5).setDepth(7);

    const padX = 18;
    const padY = 10;
    const w = Math.max(150, txt.width + padX * 2);
    const h = Math.max(50, txt.height + padY * 2);
    const r = 18;

    const g = this.add.graphics().setDepth(6);
    const draw = (fill) => {
      g.clear();
      g.lineStyle(5, COLORS.STROKE, 1);
      g.fillStyle(fill, 1);
      g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, r);
      g.fillRoundedRect(x - w / 2, y - h / 2, w, h, r);
    };
    draw(COLORS.FILL);

    const zone = this.add.zone(x, y, w, h).setOrigin(0.5).setDepth(8).setInteractive({
      cursor: "pointer",
      useHandCursor: true,
      hitArea: new Phaser.Geom.Rectangle(0, 0, w, h),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    });

    zone.on("pointerover", () => draw(COLORS.HOVER));
    zone.on("pointerout", () => draw(COLORS.FILL));
    zone.on("pointerdown", () => { g.y += 1; txt.y += 1; });
    zone.on("pointerup", () => { g.y -= 1; txt.y -= 1; if (typeof onClick === "function") onClick(); });

    const container = this.add.container(0, 0, [g, txt, zone]).setSize(w, h).setDepth(7);
    return container;
  }

  async _autoSubmitScore(centerX, centerY, savedUsername) {

    // block auto submit for tutorial
    if (this.isTutorial) {
        this._line(centerX, centerY, "Congrats on completing the tutorial!", 0x8b0000);
        return;
    }

    this._line(centerX, centerY, "Saving session data...", 0x2e7d32);

    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    // --- FIXED: Removed /api to match main.py route ---
    const apiBase = isLocal ? "http://localhost:8000" : "https://accounting-game.cse.eng.auburn.edu/api"; 

    try {
      const res = await fetch(`${apiBase}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            game: this.gameKey, 
            username: savedUsername, 
            score: parseInt(this.end_points, 10),
            time_played: this.timeSpentPlaying || 0
        }),
      });

      if (!res.ok) throw new Error("Network response was not ok");
      
      this.time.delayedCall(1500, () => {
    this.scene.start("Leaderboard", {
        gameKey: this.gameKey,
        highlightName: savedUsername.substring(0, 3).toUpperCase(),
        playAgainScene: this._resolveRestartScene(),
    });
});

    } catch (err) {
      console.error("Auto-submit failed:", err);
      this._line(centerX, centerY + 30, "Error saving to ledger.", 0x8b0000);
    }
  }

  showQualificationUI(centerX, centerY) {
    const msg = `Submit your score to the leaderboard!`;
    this.add.text(centerX, centerY - 40, msg, {
      fontSize: "30px",
      color: "#efe6d3",
      fontFamily: '"Jersey 10", sans-serif',
      align: "center",
      wordWrap: { width: Math.min(620, this.scale.width * 0.82), useAdvanced: true },
    }).setOrigin(0.5).setDepth(6).setStroke("#7f1a02", 3).setTint(0x2e7d32);

    this.add.text(centerX, centerY + 20, "Enter your initials:", {
      fontSize: "28px",
      color: "#6b2a12",
      fontFamily: '"Jersey 10", sans-serif',
    }).setOrigin(0.5).setDepth(6);

    const input = this.add.dom(centerX, centerY + 80, "input", {
      type: "text",
      fontSize: "26px",
      textAlign: "center",
      width: "108px",
    });
    input.setDepth(7);
    input.node.style.textTransform = "uppercase";
    input.node.style.background = "#eadbb7";
    input.node.style.border = "3px solid #7f1a02";
    input.node.style.borderRadius = "10px";
    input.node.style.color = "#6b2a12";
    input.node.style.fontFamily = '"Jersey 10", sans-serif';
    input.node.style.padding = "8px 10px";
    input.node.style.boxShadow = "0 2px 0 #7f1a02";

    const el = input.node;
    const focusInput = () => { el.focus(); el.select?.(); };
    el.addEventListener("focus", () => this._suspendKeys());
    el.addEventListener("blur", () => this._resumeKeys());
    ["keydown", "keyup", "keypress", "input"].forEach(evt =>
      el.addEventListener(evt, e => e.stopPropagation(), { capture: true })
    );
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    });

    this.time.delayedCall(0, focusInput);

    const handleSubmit = async () => {
      const username = (el.value || "").toUpperCase() || "";
      const score = parseInt(this.end_points, 10);
      
      try {
        if (username.length !== 3) throw new Error("Username must be exactly three characters");

        const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        // --- FIXED: Removed /api to match main.py route ---
        const apiBase = isLocal ? "http://localhost:8000" : "https://accounting-game.cse.eng.auburn.edu"; 

        const res = await fetch(`${apiBase}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
              game: this.gameKey, 
              username: username, 
              score: score,
              time_played: this.timeSpentPlaying || 0
          }),
        });

        if (!res.ok) throw new Error(`Submit failed (${res.status})`);
        await res.json();

        this._burstConfetti(centerX, centerY + 40, 10);

        this.add.text(centerX, centerY + 40, "Score submitted!", {
          fontSize: "26px",
          color: "#efe6d3",
          fontFamily: '"Jersey 10", sans-serif',
        }).setOrigin(0.5).setDepth(7).setStroke("#7f1a02", 3).setTint(0x2e7d32);

        this._resumeKeys();

      this.time.delayedCall(900, () => {
    this.scene.start("Leaderboard", {
        gameKey: this.gameKey,
        highlightName: username,
        playAgainScene: this._resolveRestartScene(),
    });
});
      } catch (err) {
        console.error("Error submitting score:", err);
        const message = err.message;

        const errorText = this.add.text(centerX, centerY + 40, message, {
          fontSize: "26px",
          color: "#efe6d3",
          fontFamily: '"Jersey 10", sans-serif',
        })
          .setOrigin(0.5)
          .setDepth(7)
          .setStroke("#7f1a02", 3)
          .setTint(0x8b0000);

        this.tweens.add({
          targets: errorText,
          alpha: { from: 1, to: 0 },
          delay: 2000,
          duration: 800,
          onComplete: () => errorText.destroy()
        });

        this.time.delayedCall(0, focusInput);
      }
    };

    this._makeBrownButton(centerX + 10, centerY + 160, "Submit", handleSubmit);
    this.input.keyboard.once?.("keydown-ENTER", () => {
      if (document.activeElement !== el) handleSubmit();
    });
  }

  createMenuButtons(centerX, baseY) {
    const gap = 450;

    this._makeBrownButton(centerX - gap / 2, baseY, "Play Again", () => {
      this._resumeKeys();
      this.game.musicManager?.stop();
      this.sound.stopAll();
      const restartScene = this._resolveRestartScene();
      this.scene.start(restartScene);
    });

    this._makeBrownButton(centerX + gap / 2, baseY, "Main Menu", () => {
      this._resumeKeys();
      this.game.musicManager?.stop();
      this.sound.stopAll();
      this.scene.start("MainMenuScene");
    });
  }
}

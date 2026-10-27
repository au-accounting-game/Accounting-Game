// src/scenes/BaseGM3Scene.js
import Phaser from "phaser";

export default class BaseGM3Scene extends Phaser.Scene {
  /**
   * @param {string} key
   * @param {{ title:string, level:number, timeLimit?:number }} cfg
   */
  constructor(key, cfg) {
    super(key);
    this.modeTitle = cfg.title ?? "GameMode 3"; // kept in case specific scenes want to use it
    this.level = cfg.level ?? 1;
    this.timeLimit = cfg.timeLimit ?? 90;

    this.score = 0;
    this.timeLeft = this.timeLimit;
    this.timerEvent = null;
  }

  init() {
    this.score = 0;
    this.timeLeft = this.timeLimit;
    if (this.input) this.input.enabled = true;

    if (this.timerEvent) {
      this.timerEvent.remove(false);
      this.timerEvent = null;
    }

    this.events.once("shutdown", this._cleanup, this);
    this.events.once("destroy", this._cleanup, this);
  }

  preload() {}

  create() {
    const { width, height } = this.scale;

    // Background
    this.add
      .rectangle(width / 2, height / 2, width, height, 0x101010)
      .setDepth(-1);

    // (Title header removed)

    // ESC → Pause overlay
    this._escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC, false);
    this._escKey.on("down", () => {
      if (this.scene.isActive("GM3PauseScene")) return;
      this.scene.launch("GM3PauseScene", { returnTo: this.scene.key });
      this.scene.pause();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this._escKey?.destroy();
    });

    // HUD
    this.scoreText = this.add.text(16, 20, "Score: 0", { fontSize: "18px", color: "#ffffff" });
    this.timerText = this.add
      .text(width - 16, 20, `Time: ${this.timeLeft}`, { fontSize: "18px", color: "#ffffff" })
      .setOrigin(1, 0);

    // Start timer
    this._startTimer();

    // Let child scene build the level
    this.buildLevel?.();
  }

  _startTimer() {
    if (this.timerEvent) {
      this.timerEvent.remove(false);
      this.timerEvent = null;
    }
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.timeLeft -= 1;
        if (this.timerText) this.timerText.setText(`Time: ${this.timeLeft}`);
        if (this.timeLeft <= 0) this.onTimeUp();
      },
    });
  }

  onScored(points = 10) {
    this.score += points;
    if (this.scoreText) this.scoreText.setText(`Score: ${this.score}`);
  }

  onTimeUp() {
    this.endLevel(false);
  }

  endLevel(success = true) {
    if (this.timerEvent) {
      this.timerEvent.remove(false);
      this.timerEvent = null;
    }
    this.scene.start("MainMenuScene", {
      lastResult: { level: this.level, score: this.score, success },
    });
  }

  _cleanup() {
    if (this.timerEvent) {
      this.timerEvent.remove(false);
      this.timerEvent = null;
    }
  }
}

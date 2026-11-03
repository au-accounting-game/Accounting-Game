// src/scenes/BaseGM3Scene.js
import Phaser from "phaser";

// selector keys -> what the player sees (Effect of Transactions, Accounting Errors)
export const ELEMENT_NAMES = {
  Asset: "Assets",
  Liability: "Liabilities",
  SE: "Stockholders Equity",
  NI: "Net Income",
};

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
    this.missed = []; // wrong answers, shown on ReviewScene at the end
    this.score = 0;
    this.correctAnswers = 0;
    this.totalAttempts = 0;
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
// Correct answers / Total attempts
this.questionCounterText = this.add.text(16, 48, "0/0", {
    fontSize: "18px",
    color: "#ffffff"
});
      
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
recordAnswer(isCorrect) {
    this.totalAttempts += 1;

    if (isCorrect) {
        this.correctAnswers += 1;
    }

    this.questionCounterText?.setText(
        `${this.correctAnswers}/${this.totalAttempts}`
    );
}
    
  // pop a result message (white for correct, red for incorrect): bounces in, short hold, then
  // fades - fits inside the 1.2s before the next question
  _popResult(text, correct, message) {
    text.setText(message)
      .setColor(correct ? "#ffffff" : "#e57373")
      .setStroke(correct ? "#2e7d32" : "#7f0000", 5)
      .setAlpha(1)
      .setScale(0.4);
    this.tweens.killTweensOf(text);
    this.tweens.add({ targets: text, scale: 1, duration: 450, ease: "Bounce.easeOut" });
    this.tweens.add({ targets: text, alpha: 0, duration: 250, delay: 850 });
  }

  // after a wrong answer: show the correct value in every selector box,
  // outlining the ones the player had right in green and wrong in red
  _revealCorrect(selected, correct, labelOf) {
    this.selectors.forEach(s => {
      s.valueText.setText(labelOf(correct[s.key]));
      s.rect.setStrokeStyle(4, selected[s.key] === correct[s.key] ? 0x2e7d32 : 0x8b0000);
    });
  }

  _resetSelectorOutlines() {
    this.selectors?.forEach(s => s.rect.setStrokeStyle(3, 0x7f1a02));
  }

  // remember a missed question for the end-of-game review;
  // rows: [{ label, correct, yours }]
  _recordMiss(question, rows) {
    this.missed.push({ question, rows });
  }

  // end of game: Game Over gets the missed questions so it can offer a review
  _endToGameOver(gameOverData) {
    this.scene.start("GameOverScene", { ...gameOverData, missed: this.missed });
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

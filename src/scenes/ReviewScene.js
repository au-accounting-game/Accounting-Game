// src/scenes/ReviewScene.js
// Review of the questions missed in an Accounting Equation game. Opened from
// the Review button on GameOverScene / Leaderboard as an overlay: the caller
// pauses itself, and Close resumes it.
// data: { missed: [{ question, rows: [{ label, correct, yours }] }], returnTo }
import Phaser from "phaser";

const BROWN = 0x7f1a02, BEIGE = 0xF5DEB3;
const RIGHT_COLOR = "#2e7d32", WRONG_COLOR = "#b00020", TEXT_COLOR = "#7f1a02";
const FONT = '"Jersey 10", sans-serif';

// shorter element names so three or four answers fit on one line
const SHORT_LABELS = { "Stockholders Equity": "Equity" };

export class ReviewScene extends Phaser.Scene {
  constructor() {
    super("ReviewScene");
  }

  init(data) {
    this.missed = data?.missed ?? [];
    this.returnTo = data?.returnTo ?? null;
    this.scrollY = 0;
  }

  create() {
    const { width, height } = this.scale;
    this.scene.bringToTop(); // scene order would otherwise put it under e.g. the leaderboard

    // dim whatever is underneath; also swallows clicks meant for it
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.55).setInteractive();

    const cardW = Math.min(880, width - 40), cardH = height - 40;
    const cardX = width / 2 - cardW / 2, cardY = height / 2 - cardH / 2;
    const g = this.add.graphics();
    g.lineStyle(6, BROWN, 1);
    g.fillStyle(BEIGE, 1);
    g.fillRoundedRect(cardX, cardY, cardW, cardH, 18);
    g.strokeRoundedRect(cardX, cardY, cardW, cardH, 18);

    const count = this.missed.length;
    this.add.text(width / 2, cardY + 32, `Review: ${count} missed question${count === 1 ? "" : "s"}`, {
      fontSize: "38px", color: TEXT_COLOR, fontFamily: FONT,
    }).setOrigin(0.5);

    // scrolling list area between the title and the Close button
    this.view = { x: cardX + 24, y: cardY + 64, w: cardW - 60, h: cardH - 64 - 76 };
    this.list = this.add.container(this.view.x, this.view.y);
    const maskShape = this.make.graphics().fillRect(this.view.x, this.view.y, this.view.w, this.view.h);
    this.list.setMask(maskShape.createGeometryMask());

    this.contentH = this._buildList(this.view.w - 16);
    this.maxScroll = Math.max(0, this.contentH - this.view.h);

    // scrollbar, only when the list is taller than the view
    if (this.maxScroll > 0) {
      const trackX = cardX + cardW - 22;
      this.add.rectangle(trackX, this.view.y + this.view.h / 2, 6, this.view.h, BROWN, 0.2);
      const thumbH = Math.max(30, this.view.h * this.view.h / this.contentH);
      this.thumb = this.add.rectangle(trackX, 0, 6, thumbH, BROWN, 0.8).setOrigin(0.5, 0);
    }
    this._scrollTo(0);

    this._makeButton(width / 2, cardY + cardH - 38, "Close", () => this._close());

    // mouse wheel, drag, and keys scroll the list
    this.input.on("wheel", (_p, _o, _dx, dy) => this._scrollTo(this.scrollY + dy * 0.6));
    this.input.on("pointerdown", (p) => { this.dragFrom = { y: p.y, scroll: this.scrollY }; });
    this.input.on("pointerup", () => { this.dragFrom = null; });
    this.input.on("pointermove", (p) => {
      if (this.dragFrom && p.isDown) this._scrollTo(this.dragFrom.scroll - (p.y - this.dragFrom.y));
    });
    const keys = this.input.keyboard;
    keys.addKey(Phaser.Input.Keyboard.KeyCodes.UP).on("down", () => this._scrollTo(this.scrollY - 60));
    keys.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN).on("down", () => this._scrollTo(this.scrollY + 60));
    keys.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on("down", () => this._close());
  }

  // each miss: the question, then a "Correct" line and a "You" line with one
  // column per element; returns the list's total height
  _buildList(listW) {
    const labelW = 80;
    let y = 0;

    this.missed.forEach((miss, i) => {
      const q = this.add.text(0, y, `${i + 1}. ${miss.question}`, {
        fontSize: "22px", color: TEXT_COLOR, fontFamily: FONT,
        wordWrap: { width: listW, useAdvancedWrap: true },
      });
      this.list.add(q);
      y += q.height + 4;

      const colW = (listW - 24 - labelW) / Math.max(1, miss.rows.length);
      const line = (title, valueOf, colorOf) => {
        const head = this.add.text(24, y, title, { fontSize: "20px", color: TEXT_COLOR, fontFamily: FONT });
        this.list.add(head);
        miss.rows.forEach((row, c) => {
          const cell = this.add.text(24 + labelW + c * colW, y,
            `${SHORT_LABELS[row.label] ?? row.label}: ${valueOf(row)}`,
            { fontSize: "20px", color: colorOf(row), fontFamily: FONT });
          this.list.add(cell);
        });
        y += head.height + 2;
      };
      line("Correct:", row => row.correct, () => RIGHT_COLOR);
      line("You:", row => row.yours, row => (row.yours === row.correct ? RIGHT_COLOR : WRONG_COLOR));

      y += 14;
    });
    return y;
  }

  _scrollTo(value) {
    this.scrollY = Phaser.Math.Clamp(value, 0, this.maxScroll);
    this.list.y = this.view.y - this.scrollY;
    if (this.thumb) {
      const travel = this.view.h - this.thumb.height;
      this.thumb.y = this.view.y + (this.maxScroll ? travel * this.scrollY / this.maxScroll : 0);
    }
  }

  _close() {
    if (this.returnTo) this.scene.resume(this.returnTo);
    this.scene.stop();
  }

  _makeButton(x, y, label, onClick) {
    const rect = this.add.rectangle(0, 0, 160, 46, BROWN).setStrokeStyle(3, 0xdcc89f);
    const text = this.add.text(0, 0, label, { fontSize: "26px", color: "#dcc89f", fontFamily: FONT }).setOrigin(0.5);
    const btn = this.add.container(x, y, [rect, text]);

    rect.setInteractive({ useHandCursor: true });
    rect.on("pointerover", () => {
      rect.setFillStyle(0xa8321a);
      this.tweens.add({ targets: btn, scale: 1.05, duration: 140 });
    });
    rect.on("pointerout", () => {
      rect.setFillStyle(BROWN);
      this.tweens.add({ targets: btn, scale: 1, duration: 140 });
    });
    rect.on("pointerdown", () => {
      if ((this.game.sfxVolume ?? this.sound.volume) > 0) this.sound.play("selection");
      const t = this.tweens.add({ targets: btn, scale: 0.92, duration: 90, yoyo: true });
      t.once("complete", onClick);
    });
    return btn;
  }
}

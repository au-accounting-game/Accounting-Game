// src/scenes/EffectsSelect.js
// ACCT 2110: pick which Effect of Transactions game to play.
// Same look as SpeedSelect (sky, drifting clouds, small back arrow).
import Phaser from "phaser";

export class EffectsSelect extends Phaser.Scene {
  constructor() {
    super("EffectsSelect");
  }

  create() {
    const { width, height } = this.scale;

    // --- Background ---
    this.add.image(width / 2, height / 2, "home_bg")
      .setOrigin(0.5)
      .setDisplaySize(width, height)
      .setDepth(0);

    // Moving clouds
    this.clouds = [];
    this.cloudSpeed = 0.3;

    const baseSpacing = 550;
    const numClouds = Math.ceil(width / baseSpacing) + 3;

    for (let i = 0; i < numClouds; i++) {
      const xOffset = i * baseSpacing + Phaser.Math.Between(-80, 80);

      const cloud = this.add.image(xOffset, height * 0.47 + Phaser.Math.Between(-40, 40), "home_clouds")
        .setOrigin(0.5)
        .setScale(Phaser.Math.FloatBetween(0.65, 0.85))
        .setDepth(0);

      this.clouds.push(cloud);
    }

    // --- Back Arrow ---
    const backContainer = this.add.container(90, 46).setDepth(5);
    const w = 60, h = 40;

    const backBorder = this.add.rectangle(0, 0, w + 4, h + 4, 0x7f1a02);
    backBorder.setStrokeStyle(2, 0xdcc89f);

    const backRect = this.add.rectangle(0, 0, w, h, 0x7f1a02);
    backRect.setStrokeStyle(2, 0xdcc89f);

    const backArrow = this.add.text(0, 0, "←", {
      fontSize: "32px",
      fontFamily: '"Jersey 10", sans-serif',
      color: "#dcc89f",
      stroke: "#dcc89f",
      strokeThickness: 2,
    }).setOrigin(0.5);

    backContainer.add([backBorder, backRect, backArrow]);
    Phaser.Display.Align.In.Center(backArrow, backRect);
    backArrow.y -= 3;

    const goBack = () => this.scene.start("MainMenuScene");

    backRect.setInteractive({ useHandCursor: true });
    backRect.on("pointerover", () => {
      backRect.setFillStyle(0xa8321a);
      this.tweens.add({ targets: backContainer, scale: 1.1, duration: 150 });
    });
    backRect.on("pointerout", () => {
      backRect.setFillStyle(0x7f1a02);
      this.tweens.add({ targets: backContainer, scale: 1 });
    });
    backRect.on("pointerdown", () => {
      if ((this.game?.sfxVolume ?? this.sound.volume) > 0) this.sound.play("selection");
      goBack();
    });

    this._makeFloatingTitle("Effect of Transactions", width / 2, height * 0.15);

    // --- Game Buttons ---
    const games = [
      { label: "Without Net Income", scene: "GM3Effects" },
      { label: "With Net Income", scene: "GM3Level2" },
    ];

    const spacing = 100;
    const blockHeight = (games.length - 1) * spacing;
    const startY = height / 2 - blockHeight / 2;

    games.forEach((game, i) => {
      this._makeUIButton(width / 2, startY + i * spacing, game.label, () => {
        if ((this.game?.sfxVolume ?? this.sound.volume) > 0) this.sound.play("selection");

        // Stop menu music before gameplay
        this.game.musicManager?.stop();

        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start(game.scene));
      });
    });

    // ESC goes back
    this._escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this._escKey.on("down", goBack);
  }

  // title drops in like SpeedSelect's, then each letter bobs in a wave
  _makeFloatingTitle(message, centerX, y) {
    const style = {
      fontSize: "56px",
      fontFamily: '"Jersey 10", sans-serif',
      color: "#dcc89f",
      stroke: "#7f1a02",
      strokeThickness: 4,
    };

    const letters = [...message].map(ch => this.add.text(0, 0, ch, style).setOrigin(0, 0.5));
    const totalW = letters.reduce((sum, t) => sum + t.width, 0);
    const title = this.add.container(centerX, -50).setDepth(5);

    let x = -totalW / 2;
    letters.forEach(t => {
      t.x = x;
      x += t.width;
    });
    title.add(letters);

    this.tweens.add({ targets: title, y, duration: 800, ease: "Bounce.easeOut" });

    letters.forEach((t, i) => {
      this.tweens.add({
        targets: t,
        y: -8,
        duration: 900,
        delay: 800 + i * 70,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });
  }

  // cloud wrap logic
  update() {
    if (!this.clouds) return;

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

  _makeUIButton(x, y, label, onClick) {
    const w = 260;
    const h = 60;

    const border = this.add.rectangle(0, 0, w + 4, h + 4, 0x7f1a02);
    border.setStrokeStyle(3, 0xdcc89f);

    const rect = this.add.rectangle(0, 0, w, h, 0x7f1a02);
    rect.setStrokeStyle(2, 0xdcc89f);

    const text = this.add.text(0, 0, label, {
      fontSize: "24px",
      fontFamily: '"Jersey 10", sans-serif',
      color: "#dcc89f",
    }).setOrigin(0.5);

    const btn = this.add.container(x, y, [border, rect, text]);

    rect.setInteractive({ useHandCursor: true });

    rect.on("pointerover", () => {
      rect.setFillStyle(0xa8321a);
      this.tweens.add({ targets: btn, scale: 1.05, duration: 140 });
    });

    rect.on("pointerout", () => {
      rect.setFillStyle(0x7f1a02);
      this.tweens.add({ targets: btn, scale: 1.0, duration: 140 });
    });

    rect.on("pointerdown", () => {
      const t = this.tweens.add({ targets: btn, scale: 0.92, duration: 90, yoyo: true });
      t.once("complete", onClick);
    });

    return btn;
  }
}

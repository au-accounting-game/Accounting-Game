// src/scenes/SpeedSelect.js
import Phaser from "phaser";

// Default settings if no localStorage
const DEFAULT_SETTINGS = {
    difficulty: 1,
    volume: 1.0,
};

export class SpeedSelect extends Phaser.Scene {
  constructor() {
    super("SpeedSelect");
  }

 init(data) {
    // Remember which game was selected
    this.gameMode = data.type;

    // Remember whether the student selected Game or Tutorial
    this.isTutorial = data.isTutorial ?? false;
}

  create() {
    const { width, height } = this.scale;

        // Load stored or default volume
        this.volume = parseFloat(localStorage.getItem("volume"));
        if (isNaN(this.volume)) this.volume = DEFAULT_SETTINGS.volume;

        // Store volume globally
        this.game.sfxVolume = Math.max(0, Math.min(1, this.volume));
        this.game.playSFX = (scene, key, config = {}) => {
            scene.sound.play(key, {
                ...config,
                volume: this.game.sfxVolume,
            });
        };

        // Sync music immediately
        if (this.game.musicManager) {
            this.game.musicManager.setVolume(this.game.sfxVolume);
        }

    // --- Background ---
    this.add.image(width / 2, height / 2, "home_bg")
      .setOrigin(0.5)
      .setDisplaySize(width, height)
      .setDepth(0);

    // Moving clouds
    this.clouds = [];
    this.cloudSpeed = 0.3;

    const baseSpacing = 550;
    const numClouds = Math.ceil(this.scale.width / baseSpacing) + 3;

    for (let i = 0; i < numClouds; i++) {
  	const xOffset = i * baseSpacing + Phaser.Math.Between(-80, 80);

  	const cloud = this.add.image(
    	    xOffset,
    	    this.scale.height * 0.47 + Phaser.Math.Between(-40, 40),
    	    "home_clouds"
  	)
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
      if ((this.game?.sfxVolume ?? this.sound.volume) > 0)
        this.sound.play("selection");

     this.scene.start("MainScene", {
    type: this.gameMode,
    skipInstructions: false
});
    gameType: this.gameMode
});
    });

    const titleText = this.add.text(width / 2, -50, "Select a speed!", {
      fontSize: "56px",
      fontFamily: '"Jersey 10", sans-serif',
      color: "#dcc89f",
      stroke: "#7f1a02",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(5);

    this.tweens.add({
      targets: titleText,
      y: height * 0.15,
      duration: 800,
      ease: "Bounce.easeOut"
    });

    // --- Speed Buttons (styled like level buttons) ---
    const speeds = [
      { label: "0.5x", multiplier: 0.5 },
      { label: "1.0x", multiplier: 1 },
      { label: "1.5x", multiplier: 1.5 },
    ];

    const spacing = 100;
    const blockHeight = (speeds.length - 1) * spacing;
    const startY = height / 2 - blockHeight / 2;

    speeds.forEach((speed, i) => {
      this._makeUIButton(
        width / 2,
        startY + i * spacing,
        speed.label,
        () => {
          if ((this.game?.sfxVolume ?? this.sound.volume) > 0)
            this.sound.play("selection");

          // Stop menu music before gameplay
          this.game.musicManager?.stop();

         this.scene.start("MainScene", {
    type: this.gameMode,
    speedMultiplier: speed.multiplier,
    isTutorial: this.isTutorial,
    skipInstructions: true
});
        }
      );
    });

    // ESC goes back
    this._escKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ESC
    );
  this._escKey.on("down", () => {
    this.scene.start("MainScene", {
        type: this.gameMode,
        skipInstructions: false
    });
});
  }

  // cloud wrap logic
  update() {
  	if (!this.clouds) return;

  	const width = this.scale.width;

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
    const w = 200;
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
      const t = this.tweens.add({
        targets: btn,
        scale: 0.92,
        duration: 90,
        yoyo: true,
      });
      t.once("complete", onClick);
    });

    return btn;
  }
}

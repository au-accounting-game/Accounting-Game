// src/scenes/MainMenuScene.js
import { Scene } from "phaser";

export class MainMenuScene extends Scene {
  constructor() {
    super("MainMenuScene");
  }

  init() {
    // fades in from loading screen ONLY
    if (this.fadeFlag != true) {
      this.cameras.main.fadeIn(1000, 0, 0, 0);
      this.fadeFlag = true;
    }
  }

  // Normalize saved volume: accept 0..1, 0..100, or "80%"
  _readSavedVolume() {
    const raw = localStorage.getItem("volume");
    if (raw == null) return 1;
    let s = String(raw).trim();
    const pct = s.endsWith("%");
    if (pct) s = s.slice(0, -1).trim();
    let n = parseFloat(s);
    if (!Number.isFinite(n)) return 1;
    if (pct || n > 1) n = n / 100;
    return Phaser.Math.Clamp(n, 0, 1);
  }

  create() {
    const { width, height } = this.scale;

    // --- Restore global SFX/music volume BEFORE any sound plays ---
    const vol = this._readSavedVolume();
    this.game.sfxVolume = vol;
    this.sound.volume = vol;

    // --- Background ---
    this.add
      .image(width / 2, height / 2, "home_bg")
      .setOrigin(0.5)
      .setDisplaySize(width, height)
      .setDepth(0);

    // --- Foreground ---
    this.add
      .image(width / 2, height / 2, "home_fg")
      .setOrigin(0.5)
      .setDisplaySize(width, height)
      .setDepth(2);

    // --- Clouds (single sprite, Pac-Man wrap) ---
    this.clouds = this.add
      .image(width / 2, height / 2 - 25, "home_clouds")
      .setOrigin(0.55)
      .setScale(0.8)
      .setDepth(1);
    this.cloudSpeed = 0.3;

    // Title Screen Text
    this.add
      .image(width / 2, height / 2, "home_text")
      .setDepth(3);
    
    // --- Music (start 2s in). Do NOT restart if already playing. ---
    const setMusic = () => {
      // Ensure manager knows the current volume
      this.game.musicManager?.setVolume(this.game.sfxVolume ?? 1.0);

      // Only start if nothing is playing; otherwise keep the current track
      if (!this.game.musicManager?.isPlaying()) {
        this.game.musicManager?.play(this, "menu_bgm", { seek: 2 });
      }
    };
    if (this.sound.locked) this.sound.once("unlocked", setMusic);
    else setMusic();

    // --- Menu Buttons ---
    const options = [
      { label: "Effect of Transactions", scene: "GM3Level2" },
      { label: "Balance the Accounting Equation", scene: "GM3Level1" },
      { label: "Debit/Credit", type: "debit_credit" },
      { label: "5 Elements", type: "accounting" },
      { label: "Accounting Errors", scene: "GM3Level3" },
    ];

    const createButton = (x, y, labelText, onClick) => {
      // visual body of the button
      const border = this.add.rectangle(0, 0, 464, 54, 0x7f1a02).setDepth(3);
      border.setStrokeStyle(3, 0xdcc89f);

      // button hitbox
      const rect = this.add.rectangle(0, 0, 460, 50, 0x7f1a02).setDepth(3);

      // label: text on top of button
      const label = this.add.text(0, 0, labelText, {
        fontSize: "128px",
        fontFamily: '"Jersey 10", sans-serif',
        color: "#dcc89f",
      }).setOrigin(0.5).setDepth(3).setScale(0.23);

      const button = this.add.container(x, y, [border, rect, label]).setDepth(3);

      rect.setInteractive({ useHandCursor: true });

      rect.on("pointerover", () => {
        rect.setFillStyle(0xa8321a);
        this.tweens.add({ targets: button, scale: 1.05, duration: 150, ease: "Power1" });
      });

      rect.on("pointerout", () => {
        rect.setFillStyle(0x7f1a02);
        this.tweens.add({ targets: button, scale: 1, duration: 150, ease: "Power1" });
      });

      rect.on("pointerdown", () => {
        // Prevent interaction if SSO not done
        if (!sessionStorage.getItem('sso_completed')) return;

        if ((this.game.sfxVolume ?? this.sound.volume) > 0) this.sound.play("selection");
        const tween = this.tweens.add({ targets: button, scale: 0.9, duration: 80, yoyo: true, ease: "Power1" });
        tween.once("complete", onClick);
      });

      return button;
    };

    const totalButtons = options.length;

    // controls menu spacing and placement
    const spacing = 65;
    const blockHeight = (totalButtons - 1) * spacing;
    const startY = height / 2 - blockHeight / 2 + 50;

    options.forEach((option, index) => {
      createButton(
        width / 2,
        startY + index * spacing,
        option.label,
        () => {
          this.game.musicManager?.stop();

          if (option.scene) {
            this.startGameMode3(option.scene);
          } else {
            this.startGame(option);
          }
        }
      );
    });

    // ***** ICONS *****

    // --- Icon constants ---
    const ICON_Y = 50;    // y-pos of icons
    const ICON_MARGIN = 45;   // distance from screen edge
    const BASE_SCALE = 0.075;    // base scale (size) for all icons
    const HOVER_SCALE = BASE_SCALE * 1.15;    // scale on hover

    // Settings Icon
    const settingsIcon = this.add.image(ICON_MARGIN, ICON_Y, "settingsIcon")
      .setInteractive({ useHandCursor: true })
      .setScale(BASE_SCALE).setDepth(5);

    // behavior on mouseover
    settingsIcon.on("pointerover", () => {
      this.tweens.killTweensOf(settingsIcon);
      this.tweens.add({ targets: settingsIcon, scale: HOVER_SCALE, duration: 120, ease: "Sine.easeOut" });
      settingsIcon.setTint(0xffffff);
    });

    // behavior on mouse exit
    settingsIcon.on("pointerout", () => {
      this.tweens.killTweensOf(settingsIcon);
      this.tweens.add({ targets: settingsIcon, scale: BASE_SCALE, duration: 120, ease: "Sine.easeIn" });
      settingsIcon.clearTint();
    });

    // behavior on click
    settingsIcon.on("pointerdown", () => {
      // Prevent interaction if SSO not done
      if (!sessionStorage.getItem('sso_completed')) return;
      
      if ((this.game.sfxVolume ?? this.sound.volume) > 0) this.sound.play("selection");
      this.tweens.killTweensOf(settingsIcon);
      this.tweens.add({
        targets: settingsIcon,
        scale: BASE_SCALE * 0.92,
        duration: 70,
        yoyo: true,
        ease: "Sine.easeInOut",
        onComplete: () => this.scene.start("SettingsScene"),
      });
    });
    
    // Leaderboard Icon
    const leader_icon = this.add.image(width - ICON_MARGIN, ICON_Y, "leaderboardIcon")
      .setInteractive({ useHandCursor: true })
      .setScale(BASE_SCALE).setDepth(5);

    // behavior on mouseover
    leader_icon.on("pointerover", () => {
      this.tweens.killTweensOf(leader_icon);
      this.tweens.add({ targets: leader_icon, scale: HOVER_SCALE, duration: 120, ease: "Sine.easeOut" });
      leader_icon.setTint(0xffffff);
    });

    // behavior on mouse exit
    leader_icon.on("pointerout", () => {
      this.tweens.killTweensOf(leader_icon);
      this.tweens.add({ targets: leader_icon, scale: BASE_SCALE, duration: 120, ease: "Sine.easeIn" });
      leader_icon.clearTint();
    });

    // behavior on click
    leader_icon.on("pointerdown", () => {
      // Prevent interaction if SSO not done
      if (!sessionStorage.getItem('sso_completed')) return;
      
      if ((this.game.sfxVolume ?? this.sound.volume) > 0) this.sound.play("selection");
      this.tweens.killTweensOf(leader_icon);
      this.tweens.add({
        targets: leader_icon,
        scale: BASE_SCALE * 0.92,
        duration: 70,
        yoyo: true,
        ease: "Sine.easeInOut",
        onComplete: () => this.scene.start("Leaderboard"),
      });
    });

    // --- SSO OVERLAY LOGIC ---
    const createSSOOverlay = () => {
      if (sessionStorage.getItem('sso_completed')) return;

      const overlay = document.createElement('div');
      overlay.id = 'login-modal-overlay'; // Added ID for easier debugging
      Object.assign(overlay.style, {
          position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
          backgroundColor: 'rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(10px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: '999999', pointerEvents: 'all'
      });

      const modal = document.createElement('div');
      Object.assign(modal.style, {
          backgroundColor: '#ffffff', width: '380px', borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden',
          textAlign: 'center', fontFamily: 'system-ui, sans-serif'
      });

      modal.innerHTML = `
          <div style="background: #03244d; padding: 25px; color: white;">
              <div style="background: #dd550c; width: 45px; height: 45px; border-radius: 50%; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; font-weight: bold;">AU</div>
              <h2 style="margin: 0; font-size: 1.4rem;">Sign-In Required</h2>
          </div>
          <div style="padding: 30px;">
              <p style="color: #4b5563; margin-bottom: 25px;">Please log in with SSO to continue.</p>
              <button id="sso-submit-trigger" style="background: #03244d; color: white; border: none; padding: 14px 28px; border-radius: 8px; cursor: pointer; width: 100%;">
                  Log In with Auburn SSO
              </button>
          </div>
      `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      modal.querySelector('#sso-submit-trigger').onclick = () => {
          sessionStorage.setItem('sso_completed', 'true');
          window.location.href = "https://accounting-game.cse.eng.auburn.edu/saml/login";
      };
    };

    // CALL THE OVERLAY
    this.time.delayedCall(1000, createSSOOverlay);
  }

  // OLD VOLUME SLIDER CODE, MAY REUSE
  /*
    // --- Volume Button (top-left) ---
    this.volumeButton = this.add.circle(ICON_MARGIN, ICON_Y, 63, 0x7f1a02)
      .setDepth(5).setInteractive();
    this.volumeButton.setStrokeStyle(2, 0xdcc89f);

    // Icon
    this.volumeIcon = this.add.image(ICON_MARGIN, ICON_Y, "volumeIcon")
      .setDisplaySize(100, 100).setDepth(6);

    // Hover effect
    this.volumeButton.on("pointerover", () => this.volumeButton.setFillStyle(0xa8321a));

    this.volumeButton.on("pointerover", () => {
      this.tweens.killTweensOf(volumeButton);
      this.tweens.add({ targets: volumeButton, scale: HOVER_SCALE, duration: 120, ease: "Sine.easeOut" });
      volumeButton.setTint(0xffffff);
    });
    
    this.volumeButton.on("pointerout",  () => this.volumeButton.setFillStyle(0x7f1a02));
    this.volumeButton.on("pointerdown", () => this.toggleVolumeSlider());
    */
  

  update() {
    if (this.clouds) {
      this.clouds.x -= this.cloudSpeed;
      // Pac-Man wrap
      if (this.clouds.x + this.clouds.displayWidth / 2 < 0)
        this.clouds.x = this.scale.width + this.clouds.displayWidth / 2;
      if (this.clouds.x - this.clouds.displayWidth / 2 > this.scale.width)
        this.clouds.x = -this.clouds.displayWidth / 2;
    }
  }

  startGame(selectedOptions) {
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      // speed select BEFORE game starts (GM 1 and 2)
      this.scene.start("SpeedSelect", { type: selectedOptions.type });
      //this.scene.start("MainScene", { type: selectedOptions.type });
    });
  }

  startGameMode3(sceneKey) {
    this.cameras.main.fadeOut(500, 0, 0, 0);

    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start(sceneKey);
    });
  }


  // DON'T NEED?
  toggleVolumeSlider() {
    if (this.volumeSliderBox) {
      this.volumeSliderBox.destroy();
      this.volumeSliderTrack.destroy();
      this.volumeSliderKnob.destroy();
      this.volumeSliderBox = null;
      this.volumeSliderTrack = null;
      this.volumeSliderKnob = null;
    } else {
      const boxWidth = 40;
      const boxHeight = 120;
      const boxX = this.volumeButton.x;
      const boxY = this.volumeButton.y + boxHeight / 2 + 30;

      this.volumeSliderBox = this.add
        .rectangle(boxX, boxY, boxWidth, boxHeight, 0x7f1a02)
        .setOrigin(0.5).setDepth(3)
        .setStrokeStyle(2, 0xdcc89f);

      const sliderX = boxX;
      const sliderY = boxY;
      this.volumeSliderTrack = this.add.rectangle(sliderX, sliderY, 4, 100, 0xdcc89f).setDepth(4);

      let knobY = sliderY + 50 - this.game.sfxVolume * 100;
      this.volumeSliderKnob = this.add
        .circle(sliderX, knobY, 8, 0xdcc89f)
        .setDepth(5)
        .setInteractive({ draggable: true });

      this.volumeSliderKnob.setStrokeStyle(2, 0x7f1a02);
      this.input.setDraggable(this.volumeSliderKnob);

      this.volumeSliderKnob.on("pointerover", () => this.volumeSliderKnob.setFillStyle(0xf5deb3));
      this.volumeSliderKnob.on("pointerout",  () => this.volumeSliderKnob.setFillStyle(0xdcc89f));

      this.volumeSliderKnob.on("drag", (pointer, dragX, dragY) => {
        const clampedY = Phaser.Math.Clamp(dragY, sliderY - 50, sliderY + 50);
        this.volumeSliderKnob.y = clampedY;

        const newVolume = 1 - (clampedY - (sliderY - 50)) / 100;
        const v = Phaser.Math.Clamp(newVolume, 0, 1);

        this.game.sfxVolume = v;
        localStorage.setItem("volume", String(v));

        // Update global + MusicManager so playing music changes live
        this.sound.volume = v;
        this.game.musicManager?.setVolume(v);

        // (optional) notify other scenes/widgets
        this.game.events.emit("volume-changed", v);
      });
    }
  }
}
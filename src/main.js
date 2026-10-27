import { Game } from "phaser";
import { Preloader } from "./preloader";
import { GameOverScene } from "./scenes/GameOverScene";
import { HudScene } from "./scenes/HudScene";
import { MainScene } from "./scenes/MainScene";
import { MenuScene } from "./scenes/MenuScene";
// Removed: import { EquationScene } from "./scenes/EquationScene";
import { SplashScene } from "./scenes/SplashScene";
import { MainMenuScene } from "./scenes/MainMenuScene";
import { PauseScene } from "./scenes/PauseScene";
import { SettingsScene } from "./scenes/SettingScene";
import { Leaderboard } from "./scenes/leaderboard";
import MusicManager from "./gameobjects/MusicManager";

// Added: speed selection for GM 1 and 2
import { SpeedSelect } from "./scenes/SpeedSelect";

// NEW: GameMode 3 (3 levels)
import GM3Level1 from "./scenes/GM3Level1";
import GM3Level2 from "./scenes/GM3Level2";
import GM3Level3 from "./scenes/GM3Level3";
import GM3PauseScene from "./scenes/GM3PauseScene";

// login and dashboards for testing
import  ProfessorDash  from "./scenes/ProfessorDash.js";
import  AdminDash  from "./scenes/AdminDash.js";

import LoginScreen from "./scenes/LoginScreen";

// More information about config: https://newdocs.phaser.io/docs/3.70.0/Phaser.Types.Core.GameConfig
const config = {
  type: Phaser.AUTO,
  parent: "phaser-container",
  width: 960,
  height: 540,
  backgroundColor: "0xffffff",
  pixelArt: true,
  roundPixels: false,
  max: {
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  dom: {
    createContainer: true,
  },
  scene: [
    Preloader,
    SplashScene,
    MainScene,
    MenuScene,
    HudScene,
    GameOverScene,
    MainMenuScene,
    //NEW speed select
    SpeedSelect,  
    PauseScene,
    SettingsScene,
    // Removed: EquationScene,
    // New third gamemode scenes:
    // Removed: GM3LevelSelect,
    GM3Level1,
    GM3Level2,
    GM3Level3,
    GM3PauseScene,
    Leaderboard,
    //login screen for testing 
    LoginScreen,
    ProfessorDash,
    AdminDash,
  ],
};

const game = new Game(config);
game.musicManager = new MusicManager(game);

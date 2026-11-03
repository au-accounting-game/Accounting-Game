import { NONE, Scene } from "phaser";
import { Player } from "../gameobjects/Player";
import { ConveyorBelt } from "../gameobjects/ConveyorBelt";
import { Ball } from "../gameobjects/Ball";
import { Basket } from "../gameobjects/Basket";
import { TooltipManager } from "../gameobjects/Tooltips";
import * as XLSX from "xlsx";

export const base_url = import.meta.env.VITE_API_URL;

const DEBIT = "Debits";
const CREDIT = "Credits";
const ASSETS = "Assets";
const LIABILITIES = "Liabilities";
const NUM_BALLS_AT_TIME = 4;

const EXPENSES = "Expenses/Losses";
const REVENUES = "Revenues/Gains";
const STOCKHOLDERS_EQUITY = "Stockholders Equity";
const DESCRIPTION_MAP = new Map([
    [DEBIT, "Debit"],
    [CREDIT, "Credit"],
    [ASSETS, "A present right of an entity to an economic benefit."],
    [
        LIABILITIES,
        "A present obligation that requires an entity to transfer or otherwise provide economic benefits to others.",
    ],
    [
        STOCKHOLDERS_EQUITY,
        "The residual interest in the assets of an entity that remains after deducting its liabilities.",
    ],
    [
        EXPENSES,
        "Expenses are outflows or other using up of assets of an entity or incurrences of its liabilities (or a combination of both) from delivering or producing goods, rendering services, or carrying out other activities.",
    ],
    [
        REVENUES,
        "Inflows or other enhancements of assets of an entity or settlements of its liabilities (or a combination of both) from delivering or producing goods, rendering services, or carrying out other activities.",
    ],
]);
// Point value comes from each term's cell color in the spreadsheet, so
// recoloring a cell is all it takes to change what a term is worth
const POINTS_BY_FILL = {
    "92D050": 100, // green
    "FFFF00": 200, // yellow
    "FFC000": 300, // orange
};
const DEFAULT_POINTS = 100;

// Which worksheets each game draws from, by course. "mix" is the share of
// draws per column; without one, columns are drawn in proportion to how
// many terms they hold. Tutorial sheets already have the answer in each
// term ("Cash - Assets"), so the ball doesn't add it again.
const TERM_SOURCES = {
    default: {
        game1: { sheet: "Normal Balance - All" },
        game2: { sheet: "All" },
    },
    "ACCT 2110": {
        game1: {
            sheet: "Normal Balance-2110",
            tutorialSheet: "Normal 2110 - Tutorial",
            mix: { [DEBIT]: 0.64, [CREDIT]: 0.36 },
        },
        game2: {
            sheet: "5 Elements - 2110",
            tutorialSheet: "5 Elements 2110-Tutorial",
            mix: {
                [ASSETS]: 0.30,
                [LIABILITIES]: 0.20,
                [STOCKHOLDERS_EQUITY]: 0.05,
                [REVENUES]: 0.10,
                [EXPENSES]: 0.35,
            },
        },
    },
};

// { "Assets": [{ name, points }, ...], ... } keyed by the sheet's header row
const readTermColumns = (sheet) => {
    const columns = {};
    if (!sheet?.["!ref"]) return columns;

    const range = XLSX.utils.decode_range(sheet["!ref"]);
    for (let c = range.s.c; c <= range.e.c; c++) {
        const header = sheet[XLSX.utils.encode_cell({ r: range.s.r, c })]?.v;
        if (!header) continue;

        const terms = [];
        for (let r = range.s.r + 1; r <= range.e.r; r++) {
            const cell = sheet[XLSX.utils.encode_cell({ r, c })];
            const name = cell?.v != null ? String(cell.v).trim() : "";
            if (!name) continue;
            const fill = String(cell.s?.fgColor?.rgb ?? "").slice(-6).toUpperCase();
            terms.push({ name, points: POINTS_BY_FILL[fill] ?? DEFAULT_POINTS });
        }
        columns[String(header).trim()] = terms;
    }
    return columns;
};

const config = {
    time_limit: 90000,
    time_between_ball_spawns: 4000,         //Time in ms
    time_move_across_screen: 600,           //Higher = Slower
};

export class MainScene extends Scene {
    player = null;
    enemy_blue = null;

    points;
    game_over_timeout;

    config = config;

    game_key = "unknown";

    constructor() {
        super("MainScene");
    }

    init(data) {
        // Restore saved SFX volume
        this.game.sfxVolume = parseFloat(localStorage.getItem("volume"));
        if (isNaN(this.game.sfxVolume)) this.game.sfxVolume = 1.0;
        this.ballCount = 0;
this.correctAnswers = 0;
this.totalAttempts = 0;
this.streak = 0; // STREAK COUNTER
        this.cameras.main.fadeIn(1000, 0, 0, 0);

        // parse the workbook once; sheets are read lazily in termSource()
        if (!this.workbook) {
            const binary = this.cache.binary.get("excelData");
            this.workbook = XLSX.read(binary, { type: "array", cellStyles: true });
            this.termColumnsBySheet = {};
        }

        const NUM_BALLS = Math.ceil(
            this.config.time_limit / this.config.time_between_ball_spawns
        );
        const game_type = data.type || "accounting";
        if (game_type === "debit_credit") {
            this.config.basket_types = [DEBIT, CREDIT];
            this.config.belt_types = [NONE, NONE, NONE, DEBIT, CREDIT];
            this.config.belt_labels = [4, 5];
            this.game_key = "game1";
        } else {
            this.config.basket_types = [
                ASSETS,
                LIABILITIES,
                STOCKHOLDERS_EQUITY, // swapped
                EXPENSES, // swapped
                REVENUES,
            ];
            this.config.belt_types = [
                ASSETS,
                LIABILITIES,
                STOCKHOLDERS_EQUITY, // swapped
                EXPENSES, // swapped
                REVENUES,
            ];
            this.config.belt_labels = [1, 2, 3, 4, 5];
            this.game_key = "game2";
        }
        if (!data.skipInstructions) {
    this.scene.launch("MenuScene", { gameType: game_type });
}

        this.answer_stats = new Map(
            this.config.basket_types.map((type) => [
                type,
                { correct: 0, incorrect: 0 },
            ])
        );

        this.points = 0;
        this.game_over_timeout = this.config.time_limit / 1000;

        // keys
        this.keySpace = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.SPACE
        );
        this.keyEsc = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.ESC
        );

        this.W = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        this.A = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.S = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.D = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

        this.keyUp = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.UP
        );
        this.keyDown = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.DOWN
        );
        this.keyLeft = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.LEFT
        );
        this.keyRight = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.RIGHT
        );

        this.input.addPointer();
        this.mouse_down_last_frame = false;

        this.pit_fullnesses = [false, false, false, false];
        this.tooltip = new TooltipManager(this);

        // show system cursor in menus
        this.input.setDefaultCursor("default");

       // Settings passed from SpeedSelect
this.gameMode = data.type;
this.speedMultiplier = data.speedMultiplier || 1;
this.isTutorial = data.isTutorial ?? false;
this.skipInstructions = data.skipInstructions ?? false;
    }
    addBall() {
        if (this.balls.getLength() >= NUM_BALLS_AT_TIME) return;

        const source = this.termSource();
        const elem = this.drawTerm(source);
        if (!elem) return;

        const starting_conveyor_belt =
            this.starting_conveyor_belts[
                Math.floor(Math.random() * this.starting_conveyor_belts.length)
            ];

        const ball = new Ball(
            this,
            starting_conveyor_belt.x,
            starting_conveyor_belt.y,
            elem.name,
            elem.type,
            this.isTutorial && !source.answerInName
        );

        ball.points = elem.points;
        const hit_box_radius = Math.min(
            ball.hit_box_radius,
            (this.ball_pit_height / 5) * 2
        );
        ball.body.setCircle(hit_box_radius);
        ball.body.offset.x = -hit_box_radius;
        ball.body.offset.y = -hit_box_radius;

        ball.start();
        this.balls.add(ball);

        this.ballCount++;
    }

    checkForBall(ball, basket) {
        if (ball.state !== "picked" && ball.pit_number == null) {
            if (ball.type === basket.type) {
                // Increase the streak before calculating points
                this.streak += 1;

                // Start the multiplier at 1.3x on the third correct sort
                const multiplier = this.streak >= 3
                    ? 1 + this.streak * 0.1
                    : 1;

                const ballPoints = ball.points ?? 100;
                const basePoints = ball.been_in_wrong_basket
                    ? ballPoints / 2
                    : ballPoints;

                const awardedPoints = Math.round(basePoints * multiplier);

                this.points += awardedPoints;
                this.updateStreakUI();

		// animation
		if (this.streak < 7) {
    		    this.tweens.killTweensOf(this.streakText);
    		    this.streakText.setScale(1);

    		    this.tweens.add({
        		targets: this.streakText,
        		scale: 1.3,
        		duration: 100,
       			yoyo: true,
   		    });
		}
		if (this.streak === 7) {
    		    this.tweens.killTweensOf(this.streakText);
    		    this.streakText.setScale(1);
    		    this.startStreakPulse();
		}

                this.scene.get("HudScene").update_points(this.points);
                this.scene.get("HudScene").showPointsPopup(awardedPoints);

                ball.destroyBall();
                this.answer_stats.get(basket.type).correct += 1;
                
// Count correct answer and total attempts
this.correctAnswers += 1;
this.totalAttempts += 1;

// Update the counter displayed on screen
this.scene.get("HudScene").update_correct_answers(
    this.correctAnswers,
    this.totalAttempts
);
                if (this.game.sfxVolume > 0) {
                    this.sound.play("correct", { volume: this.game.sfxVolume });
                }
            } else {
                if (this.game.sfxVolume > 0) {
                    this.sound.play("error", { volume: this.game.sfxVolume });
                }
                ball.been_in_wrong_basket = true;
                ball.goToPit();
                this.answer_stats.get(basket.type).incorrect += 1;
                // Count incorrect answer as an attempt
this.totalAttempts += 1;

// Update the counter
this.scene.get("HudScene").update_correct_answers(
    this.correctAnswers,
    this.totalAttempts
);

		// streak broken
		this.streak = 0;
		this.updateStreakUI();
		this.stopStreakPulse();

                // Screen Shake
                const cam = this.cameras.main;
                cam.shake(200, 0.005);                
            }
        }
    }

    // streak visual
    updateStreakUI() {
        if (!this.streakText) return;
	
	//appears after 3 consecutive correct sorts
        if (this.streak >= 3) {
            this.streakText.setVisible(true);
            
            // Calculate multiplier based on streak
            const multiplier = 1 + this.streak * 0.1;

            this.streakText.setText(
                `Streak: ${this.streak} | ${multiplier.toFixed(1)}×`
            );
        } 
	else {
            this.streakText.setVisible(false);
        }
    }

    startStreakPulse() {
    	if (this.streakPulseTween) return; // already pulsing

    	    this.streakPulseTween = this.tweens.add({
            targets: this.streakText,
            scale: 1.1,
            duration: 400,
            yoyo: true,
            repeat: -1, // infinite
            ease: "Sine.easeInOut",
        });
    }

    stopStreakPulse() {
        if (this.streakPulseTween) {
            this.streakPulseTween.stop();
            this.streakPulseTween = null;
        }
        this.streakText.setScale(1);
    }

    // columns to draw from for this game, course and mode
    termSource() {
        const courses = this.registry.get("courses") ?? [];
        const course = Object.keys(TERM_SOURCES).find((c) => courses.includes(c)) ?? "default";
        const { sheet, tutorialSheet, mix } = TERM_SOURCES[course][this.game_key];
        const sheetName = this.isTutorial && tutorialSheet ? tutorialSheet : sheet;

        this.termColumnsBySheet[sheetName] ??= readTermColumns(this.workbook.Sheets[sheetName]);
        const columns = this.termColumnsBySheet[sheetName];

        const types = this.config.basket_types.filter((type) => columns[type]?.length);
        const weights = types.map((type) => mix?.[type] ?? columns[type].length);
        return { columns, types, weights, answerInName: sheetName === tutorialSheet };
    }

    // pick a column by weight, then a term from it, avoiding recent repeats
    drawTerm({ columns, types, weights }) {
        if (!types.length) return null;

        let random = Math.random() * weights.reduce((sum, w) => sum + w, 0);
        let typeIndex = types.length - 1;
        for (let i = 0; i < types.length; i++) {
            random -= weights[i];
            if (random < 0) {
                typeIndex = i;
                break;
            }
        }
        const type = types[typeIndex];
        const terms = columns[type];

        this.recentNames = this.recentNames ?? new Set();

        let term;
        let attempts = 0;
        do {
            term = terms[Math.floor(Math.random() * terms.length)];
            attempts++;
        } while (this.recentNames.has(term.name) && attempts < 10);

        this.recentNames.add(term.name);
        if (this.recentNames.size > 20) {
            this.recentNames.clear(); // forget older ones occasionally
        }

        return { name: term.name, type, points: term.points };
    }

    create() {
        if (this.sound.locked) {
            this.sound.once("unlocked", () => {
                // Always sync music volume from settings before playing
                this.game.musicManager.setVolume(this.game.sfxVolume ?? 1.0);
                this.game.musicManager.play(this, "game_bgm");
            });
        } else {
            // Always sync music volume from settings before playing
            this.game.musicManager.setVolume(this.game.sfxVolume ?? 1.0);
            this.game.musicManager.play(this, "game_bgm");
        }
        this.add.image(0, 0, "background").setOrigin(0, 0);

	// NEW: Streak indicator
	this.streakText = this.add.text(
    	this.scale.width - 20, 45, "Streak: 0",
    	{
            fontSize: "40px",
            color: "#dcc89f",
            fontFamily: '"Jersey 10", sans-serif',
    	}
	)
	.setOrigin(1, 0) // top-right of screen
        .setOrigin(1, 0)
        .setStroke("#7f1a02", 3)
        .setDepth(999);
	this.streakText.setVisible(false);

        // conveyor belts + baskets
        let belts_chosen = this.config.belt_labels;
        let belt_types = this.config.belt_types;

        this.conveyor_belts = [];
        this.baskets = [];
        this.starting_conveyor_belts = [];
        belts_chosen.forEach((belt_label) => {
            this.conveyor_belts.push(new ConveyorBelt(this));
            const BELT_HEIGHT =
                this.conveyor_belts[this.conveyor_belts.length - 1].height;

            function get_pos_from_belt_and_num(scene, belt_label, belt_num) {
                let x, y;
                if (belt_label === 2 || belt_label === 3) {
                    x = (scene.scale.width / 4) * belt_label;
                    y = belt_num * BELT_HEIGHT + BELT_HEIGHT / 2;
                } else if (belt_label === 1) {
                    x = (scene.scale.width / 4) * belt_label;
                    y =
                        scene.scale.height -
                        (belt_num * BELT_HEIGHT + BELT_HEIGHT / 2);
                } else if (belt_label === 5) {
                    y = (scene.scale.height / 3) * (belt_label - 3);
                    x = belt_num * BELT_HEIGHT + BELT_HEIGHT / 2;
                } else if (belt_label === 4) {
                    y = (scene.scale.height / 3) * (belt_label - 3);
                    x =
                        scene.scale.width -
                        (belt_num * BELT_HEIGHT + BELT_HEIGHT / 2);
                } else {
                    throw new Error("Undefined Conveyor Belt Choice");
                }
                return [x, y];
            }

            let [x, y] = get_pos_from_belt_and_num(this, belt_label, 0);
            this.conveyor_belts[
                this.conveyor_belts.length - 1
            ].set_pos_and_belt_label(x, y, belt_label);
            this.starting_conveyor_belts.push(
                this.conveyor_belts[this.conveyor_belts.length - 1]
            );

            let num_belts = NONE;
            if ([1, 2, 3].includes(belt_label)) {
                num_belts = this.scale.height / BELT_HEIGHT;
            } else if ([4, 5].includes(belt_label)) {
                num_belts = this.scale.width / BELT_HEIGHT;
            }

            let belt_num = 1;
            while (belt_num < num_belts - 2) {
                this.conveyor_belts.push(new ConveyorBelt(this));
                let [bx, by] = get_pos_from_belt_and_num(
                    this,
                    belt_label,
                    belt_num
                );
                this.conveyor_belts[
                    this.conveyor_belts.length - 1
                ].set_pos_and_belt_label(bx, by, belt_label);
                belt_num++;
            }

            let [basket_x, basket_y] = get_pos_from_belt_and_num(
                this,
                belt_label,
                belt_num
            );
            let basket = new Basket(
                this,
                basket_x,
                basket_y,
                belt_types[belt_label - 1]
            );
            basket.body.setSize(basket.width * 0.9, basket.height * 0.7);
            basket.body.setOffset(basket.width * 0.05, basket.height * 0.15);
            // Adjust basket positions to make room for long text
            if (basket.type === "Expenses/Losses") {
                basket.x += 10; // move left a bit
            } else if (basket.type === "Revenues/Gains") {
                basket.x -= 10; // move right a bit
            }

            this.tooltip.attachTo(
                basket,
                DESCRIPTION_MAP.get(belt_types[belt_label - 1]),
                { maxWidth: 250, fontSize: 14, padding: 5 }
            );

            this.baskets.push(basket);
        });

        this.conveyor_belts.forEach((belt) => {
            if ([1, 2, 3].includes(belt.belt_label))
                this.children.bringToTop(belt);
        });
        this.baskets.forEach((basket) => this.children.bringToTop(basket));

        const BELT_WIDTH = this.conveyor_belts[0].width;
        this.get_ball_pit_x = (num) => (this.scale.width / 4) * (num + 0.5);
        this.ball_pit_y = (this.scale.height / 3) * 1.5;
        this.ball_pit_width = this.scale.width / 4 - BELT_WIDTH;
        this.ball_pit_height = this.scale.height / 3 - BELT_WIDTH;

        this.balls = this.add.group();
        this.player = new Player({ scene: this });
        this.player.lastControl = "mouse"; // default

        const move_along_conveyor_belt = (scene, conveyor_belt, obj) => {
            if (obj.state === "picked" || obj.moved_by_belt_this_frame) return;
            obj.moved_by_belt_this_frame = true;
            if (
                conveyor_belt.belt_label === 2 ||
                conveyor_belt.belt_label === 3
            ) {
                obj.y += scene.scale.height / config.time_move_across_screen;
            } else if (conveyor_belt.belt_label === 1) {
                obj.y -= scene.scale.height / config.time_move_across_screen;
            } else if (conveyor_belt.belt_label === 4) {
                obj.x -= scene.scale.width / config.time_move_across_screen;
            } else if (conveyor_belt.belt_label === 5) {
                obj.x += scene.scale.width / config.time_move_across_screen;
            }
        };

        this.physics.add.overlap(
            this.conveyor_belts,
            this.balls,
            (belt, ball) => {
                if (ball.state !== "picked") {
                    if (ball.direction_belt_label == null)
                        ball.direction_belt_label = belt.belt_label;
                    if (belt.belt_label == ball.direction_belt_label)
                        move_along_conveyor_belt(this, belt, ball);
                }
            }
        );
        this.physics.add.overlap(this.balls, this.baskets, (ball, basket) =>
            this.checkForBall(ball, basket)
        );

       const startGameplay = (data) => {
    this.isTutorial = data?.isTutorial ?? this.isTutorial ?? false;
    this.scene.stop("MenuScene");
            this.input.setDefaultCursor("none"); // hide mouse in gameplay

            // Use Registry for better reliability across scenes
            this.registry.set('levelStartTime', Date.now());
            console.log(`[Timer] MainScene started via Registry:`, this.registry.get('levelStartTime'));
            
            //console.log(`[Timer] MainScene started: ${this.game.levelStartTime}`);
            
    console.log(`[Timer] MainScene started: ${this.game.levelStartTime}`);
            
            //this.difficulty = parseInt(localStorage.getItem("difficulty") || 1);
            this.time.addEvent({
		// ADDED: speed multiplier
                delay: this.config.time_between_ball_spawns / this.speedMultiplier,
                callback: this.addBall,
                callbackScope: this,
                loop: true,
            });
            this.scene.launch("HudScene", {
                remaining_time: this.game_over_timeout,
            });
            this.conveyor_belts.forEach((belt) => belt.start());
            this.player.start();

            this.time.addEvent({
                delay: 1000,
                loop: true,
                callback: () => {
                    if (this.game_over_timeout === 0) {
                        this.game.events.emit("exit-game");
                        this.scene.start("GameOverScene", {
                            points: this.points,
                            gameKey: this.game_key,
			    isTutorial: this.isTutorial, // TUTORIAL INDICATOR -> no score
                            //timeSpentPlaying: Math.floor((this.time.now - this.startTime) / 1000), // This was broken anyway
                        });
                    } else {
                        this.game_over_timeout--;
                        this.scene
                            .get("HudScene")
                            .update_timeout(this.game_over_timeout);
                    }
                },
            });
        };

if (this.skipInstructions) {
    // Start the selected game or tutorial after speed selection
    startGameplay({ isTutorial: this.isTutorial });
} else {
    this.game.events.once("start-game", startGameplay);
}

        this.game.events.on("exit-game", () => {
            this.game.events.removeListener("start-game");
            this.scene.stop("HudScene");
            this.input.setDefaultCursor("default"); // show mouse again
        });
    }

    update(time, delta) {
        this.conveyor_belts.forEach((belt) => belt.update(time, delta));
        this.player.update(time, delta);
        this.balls.getChildren().forEach((ball) => {
            ball.update(time, delta);
            ball.checkHover(this.player);
        });

        // Build one direction object from BOTH WASD and arrow keys
        let dir = { up: false, down: false, left: false, right: false };

        if (this.keyUp.isDown || this.W.isDown) {
            dir.up = true;
            this.player.lastControl = "keyboard";
        }
        if (this.keyDown.isDown || this.S.isDown) {
            dir.down = true;
            this.player.lastControl = "keyboard";
        }
        if (this.keyRight.isDown || this.D.isDown) {
            dir.right = true;
            this.player.lastControl = "keyboard";
        }
        if (this.keyLeft.isDown || this.A.isDown) {
            dir.left = true;
            this.player.lastControl = "keyboard";
        }

        // Move once per frame using normalized vector inside Player.move()
        this.player.move(dir);
        // Wrap edges
        const cam = this.cameras.main;
        if (this.player.x > cam.width) this.player.x = 0;
        else if (this.player.x < 0) this.player.x = cam.width;
        if (this.player.y > cam.height) this.player.y = 0;
        else if (this.player.y < 0) this.player.y = cam.height;

        if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
            this.scene.pause();
            this.scene.launch("PauseScene");
            this.input.setDefaultCursor("default"); // show mouse in pause
        }

        // --- Input: pick/drop ---
        if (
            Phaser.Input.Keyboard.JustDown(this.keySpace) ||
            (this.input.activePointer.leftButtonDown() &&
                !this.mouse_down_last_frame)
        ) {
            if (this.player.ball && this.player.ball.state === "picked") {
                this.player.drop();
            } else {
                let picked_up_ball = false;
                this.balls.getChildren().forEach((ball) => {
                    if (picked_up_ball) return;
                    if (
                        Phaser.Geom.Intersects.RectangleToRectangle(
                            ball.getBounds(),
                            this.player.getBounds()
                        )
                    ) {
                        this.player.pick(ball);
                        picked_up_ball = true;
                    }
                });
            }
        }

        // Right click → drop
        if (this.input.activePointer.rightButtonDown() && this.player.ball) {
            this.player.drop();
        }

        this.mouse_down_last_frame = this.input.activePointer.leftButtonDown();
    }
}



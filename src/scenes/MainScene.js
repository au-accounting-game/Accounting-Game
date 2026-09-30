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
        "A present obligation that requires an entity to transferor otherwise provide economic benefits to others.",
    ],
    [
        STOCKHOLDERS_EQUITY,
        "The residual interest in the assets of anentity that remains after deducting its liabilities.",
    ],
    [
        EXPENSES,
        "Expenses are outflows or other using up of assets of anentity or incurrences of its liabilities (or a combination of both) from delivering orproducing goods, rendering services, or carrying out other activities",
    ],
    [
        REVENUES,
        "Inflows or other enhancements of assets of an entityor settlements of its liabilities (or a combination of both) from delivering orproducing goods, rendering services, or carrying out other activities",
    ],
]);
const POINTS_200 = new Set([
    "Accrued Interest",
    "Accrued Rent",
    "Accrued Salaries",
    "Accrued Utilities",
    "Accumulated Depletion",
    "Accumulated Depreciation",
    "Accumulated Profits",
    "Additional Paid in Capital - Common Stock",
    "Additional Paid in Capital - Preferred Stock",
    "Additional Paid in Capital - Treasury Stock",
    "Advertising Revenue",
    "Advertising Earnings",
    "Allowance for Doubtful Accounts",
    "Amortization Expense",
    "Amortization Costs",
    "Artist Fee Expense",
    "Artist Fees",
    "Attorney Fees",
    "Bad Debt Expense",
    "Bad Debts",
    "Checking Accounts",
    "Commissions Expense",
    "Commissions Costs",
    "Commissions Payable",
    "Computer Hardware",
    "Consulting Expense",
    "Consulting Fees",
    "Copyright",
    "Cost of Goods Sold",
    "Cost of Sales",
    "Customer Lists",
    "Customer Deposits",
    "Customer Refunds Payable",
    "Delivery Expense",
    "Delivery Fees",
    "Depreciation Expense",
    "Depreciation Costs",
    "Dividends Payable",
    "Equipment Rental Expense",
    "Equipment Rental Fees",
    "Finished Goods Inventory",
    "Franchise",
    "Income Taxes Expense",
    "Income Taxes Costs",
    "Income Taxes Payable",
    "IT Expense",
    "IT Costs",
    "License Fees and Taxes Expense",
    "License Fees and Taxes",
    "Loss on Disposal of Property,Plant, & Equipment",
    "Loss on Sale of Intangibles",
    "Loss on Sale of Investments",
    "Medicare Taxes Expense",
    "Medicare Taxes Cost",
    "Medicare Taxes Payable",
    "Money Market Accounts",
    "Office Rent Expense",
    "Office Rent Fees",
    "Penalties and Fines Expense",
    "Penalties and Fines",
    "Petty Cash",
    "Property Taxes Expense",
    "Property Tax Fees",
    "Promotional Materials Expense",
    "Raw Materials Inventory",
    "Rent Expense",
    "Rent Fees",
    "Royalties Expense",
    "Royalties Paid",
    "Sales Discounts",
    "Sales Returns and Allowances",
    "Savings Accounts",
    "Security Services Expense",
    "Security Services Costs",
    "Service Charge Expense",
    "Service Charges",
    "Service Equipment",
    "Short-Term Bonds Receivable",
    "Social Security Taxes Expense",
    "Social Security Taxes Paid",
    "Social Security Taxes Payable",
    "Software Subscription Expense",
    "Software Subscription Costs",
    "Supplies Inventory",
    "Trade Show Expense",
    "Trade Show Costs",
    "Trademark",
    "Training Expense",
    "Training Costs",
    "Treasury Stock",
    "Unemployment Taxes Expense",
    "Unemployment Taxes Costs",
    "Unemployment Taxes Payable",
    "Wages Payable",
    "Warranty Liability",
    "Dividends Payable",
    "Membership & Subscription Revenue",
    "Preferred Stock",
    "Gain on Disposal of Property, Plant, & Equipment",
    "Gain on Sale of Intangibles",
    "Gain on Sale of Investments",
    "Gain on Settlement of Lawsuit",
]);

const POINTS_300 = new Set([
    "Foreign Exchange Losses",
    "Foreign Exchange Gains",
    "Natural Resources",
    "Accumulated Other Comprehenseive Income",
    "Advances to Officers, Directors, and Employees",
    "Marketable Securities",
    "Investments-Equity Method",
    "Tax Refund Receivable",
    "Purchases",
    "Research and Development Expense",
    "Research and Development Costs",
    "Trading Securities",
    "Certificates of Deposit",
    "Organizational Costs",
    "Investments-Available-for-Sale Securities",
    "Loss from Impairment",
    "Transportation-In",
    "Deferred Tax Assets",
    "Investments-Trading Securities",
    "Discount on Bonds Payable",
    "Discount on Notes Payable",
    "Investment in Subsidiary",
    "Treasury Bills",
    "Unrealized Loss on Available for Sale Securities",
    "Unrealized Gain on Available for Sale Securities",
    "Unrealized Gain on Trading Securities",
    "Allowance to Adjust Available-for-Sale Securities to Market",
    "Allowance to Adjust Trading Securities to Market",
    "Capital Lease Liability",
    "Deferred Income Tax Liability",
    "Grant Revenue",
    "Grant Receipts",
    "Investment lncome - Equity Method",
    "Premium on Bonds Payable",
    "Premium on Notes Payable",
    "Provision for Lawsuit",
    "Purchase Allowances",
    "Purchases Discounts",
    "Revenue Received in Advance",
    "Royalties Payable",
    "Royalty Income",
    "Cash Over and Short",
]);

const assignPoints = (name) => {
    if (POINTS_300.has(name)) return 300;
    if (POINTS_200.has(name)) return 200;
    return 100; // default
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
	this.streak = 0; // STREAK COUNTER
        this.cameras.main.fadeIn(1000, 0, 0, 0);

        if (!this.normalBalance || !this.allSheet) {
            const binary = this.cache.binary.get("excelData");
            const workbook = XLSX.read(binary, { type: "array" });
            this.normalBalance = XLSX.utils
                .sheet_to_json(workbook.Sheets["Normal Balance - All"] ?? {}, {
                    header: 1,
                })
                .slice(1);
            this.allSheet = XLSX.utils
                .sheet_to_json(workbook.Sheets["All"] ?? {}, { header: 1 })
                .slice(1);
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
        this.scene.launch("MenuScene", { gameType: game_type });

        this.answer_stats = new Map(
            this.config.basket_types.map((type) => [
                type,
                { correct: 0, incorrect: 0 },
            ])
        );

        this.points = 0;
        this.game_over_timeout = this.config.time_limit / 1000;

        this.scene.launch("MenuScene");

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

        // this comes from SpeedSelect
    	this.gameMode = data.type;
    	this.speedMultiplier = data.speedMultiplier || 1; // default to normal
    }
    addBall() {
        if (this.balls.getLength() >= NUM_BALLS_AT_TIME) return;

        let elem;

        if (this.game_key === "game1") {
            this.recentNames = this.recentNames ?? new Set();

            const type = Math.random() < 0.5 ? DEBIT : CREDIT;
            const arr =
                type === DEBIT
                    ? this.normalBalance.map((row) => row[0]).filter(Boolean)
                    : this.normalBalance.map((row) => row[1]).filter(Boolean);

            let name;
            let attempts = 0;
            do {
                name = arr[Math.floor(Math.random() * arr.length)];
                attempts++;
            } while (this.recentNames.has(name) && attempts < 10);

            this.recentNames.add(name);
            if (this.recentNames.size > 20) {
                this.recentNames.clear(); // forget older ones occasionally
            }

            elem = { name, type, points: assignPoints(name) };
        } else if (this.game_key === "game2") {
            const types = [
                ASSETS,
                LIABILITIES,
                EXPENSES,
                REVENUES,
                STOCKHOLDERS_EQUITY,
            ];
            const typeIndex = Math.floor(Math.random() * types.length);
            const type = types[typeIndex];

            const colIndex = typeIndex;
            const col = this.allSheet
                .map((row) => row?.[colIndex])
                .filter(Boolean);

            this.recentNames = this.recentNames ?? new Set();

            let name;
            let attempts = 0;
            do {
                name = col[Math.floor(Math.random() * col.length)];
                attempts++;
            } while (this.recentNames.has(name) && attempts < 10);

            this.recentNames.add(name);
            if (this.recentNames.size > 20) {
                this.recentNames.clear();
            }

            elem = { name, type, points: assignPoints(name) };
        }

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
            this.isTutorial
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

    getRandomNBElements(total) {
        const credits = this.normalBalance
            .map((row) => row?.[1])
            .filter(Boolean);
        const debits = this.normalBalance
            .map((row) => row?.[0])
            .filter(Boolean);

        const [creditNum, debitNum] = this.generateRandomNumbers(
            total,
            2,
            false,
            0.4
        );

        const creditSamples = this.sample(credits, creditNum).map((name) => ({
            name,
            type: "Credits",
            points: assignPoints(name),
        }));

        const debitSamples = this.sample(debits, debitNum).map((name) => ({
            name,
            type: "Debits",
            points: assignPoints(name),
        }));

        return this.shuffle([...creditSamples, ...debitSamples]);
    }

    getRandomAllElements(total) {
        const typeNames = [
            ASSETS,
            LIABILITIES,
            EXPENSES,
            REVENUES,
            STOCKHOLDERS_EQUITY,
        ];

        const colCount = this.allSheet[0]?.length ?? 0;
        const typeNums = this.generateRandomNumbers(total, colCount, true);

        return this.shuffle(
            Array.from({ length: colCount }).flatMap((_, i) => {
                const col = this.allSheet
                    .map((row) => row?.[i])
                    .filter(Boolean);
                return this.sample(col, typeNums[i]).map((name) => ({
                    name,
                    type: typeNames[i] ?? `type${i}`,
                    points: assignPoints(name),
                }));
            })
        );
    }

    sample(arr, count) {
        return arr
            .slice()
            .sort(() => Math.random() - 0.5)
            .slice(0, count);
    }
    shuffle(arr) {
        return arr.slice().sort(() => Math.random() - 0.5);
    }
    generateRandomNumbers(sum, count, equal = true, ratio = 0.4) {
        if (equal) {
            return Array(count).fill(Math.ceil(sum / count));
        }

        if (count === 2) {
            const min = Math.floor(sum * ratio);
            const max = sum - min;
            const first = Math.floor(Math.random() * (max - min + 1)) + min;
            const second = sum - first;
            return [first, second];
        }
        const points = Array.from({ length: count - 1 }, () =>
            Math.floor(Math.random() * (sum - count + 1))
        ).sort((a, b) => a - b);

        points.unshift(0);
        points.push(sum);

        return Array.from(
            { length: count },
            (_, i) => points[i + 1] - points[i]
        );
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

        this.game.events.once("start-game", (data) => {
	    this.isTutorial = data?.isTutorial ?? false; // game or tutorial?
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
        });

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



import { GameObjects } from "phaser";

export class Basket extends GameObjects.Container {
    constructor(scene, x, y, type) {
        super(scene, x, y);
        this.type = type;

        // create bakset image
        this.basketImage = new GameObjects.Image(scene, 0, 0, "basket");
        this.basketImage.setOrigin(0.5, 0.5);
        this.basketImage.displayWidth = 90;
        this.basketImage.displayHeight = 90;

        let displayLabel = type;

if (type === "Expenses/Losses") {
    displayLabel = "Expenses\n/Losses";
} else if (type === "Revenues/Gains") {
    displayLabel = "Revenues /\nGains";
}
        this.textLabel = new GameObjects.Text(scene, 0, 0, displayLabel, {
            fontSize: "18px",
            fill: "#ffffff",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            padding: { x: 5, y: 3 },
            align: "center",
            wordWrap: { width: 200, useAdvancedWrap: true },
        });
        this.textLabel.setOrigin(0.5, 0.5);

        this.add([this.basketImage, this.textLabel]);
        this.scene.add.existing(this);
        this.scene.physics.add.existing(this);

        this.body.setSize(
            this.basketImage.displayWidth,
            this.basketImage.displayHeight
        );
        this.body.setOffset(
            -this.basketImage.displayWidth / 2,
            -this.basketImage.displayHeight / 2
        );
        this.body.setImmovable(true);

        this.setSize(
            this.basketImage.displayWidth,
            this.basketImage.displayHeight
        );
    }

    start() {
        this.setActive(true);
        this.setVisible(true);
    }
}


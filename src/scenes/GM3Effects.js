// src/scenes/GM3Effects.js
// Effect of Transactions without the Net Income column (A = L + SE).
// The "| Net Income" version is still GM3Level2.
import GM3Level2 from "./GM3Level2";

export default class GM3Effects extends GM3Level2 {
  constructor() {
    super("GM3Effects", { withNetIncome: false });
  }
}

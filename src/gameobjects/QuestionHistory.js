// Tracks which Accounting Equation questions a student has already been
// shown, per difficulty bank, so replays bias toward fresh questions
// instead of cycling the same handful every time within the time limit.
// Backed by the /gm3/seen-questions endpoints, which resolve the student's
// identity server-side from their session cookie - the frontend never
// needs to know the username itself. Locally (no SSO session), the
// backend just returns/no-ops gracefully, so everything is simply
// treated as unseen.

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Orders `rows` (each with a stable .question string) so unseen questions
// come first (shuffled among themselves), then previously-seen ones (also
// shuffled) - replays favor fresh content but still gracefully cycle once
// every question in the bank has been seen.
export async function orderByRecency(rows, apiBase, bankKey) {
    let seenSet = new Set();
    try {
        const res = await fetch(`${apiBase}/gm3/seen-questions?bank=${encodeURIComponent(bankKey)}`);
        const seenList = await res.json();
        seenSet = new Set(seenList);
    } catch (err) {
        console.error("Failed to fetch seen-question history, treating all as unseen", err);
    }

    const unseen = rows.filter(r => !seenSet.has(r.question));
    const seen = rows.filter(r => seenSet.has(r.question));
    return [...shuffle(unseen), ...shuffle(seen)];
}

// Marks the given (already-shown) rows as seen for this student/bank.
// Fire-and-forget - a failure here (no session, network hiccup) shouldn't
// block the player from moving on to the game-over screen.
export function markSeen(apiBase, bankKey, rows) {
    const questions = (rows || []).filter(Boolean).map(r => r.question);
    if (!questions.length) return;

    fetch(`${apiBase}/gm3/seen-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bank: bankKey, questions }),
    }).catch(err => console.error("Failed to record seen questions", err));
}

# The Floor

A web recreation of the duel format from *The Floor*, wrapped in a seeded
single-elimination bracket. Hot-seat: one screen, one room, a human judge on the
keyboard. No backend, no accounts — everything runs client-side and persists to
localStorage.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 210 tests
npm run build
```

## The rules

Both duelists start with 45 seconds. Only one clock ever runs.

- **Correct** — the answering player's clock stops, the next clue loads, and the
  opponent's clock starts at the same instant.
- **Wrong** — nothing happens. The clock keeps running and you can guess as often
  as you like, so the judge never needs to press anything.
- **Pass** — a flat 3-second penalty, next clue, *still your turn*.

The duel ends the instant either clock reaches zero. That player loses. There is
no last question.

Edge cases the app commits to, and which the test suite pins down: a pass penalty
that exceeds the remaining time ends the duel with the clock reading exactly `0.0`,
never negative; a clock at exactly zero is elimination; a judgement that lands
after the buzzer does not rescue the player who ran out; and both clocks stop when
the browser tab loses focus, charging the hidden interval to nobody.

## Categories

Nobody owns a category. One is drawn at random before each duel from the pool the
host enabled, preferring topics the tournament has not used yet, and prompts
already seen are filtered out. Sixteen Polish-language categories ship with the app (plus World Capitals); the in-app editor
adds more, including image clues, stored locally.

## Judge keys

| Key | Action |
|---|---|
| `Space` | correct |
| `P` / `→` | pass (−3s) |
| `Z` / `Backspace` | undo the last judgement — lands paused so the argument costs nobody time |
| `Esc` | pause / resume |
| `A` | hide or show the answer |
| `F` | fullscreen |

## How it is put together

The duel is a **pure state machine with no concept of a timer** — the reducer never
reads a clock, never sets a timeout, and never imports React. Every event carries a
`now` timestamp from `performance.now()`, and elapsed time is always
`now - clockStartedAt`.

That is what makes the rules exact rather than approximate. Because deduction comes
from real timestamps instead of assuming ~16ms per animation frame, a frame that
arrives 250ms late deducts exactly 250ms and detects the timeout on that frame; a
clock can never silently overshoot zero. It also means the entire rule set is
testable with plain synchronous unit tests and no fake timers.

| Path | What lives there |
|---|---|
| [src/engine/duel/](src/engine/duel/) | `settle` (the time primitive), the reducer, the undo stack |
| [src/engine/bracket/](src/engine/bracket/) | seeding, bye handling, advancing winners |
| [src/engine/pickCategory.ts](src/engine/pickCategory.ts) | the pre-duel category draw |
| [src/content/](src/content/) | category schema, bundled JSON, localStorage |
| [src/tournament/](src/tournament/) | ties bracket, categories and duels together |
| [src/react/](src/react/) | hooks, screens, components — the only place React appears |

Roughly 85% of the assertions land on the engine. React Testing Library is used
only where it earns its keep: keyboard wiring, the visibility pause, editor CRUD
and bracket rendering. No UI test asserts on elapsed milliseconds.

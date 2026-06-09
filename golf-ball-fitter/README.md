# ⛳ Golf Ball Fitter

A quiz-style web app that matches a golfer to their **ideal golf ball** based on a few
questions about their swing — using the performance characteristics the **manufacturers
themselves** publish about their balls.

Answer six questions (swing speed, skill, priority, flight, feel, budget) and the app
ranks current golf balls from Titleist, TaylorMade, Callaway, Bridgestone, Srixon, Wilson,
Vice, Snell and Kirkland, with a match score and a plain-English explanation of *why* each
ball fits you.

## How it works

```
data/golf_balls.csv   ← canonical, aggregated manufacturer data (the deliverable dataset)
        │  python3 scripts/build_data.py
        ▼
data/golf_balls.js     ← generated; lets the app run straight from disk (no server needed)
        │
index.html + assets/   ← the quiz UI and the scoring engine
```

The matching logic in `assets/quiz.js` mirrors how manufacturers fit golfers to balls:

- **Swing speed → fit window + compression.** Bridgestone fits explicitly by driver swing
  speed (Tour B X/XS for >105 mph, RX/RXS for <105 mph); general industry guidance ties
  compression to speed. Both are encoded.
- **Cover, spin, flight & feel → fit by characteristics.** Mirrors Titleist's approach of
  fitting on feel, trajectory and greenside spin rather than compression alone.
- **Skill & budget** shape which *category* of ball is sensible (tour vs. distance vs.
  soft, premium vs. value).

Each ball gets a weighted 0–100 match score; the top three are shown with reasons, and a
full ranked table of all balls is available.

See [`data/SOURCES.md`](data/SOURCES.md) for the dataset columns, methodology, and the
manufacturer/third-party sources behind the numbers.

## Running it

It's a static site — no build tooling or dependencies.

**Option A — just open it:** open `index.html` in your browser. (The app loads
`data/golf_balls.js`, so it works directly from disk.)

**Option B — serve it locally:**

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Updating the data

`data/golf_balls.csv` is the single source of truth. After editing it, regenerate the JS
the app reads:

```bash
python3 scripts/build_data.py
```

## Disclaimer

Recommendations are educational and approximate. Compression and spin figures are largely
third-party measured (most manufacturers don't publish them). For a real recommendation,
use a manufacturer's fitting tool or get fit in person.

# 🎯 Quiz Hub

A static, GitHub Pages–hosted collection of **quiz-style single-page apps**. Each quiz
matches you to an "ideal pick" based on a few quick answers. The root page is a hub that
lists every quiz; each quiz is a self-contained SPA in its own folder.

**Live site:** https://jstephenperry.github.io/vibe-code-quiz-junk/

## Quizzes

| Quiz | Folder | What it does |
| --- | --- | --- |
| ⛳ Golf Ball Fitter | [`golf-ball-fitter/`](golf-ball-fitter/) | Matches you to your ideal golf ball from 40 balls across 9 brands, based on the manufacturers' own stated ball characteristics. |

## Repo layout

```
index.html            ← hub landing page (lists all quizzes)
assets/
  hub.css, hub.js     ← hub styling + rendering
  quizzes.js          ← registry of quizzes (add an entry to list a new one)
golf-ball-fitter/     ← first quiz SPA (self-contained: html, css, js, data)
.github/workflows/
  deploy-pages.yml    ← deploys the whole repo to GitHub Pages on push to main
.nojekyll             ← serve files as-is (no Jekyll processing)
```

## Adding a new quiz

1. Create a new top-level folder (e.g. `coffee-brew-finder/`) containing a self-contained
   SPA with its own `index.html`.
2. Add an entry to `assets/quizzes.js` with its `title`, `emoji`, `path`, `blurb`, `tags`.
3. Commit — the hub will list it automatically, and the deploy workflow publishes it.

## Running locally

It's a static site with no build tooling.

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Or open `index.html` directly in a browser.

## Deployment

The site deploys via GitHub Actions (`.github/workflows/deploy-pages.yml`) on every push to
`main`. **One-time setup:** in the repo, go to **Settings → Pages → Build and deployment →
Source = "GitHub Actions"**. After that, every push to `main` publishes automatically.

/* Golf Ball Fitter — UI controller. Renders the quiz, collects answers, and
 * shows ranked recommendations. Pure DOM, no dependencies. */

(function () {
  "use strict";

  const { QUESTIONS, recommend } = window.GolfBallFitter;
  const BALLS = window.GOLF_BALLS || [];

  const answers = {};
  let step = 0;

  // Elements
  const els = {
    quizScreen: document.getElementById("quiz-screen"),
    resultsScreen: document.getElementById("results-screen"),
    questionContainer: document.getElementById("question-container"),
    progressFill: document.getElementById("progress-fill"),
    progressLabel: document.getElementById("progress-label"),
    backBtn: document.getElementById("back-btn"),
    nextBtn: document.getElementById("next-btn"),
    resultsContainer: document.getElementById("results-container"),
    resultsSummary: document.getElementById("results-summary"),
    restartBtn: document.getElementById("restart-btn"),
    detailsToggle: document.getElementById("details-toggle"),
    fullRanking: document.getElementById("full-ranking")
  };

  // ---- Quiz rendering -----------------------------------------------------
  function renderQuestion() {
    const q = QUESTIONS[step];
    const selected = answers[q.id];

    const optionsHtml = q.options
      .map((opt, i) => {
        const isSel = selected !== undefined && selected === opt.value;
        const sub = opt.sub ? `<span class="opt-sub">${opt.sub}</span>` : "";
        return `<button class="option ${isSel ? "selected" : ""}" type="button" data-index="${i}">
            <span class="opt-label">${opt.label}</span>${sub}
          </button>`;
      })
      .join("");

    els.questionContainer.innerHTML = `
      <h2 class="question-title">${q.title}</h2>
      ${q.help ? `<p class="question-help">${q.help}</p>` : ""}
      <div class="options">${optionsHtml}</div>`;

    els.questionContainer.querySelectorAll(".option").forEach((btn) => {
      btn.addEventListener("click", () => {
        answers[q.id] = q.options[Number(btn.dataset.index)].value;
        renderQuestion();
      });
    });

    // Progress + nav
    const pct = Math.round((step / QUESTIONS.length) * 100);
    els.progressFill.style.width = pct + "%";
    els.progressLabel.textContent = `Question ${step + 1} of ${QUESTIONS.length}`;
    els.backBtn.disabled = step === 0;
    els.nextBtn.disabled = answers[q.id] === undefined;
    els.nextBtn.textContent = step === QUESTIONS.length - 1 ? "See my matches →" : "Next →";
  }

  function next() {
    const q = QUESTIONS[step];
    if (answers[q.id] === undefined) return;
    if (step < QUESTIONS.length - 1) {
      step++;
      renderQuestion();
    } else {
      showResults();
    }
  }

  function back() {
    if (step > 0) {
      step--;
      renderQuestion();
    }
  }

  // ---- Results rendering --------------------------------------------------
  function showResults() {
    const ranked = recommend(answers, BALLS);
    const top = ranked.slice(0, 3);

    els.resultsSummary.textContent = summaryText();

    els.resultsContainer.innerHTML = top
      .map((r, i) => resultCard(r, i))
      .join("");

    els.fullRanking.innerHTML = `
      <h3>All ${ranked.length} balls, ranked for you</h3>
      <table class="rank-table">
        <thead><tr><th>#</th><th>Ball</th><th>Match</th><th>Cover</th><th>Comp.</th><th>Category</th></tr></thead>
        <tbody>
          ${ranked
            .map(
              (r, i) => `<tr>
                <td>${i + 1}</td>
                <td><a href="${r.ball.url}" target="_blank" rel="noopener">${r.ball.brand} ${r.ball.model}</a></td>
                <td>${r.score}%</td>
                <td>${r.ball.cover}</td>
                <td>${r.ball.compression}</td>
                <td>${r.ball.category}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
    els.fullRanking.classList.add("hidden");
    els.detailsToggle.textContent = "Show all balls ranked";

    els.quizScreen.classList.add("hidden");
    els.resultsScreen.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resultCard(r, i) {
    const b = r.ball;
    const rank = ["Best match", "Runner-up", "Also great"][i] || `#${i + 1}`;
    const reasons = r.reasons.map((x) => `<li>${x}</li>`).join("");
    const specs = [
      `${b.pieces}-piece`,
      `${b.cover} cover`,
      `compression ${b.compression}`,
      `${b.launch} flight`,
      `${b.feel} feel`,
      `~$${b.price_usd}/dozen`
    ]
      .map((s) => `<span class="spec">${s}</span>`)
      .join("");

    return `<article class="result ${i === 0 ? "result-top" : ""}">
        <div class="result-head">
          <div>
            <span class="result-rank">${rank}</span>
            <h3 class="result-name">${b.brand} ${b.model}</h3>
          </div>
          <div class="match-badge" title="Match score">${r.score}%</div>
        </div>
        <div class="specs">${specs}</div>
        <ul class="reasons">${reasons}</ul>
        <a class="btn btn-ghost btn-small" href="${b.url}" target="_blank" rel="noopener">View at ${b.brand} →</a>
      </article>`;
  }

  function summaryText() {
    const speed = answers.speed == null ? "an average swing speed" : `a ~${answers.speed} mph swing`;
    const priorityLabel = {
      distance: "maximum distance",
      spin: "greenside spin & control",
      feel: "soft feel",
      straight: "a straighter flight",
      allaround: "all-around performance"
    }[answers.priority];
    return `Based on ${speed}, a ${answers.skill} skill level, and a priority on ${priorityLabel}, here's what the manufacturers' data points to.`;
  }

  function restart() {
    for (const k in answers) delete answers[k];
    step = 0;
    els.resultsScreen.classList.add("hidden");
    els.quizScreen.classList.remove("hidden");
    renderQuestion();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- Wire up ------------------------------------------------------------
  function init() {
    if (!BALLS.length) {
      els.questionContainer.innerHTML =
        '<p class="error">Could not load ball data. Run <code>python3 scripts/build_data.py</code> to generate <code>data/golf_balls.js</code>.</p>';
      els.nextBtn.disabled = true;
      return;
    }
    els.nextBtn.addEventListener("click", next);
    els.backBtn.addEventListener("click", back);
    els.restartBtn.addEventListener("click", restart);
    els.detailsToggle.addEventListener("click", () => {
      const hidden = els.fullRanking.classList.toggle("hidden");
      els.detailsToggle.textContent = hidden ? "Show all balls ranked" : "Hide full ranking";
    });
    renderQuestion();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

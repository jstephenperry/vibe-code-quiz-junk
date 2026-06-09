/* Renders the hub landing page from window.QUIZZES. */
(function () {
  "use strict";
  const grid = document.getElementById("quiz-grid");
  const quizzes = window.QUIZZES || [];

  if (!quizzes.length) {
    grid.innerHTML = '<p class="empty">No quizzes registered yet.</p>';
    return;
  }

  grid.innerHTML = quizzes
    .map((q) => {
      const comingSoon = q.status === "coming-soon";
      const tags = (q.tags || []).map((t) => `<span class="tag">${t}</span>`).join("");
      const inner = `
        <div class="quiz-emoji">${q.emoji || "❓"}</div>
        <h2 class="quiz-title">${q.title}</h2>
        <p class="quiz-blurb">${q.blurb || ""}</p>
        <div class="quiz-tags">${tags}</div>
        <span class="quiz-cta">${comingSoon ? "Coming soon" : "Take the quiz →"}</span>`;
      return comingSoon
        ? `<div class="quiz-card disabled">${inner}</div>`
        : `<a class="quiz-card" href="${q.path}">${inner}</a>`;
    })
    .join("");
})();

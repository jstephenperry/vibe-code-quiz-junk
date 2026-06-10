/* Registry of quiz SPAs hosted in this repo.
 * To add a new quiz: drop its app in a top-level folder, then add an entry here. */
window.QUIZZES = [
  {
    title: "Golf Ball Fitter",
    emoji: "⛳",
    path: "golf-ball-fitter/",
    blurb:
      "Answer six questions about your swing — speed, skill, priority, flight, feel, budget — and get matched to your ideal golf ball, based on what the manufacturers say about theirs.",
    tags: ["golf", "40 balls", "9 brands"],
    status: "live"
  },
  {
    title: "Golf Club Length Scanner",
    emoji: "📏",
    path: "golf-club-fitter/",
    blurb:
      "Stand in front of your camera and let on-device pose detection body-scan your wrist-to-floor measurement — then get a close-enough club length recommendation for your whole bag.",
    tags: ["golf", "camera", "pose detection"],
    status: "live"
  }
  // Example of a future quiz:
  // {
  //   title: "Coffee Brew Method Finder",
  //   emoji: "☕",
  //   path: "coffee-brew-finder/",
  //   blurb: "Find your ideal brewing method based on taste and effort.",
  //   tags: ["coffee"],
  //   status: "coming-soon"
  // }
];

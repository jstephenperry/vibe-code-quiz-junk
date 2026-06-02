/* Golf Ball Fitter — quiz definition and scoring engine.
 *
 * The scoring mirrors how manufacturers describe and fit their own balls:
 *   - Swing speed -> fit window + compression (Bridgestone-style speed fitting,
 *     plus general industry compression-by-speed guidance).
 *   - Cover / spin / flight / feel -> Titleist-style fit-by-characteristics.
 *   - Skill and budget shape which category of ball is sensible.
 */

(function (global) {
  "use strict";

  // ---- Quiz questions -----------------------------------------------------
  // Each option carries a `value` consumed by the scoring engine.
  const QUESTIONS = [
    {
      id: "speed",
      title: "How fast do you swing your driver?",
      help: "If you're not sure, use your typical driver carry distance as a guide.",
      options: [
        { label: "Under 85 mph", sub: "Driver carry under ~210 yds", value: 80 },
        { label: "85–95 mph", sub: "Carry ~210–240 yds", value: 90 },
        { label: "95–105 mph", sub: "Carry ~240–270 yds", value: 100 },
        { label: "Over 105 mph", sub: "Carry 270+ yds", value: 110 },
        { label: "Not sure", sub: "We'll assume an average speed", value: null }
      ]
    },
    {
      id: "skill",
      title: "What's your skill level?",
      help: "Roughly, your handicap.",
      options: [
        { label: "Beginner", sub: "New to golf / 25+ handicap", value: "beginner" },
        { label: "High handicap", sub: "About 18–25", value: "high" },
        { label: "Mid handicap", sub: "About 9–17", value: "mid" },
        { label: "Low handicap", sub: "About 1–8", value: "low" },
        { label: "Scratch or better", sub: "0 or plus", value: "scratch" }
      ]
    },
    {
      id: "priority",
      title: "What matters most to you?",
      help: "Pick the single thing you'd most like the ball to do.",
      options: [
        { label: "Maximum distance", sub: "Most carry and roll off the tee", value: "distance" },
        { label: "Greenside spin & control", sub: "Stop it quickly on the green", value: "spin" },
        { label: "Soft feel", sub: "A soft, responsive sensation", value: "feel" },
        { label: "Straighter flight", sub: "Less slice/hook, more forgiveness", value: "straight" },
        { label: "All-around performance", sub: "A bit of everything", value: "allaround" }
      ]
    },
    {
      id: "flight",
      title: "What ball flight do you prefer?",
      options: [
        { label: "Lower & penetrating", sub: "Cuts through wind", value: "low" },
        { label: "Medium", sub: "A balanced trajectory", value: "mid" },
        { label: "Higher", sub: "Easy to get airborne, carries far", value: "high" },
        { label: "No preference", sub: "Don't mind", value: "any" }
      ]
    },
    {
      id: "feel",
      title: "How do you like the ball to feel at impact?",
      options: [
        { label: "Soft", value: "soft" },
        { label: "Medium", value: "mid" },
        { label: "Firm", sub: "A more solid, clicky feel", value: "firm" },
        { label: "No preference", value: "any" }
      ]
    },
    {
      id: "budget",
      title: "What's your budget per dozen?",
      options: [
        { label: "Premium", sub: "Whatever it takes (~$45+)", value: "premium" },
        { label: "Mid-range", sub: "About $25–40", value: "mid" },
        { label: "Value", sub: "Under ~$25", value: "value" }
      ]
    }
  ];

  // ---- Helpers ------------------------------------------------------------
  const LEVEL = { low: 0, mid: 1, high: 2 };
  const FEEL = { soft: 0, mid: 1, firm: 2 };
  const TIER = { value: 0, mid: 1, premium: 2 };

  const clamp01 = (n) => Math.max(0, Math.min(1, n));

  // Score how well an ordinal level matches a preference (1 exact, 0.5 adjacent).
  function ordinalMatch(ballLevel, prefLevel, map) {
    if (prefLevel === "any" || prefLevel == null) return 0.7; // neutral
    const diff = Math.abs(map[ballLevel] - map[prefLevel]);
    return [1.0, 0.5, 0.15][diff];
  }

  // Target compression for a given driver swing speed (industry guidance).
  function targetCompression(speed) {
    if (speed == null) return null;
    if (speed < 85) return 60;
    if (speed < 95) return 75;
    if (speed < 105) return 90;
    return 100;
  }

  function speedWindowScore(ball, speed) {
    if (speed == null) return 0.6;
    const { swing_speed_min_mph: min, swing_speed_max_mph: max } = ball;
    if (speed >= min && speed <= max) return 1;
    const dist = speed < min ? min - speed : speed - max;
    return Math.max(0, 1 - dist / 25);
  }

  function compressionScore(ball, speed) {
    const target = targetCompression(speed);
    if (target == null) return 0.6;
    return Math.max(0, 1 - Math.abs(ball.compression - target) / 45);
  }

  function priorityScore(ball, priority) {
    const isUrethane = /urethane/i.test(ball.cover);
    const softLow = ball.compression <= 70;
    switch (priority) {
      case "distance":
        return clamp01(
          0.5 * (ball.driver_spin === "low" ? 1 : ball.driver_spin === "mid" ? 0.4 : 0) +
            0.3 * (ball.category === "distance" ? 1 : ball.category === "soft-distance" ? 0.7 : 0.3) +
            0.2 * (LEVEL[ball.launch] >= 1 ? 1 : 0.4)
        );
      case "spin":
        return clamp01(
          0.6 * (LEVEL[ball.greenside_spin] / 2) +
            0.3 * (isUrethane ? 1 : 0) +
            0.1 * (ball.category === "tour" ? 1 : 0)
        );
      case "feel":
        return clamp01(
          0.6 * (FEEL[ball.feel] === 0 ? 1 : FEEL[ball.feel] === 1 ? 0.45 : 0) +
            0.4 * clamp01(1 - ball.compression / 110)
        );
      case "straight":
        return clamp01(
          0.6 * (ball.driver_spin === "low" ? 1 : ball.driver_spin === "mid" ? 0.4 : 0) +
            0.25 * (ball.category === "distance" || ball.category === "soft-distance" ? 1 : 0.3) +
            0.15 * (ball.pieces <= 3 ? 1 : 0.4)
        );
      case "allaround":
      default:
        return clamp01(
          0.5 * (ball.category === "tour" ? 1 : 0.3) +
            0.2 * (isUrethane ? 1 : 0) +
            0.15 * (LEVEL[ball.greenside_spin] / 2) +
            0.15 * (ball.driver_spin === "mid" ? 1 : 0.4)
        );
    }
    // softLow referenced for readability of intent
  }

  function skillScore(ball, skill) {
    const isUrethane = /urethane/i.test(ball.cover);
    const durable = !isUrethane;
    const highComp = ball.compression >= 90;
    const softLow = ball.compression <= 70;
    const tourPremium = ball.category === "tour" && ball.price_tier === "premium";
    let s;
    switch (skill) {
      case "beginner":
        s = 0.5 + (durable ? 0.25 : 0) + (softLow ? 0.2 : 0) +
            (ball.driver_spin === "low" ? 0.15 : 0) - (highComp ? 0.25 : 0) - (tourPremium ? 0.15 : 0);
        break;
      case "high":
        s = 0.55 + (durable ? 0.2 : 0) + (softLow ? 0.15 : 0) +
            (ball.driver_spin === "low" ? 0.1 : 0) - (highComp ? 0.15 : 0);
        break;
      case "mid":
        s = 0.78; // mid handicappers play essentially anything well
        break;
      case "low":
        s = 0.6 + (isUrethane ? 0.25 : 0) + (ball.greenside_spin === "high" ? 0.2 : 0) - (durable ? 0.2 : 0);
        break;
      case "scratch":
      default:
        s = 0.55 + (isUrethane ? 0.3 : 0) + (ball.greenside_spin === "high" ? 0.2 : 0) - (durable ? 0.3 : 0);
        break;
    }
    return clamp01(s);
  }

  function budgetScore(ball, budget) {
    const allowed = TIER[budget];
    const tier = TIER[ball.price_tier];
    if (tier <= allowed) return 1;
    return Math.max(0, 1 - 0.55 * (tier - allowed));
  }

  // Weights sum to 100 -> final score is a 0..100 match percentage.
  const WEIGHTS = { speed: 16, compression: 10, priority: 22, flight: 12, feel: 12, skill: 12, budget: 16 };

  function scoreBall(ball, answers) {
    const parts = {
      speed: speedWindowScore(ball, answers.speed),
      compression: compressionScore(ball, answers.speed),
      priority: priorityScore(ball, answers.priority),
      flight: ordinalMatch(ball.launch, answers.flight, LEVEL),
      feel: ordinalMatch(ball.feel, answers.feel, FEEL),
      skill: skillScore(ball, answers.skill),
      budget: budgetScore(ball, answers.budget)
    };
    let total = 0;
    for (const k in WEIGHTS) total += WEIGHTS[k] * parts[k];
    return { score: Math.round(total), parts };
  }

  // Build short, manufacturer-grounded reasons for a recommendation.
  function explain(ball, answers, parts) {
    const reasons = [];
    if (answers.speed != null && parts.speed >= 0.99) {
      reasons.push(`Built for your ~${answers.speed} mph swing (maker's fit window ${ball.swing_speed_min_mph}–${ball.swing_speed_max_mph} mph).`);
    } else if (answers.speed != null && parts.speed >= 0.7) {
      reasons.push(`Sits close to your swing speed (fit window ${ball.swing_speed_min_mph}–${ball.swing_speed_max_mph} mph).`);
    }
    if (answers.speed != null && parts.compression >= 0.85) {
      reasons.push(`Compression ~${ball.compression} suits your speed.`);
    }
    switch (answers.priority) {
      case "distance":
        if (parts.priority >= 0.6) reasons.push(`Low-spinning ${ball.category} ball — marketed for distance and roll.`);
        break;
      case "spin":
        if (ball.greenside_spin === "high") reasons.push(`${ball.cover} cover delivers the high greenside spin you want.`);
        break;
      case "feel":
        if (ball.feel === "soft") reasons.push(`Soft feel (compression ~${ball.compression}) matches your priority.`);
        break;
      case "straight":
        if (ball.driver_spin === "low") reasons.push(`Low driver spin helps straighten ball flight and reduce slice/hook.`);
        break;
      case "allaround":
        if (ball.category === "tour") reasons.push(`A balanced tour ball — does a bit of everything.`);
        break;
    }
    if (answers.flight !== "any" && parts.flight >= 1) reasons.push(`${cap(ball.launch)} ball flight, as you prefer.`);
    if (answers.feel !== "any" && parts.feel >= 1 && answers.priority !== "feel") reasons.push(`${cap(ball.feel)} feel at impact, as you prefer.`);
    if (reasons.length === 0) reasons.push(`A solid match across feel, flight and fit for your profile.`);
    return reasons.slice(0, 4);
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function recommend(answers, balls) {
    return balls
      .map((ball) => {
        const { score, parts } = scoreBall(ball, answers);
        return { ball, score, parts, reasons: explain(ball, answers, parts) };
      })
      .sort((a, b) => b.score - a.score || b.ball.compression - a.ball.compression);
  }

  global.GolfBallFitter = { QUESTIONS, recommend, scoreBall, WEIGHTS };
})(window);

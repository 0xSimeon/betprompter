# ENGINE_SPEC v1.1 — Soccer Prediction Engine

## Changelog
- v1.1
  - Added dominance override for elite teams
  - Prevented over-selection of ultra-safe low-value markets
  - Explicit market usefulness scoring
  - Clarified AI vs Engine responsibilities
  - Locked deterministic final decision logic

---

## Core Principle

This engine is **rule-based and deterministic**.

- AI provides signals only
- Final decisions are made by code
- Same inputs must always produce the same outputs
- No recomputation of historical predictions

---

## Data Inputs

Per fixture:
- Fixture metadata (teams, league, kickoff time)
- Polymarket markets (if available):
  - Match Result (1X2)
  - Double Chance (1X, X2)
  - Over 1.5
  - Over 2.5
- Polymarket probabilities + total volume
- Groq analysis output
- Gemini risk flags

---

## AI Responsibilities (Strict)

### Groq (Primary Analyst)
- Analyze each market independently
- Return:
  - marketConfidence (0–100)
  - reasoning
  - qualitative lean
- Must NOT:
  - select bets
  - rank markets
  - see Gemini output

### Gemini (Risk Challenger)
- Evaluate Groq output only
- Return flags:
  - overconfidence: boolean
  - missingContext: boolean
  - cautionLevel: none | mild | strong
- Must NOT:
  - rescore markets
  - choose bets
  - influence Groq

---

## Engine Scoring (Deterministic)

Each market gets a score:

finalScore =
baseMarketScore

- polymarketSignal

- groqConfidence

- geminiPenalty


### Base Market Score
- Match Result (ML): 50
- Double Chance: 45
- Over 1.5: 48
- Over 2.5: 46

### Polymarket Signal
- +10 if volume >= threshold
- +10 if probability aligns with Groq lean
- −10 if market is extremely low payout proxy (e.g. DC at ~1.04 implied)

### Groq Confidence
- Linear scale from Groq output (max +20)

### Gemini Penalty
- mild: −15
- strong: −35
- overconfidence + missingContext together: additional −10

---

## Dominance Override (Important)

If:
- Favorite implied probability ≥ 70%
- Underdog probability ≤ 20%
- Total market volume ≥ threshold

Then:
- Allow Match Result or Over 2.5 to outrank Double Chance or Over 1.5
- Prevent “safety bias” in elite mismatches (e.g. Bayern scenarios)

This override is **rule-based**, not AI-decided.

---

## Market Selection Rules

Per fixture:
- Rank all supported markets by finalScore
- Select:
  - 1 Primary market
  - 1 Optional safer alternative (must be different market type)
- If all scores < MIN_SCORE_THRESHOLD → NO BET

---

## Bet Categories

- BANKER: finalScore ≥ 70 and no strong Gemini caution
- VALUE: finalScore 55–69
- RISKY: finalScore 40–54
- NO BET: < 40

---

## Daily Cap

- Max 5 selected bets per calendar day (GMT+1)
- Selection is global, not per league
- Highest scores win
- Others are visible but unselected

---

## Settlement & History

- Settlement is idempotent
- Once settled, a prediction is immutable
- History is append-only
- Cache expiration must never delete history

---

## Explicit Non-Goals

- No live betting
- No auto wagering
- No user-triggered recomputation

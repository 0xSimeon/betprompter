# ENGINE_SPEC v1.6 — Soccer Prediction Engine

## Changelog

- v1.6
  - **ML low-probability penalty**: ML picks penalized -8 if probability < 55% (raised from 45%)
  - **Conditional usefulness ceilings**: DC/O1.5 only blocked when ML favorite ≥ 68%
  - **Safe market base scores raised**: DC 42→48, O1.5 44→46 (can compete when ML penalized)
  - **Dominance rebalance**: Reduced EXPRESSIVE_BOOST 12→8, removed SAFE_PENALTY (was -12)
  - **Safe block boost reduced**: EXPRESSIVE_BOOST_ON_SAFE_BLOCK 6→4
  - Prevents ML over-selection in flat/uncertain matches

- v1.5
  - **DRAW drift prevention**: MATCH_RESULT Draw excluded from EXPRESSIVE_BOOST_ON_SAFE_BLOCK
  - **DRAW category cap**: MATCH_RESULT Draw cannot be BANKER (max VALUE)
  - **Stable tiebreaker**: MATCH_RESULT Draw demoted on equal scores vs Home/Away Win
  - Scoped to MATCH_RESULT only (future markets like First Half Draw unaffected)

- v1.4
  - Context-aware Gemini penalties (scale by Groq confidence)
  - Safe defaults when Gemini unavailable (assume incomplete)
  - AI/Market divergence signal (+5 for finding edges, -5 for going against market)
  - Probability validation and normalization
  - Updated scoring formula

- v1.3
  - Alignment bonus requires minimum probability (35%) to prevent Draw bias
  - Probability bonus for tiebreaking higher-probability outcomes

- v1.2
  - Draw safeguards (blocked if <15% prob or favorite >65%)
  - Confidence sanity check (cap BANKER if AI/Market diverge >25% + Gemini caution)
  - Expressive boost when safe markets blocked

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

```
finalScore = baseScore + polymarketSignal + groqConfidence + geminiPenalty + probabilityBonus + divergenceSignal
```

### Base Market Score
- Match Result (ML): 50
- Double Chance: 48 (v1.6, was 42)
- Over 1.5: 46 (v1.6, was 44)
- Over 2.5: 50

### Polymarket Signal
- +10 if volume >= threshold
- +10 if probability aligns with Groq lean (requires min 35% probability)
- −10 if market is extremely low payout proxy (e.g. DC at ~1.04 implied)
- Returns 0 when Polymarket data unavailable (no penalty)

### Groq Confidence Bonus
- HIGH: +20
- MEDIUM: +10
- LOW: +0

### Gemini Penalty (Context-Aware v1.4)

Penalties scale based on Groq's confidence level:

| Groq Confidence | Mild Caution | Strong Caution | Combined Flags |
|-----------------|--------------|----------------|----------------|
| HIGH            | −15          | −30            | −10            |
| MEDIUM          | −10          | −20            | −5             |
| LOW             | −5           | −10            | 0              |

**Safe defaults when Gemini unavailable:**
- missingContext: true (assume incomplete)
- cautionLevel: "mild" (apply light caution)

### Probability Bonus (v1.3)
- Tiebreaker for higher-probability outcomes
- Range: 0 to +8 based on probability (40%+ gets bonus)

### Divergence Signal (v1.4)
- +5 if AI probability > market by 10%+ AND Groq confidence is HIGH (finding value edge)
- −5 if AI probability < market by 15%+ (going against strong market consensus)
- 0 when Polymarket data unavailable (no penalty for missing PM)

---

## Dominance Override (Important)

If:
- Favorite implied probability ≥ 60% (v1.2)
- Underdog probability ≤ 25% (v1.2)
- Total market volume ≥ 500

Then:
- ML and Over 2.5 get +8 boost (was +12, v1.6)
- DC and Over 1.5 get no penalty (was -12, v1.6)
- Prevent "safety bias" in elite mismatches (e.g. Bayern scenarios)

This override is **rule-based**, not AI-decided.

---

## Market Selection Rules

Per fixture:
- Rank all supported markets by finalScore
- Select:
  - 1 Primary market
  - 1 Optional safer alternative (must be different market type)
- If all scores < MIN_SCORE_THRESHOLD → NO BET

### MATCH_RESULT ML Constraints (v1.6)

ML selections (Home Win, Away Win) have low-probability safeguards:

**Scoring Penalty (v1.6):**
- ML penalized -8 points if AI probability < 55%
- Prevents low-confidence ML picks from dominating
- Does not apply to Draw (has separate safeguards)

### Usefulness Ceilings (v1.6 - Conditional)

Safe markets (DC, O1.5) have usefulness ceilings that only apply when ML is a solid favorite:

**Conditional Blocking:**
- DC blocked as PRIMARY if probability > 75% AND ML favorite ≥ 68%
- O1.5 blocked as PRIMARY if probability > 78% AND ML favorite ≥ 68%
- When ML < 68%, high-probability DC/O1.5 are allowed (they're the smart choice for risky ML)

### MATCH_RESULT Draw Constraints (v1.2 + v1.5)

Draw selections within MATCH_RESULT have special handling:

**PRIMARY Selection Blocks (v1.2):**
- Draw cannot be PRIMARY if probability < 15%
- Draw cannot be PRIMARY if favorite probability > 65%

**Scoring Constraints (v1.5):**
- Draw excluded from EXPRESSIVE_BOOST_ON_SAFE_BLOCK (+4, was +6)
- Draw demoted on equal scores vs Home/Away Win (stable tiebreaker)
- Scoped to MATCH_RESULT only (future markets unaffected)

**Category Cap (v1.5):**
- MATCH_RESULT Draw cannot be BANKER (max category: VALUE)
- Draw can still be PRIMARY when legitimately highest-scoring

---

## Bet Categories

- BANKER: finalScore ≥ 70 and no strong Gemini caution (except MATCH_RESULT Draw: max VALUE)
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

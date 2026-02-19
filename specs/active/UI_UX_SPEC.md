# UI_UX_SPEC — Prediction Interface & UX Rules

## Core UX Philosophy

- Read-only, analytical UI
- No user-triggered recomputation
- No partial refreshes
- Transparency over interactivity

---

## Homepage (Fixtures)

- Default view: rolling 2-week window
- Fixtures grouped by date
- Each fixture shows:
  - Primary pick
  - Optional alternative
  - Category (Banker / Value / Risky / No Bet)
  - Engine confidence %

---

## Date Navigation

- Use a date picker OR date tabs
- Changing date:
  - Filters already-computed fixtures
  - Does NOT trigger recomputation
- No infinite scrolling across weeks

---

## Match Detail Page

Shows:
- Fixture info
- Polymarket data (if available)
- Market table with:
  - Probability
  - Volume
  - Engine score
- Final decision:
  - Primary pick
  - Alternative (if any)
  - Rationale (medium length)

---

## Refresh Behavior (Strict)

### ❌ Disallowed
- Per-match refresh buttons
- “Refresh Polymarket” UI actions
- Any refresh that bypasses AI pipeline

### ✅ Allowed
- Private system endpoint:

/refresh-all

- Re-fetches fixtures
- Re-fetches Polymarket data
- Re-runs Groq + Gemini
- Re-applies engine logic
- Endpoint is:
- private
- not linked in UI
- manually triggered by owner only

---

## Missing Polymarket Data

If Polymarket data is unavailable:
- Show label: “Market sentiment unavailable”
- Still display AI + engine decision
- Do NOT show refresh UI

---

## History Page

- Chronological list of settled predictions
- Each entry shows:
- Fixture
- Pick(s)
- Category
- Outcome (Win / Loss / Void)
- Summary stats:
- Total bets
- Win rate
- ROI proxy (optional later)

---

## Footer

Must include:
- Personal credit line (author attribution)
- Disclaimer:
- “For informational purposes only”
- “No betting advice”

---

## UX Anti-Patterns to Avoid

- Button-heavy interfaces
- Manual overrides
- User-adjustable thresholds
- Re-running past predictions


# UI_UX_SPEC v1.1 — Additions & Clarifications

This section refines the Match Details Page and homepage behavior based on engine v1.1 behavior and real user interaction issues.

---

## 1. Match Details Page — Information Hierarchy

### 1.1 Market Sentiment Placement
- Market Sentiment (Polymarket insights) MUST be displayed:
  - On the right column
  - Directly below the match header
  - Above any “Other Markets” section
- Market Sentiment is contextual, not a recommendation.

If Polymarket data is unavailable:
- Show a neutral label: “Market sentiment unavailable”
- Do NOT show refresh buttons
- Do NOT downgrade the match visually

---

## 2. Banker & Safer Alternative Cards

### 2.1 Engine Probability Display
- Each recommendation card MUST show:
  - Engine probability (e.g. “Engine probability: ~66%”)
- This probability reflects final engine output, not raw AI or Polymarket odds.

### 2.2 Labeling Rules
- PRIMARY pick:
  - Label: “Banker” or “Value” (based on engine category)
- SECONDARY pick:
  - Label: “Safer alternative”
- Do NOT show more than one alternative.

---

## 3. Other Markets Section (STRICT RULES)

### 3.1 Rendering Rules
Only render an “Other Markets” card IF:
- The engine scored the market
- The market is not blocked by correlation rules
- The market is not the selected PRIMARY or SECONDARY

### 3.2 Data Availability Rules
- If Polymarket data exists for a market:
  - Show Polymarket probabilities
- If Polymarket data does NOT exist:
  - Show AI estimate only
- If neither exists:
  - Do NOT render the market card

### 3.3 Removal Rules

- Remove:
  - Empty “Market —” placeholders
  - Duplicate market cards
  - Markets with no usable signal

---

## 4. Limited Data Explanation (One-Time)

If a fixture has partial data coverage:
- Show a single inline note near the analysis section:

“Some markets are unavailable due to limited pre-match liquidity. The engine recommendation remains valid using available signals.”

Rules:
- No warnings
- No refresh UI
- No repetition across sections

---

## 5. Score Prediction (Optional, Low Emphasis)

### 5.1 Purpose
- Score predictions are narrative context ONLY
- They are not bets and not confidence-backed

### 5.2 Display Rules
- Only show when engine category ≥ VALUE
- Display as a subtle line near the bottom of analysis:

“Expected score range: 1–0 or 2–0”

- No percentages
- No bold emphasis
- No “final score” wording

---

## 6. Tone & Copy Guidelines

- Prefer plain, spoken language:
  - “Engine probability”
  - “Market sentiment”
  - “AI analysis complete”
- Avoid:
  - Technical jargon
  - Overconfident phrasing
  - Long explanatory headers

---

## 7. Homepage Reminder (No Change to Engine)

- Homepage default view:
  - Today + next 48–72 hours
- Full 2-week window is backend-only and not user-facing by default


# UI_UX_SPEC v1.2

## Data Availability & Analysis Integrity (CRITICAL)

### Core Rule
Polymarket data is an optional enhancement, not a requirement.

Absence of Polymarket data MUST NOT:
- Trigger “limited data” states
- Suppress “The Angle”
- Downgrade confidence labels
- Change tone or visual priority
- Suggest the system is incomplete or broken

---

### Analysis Modes (Informational Only)

Each match must display exactly one analysis mode label:

- **AI-led analysis**
  - Used when Polymarket data is unavailable
- **AI + Market-backed analysis**
  - Used when Polymarket data is available

These labels are descriptive only and MUST NOT affect scoring, categories, or visibility.

---


### Messaging Rules (Strict)

Disallowed phrases:
- “Limited data”

- “Unable to generate analysis”
- “Insufficient data”
- “Incomplete analysis”

Allowed phrasing:
- “Market sentiment unavailable”
- “Analysis based on AI signals”
- “Market data not available for this fixture”

---

### The Angle (Non-Negotiable)

- “The Angle” MUST render whenever a prediction exists
- It must NEVER reference missing market data as a failure
- Narrative tone must remain confident and complete

# DEV_LOG.md

## Purpose
Persistent development log.
This file records progress so work can resume after interruptions or rate limits.

Claude must read this file at the start of every session and update it before stopping.

---

## Current Status

### Last Updated
2026-01-12 01:30 (GMT+1)

---

## Completed
- Read all spec files (ENGINE_SPEC, DATA_CONTRACT, IMPLEMENTATION_RULES, DEVOPS_WORKFLOW, TESTING_PLAYBOOK)
- Confirmed understanding of engine flow and non-negotiable rules
- **Step 1: Fixture ingestion for 2-week window** ✓
  - Added `getRollingTwoWeekDates()` to `src/lib/date.ts`
  - Added Champions League (UCL) to `src/config/leagues.ts`
  - Updated `/api/cron/weekly-fixtures` to support rolling 2-week window
  - Tested: 14 days fetched (2026-01-11 to 2026-01-24), 18 fixtures
- **Step 2: Polymarket data access** ✓
  - Fixed incorrect polymarketId values in leagues.ts (EPL=10188, La Liga=10193, etc.)
  - Rewrote polymarket.ts to use series_id queries instead of constructing slugs
  - **Removed BTTS market** from all files (not allowed per ENGINE_SPEC)
  - Verified: Polymarket now matches fixtures correctly (e.g., "Man United vs Man City")
- **Step 3: Engine scoring logic** ✓
  - Created `src/services/engine.ts` with proper scoring model
  - Implemented Gemini penalties, market risk weights, volume bonuses
  - Updated all cron routes to use `generateEnginePrediction`
  - Daily cap constant defined (DAILY_BET_CAP = 5)
- **Step 4: Groq integration** ✓
  - Groq was already primary analyst (llama-3.3-70b)
  - Outputs: narrative, keyFactors, lean, confidence, suggestedMarket, probabilities
  - Does NOT make decisions, only provides signals
- **Step 5: Gemini integration** ✓
  - Updated to return only risk flags per ENGINE_SPEC
  - New output format: `{ overconfidence: bool, missingContext: bool, cautionLevel: "none"|"mild"|"strong" }`
  - Updated types/index.ts, ai-analysis.ts, engine.ts, prediction.ts
- **Step 6: Deterministic selection logic** ✓
  - Engine uses numeric scoring with Gemini penalties
  - Added daily cap enforcement to weekly-fixtures and daily-fixtures cron routes
  - Filters fixtures below MIN_SCORE_THRESHOLD (40)
  - Keeps only top 5 per day (DAILY_BET_CAP)
- **Step 7: Settlement + history archiving** ✓
  - Settlement cron route already implemented
  - Added idempotency check to prevent duplicate entries
  - Uses `getMonthlyHistory` to check for already-settled fixtures
- **Step 8: History analytics** ✓
  - Stats overview component already shows: total predictions, win rate, banker/value win rates
  - History page with monthly filtering already implemented
- **Step 9: UI rendering** ✓
  - Verified UI components work with ENGINE_SPEC changes
  - Components use prediction/analysis data (not raw GeminiVerification)
  - Disclaimers include Gemini risk notes via engine.ts

---

## In Progress
- None - all ENGINE_SPEC tasks complete!

---

## Remaining / Next Tasks
1. ~~Fixture ingestion (2-week window)~~ ✓ DONE
2. ~~Polymarket data access~~ ✓ DONE
3. ~~Engine scoring logic~~ ✓ DONE
4. ~~Groq integration (analysis only)~~ ✓ DONE
5. ~~Gemini integration (risk flags only)~~ ✓ DONE
6. ~~Deterministic selection logic~~ ✓ DONE
7. ~~Settlement + history archiving~~ ✓ DONE
8. ~~History analytics~~ ✓ DONE
9. ~~UI rendering~~ ✓ DONE

**All ENGINE_SPEC implementation tasks complete!**

---

## Notes
- ~~Current system uses Gemini for analysis~~ FIXED: Groq is primary analyst, Gemini is risk challenger
- DATA_CONTRACT notes: Current implementation uses outcomes array (better than flat structure in spec)

### Polymarket API Investigation (2026-01-11) - RESOLVED

**Initial Problem**: polymarketId values in leagues.ts were wrong (ID 2 = NBA, not EPL!)

**Solution Found**: The `/sports` endpoint returns correct series IDs:
- EPL: 10188 (was 2)
- La Liga: 10193 (was 3)
- Bundesliga: 10194 (was 7)
- Serie A: 10203 (was 12)
- Ligue 1: 10195 (was 11)
- Champions League: 10204 (was 0)

**Fix Applied**:
1. Updated `src/config/leagues.ts` with correct polymarketId values
2. Rewrote `src/services/polymarket.ts` to use series_id queries instead of constructing slugs
3. Now matches fixtures to events by normalizing team names

**Verified**: EPL match events now load correctly (e.g., "Manchester United FC vs. Manchester City FC")


## Update – ENGINE_SPEC Implementation Complete

### Completed
- Fixed Polymarket league series_id mapping
- Rewrote Polymarket fetch logic to use series_id queries
- Verified fixture-to-market matching across top 5 leagues
- Integrated Groq as primary analyst (llama-3.3-70b)
- Integrated Gemini as risk challenger only
- Implemented deterministic selection logic with:
  - MIN_SCORE_THRESHOLD = 40
  - DAILY_BET_CAP = 5
- Ensured all predictions are stored, top 5/day marked selected
- Made settlement cron idempotent
- Verified dev build runs successfully

### In Progress
- None

### Next Tasks
- Test daily-fixtures cron in production
- Monitor API call efficiency (should be ~15/day after initial run)
- Sanity-check HISTORY page after first full settlement cycle

---

## Update – 2026-01-12: Cron Simplification & UI Fixes

### UI/UX Fixes
- **"Check Lineups" button** → Renamed to "Refresh Data" (was confusing)
- **Mobile responsiveness** → Added hamburger menu, fixed horizontal scrolling
- **Team logo alignment** → Fixed widths and min-heights for consistent alignment
- **"Other Markets" Polymarket matching** → Fixed Yes/No outcome mapping for Over/Under markets
- **Polymarket TTL** → Extended from 30 min to 48 hours (data was disappearing)

### Cron Job Consolidation (Option C: Incremental + 48hr Refresh)
**Removed:**
- `lineup-refresh` cron (not needed)
- `weekly-fixtures` cron (consolidated into daily)

**Simplified to 2 crons:**
| Cron | Schedule | What it does |
|------|----------|--------------|
| `daily-fixtures` | 04:00 UTC (05:00 GMT+1) | Fetches 2-week rolling window, analyzes NEW + 48hr fixtures |
| `settlement` | 23:00 UTC (00:00 GMT+1) | Settles all finished matches once per day |

**Daily Cron Logic:**
```
if (!existingAnalysis) → NEW fixture → Always analyze
else if (hoursUntil <= 48) → REFRESH → Re-analyze for fresh Polymarket
else → SKIP → Keep existing analysis
```

**Efficiency:**
- Day 1: ~70 API calls (initial 2-week window)
- Day 2+: ~15 API calls (5 new + 10 refresh)

### New Endpoints
- `GET /api/refresh-all` - Manual trigger to refresh all fixtures

### Bug Fixes
- Added default probabilities to AI fallback (was returning 30% risky when Groq failed)
- Added `hoursUntilKickoff()` function to date.ts

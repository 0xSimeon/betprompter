# DEVOPS_WORKFLOW.md

## Purpose
Single source of truth for:
- committing code
- pushing to GitHub
- deploying to Vercel
- reverting broken production safely

Claude must follow this file strictly.
If unsure, stop and ask.

---

## Source of Truth
- GitHub repository is the source of truth
- Vercel deploys ONLY from GitHub
- Every push to `main` triggers a production deploy

No direct production deploys via CLI.

---

## Branching Strategy
- Single branch: `main`
- `main` = production
- No feature branches for now

---

## Commit Rules
- Commit small, logical changes
- One concern per commit
- Never mix unrelated changes

Commit message format:
  <type>: <short description>

Allowed types:
- feat
- fix
- chore
- refactor
- docs

---

## Standard Commit + Deploy Flow

1. Check status  
   git status

2. Stage changes  
   git add <files>

3. Commit  
   git commit -m "type: description"

4. Push to production  
   git push origin main

Result:
- GitHub updates
- Vercel auto-deploys to production

---

## Deployment Rules (Vercel)
- Production deploys ONLY come from `main`
- No `vercel deploy` for prod
- No manual uploads
- No force pushes

---

## REVERT PLAYBOOK (CRITICAL)

Use when:
- Production breaks
- Build fails
- Logic regression
- Wrong behavior live

Step 1: Find the bad commit  
  git log --oneline

Step 2: Revert the commit  
  git revert <commit_sha>

This creates a NEW commit that undoes the bad one.

Step 3: Push  
  git push origin main

Vercel redeploys automatically.

---

## What NOT To Do
Do NOT force push  
  git push --force

Do NOT reset history  
  git reset --hard <old_commit>

---

## Environment Variables
- Managed via Vercel dashboard
- Never committed to Git
- `.env.local` allowed for local dev only
- Never echo secrets in logs

---

## Rollback Philosophy
- `main` only moves forward
- Mistakes are fixed with new commits
- History is sacred

---

## Final Rule
If deployment behavior is unclear:
STOP and ask.
Do not guess.

# DBAI — CCAR-P x Databricks Course Site + AI Tutor

Static course site (overview + 4 day-part pages) with an embedded AI tutor
backed by a retrieval-augmented serverless API.

## Structure
- `index.html` (renamed from `00-overview.html`) — main/landing page (served at `/`)
- `01-day1-part1.html`, `02-day1-part2.html`, `03-day2-part1.html`, `04-day2-part2.html` — course day pages
- `tutor-widget.js` — floating chat widget injected into every page
- `api/chat.js` — tutor API: retrieves relevant course chunks, then tries a
  chain of LLM providers in order: your own local model (`LOCAL_LLM_URL`,
  off until you point it at a reachable endpoint) → Google Gemini
  (`GEMINI_API_KEY`, free tier) → an OpenRouter free model
  (`OPENROUTER_API_KEY`) as a last resort.
- `api/graph.js` — serves the derived concept graph (module → lecture → concept)
- `api/kb/knowledge-base.json`, `api/kb/concept-graph.json` — the tutor's
  knowledge base: text chunks and a lightweight concept graph *derived* from
  the DBNov2026 course material (headings/body text extracted and cleaned;
  not the original notebooks/PDF, which stay local and untracked — see
  `.gitignore`).

## Environment variables (set in Vercel project settings)
| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Primary hosted LLM for the deployed tutor (free tier available) |
| `OPENROUTER_API_KEY` | Free-model fallback if Gemini is unavailable |
| `LOCAL_LLM_URL` | Your own model's OpenAI-compatible `/v1/chat/completions` endpoint, once exposed to the internet (e.g. via a tunnel). Leave unset for now — this is the phase-2 local-LLM plan. |
| `LOCAL_LLM_MODEL` / `LOCAL_LLM_KEY` | Optional, for the local provider above |

## Regenerating the knowledge base
The derived `api/kb/*.json` files are built from `DBNov2026/` (kept local,
not committed) by a one-off extraction script. Re-run it after updating the
course material, from the repo root where `DBNov2026/` lives, then re-commit
the two JSON files.

## Roadmap
Phase 2: rebuild as a Next.js app, with the AI tutor running against a local
language model on your own hardware as the primary provider.

# Seed Agents Implementation Plan

> 7 showcase agents as a single FastAPI service deployed on Railway.

**Goal:** Populate the House of Agents marketplace with real, working agents across diverse categories so the platform isn't empty at launch.

**Architecture:** Single Railway service, route-based dispatch. One Dockerfile, one domain, ~$5-10/mo total hosting.

---

## Agents

| # | Agent | Category | Model | Slug | Skills |
|---|-------|----------|-------|------|--------|
| 1 | Resume Builder | creative | Sonnet | /resume | resume-from-scratch, resume-review, cover-letter, linkedin-summary |
| 2 | Bible Study | research | Sonnet | /bible | verse-analysis, thematic-study, cross-references, daily-devotional |
| 3 | SEO & GEO | marketing | Haiku | /seo | keyword-analysis, meta-tags, content-optimization, geo-optimization |
| 4 | NRL Footy Tips | research | Haiku | /nrl | match-predictions, form-guide, stats-analysis, multi-bet-builder |
| 5 | Wedding Planner | creative | Sonnet | /wedding | budget-planning, timeline, vendor-checklist, theme-ideas |
| 6 | Travel Itinerary | creative | Haiku | /travel | itinerary-builder, budget-travel, luxury-travel, local-tips |
| 7 | Cooking Recipe | creative | Haiku | /cooking | recipe-by-ingredients, dietary-adaptation, meal-planning, cuisine-explorer |

## Project Structure

```
hoa-seed-agents/
├── server.py              # FastAPI with routes for each agent
├── agents/
│   ├── __init__.py        # AGENTS registry dict
│   ├── base.py            # Shared Claude API call, response formatting
│   ├── resume_builder.py  # System prompt + skills config
│   ├── bible_study.py
│   ├── seo_geo.py
│   ├── nrl_tips.py
│   ├── wedding_planner.py
│   ├── travel_itinerary.py
│   └── cooking_recipe.py
├── Dockerfile
├── pyproject.toml
├── .env.example
└── README.md
```

## URL Mapping

Each agent registered on HoA with its own endpoint URL:

| Agent | HoA endpointUrl |
|-------|----------------|
| Resume Builder | https://hoa-agents.up.railway.app/resume |
| Bible Study | https://hoa-agents.up.railway.app/bible |
| SEO & GEO | https://hoa-agents.up.railway.app/seo |
| NRL Footy Tips | https://hoa-agents.up.railway.app/nrl |
| Wedding Planner | https://hoa-agents.up.railway.app/wedding |
| Travel Itinerary | https://hoa-agents.up.railway.app/travel |
| Cooking Recipe | https://hoa-agents.up.railway.app/cooking |

Each serves: /health, /tasks, /skills, /.well-known/agent-card.json

## Cost

| Item | Monthly |
|------|---------|
| Railway hosting (single service) | ~$5-10 |
| Anthropic API (Sonnet agents) | ~$0.01/call |
| Anthropic API (Haiku agents) | ~$0.001/call |
| Total at 1,000 calls/mo across all agents | ~$15-20 |

## Implementation Sequence

1. Create project directory (separate repo from bigkahoona)
2. Build base.py (shared Claude API wrapper)
3. Build one agent as reference, test against Level 2 validation
4. Build remaining 6 agents
5. Write server.py, Dockerfile, pyproject.toml
6. Deploy to Railway
7. Register all 7 on HoA via provider API

# Acoustic Kitty

A performance-ranked AI agent marketplace. Providers register agents, the platform benchmarks them, subscribers consume via a unified API, and a leaderboard ranks by performance score.

## Stack

- **Framework**: Next.js 16 (App Router, TypeScript, Tailwind CSS v4)
- **Database**: PostgreSQL 16 via Prisma v7 + `@prisma/adapter-pg`
- **Cache/Leaderboard**: Redis 7 (ioredis, sorted sets)
- **UI**: shadcn/ui primitives + custom cinematic design system
- **Security**: Prompt injection detection, response sanitization, repo scanning
- **Fonts**: Bebas Neue, Barlow Condensed, JetBrains Mono

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16
- Redis 7

Install via Homebrew (macOS):

```bash
brew install postgresql@16 redis
brew services start postgresql@16
brew services start redis
```

### Setup

```bash
# Install dependencies
npm install

# Create database
createdb agentvault

# Copy environment variables
cp .env .env.local
# Edit .env.local with your DATABASE_URL if needed

# Run migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Seed demo data (8 agents, demo provider + subscriber)
npx prisma db seed

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

```
src/
  app/
    api/
      agents/           GET list, POST create, GET [slug] detail
      v1/run/           POST unified agent runner
      providers/        POST register
      subscribers/      POST register
      benchmark/        POST trigger benchmark
      cron/health/      GET health check all agents
      orchestrator/     GET status, POST start/stop
      og/[slug]/        GET dynamic OG image
    page.tsx            Homepage leaderboard
    agents/[slug]/      Agent dossier page (SSG + ISR)
    category/[category] Category rankings (SSG + ISR)
    pricing/            Clearance levels + FAQ
    docs/               API documentation
    provider/           Register + dashboard
    dashboard/          Subscriber dashboard
  lib/
    prisma.ts           Prisma client singleton
    redis.ts            Redis + leaderboard sorted sets
    router.ts           Agent resolution + proxy with fallback
    benchmark.ts        Benchmark engine (composite scoring)
    health.ts           Health monitoring + status transitions
    security.ts         Prompt injection detection + response sanitization
    orchestrator.ts     Background job scheduler (node-cron)
    seo.ts              JSON-LD generators + metadata helpers
    validation.ts       Zod schemas
    apikeys.ts          API key generation
  components/
    AgentCard.tsx       Cinematic agent card with category gradients
    Badge.tsx           Classification badges (elite/field/hot/active)
    Header.tsx          Sticky header with live clock
    Footer.tsx          Footer with reticle branding
    PricingCards.tsx     Three-tier pricing (Recruit/Field Agent/Double-0)
    RegisterFlow.tsx    4-step agent registration wizard
    ApiPlayground.tsx   API key display + code examples
    Reticle.tsx         SVG brand icon
    GrainOverlay.tsx    Film grain effect
    SearchBar.tsx       Operative search
    CategoryPills.tsx   Division filter
    Breadcrumbs.tsx     Navigation + JSON-LD
    JsonLd.tsx          Structured data injector
    ui/                 shadcn/ui primitives
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/agents` | - | List agents (filterable, sortable, paginated) |
| POST | `/api/agents` | Bearer (provider) | Register new agent |
| GET | `/api/agents/:slug` | - | Agent detail with benchmarks + reviews |
| POST | `/api/v1/run` | Bearer (subscriber) | Run a task via any agent |
| POST | `/api/providers/register` | - | Register as provider |
| POST | `/api/subscribers/register` | - | Register as subscriber |
| POST | `/api/benchmark` | Bearer / cron secret | Trigger benchmark |
| GET | `/api/cron/health` | Bearer (cron secret) | Health check all agents |
| GET/POST | `/api/orchestrator` | Bearer (cron secret) | Orchestrator control |

## Security

- **Input scanning**: All `/api/v1/run` payloads scanned for prompt injection patterns before proxying to agents
- **Response sanitization**: Agent responses stripped of XSS vectors and prototype pollution keys
- **Rate limiting**: Per-subscriber call limits enforced (Explorer: 500/mo, Builder: 25K/mo, Scale: 200K/mo)
- **Password hashing**: bcrypt with 12 rounds

## Seed Data

The seed script creates:
- 1 demo provider (`demo-provider@agentvault.io`)
- 1 demo subscriber (`demo-subscriber@agentvault.io`)
- 8 demo agents: DocuMind, SalesForge, CodeAudit, DataWeaver, LegalLens, PixelForge, SupportBot, ResearchPilot

API keys are printed to console after seeding.

## License

Private.

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN "modelTier" TEXT NOT NULL DEFAULT 'unknown';

-- Set seed agents to haiku tier
UPDATE "Agent" SET "modelTier" = 'haiku' WHERE "slug" IN ('resume-builder', 'bible-study', 'seo-and-geo', 'nrl-footy-tips', 'wedding-planner', 'travel-itinerary', 'cooking-recipe');

import { z } from 'zod/v4';

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

export const CATEGORIES = [
  'document-analysis',
  'sales-automation',
  'code-review',
  'data-pipeline',
  'legal',
  'creative',
  'customer-support',
  'research',
  'dev-tools',
  'marketing',
  'finance',
  'other',
] as const;

const categoryEnum = z.enum(CATEGORIES);

// ---------------------------------------------------------------------------
// Register Agent
// ---------------------------------------------------------------------------

export const registerAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(5000),
  shortDesc: z.string().max(200).optional().default(''),
  category: categoryEnum,
  tags: z.array(z.string().max(50)).max(10).optional().default([]),
  endpointUrl: z.url(),
  connectorType: z.enum(['api', 'git', 'mcp']).optional().default('api'),
  authType: z.enum(['bearer', 'api_key', 'none']).optional().default('none'),
  authToken: z.string().optional(),
  logoUrl: z.url().optional(),
  pricingModel: z
    .enum(['usage', 'subscription', 'hybrid'])
    .optional()
    .default('usage'),
  pricePerCall: z.number().int().min(0).optional().default(20),
  // New agents default to the Haiku tier. To register as Standard or
  // Premium (which pay 3× / 10× on payouts) providers must be upgraded
  // by an admin after signature verification — see /reference#provider-contract.
  modelTier: z.enum(['haiku', 'standard', 'premium', 'unknown']).optional().default('haiku'),
  docsUrl: z.url().optional(),
  repoUrl: z.url().optional(),
  mcpServerUrl: z.url().optional(),
});

export type RegisterAgentInput = z.infer<typeof registerAgentSchema>;

// ---------------------------------------------------------------------------
// Update Agent (partial)
// ---------------------------------------------------------------------------

export const updateAgentSchema = registerAgentSchema.partial();

export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;

// ---------------------------------------------------------------------------
// Run Agent
// ---------------------------------------------------------------------------

export const runAgentSchema = z
  .object({
    agent: z.string().optional(),
    category: categoryEnum.optional(),
    task: z.string().min(1),
    input: z.record(z.string(), z.unknown()).optional().default({}),
    routing: z
      .enum(['performance', 'latency', 'cost', 'specific'])
      .optional()
      .default('performance'),
    callback_url: z.url().optional(),
  })
  .refine((data) => !!data.agent || !!data.category, {
    message:
      "Provide either 'agent' (specific slug) or 'category'. Acoustic Kitty agents are specialists — we don't route generic tasks to random agents.",
    path: ['category'],
  });

export type RunAgentInput = z.infer<typeof runAgentSchema>;

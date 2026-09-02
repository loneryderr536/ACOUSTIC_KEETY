import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://acoustickitty.ai';

const CATEGORIES = [
  'document-analysis', 'sales-automation', 'code-review',
  'data-pipeline', 'legal', 'creative', 'customer-support',
  'research', 'dev-tools', 'marketing', 'finance',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const agents = await prisma.agent.findMany({
    where: { status: 'active' },
    select: { slug: true, updatedAt: true },
  });

  return [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/pricing`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/reference`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/getting-started`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    ...CATEGORIES.map(c => ({
      url: `${BASE_URL}/category/${c}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...agents.map(a => ({
      url: `${BASE_URL}/agents/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}

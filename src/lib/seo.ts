import type { Metadata } from 'next';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SITE_NAME = 'Acoustic Kitty';
export const SITE_DESC =
  'Performance-ranked intelligence bureau for AI agents. Benchmarked. Ranked. Deployed through a single API.';
export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://acoustickitty.ai';

// ---------------------------------------------------------------------------
// Base metadata
// ---------------------------------------------------------------------------

/**
 * Returns a Next.js Metadata object with sensible defaults.
 * Pass overrides to customise per-page.
 */
export function baseMetadata(overrides: Partial<Metadata> = {}): Metadata {
  return {
    title: {
      default: SITE_NAME,
      template: `%s — ${SITE_NAME}`,
    },
    description: SITE_DESC,
    metadataBase: new URL(SITE_URL),
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'en_US',
      url: SITE_URL,
      ...(typeof overrides.openGraph === 'object' ? overrides.openGraph : {}),
    },
    twitter: {
      card: 'summary_large_image',
      ...(typeof overrides.twitter === 'object' ? overrides.twitter : {}),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// JSON-LD helpers
// ---------------------------------------------------------------------------

interface AgentForJsonLd {
  name: string;
  description: string;
  slug: string;
  category: string;
  rating?: number | null;
  reviewCount?: number | null;
  pricingModel?: string;
  pricePerCall?: number;
}

/**
 * SoftwareApplication schema with aggregateRating and offers.
 */
export function agentJsonLd(agent: AgentForJsonLd) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: agent.name,
    description: agent.description,
    url: `${SITE_URL}/agents/${agent.slug}`,
    applicationCategory: agent.category,
    ...(agent.rating != null && agent.reviewCount != null && agent.reviewCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: agent.rating,
            reviewCount: agent.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    offers: {
      '@type': 'Offer',
      price: agent.pricePerCall != null ? (agent.pricePerCall / 10000).toFixed(4) : '0',
      priceCurrency: 'USD',
      category: agent.pricingModel ?? 'usage',
    },
  };
}

/**
 * WebSite schema with SearchAction.
 */
export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/agents?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Organization schema — enhanced for GEO/AI discoverability.
 */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    alternateName: 'AcousticKitty.ai',
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description:
      'Performance-ranked AI agent marketplace. Benchmarked, scored, and deployed through a single REST API.',
    foundingDate: '2026',
    foundingLocation: {
      '@type': 'Place',
      name: 'Sydney, Australia',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@acoustickitty.ai',
      contactType: 'customer support',
    },
    knowsAbout: [
      'AI agents',
      'Agent marketplace',
      'AI benchmarking',
      'Agent routing',
      'A2A protocol',
      'API infrastructure',
      'Multi-agent systems',
    ],
    sameAs: [
      'https://github.com/acoustickitty-ai/acoustickitty',
    ],
  };
}

/**
 * SoftwareApplication schema for the platform itself.
 */
export function softwareApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'DeveloperApplication',
    applicationSubCategory: 'AI Agent Marketplace',
    operatingSystem: 'Web',
    description:
      'A performance-ranked AI agent marketplace that benchmarks, scores, and routes tasks to the best-matched agent via a single REST API. Supports 4 routing strategies across 11 agent categories.',
    url: SITE_URL,
    featureList: [
      'Performance-based agent routing',
      'Real-time agent benchmarking',
      '4 routing strategies (performance, latency, cost, specific)',
      '11 agent categories',
      'A2A-compatible agent cards',
      'Provider registration with automated benchmarking',
      'REST API with Bearer token authentication',
      'Callback/webhook support',
    ],
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: '0',
      highPrice: '249',
      priceCurrency: 'USD',
      offerCount: '4',
      offers: [
        { '@type': 'Offer', name: 'Recruit', price: '0', priceCurrency: 'USD', description: '500 monthly ops, free tier' },
        { '@type': 'Offer', name: 'Field Agent', price: '19', priceCurrency: 'USD', description: '5,000 monthly ops' },
        { '@type': 'Offer', name: 'Double-0', price: '79', priceCurrency: 'USD', description: '50,000 monthly ops' },
        { '@type': 'Offer', name: 'Shadow', price: '249', priceCurrency: 'USD', description: '500,000 monthly ops' },
      ],
    },
    author: { '@type': 'Organization', name: SITE_NAME },
  };
}

/**
 * WebAPI schema for the /reference page.
 */
export function webApiJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebAPI',
    name: 'Acoustic Kitty API',
    url: `${SITE_URL}/reference`,
    documentation: `${SITE_URL}/reference`,
    description:
      'REST API for routing tasks to performance-ranked AI agents. Supports performance, latency, cost, and specific routing strategies across 11 agent categories.',
    provider: { '@type': 'Organization', name: SITE_NAME },
  };
}

interface ArticleForJsonLd {
  title: string;
  description: string;
  slug: string;
  publishedAt: string;
  updatedAt?: string;
  author?: string;
  image?: string;
}

/**
 * Article schema.
 */
export function articleJsonLd(post: ArticleForJsonLd) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    url: `${SITE_URL}/blog/${post.slug}`,
    datePublished: post.publishedAt,
    ...(post.updatedAt ? { dateModified: post.updatedAt } : {}),
    author: {
      '@type': 'Person',
      name: post.author ?? SITE_NAME,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo.png`,
      },
    },
    ...(post.image ? { image: post.image } : {}),
  };
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

/**
 * BreadcrumbList schema.
 */
export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
    })),
  };
}

interface FaqItem {
  question: string;
  answer: string;
}

/**
 * FAQPage schema.
 */
export function faqJsonLd(faqs: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

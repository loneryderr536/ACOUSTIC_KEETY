import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ensureOrchestrator } from './bootstrap';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function getClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set — cannot create database connection');
  }
  ensureOrchestrator();
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  globalForPrisma.prisma = client;
  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return getClient()[prop as keyof PrismaClient];
  },
});

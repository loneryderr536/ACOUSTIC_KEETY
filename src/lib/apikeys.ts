import { nanoid } from 'nanoid';

export function generateApiKey(): string {
  return `ak_live_${nanoid(32)}`;
}

export function generateTestApiKey(): string {
  return `ak_test_${nanoid(32)}`;
}

import { prisma } from '@/lib/prisma';

/**
 * Webhook deduplication.
 *
 * Stripe redelivers events on retry — and BigKahoona's webhook route had no
 * dedup at all before this, so a redelivered `invoice.paid` would reset a
 * subscriber's credits twice and a redelivered payout event would double-count
 * revenue. This is the standalone service's `WebhookEvent` table, ported.
 *
 * Ordering note: `markEventProcessed` is deliberately called AFTER the handler
 * succeeds. If the handler throws we return non-2xx, Stripe retries, and the
 * event is still unmarked — which is what we want. The cost is that a crash
 * between a successful handler and this write leaves the event replayable, so
 * handlers should stay idempotent where they cheaply can.
 */
export async function isDuplicateEvent(eventId: string): Promise<boolean> {
  const existing = await prisma.webhookEvent.findUnique({ where: { id: eventId } });
  return Boolean(existing);
}

export async function markEventProcessed(eventId: string, type: string): Promise<void> {
  try {
    await prisma.webhookEvent.create({ data: { id: eventId, type } });
  } catch {
    // Unique violation = another concurrent delivery of the same event won the
    // race. Harmless; the work is done either way.
  }
}

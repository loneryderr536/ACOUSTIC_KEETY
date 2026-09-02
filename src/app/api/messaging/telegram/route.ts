import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRedisClient } from '@/lib/redis';
import { handleMessage, handleCallback } from '@/lib/messaging/gateway';
import {
  sendMessage,
  answerCallbackQuery,
  inlineKeyboard,
  sendChatAction,
  type TelegramUpdate,
} from '@/lib/messaging/telegram';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  // Verify bot token is configured
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: 'Telegram not configured' }, { status: 503 });
  }

  const update: TelegramUpdate = await request.json();

  // Handle callback queries (button presses)
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const platformUserId = String(cb.from.id);

    await answerCallbackQuery(cb.id);

    const link = await prisma.messagingLink.findUnique({
      where: { platform_platformUserId: { platform: 'telegram', platformUserId } },
    });

    if (!link) {
      await sendMessage(chatId, 'Please link your account first. Send /start');
      return NextResponse.json({ ok: true });
    }

    await sendChatAction(chatId);
    const response = await handleCallback(link.userId, 'telegram', cb.data);
    await sendMessage(
      chatId,
      response.text,
      response.buttons ? inlineKeyboard(response.buttons) : undefined
    );
    return NextResponse.json({ ok: true });
  }

  // Handle text messages
  if (update.message?.text) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const platformUserId = String(msg.from.id);
    const text = msg.text!;

    // /start — account linking
    if (text === '/start') {
      const redis = getRedisClient();
      if (!redis) {
        await sendMessage(chatId, 'Service temporarily unavailable. Try again later.');
        return NextResponse.json({ ok: true });
      }

      const code = nanoid(6).toUpperCase();
      await redis.set(
        `link:${code}`,
        JSON.stringify({ platform: 'telegram', platformUserId }),
        'EX',
        600
      );

      await sendMessage(
        chatId,
        `Welcome to Acoustic Kitty.\n\nTo get started, link your account:\n\n1. Go to acoustickitty.ai/link\n2. Sign in with Google\n3. Enter code: *${code}*\n\nCode expires in 10 minutes.`
      );
      return NextResponse.json({ ok: true });
    }

    // Check if linked
    const link = await prisma.messagingLink.findUnique({
      where: { platform_platformUserId: { platform: 'telegram', platformUserId } },
    });

    if (!link) {
      await sendMessage(chatId, 'Please link your account first. Send /start');
      return NextResponse.json({ ok: true });
    }

    // Route through gateway
    await sendChatAction(chatId);
    const response = await handleMessage({
      userId: link.userId,
      platform: 'telegram',
      text,
    });
    await sendMessage(
      chatId,
      response.text,
      response.buttons ? inlineKeyboard(response.buttons) : undefined
    );
  }

  return NextResponse.json({ ok: true });
}

const API_BASE = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    date: number;
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name: string };
    message: { chat: { id: number }; message_id: number };
    data: string;
  };
}

export async function sendMessage(chatId: number, text: string, replyMarkup?: unknown) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  };
  if (replyMarkup) body.reply_markup = replyMarkup;

  await fetch(`${API_BASE()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function answerCallbackQuery(callbackQueryId: string) {
  await fetch(`${API_BASE()}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  });
}

export async function sendChatAction(chatId: number, action: string = 'typing') {
  await fetch(`${API_BASE()}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action }),
  });
}

export function inlineKeyboard(buttons: Array<Array<{ text: string; callback_data: string }>>) {
  return { inline_keyboard: buttons };
}

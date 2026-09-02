const SYSTEM_PROMPT = `You are a routing classifier for Acoustic Kitty.
Given a user message, return JSON only:
{"category":"<one of: document-analysis, sales-automation, code-review, legal, creative, customer-support, research, dev-tools>","intent":"<brief description>","confidence":0.0-1.0}
If confidence < 0.7, set category to "unclear".`;

interface Classification {
  category: string;
  intent: string;
  confidence: number;
}

export async function classifyMessage(message: string): Promise<Classification> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { category: 'unclear', intent: 'API key not configured', confidence: 0 };
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: message }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text ?? '';
    return JSON.parse(text) as Classification;
  } catch {
    return { category: 'unclear', intent: 'classification failed', confidence: 0 };
  }
}

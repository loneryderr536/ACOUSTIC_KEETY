// ---------------------------------------------------------------------------
// Level 2 Endpoint Validation
// Validates that a provider's agent endpoint implements the Level 2 API contract.
// ---------------------------------------------------------------------------

import { validateEndpointUrl } from './security';

export interface ValidationResult {
  valid: boolean;
  healthOk: boolean;
  tasksOk: boolean;
  skillsOk: boolean;
  agentCardFound: boolean;
  agentCard: Record<string, unknown> | null;
  skills: Array<{ id: string; name: string; description: string }>;
  latencyMs: number;
  errors: string[];
}

export async function validateAgentEndpoints(endpointUrl: string): Promise<ValidationResult> {
  const errors: string[] = [];
  let healthOk = false;
  let tasksOk = false;
  let skillsOk = false;
  let agentCardFound = false;
  let agentCard: Record<string, unknown> | null = null;
  let skills: Array<{ id: string; name: string; description: string }> = [];
  let latencyMs = 0;

  // Validate URL safety (SSRF protection)
  const urlCheck = validateEndpointUrl(endpointUrl);
  if (!urlCheck.safe) {
    return {
      valid: false,
      healthOk,
      tasksOk,
      skillsOk,
      agentCardFound,
      agentCard,
      skills,
      latencyMs,
      errors: [urlCheck.reason ?? 'Invalid endpoint URL'],
    };
  }

  const baseUrl = endpointUrl.replace(/\/+$/, '');

  // 1. Health check — GET /health
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const start = Date.now();
    const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    latencyMs = Date.now() - start;
    clearTimeout(timeout);
    if (res.ok) {
      const body = await res.json();
      healthOk = body.status === 'ok';
      if (!healthOk) errors.push('Health endpoint must return {"status": "ok"}');
    } else {
      errors.push(`Health endpoint returned ${res.status}`);
    }
  } catch (e) {
    errors.push(`Health endpoint unreachable: ${e instanceof Error ? e.message : 'timeout'}`);
  }

  // 2. POST /tasks test
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'health_check', context: null, session_id: null }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const body = await res.json();
      tasksOk = !!(body.status && body.output !== undefined);
      if (!tasksOk) errors.push('POST /tasks must return {status, output} fields');
    } else if (res.status === 422) {
      tasksOk = true; // 422 means it validates input — acceptable
    } else {
      errors.push(`POST /tasks returned ${res.status}`);
    }
  } catch (e) {
    errors.push(`POST /tasks failed: ${e instanceof Error ? e.message : 'timeout'}`);
  }

  // 3. GET /skills
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${baseUrl}/skills`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const body = await res.json();
      if (Array.isArray(body.skills)) {
        skills = body.skills;
        skillsOk = true;
      } else {
        errors.push('GET /skills must return {skills: [...]}');
      }
    } else {
      errors.push(`GET /skills returned ${res.status}`);
    }
  } catch (e) {
    errors.push(`GET /skills failed: ${e instanceof Error ? e.message : 'timeout'}`);
  }

  // 4. Agent card (optional — Level 3)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${baseUrl}/.well-known/agent-card.json`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const body = await res.json();
      if (body.name && body.description) {
        agentCardFound = true;
        agentCard = body;
      }
    }
  } catch {
    // Silently ignore — optional endpoint
  }

  const valid = healthOk && tasksOk && skillsOk;
  return { valid, healthOk, tasksOk, skillsOk, agentCardFound, agentCard, skills, latencyMs, errors };
}

import {
  scanInput,
  sanitizeResponse,
  BLOCK_THRESHOLD,
  type SecurityFinding,
} from '../security';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BlockedResult {
  blocked: true;
  findings: SecurityFinding[];
  riskScore: number;
}

interface PassedResult {
  blocked: false;
  sanitizedInput: unknown;
  findings: SecurityFinding[];
  riskScore: number;
}

export type SecurityScanOutcome = BlockedResult | PassedResult;

interface SanitizedResponse {
  data: unknown;
  findings: SecurityFinding[];
}

// ---------------------------------------------------------------------------
// Input scanning wrapper
// ---------------------------------------------------------------------------

/**
 * Middleware-style wrapper for request payloads.
 *
 * Runs the security scanner on the input. If the risk score meets or exceeds
 * the block threshold, the request should be rejected.
 *
 * Usage in a route handler:
 * ```ts
 * const scan = withSecurityScan(body);
 * if (scan.blocked) {
 *   return NextResponse.json({ error: 'Blocked', findings: scan.findings }, { status: 403 });
 * }
 * // proceed with scan.sanitizedInput
 * ```
 */
export function withSecurityScan(input: unknown): SecurityScanOutcome {
  const result = scanInput(input);

  if (result.riskScore >= BLOCK_THRESHOLD) {
    return {
      blocked: true,
      findings: result.findings,
      riskScore: result.riskScore,
    };
  }

  return {
    blocked: false,
    sanitizedInput: input,
    findings: result.findings,
    riskScore: result.riskScore,
  };
}

// ---------------------------------------------------------------------------
// Response sanitization wrapper
// ---------------------------------------------------------------------------

/**
 * Middleware-style wrapper for agent responses.
 *
 * Cleans the response data (removes XSS vectors, prototype pollution keys)
 * and returns any security findings for logging/monitoring.
 *
 * Usage in a route handler:
 * ```ts
 * const { data, findings } = withResponseSanitization(agentResponse);
 * if (findings.length > 0) {
 *   console.warn('Security findings in response:', findings);
 * }
 * return NextResponse.json(data);
 * ```
 */
export function withResponseSanitization(data: unknown): SanitizedResponse {
  return sanitizeResponse(data);
}

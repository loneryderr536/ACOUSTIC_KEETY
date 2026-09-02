// ---------------------------------------------------------------------------
// Security scanning and prompt injection detection
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SecurityScanResult {
  safe: boolean;
  riskScore: number;
  findings: SecurityFinding[];
}

export interface SecurityFinding {
  type:
    | 'prompt_injection'
    | 'xss'
    | 'data_exfiltration'
    | 'malicious_code'
    | 'secrets_detected'
    | 'suspicious_dependency';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  location?: string;
}

/** Requests scoring at or above this threshold are blocked. */
export const BLOCK_THRESHOLD = 60;

// ---------------------------------------------------------------------------
// Prompt injection patterns
// ---------------------------------------------------------------------------

interface InjectionPattern {
  pattern: RegExp;
  severity: SecurityFinding['severity'];
  description: string;
  score: number;
}

const INJECTION_PATTERNS: InjectionPattern[] = [
  {
    pattern: /ignore\s+(all\s+|any\s+)?(previous|prior|above)\s+(instructions|prompts|context)/i,
    severity: 'critical',
    description: 'Attempt to override previous instructions',
    score: 60,
  },
  {
    pattern: /you are now/i,
    severity: 'high',
    description: 'Persona override attempt ("you are now")',
    score: 60,
  },
  {
    pattern: /\bsystem\s*:/i,
    severity: 'high',
    description: 'System role injection via "system:" prefix',
    score: 35,
  },
  {
    pattern: /\brole\s*:\s*(system|assistant)/i,
    severity: 'critical',
    description: 'Direct role assignment attempt',
    score: 40,
  },
  {
    pattern: /pretend\s+(you are|to be|you're)/i,
    severity: 'high',
    description: 'Persona override via "pretend" phrasing',
    score: 30,
  },
  {
    pattern: /act as\s+(a\s+|an\s+)?.*?(and\s+)?(ignore|override|disregard|forget)/i,
    severity: 'critical',
    description: 'Act-as with override language',
    score: 40,
  },
  {
    pattern: /do not follow/i,
    severity: 'high',
    description: 'Instruction to not follow rules',
    score: 25,
  },
  {
    pattern: /disregard\s+(all|any|the|previous)/i,
    severity: 'critical',
    description: 'Instruction to disregard existing context',
    score: 40,
  },
  {
    pattern: /override\s+(your|the)\s+(instructions|programming|rules)/i,
    severity: 'critical',
    description: 'Direct override attempt',
    score: 45,
  },
  {
    pattern: /jailbreak/i,
    severity: 'critical',
    description: 'Jailbreak keyword detected',
    score: 60,
  },
  // Additional patterns for deeper coverage
  {
    pattern: /forget\s+(all\s+|any\s+|everything\s+|your\s+)+(previous\s+|prior\s+)*(instructions|rules|training)/i,
    severity: 'critical',
    description: 'Instruction to forget training/rules',
    score: 60,
  },
  {
    pattern: /\byou\s+shall\s+(now|henceforth|from\s+now)/i,
    severity: 'high',
    description: 'Directive rephrasing ("you shall now")',
    score: 60,
  },
  {
    pattern: /\bnew\s+instructions?\s*:/i,
    severity: 'critical',
    description: 'Attempt to inject new instructions block',
    score: 40,
  },
  {
    pattern: /\b(reveal|show|display|print|output)\s+(your|the)\s+(system\s+)?(prompt|instructions|rules|configuration)/i,
    severity: 'critical',
    description: 'System prompt extraction attempt',
    score: 60,
  },
  {
    pattern: /what\s+(are|is)\s+your\s+(system\s+)?(prompt|instructions|rules|programming|directives)/i,
    severity: 'high',
    description: 'Interrogation for system prompt',
    score: 35,
  },
  {
    pattern: /\bDAN\b.*\bmode\b|\bDAN\b.*\bjailbreak\b/i,
    severity: 'critical',
    description: 'DAN jailbreak variant detected',
    score: 50,
  },
  {
    pattern: /\bdeveloper\s+mode\b|\bdev\s+mode\b/i,
    severity: 'high',
    description: 'Developer mode jailbreak attempt',
    score: 60,
  },
  {
    pattern: /\b(hypothetically|hypothetical|theoretically)\b[,.\s]+.*\b(ignore|bypass|override|break)/i,
    severity: 'high',
    description: 'Hypothetical framing to bypass rules',
    score: 60,
  },
  {
    pattern: /\brepeat\s+(back\s+)?(everything|all\s+\w+|the\s+\w+)\s+(above|previous|text|content|instructions)/i,
    severity: 'high',
    description: 'Attempt to extract context via repeat back',
    score: 60,
  },
];

/** Matches strings that look like base64-encoded content (32+ chars). */
const BASE64_PATTERN = /(?:[A-Za-z0-9+/]{32,}={0,2})/g;

/** Characters that might be used as delimiter attacks. */
const DELIMITER_ATTACK_PATTERN = /[<>{}\[\]|\\]{10,}/;

// ---------------------------------------------------------------------------
// a) Prompt injection detection — scanInput
// ---------------------------------------------------------------------------

/**
 * Scan an input payload for prompt injection and other suspicious content.
 * Recursively walks objects/arrays and checks every string value.
 */
export function scanInput(input: unknown): SecurityScanResult {
  const findings: SecurityFinding[] = [];
  let riskScore = 0;

  const strings = extractStrings(input);

  for (const { value, path } of strings) {
    // Check known injection patterns
    for (const ip of INJECTION_PATTERNS) {
      if (ip.pattern.test(value)) {
        findings.push({
          type: 'prompt_injection',
          severity: ip.severity,
          description: ip.description,
          location: path,
        });
        riskScore += ip.score;
      }
    }

    // Check for base64-encoded injection attempts
    const b64Matches = value.match(BASE64_PATTERN);
    if (b64Matches) {
      for (const b64 of b64Matches) {
        try {
          const decoded = Buffer.from(b64, 'base64').toString('utf-8');
          // Only flag if the decoded content is printable text and matches
          // injection patterns
          if (/^[\x20-\x7E\s]+$/.test(decoded)) {
            for (const ip of INJECTION_PATTERNS) {
              if (ip.pattern.test(decoded)) {
                findings.push({
                  type: 'prompt_injection',
                  severity: 'critical',
                  description: `Base64-encoded injection: ${ip.description}`,
                  location: path,
                });
                riskScore += ip.score + 10; // Extra penalty for encoding evasion
              }
            }
          }
        } catch {
          // Not valid base64, ignore
        }
      }
    }

    // Check for delimiter attacks (excessive special characters)
    if (DELIMITER_ATTACK_PATTERN.test(value)) {
      findings.push({
        type: 'prompt_injection',
        severity: 'medium',
        description: 'Excessive special characters — possible delimiter attack',
        location: path,
      });
      riskScore += 15;
    }
  }

  // Cap at 100
  riskScore = Math.min(100, riskScore);

  return {
    safe: riskScore < BLOCK_THRESHOLD,
    riskScore,
    findings,
  };
}

// ---------------------------------------------------------------------------
// b) Response sanitization — sanitizeResponse
// ---------------------------------------------------------------------------

/** HTML script tags. */
const SCRIPT_TAG_RE = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;

/** HTML event handlers like onerror, onclick, onload, etc. */
const EVENT_HANDLER_RE = /\s+on\w+\s*=\s*["'][^"']*["']/gi;

/** Markdown image exfiltration — ![alt](https://attacker.com/?data=...) */
const MARKDOWN_EXFIL_RE = /!\[([^\]]*)\]\((https?:\/\/[^)]+\?[^)]*)\)/gi;

/** Data URI payloads that could embed scripts */
const DATA_URI_RE = /data:\s*[^;]+;base64,/gi;

/** Dangerous JSON keys that enable prototype pollution. */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Clean agent response data before returning it to subscribers.
 *
 * - Strips `<script>` tags and inline event handlers from strings
 * - Detects prompt injection attempts in the response (targeting downstream)
 * - Validates JSON structure (no prototype pollution keys)
 */
export function sanitizeResponse(data: unknown): {
  data: unknown;
  findings: SecurityFinding[];
} {
  const findings: SecurityFinding[] = [];

  const cleaned = sanitizeValue(data, findings, '$');

  return { data: cleaned, findings };
}

function sanitizeValue(
  value: unknown,
  findings: SecurityFinding[],
  path: string,
): unknown {
  if (typeof value === 'string') {
    let sanitized = value;

    // Strip script tags
    if (SCRIPT_TAG_RE.test(sanitized)) {
      findings.push({
        type: 'xss',
        severity: 'critical',
        description: 'Script tag removed from response',
        location: path,
      });
      sanitized = sanitized.replace(SCRIPT_TAG_RE, '');
    }

    // Strip event handlers
    if (EVENT_HANDLER_RE.test(sanitized)) {
      findings.push({
        type: 'xss',
        severity: 'high',
        description: 'Inline event handler removed from response',
        location: path,
      });
      sanitized = sanitized.replace(EVENT_HANDLER_RE, '');
    }

    // Strip markdown image exfiltration (images with query params to external URLs)
    if (MARKDOWN_EXFIL_RE.test(sanitized)) {
      findings.push({
        type: 'data_exfiltration',
        severity: 'high',
        description: 'Markdown image with query params removed (potential data exfiltration)',
        location: path,
      });
      sanitized = sanitized.replace(MARKDOWN_EXFIL_RE, '[$1](removed)');
    }

    // Strip data URIs that could embed scripts
    if (DATA_URI_RE.test(sanitized)) {
      findings.push({
        type: 'xss',
        severity: 'high',
        description: 'Data URI removed from response',
        location: path,
      });
      sanitized = sanitized.replace(DATA_URI_RE, 'data:removed;');
    }

    // Check if response itself contains injection attempts targeting downstream
    for (const ip of INJECTION_PATTERNS) {
      if (ip.pattern.test(sanitized)) {
        findings.push({
          type: 'prompt_injection',
          severity: ip.severity,
          description: `Response contains injection targeting downstream: ${ip.description}`,
          location: path,
        });
        // We flag but don't strip — the downstream consumer decides policy
        break; // One finding per string is sufficient
      }
    }

    return sanitized;
  }

  if (Array.isArray(value)) {
    return value.map((item, i) =>
      sanitizeValue(item, findings, `${path}[${i}]`),
    );
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (DANGEROUS_KEYS.has(key)) {
        findings.push({
          type: 'malicious_code',
          severity: 'critical',
          description: `Prototype pollution key "${key}" removed from response`,
          location: `${path}.${key}`,
        });
        continue; // Skip dangerous keys
      }
      result[key] = sanitizeValue(val, findings, `${path}.${key}`);
    }

    return result;
  }

  // Primitives (number, boolean, null) pass through unchanged
  return value;
}

// ---------------------------------------------------------------------------
// c) Repository scanner interface — scanRepository (stub)
// ---------------------------------------------------------------------------

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';

// Secret patterns to detect in files
const SECRET_PATTERNS = [
  { re: /sk-ant-[a-zA-Z0-9\-_]{20,}/, desc: 'Anthropic API key' },
  { re: /sk-proj-[a-zA-Z0-9\-_]{20,}/, desc: 'OpenAI API key' },
  { re: /sk-[a-zA-Z0-9]{20,}/, desc: 'Potential API secret key' },
  { re: /AKIA[0-9A-Z]{16}/, desc: 'AWS Access Key ID' },
  { re: /ghp_[a-zA-Z0-9]{36}/, desc: 'GitHub Personal Access Token' },
  { re: /glpat-[a-zA-Z0-9\-_]{20,}/, desc: 'GitLab Access Token' },
  { re: /xox[bps]-[a-zA-Z0-9\-]+/, desc: 'Slack token' },
  { re: /(password|secret|token|api_key|apikey)\s*[=:]\s*['"][^'"]{8,}['"]/i, desc: 'Hardcoded credential' },
];

// Suspicious lifecycle scripts
const SUSPICIOUS_SCRIPTS = [
  /curl\s+.*\|.*sh/i,
  /wget\s+.*\|.*sh/i,
  /\beval\b.*\$\(/,
  /\bnc\s+-[elp]/,
  /\bpython\s+-c\b.*\bimport\s+os\b/,
  /\bbase64\s+-d\b/,
];

// Dangerous code patterns
const DANGEROUS_CODE_PATTERNS = [
  { re: /\beval\s*\(/, desc: 'eval() usage', severity: 'high' as const },
  { re: /child_process\s*\.\s*exec\s*\(/, desc: 'child_process.exec() — command injection risk', severity: 'critical' as const },
  { re: /\bos\.system\s*\(/, desc: 'os.system() — command execution', severity: 'critical' as const },
  { re: /subprocess\.call\s*\(.*shell\s*=\s*True/, desc: 'subprocess with shell=True', severity: 'critical' as const },
  { re: /\bexec\s*\(.*\binput\b/, desc: 'exec() with user input', severity: 'critical' as const },
];

// Known malicious npm packages
const MALICIOUS_PACKAGES = new Set([
  'event-stream', 'flatmap-stream', 'ua-parser-js', 'coa', 'rc',
  'colors', 'faker', 'node-ipc', 'peacenotwar',
]);

const SKIP_DIRS = new Set(['node_modules', '.git', 'vendor', '__pycache__', '.venv', 'dist', 'build']);
const SCAN_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.py', '.sh', '.bash', '.env', '.yaml', '.yml', '.json']);

function walkDir(dir: string, maxFiles: number): string[] {
  const results: string[] = [];
  function walk(d: string) {
    if (results.length >= maxFiles) return;
    try {
      const entries = readdirSync(d, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= maxFiles) break;
        if (SKIP_DIRS.has(entry.name)) continue;
        const fullPath = join(d, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase();
          if (SCAN_EXTENSIONS.has(ext) || entry.name.startsWith('.env')) {
            results.push(fullPath);
          }
        }
      }
    } catch {}
  }
  walk(dir);
  return results;
}

/**
 * Scan a local repository directory for security issues.
 * Checks for: secrets, dangerous code patterns, suspicious lifecycle scripts, malicious packages.
 */
export async function scanRepository(repoPath: string): Promise<SecurityScanResult> {
  const findings: SecurityFinding[] = [];

  // 1. Walk the repo (max 200 files to prevent DoS)
  const files = walkDir(repoPath, 200);

  for (const filePath of files) {
    const relativePath = filePath.replace(repoPath + '/', '');
    let content: string;
    try {
      const stat = statSync(filePath);
      if (stat.size > 500_000) continue; // skip files > 500KB
      content = readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    // Check .env files for secrets
    if (relativePath.startsWith('.env') || relativePath.includes('/.env')) {
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.re.test(content)) {
          findings.push({
            type: 'secrets_detected',
            severity: 'critical',
            description: `${pattern.desc} found in ${relativePath}`,
            location: relativePath,
          });
        }
      }
    }

    // Check all source files for secrets
    const ext = extname(filePath).toLowerCase();
    if (['.js', '.ts', '.jsx', '.tsx', '.py'].includes(ext)) {
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.re.test(content)) {
          findings.push({
            type: 'secrets_detected',
            severity: 'high',
            description: `${pattern.desc} found in source code`,
            location: relativePath,
          });
        }
      }

      // Check for dangerous code patterns
      for (const pattern of DANGEROUS_CODE_PATTERNS) {
        if (pattern.re.test(content)) {
          findings.push({
            type: 'malicious_code',
            severity: pattern.severity,
            description: pattern.desc,
            location: relativePath,
          });
        }
      }
    }

    // Check package.json for suspicious scripts and malicious packages
    if (relativePath === 'package.json' || relativePath.endsWith('/package.json')) {
      try {
        const pkg = JSON.parse(content);

        // Check lifecycle scripts
        const scripts = pkg.scripts || {};
        for (const [scriptName, scriptCmd] of Object.entries(scripts)) {
          if (['preinstall', 'postinstall', 'preuninstall'].includes(scriptName)) {
            const cmd = String(scriptCmd);
            for (const suspicious of SUSPICIOUS_SCRIPTS) {
              if (suspicious.test(cmd)) {
                findings.push({
                  type: 'malicious_code',
                  severity: 'critical',
                  description: `Suspicious ${scriptName} script: "${cmd.slice(0, 100)}"`,
                  location: relativePath,
                });
              }
            }
          }
        }

        // Check for known malicious packages
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        for (const dep of Object.keys(allDeps)) {
          if (MALICIOUS_PACKAGES.has(dep)) {
            findings.push({
              type: 'suspicious_dependency',
              severity: 'high',
              description: `Known problematic package: ${dep}`,
              location: relativePath,
            });
          }
        }
      } catch {}
    }
  }

  // Calculate risk score
  const weights: Record<string, number> = { critical: 40, high: 25, medium: 15, low: 5 };
  const riskScore = Math.min(100, findings.reduce((sum, f) => sum + (weights[f.severity] || 5), 0));

  return {
    safe: riskScore < 40,
    riskScore,
    findings,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively extract all string values from an unknown payload, tracking
 * their JSON-path location for reporting.
 */
function extractStrings(
  value: unknown,
  path: string = '$',
): { value: string; path: string }[] {
  if (typeof value === 'string') {
    return [{ value, path }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, i) => extractStrings(item, `${path}[${i}]`));
  }

  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(
      ([key, val]) => extractStrings(val, `${path}.${key}`),
    );
  }

  return [];
}

// ---------------------------------------------------------------------------
// SSRF Protection
// ---------------------------------------------------------------------------

export function validateEndpointUrl(url: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(url);

    // In development, allow localhost for testing with mock agents
    const isDev = process.env.NODE_ENV !== 'production';
    const devAllowed = ['localhost', '127.0.0.1'];

    const blockedHosts = [
      'localhost', '127.0.0.1', '0.0.0.0', '::1',
      'metadata.google.internal', '169.254.169.254', 'metadata.internal',
    ];

    // Always block cloud metadata endpoints, even in dev
    const alwaysBlocked = ['metadata.google.internal', '169.254.169.254', 'metadata.internal', '0.0.0.0', '::1'];
    if (alwaysBlocked.includes(parsed.hostname)) {
      return { safe: false, reason: 'Internal/private addresses not allowed' };
    }

    if (!isDev && blockedHosts.includes(parsed.hostname)) {
      return { safe: false, reason: 'Internal/private addresses not allowed' };
    }
    const octets = parsed.hostname.split('.').map(Number);
    if (octets.length === 4 && octets.every((n) => !isNaN(n))) {
      if (octets[0] === 10)
        return { safe: false, reason: 'Private IP range not allowed' };
      if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
        return { safe: false, reason: 'Private IP range not allowed' };
      if (octets[0] === 192 && octets[1] === 168)
        return { safe: false, reason: 'Private IP range not allowed' };
    }
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      return { safe: false, reason: 'HTTPS required in production' };
    }
    return { safe: true };
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }
}

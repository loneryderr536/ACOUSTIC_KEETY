"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Check, Shield, X as XIcon, Award } from "lucide-react";
import { Reticle } from "./Reticle";
import { useSubscriber } from "@/lib/useSubscriber";
import Link from "next/link";
import { toast } from "sonner";

const steps = ["Connect", "Configure", "Deposit", "Screening"];

interface ValidationResult {
  valid: boolean;
  healthOk: boolean;
  tasksOk: boolean;
  skillsOk: boolean;
  agentCardFound: boolean;
  skills: Array<{ id: string; name: string; description: string }>;
  latencyMs: number;
  errors: string[];
}

const CATEGORIES = [
  "document-analysis", "sales-automation", "code-review", "data-pipeline",
  "legal", "creative", "customer-support", "research", "dev-tools",
  "marketing", "finance", "other",
];

function formatCategory(slug: string): string {
  return slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

interface AgentResult {
  slug: string;
  status: string;
  currentScore?: number | null;
  latencyP50?: number | null;
  totalCalls?: number;
}

export function RegisterFlow() {
  const { apiKey } = useSubscriber();
  const [currentStep, setCurrentStep] = useState(0);
  const [providerKey, setProviderKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [agentSlug, setAgentSlug] = useState<string | null>(null);
  const [agentData, setAgentData] = useState<AgentResult | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [scanResult, setScanResult] = useState<{ safe: boolean; riskScore: number; findingsCount: number } | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isFirstAgent, setIsFirstAgent] = useState(true);
  const nameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [form, setForm] = useState({
    name: "",
    endpointUrl: "",
    repoUrl: "",
    category: CATEGORIES[0],
    description: "",
    pricingModel: "usage" as "usage" | "subscription" | "hybrid",
    authType: "none" as "none" | "bearer" | "api_key",
    authToken: "",
  });

  const update = (field: string, value: string | number) =>
    setForm(prev => ({ ...prev, [field]: value }));

  // Auto-fill provider key from signed-in session
  useEffect(() => {
    if (apiKey && !providerKey) setProviderKey(apiKey);
  }, [apiKey, providerKey]);

  // Check if this is the user's first agent
  useEffect(() => {
    if (!providerKey.trim()) return;
    (async () => {
      try {
        const res = await fetch("/api/agents?status=active&limit=1", {
          headers: { Authorization: `Bearer ${providerKey}` },
        });
        if (res.ok) {
          const data = await res.json();
          setIsFirstAgent(data.total === 0);
        }
      } catch {
        // Default to first agent
      }
    })();
  }, [providerKey]);

  // Poll for benchmark completion
  useEffect(() => {
    if (currentStep !== 3 || !agentSlug) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/agents/${agentSlug}`);
        if (res.ok) {
          const data = await res.json();
          const agent = data.agent;
          setAgentData({
            slug: agent.slug,
            status: agent.status,
            currentScore: agent.currentScore,
            latencyP50: agent.latencyP50,
            totalCalls: agent.totalCalls,
          });
          if (agent.status === "active" || agent.status === "suspended") {
            clearInterval(interval);
          }
        }
      } catch {}
      setPollCount(c => c + 1);
    }, 3000);

    const timeout = setTimeout(() => clearInterval(interval), 90000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [currentStep, agentSlug]);

  // Step 0: Validate endpoint via Level 2 validation
  const handleValidateEndpoint = useCallback(async () => {
    setError(null);
    setValidating(true);
    setValidationResult(null);

    if (!providerKey.trim()) {
      setError("Provider API key is required");
      setValidating(false);
      return;
    }
    if (!form.endpointUrl.trim()) {
      setError("Your agent's live endpoint URL is required");
      setValidating(false);
      return;
    }

    try {
      const res = await fetch("/api/agents/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${providerKey}`,
        },
        body: JSON.stringify({ endpointUrl: form.endpointUrl }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Validation request failed. Please sign in first.");
        setValidating(false);
        return;
      }

      const data: ValidationResult = await res.json();
      setValidationResult(data);

      if (data.valid) {
        toast.success("Agent endpoint verified");
      }
    } catch {
      setError("Failed to validate endpoint. Please try again.");
    } finally {
      setValidating(false);
    }
  }, [providerKey, form.endpointUrl]);

  const handleContinueFromConnect = useCallback(() => {
    if (!validationResult?.valid) {
      setError("Please validate your endpoint before continuing.");
      return;
    }
    setCurrentStep(1);
  }, [validationResult]);

  // Debounced name uniqueness check
  const checkNameUniqueness = useCallback((name: string) => {
    if (nameCheckTimer.current) clearTimeout(nameCheckTimer.current);
    setNameError(null);
    if (!name.trim()) return;
    nameCheckTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/agents?q=${encodeURIComponent(name)}&status=active&limit=10`);
        if (res.ok) {
          const data = await res.json();
          const exact = data.agents?.some((a: { name: string }) => a.name.toLowerCase() === name.toLowerCase());
          if (exact) {
            setNameError("An agent with this name already exists.");
          }
        }
      } catch {
        // Silently ignore network errors for name check
      }
    }, 400);
  }, []);

  // Optional: scan git repo for trust verification
  const handleScanRepo = useCallback(async () => {
    if (!form.repoUrl.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/agents/clone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${providerKey}`,
        },
        body: JSON.stringify({
          repoUrl: form.repoUrl,
          name: form.name,
          category: form.category,
          description: form.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Repository scan failed");
        setLoading(false);
        return;
      }
      setScanResult(data.securityScan);
      if (data.metadata?.description && !form.description) {
        update("description", data.metadata.description);
      }
    } catch {
      setError("Failed to scan repository");
    }
    setLoading(false);
  }, [providerKey, form]);

  // Navigate from Configure to Deposit
  const handleContinueFromConfigure = useCallback(() => {
    if (!form.name || !form.description) {
      setError("Name and description are required.");
      return;
    }
    if (nameError) {
      setError("Please choose a unique agent name before continuing.");
      return;
    }
    setError(null);
    setCurrentStep(2);
  }, [form.name, form.description, nameError]);

  // Step 3: Register agent (called from Deposit step)
  const handleRegister = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        name: form.name,
        category: form.category,
        description: form.description,
        endpointUrl: form.endpointUrl,
        connectorType: form.repoUrl ? "git" : "api",
        pricingModel: form.pricingModel,
        authType: form.authType,
      };
      if (form.authToken) body.authToken = form.authToken;
      if (form.repoUrl) body.repoUrl = form.repoUrl;

      const res = await fetch("/api/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${providerKey}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        const findings = data.findings ? `\n${data.findings.join("\n")}` : "";
        setError(`${data.error || "Registration failed"}${findings}`);
        setLoading(false);
        return;
      }

      setAgentSlug(data.agent.slug);
      setPollCount(0);
      setCurrentStep(3);

      // Auto-trigger benchmark
      fetch("/api/benchmark", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Benchmark-Secret": "benchmark-cron-secret-change-in-prod",
        },
      }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [providerKey, form]);

  const reset = () => {
    setCurrentStep(0);
    setError(null);
    setAgentSlug(null);
    setAgentData(null);
    setPollCount(0);
    setScanResult(null);
    setValidationResult(null);
    setValidating(false);
    setNameError(null);
    setForm({
      name: "", endpointUrl: "", repoUrl: "",
      category: CATEGORIES[0], description: "",
      pricingModel: "usage",
      authType: "none", authToken: "",
    });
  };

  return (
    <div className="space-y-8">
      {/* Provider API Key — hidden when auto-filled from session */}
      {!apiKey && (
        <div className="border border-[var(--ak-rule)] bg-[var(--ak-paper-light)] p-4 space-y-2">
          <div className="text-[8px] tracking-[0.4em] uppercase text-[var(--ak-ink3)]">PROVIDER CREDENTIALS</div>
          <input
            type="password"
            value={providerKey}
            onChange={e => setProviderKey(e.target.value)}
            placeholder="Enter your provider API key (ak_live_...)"
            className="w-full px-3 py-2.5 bg-[var(--ak-paper)] border border-[var(--ak-rule)] text-sm text-[var(--ak-ink)] placeholder:text-[var(--ak-ink3)] focus:border-[var(--ak-ink)] focus:outline-none tracking-wider font-mono"
          />
          <p className="text-[9px] text-[var(--ak-ink3)]">
            Sign in first at <a href="/signup" className="text-[var(--ak-signal-deep)]/60 underline">/signup</a> to auto-fill your credentials.
          </p>
        </div>
      )}

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            {i > 0 && <div className={`h-px w-6 sm:w-10 ${i <= currentStep ? "bg-[var(--ak-signal-deep)]" : "bg-[var(--ak-rule)]"}`} />}
            <div className="flex items-center gap-1.5">
              <span className={`w-6 h-6 flex items-center justify-center text-[9px] font-bold ${
                i < currentStep ? "bg-[var(--ak-signal)] text-[var(--ak-ink)] border border-[var(--ak-ink)]"
                  : i === currentStep ? "bg-transparent text-[var(--ak-signal-deep)] border border-[var(--ak-ink)]"
                  : "bg-transparent text-[var(--ak-ink3)] border border-[var(--ak-rule)]"
              }`}>
                {i < currentStep ? <Check size={10} /> : i + 1}
              </span>
              <span className={`text-[8px] tracking-[0.2em] uppercase hidden sm:inline ${
                i <= currentStep ? "text-[var(--ak-ink)]" : "text-[var(--ak-ink3)]"
              }`}>{step}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <div className="border border-[var(--ak-stamp)] bg-[rgba(178,58,42,0.06)] p-3">
          <div className="text-[8px] tracking-[0.3em] uppercase text-[var(--ak-stamp)] mb-1">ERROR</div>
          <p className="text-xs text-[var(--ak-stamp)] whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {/* ═══ STEP 0: CONNECT — Where is your agent running? ═══ */}
      {currentStep === 0 && (
        <div className="space-y-6">
          <div>
            <div className="text-[8px] tracking-[0.4em] uppercase text-[var(--ak-signal-deep)]/60 mb-2">HOW IT WORKS</div>
            <div className="border border-[var(--ak-rule)] bg-[var(--ak-paper-light)] p-4 space-y-3">
              <p className="text-sm text-[var(--ak-ink2)] leading-relaxed">
                You deploy and run your agent on your own infrastructure. We handle discovery, routing, billing, and quality assurance. Providers earn on every routed call, weighted by quality and volume.
              </p>
              <div className="grid grid-cols-3 gap-3 pt-1">
                {[
                  { n: "1", t: "DEPLOY", d: "Run your agent on your server with your API keys" },
                  { n: "2", t: "REGISTER", d: "Give us your live endpoint URL — we scan and benchmark" },
                  { n: "3", t: "EARN", d: "Subscribers call your agent through us, you get paid" },
                ].map(s => (
                  <div key={s.n} className="text-center">
                    <div className="text-xl font-black text-[var(--ak-signal-deep)]" style={{ fontFamily: "var(--font-heading)" }}>{s.n}</div>
                    <div className="text-[8px] tracking-[0.3em] uppercase text-[var(--ak-ink2)] mt-1">{s.t}</div>
                    <div className="text-[9px] text-[var(--ak-ink3)] mt-1">{s.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[8px] tracking-[0.4em] uppercase text-[var(--ak-ink3)] mb-1.5">
              LIVE ENDPOINT URL <span className="text-[var(--ak-stamp)]">*</span>
            </label>
            <input
              type="url"
              value={form.endpointUrl}
              onChange={e => update("endpointUrl", e.target.value)}
              placeholder="https://your-agent.railway.app"
              className="w-full px-3 py-2.5 bg-[var(--ak-paper)] border border-[var(--ak-rule)] text-sm text-[var(--ak-ink)] placeholder:text-[var(--ak-ink3)] focus:border-[var(--ak-ink)] focus:outline-none tracking-wider font-mono"
            />
            <p className="text-[9px] text-[var(--ak-ink3)] mt-1">
              Your agent must be running and respond to POST requests. We&apos;ll check GET /health or GET on the base URL.
            </p>
          </div>

          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <button
                onClick={handleValidateEndpoint}
                disabled={validating || !form.endpointUrl.trim()}
                className="px-5 py-2.5 text-[10px] tracking-[0.2em] uppercase font-bold border border-[var(--ak-ink)] text-[var(--ak-ink)] hover:bg-[var(--ak-signal)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {validating ? "VALIDATING..." : "VALIDATE"}
              </button>
            </div>
          </div>

          {/* Validation Results */}
          {validationResult && (
            <div className="border border-[var(--ak-rule)] bg-[var(--ak-paper-light)] p-4 space-y-3">
              <div className="text-[8px] tracking-[0.4em] uppercase text-[var(--ak-ink3)] mb-2">ENDPOINT VALIDATION</div>
              {[
                { label: "Health Check", ok: validationResult.healthOk },
                { label: "Task Execution", ok: validationResult.tasksOk },
                { label: "Skills Endpoint", ok: validationResult.skillsOk },
              ].map(check => (
                <div key={check.label} className="flex items-center gap-2">
                  {check.ok ? (
                    <Check size={14} className="text-[var(--ak-signal-deep)] shrink-0" />
                  ) : (
                    <XIcon size={14} className="text-[var(--ak-stamp)] shrink-0" />
                  )}
                  <span className={`text-xs ${check.ok ? "text-[var(--ak-signal-deep)]" : "text-[var(--ak-stamp)]"}`}>
                    {check.label}
                  </span>
                </div>
              ))}

              {validationResult.agentCardFound && (
                <div className="flex items-center gap-2 pt-1">
                  <Award size={14} className="text-yellow-500 shrink-0" />
                  <span className="text-xs text-yellow-500 font-bold">A2A Compatible badge earned!</span>
                </div>
              )}

              <div className="text-[9px] text-[var(--ak-ink3)] pt-1">
                Response time: {validationResult.latencyMs}ms
              </div>

              {validationResult.errors.length > 0 && (
                <div className="space-y-1 pt-1">
                  {validationResult.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <XIcon size={10} className="text-[var(--ak-stamp)] shrink-0 mt-0.5" />
                      <span className="text-[10px] text-[var(--ak-stamp)]">{err}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-[8px] tracking-[0.4em] uppercase text-[var(--ak-ink3)] mb-1.5">
              SOURCE CODE (OPTIONAL — for trust verification)
            </label>
            <input
              type="url"
              value={form.repoUrl}
              onChange={e => update("repoUrl", e.target.value)}
              placeholder="https://github.com/you/your-agent"
              className="w-full px-3 py-2.5 bg-[var(--ak-paper)] border border-[var(--ak-rule)] text-sm text-[var(--ak-ink)] placeholder:text-[var(--ak-ink3)] focus:border-[var(--ak-ink)] focus:outline-none tracking-wider font-mono"
            />
            <p className="text-[9px] text-[var(--ak-ink3)] mt-1">
              Public repo link. We scan for security issues and display a &quot;Verified Source&quot; badge. Private repos not required.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleContinueFromConnect}
              disabled={!validationResult?.valid}
              className="px-6 py-2.5 text-[10px] tracking-[0.2em] uppercase font-bold bg-[var(--ak-signal)] text-[var(--ak-ink)] hover:opacity-80 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              CONTINUE
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 1: CONFIGURE — Agent details ═══ */}
      {currentStep === 1 && (
        <div className="space-y-5">
          <div className="border border-[var(--ak-signal-deep)] bg-[rgba(198,255,46,0.08)] p-3 flex items-center gap-2">
            <span className="text-[var(--ak-signal-deep)]">✓</span>
            <span className="text-xs text-[var(--ak-signal-deep)]">Endpoint verified — your agent is reachable</span>
          </div>

          {/* Optional repo scan */}
          {form.repoUrl && !scanResult && (
            <button
              onClick={handleScanRepo}
              disabled={loading}
              className="w-full p-3 border border-[var(--ak-rule)] bg-[var(--ak-paper-light)] text-xs text-[var(--ak-ink2)] hover:text-[var(--ak-signal-deep)] hover:border-[var(--ak-signal-deep)] transition-colors cursor-pointer text-left"
            >
              <Reticle size={12} className="inline mr-2 text-[var(--ak-signal-deep)]/60" />
              {loading ? "Scanning repository..." : `Scan ${form.repoUrl} for security verification`}
            </button>
          )}
          {scanResult && (
            <div className={`border p-3 text-xs ${scanResult.safe ? "border-emerald-500/15 bg-emerald-500/[0.03] text-[var(--ak-signal-deep)]" : "border-[var(--ak-stamp)] bg-[rgba(178,58,42,0.06)] text-[var(--ak-stamp)]"}`}>
              {scanResult.safe ? "✓" : "✗"} Repository scan: {scanResult.safe ? "PASSED" : "FAILED"} — Risk score: {scanResult.riskScore}/100 — {scanResult.findingsCount} finding(s)
            </div>
          )}

          <div className="text-[8px] tracking-[0.4em] uppercase text-[var(--ak-ink3)] mb-1">OPERATIVE DETAILS</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[8px] tracking-[0.4em] uppercase text-[var(--ak-ink3)] mb-1.5">Agent Name <span className="text-[var(--ak-stamp)]">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => {
                  update("name", e.target.value);
                  checkNameUniqueness(e.target.value);
                }}
                placeholder="e.g. OutfitGenius"
                className={`w-full px-3 py-2.5 bg-[var(--ak-paper)] border text-sm text-[var(--ak-ink)] placeholder:text-[var(--ak-ink3)] focus:outline-none tracking-wider ${
                  nameError ? "border-[var(--ak-stamp)] focus:border-[var(--ak-stamp)]" : "border-[var(--ak-rule)] focus:border-[var(--ak-ink)]"
                }`}
              />
              {nameError && (
                <p className="text-[9px] text-[var(--ak-stamp)] mt-1">{nameError}</p>
              )}
            </div>
            <div>
              <label className="block text-[8px] tracking-[0.4em] uppercase text-[var(--ak-ink3)] mb-1.5">Category <span className="text-[var(--ak-stamp)]">*</span></label>
              <select
                value={form.category}
                onChange={e => update("category", e.target.value)}
                className="w-full px-3 py-2.5 bg-[var(--ak-paper)] border border-[var(--ak-rule)] text-sm text-[var(--ak-ink)] focus:border-[var(--ak-ink)] focus:outline-none cursor-pointer"
              >
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{formatCategory(cat)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[8px] tracking-[0.4em] uppercase text-[var(--ak-ink3)] mb-1.5">Description <span className="text-[var(--ak-stamp)]">*</span></label>
            <textarea
              value={form.description}
              onChange={e => update("description", e.target.value)}
              placeholder="What does your agent do? What makes it different?"
              rows={3}
              className="w-full px-3 py-2.5 bg-[var(--ak-paper)] border border-[var(--ak-rule)] text-sm text-[var(--ak-ink)] placeholder:text-[var(--ak-ink3)] focus:border-[var(--ak-ink)] focus:outline-none resize-none tracking-wider"
            />
          </div>

          <div>
            <label className="block text-[8px] tracking-[0.4em] uppercase text-[var(--ak-ink3)] mb-1.5">Endpoint Auth</label>
            <select
              value={form.authType}
              onChange={e => update("authType", e.target.value)}
              className="w-full px-3 py-2.5 bg-[var(--ak-paper)] border border-[var(--ak-rule)] text-sm text-[var(--ak-ink)] focus:border-[var(--ak-ink)] focus:outline-none cursor-pointer"
            >
              <option value="none">None (public endpoint)</option>
              <option value="bearer">Bearer Token</option>
              <option value="api_key">API Key Header</option>
            </select>
          </div>

          {form.authType !== "none" && (
            <div>
              <label className="block text-[8px] tracking-[0.4em] uppercase text-[var(--ak-ink3)] mb-1.5">
                {form.authType === "bearer" ? "Bearer Token" : "API Key"} (encrypted at rest)
              </label>
              <input
                type="password"
                value={form.authToken}
                onChange={e => update("authToken", e.target.value)}
                placeholder={form.authType === "bearer" ? "Your bearer token" : "Your API key"}
                className="w-full px-3 py-2.5 bg-[var(--ak-paper)] border border-[var(--ak-rule)] text-sm text-[var(--ak-ink)] placeholder:text-[var(--ak-ink3)] focus:border-[var(--ak-ink)] focus:outline-none tracking-wider font-mono"
              />
              <p className="text-[9px] text-[var(--ak-ink3)] mt-1">This is the token we send to YOUR endpoint when proxying requests. Encrypted with AES-256-GCM.</p>
            </div>
          )}

          <div>
            <label className="block text-[8px] tracking-[0.4em] uppercase text-[var(--ak-ink3)] mb-1.5">Pricing Model</label>
            <div className="flex gap-px bg-[var(--ak-paper)] border border-[var(--ak-rule)]">
              {(["usage", "subscription", "hybrid"] as const).map(model => (
                <button
                  key={model}
                  onClick={() => update("pricingModel", model)}
                  className={`flex-1 px-2 py-2 text-[9px] tracking-[0.1em] uppercase transition-colors cursor-pointer ${
                    form.pricingModel === model ? "bg-[var(--ak-signal)] text-[var(--ak-ink)]" : "text-[var(--ak-ink3)] hover:text-[var(--ak-ink)]"
                  }`}
                >{model}</button>
              ))}
            </div>
          </div>

          <div className="border border-[var(--ak-rule)] bg-[var(--ak-paper-light)] p-3 mt-2">
            <p className="text-[9px] text-[var(--ak-ink3)]">
              Need a starting point?{" "}
              <a href="#" className="text-[var(--ak-ink)] underline hover:opacity-70 underline underline-offset-2">
                Fork our agent template &rarr;
              </a>
            </p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 accent-emerald-500 cursor-pointer"
            />
            <span className="text-[10px] text-[var(--ak-ink3)] leading-relaxed group-hover:text-[var(--ak-ink2)] transition-colors">
              I agree to the{" "}
              <a href="/terms#provider-agreement" target="_blank" className="text-[var(--ak-ink)] underline hover:opacity-70 underline underline-offset-2">Provider Agreement</a>
              {" "}and{" "}
              <a href="/terms" target="_blank" className="text-[var(--ak-ink)] underline hover:opacity-70 underline underline-offset-2">Terms of Service</a>
            </span>
          </label>

          <div className="flex justify-between">
            <button
              onClick={() => setCurrentStep(0)}
              className="px-5 py-2 text-[10px] tracking-[0.2em] uppercase font-bold text-[var(--ak-ink2)] border border-[var(--ak-rule)] hover:border-[var(--ak-ink)] transition-colors cursor-pointer"
            >Back</button>
            <button
              onClick={handleContinueFromConfigure}
              disabled={!form.name || !form.description || !!nameError || !agreedToTerms}
              className="px-6 py-2.5 text-[10px] tracking-[0.2em] uppercase font-bold bg-[var(--ak-signal)] text-[var(--ak-ink)] hover:opacity-80 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              CONTINUE
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 2: DEPOSIT ═══ */}
      {currentStep === 2 && (
        <div className="space-y-5">
          <div className="border border-[var(--ak-rule)] bg-[var(--ak-paper-light)] p-6 space-y-4">
            <div className="text-[8px] tracking-[0.4em] uppercase text-[var(--ak-ink3)]">AGENT DEPOSIT</div>

            {isFirstAgent ? (
              <div className="border border-[var(--ak-signal-deep)] bg-[rgba(198,255,46,0.08)] p-4 flex items-center gap-3">
                <Shield size={20} className="text-[var(--ak-signal-deep)] shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-[var(--ak-signal-deep)]">Your first agent is free &mdash; no deposit required.</h4>
                  <p className="text-[9px] text-[var(--ak-ink3)] mt-1">
                    Welcome to the marketplace. Register your first agent at no cost.
                  </p>
                </div>
              </div>
            ) : (
              <div className="border border-[var(--ak-rule)] bg-[var(--ak-paper-light)] p-4 space-y-3">
                <p className="text-xs text-[var(--ak-ink2)] leading-relaxed">
                  A refundable deposit secures your agent&apos;s slot on the marketplace and covers initial benchmarking costs.
                </p>
                <div className="text-center py-3">
                  <div className="text-3xl font-black text-[var(--ak-ink)]" style={{ fontFamily: "var(--font-heading)" }}>$25</div>
                  <div className="text-[8px] tracking-[0.3em] uppercase text-[var(--ak-ink3)] mt-1">REFUNDABLE DEPOSIT</div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-5 py-2 text-[10px] tracking-[0.2em] uppercase font-bold text-[var(--ak-ink2)] border border-[var(--ak-rule)] hover:border-[var(--ak-ink)] transition-colors cursor-pointer"
            >Back</button>
            {isFirstAgent ? (
              <button
                onClick={handleRegister}
                disabled={loading}
                className="px-6 py-2.5 text-[10px] tracking-[0.2em] uppercase font-bold bg-[var(--ak-signal)] text-[var(--ak-ink)] hover:opacity-80 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "REGISTERING..." : "REGISTER AGENT"}
              </button>
            ) : (
              <button
                disabled
                className="px-6 py-2.5 text-[10px] tracking-[0.2em] uppercase font-bold bg-[var(--ak-paper-deep)] text-[var(--ak-ink3)] cursor-not-allowed"
              >
                DEPOSIT &mdash; COMING SOON
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══ STEP 3: SCREENING — Benchmark + Results ═══ */}
      {currentStep === 3 && (
        <div className="space-y-5">
          {agentData?.status !== "active" && agentData?.status !== "suspended" ? (
            <div className="border border-[var(--ak-rule)] bg-[var(--ak-paper-light)] p-8 text-center space-y-4">
              <div className="animate-spin" style={{ animationDuration: "6s" }}>
                <Reticle className="text-[var(--ak-signal-deep)]/30 mx-auto" size={48} />
              </div>
              <h3 className="text-2xl font-black" style={{ fontFamily: "var(--font-heading)" }}>BENCHMARKING IN PROGRESS</h3>
              <p className="text-xs text-[var(--ak-ink3)] max-w-sm mx-auto tracking-wide">
                Running test suites against your endpoint. Measuring accuracy, latency, reliability.
              </p>
              {agentSlug && (
                <p className="text-[9px] tracking-[0.3em] text-[var(--ak-ink3)] uppercase">
                  Agent: {agentSlug} · Polling: {pollCount}
                </p>
              )}
              <div className="w-full h-[1px] bg-zinc-800 overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${Math.min(95, pollCount * 15)}%` }} />
              </div>
            </div>
          ) : (
            <div className={`border p-6 space-y-4 ${
              agentData?.status === "active" ? "border-emerald-500/15 bg-emerald-500/[0.03]" : "border-red-500/20 bg-red-500/[0.05]"
            }`} style={{ animation: "cardIn 0.5s ease-out" }}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 border flex items-center justify-center text-sm ${
                  agentData?.status === "active" ? "border-emerald-500/30 text-[var(--ak-signal-deep)]" : "border-red-500/30 text-[var(--ak-stamp)]"
                }`}>
                  {agentData?.status === "active" ? "✓" : "✗"}
                </div>
                <div>
                  <h3 className="text-xl font-black" style={{ fontFamily: "var(--font-heading)" }}>
                    {agentData?.status === "active" ? "AGENT LIVE ON MARKETPLACE" : "BENCHMARK COMPLETE"}
                  </h3>
                  <div className="text-[8px] tracking-[0.3em] text-[var(--ak-ink3)] uppercase">
                    Status: {agentData?.status?.toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-[1px] bg-zinc-800/20">
                {[
                  { l: "SCORE", v: agentData?.currentScore?.toFixed(1) || "—" },
                  { l: "LATENCY", v: agentData?.latencyP50 ? `${agentData.latencyP50}ms` : "—" },
                  { l: "STATUS", v: agentData?.status?.toUpperCase() || "—" },
                  { l: "OPS", v: String(agentData?.totalCalls || 0) },
                ].map(s => (
                  <div key={s.l} className="bg-black/40 p-3 text-center">
                    <div className="text-[7px] tracking-[0.4em] text-zinc-700 uppercase">{s.l}</div>
                    <div className="text-xl font-black text-[var(--ak-ink)] mt-0.5" style={{ fontFamily: "var(--font-heading)" }}>{s.v}</div>
                  </div>
                ))}
              </div>

              {agentData?.status === "active" && (
                <div className="border border-[var(--ak-rule)] bg-[var(--ak-paper-light)] p-3">
                  <div className="text-[8px] tracking-[0.3em] uppercase text-[var(--ak-ink3)] mb-1">WHAT HAPPENS NEXT</div>
                  <p className="text-xs text-[var(--ak-ink2)] leading-relaxed">
                    Your agent is now discoverable on the marketplace. Subscribers can call it via the API.
                    You&apos;ll earn from every subscriber call — earnings weighted by quality. Monitor performance in your provider dashboard.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            {agentSlug && agentData?.status === "active" && (
              <Link
                href={`/agents/${agentSlug}`}
                className="flex-1 py-3 text-xs font-bold tracking-[0.2em] uppercase bg-[var(--ak-signal)] hover:opacity-80 text-[var(--ak-ink)] transition-colors text-center"
              >
                View on Marketplace
              </Link>
            )}
            <button
              onClick={reset}
              className="px-6 py-3 text-xs tracking-[0.2em] uppercase border border-[var(--ak-rule)] text-[var(--ak-ink3)] hover:text-[var(--ak-ink)] hover:border-white/[0.15] transition-colors cursor-pointer"
            >
              Register Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

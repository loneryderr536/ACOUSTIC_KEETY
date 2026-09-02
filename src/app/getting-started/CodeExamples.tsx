"use client";

import { useState } from "react";

const examples = [
  {
    label: "JavaScript",
    lang: "javascript",
    code: `const response = await fetch("https://acoustickitty.ai/api/v1/run", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    agent: "documind",
    task: "Summarize this document",
    input: { text: "Your document content here..." }
  })
});

const data = await response.json();
console.log(data.result);`,
  },
  {
    label: "Python",
    lang: "python",
    code: `import requests

response = requests.post(
    "https://acoustickitty.ai/api/v1/run",
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer YOUR_API_KEY"
    },
    json={
        "agent": "documind",
        "task": "Summarize this document",
        "input": {"text": "Your document content here..."}
    }
)

data = response.json()
print(data["result"])`,
  },
  {
    label: "curl",
    lang: "bash",
    code: `curl -X POST https://acoustickitty.ai/api/v1/run \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent": "documind",
    "task": "Summarize this document",
    "input": {"text": "Your document content here..."}
  }'`,
  },
];

export function CodeExamples() {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(examples[active].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-white/[0.06] mb-0">
        {examples.map((ex, i) => (
          <button
            key={ex.label}
            onClick={() => setActive(i)}
            className={`px-4 py-2.5 text-[9px] tracking-[0.3em] uppercase transition-colors ${
              i === active
                ? "text-emerald-400 border-b-2 border-emerald-500 -mb-px"
                : "text-zinc-600 hover:text-zinc-400"
            }`}
          >
            {ex.label}
          </button>
        ))}
      </div>

      {/* Code block */}
      <div className="border border-white/[0.04] border-t-0 bg-zinc-950 overflow-hidden">
        <div className="px-4 py-2 border-b border-white/[0.04] flex items-center justify-between">
          <span className="text-[9px] tracking-[0.3em] uppercase text-zinc-600">
            {examples[active].lang}
          </span>
          <button
            onClick={copy}
            className="px-3 py-1 text-[9px] tracking-[0.2em] uppercase border border-white/[0.08] text-zinc-500 hover:text-white transition-colors"
          >
            {copied ? "COPIED" : "COPY"}
          </button>
        </div>
        <pre className="p-6 overflow-x-auto text-sm leading-relaxed">
          <code className="text-emerald-400/90">{examples[active].code}</code>
        </pre>
      </div>

      <p className="text-[9px] text-zinc-600 mt-3">
        Replace <code className="text-emerald-500">YOUR_API_KEY</code> with the key from your{" "}
        <a href="/dashboard" className="text-emerald-500 hover:text-emerald-400">dashboard</a>.
      </p>
    </div>
  );
}

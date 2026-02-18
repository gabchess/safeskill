"use client";

import { useState } from "react";

/* ── Icons (inline SVG to avoid heavy deps) ────────────────────────────── */

function IconShield({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconScan({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" x2="17" y1="12" y2="12" />
    </svg>
  );
}

function IconLoader({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function IconCheck({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconAlert({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  );
}

function IconX({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="15" x2="9" y1="9" y2="15" /><line x1="9" x2="15" y1="9" y2="15" />
    </svg>
  );
}

function IconGithub({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function IconExternal({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" x2="21" y1="14" y2="3" />
    </svg>
  );
}

/* ── Types ──────────────────────────────────────────────────────────────── */

interface Finding {
  ruleId: string;
  severity: string;
  title: string;
  plainEnglish: string;
  file: string;
  line?: number;
  matchedContent?: string;
  recommendation: string;
}

interface ScanResult {
  skillName: string;
  score: number;
  rating: "GREEN" | "YELLOW" | "RED";
  findings: Finding[];
  scannedFiles: number;
  scanDuration: number;
}

/* ── Detection cards data ──────────────────────────────────────────────── */

const DETECT_CARDS = [
  {
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    title: "Code Execution",
    desc: "eval(), new Function(), and dynamic code execution that can run arbitrary payloads.",
  },
  {
    icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    title: "Env Harvesting",
    desc: "Bulk reads of process.env and transmission of environment variables over the network.",
  },
  {
    icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 15l2 2 4-4",
    title: "Sensitive File Access",
    desc: "Reads of SSH keys, cloud credentials, browser profiles, crypto wallets, and .env files.",
  },
  {
    icon: "M22 12h-4l-3 9L9 3l-3 9H2",
    title: "Network Exfiltration",
    desc: "Connections to Telegram bots, Discord webhooks, paste sites, and hardcoded IPs.",
  },
  {
    icon: "M4 17l6-6-6-6 M12 19h8",
    title: "Shell Injection",
    desc: "Shell commands built with string interpolation — classic command injection.",
  },
  {
    icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
    title: "Prompt Injection",
    desc: "Hidden instructions in descriptions that override your AI agent's behavior.",
  },
  {
    icon: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7zm0 0 M12 9v0 M12 15v0",
    title: "Code Obfuscation",
    desc: "Base64/hex decoding at runtime, hidden Unicode, and obfuscated JavaScript.",
  },
  {
    icon: "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
    title: "Hardcoded Secrets",
    desc: "API keys, private keys, tokens, and crypto wallet addresses embedded in code.",
  },
];

/* ── Components ────────────────────────────────────────────────────────── */

function ScoreDisplay({ score, rating }: { score: number; rating: string }) {
  const color =
    rating === "GREEN" ? "text-[#22c55e]" : rating === "YELLOW" ? "text-[#eab308]" : "text-[#ef4444]";
  const border =
    rating === "GREEN" ? "border-[#22c55e]" : rating === "YELLOW" ? "border-[#eab308]" : "border-[#ef4444]";
  const label = rating === "GREEN" ? "Clean" : rating === "YELLOW" ? "Caution" : "Danger";
  const sublabel =
    rating === "GREEN"
      ? "No significant issues found"
      : rating === "YELLOW"
        ? "Some concerns — review findings"
        : "Serious issues — avoid this server";
  const Icon = rating === "GREEN" ? IconCheck : rating === "YELLOW" ? IconAlert : IconX;

  return (
    <div className="flex items-center gap-4">
      <div className={`w-20 h-20 rounded-full flex items-center justify-center border-4 ${border}`}>
        <span className={`text-2xl font-bold font-[family-name:var(--font-geist-mono)] ${color}`}>{score}</span>
      </div>
      <div>
        <div className={`flex items-center gap-2 text-lg font-semibold ${color}`}>
          <Icon className="w-5 h-5" />
          {label}
        </div>
        <div className="text-sm text-[#71717a]">{sublabel}</div>
      </div>
    </div>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const isCrit = finding.severity === "critical";
  const isHigh = finding.severity === "high";
  const borderColor = isCrit
    ? "border-[#ef4444]/30"
    : isHigh
      ? "border-[#eab308]/30"
      : "border-[#1e1e2a]";
  const bgColor = isCrit ? "bg-[#ef4444]/5" : isHigh ? "bg-[#eab308]/5" : "bg-[#111118]";
  const badgeColor = isCrit
    ? "bg-[#ef4444]/20 text-[#ef4444]"
    : isHigh
      ? "bg-[#eab308]/20 text-[#eab308]"
      : "bg-[#1e1e2a] text-[#71717a]";

  return (
    <div className={`rounded-lg border p-4 ${borderColor} ${bgColor}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-[#e4e4e7] text-sm">{finding.title}</h4>
        <span className={`text-xs font-[family-name:var(--font-geist-mono)] px-2 py-0.5 rounded-full shrink-0 ${badgeColor}`}>
          {finding.severity.toUpperCase()}
        </span>
      </div>
      <p className="text-sm text-[#71717a] mb-2">{finding.plainEnglish}</p>
      {finding.matchedContent && (
        <pre className="text-xs font-[family-name:var(--font-geist-mono)] bg-[#0a0a0f]/50 rounded p-2 overflow-x-auto mb-2 text-[#71717a]">
          {finding.matchedContent.slice(0, 200)}
        </pre>
      )}
      <p className="text-xs text-[#71717a]">
        <span className="font-[family-name:var(--font-geist-mono)]">
          {finding.file}{finding.line ? `:${finding.line}` : ""}
        </span>
      </p>
    </div>
  );
}

function DetectCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-[#111118] border border-[#1e1e2a] rounded-xl p-5 hover:border-[#22c55e]/30 transition-colors">
      <svg className="w-8 h-8 text-[#22c55e] mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={icon} />
      </svg>
      <h3 className="font-semibold mb-1.5">{title}</h3>
      <p className="text-sm text-[#71717a] leading-relaxed">{desc}</p>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleScan() {
    if (!input.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: input.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Scan failed");
        return;
      }
      setResult(data);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.06),transparent_70%)]" />
        <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#1e1e2a] bg-[#111118] text-sm text-[#71717a] mb-8">
            <IconShield className="w-4 h-4 text-[#22c55e]" />
            Open-source MCP security scanner
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6">
            Is your MCP setup <span className="text-[#22c55e]">safe</span>?
          </h1>

          <p className="text-xl text-[#71717a] max-w-2xl mx-auto mb-10">
            1 in 4 MCP servers has security issues. Find out in seconds.
          </p>

          <a
            href="#scanner"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#22c55e] text-[#0a0a0f] font-semibold rounded-lg hover:bg-[#22c55e]/90 transition-colors text-lg"
          >
            <IconScan className="w-5 h-5" />
            Scan Now
          </a>
        </div>
      </section>

      {/* ── Stats Bar ─────────────────────────────────────────────────── */}
      <section className="border-y border-[#1e1e2a] bg-[#111118]/50">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold font-[family-name:var(--font-geist-mono)] text-[#e4e4e7]">3,093</div>
              <div className="text-sm text-[#71717a] mt-1">servers scanned</div>
            </div>
            <div>
              <div className="text-3xl font-bold font-[family-name:var(--font-geist-mono)] text-[#eab308]">28%</div>
              <div className="text-sm text-[#71717a] mt-1">had findings</div>
            </div>
            <div>
              <div className="text-3xl font-bold font-[family-name:var(--font-geist-mono)] text-[#ef4444]">176</div>
              <div className="text-sm text-[#71717a] mt-1">scored 0/100</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Scanner ───────────────────────────────────────────────────── */}
      <section id="scanner" className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-3">Scan a server</h2>
          <p className="text-[#71717a]">
            Paste an npm package name or GitHub URL. We&apos;ll download it, scan it, and show you the results.
          </p>
        </div>

        <div className="bg-[#111118] border border-[#1e1e2a] rounded-xl p-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
              placeholder="e.g. @modelcontextprotocol/server-filesystem"
              className="flex-1 bg-[#0a0a0f] border border-[#1e1e2a] rounded-lg px-4 py-3 text-[#e4e4e7] placeholder:text-[#71717a]/50 focus:outline-none focus:border-[#22c55e]/50 font-[family-name:var(--font-geist-mono)] text-sm"
              disabled={loading}
            />
            <button
              onClick={handleScan}
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-[#22c55e] text-[#0a0a0f] font-semibold rounded-lg hover:bg-[#22c55e]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
            >
              {loading ? (
                <><IconLoader className="w-4 h-4" />Scanning...</>
              ) : (
                <><IconScan className="w-4 h-4" />Scan</>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-6 p-4 rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/5 text-[#ef4444] text-sm">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4 pb-6 border-b border-[#1e1e2a]">
                <ScoreDisplay score={result.score} rating={result.rating} />
                <div className="text-right text-sm text-[#71717a]">
                  <div>{result.scannedFiles} files scanned in {result.scanDuration}ms</div>
                  <div>{result.findings.length} finding{result.findings.length === 1 ? "" : "s"}</div>
                </div>
              </div>

              {result.findings.length === 0 ? (
                <div className="text-center py-8 text-[#71717a]">
                  <IconCheck className="w-12 h-12 mx-auto mb-3 text-[#22c55e]" />
                  <p className="text-lg font-medium text-[#e4e4e7]">No security issues found</p>
                  <p className="text-sm">This server looks clean.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {result.findings
                    .sort((a, b) => {
                      const ord: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
                      return (ord[a.severity] ?? 5) - (ord[b.severity] ?? 5);
                    })
                    .slice(0, 20)
                    .map((f, i) => (
                      <FindingCard key={i} finding={f} />
                    ))}
                  {result.findings.length > 20 && (
                    <p className="text-sm text-[#71717a] text-center pt-2">
                      ...and {result.findings.length - 20} more. Install SafeSkill locally for the full report.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── What We Detect ────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">What we detect</h2>
          <p className="text-[#71717a]">32 rules across 8 categories, tuned for the MCP ecosystem.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {DETECT_CARDS.map((c) => (
            <DetectCard key={c.title} {...c} />
          ))}
        </div>
      </section>

      {/* ── Blog CTA ──────────────────────────────────────────────────── */}
      <section className="border-y border-[#1e1e2a] bg-[#111118]/50">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-bold mb-3">Read the research</h2>
          <p className="text-[#71717a] mb-8 max-w-xl mx-auto">
            We scanned 3,093 MCP servers from npm and the official registry.
            28% had security findings. 176 scored zero. Read the full analysis.
          </p>
          <a
            href="https://github.com/gabchess/safeskill/blob/main/blog/i-scanned-every-mcp-server.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 border border-[#1e1e2a] bg-[#111118] rounded-lg hover:border-[#22c55e]/50 transition-colors font-medium"
          >
            I Scanned 3,093 MCP Servers. Here&apos;s What I Found.
            <IconExternal />
          </a>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between text-sm text-[#71717a]">
          <div className="flex items-center gap-2">
            <IconShield className="w-4 h-4 text-[#22c55e]" />
            <span className="font-semibold text-[#e4e4e7]">SafeSkill</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/gabchess/safeskill"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-[#e4e4e7] transition-colors"
            >
              <IconGithub className="w-4 h-4" />
              GitHub
            </a>
            <span>
              Built by{" "}
              <a href="https://x.com/gabe_onchain" target="_blank" rel="noopener noreferrer" className="hover:text-[#e4e4e7] transition-colors">
                @gabe_onchain
              </a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

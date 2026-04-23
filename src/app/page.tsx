"use client";

import { useState } from "react";
import Image from "next/image";
import { Sparkles, Loader2, CheckCircle2, AlertCircle, Wand2 } from "lucide-react";

type RunLogEntry = {
  kind: "thought" | "tool" | "tool-result" | "final" | "error";
  text: string;
};

type RunResponse = {
  ok: boolean;
  summary?: string;
  log?: RunLogEntry[];
  error?: string;
};

const EXAMPLES = [
  "Email a summary of today's top 3 Hacker News stories to me at your-email@example.com.",
  "Post 'Good morning team!' to Slack using this webhook: https://hooks.slack.com/services/XXX/YYY/ZZZ",
  "Fetch the latest BBC Premier League headlines and post a 3-bullet summary to Discord webhook https://discord.com/api/webhooks/XXX/YYY",
  "Get the current Bitcoin price from https://api.coinpaprika.com/v1/tickers/btc-bitcoin and email it to me.",
];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResponse | null>(null);

  async function run() {
    if (!prompt.trim() || running) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = (await res.json()) as RunResponse;
      setResult(data);
    } catch (err) {
      setResult({ ok: false, error: (err as Error).message });
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="flex-1 w-full">
      <header className="w-full border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/icon-192.png"
              alt="TaskPilot"
              width={32}
              height={32}
              className="rounded-lg"
              priority
            />
            <span className="font-semibold tracking-tight">TaskPilot</span>
          </div>
          <a
            href="https://github.com/BRANDSYNERGY/taskpilot"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition"
          >
            GitHub
          </a>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 pt-10 pb-6 sm:pt-16">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
            <Sparkles className="h-3 w-3" />
            AI-powered task automation
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-tight">
            Automate anything with{" "}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              one prompt.
            </span>
          </h1>
          <p className="text-[var(--muted)] max-w-xl mx-auto text-sm sm:text-base">
            Describe a task in plain English. TaskPilot plans it, runs it, and shows you the result.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl shadow-black/30 overflow-hidden">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Get today's weather in London and tell me whether I need an umbrella."
            rows={4}
            className="w-full resize-none bg-transparent px-4 py-4 text-base outline-none placeholder:text-[var(--muted)]"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run();
            }}
          />
          <div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-2">
            <span className="text-xs text-[var(--muted)] hidden sm:inline">
              ⌘/Ctrl + Enter to run
            </span>
            <button
              onClick={run}
              disabled={running || !prompt.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-medium text-white shadow hover:from-violet-400 hover:to-fuchsia-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Running…
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" /> Run task
                </>
              )}
            </button>
          </div>
        </div>

        {!result && !running && (
          <div className="mt-5 flex flex-wrap gap-2 justify-center">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                className="text-xs sm:text-sm rounded-full border border-[var(--border)] px-3 py-1.5 text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--muted)] transition"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </section>

      {(result || running) && (
        <section className="max-w-3xl mx-auto px-4 pb-16 space-y-4">
          {running && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex items-center gap-3 text-sm text-[var(--muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking & executing… this can take 5–30 seconds.
            </div>
          )}

          {result?.ok && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-2">
                <CheckCircle2 className="h-4 w-4" /> Done
              </div>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                {result.summary}
              </p>
            </div>
          )}

          {result && !result.ok && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
              <div className="flex items-center gap-2 text-red-400 text-sm font-medium mb-2">
                <AlertCircle className="h-4 w-4" /> Something went wrong
              </div>
              <p className="text-sm text-red-300 whitespace-pre-wrap">{result.error}</p>
            </div>
          )}

          {result?.log && result.log.length > 0 && (
            <details className="rounded-2xl border border-[var(--border)] bg-[var(--card)]">
              <summary className="cursor-pointer px-4 py-3 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
                Show execution trace ({result.log.length} steps)
              </summary>
              <ol className="divide-y divide-[var(--border)]">
                {result.log.map((entry, i) => (
                  <li key={i} className="px-4 py-3 text-xs font-mono">
                    <span className="inline-block min-w-24 text-[var(--muted)] uppercase tracking-wider">
                      {entry.kind}
                    </span>
                    <span className="whitespace-pre-wrap break-words">{entry.text}</span>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </section>
      )}

      <footer className="mt-auto border-t border-[var(--border)] py-6 text-center text-xs text-[var(--muted)]">
        TaskPilot · built with Next.js + OpenAI · deployed on Render
      </footer>
    </main>
  );
}

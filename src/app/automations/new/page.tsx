"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { DAYS_OF_WEEK } from "@/lib/scheduler";

export default function NewAutomationPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [scheduleType, setScheduleType] = useState("daily");
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  const [dow, setDow] = useState(1); // Monday
  const [dom, setDom] = useState(1);

  async function save() {
    if (!name.trim() || !prompt.trim()) { setError("Name and prompt are required."); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, prompt, scheduleType,
        scheduleHour: hour, scheduleMinute: minute,
        scheduleDow: scheduleType === "weekly" ? dow : null,
        scheduleDom: scheduleType === "monthly" ? dom : null,
      }),
    });
    if (res.ok) {
      router.push("/automations");
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to save.");
      setSaving(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/automations" className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6 transition">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to automations
      </Link>
      <h1 className="text-2xl font-semibold mb-1">New Automation</h1>
      <p className="text-sm text-[var(--muted)] mb-8">Set it once. TaskPilot runs it automatically on your schedule.</p>

      <div className="space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Automation name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Daily Premier League update"
            className="w-full rounded-xl bg-[var(--card)] border border-[var(--border)] px-4 py-2.5 text-sm outline-none focus:border-violet-500 transition"
          />
        </div>

        {/* Prompt */}
        <div>
          <label className="block text-sm font-medium mb-1.5">What should TaskPilot do?</label>
          <p className="text-xs text-[var(--muted)] mb-2">Write it like you&apos;re telling a human assistant. Be specific — include URLs, email addresses, webhook URLs, etc.</p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Fetch the top 5 BBC Sport football headlines and post a summary to Discord using this webhook: https://discord.com/api/webhooks/..."
            rows={5}
            className="w-full rounded-xl bg-[var(--card)] border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-violet-500 transition resize-none"
          />
        </div>

        {/* Schedule */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Schedule</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {["manual", "hourly", "daily", "weekly", "monthly"].map((t) => (
              <button
                key={t}
                onClick={() => setScheduleType(t)}
                className={`rounded-xl border px-3 py-2 text-sm capitalize transition ${scheduleType === t ? "border-violet-500 bg-violet-500/20 text-violet-300" : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)]"}`}
              >
                {t}
              </button>
            ))}
          </div>

          {scheduleType !== "manual" && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
              {scheduleType !== "hourly" && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-[var(--muted)] w-16">Hour</label>
                  <input type="number" min={0} max={23} value={hour} onChange={(e) => setHour(Number(e.target.value))}
                    className="w-20 rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-1.5 text-sm outline-none" />
                </div>
              )}
              <div className="flex items-center gap-3">
                <label className="text-sm text-[var(--muted)] w-16">Minute</label>
                <input type="number" min={0} max={59} value={minute} onChange={(e) => setMinute(Number(e.target.value))}
                  className="w-20 rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-1.5 text-sm outline-none" />
              </div>
              {scheduleType === "weekly" && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-[var(--muted)] w-16">Day</label>
                  <select value={dow} onChange={(e) => setDow(Number(e.target.value))}
                    className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-1.5 text-sm outline-none">
                    {DAYS_OF_WEEK.map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </select>
                </div>
              )}
              {scheduleType === "monthly" && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-[var(--muted)] w-16">Day of month</label>
                  <input type="number" min={1} max={28} value={dom} onChange={(e) => setDom(Number(e.target.value))}
                    className="w-20 rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-1.5 text-sm outline-none" />
                </div>
              )}
            </div>
          )}
          {scheduleType === "manual" && (
            <p className="text-xs text-[var(--muted)] mt-1">You&apos;ll trigger this manually from the automations dashboard.</p>
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-3 font-medium text-white hover:from-violet-400 hover:to-fuchsia-400 disabled:opacity-50 transition"
        >
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save Automation"}
        </button>
      </div>
    </main>
  );
}

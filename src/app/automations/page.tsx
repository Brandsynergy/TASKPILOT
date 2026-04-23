"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Play, Trash2, ToggleLeft, ToggleRight, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { describeSchedule } from "@/lib/scheduler";

type Automation = {
  id: string;
  name: string;
  prompt: string;
  scheduleType: string;
  scheduleHour: number;
  scheduleMinute: number;
  scheduleDow: number | null;
  scheduleDom: number | null;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  runs: { status: string; result: string | null; startedAt: string }[];
};

function StatusBadge({ status }: { status: string }) {
  if (status === "success") return <span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle2 className="h-3 w-3" /> Success</span>;
  if (status === "failed")  return <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle className="h-3 w-3" /> Failed</span>;
  return <span className="flex items-center gap-1 text-yellow-400 text-xs"><Loader2 className="h-3 w-3 animate-spin" /> Running</span>;
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/automations");
    if (res.ok) setAutomations(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(a: Automation) {
    await fetch(`/api/automations/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !a.enabled }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this automation?")) return;
    await fetch(`/api/automations/${id}`, { method: "DELETE" });
    load();
  }

  async function runNow(id: string) {
    setRunningId(id);
    await fetch(`/api/automations/${id}/run`, { method: "POST" });
    setRunningId(null);
    load();
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-[var(--muted)]">
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
    </div>
  );

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Automations</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Saved tasks that run on a schedule — fully automatic, no prompting needed.</p>
        </div>
        <Link
          href="/automations/new"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-medium text-white hover:from-violet-400 hover:to-fuchsia-400 transition"
        >
          <Plus className="h-4 w-4" /> New
        </Link>
      </div>

      {automations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-12 text-center text-[var(--muted)]">
          <p className="text-lg mb-2">No automations yet.</p>
          <p className="text-sm mb-6">Create one and it will run automatically on its schedule.</p>
          <Link href="/automations/new" className="inline-flex items-center gap-2 rounded-xl bg-violet-500/20 border border-violet-500/30 px-4 py-2 text-sm text-violet-300 hover:bg-violet-500/30 transition">
            <Plus className="h-4 w-4" /> Create your first automation
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map((a) => {
            const lastRun = a.runs[0];
            return (
              <div key={a.id} className={`rounded-2xl border bg-[var(--card)] p-4 transition ${a.enabled ? "border-[var(--border)]" : "border-[var(--border)] opacity-60"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{a.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${a.enabled ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-[var(--border)] text-[var(--muted)]"}`}>
                        {a.enabled ? "Active" : "Paused"}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--muted)] truncate mt-0.5">{a.prompt}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-[var(--muted)]">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {describeSchedule(a)}</span>
                      {lastRun && <StatusBadge status={lastRun.status} />}
                      {a.nextRunAt && a.enabled && (
                        <span>Next: {new Date(a.nextRunAt).toLocaleString()}</span>
                      )}
                    </div>
                    {lastRun?.result && (
                      <p className="text-xs text-[var(--muted)] mt-2 line-clamp-2 bg-white/5 rounded-lg px-2 py-1">{lastRun.result}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => runNow(a.id)}
                      disabled={runningId === a.id}
                      title="Run now"
                      className="p-2 rounded-lg hover:bg-white/10 text-[var(--muted)] hover:text-[var(--foreground)] transition disabled:opacity-50"
                    >
                      {runningId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => toggle(a)}
                      title={a.enabled ? "Pause" : "Enable"}
                      className="p-2 rounded-lg hover:bg-white/10 text-[var(--muted)] hover:text-[var(--foreground)] transition"
                    >
                      {a.enabled ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => remove(a.id)}
                      title="Delete"
                      className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--muted)] hover:text-red-400 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

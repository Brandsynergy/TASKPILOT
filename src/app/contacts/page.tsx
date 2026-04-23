"use client";

import { useEffect, useState, useCallback } from "react";
import { Trash2, Plus, Loader2, Users } from "lucide-react";

type Contact = { id: string; name: string; email: string | null; phone: string | null; listName: string };

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [listName, setListName] = useState("default");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/contacts");
    if (res.ok) setContacts(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!name.trim()) { setError("Name is required."); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, listName }),
    });
    if (res.ok) {
      setName(""); setEmail(""); setPhone(""); setListName("default");
      load();
    } else {
      const d = await res.json();
      setError(d.error ?? "Failed to add contact.");
    }
    setSaving(false);
  }

  async function remove(id: string) {
    await fetch(`/api/contacts?id=${id}`, { method: "DELETE" });
    load();
  }

  // Group contacts by list name
  const grouped = contacts.reduce<Record<string, Contact[]>>((acc, c) => {
    (acc[c.listName] = acc[c.listName] ?? []).push(c);
    return acc;
  }, {});

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Store contacts in lists. Use <code className="bg-white/10 px-1 rounded text-xs">get_contacts</code> in your automation prompts to send personalised messages to everyone.
        </p>
      </div>

      {/* Add contact form */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 mb-8">
        <h2 className="text-sm font-medium mb-3">Add a contact</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name *" className="rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-violet-500 transition" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className="rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-violet-500 transition" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className="rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-violet-500 transition" />
          <input value={listName} onChange={(e) => setListName(e.target.value)} placeholder="List name (e.g. customers)" className="rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-violet-500 transition" />
        </div>
        {error && <p className="text-sm text-red-400 mb-2">{error}</p>}
        <button onClick={add} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-medium text-white hover:from-violet-400 hover:to-fuchsia-400 disabled:opacity-50 transition">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add Contact
        </button>
      </div>

      {/* Contact list */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-[var(--muted)]">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : contacts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-12 text-center text-[var(--muted)]">
          <Users className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-lg mb-1">No contacts yet.</p>
          <p className="text-sm">Add contacts above. Then use them in automations to send bulk personalised messages.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([list, items]) => (
            <div key={list}>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-medium capitalize">{list}</h2>
                <span className="text-xs text-[var(--muted)] bg-white/5 px-2 py-0.5 rounded-full">{items.length}</span>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)] overflow-hidden">
                {items.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact details"}
                      </p>
                    </div>
                    <button onClick={() => remove(c.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--muted)] hover:text-red-400 transition">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Usage tip */}
      {contacts.length > 0 && (
        <div className="mt-8 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 text-sm text-[var(--muted)]">
          <p className="font-medium text-violet-300 mb-1">How to use in an automation</p>
          <p>In your automation prompt, write something like:</p>
          <p className="mt-1 text-xs bg-white/5 rounded-lg px-3 py-2 font-mono">
            &quot;Get all contacts from the &apos;customers&apos; list. For each one, send a personalised email to their email address with subject &apos;Your weekly update&apos; and a brief summary of today&apos;s tech news.&quot;
          </p>
        </div>
      )}
    </main>
  );
}

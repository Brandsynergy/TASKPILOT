"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Wand2, Zap, Users } from "lucide-react";

const links = [
  { href: "/", label: "Run Task", icon: Wand2 },
  { href: "/automations", label: "Automations", icon: Zap },
  { href: "/contacts", label: "Contacts", icon: Users },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="w-full border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/icon-192.png" alt="TaskPilot" width={32} height={32} className="rounded-lg" priority />
          <span className="font-semibold tracking-tight">TaskPilot</span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                  active
                    ? "bg-violet-500/20 text-violet-300"
                    : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/5"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

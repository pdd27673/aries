"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

// Sticky top bar: wordmark + nav (with active-route highlighting) + theme toggle.
export function Header() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="header">
      <Link href="/" className="brand">
        <span className="brand-mark" aria-hidden>
          ◈
        </span>
        Newslens <span className="brand-sub">· AI news analysis</span>
      </Link>

      <nav className="nav">
        <Link href="/" className={isActive("/") ? "active" : ""}>
          Search
        </Link>
        <Link href="/history" className={isActive("/history") ? "active" : ""}>
          History
        </Link>
      </nav>

      <span className="header-spacer" />
      <ThemeToggle />
    </header>
  );
}

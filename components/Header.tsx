"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

// Sticky top bar bound to the body width: centered nav + theme toggle.
export function Header() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="header">
      <div className="header-inner">
        <span aria-hidden />
        <nav className="nav">
          <Link href="/" className={isActive("/") ? "active" : ""}>
            Search
          </Link>
          <Link href="/history" className={isActive("/history") ? "active" : ""}>
            History
          </Link>
        </nav>
        <div className="header-right">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

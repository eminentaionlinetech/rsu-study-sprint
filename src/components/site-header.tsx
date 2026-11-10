import { Link } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-ink text-accent">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-base font-semibold tracking-tight">
              EHRM CBT Portal
            </span>
            <span className="block text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Rivers State University
            </span>
          </span>
        </Link>
        <Link
          to="/admin"
          className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Admin
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted-foreground sm:px-6">
        Department of Employment Relations &amp; Human Resource Management · 100 Level exam
        preparation
      </div>
    </footer>
  );
}

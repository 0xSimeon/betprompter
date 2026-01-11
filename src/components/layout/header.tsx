"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { TrendingUp, CalendarDays, History, Menu, X } from "lucide-react";

const navItems = [
  { href: "/", label: "Fixtures", icon: CalendarDays },
  { href: "/history", label: "History", icon: History },
];

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/30 bg-background/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/50 shadow-lg shadow-black/5">
      {/* Enhanced gradient accent line with glow */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent blur-sm" />

      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 sm:gap-3 group cursor-pointer">
          {/* Enhanced logo with glow effect */}
          <div className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 shadow-xl shadow-emerald-500/25 group-hover:shadow-emerald-500/40 group-hover:scale-105 transition-all duration-300">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-white drop-shadow-lg" />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-white/0 to-white/20" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg sm:text-xl tracking-tighter leading-none bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              BetPrompter
            </span>
            <span className="text-[8px] sm:text-[9px] text-muted-foreground font-bold tracking-[0.2em] uppercase mt-0.5 hidden sm:block">
              AI Predictions
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden sm:flex items-center gap-1.5 glass p-1.5 rounded-xl shadow-inner">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-2.5 px-5 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 cursor-pointer overflow-hidden group/nav",
                  isActive
                    ? "bg-emerald-500/15 text-emerald-300 shadow-lg shadow-emerald-500/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <Icon className={cn(
                  "w-4 h-4 transition-transform duration-300",
                  isActive && "text-emerald-400"
                )} />
                <span className="relative z-10">{item.label}</span>
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent animate-subtle-float" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="sm:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-border/30 bg-background/95 backdrop-blur-xl">
          <nav className="container mx-auto px-4 py-3 flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-all",
                    isActive
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                >
                  <Icon className={cn("w-5 h-5", isActive && "text-emerald-400")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}

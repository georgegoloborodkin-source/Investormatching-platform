import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Command,
  ChevronDown,
  Menu,
  X,
  ArrowRight,
} from "lucide-react";
import HeroBackground from "@/components/HeroBackground";

/* ─── colour tokens ─── */
const CLR = {
  purple: "#7b39fc",
  purpleHover: "#6a2ce0",
  dark: "#2b2344",
  darkHover: "#352b54",
  orange: "#f87b52",
  glassBorder: "rgba(164,132,215,0.5)",
  glassBg: "rgba(85,80,110,0.4)",
} as const;

/* ─── typography helpers (inline style) ─── */
const fontManrope: React.CSSProperties = { fontFamily: "'Manrope', sans-serif" };
const fontInter: React.CSSProperties = { fontFamily: "'Inter', sans-serif" };
const fontCabin: React.CSSProperties = { fontFamily: "'Cabin', sans-serif" };
const fontSerif: React.CSSProperties = { fontFamily: "'Instrument Serif', serif" };

const NAV_LINKS = [
  { label: "Home", href: "#" },
  { label: "Services", href: "#", chevron: true },
  { label: "Reviews", href: "#" },
  { label: "Contact us", href: "#" },
];

export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden bg-black" style={fontManrope}>
      {/* ── Fullscreen video bg ── */}
      <HeroBackground />

      {/* ── Content layer ── */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* ════════════════════════ NAVBAR ════════════════════════ */}
        <nav className="w-full px-5 sm:px-8 lg:px-12 py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
                <Command className="h-5 w-5 text-black" />
              </div>
              <span
                className="text-white text-lg font-bold tracking-tight hidden sm:inline"
                style={fontInter}
              >
                Venture OS
              </span>
            </Link>

            {/* Desktop links */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white/75 hover:text-white transition-colors rounded-lg"
                  style={fontManrope}
                >
                  {l.label}
                  {l.chevron && <ChevronDown className="h-3.5 w-3.5 opacity-60" />}
                </a>
              ))}
            </div>

            {/* Desktop CTAs */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                to="/login"
                className="px-5 py-2 text-sm font-semibold text-white rounded-full border transition-colors"
                style={{
                  ...fontCabin,
                  borderColor: CLR.glassBorder,
                  background: CLR.glassBg,
                  backdropFilter: "blur(12px)",
                }}
              >
                Sign In
              </Link>
              <Link
                to="/login"
                className="px-5 py-2 text-sm font-semibold text-white rounded-full transition-colors hover:opacity-90"
                style={{ ...fontCabin, background: CLR.purple }}
                onMouseEnter={(e) => (e.currentTarget.style.background = CLR.purpleHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = CLR.purple)}
              >
                Get Started
              </Link>
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden flex items-center justify-center h-10 w-10 text-white"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </nav>

        {/* ── Mobile overlay ── */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4">
              <Link to="/" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
                  <Command className="h-5 w-5 text-black" />
                </div>
                <span className="text-white text-lg font-bold tracking-tight" style={fontInter}>
                  Venture OS
                </span>
              </Link>
              <button
                className="h-10 w-10 flex items-center justify-center text-white"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex flex-col items-center justify-center flex-1 gap-6">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  className="text-2xl font-semibold text-white/80 hover:text-white transition-colors"
                  style={fontManrope}
                  onClick={() => setMobileOpen(false)}
                >
                  {l.label}
                </a>
              ))}
              <div className="flex flex-col gap-3 mt-8 w-64">
                <Link
                  to="/login"
                  className="px-5 py-3 text-center text-sm font-semibold text-white rounded-full border"
                  style={{ ...fontCabin, borderColor: CLR.glassBorder, background: CLR.glassBg }}
                  onClick={() => setMobileOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  to="/login"
                  className="px-5 py-3 text-center text-sm font-semibold text-white rounded-full"
                  style={{ ...fontCabin, background: CLR.purple }}
                  onClick={() => setMobileOpen(false)}
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════ HERO ════════════════════════ */}
        <main className="flex-1 flex items-center justify-center px-5 sm:px-8">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2.5 mb-8 px-4 py-2 rounded-full border"
              style={{
                borderColor: CLR.glassBorder,
                background: CLR.glassBg,
                backdropFilter: "blur(16px)",
              }}
            >
              <span
                className="px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white tracking-wide uppercase"
                style={{ ...fontCabin, background: CLR.orange }}
              >
                New
              </span>
              <span className="text-sm text-white/80 font-medium" style={fontCabin}>
                Say Hello to Venture OS v3.2
              </span>
            </div>

            {/* Headline */}
            <h1
              className="text-5xl sm:text-6xl md:text-7xl lg:text-[76px] font-extrabold leading-[1.05] tracking-tight text-white mb-6"
              style={fontInter}
            >
              Your Networks.
              <br />
              <span>One Rapid </span>
              <span className="italic font-normal" style={fontSerif}>
                Interface
              </span>
              <span>.</span>
            </h1>

            {/* Subtext */}
            <p
              className="text-lg sm:text-xl text-white/60 max-w-xl mx-auto mb-10 leading-relaxed"
              style={fontManrope}
            >
              Platform helps admins control access, logs, and servers with purpose.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/login"
                className="group flex items-center gap-2 px-7 py-3.5 text-sm font-bold text-white rounded-full transition-all hover:opacity-90 shadow-lg shadow-purple-500/20"
                style={{ ...fontCabin, background: CLR.purple }}
                onMouseEnter={(e) => (e.currentTarget.style.background = CLR.purpleHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = CLR.purple)}
              >
                Book a Free Demo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/login"
                className="flex items-center gap-2 px-7 py-3.5 text-sm font-bold text-white rounded-full transition-all hover:opacity-90"
                style={{ ...fontCabin, background: CLR.dark }}
                onMouseEnter={(e) => (e.currentTarget.style.background = CLR.darkHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = CLR.dark)}
              >
                Get Started Now
              </Link>
            </div>
          </div>
        </main>

        {/* bottom spacer so hero sits centered vertically */}
        <div className="h-20" />
      </div>
    </div>
  );
}

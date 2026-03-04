import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Command,
  ChevronDown,
  Menu,
  X,
  ArrowRight,
  Brain,
  Target,
  Shield,
  BarChart3,
  Zap,
  TrendingUp,
  Database,
  Rocket,
  Sparkles,
  Check,
  Loader2,
  Circle,
  MessageSquare,
  FolderSync,
  Network,
  FileText,
  Lock,
} from "lucide-react";
import HeroBackground from "@/components/HeroBackground";

/* ─── colour tokens ─── */
const C = {
  purple: "#7b39fc",
  purpleHover: "#6a2ce0",
  dark: "#2b2344",
  darkHover: "#352b54",
  orange: "#f87b52",
  glassBorder: "rgba(164,132,215,0.5)",
  glassBg: "rgba(85,80,110,0.4)",
} as const;

/* ─── typography ─── */
const fManrope: React.CSSProperties = { fontFamily: "'Manrope', sans-serif" };
const fInter: React.CSSProperties = { fontFamily: "'Inter', sans-serif" };
const fCabin: React.CSSProperties = { fontFamily: "'Cabin', sans-serif" };
const fSerif: React.CSSProperties = { fontFamily: "'Instrument Serif', serif" };

/* ─── data ─── */
const NAV_LINKS = [
  { label: "Home", href: "#hero" },
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how", chevron: true },
  { label: "Roadmap", href: "#roadmap" },
];

const PROBLEMS = [
  {
    icon: Database,
    title: "The Problem",
    desc: "Teams drown in documents, lose context across deals, and make decisions without historical data. Information lives in silos — email threads, Drive folders, ClickUp tasks — never connecting.",
  },
  {
    icon: Brain,
    title: "Our Solution",
    desc: "Venture OS is the signal stack that unifies your workflow. AI extracts intelligence from every document, tracks every decision, and surfaces patterns you'd never see manually.",
  },
  {
    icon: Rocket,
    title: "The Impact",
    desc: "Faster decisions. Better outcomes. Teams that learn from every deal. We turn your workflow into a competitive advantage through intelligence, not just data.",
  },
];

const FEATURES = [
  {
    icon: Brain,
    title: "AI Intelligence",
    desc: "Claude-powered document extraction and semantic search. Ask questions in natural language and get answers grounded in your own documents.",
  },
  {
    icon: Target,
    title: "Decision Tracking",
    desc: "Log, track, and analyze every investment decision with outcome-based analytics. Understand what works and why.",
  },
  {
    icon: Shield,
    title: "Team Sync",
    desc: "Real-time collaboration with role-based access control for MDs and investment teams. Everyone stays in sync.",
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    desc: "Sector performance, partner metrics, decision velocity, and comprehensive portfolio intelligence dashboards.",
  },
  {
    icon: Zap,
    title: "Auto-Sync",
    desc: "Seamless integration with Google Drive and your existing workflows. Only new or changed files trigger AI — no manual uploads.",
  },
  {
    icon: TrendingUp,
    title: "Portfolio Intelligence",
    desc: "Cross-company learning and pattern detection across your entire portfolio. Learn from every deal.",
  },
];

const HOW_STEPS = [
  { icon: FolderSync, num: "01", title: "Connect your sources", desc: "Link Google Drive folders, upload decks, or sync from ClickUp. Documents flow in automatically." },
  { icon: MessageSquare, num: "02", title: "Ask & decide", desc: "Ask questions in natural language. Log every investment decision. AI answers from your documents, never hallucinating." },
  { icon: Network, num: "03", title: "See the patterns", desc: "Company cards, connection graphs, and analytics reveal what no spreadsheet can — across every deal." },
];

const DIFFERENTIATORS = [
  { icon: FileText, title: "Grounded in your data", desc: "Every answer is sourced from your documents and company cards. Click any citation to verify." },
  { icon: Brain, title: "Built for funds, not generic chat", desc: "Decision logs, company graphs, and portfolio analytics — purpose-built for investment teams." },
  { icon: Lock, title: "Your data, your control", desc: "Row-level security. Multi-tenant by design. Your fund's data is isolated at the database layer." },
];

const ROADMAP = [
  {
    phase: "Phase 1", title: "Foundation", status: "Complete",
    features: [
      "Document Intelligence System with Claude AI",
      "AI-Powered Decision Tracking & Analytics",
      "Team Collaboration & Role-Based Onboarding",
      "Real-time Synchronization (ClickUp, Google Drive)",
      "Investment Decision Logger with Outcome Tracking",
    ],
  },
  {
    phase: "Phase 2", title: "Intelligence Layer", status: "In Progress",
    features: [
      "Graph Relationships (Companies ↔ Partners ↔ Connections)",
      "Pattern Detection & Predictive Analytics",
      "Advanced Decision Engine with ML",
      "Portfolio Intelligence & Cross-Company Learning",
      "Automated Pipeline Scoring",
    ],
  },
  {
    phase: "Phase 3", title: "Market Leadership", status: "Planned",
    features: [
      "Unsupervised Learning for Entity Matching",
      "Predictive Market Signals & Anomaly Detection",
      "Partner Performance Analytics & Allocation",
      "Automated Syndicate Intelligence",
      "Real-time Market Pulse Dashboard",
    ],
  },
];

/* ─── animated orb component (vivid, moving, colourful) ─── */
function AnimatedOrbs({ scrollY }: { scrollY: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* primary purple orb */}
      <div
        className="absolute rounded-full blur-[140px] opacity-40"
        style={{
          width: 700, height: 700,
          background: "radial-gradient(circle, #7b39fc 0%, #a855f7 40%, transparent 70%)",
          top: -180, left: "50%",
          transform: `translate(-50%, ${scrollY * 0.08}px)`,
          animation: "orbFloat1 12s ease-in-out infinite",
        }}
      />
      {/* orange accent */}
      <div
        className="absolute rounded-full blur-[120px] opacity-30"
        style={{
          width: 500, height: 500,
          background: "radial-gradient(circle, #f87b52 0%, #fb923c 40%, transparent 70%)",
          top: 100, right: -120,
          transform: `translateY(${scrollY * 0.05}px)`,
          animation: "orbFloat2 15s ease-in-out infinite",
        }}
      />
      {/* blue accent */}
      <div
        className="absolute rounded-full blur-[100px] opacity-25"
        style={{
          width: 450, height: 450,
          background: "radial-gradient(circle, #3b82f6 0%, #6366f1 40%, transparent 70%)",
          bottom: -100, left: -100,
          transform: `translateY(${scrollY * -0.04}px)`,
          animation: "orbFloat3 18s ease-in-out infinite",
        }}
      />
      {/* pink accent */}
      <div
        className="absolute rounded-full blur-[130px] opacity-20"
        style={{
          width: 400, height: 400,
          background: "radial-gradient(circle, #ec4899 0%, #f472b6 40%, transparent 70%)",
          top: "40%", left: "15%",
          transform: `translateY(${scrollY * 0.06}px)`,
          animation: "orbFloat4 20s ease-in-out infinite",
        }}
      />
      {/* teal accent */}
      <div
        className="absolute rounded-full blur-[110px] opacity-20"
        style={{
          width: 350, height: 350,
          background: "radial-gradient(circle, #14b8a6 0%, #2dd4bf 40%, transparent 70%)",
          top: "60%", right: "10%",
          transform: `translateY(${scrollY * -0.03}px)`,
          animation: "orbFloat5 14s ease-in-out infinite",
        }}
      />
    </div>
  );
}

/* ─── main component ─── */
export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [visible, setVisible] = useState<Set<number>>(new Set());
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const [navScrolled, setNavScrolled] = useState(false);

  const assignRef = useCallback(
    (idx: number) => (el: HTMLElement | null) => {
      sectionRefs.current[idx] = el;
    },
    [],
  );

  useEffect(() => {
    const onScroll = () => {
      setScrollY(window.scrollY);
      setNavScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const idx = sectionRefs.current.indexOf(e.target as HTMLElement);
          if (idx >= 0 && e.isIntersecting) setVisible((v) => new Set([...v, idx]));
        });
      },
      { rootMargin: "-60px 0px -60px 0px", threshold: 0.08 },
    );
    sectionRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const vis = (i: number) => visible.has(i);
  const reveal = (i: number, delay = 0) =>
    `transition-all duration-700 ${vis(i) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}` +
    (delay ? ` delay-[${delay}ms]` : "");

  return (
    <div className="relative min-h-screen bg-[#07060b] text-white overflow-x-hidden" style={fManrope}>
      {/* ── global animated orbs (vivid & moving bg) ── */}
      <AnimatedOrbs scrollY={scrollY} />

      {/* subtle grid */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      {/* ════════════ NAVBAR ════════════ */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          navScrolled
            ? "bg-[#07060b]/80 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/20"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12 h-16">
          <Link to="/home" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
              <Command className="h-5 w-5 text-black" />
            </div>
            <span className="text-white text-lg font-bold tracking-tight hidden sm:inline" style={fInter}>
              Venture OS
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <a key={l.label} href={l.href} className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors rounded-lg">
                {l.label}
                {l.chevron && <ChevronDown className="h-3.5 w-3.5 opacity-50" />}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="px-5 py-2 text-sm font-semibold text-white/80 rounded-full border transition-all hover:text-white hover:border-white/30" style={{ ...fCabin, borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", backdropFilter: "blur(12px)" }}>
              Sign In
            </Link>
            <Link to="/login" className="px-5 py-2 text-sm font-semibold text-white rounded-full transition-all hover:shadow-lg hover:shadow-purple-500/25" style={{ ...fCabin, background: C.purple }}>
              Get Started
            </Link>
          </div>

          <button className="md:hidden h-10 w-10 flex items-center justify-center text-white" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </nav>

      {/* mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] bg-[#07060b]/98 flex flex-col">
          <div className="flex items-center justify-between px-5 py-4">
            <Link to="/home" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white"><Command className="h-5 w-5 text-black" /></div>
              <span className="text-white text-lg font-bold tracking-tight" style={fInter}>Venture OS</span>
            </Link>
            <button className="h-10 w-10 flex items-center justify-center text-white" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X className="h-6 w-6" /></button>
          </div>
          <div className="flex flex-col items-center justify-center flex-1 gap-6">
            {NAV_LINKS.map((l) => (
              <a key={l.label} href={l.href} className="text-2xl font-semibold text-white/70 hover:text-white transition-colors" onClick={() => setMobileOpen(false)}>{l.label}</a>
            ))}
            <div className="flex flex-col gap-3 mt-8 w-64">
              <Link to="/login" className="px-5 py-3 text-center text-sm font-semibold text-white rounded-full border" style={{ ...fCabin, borderColor: "rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)" }} onClick={() => setMobileOpen(false)}>Sign In</Link>
              <Link to="/login" className="px-5 py-3 text-center text-sm font-semibold text-white rounded-full" style={{ ...fCabin, background: C.purple }} onClick={() => setMobileOpen(false)}>Get Started</Link>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ HERO ════════════ */}
      <section id="hero" className="relative min-h-screen flex items-center justify-center px-5 sm:px-8 pt-20 pb-28">
        {/* video bg sits behind orbs via z-index */}
        <div className="absolute inset-0 z-0"><HeroBackground /></div>
        {/* extra vivid overlay on hero */}
        <div className="absolute inset-0 z-[1]">
          <div className="absolute rounded-full blur-[180px] opacity-50" style={{ width: 800, height: 800, background: "radial-gradient(circle, rgba(123,57,252,0.35) 0%, transparent 70%)", top: -200, left: "50%", transform: `translate(-50%, ${scrollY * 0.1}px)`, animation: "orbFloat1 10s ease-in-out infinite" }} />
          <div className="absolute rounded-full blur-[140px] opacity-30" style={{ width: 600, height: 600, background: "radial-gradient(circle, rgba(248,123,82,0.3) 0%, transparent 70%)", top: "20%", right: -100, animation: "orbFloat2 13s ease-in-out infinite" }} />
        </div>
        {/* dark overlay for readability */}
        <div className="absolute inset-0 bg-black/50 z-[2]" />

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          {/* badge */}
          <div className="inline-flex items-center gap-2.5 mb-8 px-4 py-2 rounded-full border animate-fade-in-up" style={{ borderColor: C.glassBorder, background: C.glassBg, backdropFilter: "blur(16px)", animationDelay: "0.1s", animationFillMode: "both" }}>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white tracking-wide uppercase" style={{ ...fCabin, background: C.orange }}>New</span>
            <span className="text-sm text-white/80 font-medium" style={fCabin}>The signal stack for frontier capital</span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[80px] font-extrabold leading-[1.05] tracking-tight text-white mb-6 animate-fade-in-up" style={{ ...fInter, animationDelay: "0.25s", animationFillMode: "both" }}>
            Your Networks.
            <br />
            <span>One Rapid </span>
            <span className="italic font-normal" style={fSerif}>Interface</span>
            <span>.</span>
          </h1>

          <p className="text-lg sm:text-xl text-white/55 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up" style={{ ...fManrope, animationDelay: "0.4s", animationFillMode: "both" }}>
            Every document, every decision, every pattern — unified and searchable.
            <br className="hidden sm:block" />
            Built for venture capital and investment teams.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: "0.55s", animationFillMode: "both" }}>
            <Link to="/login" className="group flex items-center gap-2 px-8 py-4 text-base font-bold text-white rounded-full transition-all shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/35 hover:-translate-y-0.5" style={{ ...fCabin, background: C.purple }}>
              Get Started
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link to="/login" className="flex items-center gap-2 px-8 py-4 text-base font-bold text-white/90 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/20 hover:-translate-y-0.5" style={fCabin}>
              Book a Demo
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════ WHY WE EXIST ════════════ */}
      <section ref={assignRef(0)} className="relative z-10 py-28 px-5 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className={`text-center mb-16 ${reveal(0)}`}>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: C.purple }}>Why we exist</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight" style={fInter}>
              The problem we solve
              <br /><span className="text-white/40 font-medium">and the future we&apos;re building</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {PROBLEMS.map((p, i) => {
              const Icon = p.icon;
              return (
                <div key={i} className={`group relative rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-8 min-h-[280px] flex flex-col transition-all duration-600 hover:-translate-y-1 hover:border-white/10 ${vis(0) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`} style={{ transitionDelay: `${i * 100}ms`, boxShadow: "0 24px 48px -12px rgba(0,0,0,0.5)" }}>
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-400" style={{ background: `linear-gradient(135deg, rgba(123,57,252,0.06) 0%, transparent 60%)` }} />
                  <div className="relative z-10">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-6 transition-colors duration-300" style={{ background: "rgba(123,57,252,0.12)" }}>
                      <Icon className="h-6 w-6" style={{ color: C.purple }} />
                    </div>
                    <h3 className="text-xl font-bold mb-3" style={fInter}>{p.title}</h3>
                    <p className="text-white/45 text-sm leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════════ FEATURES ════════════ */}
      <section id="features" ref={assignRef(1)} className="relative z-10 py-28 px-5 sm:px-8 border-t border-white/[0.04]">
        <div className="mx-auto max-w-6xl">
          <div className={`text-center mb-16 ${reveal(1)}`}>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: C.orange }}>Platform</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight" style={fInter}>
              Capabilities that transform
              <br /><span className="text-white/40 font-medium">how teams operate</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className={`group relative rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-6 min-h-[220px] flex flex-col transition-all duration-500 hover:-translate-y-1.5 hover:border-white/10 ${vis(1) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`} style={{ transitionDelay: `${Math.min(i * 80, 400)}ms`, boxShadow: "0 20px 40px -12px rgba(0,0,0,0.4)" }}>
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: "linear-gradient(135deg, rgba(248,123,82,0.06) 0%, transparent 60%)" }} />
                  <div className="relative z-10">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg mb-4 transition-colors" style={{ background: "rgba(248,123,82,0.12)" }}>
                      <Icon className="h-5 w-5" style={{ color: C.orange }} />
                    </div>
                    <h3 className="text-lg font-bold mb-2" style={fInter}>{f.title}</h3>
                    <p className="text-white/45 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════════ HOW IT WORKS ════════════ */}
      <section id="how" ref={assignRef(2)} className="relative z-10 py-28 px-5 sm:px-8 border-t border-white/[0.04]">
        <div className="mx-auto max-w-5xl">
          <div className={`text-center mb-16 ${reveal(2)}`}>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3 text-emerald-400">How it works</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight" style={fInter}>
              Three steps to
              <br /><span className="text-white/40 font-medium">intelligence at scale</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className={`relative text-center transition-all duration-600 ${vis(2) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`} style={{ transitionDelay: `${i * 120}ms` }}>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl mx-auto mb-5 border border-white/[0.08] bg-white/[0.04]">
                    <Icon className="h-7 w-7 text-emerald-400" />
                  </div>
                  <p className="text-xs font-bold tracking-[0.15em] uppercase text-white/30 mb-2" style={fCabin}>{s.num}</p>
                  <h3 className="text-xl font-bold mb-3" style={fInter}>{s.title}</h3>
                  <p className="text-white/45 text-sm leading-relaxed max-w-xs mx-auto">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════════ DIFFERENTIATORS ════════════ */}
      <section ref={assignRef(3)} className="relative z-10 py-28 px-5 sm:px-8 border-t border-white/[0.04]">
        <div className="mx-auto max-w-5xl">
          <div className={`text-center mb-16 ${reveal(3)}`}>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3 text-sky-400">What sets us apart</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight" style={fInter}>
              Built different.
              <br /><span className="text-white/40 font-medium">On purpose.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {DIFFERENTIATORS.map((d, i) => {
              const Icon = d.icon;
              return (
                <div key={i} className={`group rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-7 transition-all duration-500 hover:-translate-y-1 hover:border-white/10 ${vis(3) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`} style={{ transitionDelay: `${i * 100}ms` }}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg mb-4" style={{ background: "rgba(56,189,248,0.12)" }}>
                    <Icon className="h-5 w-5 text-sky-400" />
                  </div>
                  <h3 className="text-lg font-bold mb-2" style={fInter}>{d.title}</h3>
                  <p className="text-white/45 text-sm leading-relaxed">{d.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════════ ROADMAP ════════════ */}
      <section id="roadmap" ref={assignRef(4)} className="relative z-10 py-28 px-5 sm:px-8 border-t border-white/[0.04]">
        <div className="mx-auto max-w-4xl">
          <div className={`text-center mb-16 ${reveal(4)}`}>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: C.purple }}>Roadmap</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight" style={fInter}>
              Our vision for the future
              <br /><span className="text-white/40 font-medium">of fund operations</span>
            </h2>
          </div>
          <div className="space-y-6">
            {ROADMAP.map((r, i) => (
              <div key={i} className={`relative rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-8 transition-all duration-500 hover:border-white/10 ${vis(4) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`} style={{ transitionDelay: `${i * 100}ms`, boxShadow: "0 24px 48px -12px rgba(0,0,0,0.4)" }}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-white/50 font-bold text-sm">{i + 1}</div>
                    <div>
                      <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">{r.phase}</p>
                      <h3 className="text-xl md:text-2xl font-bold" style={fInter}>{r.title}</h3>
                    </div>
                  </div>
                  <RoadmapBadge status={r.status} />
                </div>
                <ul className="space-y-3">
                  {r.features.map((f, fi) => (
                    <li key={fi} className="flex items-start gap-3 text-white/50 text-sm">
                      <span className="mt-1 shrink-0" style={{ color: C.purple }}><Check className="h-4 w-4" /></span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ FINAL CTA ════════════ */}
      <section ref={assignRef(5)} className="relative z-10 py-28 px-5 sm:px-8">
        <div className={`mx-auto max-w-3xl rounded-3xl border border-white/[0.08] p-12 md:p-16 text-center transition-all duration-700 ${vis(5) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`} style={{ background: "linear-gradient(180deg, rgba(123,57,252,0.08) 0%, rgba(255,255,255,0.02) 100%)", boxShadow: "0 32px 64px -16px rgba(0,0,0,0.5), 0 0 0 1px rgba(123,57,252,0.08)" }}>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl mx-auto mb-6" style={{ background: "rgba(123,57,252,0.15)" }}>
            <Sparkles className="h-7 w-7" style={{ color: C.purple }} />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight" style={fInter}>Ready to get started?</h2>
          <p className="text-white/45 text-lg mb-8 max-w-xl mx-auto">
            Join forward-thinking investment teams who use Venture OS to make faster, data-driven decisions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/login" className="group flex items-center justify-center gap-2 px-8 py-4 text-base font-bold text-white rounded-full transition-all shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/35 hover:-translate-y-0.5" style={{ ...fCabin, background: C.purple }}>
              Start free trial
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link to="/login" className="flex items-center justify-center gap-2 px-8 py-4 text-base font-bold text-white/80 rounded-full border border-white/10 bg-white/5 transition-all hover:bg-white/10 hover:border-white/20 hover:-translate-y-0.5" style={fCabin}>
              Explore platform
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════ FOOTER ════════════ */}
      <footer className="relative z-10 border-t border-white/[0.04] py-12 px-5 sm:px-8">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white"><Command className="h-4 w-4 text-black" /></div>
            <span className="text-white/60 text-sm font-semibold" style={fInter}>Venture OS</span>
          </div>
          <p className="text-white/30 text-xs" style={fManrope}>&copy; {new Date().getFullYear()} Venture OS. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="text-white/30 text-xs hover:text-white/60 transition-colors">Privacy</a>
            <a href="#" className="text-white/30 text-xs hover:text-white/60 transition-colors">Terms</a>
            <a href="#" className="text-white/30 text-xs hover:text-white/60 transition-colors">Contact</a>
          </div>
        </div>
      </footer>

      {/* ── keyframes ── */}
      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.7s ease-out forwards; }

        @keyframes orbFloat1 {
          0%, 100% { transform: translate(-50%, 0px) scale(1); }
          50% { transform: translate(-50%, -40px) scale(1.05); }
        }
        @keyframes orbFloat2 {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(30px) scale(0.95); }
        }
        @keyframes orbFloat3 {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-25px) scale(1.03); }
        }
        @keyframes orbFloat4 {
          0%, 100% { transform: translate(0px, 0px); }
          33% { transform: translate(20px, -15px); }
          66% { transform: translate(-15px, 10px); }
        }
        @keyframes orbFloat5 {
          0%, 100% { transform: translate(0px, 0px); }
          50% { transform: translate(-20px, -20px); }
        }
      `}</style>
    </div>
  );
}

function RoadmapBadge({ status }: { status: string }) {
  const cfg: Record<string, { cls: string; icon: typeof Check }> = {
    Complete: { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-400/20", icon: Check },
    "In Progress": { cls: "bg-amber-500/15 text-amber-400 border-amber-400/20", icon: Loader2 },
    Planned: { cls: "bg-white/5 text-white/40 border-white/10", icon: Circle },
  };
  const { cls, icon: Icon } = cfg[status] || cfg.Planned;
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold ${cls}`}>
      {status === "In Progress" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {status}
    </span>
  );
}

import { useRef, Suspense } from "react";
import { Link } from "react-router-dom";
import {
  Command, ChevronDown, Menu, X, ArrowRight, Brain, Target, Shield,
  BarChart3, Zap, TrendingUp, Database, Rocket, Sparkles, Check,
  Loader2, Circle, MessageSquare, FolderSync, Network, FileText, Lock,
} from "lucide-react";
import { useState, useEffect } from "react";
import {
  motion, useScroll, useTransform, useSpring, useInView,
  AnimatePresence,
} from "framer-motion";

const Hero3DScene = /* lazy */ (() => {
  const Lazy = React.lazy(() => import("@/components/Hero3DScene"));
  return (props: Record<string, never>) => (
    <Suspense fallback={null}><Lazy {...props} /></Suspense>
  );
})();
import React from "react";

/* ─── tokens ─── */
const C = { purple: "#7b39fc", purpleHover: "#6a2ce0", dark: "#2b2344", darkHover: "#352b54", orange: "#f87b52", glassBorder: "rgba(164,132,215,0.5)", glassBg: "rgba(85,80,110,0.4)" } as const;
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
  { icon: Database, title: "The Problem", desc: "Teams drown in documents, lose context across deals, and make decisions without historical data. Information lives in silos — email threads, Drive folders, ClickUp tasks — never connecting." },
  { icon: Brain, title: "Our Solution", desc: "Venture OS is the signal stack that unifies your workflow. AI extracts intelligence from every document, tracks every decision, and surfaces patterns you'd never see manually." },
  { icon: Rocket, title: "The Impact", desc: "Faster decisions. Better outcomes. Teams that learn from every deal. We turn your workflow into a competitive advantage through intelligence, not just data." },
];

const FEATURES = [
  { icon: Brain, title: "AI Intelligence", desc: "Claude-powered document extraction and semantic search. Ask questions in natural language and get answers grounded in your own documents." },
  { icon: Target, title: "Decision Tracking", desc: "Log, track, and analyze every investment decision with outcome-based analytics. Understand what works and why." },
  { icon: Shield, title: "Team Sync", desc: "Real-time collaboration with role-based access control for MDs and investment teams. Everyone stays in sync." },
  { icon: BarChart3, title: "Advanced Analytics", desc: "Sector performance, partner metrics, decision velocity, and comprehensive portfolio intelligence dashboards." },
  { icon: Zap, title: "Auto-Sync", desc: "Seamless integration with Google Drive and your existing workflows. Only new or changed files trigger AI — no manual uploads." },
  { icon: TrendingUp, title: "Portfolio Intelligence", desc: "Cross-company learning and pattern detection across your entire portfolio. Learn from every deal." },
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
  { phase: "Phase 1", title: "Foundation", status: "Complete", features: ["Document Intelligence System with Claude AI", "AI-Powered Decision Tracking & Analytics", "Team Collaboration & Role-Based Onboarding", "Real-time Synchronization (ClickUp, Google Drive)", "Investment Decision Logger with Outcome Tracking"] },
  { phase: "Phase 2", title: "Intelligence Layer", status: "In Progress", features: ["Graph Relationships (Companies ↔ Partners ↔ Connections)", "Pattern Detection & Predictive Analytics", "Advanced Decision Engine with ML", "Portfolio Intelligence & Cross-Company Learning", "Automated Pipeline Scoring"] },
  { phase: "Phase 3", title: "Market Leadership", status: "Planned", features: ["Unsupervised Learning for Entity Matching", "Predictive Market Signals & Anomaly Detection", "Partner Performance Analytics & Allocation", "Automated Syndicate Intelligence", "Real-time Market Pulse Dashboard"] },
];

/* ─── reusable animated section wrapper ─── */
function RevealSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── glassmorphism card with hover tilt ─── */
function GlassCard({ children, className = "", accentColor = C.purple }: { children: React.ReactNode; className?: string; accentColor?: string }) {
  return (
    <motion.div
      className={`relative rounded-2xl border border-white/[0.07] backdrop-blur-md overflow-hidden ${className}`}
      style={{ background: "rgba(255,255,255,0.03)" }}
      whileHover={{ y: -6, borderColor: "rgba(255,255,255,0.12)", boxShadow: `0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px -10px ${accentColor}20` }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      {/* gradient hover glow */}
      <motion.div
        className="absolute inset-0 opacity-0 pointer-events-none"
        style={{ background: `linear-gradient(135deg, ${accentColor}12 0%, transparent 60%)` }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

/* ─── animated counter ─── */
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let frame: number;
    const start = performance.now();
    const dur = 1800;
    const step = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(ease * target));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [inView, target]);
  return <span ref={ref}>{val}{suffix}</span>;
}

/* ─── main ─── */
export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const heroParallax = useTransform(smoothProgress, [0, 0.3], [0, -120]);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative min-h-screen bg-[#07060b] text-white overflow-x-hidden" style={fManrope}>
      {/* ── morphing gradient background ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(123,57,252,0.15), transparent 60%)" }} />
        <div className="absolute inset-0 animate-morph-1" style={{ background: "radial-gradient(ellipse 60% 50% at 80% 50%, rgba(248,123,82,0.1), transparent 50%)" }} />
        <div className="absolute inset-0 animate-morph-2" style={{ background: "radial-gradient(ellipse 60% 50% at 20% 70%, rgba(59,130,246,0.08), transparent 50%)" }} />
      </div>

      {/* subtle grid */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.025]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)", backgroundSize: "72px 72px" }} />

      {/* scroll progress bar */}
      <motion.div className="fixed top-0 left-0 right-0 h-[2px] z-[60] origin-left" style={{ scaleX: smoothProgress, background: `linear-gradient(90deg, ${C.purple}, ${C.orange})` }} />

      {/* ═══ NAVBAR ═══ */}
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${navScrolled ? "bg-[#07060b]/85 backdrop-blur-xl border-b border-white/5" : "bg-transparent"}`}
        initial={{ y: -80 }} animate={{ y: 0 }} transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12 h-16">
          <Link to="/home" className="flex items-center gap-2.5">
            <motion.div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white" whileHover={{ rotate: 10, scale: 1.05 }} transition={{ type: "spring", stiffness: 400 }}>
              <Command className="h-5 w-5 text-black" />
            </motion.div>
            <span className="text-white text-lg font-bold tracking-tight hidden sm:inline" style={fInter}>Venture OS</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <motion.a key={l.label} href={l.href} className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white/55 hover:text-white transition-colors rounded-lg" whileHover={{ scale: 1.04 }}>
                {l.label}
                {l.chevron && <ChevronDown className="h-3.5 w-3.5 opacity-50" />}
              </motion.a>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="px-5 py-2 text-sm font-semibold text-white/80 rounded-full border transition-all hover:text-white hover:border-white/25" style={{ ...fCabin, borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", backdropFilter: "blur(12px)" }}>Sign In</Link>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link to="/login" className="px-5 py-2 text-sm font-semibold text-white rounded-full transition-all inline-block" style={{ ...fCabin, background: C.purple, boxShadow: "0 4px 20px -4px rgba(123,57,252,0.4)" }}>Get Started</Link>
            </motion.div>
          </div>
          <button className="md:hidden h-10 w-10 flex items-center justify-center text-white" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu className="h-6 w-6" /></button>
        </div>
      </motion.nav>

      {/* mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="fixed inset-0 z-[60] bg-[#07060b]/98 flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-center justify-between px-5 py-4">
              <Link to="/home" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white"><Command className="h-5 w-5 text-black" /></div>
                <span className="text-white text-lg font-bold tracking-tight" style={fInter}>Venture OS</span>
              </Link>
              <button className="h-10 w-10 flex items-center justify-center text-white" onClick={() => setMobileOpen(false)}><X className="h-6 w-6" /></button>
            </div>
            <div className="flex flex-col items-center justify-center flex-1 gap-6">
              {NAV_LINKS.map((l, i) => (
                <motion.a key={l.label} href={l.href} className="text-2xl font-semibold text-white/70 hover:text-white transition-colors" onClick={() => setMobileOpen(false)} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>{l.label}</motion.a>
              ))}
              <div className="flex flex-col gap-3 mt-8 w-64">
                <Link to="/login" className="px-5 py-3 text-center text-sm font-semibold text-white rounded-full border" style={{ ...fCabin, borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }} onClick={() => setMobileOpen(false)}>Sign In</Link>
                <Link to="/login" className="px-5 py-3 text-center text-sm font-semibold text-white rounded-full" style={{ ...fCabin, background: C.purple }} onClick={() => setMobileOpen(false)}>Get Started</Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ HERO ═══ */}
      <section id="hero" ref={heroRef} className="relative min-h-screen flex items-center justify-center px-5 sm:px-8 pt-20 pb-28 overflow-hidden">
        {/* 3D scene behind everything */}
        <Hero3DScene />
        {/* dark overlay */}
        <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/40 via-black/50 to-[#07060b]" />

        <motion.div className="relative z-10 text-center max-w-4xl mx-auto" style={{ y: heroParallax }}>
          {/* badge */}
          <motion.div className="inline-flex items-center gap-2.5 mb-8 px-4 py-2 rounded-full border" style={{ borderColor: C.glassBorder, background: C.glassBg, backdropFilter: "blur(16px)" }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.7 }}>
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full animate-ping opacity-75" style={{ background: C.orange }} /><span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: C.orange }} /></span>
            <span className="text-sm text-white/80 font-medium" style={fCabin}>The signal stack for frontier capital</span>
          </motion.div>

          {/* headline */}
          <motion.h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[80px] font-extrabold leading-[1.05] tracking-tight text-white mb-6" style={fInter} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
            Your Networks.
            <br />
            <span>One Rapid </span>
            <span className="italic font-normal" style={fSerif}>Interface</span>
            <span>.</span>
          </motion.h1>

          {/* subtext */}
          <motion.p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.7 }}>
            Every document, every decision, every pattern — unified and searchable.
            <br className="hidden sm:block" />
            Built for venture capital and investment teams.
          </motion.p>

          {/* CTAs */}
          <motion.div className="flex flex-col sm:flex-row items-center justify-center gap-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65, duration: 0.7 }}>
            <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link to="/login" className="group flex items-center gap-2 px-8 py-4 text-base font-bold text-white rounded-full transition-shadow" style={{ ...fCabin, background: C.purple, boxShadow: "0 8px 32px -4px rgba(123,57,252,0.35)" }}>
                Get Started
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link to="/login" className="flex items-center gap-2 px-8 py-4 text-base font-bold text-white/85 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm transition-colors hover:bg-white/10" style={fCabin}>
                Book a Demo
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* self-drawing line decoration */}
        <motion.svg className="absolute bottom-0 left-0 right-0 z-[2] w-full h-20" viewBox="0 0 1440 80" fill="none" preserveAspectRatio="none">
          <motion.path d="M0 60 C 360 20, 720 80, 1080 30 S 1440 60 1440 60 L 1440 80 L 0 80 Z" fill="#07060b" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, ease: "easeInOut", delay: 1 }} />
        </motion.svg>
      </section>

      {/* ═══ STATS BAR ═══ */}
      <RevealSection className="relative z-10 -mt-4 mb-12 px-5 sm:px-8">
        <div className="mx-auto max-w-5xl grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { val: 50, suffix: "+", label: "Documents processed" },
            { val: 98, suffix: "%", label: "RAG accuracy" },
            { val: 3, suffix: "x", label: "Faster decisions" },
            { val: 100, suffix: "%", label: "Data ownership" },
          ].map((s, i) => (
            <motion.div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-md p-6 text-center" whileHover={{ y: -3, borderColor: "rgba(255,255,255,0.1)" }}>
              <div className="text-3xl md:text-4xl font-extrabold mb-1" style={{ ...fInter, color: C.purple }}><Counter target={s.val} suffix={s.suffix} /></div>
              <div className="text-white/40 text-xs font-medium uppercase tracking-wider" style={fCabin}>{s.label}</div>
            </motion.div>
          ))}
        </div>
      </RevealSection>

      {/* ═══ WHY WE EXIST ═══ */}
      <section className="relative z-10 py-28 px-5 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <RevealSection className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: C.purple }}>Why we exist</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight" style={fInter}>The problem we solve<br /><span className="text-white/35 font-medium">and the future we&apos;re building</span></h2>
          </RevealSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {PROBLEMS.map((p, i) => {
              const Icon = p.icon;
              return (
                <RevealSection key={i} delay={i * 0.1}>
                  <GlassCard className="p-8 min-h-[280px] flex flex-col" accentColor={C.purple}>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-6 transition-colors" style={{ background: "rgba(123,57,252,0.12)" }}>
                      <Icon className="h-6 w-6" style={{ color: C.purple }} />
                    </div>
                    <h3 className="text-xl font-bold mb-3" style={fInter}>{p.title}</h3>
                    <p className="text-white/40 text-sm leading-relaxed">{p.desc}</p>
                  </GlassCard>
                </RevealSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="features" className="relative z-10 py-28 px-5 sm:px-8 border-t border-white/[0.04]">
        <div className="mx-auto max-w-6xl">
          <RevealSection className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: C.orange }}>Platform</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight" style={fInter}>Capabilities that transform<br /><span className="text-white/35 font-medium">how teams operate</span></h2>
          </RevealSection>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <RevealSection key={i} delay={Math.min(i * 0.08, 0.4)}>
                  <GlassCard className="p-6 min-h-[220px] flex flex-col" accentColor={C.orange}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg mb-4 transition-colors" style={{ background: "rgba(248,123,82,0.12)" }}>
                      <Icon className="h-5 w-5" style={{ color: C.orange }} />
                    </div>
                    <h3 className="text-lg font-bold mb-2" style={fInter}>{f.title}</h3>
                    <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
                  </GlassCard>
                </RevealSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="how" className="relative z-10 py-28 px-5 sm:px-8 border-t border-white/[0.04]">
        <div className="mx-auto max-w-5xl">
          <RevealSection className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3 text-emerald-400">How it works</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight" style={fInter}>Three steps to<br /><span className="text-white/35 font-medium">intelligence at scale</span></h2>
          </RevealSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* connecting line */}
            <div className="hidden md:block absolute top-8 left-[16.5%] right-[16.5%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            {HOW_STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <RevealSection key={i} delay={i * 0.15} className="text-center relative">
                  <motion.div className="flex h-16 w-16 items-center justify-center rounded-2xl mx-auto mb-5 border border-white/[0.08] bg-white/[0.04]" whileHover={{ scale: 1.1, borderColor: "rgba(52,211,153,0.3)" }} transition={{ type: "spring", stiffness: 300 }}>
                    <Icon className="h-7 w-7 text-emerald-400" />
                  </motion.div>
                  <p className="text-xs font-bold tracking-[0.15em] uppercase text-white/25 mb-2" style={fCabin}>{s.num}</p>
                  <h3 className="text-xl font-bold mb-3" style={fInter}>{s.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed max-w-xs mx-auto">{s.desc}</p>
                </RevealSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ DIFFERENTIATORS ═══ */}
      <section className="relative z-10 py-28 px-5 sm:px-8 border-t border-white/[0.04]">
        <div className="mx-auto max-w-5xl">
          <RevealSection className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3 text-sky-400">What sets us apart</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight" style={fInter}>Built different.<br /><span className="text-white/35 font-medium">On purpose.</span></h2>
          </RevealSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {DIFFERENTIATORS.map((d, i) => {
              const Icon = d.icon;
              return (
                <RevealSection key={i} delay={i * 0.1}>
                  <GlassCard className="p-7" accentColor="#38bdf8">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg mb-4" style={{ background: "rgba(56,189,248,0.12)" }}>
                      <Icon className="h-5 w-5 text-sky-400" />
                    </div>
                    <h3 className="text-lg font-bold mb-2" style={fInter}>{d.title}</h3>
                    <p className="text-white/40 text-sm leading-relaxed">{d.desc}</p>
                  </GlassCard>
                </RevealSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ ROADMAP ═══ */}
      <section id="roadmap" className="relative z-10 py-28 px-5 sm:px-8 border-t border-white/[0.04]">
        <div className="mx-auto max-w-4xl">
          <RevealSection className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: C.purple }}>Roadmap</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight" style={fInter}>Our vision for the future<br /><span className="text-white/35 font-medium">of fund operations</span></h2>
          </RevealSection>
          <div className="space-y-6">
            {ROADMAP.map((r, i) => (
              <RevealSection key={i} delay={i * 0.1}>
                <GlassCard className="p-8" accentColor={C.purple}>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-white/50 font-bold text-sm">{i + 1}</div>
                      <div>
                        <p className="text-white/35 text-xs font-semibold uppercase tracking-wider">{r.phase}</p>
                        <h3 className="text-xl md:text-2xl font-bold" style={fInter}>{r.title}</h3>
                      </div>
                    </div>
                    <RoadmapBadge status={r.status} />
                  </div>
                  <ul className="space-y-3">
                    {r.features.map((f, fi) => (
                      <li key={fi} className="flex items-start gap-3 text-white/45 text-sm">
                        <span className="mt-1 shrink-0" style={{ color: C.purple }}><Check className="h-4 w-4" /></span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </GlassCard>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="relative z-10 py-28 px-5 sm:px-8">
        <RevealSection>
          <div className="mx-auto max-w-3xl rounded-3xl border border-white/[0.08] p-12 md:p-16 text-center" style={{ background: "linear-gradient(180deg, rgba(123,57,252,0.1) 0%, rgba(255,255,255,0.02) 100%)", boxShadow: "0 32px 64px -16px rgba(0,0,0,0.5), 0 0 80px -20px rgba(123,57,252,0.15)" }}>
            <motion.div className="flex h-14 w-14 items-center justify-center rounded-2xl mx-auto mb-6" style={{ background: "rgba(123,57,252,0.15)" }} animate={{ rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}>
              <Sparkles className="h-7 w-7" style={{ color: C.purple }} />
            </motion.div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight" style={fInter}>Ready to get started?</h2>
            <p className="text-white/40 text-lg mb-8 max-w-xl mx-auto">Join forward-thinking investment teams who use Venture OS to make faster, data-driven decisions.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
                <Link to="/login" className="group flex items-center justify-center gap-2 px-8 py-4 text-base font-bold text-white rounded-full" style={{ ...fCabin, background: C.purple, boxShadow: "0 8px 32px -4px rgba(123,57,252,0.35)" }}>
                  Start free trial
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
                <Link to="/login" className="flex items-center justify-center gap-2 px-8 py-4 text-base font-bold text-white/75 rounded-full border border-white/10 bg-white/5 transition-colors hover:bg-white/10" style={fCabin}>Explore platform</Link>
              </motion.div>
            </div>
          </div>
        </RevealSection>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="relative z-10 border-t border-white/[0.04] py-12 px-5 sm:px-8">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white"><Command className="h-4 w-4 text-black" /></div>
            <span className="text-white/50 text-sm font-semibold" style={fInter}>Venture OS</span>
          </div>
          <p className="text-white/25 text-xs">&copy; {new Date().getFullYear()} Venture OS. All rights reserved.</p>
          <div className="flex gap-6">
            {["Privacy", "Terms", "Contact"].map((l) => (
              <motion.a key={l} href="#" className="text-white/25 text-xs hover:text-white/50 transition-colors" whileHover={{ y: -1 }}>{l}</motion.a>
            ))}
          </div>
        </div>
      </footer>

      {/* ── animations ── */}
      <style>{`
        @keyframes morph1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(5%, -3%) scale(1.05); }
          66% { transform: translate(-3%, 4%) scale(0.95); }
        }
        @keyframes morph2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-4%, 5%) scale(0.97); }
          66% { transform: translate(6%, -2%) scale(1.04); }
        }
        .animate-morph-1 { animation: morph1 20s ease-in-out infinite; }
        .animate-morph-2 { animation: morph2 25s ease-in-out infinite; }
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

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
const HeroSpline = (() => {
  const Lazy = React.lazy(() => import("@/components/HeroSpline"));
  return () => (
    <Suspense fallback={null}><Lazy /></Suspense>
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
  { label: "Use Cases", href: "#usecases" },
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

/* ─── dynamic terminal lines ─── */
const TERMINAL_SEQUENCES = [
  [
    { text: "> initializing fund_alpha_iii...", delay: 25 },
    { text: "> loading portfolio [186 companies]", delay: 20 },
    { text: "> syncing market_data...", delay: 18 },
    { text: "  pipeline: 342 active deals scored", delay: 12, dim: true },
    { text: "  alerts: 3 portfolio events detected", delay: 12, dim: true },
    { text: "  lp_report: Q4 draft ready for review", delay: 12, dim: true },
    { text: "> ai_engine: analyzing sector correlations", delay: 22 },
    { text: "  ✓ 12 new patterns identified", delay: 18, color: "#34d399" },
  ],
  [
    { text: "> ask: \"What does TechCorp do?\"", delay: 22 },
    { text: "  searching 2,847 document chunks...", delay: 14, dim: true },
    { text: "  matched: pitch_deck_v3.pdf (94% relevance)", delay: 12, dim: true },
    { text: "  matched: due_diligence_memo.docx (89%)", delay: 12, dim: true },
    { text: "> answer: TechCorp is a B2B SaaS platform...", delay: 20, color: "#a78bfa" },
    { text: "  sources: 3 documents, 7 chunks cited", delay: 12, dim: true },
    { text: "  ✓ grounded — 0 unsupported claims", delay: 18, color: "#34d399" },
  ],
  [
    { text: "> decision.log --company Acme --action invest", delay: 22 },
    { text: "  sector: fintech | stage: series_a", delay: 12, dim: true },
    { text: "  conviction: high | partner: @sarah", delay: 12, dim: true },
    { text: "> reflexion: analyzing decision patterns...", delay: 22 },
    { text: "  fintech pass rate: 72% (above avg)", delay: 12, dim: true },
    { text: "  avg time-to-decision: 14 days", delay: 12, dim: true },
    { text: "  ✓ decision logged to knowledge graph", delay: 18, color: "#34d399" },
    { text: "  ✓ company card updated", delay: 18, color: "#34d399" },
  ],
];

/* ─── use case cards ─── */
const USE_CASES = [
  {
    category: "Due Diligence",
    color: "#7b39fc",
    questions: [
      "\"What does this company do and what's their business model?\"",
      "\"Summarize the key risks from the due diligence memo\"",
      "\"What are their unit economics and burn rate?\"",
    ],
    benefit: "Get answers in seconds from hundreds of pages — every claim sourced and verifiable.",
  },
  {
    category: "Portfolio Intelligence",
    color: "#f87b52",
    questions: [
      "\"Which portfolio companies overlap in the healthcare sector?\"",
      "\"Show me all connections between Fund X and our pipeline\"",
      "\"Compare the ARR trajectory of Company A vs Company B\"",
    ],
    benefit: "See patterns across your entire portfolio that no spreadsheet can surface.",
  },
  {
    category: "Decision Analytics",
    color: "#3b82f6",
    questions: [
      "\"What's our pass rate on fintech deals this quarter?\"",
      "\"Which partner has the fastest time-to-decision?\"",
      "\"Show conversion by stage and sector for 2025\"",
    ],
    benefit: "Measure how your fund actually decides — and improve systematically.",
  },
  {
    category: "Team Collaboration",
    color: "#14b8a6",
    questions: [
      "\"What did we discuss about Acme in last week's IC?\"",
      "\"Who on the team has reviewed the latest pitch deck?\"",
      "\"Sync all new files from our shared Drive folder\"",
    ],
    benefit: "Everyone on the same page. No lost context, no repeated work.",
  },
];

/* ─── key metrics for dashboard section ─── */
const KEY_METRICS = [
  { label: "TOTAL VALUE LOCKED", value: "$4.2B", delta: "+12.4%", positive: true, sparkline: [20, 25, 22, 30, 28, 35, 32, 40, 38, 45, 50, 55] },
  { label: "IRR (NET)", value: "38.2%", delta: "+2.1%", positive: true, sparkline: [30, 32, 28, 35, 33, 36, 34, 38, 37, 39, 38, 40] },
  { label: "DPI", value: "2.8x", delta: "+0.3x", positive: true, sparkline: [15, 18, 16, 20, 19, 22, 21, 24, 23, 26, 27, 28] },
  { label: "ACTIVE DEALS", value: "24", delta: "-3", positive: false, sparkline: [30, 28, 32, 27, 29, 26, 28, 25, 27, 24, 26, 24] },
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

/* ─── dynamic terminal with typewriter ─── */
function TerminalAnimation() {
  const [seqIdx, setSeqIdx] = useState(0);
  const [lines, setLines] = useState<Array<{ text: string; dim?: boolean; color?: string }>>([]);
  const [currentLine, setCurrentLine] = useState("");
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, margin: "-100px" });

  useEffect(() => {
    if (!inView) return;
    const seq = TERMINAL_SEQUENCES[seqIdx];
    if (lineIdx >= seq.length) {
      const timer = setTimeout(() => {
        setSeqIdx((s) => (s + 1) % TERMINAL_SEQUENCES.length);
        setLines([]);
        setLineIdx(0);
        setCharIdx(0);
        setCurrentLine("");
      }, 1500);
      return () => clearTimeout(timer);
    }
    const line = seq[lineIdx];
    if (charIdx < line.text.length) {
      const speed = line.delay || 40;
      const jitter = Math.random() * speed * 0.3;
      const timer = setTimeout(() => {
        setCurrentLine(line.text.slice(0, charIdx + 1));
        setCharIdx((c) => c + 1);
      }, speed + jitter);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      setLines((prev) => [...prev, { text: line.text, dim: line.dim, color: line.color }]);
      setCurrentLine("");
      setLineIdx((l) => l + 1);
      setCharIdx(0);
    }, 80);
    return () => clearTimeout(timer);
  }, [inView, seqIdx, lineIdx, charIdx]);

  return (
    <div ref={ref} className="rounded-2xl border border-white/[0.08] overflow-hidden" style={{ background: "rgba(10,10,18,0.9)", boxShadow: "0 25px 60px -12px rgba(0,0,0,0.7), 0 0 40px -10px rgba(123,57,252,0.1)" }}>
      {/* title bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-white/65 text-xs font-mono ml-2">venture-os://terminal</span>
      </div>
      {/* content */}
      <div className="p-5 min-h-[280px] font-mono text-sm leading-relaxed">
        {lines.map((l, i) => (
          <motion.div key={`${seqIdx}-${i}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }} className={l.dim ? "text-white/65" : ""} style={l.color ? { color: l.color } : { color: "rgba(255,255,255,0.85)" }}>
            {l.text}
          </motion.div>
        ))}
        {currentLine && (
          <div className="text-white/70">
            {currentLine}
            <motion.span className="inline-block w-2 h-4 ml-0.5 -mb-0.5" style={{ background: C.orange }} animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.7 }} />
          </div>
        )}
        {!currentLine && lineIdx < TERMINAL_SEQUENCES[seqIdx].length && (
          <motion.span className="inline-block w-2 h-4" style={{ background: C.orange }} animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.7 }} />
        )}
      </div>
    </div>
  );
}

/* ─── sparkline SVG ─── */
function Sparkline({ data, color, positive }: { data: number[]; color?: string; positive: boolean }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 120;
  const h = 32;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  const c = color || (positive ? "#34d399" : "#f472b6");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="mt-2">
      <defs>
        <linearGradient id={`sg-${c.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.3" />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points}>
        <animate attributeName="stroke-dashoffset" from="300" to="0" dur="1.5s" fill="freeze" />
        <animate attributeName="stroke-dasharray" from="300" to="300" dur="0.01s" fill="freeze" />
      </polyline>
      <polygon fill={`url(#sg-${c.replace("#", "")})`} points={`0,${h} ${points} ${w},${h}`} opacity="0.5" />
    </svg>
  );
}

/* ─── text shimmer effect ─── */
function ShimmerText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`relative inline-block ${className}`}>
      <span className="relative z-10">{children}</span>
      <motion.span
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent z-20 pointer-events-none"
        style={{ WebkitBackgroundClip: "text" }}
        animate={{ x: ["-100%", "200%"] }}
        transition={{ repeat: Infinity, duration: 3, ease: "linear", repeatDelay: 2 }}
      />
    </span>
  );
}

/* ─── pulse ring animation ─── */
function PulseRings({ color = C.purple }: { color?: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border"
          style={{ borderColor: color, width: 60 + i * 30, height: 60 + i * 30 }}
          animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ repeat: Infinity, duration: 3, delay: i * 0.8, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

/* ─── Get a Demo modal form ─── */
function GetDemoModal({ onClose }: { onClose: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 800);
  };

  return (
      <motion.div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          className="relative w-full max-w-lg rounded-2xl border border-white/[0.08] overflow-hidden flex flex-col max-h-[90vh]"
          style={{ background: "rgba(7,6,11,0.98)", boxShadow: "0 32px 64px -16px rgba(0,0,0,0.6), 0 0 60px -20px rgba(123,57,252,0.2)" }}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-5 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
                  <Command className="h-4 w-4 text-black" />
                </div>
                <span className="text-lg font-bold text-white" style={fInter}>Get a Demo</span>
              </div>
              <button className="p-1.5 text-white/60 hover:text-white rounded-lg transition-colors" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-white/70 text-xs mb-0">Connect with our team to explore how Venture OS can support your investment workflow.</p>
          </div>

            {submitted ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-5 pb-5 pt-2 text-center flex-shrink-0">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl mx-auto mb-3" style={{ background: "rgba(52,211,153,0.15)" }}>
                  <Check className="h-7 w-7 text-emerald-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1" style={fInter}>Thank you!</h3>
                <p className="text-white/60 text-xs">We&apos;ll be in touch shortly to schedule your demo.</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                <div className="px-5 overflow-y-auto flex-1 min-h-0 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-white/70 mb-0.5" style={fCabin}>First name</label>
                      <input type="text" required className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white placeholder-white/40 text-sm focus:outline-none focus:border-purple-500/50" placeholder="John" style={fManrope} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/70 mb-0.5" style={fCabin}>Last name</label>
                      <input type="text" required className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white placeholder-white/40 text-sm focus:outline-none focus:border-purple-500/50" placeholder="Doe" style={fManrope} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-0.5" style={fCabin}>Work email</label>
                    <input type="email" required className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white placeholder-white/40 text-sm focus:outline-none focus:border-purple-500/50" placeholder="john@fund.com" style={fManrope} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-0.5" style={fCabin}>LinkedIn profile</label>
                    <input type="url" className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white placeholder-white/40 text-sm focus:outline-none focus:border-purple-500/50" placeholder="https://linkedin.com/in/yourprofile" style={fManrope} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-0.5" style={fCabin}>Company</label>
                    <input type="text" required className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white placeholder-white/40 text-sm focus:outline-none focus:border-purple-500/50" placeholder="Acme Ventures" style={fManrope} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-white/70 mb-0.5" style={fCabin}>Company size</label>
                      <select required className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white text-sm focus:outline-none focus:border-purple-500/50 appearance-none cursor-pointer" style={fManrope}>
                        <option value="" className="bg-[#0c0a14] text-white/40">Select size</option>
                        <option value="1-10" className="bg-[#0c0a14]">1-10</option>
                        <option value="11-50" className="bg-[#0c0a14]">11-50</option>
                        <option value="51-200" className="bg-[#0c0a14]">51-200</option>
                        <option value="201-500" className="bg-[#0c0a14]">201-500</option>
                        <option value="500+" className="bg-[#0c0a14]">500+</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/70 mb-0.5" style={fCabin}>Country</label>
                      <select required className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white text-sm focus:outline-none focus:border-purple-500/50 appearance-none cursor-pointer" style={fManrope}>
                        <option value="" className="bg-[#0c0a14] text-white/40">Select country</option>
                        <option value="US" className="bg-[#0c0a14]">United States</option>
                        <option value="UK" className="bg-[#0c0a14]">United Kingdom</option>
                        <option value="CA" className="bg-[#0c0a14]">Canada</option>
                        <option value="DE" className="bg-[#0c0a14]">Germany</option>
                        <option value="FR" className="bg-[#0c0a14]">France</option>
                        <option value="SG" className="bg-[#0c0a14]">Singapore</option>
                        <option value="OTHER" className="bg-[#0c0a14]">Other</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-0.5" style={fCabin}>How did you hear about us?</label>
                    <select className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white text-sm focus:outline-none focus:border-purple-500/50 appearance-none cursor-pointer" style={fManrope}>
                      <option value="" className="bg-[#0c0a14] text-white/40">Select option</option>
                      <option value="search" className="bg-[#0c0a14]">Search</option>
                      <option value="referral" className="bg-[#0c0a14]">Referral</option>
                      <option value="linkedin" className="bg-[#0c0a14]">LinkedIn</option>
                      <option value="event" className="bg-[#0c0a14]">Event or conference</option>
                      <option value="other" className="bg-[#0c0a14]">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-0.5" style={fCabin}>What motivated you to explore Venture OS?</label>
                    <textarea rows={2} className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white placeholder-white/40 text-sm focus:outline-none focus:border-purple-500/50 resize-none" placeholder="e.g. We want a system that captures decisions and makes them searchable." style={fManrope} />
                  </div>
                </div>
                <div className="p-5 flex-shrink-0 border-t border-white/[0.06]">
                  <motion.button type="submit" disabled={submitting} className="w-full py-3 rounded-full font-bold text-white text-sm transition-all disabled:opacity-70 flex items-center justify-center gap-2" style={{ ...fCabin, background: C.purple, boxShadow: "0 4px 20px -4px rgba(123,57,252,0.4)" }} whileHover={{ scale: submitting ? 1 : 1.02 }} whileTap={{ scale: submitting ? 1 : 0.98 }}>
                    {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Sending...</> : "Get a Demo"}
                  </motion.button>
                </div>
              </form>
            )}
        </motion.div>
    </motion.div>
  );
}

/* ─── main ─── */
export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
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
          <Link to="/home" className="flex items-center gap-2.5 -ml-4 lg:-ml-8">
            <motion.div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white" whileHover={{ rotate: 10, scale: 1.05 }} transition={{ type: "spring", stiffness: 400 }}>
              <Command className="h-5 w-5 text-black" />
            </motion.div>
            <span className="text-white text-lg font-bold tracking-tight hidden sm:inline" style={fInter}>Venture OS</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <motion.a key={l.label} href={l.href} className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors rounded-lg" whileHover={{ scale: 1.04 }}>
                {l.label}
                {l.chevron && <ChevronDown className="h-3.5 w-3.5 opacity-50" />}
              </motion.a>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="px-5 py-2 text-sm font-semibold text-white/80 rounded-full border transition-all hover:text-white hover:border-white/25" style={{ ...fCabin, borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", backdropFilter: "blur(12px)" }}>Sign In</Link>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <button onClick={() => setDemoModalOpen(true)} className="px-5 py-2 text-sm font-semibold text-white rounded-full transition-all" style={{ ...fCabin, background: C.purple, boxShadow: "0 4px 20px -4px rgba(123,57,252,0.4)" }}>Get a Demo</button>
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
                <button className="px-5 py-3 text-center text-sm font-semibold text-white rounded-full" style={{ ...fCabin, background: C.purple }} onClick={() => { setMobileOpen(false); setDemoModalOpen(true); }}>Get a Demo</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Get a Demo modal */}
      <AnimatePresence>
        {demoModalOpen && <GetDemoModal onClose={() => setDemoModalOpen(false)} />}
      </AnimatePresence>

      {/* ═══ HERO ═══ */}
      <section id="hero" ref={heroRef} className="relative min-h-screen flex items-center px-5 sm:px-8 lg:px-12 pt-20 pb-28 overflow-hidden">
        {/* subtle bg gradient */}
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#07060b] via-[#0c0a14] to-[#07060b]" />

        {/* ── Spline 3D — behind text layer; fades in when loaded (HeroSpline controls its own opacity) ── */}
        <div
          className="absolute z-[1] top-0 right-0 w-[70%] h-full hidden lg:block"
          style={{ transform: "translate(5%, -32%)" }}
        >
          <HeroSpline />
        </div>

        {/* ── Text content — on top of Spline ── */}
        <motion.div className="relative z-10 mx-auto max-w-7xl w-full" style={{ y: heroParallax }}>
          <div className="max-w-2xl text-left">
            {/* badge */}
            <motion.div className="inline-flex items-center gap-2.5 mb-8 px-4 py-2 rounded-full border" style={{ borderColor: C.glassBorder, background: C.glassBg, backdropFilter: "blur(16px)" }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.5 }}>
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full animate-ping opacity-75" style={{ background: C.orange }} /><span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: C.orange }} /></span>
              <span className="text-sm text-white/80 font-medium" style={fCabin}>The signal stack for frontier capital</span>
            </motion.div>

            {/* headline */}
            <motion.h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight text-white mb-6" style={fInter} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
              <motion.span
                className="inline-block"
                animate={{ opacity: [0.85, 1, 0.85] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              >Your Networks.</motion.span>
              <br />
              <span>One Rapid </span>
              <motion.span
                className="italic font-normal inline-block bg-clip-text text-transparent animate-gradient-sweep"
                style={{ ...fSerif, backgroundImage: `linear-gradient(135deg, ${C.purple}, ${C.orange}, ${C.purple})`, backgroundSize: "200% 200%" }}
              >Interface</motion.span>
              <span className="ml-1">.</span>
            </motion.h1>

            {/* subtext */}
            <motion.p className="text-lg sm:text-xl text-white/65 max-w-xl mb-10 leading-relaxed" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.7 }}>
              Every document, every decision, every pattern — unified and searchable. Built for venture capital and investment teams.
            </motion.p>

            {/* CTAs */}
            <motion.div className="flex flex-col sm:flex-row items-start gap-4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}>
              <motion.div whileHover={{ scale: 1.06, y: -3 }} whileTap={{ scale: 0.96 }}>
                <Link to="/login" className="group relative flex items-center gap-2 px-8 py-4 text-base font-bold text-white rounded-full transition-shadow overflow-hidden" style={{ ...fCabin, background: C.purple, boxShadow: "0 8px 32px -4px rgba(123,57,252,0.35)" }}>
                  <motion.span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent" animate={{ x: ["-100%", "200%"] }} transition={{ repeat: Infinity, duration: 2.5, ease: "linear", repeatDelay: 3 }} />
                  <span className="relative z-10">Get Started</span>
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1 relative z-10" />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
                <button onClick={() => setDemoModalOpen(true)} className="flex items-center gap-2 px-8 py-4 text-base font-bold text-white/85 rounded-full border animate-border-glow bg-white/5 backdrop-blur-sm transition-colors hover:bg-white/10" style={fCabin}>
                  Get a Demo
                </button>
              </motion.div>
            </motion.div>
          </div>
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
            { val: 3000, suffix: "+", label: "Documents processed", c: C.purple },
            { val: 98, suffix: "%", label: "RAG accuracy", c: "#34d399" },
            { val: 3, suffix: "x", label: "Faster decisions", c: C.orange },
            { val: 100, suffix: "%", label: "Data ownership", c: "#3b82f6" },
          ].map((s, i) => (
            <motion.div
              key={i}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-md p-6 text-center"
              whileHover={{ y: -4, borderColor: "rgba(255,255,255,0.1)", boxShadow: `0 20px 40px -12px rgba(0,0,0,0.4), 0 0 30px -8px ${s.c}15` }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, type: "spring", stiffness: 200 }}
            >
              <div className="text-3xl md:text-4xl font-extrabold mb-1" style={{ ...fInter, color: s.c }}><Counter target={s.val} suffix={s.suffix} /></div>
              <div className="text-white/60 text-xs font-medium uppercase tracking-wider" style={fCabin}>{s.label}</div>
            </motion.div>
          ))}
        </div>
      </RevealSection>

      {/* ═══ COMMAND CENTER (dynamic terminal) ═══ */}
      <section className="relative z-10 py-28 px-5 sm:px-8 border-t border-white/[0.04]">
        <div className="mx-auto max-w-6xl">
          <RevealSection className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: C.orange }}>System Interface</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight" style={fInter}>
              <ShimmerText>Command Center</ShimmerText>
            </h2>
            <p className="text-white/70 text-base mt-4 max-w-lg mx-auto">Watch your fund intelligence platform work in real time — syncing, searching, deciding.</p>
          </RevealSection>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <RevealSection delay={0.1}>
              <TerminalAnimation />
            </RevealSection>
            <RevealSection delay={0.2}>
              <div className="space-y-6">
                {[
                  { icon: Zap, title: "Real-time sync", desc: "Portfolio data, market signals, and documents stream in continuously.", color: "#f87b52" },
                  { icon: Brain, title: "AI-powered analysis", desc: "Every query searches thousands of chunks and returns cited, grounded answers.", color: "#7b39fc" },
                  { icon: Target, title: "Instant decisions", desc: "Log decisions, track outcomes, and build institutional memory automatically.", color: "#34d399" },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <motion.div key={i} className="flex gap-4 items-start p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]" whileHover={{ x: 6, borderColor: "rgba(255,255,255,0.1)" }} transition={{ type: "spring", stiffness: 300 }}>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: `${item.color}18` }}>
                        <Icon className="h-5 w-5" style={{ color: item.color }} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold mb-1" style={fInter}>{item.title}</h4>
                        <p className="text-white/70 text-xs leading-relaxed">{item.desc}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ═══ KEY METRICS DASHBOARD ═══ */}
      <section className="relative z-10 py-28 px-5 sm:px-8 border-t border-white/[0.04]">
        <div className="mx-auto max-w-6xl">
          <RevealSection className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3 text-emerald-400">Fund Performance</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight" style={fInter}>Key Metrics</h2>
            <p className="text-white/70 text-base mt-4 max-w-lg mx-auto">Track your fund's vital signs in one dashboard — updated in real time.</p>
          </RevealSection>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {KEY_METRICS.map((m, i) => (
              <RevealSection key={i} delay={i * 0.08}>
                <motion.div className="rounded-2xl border border-white/[0.06] p-5" style={{ background: "rgba(10,10,18,0.8)" }} whileHover={{ y: -4, borderColor: "rgba(255,255,255,0.1)", boxShadow: "0 20px 40px -12px rgba(0,0,0,0.5)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60 mb-3 font-mono" style={fCabin}>{m.label}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl md:text-3xl font-extrabold font-mono" style={fInter}>{m.value}</span>
                    <span className={`text-xs font-bold font-mono ${m.positive ? "text-emerald-400" : "text-pink-400"}`}>{m.delta}</span>
                  </div>
                  <Sparkline data={m.sparkline} positive={m.positive} />
                </motion.div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ USE CASES ═══ */}
      <section id="usecases" className="relative z-10 py-28 px-5 sm:px-8 border-t border-white/[0.04]">
        <div className="mx-auto max-w-6xl">
          <RevealSection className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: C.purple }}>Use Cases</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight" style={fInter}>
              Ask anything about<br /><span className="text-white/70 font-medium">your portfolio</span>
            </h2>
            <p className="text-white/70 text-base mt-4 max-w-xl mx-auto">See the real questions investment teams ask every day — and how Venture OS answers them from your own documents.</p>
          </RevealSection>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {USE_CASES.map((uc, i) => (
              <RevealSection key={i} delay={i * 0.1}>
                <GlassCard className="p-7 min-h-[280px] flex flex-col" accentColor={uc.color}>
                  <div className="flex items-center gap-3 mb-5">
                    <motion.div
                      className="h-3 w-3 rounded-full"
                      style={{ background: uc.color }}
                      animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                      transition={{ repeat: Infinity, duration: 2, delay: i * 0.3 }}
                    />
                    <span className="text-xs font-bold uppercase tracking-[0.15em]" style={{ ...fCabin, color: uc.color }}>{uc.category}</span>
                  </div>
                  <div className="space-y-3 mb-5 flex-1">
                    {uc.questions.map((q, qi) => (
                      <motion.div
                        key={qi}
                        className="flex items-start gap-2.5 p-3 rounded-xl border border-white/[0.05] bg-white/[0.02]"
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: qi * 0.1 + 0.3 }}
                      >
                        <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: uc.color }} />
                        <span className="text-white/70 text-xs leading-relaxed font-mono">{q}</span>
                      </motion.div>
                    ))}
                  </div>
                  <div className="flex items-start gap-2 pt-4 border-t border-white/[0.05]">
                    <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: uc.color }} />
                    <p className="text-white/60 text-xs leading-relaxed">{uc.benefit}</p>
                  </div>
                </GlassCard>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ WHY WE EXIST ═══ */}
      <section className="relative z-10 py-28 px-5 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <RevealSection className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: C.purple }}>Why we exist</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight" style={fInter}>The problem we solve<br /><span className="text-white/70 font-medium">and the future we&apos;re building</span></h2>
          </RevealSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {PROBLEMS.map((p, i) => {
              const Icon = p.icon;
              const colors = ["#f472b6", C.purple, "#34d399"];
              const c = colors[i];
              return (
                <RevealSection key={i} delay={i * 0.1}>
                  <GlassCard className="group p-8 min-h-[280px] flex flex-col" accentColor={c}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="relative flex h-12 w-12 items-center justify-center rounded-xl shrink-0 transition-colors" style={{ background: `${c}18` }}>
                        <Icon className="h-6 w-6 transition-transform group-hover:scale-110" style={{ color: c }} />
                      </div>
                      <span className="text-5xl font-black text-white/[0.04]" style={fInter}>0{i + 1}</span>
                    </div>
                    <h3 className="text-xl font-bold mb-3" style={fInter}>{p.title}</h3>
                    <p className="text-white/60 text-sm leading-relaxed flex-1">{p.desc}</p>
                    <motion.div className="h-0.5 mt-5 rounded-full origin-left" style={{ background: `linear-gradient(90deg, ${c}, transparent)` }} initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: i * 0.15 }} />
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
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight" style={fInter}>Capabilities that transform<br /><span className="text-white/70 font-medium">how teams operate</span></h2>
          </RevealSection>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              const colors = [C.orange, C.purple, "#3b82f6", "#34d399", "#f472b6", "#eab308"];
              const c = colors[i % colors.length];
              return (
                <RevealSection key={i} delay={Math.min(i * 0.08, 0.4)}>
                  <GlassCard className="group p-6 min-h-[220px] flex flex-col" accentColor={c}>
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-xl mb-5 transition-colors" style={{ background: `${c}15` }}>
                      <Icon className="h-5 w-5 transition-transform group-hover:scale-110" style={{ color: c }} />
                      <motion.div className="absolute inset-0 rounded-xl border" style={{ borderColor: c }} initial={{ opacity: 0, scale: 1 }} whileHover={{ opacity: [0, 0.4, 0], scale: [1, 1.6, 1.6] }} transition={{ duration: 1 }} />
                    </div>
                    <h3 className="text-lg font-bold mb-2" style={fInter}>{f.title}</h3>
                    <p className="text-white/60 text-sm leading-relaxed flex-1">{f.desc}</p>
                    <motion.div className="h-0.5 mt-4 rounded-full origin-left" style={{ background: `linear-gradient(90deg, ${c}, transparent)` }} initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: i * 0.1 }} />
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
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight" style={fInter}>Three steps to<br /><span className="text-white/70 font-medium">intelligence at scale</span></h2>
          </RevealSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* connecting line */}
            <div className="hidden md:block absolute top-8 left-[16.5%] right-[16.5%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            {HOW_STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <RevealSection key={i} delay={i * 0.15} className="text-center relative">
                  <motion.div className="relative flex h-16 w-16 items-center justify-center rounded-2xl mx-auto mb-5 border border-white/[0.08] bg-white/[0.04]" whileHover={{ scale: 1.1, borderColor: "rgba(52,211,153,0.3)" }} transition={{ type: "spring", stiffness: 300 }}>
                    <PulseRings color="rgba(52,211,153,0.2)" />
                    <Icon className="h-7 w-7 text-emerald-400 relative z-10" />
                  </motion.div>
                  <p className="text-xs font-bold tracking-[0.15em] uppercase text-white/60 mb-2" style={fCabin}>{s.num}</p>
                  <h3 className="text-xl font-bold mb-3" style={fInter}>{s.title}</h3>
                  <p className="text-white/60 text-sm leading-relaxed max-w-xs mx-auto">{s.desc}</p>
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
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight" style={fInter}>Built different.<br /><span className="text-white/70 font-medium">On purpose.</span></h2>
          </RevealSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {DIFFERENTIATORS.map((d, i) => {
              const Icon = d.icon;
              const colors = ["#38bdf8", "#a78bfa", "#f472b6"];
              const c = colors[i];
              return (
                <RevealSection key={i} delay={i * 0.1}>
                  <GlassCard className="group p-7" accentColor={c}>
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-xl mb-5" style={{ background: `${c}15` }}>
                      <Icon className="h-5 w-5 transition-transform group-hover:scale-110 group-hover:rotate-6" style={{ color: c }} />
                    </div>
                    <h3 className="text-lg font-bold mb-2" style={fInter}>{d.title}</h3>
                    <p className="text-white/60 text-sm leading-relaxed">{d.desc}</p>
                    <motion.div className="h-0.5 mt-4 rounded-full origin-left" style={{ background: `linear-gradient(90deg, ${c}, transparent)` }} initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.1 + 0.2 }} />
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
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight" style={fInter}>Our vision for the future<br /><span className="text-white/70 font-medium">of fund operations</span></h2>
          </RevealSection>
          <div className="space-y-6">
            {ROADMAP.map((r, i) => (
              <RevealSection key={i} delay={i * 0.1}>
                <GlassCard className="p-8" accentColor={C.purple}>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-white/65 font-bold text-sm">{i + 1}</div>
                      <div>
                        <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">{r.phase}</p>
                        <h3 className="text-xl md:text-2xl font-bold" style={fInter}>{r.title}</h3>
                      </div>
                    </div>
                    <RoadmapBadge status={r.status} />
                  </div>
                  <ul className="space-y-3">
                    {r.features.map((f, fi) => (
                      <li key={fi} className="flex items-start gap-3 text-white/60 text-sm">
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
          <div className="relative mx-auto max-w-3xl rounded-3xl border border-white/[0.08] p-12 md:p-16 text-center overflow-hidden" style={{ background: "linear-gradient(180deg, rgba(123,57,252,0.1) 0%, rgba(255,255,255,0.02) 100%)", boxShadow: "0 32px 64px -16px rgba(0,0,0,0.5), 0 0 80px -20px rgba(123,57,252,0.15)" }}>
            {/* animated gradient bg */}
            <motion.div className="absolute inset-0 opacity-30 pointer-events-none" animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }} transition={{ repeat: Infinity, duration: 8, ease: "linear" }} style={{ backgroundImage: `linear-gradient(135deg, ${C.purple}22, ${C.orange}22, ${C.purple}22)`, backgroundSize: "200% 200%" }} />
            <div className="relative z-10">
              <motion.div className="relative flex h-16 w-16 items-center justify-center rounded-2xl mx-auto mb-6" style={{ background: "rgba(123,57,252,0.15)" }} animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}>
                <PulseRings />
                <Sparkles className="h-7 w-7 relative z-10" style={{ color: C.purple }} />
              </motion.div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight" style={fInter}>
                <ShimmerText>Ready to get started?</ShimmerText>
              </h2>
              <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto">Join forward-thinking investment teams who use Venture OS to make faster, data-driven decisions.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <motion.div whileHover={{ scale: 1.06, y: -3 }} whileTap={{ scale: 0.96 }}>
                  <Link to="/login" className="group relative flex items-center justify-center gap-2 px-8 py-4 text-base font-bold text-white rounded-full overflow-hidden" style={{ ...fCabin, background: C.purple, boxShadow: "0 8px 32px -4px rgba(123,57,252,0.35)" }}>
                    <motion.span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent" animate={{ x: ["-100%", "200%"] }} transition={{ repeat: Infinity, duration: 2.5, ease: "linear", repeatDelay: 3 }} />
                    <span className="relative z-10">Start free trial</span>
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1 relative z-10" />
                  </Link>
                </motion.div>
                <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Link to="/login" className="flex items-center justify-center gap-2 px-8 py-4 text-base font-bold text-white/90 rounded-full border border-white/10 bg-white/5 transition-colors hover:bg-white/10" style={fCabin}>Explore platform</Link>
                </motion.div>
              </div>
            </div>
          </div>
        </RevealSection>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="relative z-10 border-t border-white/[0.04] py-12 px-5 sm:px-8">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white"><Command className="h-4 w-4 text-black" /></div>
            <span className="text-white/65 text-sm font-semibold" style={fInter}>Venture OS</span>
          </div>
          <p className="text-white/60 text-xs">&copy; {new Date().getFullYear()} Venture OS. All rights reserved.</p>
          <div className="flex gap-6">
            {["Privacy", "Terms", "Contact"].map((l) => (
              <motion.a key={l} href="#" className="text-white/60 text-xs hover:text-white/65 transition-colors" whileHover={{ y: -1 }}>{l}</motion.a>
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
        @keyframes gradientSweep {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient-sweep {
          background-size: 200% 200%;
          animation: gradientSweep 4s ease infinite;
        }
        @keyframes floatY {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-float { animation: floatY 3s ease-in-out infinite; }
        @keyframes borderGlow {
          0%, 100% { border-color: rgba(123,57,252,0.2); box-shadow: 0 0 20px -5px rgba(123,57,252,0.1); }
          50% { border-color: rgba(123,57,252,0.5); box-shadow: 0 0 30px -5px rgba(123,57,252,0.2); }
        }
        .animate-border-glow { animation: borderGlow 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function RoadmapBadge({ status }: { status: string }) {
  const cfg: Record<string, { cls: string; icon: typeof Check }> = {
    Complete: { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-400/20", icon: Check },
    "In Progress": { cls: "bg-amber-500/15 text-amber-400 border-amber-400/20", icon: Loader2 },
    Planned: { cls: "bg-white/5 text-white/60 border-white/10", icon: Circle },
  };
  const { cls, icon: Icon } = cfg[status] || cfg.Planned;
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold ${cls}`}>
      {status === "In Progress" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {status}
    </span>
  );
}

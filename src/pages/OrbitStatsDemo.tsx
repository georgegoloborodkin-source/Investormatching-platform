import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Zap,
  Target,
  TrendingUp,
  Brain,
  Shield,
  BarChart3,
  Sparkles,
  Rocket,
  Database,
  Check,
  Circle,
  Loader2,
  LogIn,
} from "lucide-react";

export default function OrbitStatsDemo() {
  const [scrollY, setScrollY] = useState(0);
  const [visible, setVisible] = useState<Set<number>>(new Set());
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = sectionRefs.current.indexOf(entry.target as HTMLElement);
          if (index >= 0 && entry.isIntersecting) {
            setVisible((v) => new Set([...v, index]));
          }
        });
      },
      { rootMargin: "-80px 0px -80px 0px", threshold: 0.1 }
    );
    sectionRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const roadmap = [
    {
      phase: "Phase 1",
      title: "Foundation",
      status: "Complete",
      features: [
        "Document Intelligence System with Claude AI",
        "AI-Powered Decision Tracking & Analytics",
        "Team Collaboration & Role-Based Onboarding",
        "Real-time Synchronization (ClickUp, Google Drive)",
        "Investment Decision Logger with Outcome Tracking",
      ],
    },
    {
      phase: "Phase 2",
      title: "Intelligence Layer",
      status: "In Progress",
      features: [
        "Graph Relationships (Companies ↔ Syndicates ↔ Investors)",
        "Pattern Detection & Predictive Analytics",
        "Advanced Decision Engine with ML",
        "Portfolio Intelligence & Cross-Company Learning",
        "Automated Deal Flow Scoring",
      ],
    },
    {
      phase: "Phase 3",
      title: "Market Leadership",
      status: "Planned",
      features: [
        "Unsupervised Learning for Entity Matching",
        "Predictive Market Signals & Anomaly Detection",
        "Partner Performance Analytics & Allocation",
        "Automated Syndicate Intelligence",
        "Real-time Market Pulse Dashboard",
      ],
    },
  ];

  const features = [
    {
      icon: Brain,
      title: "AI Intelligence",
      description:
        "Claude-powered document extraction and semantic search across your entire deal flow. Ask questions in natural language and get comprehensive answers.",
    },
    {
      icon: Target,
      title: "Decision Tracking",
      description:
        "Log, track, and analyze every investment decision with outcome-based analytics. Understand what works and why.",
    },
    {
      icon: Shield,
      title: "Team Sync",
      description:
        "Real-time collaboration with role-based access control for MDs and investment teams. Everyone stays in sync.",
    },
    {
      icon: BarChart3,
      title: "Advanced Analytics",
      description:
        "Sector performance, partner metrics, decision velocity insights, and comprehensive portfolio intelligence.",
    },
    {
      icon: Zap,
      title: "Auto-Sync",
      description:
        "Seamless integration with ClickUp, Google Drive, and your existing workflows. No manual uploads needed.",
    },
    {
      icon: TrendingUp,
      title: "Portfolio Intelligence",
      description:
        "Cross-company learning and pattern detection across your entire portfolio. Learn from every decision.",
    },
  ];

  const whyWeExist = [
    {
      icon: Database,
      title: "The Problem",
      description:
        "VC teams drown in documents, lose context across deals, and make decisions without historical data. Information lives in silos—email threads, Google Drive folders, ClickUp tasks—never connecting.",
    },
    {
      icon: Brain,
      title: "Our Solution",
      description:
        "VentureOS is the signal stack that unifies your deal flow. AI extracts intelligence from every document, tracks every decision, and surfaces patterns you'd never see manually.",
    },
    {
      icon: Rocket,
      title: "The Impact",
      description:
        "Faster decisions. Better outcomes. Teams that learn from every deal. We turn your deal flow into a competitive advantage through intelligence, not just data.",
    },
  ];

  const isVisible = (i: number) => visible.has(i);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-900 relative overflow-hidden font-['Plus_Jakarta_Sans',_Inter,_system-ui,_sans-serif]">
      {/* Background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 100% 60% at 50% -10%, rgba(245, 158, 11, 0.12), transparent 50%),
            radial-gradient(ellipse 80% 50% at 80% 50%, rgba(59, 130, 246, 0.06), transparent 45%),
            radial-gradient(ellipse 80% 50% at 20% 80%, rgba(245, 158, 11, 0.05), transparent 45%)
          `,
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Sticky header with Log in */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/orbit-stats" className="flex items-center gap-2 font-semibold text-slate-900 tracking-tight">
            <span className="text-xl">Venture</span>
            <span className="text-xl text-amber-400">OS</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-5 py-2.5 text-sm font-semibold text-amber-400 transition-all hover:border-amber-400/50 hover:bg-amber-500/20 hover:text-amber-300"
            >
              <LogIn className="h-4 w-4" />
              Log in
            </Link>
            <Link to="/login">
              <Button className="rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold px-5 py-2.5 h-auto shadow-[0_2px_16px_-4px_rgba(245,158,11,0.4)] hover:shadow-[0_4px_24px_-4px_rgba(245,158,11,0.5)] transition-all">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 flex min-h-screen items-center justify-center px-4 pt-24 pb-32">
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            transform: `translateY(${scrollY * 0.15}px)`,
          }}
        >
          <div className="h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-[120px] animate-pulse" />
          <div className="absolute h-72 w-72 rounded-full bg-blue-500/5 blur-[80px] -top-20 -right-20" />
          <div className="absolute h-72 w-72 rounded-full bg-amber-500/5 blur-[80px] bottom-0 -left-20" />
        </div>

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <div
            className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/5 px-4 py-2 text-amber-400/90 text-sm font-medium mb-8 animate-fade-in-up"
            style={{ animationDelay: "0.1s", animationFillMode: "both" }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 animate-ping opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
            The emerging market signal stack for frontier capital
          </div>

          <h1
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-slate-900 mb-3 animate-fade-in-up"
            style={{ animationDelay: "0.2s", animationFillMode: "both" }}
          >
            Venture
            <span className="block text-amber-400 mt-1 drop-shadow-[0_0_30px_rgba(245,158,11,0.3)]">
              OS
            </span>
          </h1>

          <p
            className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up"
            style={{ animationDelay: "0.35s", animationFillMode: "both" }}
          >
            We transform your deal flow into intelligence. Every document, every decision, every
            pattern—unified and searchable.
          </p>

          <div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-up"
            style={{ animationDelay: "0.5s", animationFillMode: "both" }}
          >
            <Link to="/login">
              <Button className="rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold px-8 py-6 text-base h-auto shadow-[0_4px_24px_-4px_rgba(245,158,11,0.4)] hover:shadow-[0_8px_32px_-4px_rgba(245,158,11,0.5)] hover:-translate-y-0.5 transition-all duration-200">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/cis">
              <Button
                variant="outline"
                className="rounded-xl border border-slate-600 bg-slate-800/40 text-slate-200 hover:bg-slate-700/50 hover:border-slate-500 hover:text-slate-900 px-8 py-6 text-base h-auto font-semibold transition-all duration-200"
              >
                View Platform
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Why We Exist */}
      <section
        ref={(el) => {
          sectionRefs.current[0] = el;
        }}
        className="relative z-10 py-24 px-4 md:px-6"
      >
        <div className="mx-auto max-w-6xl">
          <div
            className={`text-center mb-16 transition-all duration-700 ${
              isVisible(0) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <p className="text-amber-400 text-sm font-semibold uppercase tracking-widest mb-3">
              Why we exist
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
              The problem we solve
              <br />
              <span className="text-slate-400 font-medium">and the future we're building</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {whyWeExist.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={index}
                  className={`group relative rounded-2xl border border-slate-700/60 bg-slate-900/40 backdrop-blur-sm p-8 min-h-[300px] flex flex-col transition-all duration-500 ${
                    isVisible(0) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                  }`}
                  style={{
                    transitionDelay: `${index * 80}ms`,
                    boxShadow: "0 1px 0 0 rgba(255,255,255,0.04), 0 24px 48px -12px rgba(0,0,0,0.4)",
                  }}
                >
                  <div className="absolute inset-0 rounded-2xl bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative z-10">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 mb-6 group-hover:bg-amber-500/20 transition-colors duration-300">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* What We've Built */}
      <section
        ref={(el) => {
          sectionRefs.current[1] = el;
        }}
        className="relative z-10 py-24 px-4 md:px-6 border-t border-slate-800/80"
      >
        <div className="mx-auto max-w-6xl">
          <div
            className={`text-center mb-16 transition-all duration-700 ${
              isVisible(1) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <p className="text-amber-400 text-sm font-semibold uppercase tracking-widest mb-3">
              What we've built
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
              Platform capabilities that transform
              <br />
              <span className="text-slate-400 font-medium">how VC teams operate</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className={`group relative rounded-2xl border border-slate-700/60 bg-slate-900/40 backdrop-blur-sm p-6 min-h-[240px] flex flex-col transition-all duration-500 hover:-translate-y-1 hover:border-slate-600/80 ${
                    isVisible(1) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                  }`}
                  style={{
                    transitionDelay: `${Math.min(index * 60, 300)}ms`,
                    boxShadow: "0 1px 0 0 rgba(255,255,255,0.04), 0 20px 40px -12px rgba(0,0,0,0.35)",
                  }}
                >
                  <div className="absolute inset-0 rounded-2xl bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative z-10">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 mb-4 group-hover:bg-amber-500/20 transition-colors duration-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section
        ref={(el) => {
          sectionRefs.current[2] = el;
        }}
        className="relative z-10 py-24 px-4 md:px-6 border-t border-slate-800/80"
      >
        <div className="mx-auto max-w-4xl">
          <div
            className={`text-center mb-16 transition-all duration-700 ${
              isVisible(2) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <p className="text-amber-400 text-sm font-semibold uppercase tracking-widest mb-3">
              Roadmap
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
              Our vision for the future
              <br />
              <span className="text-slate-400 font-medium">of VC operations</span>
            </h2>
          </div>

          <div className="space-y-6">
            {roadmap.map((phase, index) => (
              <div
                key={index}
                className={`relative rounded-2xl border border-slate-700/60 bg-slate-900/40 backdrop-blur-sm p-8 transition-all duration-500 ${
                  isVisible(2) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                } hover:border-slate-600/80`}
                style={{
                  transitionDelay: `${index * 100}ms`,
                  boxShadow: "0 1px 0 0 rgba(255,255,255,0.04), 0 24px 48px -12px rgba(0,0,0,0.4)",
                }}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-400 font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                        {phase.phase}
                      </p>
                      <h3 className="text-xl md:text-2xl font-bold text-slate-900">{phase.title}</h3>
                    </div>
                  </div>
                  <RoadmapBadge status={phase.status} />
                </div>
                <ul className="space-y-3">
                  {phase.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start gap-3 text-slate-300 text-sm">
                      <span className="mt-1.5 shrink-0 text-amber-400">
                        <Check className="h-4 w-4" />
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        ref={(el) => {
          sectionRefs.current[3] = el;
        }}
        className="relative z-10 py-24 px-4 md:px-6"
      >
        <div
          className={`mx-auto max-w-3xl rounded-3xl border border-slate-700/60 bg-gradient-to-b from-slate-800/60 to-slate-900/60 backdrop-blur-sm p-12 md:p-16 text-center transition-all duration-700 ${
            isVisible(3) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
          style={{
            boxShadow:
              "0 1px 0 0 rgba(255,255,255,0.06), 0 32px 64px -16px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,158,11,0.05)",
          }}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 mx-auto mb-6">
            <Sparkles className="h-7 w-7" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight">
            Ready to transform your deal flow?
          </h2>
          <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
            Join forward-thinking VC teams who are already using VentureOS to make faster,
            data-driven decisions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/login">
              <Button className="rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold px-8 py-6 text-base h-auto shadow-[0_4px_24px_-4px_rgba(245,158,11,0.4)] hover:shadow-[0_8px_32px_-4px_rgba(245,158,11,0.5)] hover:-translate-y-0.5 transition-all duration-200">
                Start free trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/cis">
              <Button
                variant="outline"
                className="rounded-xl border border-slate-600 bg-transparent text-slate-200 hover:bg-slate-700/50 hover:border-slate-500 hover:text-slate-900 px-8 py-6 text-base h-auto font-semibold transition-all duration-200"
              >
                Explore platform
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

function RoadmapBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { className: string; icon: typeof Check | typeof Loader2 | typeof Circle }
  > = {
    Complete: {
      className: "bg-emerald-500/15 text-emerald-400 border-emerald-400/20",
      icon: Check,
    },
    "In Progress": {
      className: "bg-amber-500/15 text-amber-400 border-amber-400/20",
      icon: Loader2,
    },
    Planned: {
      className: "bg-slate-500/15 text-slate-400 border-slate-500/30",
      icon: Circle,
    },
  };
  const { className, icon: Icon } = config[status] || config.Planned;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold ${className}`}
    >
      {status === "In Progress" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
      {status}
    </span>
  );
}

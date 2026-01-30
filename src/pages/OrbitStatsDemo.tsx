import { OrbitStatsSection } from "@/components/OrbitStatsSection";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Target, TrendingUp, Brain, Shield, BarChart3, Sparkles } from "lucide-react";

export default function OrbitStatsDemo() {
  const [scrollY, setScrollY] = useState(0);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const parallaxOffset1 = scrollY * 0.1;
  const parallaxOffset2 = scrollY * 0.15;
  const parallaxOffset3 = scrollY * 0.2;

  const roadmap = [
    {
      phase: "Phase 1",
      title: "Foundation",
      status: "Complete",
      features: [
        "Document Intelligence System",
        "AI-Powered Decision Tracking",
        "Team Collaboration & Onboarding",
        "Real-time Synchronization",
      ],
    },
    {
      phase: "Phase 2",
      title: "Intelligence Layer",
      status: "In Progress",
      features: [
        "Graph Relationships (Companies ↔ Syndicates ↔ Investors)",
        "Pattern Detection & Predictive Analytics",
        "Advanced Decision Engine",
        "Portfolio Intelligence & Cross-Company Learning",
      ],
    },
    {
      phase: "Phase 3",
      title: "Market Leadership",
      status: "Planned",
      features: [
        "Unsupervised Learning for Entity Matching",
        "Automated Deal Flow Intelligence",
        "Partner Performance Analytics",
        "Predictive Market Signals",
      ],
    },
  ];

  const features = [
    {
      icon: Brain,
      title: "AI Intelligence",
      description: "Claude-powered document extraction and semantic search across your entire deal flow.",
    },
    {
      icon: Target,
      title: "Decision Tracking",
      description: "Log, track, and analyze every investment decision with outcome-based analytics.",
    },
    {
      icon: Shield,
      title: "Team Sync",
      description: "Real-time collaboration with role-based access control for MDs and investment teams.",
    },
    {
      icon: BarChart3,
      title: "Advanced Analytics",
      description: "Sector performance, partner metrics, and decision velocity insights.",
    },
    {
      icon: Zap,
      title: "Auto-Sync",
      description: "Seamless integration with ClickUp, Google Drive, and your existing workflows.",
    },
    {
      icon: TrendingUp,
      title: "Portfolio Intelligence",
      description: "Cross-company learning and pattern detection across your entire portfolio.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white relative overflow-hidden">
      {/* Parallax Background Layers */}
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          transform: `translateY(${parallaxOffset1}px)`,
          backgroundImage: `
            linear-gradient(rgba(255, 237, 0, 0.2) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 237, 0, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }}
      />

      {/* Floating Particles */}
      <div
        className="fixed inset-0 overflow-hidden pointer-events-none"
        style={{ transform: `translateY(${parallaxOffset2}px)` }}
      >
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-[#FFED00] opacity-10 blur-sm"
            style={{
              width: `${Math.random() * 4 + 1}px`,
              height: `${Math.random() * 4 + 1}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float${i % 3} ${5 + Math.random() * 5}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Glowing Orbs */}
      <div
        className="fixed inset-0 overflow-hidden pointer-events-none"
        style={{ transform: `translateY(${parallaxOffset3}px)` }}
      >
        <div className="absolute top-20 left-10 h-64 w-64 rounded-full bg-[#FFED00] opacity-5 blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 h-96 w-96 rounded-full bg-[#FFED00] opacity-5 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFED00] opacity-5 blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
      </div>

      {/* Hero Section */}
      <section className="relative z-10 flex min-h-[90vh] items-center justify-center overflow-hidden border-b-2 border-white">
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#FFED00]/5 via-transparent to-[#FFED00]/5"
          style={{
            animation: "gradientShift 8s ease-in-out infinite",
          }}
        />
        <div className="relative z-10 text-center px-4">
          <h1 className="mb-4 font-mono text-6xl font-black text-white md:text-8xl lg:text-9xl tracking-tight">
            ORBIT
          </h1>
          <p className="font-mono text-xl text-[#FFED00] md:text-2xl lg:text-3xl mb-8 tracking-wider">
            VENTURES
          </p>
          <p className="max-w-3xl mx-auto text-lg md:text-xl text-white/80 mb-12 font-mono">
            The{" "}
            <span className="text-[#FFED00] font-bold">EMERGING</span> market signal stack for{" "}
            <span className="text-[#FFED00] font-bold">FRONTIER</span> capital.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/login">
              <Button className="bg-[#FFED00] text-black hover:bg-[#FFED00]/80 font-bold border-2 border-[#FFED00] px-8 py-6 text-lg transition-all hover:shadow-[0_0_30px_rgba(255,237,0,0.5)]">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/cis">
              <Button variant="outline" className="border-2 border-white text-white hover:bg-white/10 hover:border-[#FFED00] hover:text-[#FFED00] px-8 py-6 text-lg transition-all">
                View Platform
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative z-10 border-b-2 border-white">
        <div className="mx-auto max-w-7xl">
          <OrbitStatsSection />
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 border-b-2 border-white py-20 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black font-mono text-white mb-4 tracking-tight">
              PLATFORM CAPABILITIES
            </h2>
            <p className="text-white/70 uppercase text-xs tracking-wider font-semibold">
              Built for venture capital teams who demand precision
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="group border-2 border-white p-6 min-h-[200px] flex flex-col transition-all duration-300 hover:border-[#FFED00] hover:shadow-[0_0_30px_rgba(255,237,0,0.3)]"
                  style={{
                    transform: `translateY(${scrollY * (0.01 + index * 0.005)}px)`,
                  }}
                >
                  <div className="absolute inset-0 bg-[#FFED00] opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-10" />
                  <div className="relative z-10">
                    <Icon className="h-8 w-8 text-[#FFED00] mb-4" />
                    <h3 className="text-xl font-black font-mono text-white mb-2 uppercase tracking-tight">
                      {feature.title}
                    </h3>
                    <p className="text-white/70 text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Roadmap Section */}
      <section className="relative z-10 border-b-2 border-white py-20 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black font-mono text-white mb-4 tracking-tight">
              ROADMAP
            </h2>
            <p className="text-white/70 uppercase text-xs tracking-wider font-semibold">
              Our vision for the future of VC operations
            </p>
          </div>
          <div className="space-y-8">
            {roadmap.map((phase, index) => (
              <div
                key={index}
                className="border-2 border-white p-8 transition-all duration-300 hover:border-[#FFED00] hover:shadow-[0_0_30px_rgba(255,237,0,0.2)]"
                style={{
                  transform: `translateY(${scrollY * (0.02 + index * 0.01)}px)`,
                }}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs uppercase tracking-widest text-white/50 font-semibold">
                        {phase.phase}
                      </span>
                      <Badge status={phase.status} />
                    </div>
                    <h3 className="text-2xl md:text-3xl font-black font-mono text-white uppercase tracking-tight">
                      {phase.title}
                    </h3>
                  </div>
                </div>
                <ul className="space-y-3">
                  {phase.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start gap-3">
                      <span className="text-[#FFED00] mt-1">▸</span>
                      <span className="text-white/80 font-mono text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20 px-6">
        <div className="mx-auto max-w-4xl text-center border-2 border-white p-12">
          <Sparkles className="h-12 w-12 text-[#FFED00] mx-auto mb-6" />
          <h2 className="text-4xl md:text-5xl font-black font-mono text-white mb-6 tracking-tight">
            READY TO TRANSFORM YOUR DEAL FLOW?
          </h2>
          <p className="text-white/70 mb-8 text-lg font-mono">
            Join forward-thinking VC teams who are already using Orbit to make faster, data-driven decisions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/login">
              <Button className="bg-[#FFED00] text-black hover:bg-[#FFED00]/80 font-bold border-2 border-[#FFED00] px-8 py-6 text-lg transition-all hover:shadow-[0_0_30px_rgba(255,237,0,0.5)]">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/cis">
              <Button variant="outline" className="border-2 border-white text-white hover:bg-white/10 hover:border-[#FFED00] hover:text-[#FFED00] px-8 py-6 text-lg transition-all">
                Explore Platform
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes gradientShift {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        @keyframes float0 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, -20px) scale(1.2); }
        }
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, 30px) scale(0.8); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(15px, 25px) scale(1.1); }
        }
      `}</style>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const colors = {
    Complete: "bg-[#FFED00] text-black",
    "In Progress": "bg-white text-black",
    Planned: "bg-transparent border-2 border-white text-white",
  };

  return (
    <span
      className={`px-3 py-1 text-xs font-bold uppercase tracking-wider ${
        colors[status as keyof typeof colors] || colors.Planned
      }`}
    >
      {status}
    </span>
  );
}

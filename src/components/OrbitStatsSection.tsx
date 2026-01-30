import { useEffect, useRef, useState } from "react";

const stats = [
  {
    label: "INVESTED",
    value: "$75M",
    title: "An emerging-market thesis that scales with discipline.",
  },
  {
    label: "RAISED",
    value: "$728M",
    title: "Institutional momentum, engineered for velocity.",
  },
  {
    label: "DEPLOYED",
    value: "$312M",
    title: "Capital allocation across frontier categories.",
  },
  {
    label: "EXITS",
    value: "18",
    title: "Selective liquidity in a volatile cycle.",
  },
  {
    label: "PIPELINE",
    value: "2,914",
    title: "Signal density at scale, filtered in real time.",
  },
  {
    label: "AI ALERTS",
    value: "47",
    title: "High-conviction anomalies flagged this week.",
  },
];

export function OrbitStatsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (sectionRef.current) {
        const rect = sectionRef.current.getBoundingClientRect();
        const scroll = window.scrollY;
        setScrollY(scroll);
        
        // Trigger visibility when section enters viewport
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          setIsVisible(true);
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Parallax offset calculations
  const parallaxOffset1 = scrollY * 0.1;
  const parallaxOffset2 = scrollY * 0.15;
  const parallaxOffset3 = scrollY * 0.2;

  return (
    <section
      ref={sectionRef}
      className="orbit-void relative min-h-screen overflow-hidden border-2 border-white bg-[#050505] text-white"
    >
      {/* Animated Grid Background (Parallax Layer 1) */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          transform: `translateY(${parallaxOffset1}px)`,
          backgroundImage: `
            linear-gradient(rgba(255, 237, 0, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 237, 0, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
          animation: "gridPulse 4s ease-in-out infinite",
        }}
      />

      {/* Floating Particles (Parallax Layer 2) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ transform: `translateY(${parallaxOffset2}px)` }}
      >
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-[#FFED00] opacity-20 blur-sm"
            style={{
              width: `${Math.random() * 4 + 2}px`,
              height: `${Math.random() * 4 + 2}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float${i % 3} ${5 + Math.random() * 5}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Glowing Orbs (Parallax Layer 3) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ transform: `translateY(${parallaxOffset3}px)` }}
      >
        <div className="absolute top-20 left-10 h-64 w-64 rounded-full bg-[#FFED00] opacity-5 blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 h-96 w-96 rounded-full bg-[#FFED00] opacity-5 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFED00] opacity-5 blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
      </div>

      {/* Main Content */}
      <div className="relative z-10 px-6 py-8 md:px-10 md:py-12">
        {/* Header with Parallax */}
        <div
          className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
          style={{
            transform: `translateY(${scrollY * 0.05}px)`,
            opacity: isVisible ? 1 : 0,
            transition: "opacity 0.8s ease-out",
          }}
        >
          <div className="space-y-2">
            <p className="orbit-stat-label animate-fade-in">MARKET INTELLIGENCE</p>
            <h2 className="orbit-stat-heading max-w-xl animate-slide-up">
              An{" "}
              <span className="orbit-accent-text relative inline-block">
                <span className="absolute inset-0 bg-[#FFED00] opacity-20 blur-xl" />
                EMERGING
              </span>{" "}
              market signal stack for{" "}
              <span className="orbit-accent-text relative inline-block">
                <span className="absolute inset-0 bg-[#FFED00] opacity-20 blur-xl" />
                FRONTIER
              </span>{" "}
              capital.
            </h2>
          </div>
          <button className="orbit-accent-button group relative overflow-hidden">
            <span className="absolute inset-0 bg-[#FFED00] opacity-0 transition-opacity duration-300 group-hover:opacity-20" />
            <span className="orbit-accent-text relative z-10">ALL NEWS</span>
            <span className="orbit-accent-text relative z-10 transition-transform duration-150 group-hover:translate-x-1">
              →
            </span>
          </button>
        </div>

        {/* Stats Grid with Stagger Animation */}
        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="group relative flex min-h-[170px] flex-col justify-between border-2 border-white px-6 py-5 transition-all duration-500 hover:border-[#FFED00] hover:shadow-[0_0_30px_rgba(255,237,0,0.3)]"
              style={{
                transform: `translateY(${scrollY * (0.02 + index * 0.01)}px)`,
                opacity: isVisible ? 1 : 0,
                transition: `opacity 0.6s ease-out ${index * 0.1}s, transform 0.3s ease-out, border-color 0.3s, box-shadow 0.3s`,
              }}
            >
              {/* Glow effect on hover */}
              <div className="absolute inset-0 bg-[#FFED00] opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-10" />
              
              <div className="relative z-10 flex items-center justify-between">
                <span className="orbit-stat-label underline decoration-2 underline-offset-4">
                  {stat.label}
                </span>
                <span className="flex items-center gap-1 text-xs text-white/70">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#FFED00]" />
                  LIVE
                </span>
              </div>
              <div className="relative z-10 space-y-3">
                <div className="orbit-stat-number group-hover:text-[#FFED00] transition-colors duration-300">
                  {stat.value}
                </div>
                <p className="orbit-stat-title">{stat.title}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Cookie Banner with Parallax */}
        <div
          className="mt-10 border-2 border-white px-4 py-3 transition-all duration-300 hover:border-[#FFED00]"
          style={{
            transform: `translateY(${scrollY * 0.03}px)`,
            opacity: isVisible ? 1 : 0,
            transition: `opacity 0.8s ease-out 0.6s, transform 0.3s ease-out, border-color 0.3s`,
          }}
        >
          <div className="flex flex-col gap-3 text-xs md:flex-row md:items-center md:justify-between">
            <span className="orbit-stat-label text-white">COOKIE NOTICE</span>
            <span className="text-white/70">
              This terminal uses cookies for analytics and session continuity.
            </span>
            <button className="orbit-accent-button relative overflow-hidden px-3 py-2 text-xs group">
              <span className="absolute inset-0 bg-[#FFED00] opacity-0 transition-opacity duration-300 group-hover:opacity-20" />
              <span className="relative z-10">ACCEPT →</span>
            </button>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes gridPulse {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.2; }
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
        
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 1s ease-out;
        }
        
        .animate-slide-up {
          animation: slide-up 1s ease-out 0.2s both;
        }
      `}</style>
    </section>
  );
}

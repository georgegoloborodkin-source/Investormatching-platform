import { OrbitStatsSection } from "@/components/OrbitStatsSection";

export default function OrbitStatsDemo() {
  return (
    <div className="min-h-[200vh] bg-[#050505]">
      {/* Hero Section with Parallax */}
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden border-b-2 border-white">
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#FFED00]/5 via-transparent to-[#FFED00]/5"
          style={{
            animation: "gradientShift 8s ease-in-out infinite",
          }}
        />
        <div className="relative z-10 text-center">
          <h1 className="mb-4 font-mono text-6xl font-black text-white md:text-8xl">
            ORBIT
          </h1>
          <p className="font-mono text-xl text-[#FFED00] md:text-2xl">
            VENTURES
          </p>
        </div>
      </div>

      {/* Stats Section */}
      <div className="mx-auto max-w-7xl">
        <OrbitStatsSection />
      </div>

      {/* Additional Content for Parallax Testing */}
      <div className="relative min-h-screen border-t-2 border-white bg-[#050505] px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 font-mono text-4xl font-black text-white">
            FRONTIER CAPITAL
          </h2>
          <div className="space-y-6 text-white/80">
            <p className="text-lg leading-relaxed">
              Emerging markets represent the next frontier of venture capital.
              With disciplined execution and institutional momentum, we deploy
              capital across categories that scale.
            </p>
            <p className="text-lg leading-relaxed">
              Our signal stack filters 2,914 pipeline opportunities in real-time,
              flagging high-conviction anomalies for immediate action.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes gradientShift {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

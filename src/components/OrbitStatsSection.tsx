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
  return (
    <section className="orbit-void relative overflow-hidden border-2 border-white bg-black text-white">
      <div className="relative z-10 px-6 py-8 md:px-10 md:py-12">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="orbit-stat-label">MARKET INTELLIGENCE</p>
            <h2 className="orbit-stat-heading max-w-xl">
              An emerging-market signal stack for decisive capital.
            </h2>
          </div>
          <button className="orbit-accent-button group">
            <span className="orbit-accent-text">ALL NEWS</span>
            <span className="orbit-accent-text transition-transform duration-150 group-hover:translate-x-1">
              →
            </span>
          </button>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="group flex min-h-[170px] flex-col justify-between border-2 border-white px-6 py-5"
            >
              <div className="flex items-center justify-between">
                <span className="orbit-stat-label underline decoration-2 underline-offset-4">
                  {stat.label}
                </span>
                <span className="text-xs text-white/70">LIVE</span>
              </div>
              <div className="space-y-3">
                <div className="orbit-stat-number group-hover:text-[#EAFF00]">
                  {stat.value}
                </div>
                <p className="orbit-stat-title">{stat.title}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 border-2 border-white px-4 py-3">
          <div className="flex flex-col gap-3 text-xs md:flex-row md:items-center md:justify-between">
            <span className="orbit-stat-label text-white">COOKIE NOTICE</span>
            <span className="text-white/70">
              This terminal uses cookies for analytics and session continuity.
            </span>
            <button className="orbit-accent-button px-3 py-2 text-xs">
              ACCEPT →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

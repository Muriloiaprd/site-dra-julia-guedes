export function Logo({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden>
        <defs>
          <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#C6FF00" />
            <stop offset="100%" stopColor="#00FF66" />
          </linearGradient>
          <filter id="logo-glow">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* speed lines */}
        <line x1="0" y1="18" x2="6" y2="18" stroke="#00FF66" strokeWidth="1.5" opacity="0.7" />
        <line x1="1" y1="13" x2="5.5" y2="13" stroke="#00FF66" strokeWidth="1" opacity="0.4" />
        <line x1="1" y1="23" x2="5.5" y2="23" stroke="#00FF66" strokeWidth="1" opacity="0.4" />
        {/* O ring */}
        <circle cx="21" cy="18" r="13" stroke="url(#logo-g)" strokeWidth="2" fill="none" filter="url(#logo-glow)" />
        {/* power symbol */}
        <line x1="21" y1="8.5" x2="21" y2="15" stroke="url(#logo-g)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M13.5 13 A10 10 0 1 0 28.5 13" stroke="url(#logo-g)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </svg>
      <div className="flex flex-col leading-none">
        <span
          className="font-black tracking-tight"
          style={{ fontFamily: "'Poppins', sans-serif", fontSize: size * 0.5 }}
        >
          ndilow
        </span>
        <span
          className="tracking-widest uppercase"
          style={{ fontSize: size * 0.2, color: "#888", letterSpacing: "0.18em", marginTop: 1 }}
        >
          corrida sem limites
        </span>
      </div>
    </div>
  );
}

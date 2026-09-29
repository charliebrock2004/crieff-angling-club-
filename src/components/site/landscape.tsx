/**
 * Illustrated Perthshire landscape used wherever the club has not yet uploaded
 * a photograph. Deterministic (seeded) so server and client output match, and
 * pure SVG so it costs no JavaScript and scales to any screen.
 */
type Variant = "river" | "loch" | "dusk" | "winter";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ridge(baseY: number, amp: number, seed: number, step = 16, width = 1600, height = 900) {
  const r = rng(seed);
  const phases = [r() * 6, r() * 6, r() * 6, r() * 6];
  let d = `M0 ${height} L0 ${baseY}`;
  for (let x = 0; x <= width; x += step) {
    const y =
      baseY -
      amp * (0.55 * Math.sin(x / 260 + phases[0]) + 0.3 * Math.sin(x / 120 + phases[1]) + 0.12 * Math.sin(x / 47 + phases[2]) + 0.05 * Math.sin(x / 17 + phases[3]));
    d += ` L${x} ${y.toFixed(1)}`;
  }
  return `${d} L${width} ${height} Z`;
}

function treeLine(baseY: number, seed: number, width = 1600, height = 900, density = 7) {
  const r = rng(seed);
  let d = `M0 ${height} L0 ${baseY}`;
  let x = 0;
  while (x < width) {
    const roll = Math.sin(x / 210 + seed) * 14 + Math.sin(x / 71) * 5;
    const y = baseY + roll;
    const h = 8 + r() * (r() > 0.85 ? 34 : 20);
    const w = density + r() * 5;
    d += ` L${x.toFixed(1)} ${y.toFixed(1)} L${(x + w / 2).toFixed(1)} ${(y - h).toFixed(1)} L${(x + w).toFixed(1)} ${y.toFixed(1)}`;
    x += w * (0.55 + r() * 0.35);
  }
  return `${d} L${width} ${height} Z`;
}

const PALETTES: Record<Variant, { sky: [string, string, string, string]; sun: string; far: string; mid: string; trees: string; ground: string; water: [string, string, string]; mist: string }> = {
  river: {
    sky: ["#1f3136", "#6f7f78", "#d4ad76", "#f0dfbd"],
    sun: "#f3c47a",
    far: "#6d7b7a",
    mid: "#46584f",
    trees: "#23362d",
    ground: "#14221d",
    water: ["#ecd3a4", "#7f8a7d", "#1e2f2a"],
    mist: "#f3e6cc",
  },
  loch: {
    sky: ["#223440", "#6d8490", "#c9b995", "#ece2cb"],
    sun: "#f6d9a0",
    far: "#6b7e86",
    mid: "#4a5d5c",
    trees: "#243832",
    ground: "#152420",
    water: ["#e6dcc2", "#819394", "#223532"],
    mist: "#eef0e6",
  },
  dusk: {
    sky: ["#131d22", "#3b4a52", "#b0714a", "#e2a66d"],
    sun: "#f0a05a",
    far: "#4c5558",
    mid: "#303d38",
    trees: "#18251f",
    ground: "#0e1814",
    water: ["#e6a46a", "#6a5b4f", "#121c19"],
    mist: "#e8c29a",
  },
  winter: {
    sky: ["#2a3a44", "#8a9aa3", "#d9dcd6", "#f1f1ec"],
    sun: "#fff4dc",
    far: "#8f9ea3",
    mid: "#637370",
    trees: "#2b3a36",
    ground: "#1b2824",
    water: ["#eef0ea", "#95a3a3", "#28383a"],
    mist: "#f5f6f2",
  },
};

export function Landscape({ variant = "river", seed = 7, className, angler = true, title }: { variant?: Variant; seed?: number; className?: string; angler?: boolean; title?: string }) {
  const p = PALETTES[variant];
  const id = `ls-${variant}-${seed}`;
  const isLoch = variant === "loch";
  const water = isLoch ? "#8a9a96" : p.water[1];
  return (
    <svg
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset="0.42" stopColor={p.sky[1]} />
          <stop offset="0.66" stopColor={p.sky[2]} />
          <stop offset="0.74" stopColor={p.sky[3]} />
        </linearGradient>
        <radialGradient id={`${id}-sun`} cx="0.68" cy="0.6" r="0.42">
          <stop offset="0" stopColor={p.sun} stopOpacity="0.9" />
          <stop offset="0.25" stopColor={p.sun} stopOpacity="0.35" />
          <stop offset="1" stopColor={p.sun} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.water[0]} />
          <stop offset="0.45" stopColor={water} />
          <stop offset="1" stopColor={p.water[2]} />
        </linearGradient>
        <linearGradient id={`${id}-mist`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.mist} stopOpacity="0" />
          <stop offset="0.5" stopColor={p.mist} stopOpacity="0.55" />
          <stop offset="1" stopColor={p.mist} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor="#0b1411" stopOpacity="0" />
          <stop offset="1" stopColor="#0b1411" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      <rect width="1600" height="900" fill={`url(#${id}-sky)`} />
      <rect width="1600" height="900" fill={`url(#${id}-sun)`} />
      <circle cx="1088" cy="532" r="38" fill={p.sun} opacity="0.85" />

      <path d={ridge(470, 70, seed)} fill={p.far} opacity="0.7" />
      <path d={ridge(535, 55, seed + 3)} fill={p.mid} opacity="0.9" />
      <rect y="520" width="1600" height="110" fill={`url(#${id}-mist)`} />
      <path d={treeLine(615, seed + 11)} fill={p.trees} />

      {isLoch ? (
        <g>
          <rect y="640" width="1600" height="260" fill={`url(#${id}-water)`} />
          <ellipse cx="1088" cy="700" rx="46" ry="110" fill={p.sun} opacity="0.28" />
          {Array.from({ length: 16 }, (_, i) => (
            <line key={i} x1={880 + ((i * 97) % 420)} x2={930 + ((i * 97) % 420)} y1={660 + i * 14} y2={660 + i * 14} stroke={p.water[0]} strokeOpacity={0.4 - i * 0.02} strokeWidth="2" strokeLinecap="round" />
          ))}
          {/* boat with two anglers */}
          <g transform="translate(560 725)" fill={p.ground}>
            <path d="M-70 0 Q0 18 70 0 L60 12 Q0 26 -60 12 Z" />
            <path d="M-28 0 l6 -34 a8 8 0 1 1 10 0 l6 34 Z" />
            <path d="M22 0 l5 -30 a7 7 0 1 1 9 0 l5 30 Z" />
            <path d="M-10 -26 Q 120 -170 330 -120" stroke={p.ground} strokeWidth="1.6" fill="none" opacity="0.8" />
          </g>
          <path d="M0 900 L0 790 C 180 760 320 800 420 850 L 460 900 Z" fill={p.ground} />
          <path d="M1600 900 L1600 770 C 1420 780 1300 830 1240 900 Z" fill={p.ground} />
        </g>
      ) : (
        <g>
          <path d="M760 632 C 820 650 900 660 880 700 C 860 740 700 760 640 800 C 590 834 600 870 640 900 L 1240 900 C 1150 860 1040 840 1020 790 C 1000 745 1120 700 1040 660 C 1000 642 900 636 760 632 Z" fill={`url(#${id}-water)`} />
          {Array.from({ length: 14 }, (_, i) => (
            <path key={i} d={`M${820 + (i % 3) * 30 - i * 14} ${660 + i * 17} q 40 -4 ${70 + i * 6} 0`} stroke={p.water[0]} strokeOpacity={0.45 - i * 0.025} strokeWidth="2" fill="none" strokeLinecap="round" />
          ))}
          <path d="M0 900 L0 690 C 160 680 300 700 420 740 C 520 772 600 800 640 850 L 660 900 Z" fill={p.ground} />
          <path d="M1600 900 L1600 680 C 1470 690 1330 720 1230 770 C 1150 810 1110 850 1120 900 Z" fill={p.ground} />
          {angler && (
            <g transform="translate(470 752)" fill={p.ground}>
              <path d="M-9 0 L-6 -40 Q-6 -52 3 -54 Q12 -52 12 -40 L14 0 Z" />
              <circle cx="3" cy="-62" r="8" />
              <path d="M4 -58 L-4 -64 L14 -64 Z" />
              <path d="M8 -44 L40 -118" stroke={p.ground} strokeWidth="2.4" strokeLinecap="round" />
              <path d="M40 -118 Q 190 -150 330 -40" stroke={p.ground} strokeWidth="1.1" fill="none" opacity="0.75" />
            </g>
          )}
          {/* grass tufts */}
          {Array.from({ length: 26 }, (_, i) => {
            const r = rng(seed + i);
            const x = i < 13 ? r() * 520 : 1160 + r() * 440;
            const y = i < 13 ? 760 + r() * 120 : 750 + r() * 130;
            return <path key={i} d={`M${x} ${y} l -4 -${14 + r() * 14} M${x + 3} ${y} l 2 -${18 + r() * 16} M${x + 6} ${y} l 6 -${12 + r() * 12}`} stroke={p.ground} strokeWidth="1.6" strokeLinecap="round" />;
          })}
        </g>
      )}
      <rect width="1600" height="900" fill={`url(#${id}-shade)`} />
    </svg>
  );
}

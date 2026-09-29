import { useEffect, useState } from "react";

// The app's one preloader: eight purple dots fading around a ring (the design
// the user supplied) with a large percentage in the middle. When `percent` is
// omitted the number self-advances toward 95% so it still reads as progress
// during indeterminate waits (auth bootstrap, session switch).

interface DotsLoaderProps {
  percent?: number;
  size?: number; // ring diameter in px
  label?: string;
  className?: string;
}

const DOT_COLOR = "#9B7BFF";
const TEXT_COLOR = "#8B6CFF";

export function DotsLoader({ percent, size = 200, label, className = "" }: DotsLoaderProps) {
  const [auto, setAuto] = useState(0);
  const indeterminate = percent === undefined;

  useEffect(() => {
    if (!indeterminate) return;
    const t = setInterval(() => setAuto((p) => p + (95 - p) * 0.06), 100);
    return () => clearInterval(t);
  }, [indeterminate]);

  const shown = Math.max(0, Math.min(100, Math.round(indeterminate ? auto : percent)));
  const radius = size / 2 - size * 0.12;
  const dot = size * 0.2;

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`} role="status" aria-live="polite" aria-label={label || `กำลังโหลด ${shown}%`}>
      <style>{`
        @keyframes ense-dot-fade { 0% { opacity: 1 } 100% { opacity: .12 } }
        .ense-dot { animation: ense-dot-fade 1s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .ense-dot { animation-duration: 2.4s } }
      `}</style>
      <div className="relative" style={{ width: size, height: size }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className="ense-dot absolute rounded-full"
            style={{
              width: dot,
              height: dot,
              left: "50%",
              top: "50%",
              marginLeft: -dot / 2,
              marginTop: -dot / 2,
              background: DOT_COLOR,
              transform: `rotate(${i * 45}deg) translateY(-${radius}px)`,
              animationDelay: `${(i * 0.125).toFixed(3)}s`,
            }}
          />
        ))}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-bold tabular-nums leading-none"
            style={{ color: TEXT_COLOR, fontSize: size * 0.26 }}
          >
            {shown}%
          </span>
        </div>
      </div>
      {label && <p className="text-sm font-medium" style={{ color: TEXT_COLOR }}>{label}</p>}
    </div>
  );
}

// Full-viewport centered variant used for every blocking load.
export function FullScreenLoader(props: DotsLoaderProps) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-background/85 backdrop-blur-sm">
      <DotsLoader {...props} />
    </div>
  );
}

import React, { useEffect, useState } from 'react';

interface SeatedWorkspaceProps {
  x: number;
  y: number;
  facing: 'se' | 'sw';
  isSeated: boolean;
  isTimerRunning: boolean;
  currentGoal: string;
  reducedMotion: boolean;
  onSipCoffee?: () => void;
}

/**
 * Renders the interactive Isometric Laptop (with smooth lid-opening animation
 * and glowing code/notes screen) and the Steaming Ceramic Coffee Cup & Saucer
 * on the selected seat's table.
 */
export const SeatedWorkspaceItems: React.FC<SeatedWorkspaceProps> = ({
  x,
  y,
  facing,
  isSeated,
  isTimerRunning,
  reducedMotion,
  onSipCoffee,
}) => {
  const [openProgress, setOpenProgress] = useState(0);
  const [coffeeLevel, setCoffeeLevel] = useState(1); // 1 = full, 0.7, 0.4, then refills
  const [sipToast, setSipToast] = useState<string | null>(null);

  const isReduced = reducedMotion;

  useEffect(() => {
    if (!isSeated) {
      setOpenProgress(0);
      return;
    }

    if (isReduced) {
      setOpenProgress(1);
      return;
    }

    let frameId: number;
    const startTime = performance.now();
    const delay = 260; // wait slightly as camera glides in and chair moves
    const duration = 680;

    const animate = (now: number) => {
      const elapsed = now - startTime - delay;
      if (elapsed < 0) {
        setOpenProgress(0);
        frameId = requestAnimationFrame(animate);
        return;
      }
      const t = Math.min(1, elapsed / duration);
      // Smooth cubic out with gentle mechanical hinge settle
      const eased = 1 - Math.pow(1 - t, 3);
      setOpenProgress(eased);
      if (t < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [isSeated, isReduced]);

  if (!isSeated) return null;

  const flipX = facing === 'sw' ? -1 : 1;
  // Lid height scales from 0 (closed flat on keyboard) to 1 (fully open at 105 deg)
  const lidOpen = openProgress;

  const handleCoffeeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSipCoffee) onSipCoffee();
    if (coffeeLevel <= 0.45) {
      setCoffeeLevel(1);
      setSipToast('Freshly refilled!');
    } else {
      setCoffeeLevel((prev) => Math.max(0.35, +(prev - 0.3).toFixed(2)));
      setSipToast('Warm & aromatic ☕');
    }
    window.setTimeout(() => setSipToast(null), 1600);
  };

  return (
    <g transform={`translate(${x}, ${y})`} className="select-none">
      {/* Warm ambient glow cast by the laptop screen onto the wooden tabletop */}
      {lidOpen > 0.3 && (
        <ellipse
          cx={0}
          cy={2}
          rx={42 * lidOpen}
          ry={24 * lidOpen}
          fill="url(#laptopScreenGlow)"
          opacity={0.75 * lidOpen}
        />
      )}

      {/* ================= ISOMETRIC LAPTOP ================= */}
      <g transform={`scale(${flipX}, 1)`}>
        {/* Drop shadow under laptop base */}
        <polygon
          points="-26,4 4,-12 28,1 -2,17"
          fill="rgba(16, 10, 6, 0.42)"
        />

        {/* Laptop Aluminum/Warm-Titanium Base Deck (Bottom Chassis) */}
        <polygon
          points="-24,2 4,-13 26,-1 -2,14"
          fill="#D6CFC7"
          stroke="#6E655F"
          strokeWidth="0.9"
        />
        {/* Base thickness bevel */}
        <polygon
          points="-24,2 -2,14 -2,16.5 -24,4.5"
          fill="#9E958C"
        />
        <polygon
          points="-2,14 26,-1 26,1.5 -2,16.5"
          fill="#7D746C"
        />

        {/* Isometric Recessed Dark Charcoal Keyboard Matrix */}
        <polygon
          points="-18,-1 3,-11 17,-3.5 -4,6.5"
          fill="#2B2623"
          stroke="#4A423D"
          strokeWidth="0.5"
        />
        {/* Subtle key rows on the keyboard */}
        <line x1="-15" y1="0" x2="2" y2="-8.5" stroke="#59504A" strokeWidth="1" strokeDasharray="2 1" />
        <line x1="-12" y1="1.8" x2="5" y2="-6.7" stroke="#59504A" strokeWidth="1" strokeDasharray="2 1" />
        <line x1="-9" y1="3.6" x2="8" y2="-4.9" stroke="#59504A" strokeWidth="1" strokeDasharray="2.5 1" />
        <line x1="-6" y1="5.2" x2="11" y2="-3.3" stroke="#59504A" strokeWidth="1" strokeDasharray="4 1.5" />

        {/* Trackpad */}
        <polygon
          points="1,6 9,2 14,4.5 6,8.5"
          fill="#C2B9B0"
          stroke="#8C827A"
          strokeWidth="0.5"
        />

        {/* Laptop Lid / Screen Assembly — Animates from closed (flat on base) to upright */}
        {(() => {
          // Hinge line connects (-23, 1.5) to (4, -12.5)
          // When closed (lidOpen = 0), top edge of lid lies at (-2, 13.5) and (25, -0.5)
          // When open (lidOpen = 1), top edge rises up to (-25, -24) and (2, -38)
          const topLeftX = -2 * (1 - lidOpen) + -25 * lidOpen;
          const topLeftY = 13.5 * (1 - lidOpen) + -24 * lidOpen;
          const topRightX = 25 * (1 - lidOpen) + 2 * lidOpen;
          const topRightY = -0.5 * (1 - lidOpen) + -38 * lidOpen;

          return (
            <g>
              {/* Back shell of lid */}
              <polygon
                points={`-23.5,1.5 4,-12.5 ${topRightX - 1},${topRightY - 0.5} ${topLeftX - 1},${topLeftY - 0.5}`}
                fill="#B8AFA6"
                stroke="#6E655F"
                strokeWidth="0.8"
              />

              {/* Inner Screen Bezel */}
              <polygon
                points={`-23,1.5 4,-12.5 ${topRightX},${topRightY} ${topLeftX},${topLeftY}`}
                fill="#1E1A17"
                stroke="#4A423D"
                strokeWidth="0.7"
              />

              {/* Glowing Display Panel (visible as lid opens) */}
              {lidOpen > 0.15 && (
                <g opacity={Math.min(1, (lidOpen - 0.15) / 0.4)}>
                  <polygon
                    points={`
                      ${-21.5 * 1},${0.2}
                      ${2.5},{-11.8}
                      ${topRightX - 1.2},${topRightY + 2.2}
                      ${topLeftX + 1.8},${topLeftY + 2.2}
                    `}
                    fill="#26211E"
                  />
                  {/* Warm Editor / Study Interface inside the Laptop Screen */}
                  {lidOpen > 0.55 && (
                    <g opacity={(lidOpen - 0.55) / 0.45}>
                      {/* Sidebar */}
                      <polygon
                        points="-20.5,-1 -15,-3.8 -16.2,-20.5 -21.8,-17.5"
                        fill="#1B1715"
                      />
                      {/* Glowing code / study lines */}
                      <line x1="-13" y1="-18" x2="-3" y2="-23" stroke="#E5A93C" strokeWidth="1.3" strokeLinecap="round" />
                      <line x1="-12" y1="-14.5" x2="-1" y2="-20" stroke="#78A890" strokeWidth="1.2" strokeLinecap="round" />
                      <line x1="-10.5" y1="-11" x2="-4" y2="-14.3" stroke="#E07A5F" strokeWidth="1.2" strokeLinecap="round" />
                      <line x1="-12" y1="-8" x2="-1.5" y2="-13.2" stroke="#D4C5B9" strokeWidth="1.1" strokeLinecap="round" opacity="0.8" />
                      <line x1="-11" y1="-5" x2="-5" y2="-8" stroke="#8AB0AB" strokeWidth="1.2" strokeLinecap="round" />
                      {/* Active pulsing cursor when timer is running */}
                      <circle
                        cx="-2.5"
                        cy="-7.5"
                        r="1.1"
                        fill={isTimerRunning ? '#68D391' : '#F6AD55'}
                        className={!isReduced ? 'animate-pulse' : ''}
                      />
                    </g>
                  )}
                </g>
              )}

              {/* Subtle Glowing Café Emblem on Back of Lid when partially closed */}
              {lidOpen < 0.45 && (
                <circle
                  cx={(topLeftX + 4) / 2}
                  cy={(topLeftY + 1) / 2}
                  r="2.2"
                  fill="#FFF3D6"
                  opacity={0.7}
                />
              )}
            </g>
          );
        })()}
      </g>

      {/* ================= STEAMING COFFEE CUP & SAUCER ================= */}
      <g
        transform={`translate(${facing === 'sw' ? -30 : 30}, ${facing === 'sw' ? 8 : -7})`}
        onClick={handleCoffeeClick}
        className="cursor-pointer group"
      >
        <title>Click to take a warm sip or refill your cup</title>

        {/* Subtle interactive hover ring under saucer */}
        <ellipse
          cx="0"
          cy="3.5"
          rx="12.5"
          ry="7.5"
          fill="none"
          stroke="#F3B664"
          strokeWidth="1.2"
          opacity="0"
          className="group-hover:opacity-80 transition-opacity duration-200"
        />

        {/* Saucer Shadow */}
        <ellipse cx="0.5" cy="4.2" rx="10.5" ry="6" fill="rgba(18, 11, 7, 0.38)" />

        {/* Ceramic Saucer */}
        <ellipse cx="0" cy="3" rx="9.8" ry="5.6" fill="#EDE1D1" stroke="#B5A38F" strokeWidth="0.8" />
        <ellipse cx="0" cy="2.7" rx="6.2" ry="3.5" fill="#DFC7B0" />

        {/* Cup Handle */}
        <path
          d="M 5.5,-2 C 9.2,-3 9.2,2.5 5.2,2"
          fill="none"
          stroke="#F4EBE1"
          strokeWidth="1.8"
          strokeLinecap="round"
        />

        {/* Cup Cylinder Body */}
        <path
          d="M -6.2,-4.5 L -5.0,2.2 C -3.5,4.5 3.5,4.5 5.0,2.2 L 6.2,-4.5 Z"
          fill="#F7EFE6"
          stroke="#C2B09C"
          strokeWidth="0.7"
        />
        {/* Warm Terracotta Band around Cup */}
        <path
          d="M -5.6,-1.2 C -2.5,0.6 2.5,0.6 5.6,-1.2 L 5.2,1.2 C 2.5,2.8 -2.5,2.8 -5.2,1.2 Z"
          fill="#C86D51"
          opacity="0.85"
        />

        {/* Cup Rim & Rich Espresso Crema */}
        <ellipse cx="0" cy="-4.5" rx="6.2" ry="3.6" fill="#FFFDF9" stroke="#C2B09C" strokeWidth="0.7" />
        <ellipse
          cx="0"
          cy={-4.3 + (1 - coffeeLevel) * 1.4}
          rx={5.2 * (0.85 + coffeeLevel * 0.15)}
          ry={2.9 * (0.85 + coffeeLevel * 0.15)}
          fill="#6F3B20"
        />
        {/* Latte Art Rosetta Heart */}
        {coffeeLevel > 0.5 && (
          <path
            d="M -1.5,-4.8 C -2.5,-5.8 0,-6.2 0,-4.6 C 0,-6.2 2.5,-5.8 1.5,-4.8 C 0.8,-3.9 0,-3.3 0,-3.3 C 0,-3.3 -0.8,-3.9 -1.5,-4.8 Z"
            fill="#F3E5D0"
            opacity="0.88"
          />
        )}

        {/* Gently Rising Animated Steam Wisps */}
        {!isReduced ? (
          <g className="pointer-events-none">
            <path
              d="M -2,-8 C -4,-13 2,-17 -1,-23"
              fill="none"
              stroke="#FFF6E8"
              strokeWidth="1.3"
              strokeLinecap="round"
              className="steam-wisp-1"
            />
            <path
              d="M 1.5,-7 C 4,-12 -2,-16 1.5,-22"
              fill="none"
              stroke="#FFF6E8"
              strokeWidth="1.1"
              strokeLinecap="round"
              className="steam-wisp-2"
            />
            <path
              d="M -0.5,-10 C 2,-15 -3,-20 0,-26"
              fill="none"
              stroke="#FFF6E8"
              strokeWidth="1"
              strokeLinecap="round"
              className="steam-wisp-3"
            />
          </g>
        ) : (
          <g opacity="0.45" className="pointer-events-none">
            <path
              d="M -1.5,-8 C -3.5,-12 1.5,-15 -0.5,-20"
              fill="none"
              stroke="#FFF6E8"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path
              d="M 1.5,-7 C 3.5,-11 -1.5,-14 1,-19"
              fill="none"
              stroke="#FFF6E8"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Floating Mini Toast when sipping/refilling */}
        {sipToast && (
          <g transform="translate(0, -28)" className="pointer-events-none">
            <rect
              x="-38"
              y="-11"
              width="76"
              height="16"
              rx="8"
              fill="#1E1612"
              stroke="#D48C46"
              strokeWidth="0.8"
              opacity="0.94"
            />
            <text
              x="0"
              y="-0.5"
              textAnchor="middle"
              fill="#F8E7CE"
              fontSize="7.5"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fontWeight="600"
            >
              {sipToast}
            </text>
          </g>
        )}
      </g>
    </g>
  );
};

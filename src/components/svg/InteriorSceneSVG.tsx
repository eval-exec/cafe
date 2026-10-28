import React, { useEffect, useRef, useState } from 'react';
import {
  CafeThemeConfig,
  ReactionEvent,
  SeatConfig,
  SeatId,
  TimeOfDay,
  VisitorPresence,
} from '../../types';
import {
  DEFAULT_INTERIOR_VIEWBOX,
  isoBoxFaces,
  isoPolygon,
  isoToScreen,
  SEAT_LIST,
  SEATS,
} from '../../utils/isometric';
import {
  IsoBookshelfUnit,
  IsoCommunalTableBase,
  IsoEspressoCounter,
  IsoHangingLamp,
  IsoPlant,
  IsoSeatStation,
  IsoSocialLoungeCornerBase,
} from './CafeFurniture';
import { IsoAvatar } from './IsoAvatar';
import { SeatedWorkspaceItems } from './SeatedWorkspaceProps';

interface InteriorSceneSVGProps {
  theme: CafeThemeConfig;
  selfUserId: string;
  visitors: VisitorPresence[];
  activeReactions: Record<string, ReactionEvent>;
  selectedSeatId: SeatId | null;
  hoveredSeatId: SeatId | null;
  timeOfDay: TimeOfDay;
  isRaining: boolean;
  isFireplaceActive: boolean;
  isTimerRunning: boolean;
  currentGoal: string;
  reducedMotion: boolean;
  skipAnimations: boolean;
  onSelectSeat: (seatId: SeatId) => void;
  onHoverSeat: (seatId: SeatId | null) => void;
  onSelectVisitor: (visitor: VisitorPresence) => void;
  onSipCoffee: () => void;
}

export const InteriorSceneSVG: React.FC<InteriorSceneSVGProps> = ({
  theme,
  selfUserId,
  visitors,
  activeReactions,
  selectedSeatId,
  hoveredSeatId,
  timeOfDay,
  isRaining,
  isFireplaceActive,
  isTimerRunning,
  currentGoal,
  reducedMotion,
  skipAnimations,
  onSelectSeat,
  onHoverSeat,
  onSelectVisitor,
  onSipCoffee,
}) => {
  const initialViewBox: [number, number, number, number] = selectedSeatId
    ? SEATS[selectedSeatId].cameraViewBox
    : DEFAULT_INTERIOR_VIEWBOX;

  const [viewBox, setViewBox] = useState<[number, number, number, number]>(
    initialViewBox
  );
  const currentViewBoxRef = useRef<[number, number, number, number]>(
    initialViewBox
  );

  const shouldSkipAnim = reducedMotion || skipAnimations;

  // Smoothly animate SVG camera viewBox when selecting a seat or standing up
  useEffect(() => {
    const target: [number, number, number, number] = selectedSeatId
      ? SEATS[selectedSeatId].cameraViewBox
      : DEFAULT_INTERIOR_VIEWBOX;

    if (shouldSkipAnim) {
      currentViewBoxRef.current = target;
      setViewBox(target);
      return;
    }

    const start = [...currentViewBoxRef.current] as [
      number,
      number,
      number,
      number,
    ];
    const startTime = performance.now();
    const duration = 760;
    let frameId: number;

    const animateCamera = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - t, 4);

      const next: [number, number, number, number] = [
        start[0] + (target[0] - start[0]) * ease,
        start[1] + (target[1] - start[1]) * ease,
        start[2] + (target[2] - start[2]) * ease,
        start[3] + (target[3] - start[3]) * ease,
      ];

      currentViewBoxRef.current = next;
      setViewBox(next);

      if (t < 1) {
        frameId = requestAnimationFrame(animateCamera);
      }
    };

    frameId = requestAnimationFrame(animateCamera);
    return () => cancelAnimationFrame(frameId);
  }, [selectedSeatId, shouldSkipAnim]);

  // Sort the 12 seats by isometric depth (isoX + isoY)
  const sortedSeats: SeatConfig[] = [...SEAT_LIST].sort(
    (a, b) => a.isoX + a.isoY - (b.isoX + b.isoY)
  );

  // Build map of seatId -> VisitorPresence
  const seatOccupants = new Map<SeatId, VisitorPresence>();
  const standingVisitors: VisitorPresence[] = [];

  visitors.forEach((v) => {
    if (v.seatId && SEATS[v.seatId as SeatId]) {
      seatOccupants.set(v.seatId as SeatId, v);
    } else {
      standingVisitors.push(v);
    }
  });

  const ROOM_SIZE = 10;
  const WALL_H = 3.65;

  const sunbeamOpacity =
    timeOfDay === 'morning'
      ? 0.28
      : timeOfDay === 'afternoon'
      ? 0.24
      : timeOfDay === 'dusk'
      ? 0.14
      : 0.05;

  const windowSkyFill =
    timeOfDay === 'morning'
      ? '#F5D6A7'
      : timeOfDay === 'afternoon'
      ? '#E8B87D'
      : timeOfDay === 'dusk'
      ? '#4A3B59'
      : '#171D2E';

  // Zone label positions
  const quietZoneLabelPos = isoToScreen(1.8, 1.5, 0.03);
  const sharedZoneLabelPos = isoToScreen(5.2, 6.65, 0.03);
  const loungeZoneLabelPos = isoToScreen(8.35, 7.15, 0.03);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <svg
        viewBox={`${viewBox[0].toFixed(1)} ${viewBox[1].toFixed(1)} ${viewBox[2].toFixed(
          1
        )} ${viewBox[3].toFixed(1)}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full block"
        role="img"
        aria-label={`Isometric Interior of ${theme.name} — 3 Social Zones & 12 Interactive Seats`}
      >
        <defs>
          <radialGradient id="interiorBgGrad" cx="50%" cy="48%" r="65%">
            <stop offset="0%" stopColor="#2D201A" />
            <stop offset="65%" stopColor="#1B130F" />
            <stop offset="100%" stopColor="#120D0A" />
          </radialGradient>

          <linearGradient id="oakFloorGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={theme.floorPrimary} />
            <stop offset="100%" stopColor={theme.floorSecondary} />
          </linearGradient>

          <linearGradient id="nwWallGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.wallPrimary} />
            <stop offset="100%" stopColor={theme.wallSecondary} />
          </linearGradient>

          <linearGradient id="neWallGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.wallSecondary} />
            <stop offset="100%" stopColor={theme.wallPrimary} />
          </linearGradient>

          <linearGradient id="sunbeamGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFF0C4" stopOpacity="0.85" />
            <stop offset="55%" stopColor="#F5BD6E" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#F5BD6E" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="pendantConeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFF3CC" stopOpacity="0.7" />
            <stop offset="60%" stopColor="#F3B664" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#F3B664" stopOpacity="0" />
          </linearGradient>

          <radialGradient id="warmLampHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFF5D6" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#F5B056" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#F5B056" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="laptopScreenGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFEAC2" stopOpacity="0.65" />
            <stop offset="60%" stopColor="#E5A253" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#E5A253" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="fireplaceFloorGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FF9442" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#D95B26" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#D95B26" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="-200" y="-200" width="2000" height="1400" fill="url(#interiorBgGrad)" />

        {/* ================= 1. ISOMETRIC ARCHITECTURAL BASE & FLOOR SLAB ================= */}
        <polygon
          points={isoPolygon([
            [-0.4, -0.4, -0.35],
            [ROOM_SIZE + 0.5, -0.4, -0.35],
            [ROOM_SIZE + 0.5, ROOM_SIZE + 0.8, -0.35],
            [-0.4, ROOM_SIZE + 0.8, -0.35],
          ])}
          fill="rgba(6, 4, 3, 0.72)"
        />

        {/* Exterior Cobblestone Sidewalk Apron */}
        <polygon
          points={isoPolygon([
            [0, ROOM_SIZE, -0.05],
            [ROOM_SIZE, ROOM_SIZE, -0.05],
            [ROOM_SIZE, ROOM_SIZE + 1.15, -0.05],
            [0, ROOM_SIZE + 1.15, -0.05],
          ])}
          fill="#362E2B"
          stroke="#241E1C"
          strokeWidth="1.2"
        />
        {[1.5, 3, 4.5, 6, 7.5, 9].map((sx) => {
          const p1 = isoToScreen(sx, ROOM_SIZE, -0.05);
          const p2 = isoToScreen(sx, ROOM_SIZE + 1.15, -0.05);
          return (
            <line
              key={sx}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="#26201E"
              strokeWidth="1"
            />
          );
        })}

        {/* Main Honey-Oak Interior Floor Surface */}
        <polygon
          points={isoPolygon([
            [0, 0, 0],
            [ROOM_SIZE, 0, 0],
            [ROOM_SIZE, ROOM_SIZE, 0],
            [0, ROOM_SIZE, 0],
          ])}
          fill="url(#oakFloorGrad)"
          stroke="#5C381E"
          strokeWidth="1.5"
        />

        {/* Wooden Floor Plank Seams */}
        {Array.from({ length: 19 }).map((_, idx) => {
          const coord = (idx + 1) * 0.5;
          const pStart = isoToScreen(coord, 0, 0);
          const pEnd = isoToScreen(coord, ROOM_SIZE, 0);
          return (
            <line
              key={`plank-x-${idx}`}
              x1={pStart.x}
              y1={pStart.y}
              x2={pEnd.x}
              y2={pEnd.y}
              stroke="rgba(74, 42, 20, 0.26)"
              strokeWidth="0.9"
            />
          );
        })}
        {Array.from({ length: 10 }).map((_, idx) => {
          const coord = idx + 1;
          const pStart = isoToScreen(0, coord, 0);
          const pEnd = isoToScreen(ROOM_SIZE, coord, 0);
          return (
            <line
              key={`plank-y-${idx}`}
              x1={pStart.x}
              y1={pStart.y}
              x2={pEnd.x}
              y2={pEnd.y}
              stroke="rgba(74, 42, 20, 0.16)"
              strokeWidth="0.8"
            />
          );
        })}

        {/* Cutaway Floor Foundation Bevels */}
        <polygon
          points={isoPolygon([
            [0, ROOM_SIZE + 1.15, -0.05],
            [ROOM_SIZE, ROOM_SIZE + 1.15, -0.05],
            [ROOM_SIZE, ROOM_SIZE + 1.15, -0.32],
            [0, ROOM_SIZE + 1.15, -0.32],
          ])}
          fill="#2B221E"
        />
        <polygon
          points={isoPolygon([
            [ROOM_SIZE, 0, 0],
            [ROOM_SIZE, ROOM_SIZE, 0],
            [ROOM_SIZE, ROOM_SIZE, -0.28],
            [ROOM_SIZE, 0, -0.28],
          ])}
          fill="#59361C"
        />

        {/* ================= 2. THREE SOCIAL ZONE RUGS & ARCHITECTURAL ZONE MEDALLIONS ================= */}
        {/* Shared Work Zone Central Kilim Rug */}
        <polygon
          points={isoPolygon([
            [3.65, 3.65, 0.01],
            [6.85, 3.65, 0.01],
            [6.85, 6.85, 0.01],
            [3.65, 6.85, 0.01],
          ])}
          fill={theme.rugPrimary}
          stroke="#E0C39B"
          strokeWidth="1.5"
        />
        <polygon
          points={isoPolygon([
            [3.95, 3.95, 0.015],
            [6.55, 3.95, 0.015],
            [6.55, 6.55, 0.015],
            [3.95, 6.55, 0.015],
          ])}
          fill="none"
          stroke="#D49A4E"
          strokeWidth="1"
          strokeDasharray="4 2"
        />

        {/* Quiet Study Sanctuary Corner Rug */}
        <polygon
          points={isoPolygon([
            [0.85, 0.95, 0.01],
            [3.35, 0.95, 0.01],
            [3.35, 3.35, 0.01],
            [0.85, 3.35, 0.01],
          ])}
          fill="#355245"
          stroke="#C9B38F"
          strokeWidth="1.2"
        />

        {/* Subtle Zone Brass Floor Plates when in Overview */}
        {!selectedSeatId && (
          <g className="pointer-events-none" opacity="0.78">
            <g transform={`translate(${quietZoneLabelPos.x}, ${quietZoneLabelPos.y})`}>
              <rect x="-48" y="-7" width="96" height="14" rx="7" fill="rgba(22, 34, 28, 0.8)" stroke="#68D391" strokeWidth="0.6" />
              <text x="0" y="2.5" textAnchor="middle" fill="#A3E8BE" fontSize="6.5" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="700" letterSpacing="0.8">
                QUIET STUDY ZONE
              </text>
            </g>
            <g transform={`translate(${sharedZoneLabelPos.x}, ${sharedZoneLabelPos.y})`}>
              <rect x="-52" y="-7" width="104" height="14" rx="7" fill="rgba(38, 22, 16, 0.82)" stroke="#F3B664" strokeWidth="0.6" />
              <text x="0" y="2.5" textAnchor="middle" fill="#FFE0B5" fontSize="6.5" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="700" letterSpacing="0.8">
                SHARED WORK TABLE
              </text>
            </g>
            <g transform={`translate(${loungeZoneLabelPos.x}, ${loungeZoneLabelPos.y})`}>
              <rect x="-48" y="-7" width="96" height="14" rx="7" fill="rgba(36, 24, 18, 0.82)" stroke="#D48C46" strokeWidth="0.6" />
              <text x="0" y="2.5" textAnchor="middle" fill="#F5DFB8" fontSize="6.5" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="700" letterSpacing="0.8">
                SOCIAL LOUNGE
              </text>
            </g>
          </g>
        )}

        {/* Welcome Mat Inside the Café Doorway */}
        <polygon
          points={isoPolygon([
            [8.1, 9.0, 0.01],
            [9.5, 9.0, 0.01],
            [9.5, 9.85, 0.01],
            [8.1, 9.85, 0.01],
          ])}
          fill="#7D4E2D"
          stroke="#C8934B"
          strokeWidth="1"
        />

        {/* ================= 3. CUTAWAY WALLS, WINDOWS & FIREPLACE ================= */}
        {/* BACK-LEFT (NW) WALL */}
        <g>
          <polygon
            points={isoPolygon([
              [-0.25, 0, WALL_H],
              [0, 0, WALL_H],
              [0, ROOM_SIZE, WALL_H],
              [-0.25, ROOM_SIZE, WALL_H],
            ])}
            fill="#8C5D38"
            stroke="#3B2314"
            strokeWidth="1"
          />
          <polygon
            points={isoPolygon([
              [0, 0, 0],
              [0, ROOM_SIZE, 0],
              [0, ROOM_SIZE, WALL_H],
              [0, 0, WALL_H],
            ])}
            fill="url(#nwWallGrad)"
            stroke="#593820"
            strokeWidth="1.2"
          />
          <polygon
            points={isoPolygon([
              [0, 0, 0],
              [0, ROOM_SIZE, 0],
              [0, ROOM_SIZE, 1.05],
              [0, 0, 1.05],
            ])}
            fill={theme.wainscotColor}
            stroke="#1C2E26"
            strokeWidth="1"
          />
          <polygon
            points={isoPolygon([
              [0, 0, 1.02],
              [0, ROOM_SIZE, 1.02],
              [0, ROOM_SIZE, 1.12],
              [0, 0, 1.12],
            ])}
            fill="#5C381E"
          />

          {/* Arched Window on NW Wall */}
          <polygon
            points={isoPolygon([
              [0.02, 7.0, 1.15],
              [0.02, 9.2, 1.15],
              [0.02, 9.2, 3.15],
              [0.02, 7.0, 3.15],
            ])}
            fill={windowSkyFill}
            stroke="#4A2E1B"
            strokeWidth="3.5"
          />
          {(() => {
            const winCenter = isoToScreen(0.02, 8.1, 2.1);
            return (
              <g>
                <circle cx={winCenter.x - 16} cy={winCenter.y - 8} r="24" fill="#D98E32" opacity="0.78" />
                <circle cx={winCenter.x + 14} cy={winCenter.y + 6} r="20" fill="#E5A23C" opacity="0.72" />
              </g>
            );
          })()}
          <line
            x1={isoToScreen(0.02, 8.1, 1.15).x}
            y1={isoToScreen(0.02, 8.1, 1.15).y}
            x2={isoToScreen(0.02, 8.1, 3.15).x}
            y2={isoToScreen(0.02, 8.1, 3.15).y}
            stroke="#4A2E1B"
            strokeWidth="2.5"
          />
          <line
            x1={isoToScreen(0.02, 7.0, 2.15).x}
            y1={isoToScreen(0.02, 7.0, 2.15).y}
            x2={isoToScreen(0.02, 9.2, 2.15).x}
            y2={isoToScreen(0.02, 9.2, 2.15).y}
            stroke="#4A2E1B"
            strokeWidth="2.2"
          />

          {/* Framed Botanical Art & Brass Sconce */}
          <polygon
            points={isoPolygon([
              [0.02, 1.15, 1.65],
              [0.02, 2.05, 1.65],
              [0.02, 2.05, 2.65],
              [0.02, 1.15, 2.65],
            ])}
            fill="#F7EFE2"
            stroke="#4A2E1B"
            strokeWidth="2"
          />
          {(() => {
            const artCenter = isoToScreen(0.02, 1.6, 2.15);
            const sconcePos = isoToScreen(0.05, 2.55, 2.5);
            return (
              <g>
                <path
                  d={`M ${artCenter.x},${artCenter.y + 10} Q ${artCenter.x - 3},${artCenter.y - 4} ${artCenter.x + 2},${artCenter.y - 12}`}
                  fill="none"
                  stroke="#3E6B4E"
                  strokeWidth="1.8"
                />
                <circle cx={artCenter.x - 3} cy={artCenter.y - 3} r="3.5" fill="#4D805F" />
                <circle cx={artCenter.x + 3} cy={artCenter.y - 6} r="3" fill="#5B946E" />
                <circle cx={sconcePos.x} cy={sconcePos.y} r="22" fill="url(#warmLampHalo)" opacity="0.8" />
                <polygon
                  points={`${sconcePos.x - 5},${sconcePos.y} ${sconcePos.x + 5},${sconcePos.y} ${sconcePos.x + 8},${sconcePos.y + 8} ${sconcePos.x - 8},${sconcePos.y + 8}`}
                  fill="#D48C46"
                  stroke="#5C361E"
                  strokeWidth="0.8"
                />
              </g>
            );
          })()}
        </g>

        {/* BACK-RIGHT (NE) WALL */}
        <g>
          <polygon
            points={isoPolygon([
              [0, -0.25, WALL_H],
              [ROOM_SIZE, -0.25, WALL_H],
              [ROOM_SIZE, 0, WALL_H],
              [0, 0, WALL_H],
            ])}
            fill="#7A4F2E"
            stroke="#3B2314"
            strokeWidth="1"
          />
          <polygon
            points={isoPolygon([
              [0, 0, 0],
              [ROOM_SIZE, 0, 0],
              [ROOM_SIZE, 0, WALL_H],
              [0, 0, WALL_H],
            ])}
            fill="url(#neWallGrad)"
            stroke="#593820"
            strokeWidth="1.2"
          />
          <polygon
            points={isoPolygon([
              [0, 0, 0],
              [ROOM_SIZE, 0, 0],
              [ROOM_SIZE, 0, 1.05],
              [0, 0, 1.05],
            ])}
            fill={theme.wainscotColor}
            stroke="#182620"
            strokeWidth="1"
          />
          <polygon
            points={isoPolygon([
              [0, 0, 1.02],
              [ROOM_SIZE, 0, 1.02],
              [ROOM_SIZE, 0, 1.12],
              [0, 0, 1.12],
            ])}
            fill="#4D2E18"
          />

          {/* Hearth Fireplace */}
          {(() => {
            const fpBox = isoBoxFaces(1.55, 0, 0, 1.65, 0.45, 1.75);
            const fireboxCenter = isoToScreen(2.38, 0.46, 0.35);
            const clockPos = isoToScreen(2.38, 0.05, 2.65);
            return (
              <g>
                <ellipse
                  cx={fireboxCenter.x}
                  cy={fireboxCenter.y + 18}
                  rx={isFireplaceActive ? 75 : 45}
                  ry={isFireplaceActive ? 40 : 24}
                  fill="url(#fireplaceFloorGlow)"
                  className={!reducedMotion ? 'lamp-breathe' : ''}
                />
                <polygon points={fpBox.leftFace} fill="#7A3E2E" stroke="#3D1C14" strokeWidth="1" />
                <polygon points={fpBox.rightFace} fill="#633022" stroke="#3D1C14" strokeWidth="1" />
                <polygon points={fpBox.top} fill="#5C381E" stroke="#2E1A0D" strokeWidth="1.2" />

                <polygon
                  points={isoPolygon([
                    [1.85, 0.46, 0],
                    [2.9, 0.46, 0],
                    [2.9, 0.46, 1.05],
                    [1.85, 0.46, 1.05],
                  ])}
                  fill="#1A120E"
                  stroke="#362822"
                  strokeWidth="1.5"
                />
                <g transform={`translate(${fireboxCenter.x}, ${fireboxCenter.y})`}>
                  <line x1="-12" y1="6" x2="10" y2="2" stroke="#4A2816" strokeWidth="4" strokeLinecap="round" />
                  <line x1="-10" y1="2" x2="12" y2="7" stroke="#3B1E10" strokeWidth="4" strokeLinecap="round" />
                  <g
                    className={!reducedMotion ? 'flame-flicker' : ''}
                    opacity={isFireplaceActive ? 1 : 0.65}
                  >
                    <path d="M -8,4 C -10,-10 0,-18 0,-24 C 2,-16 10,-10 8,4 Z" fill="#E86F2C" />
                    <path d="M -4,4 C -5,-6 1,-12 1,-16 C 3,-10 6,-6 4,4 Z" fill="#FFD15C" />
                  </g>
                </g>

                <circle
                  cx={clockPos.x}
                  cy={clockPos.y}
                  r="14"
                  fill="#FBF2E3"
                  stroke="#6E4423"
                  strokeWidth="2.8"
                />
                <line x1={clockPos.x} y1={clockPos.y} x2={clockPos.x} y2={clockPos.y - 8} stroke="#2B1A0E" strokeWidth="1.5" strokeLinecap="round" />
                <line x1={clockPos.x} y1={clockPos.y} x2={clockPos.x + 6} y2={clockPos.y + 3} stroke="#2B1A0E" strokeWidth="1.3" strokeLinecap="round" />
              </g>
            );
          })()}

          {/* Chalkboard Roastery Menu Sign */}
          <polygon
            points={isoPolygon([
              [5.1, 0.05, 2.7],
              [7.5, 0.05, 2.7],
              [7.5, 0.05, 3.42],
              [5.1, 0.05, 3.42],
            ])}
            fill="#1E2824"
            stroke="#7A4E2D"
            strokeWidth="2.2"
          />
          {(() => {
            const menuCenter = isoToScreen(6.3, 0.05, 3.06);
            return (
              <g transform={`translate(${menuCenter.x}, ${menuCenter.y}) skewY(28)`}>
                <text
                  x="0"
                  y="3"
                  textAnchor="middle"
                  fill="#F5DFB8"
                  fontSize="7.2"
                  fontFamily="Fraunces, serif"
                  letterSpacing="1.2"
                >
                  ESPRESSO • POUR OVER • PATISSERIE
                </text>
              </g>
            );
          })()}
        </g>

        {/* FRONT-LEFT (SW) CUTAWAY WINDOW & ENTRANCE WALL */}
        <g className="pointer-events-none">
          <polygon
            points={isoPolygon([
              [0, ROOM_SIZE, 0],
              [8.0, ROOM_SIZE, 0],
              [8.0, ROOM_SIZE, 0.42],
              [0, ROOM_SIZE, 0.42],
            ])}
            fill={theme.wainscotColor}
            stroke="#1C2E26"
            strokeWidth="1.2"
          />
          <polygon
            points={isoPolygon([
              [0, ROOM_SIZE, 0.42],
              [8.0, ROOM_SIZE, 0.42],
              [8.0, ROOM_SIZE + 0.18, 0.42],
              [0, ROOM_SIZE + 0.18, 0.42],
            ])}
            fill="#6E472B"
          />
          <polygon
            points={isoPolygon([
              [4.6, ROOM_SIZE, 0.42],
              [7.6, ROOM_SIZE, 0.42],
              [7.6, ROOM_SIZE, 2.15],
              [4.6, ROOM_SIZE, 2.15],
            ])}
            fill="rgba(255, 244, 219, 0.09)"
            stroke="rgba(110, 71, 43, 0.55)"
            strokeWidth="2"
          />

          {isRaining && (
            <g opacity="0.55">
              {[7.3, 7.7, 8.1, 8.5, 8.9].map((wy, i) => {
                const pTop = isoToScreen(0.05, wy, 2.9);
                const pBot = isoToScreen(0.05, wy - 0.15, 1.4);
                return (
                  <line
                    key={`rain-nw-${i}`}
                    x1={pTop.x}
                    y1={pTop.y}
                    x2={pBot.x}
                    y2={pBot.y}
                    stroke="#CFE3F5"
                    strokeWidth="1.3"
                    strokeDasharray="6 8"
                    className={!reducedMotion ? 'rain-streak' : ''}
                  />
                );
              })}
              {[5.0, 5.6, 6.2, 6.8, 7.3].map((wx, i) => {
                const pTop = isoToScreen(wx, ROOM_SIZE, 2.0);
                const pBot = isoToScreen(wx, ROOM_SIZE, 0.6);
                return (
                  <line
                    key={`rain-sw-${i}`}
                    x1={pTop.x}
                    y1={pTop.y}
                    x2={pBot.x}
                    y2={pBot.y}
                    stroke="#CFE3F5"
                    strokeWidth="1.2"
                    strokeDasharray="5 9"
                    className={!reducedMotion ? 'rain-streak' : ''}
                  />
                );
              })}
            </g>
          )}
        </g>

        {/* ================= 4. SLANTED GOLDEN SUNBEAMS ================= */}
        <g opacity={sunbeamOpacity} className="pointer-events-none">
          <polygon
            points={isoPolygon([
              [0.1, 7.0, 2.4],
              [0.1, 9.1, 2.4],
              [4.5, 9.1, 0.02],
              [4.5, 7.0, 0.02],
            ])}
            fill="url(#sunbeamGrad)"
          />
          <polygon
            points={isoPolygon([
              [4.7, 9.9, 1.8],
              [7.4, 9.9, 1.8],
              [7.4, 6.8, 0.02],
              [4.7, 6.8, 0.02],
            ])}
            fill="url(#sunbeamGrad)"
          />
        </g>

        {/* ================= 5. INTERIOR ARCHITECTURAL ZONES & PLANTS ================= */}
        <IsoBookshelfUnit reducedMotion={reducedMotion} />
        <IsoPlant isoX={0.8} isoY={0.85} scale={1} variant="fiddle" reducedMotion={reducedMotion} />
        <IsoEspressoCounter reducedMotion={reducedMotion} />
        <IsoPlant isoX={9.05} isoY={1.55} scale={0.95} variant="monstera" reducedMotion={reducedMotion} />
        <IsoPlant isoX={1.15} isoY={9.25} scale={0.95} variant="fiddle" reducedMotion={reducedMotion} />

        {/* Shared Communal Table Base (seats central-1..4 sit around it) */}
        <IsoCommunalTableBase />

        {/* Social Lounge Coffee Table, Rug & Brass Floor Lamp (seats lounge-1..2 sit around it) */}
        <IsoSocialLoungeCornerBase />

        {/* ================= 6. TWELVE INTERACTIVE SEATING STATIONS & SEATED AVATARS ================= */}
        {sortedSeats.map((seat) => {
          const occupant = seatOccupants.get(seat.id) || null;
          const isSelfSeatedHere = selectedSeatId === seat.id;
          const isHovered = hoveredSeatId === seat.id;
          const hasSomeoneSeated = Boolean(occupant || isSelfSeatedHere);

          return (
            <IsoSeatStation
              key={seat.id}
              seat={seat}
              occupant={occupant}
              isSelfSeatedHere={isSelfSeatedHere}
              isHovered={isHovered}
              anySeatSelected={selectedSeatId !== null}
              reducedMotion={reducedMotion}
              onSelect={onSelectSeat}
              onHoverChange={onHoverSeat}
            >
              {/* Render Laptop & Steaming Coffee for any occupied seat */}
              <SeatedWorkspaceItems
                x={seat.tableScreenX}
                y={seat.tableScreenY}
                facing={seat.laptopFacing}
                isSeated={hasSomeoneSeated}
                isTimerRunning={isSelfSeatedHere ? isTimerRunning : true}
                currentGoal={
                  isSelfSeatedHere
                    ? currentGoal
                    : occupant?.focusGoal || ''
                }
                reducedMotion={shouldSkipAnim}
                onSipCoffee={isSelfSeatedHere ? onSipCoffee : undefined}
              />

              {/* Render Visitor SVG Avatar Seated at This Seat */}
              {occupant && (
                <IsoAvatar
                  visitor={occupant}
                  x={seat.avatarScreenX}
                  y={seat.avatarScreenY - 12}
                  isSelf={occupant.userId === selfUserId}
                  isSeated={true}
                  activeReaction={activeReactions[occupant.userId] || null}
                  reducedMotion={reducedMotion}
                  onSelectVisitor={onSelectVisitor}
                />
              )}
            </IsoSeatStation>
          );
        })}

        {/* ================= 7. STANDING VISITORS IN RECEPTION AREA ================= */}
        {standingVisitors.map((visitor, idx) => {
          const standIsoX = 8.4 - (idx % 3) * 0.65;
          const standIsoY = 8.9 - Math.floor(idx / 3) * 0.65;
          const pt = isoToScreen(standIsoX, standIsoY, 0);
          return (
            <IsoAvatar
              key={visitor.userId}
              visitor={visitor}
              x={pt.x}
              y={pt.y}
              isSelf={visitor.userId === selfUserId}
              isSeated={false}
              activeReaction={activeReactions[visitor.userId] || null}
              reducedMotion={reducedMotion}
              onSelectVisitor={onSelectVisitor}
            />
          );
        })}

        {/* ================= 8. FOREGROUND HANGING PENDANT LIGHTS ================= */}
        <IsoHangingLamp isoX={2.1} isoY={2.3} cordTopZ={3.9} lampZ={2.55} reducedMotion={reducedMotion} />
        <IsoHangingLamp isoX={5.2} isoY={5.2} cordTopZ={4.1} lampZ={2.75} reducedMotion={reducedMotion} />
        <IsoHangingLamp isoX={6.4} isoY={2.2} cordTopZ={3.9} lampZ={2.6} reducedMotion={reducedMotion} />
        <IsoHangingLamp isoX={2.5} isoY={8.1} cordTopZ={3.9} lampZ={2.65} reducedMotion={reducedMotion} />
      </svg>
    </div>
  );
};

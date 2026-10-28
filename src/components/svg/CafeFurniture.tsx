import React from 'react';
import { SeatConfig, SeatId, VisitorPresence } from '../../types';
import { isoBoxFaces, isoPolygon, isoToScreen } from '../../utils/isometric';

/**
 * Tall Floor-to-Ceiling Walnut Bookshelf along the Back-Left (NW) wall
 * complete with rows of colorful books, ceramic vessels, plants, and Marmalade the sleeping ginger cat.
 */
export const IsoBookshelfUnit: React.FC<{ reducedMotion: boolean }> = React.memo(
  ({ reducedMotion }) => {
    const x = 0.15;
    const y = 3.2;
    const dx = 0.78;
    const dy = 3.2;
    const dz = 2.95;

    const outer = isoBoxFaces(x, y, 0, dx, dy, dz);
    const shelfZ = [0.65, 1.3, 1.95, 2.55];
    const catPos = isoToScreen(1.25, 4.3, 0.02);

    return (
      <g className="select-none">
        <polygon
          points={isoPolygon([
            [x, y, 0.01],
            [x + dx + 0.35, y, 0.01],
            [x + dx + 0.35, y + dy, 0.01],
            [x, y + dy, 0.01],
          ])}
          fill="rgba(18, 10, 5, 0.35)"
        />

        <polygon points={outer.leftFace} fill="#4A2E1B" stroke="#311D10" strokeWidth="1" />
        <polygon points={outer.rightFace} fill="#3B2314" stroke="#2A180D" strokeWidth="1.2" />
        <polygon points={outer.top} fill="#6E472B" stroke="#3B2314" strokeWidth="1" />

        {shelfZ.map((sz, idx) => {
          const shelfLine = isoPolygon([
            [x + dx, y + 0.08, sz],
            [x + dx, y + dy - 0.08, sz],
            [x + dx, y + dy - 0.08, sz - 0.08],
            [x + dx, y + 0.08, sz - 0.08],
          ]);

          const bookColors = [
            ['#C85A32', '#D99B26', '#4E7D6B', '#8C4A32', '#D4C5B9', '#5A6B82'],
            ['#6B8E78', '#C27D38', '#9E3B33', '#E3C58E', '#4F5D75', '#B5654D'],
            ['#D48C46', '#5E7A68', '#8A3E36', '#DFCFAF', '#4A6274', '#C86D51'],
            ['#789482', '#C98A3A', '#A8483B', '#E8D6B5', '#5C6F84', '#B85A40'],
          ][idx];

          return (
            <g key={sz}>
              <polygon points={shelfLine} fill="#694226" stroke="#2E1B0E" strokeWidth="0.7" />
              {bookColors.map((color, bIdx) => {
                const by = y + 0.25 + bIdx * 0.45;
                const bh = 0.36 + (bIdx % 2) * 0.08;
                const bw = 0.22;
                const p1 = isoToScreen(x + dx - 0.02, by, sz);
                const p2 = isoToScreen(x + dx - 0.02, by + bw, sz);
                const p3 = isoToScreen(x + dx - 0.02, by + bw, sz + bh);
                const p4 = isoToScreen(x + dx - 0.02, by, sz + bh);
                return (
                  <polygon
                    key={bIdx}
                    points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`}
                    fill={color}
                    stroke="#2A180D"
                    strokeWidth="0.5"
                  />
                );
              })}
            </g>
          );
        })}

        {/* Trailing Pothos Vine */}
        {(() => {
          const vineTop = isoToScreen(x + dx, y + 0.4, dz);
          return (
            <g transform={`translate(${vineTop.x}, ${vineTop.y})`}>
              <g className={!reducedMotion ? 'plant-sway' : ''}>
                <ellipse cx="0" cy="-4" rx="8" ry="5" fill="#B86242" stroke="#7A3E26" strokeWidth="0.8" />
                <path
                  d="M -2,0 C -8,12 -3,26 -7,38"
                  fill="none"
                  stroke="#3D6B4F"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M 2,1 C 6,14 1,28 4,44"
                  fill="none"
                  stroke="#4D8060"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle cx="-5" cy="10" r="3.8" fill="#5E9A74" />
                <circle cx="-4" cy="22" r="3.4" fill="#4D8060" />
                <circle cx="-6" cy="34" r="3" fill="#6AA881" />
                <circle cx="4" cy="13" r="3.6" fill="#6AA881" />
                <circle cx="3" cy="26" r="3.3" fill="#4D8060" />
                <circle cx="4" cy="39" r="2.8" fill="#5E9A74" />
              </g>
            </g>
          );
        })()}

        {/* Marmalade — The Sleeping Ginger Cat */}
        <g transform={`translate(${catPos.x}, ${catPos.y})`}>
          <title>Marmalade — The Café Cat (NPC)</title>
          <ellipse cx="0" cy="2" rx="22" ry="12" fill="#9E523B" stroke="#D9B382" strokeWidth="1.2" />
          <ellipse
            cx="0"
            cy="2"
            rx="15"
            ry="8"
            fill="#B86B4B"
            stroke="#E6C9A2"
            strokeWidth="0.7"
            strokeDasharray="3 2"
          />
          <g className={!reducedMotion ? 'cat-breathe' : ''}>
            <ellipse cx="-1" cy="0" rx="10" ry="6.5" fill="#D97F38" stroke="#8C4918" strokeWidth="0.8" />
            <path d="M -5,-5 C -3,-2 -3,2 -5,5" fill="none" stroke="#9E4F19" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M -1,-6 C 1,-2 1,2 -1,5" fill="none" stroke="#9E4F19" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="6.5" cy="1" r="5" fill="#E38B42" stroke="#8C4918" strokeWidth="0.7" />
            <polygon points="4,-3 6,-7 8.5,-3" fill="#C96A28" />
            <polygon points="7.5,-2 10.5,-5.5 11,-1" fill="#C96A28" />
            <path
              d="M -10,2 C -15,5 -12,9 -5,7"
              fill="none"
              stroke="#D97F38"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            {!reducedMotion && (
              <text
                x="12"
                y="-6"
                fill="#F5E6D3"
                fontSize="7"
                fontFamily="Fraunces, serif"
                fontStyle="italic"
                opacity="0.7"
                className="steam-wisp-1"
              >
                z
              </text>
            )}
          </g>
        </g>
      </g>
    );
  }
);

/**
 * Artisan Roastery & Espresso Counter along the Back-Right (NE/SE) area.
 */
export const IsoEspressoCounter: React.FC<{ reducedMotion: boolean }> = React.memo(
  ({ reducedMotion }) => {
    const x = 4.4;
    const y = 1.25;
    const dx = 3.8;
    const dy = 1.15;
    const dz = 1.05;

    const counterFaces = isoBoxFaces(x, y, 0, dx, dy, dz);
    const topSlab = isoBoxFaces(x - 0.08, y - 0.08, dz, dx + 0.16, dy + 0.22, 0.1);

    const espX = 5.1;
    const espY = 1.45;
    const espFaces = isoBoxFaces(espX, espY, dz + 0.1, 1.15, 0.72, 0.68);
    const espScreen = isoToScreen(espX + 0.55, espY + 0.4, dz + 0.78);

    const grinderScreen = isoToScreen(6.65, 1.65, dz + 0.15);

    const pastryFaces = isoBoxFaces(7.15, 1.45, dz + 0.1, 0.9, 0.75, 0.48);
    const pastryCenter = isoToScreen(7.6, 1.85, dz + 0.28);

    const baristaPos = isoToScreen(6.35, 0.95, 1.48);

    const backShelf1 = isoPolygon([
      [4.4, 0.22, 1.85],
      [8.2, 0.22, 1.85],
      [8.2, 0.55, 1.85],
      [4.4, 0.55, 1.85],
    ]);
    const backShelf2 = isoPolygon([
      [4.4, 0.22, 2.45],
      [8.2, 0.22, 2.45],
      [8.2, 0.55, 2.45],
      [4.4, 0.55, 2.45],
    ]);

    return (
      <g className="select-none">
        <polygon points={backShelf1} fill="#6E472B" stroke="#362011" strokeWidth="1" />
        <polygon points={backShelf2} fill="#6E472B" stroke="#362011" strokeWidth="1" />
        {[4.8, 5.4, 6.1, 6.8, 7.5].map((sx, idx) => {
          const jar1 = isoToScreen(sx, 0.35, 1.9);
          const jar2 = isoToScreen(sx + 0.15, 0.35, 2.5);
          return (
            <g key={idx}>
              <rect
                x={jar1.x - 5}
                y={jar1.y - 12}
                width="10"
                height="12"
                rx="2"
                fill={idx % 2 === 0 ? '#E8D8C5' : '#C86D51'}
                stroke="#3B2314"
                strokeWidth="0.7"
              />
              <rect x={jar1.x - 4} y={jar1.y - 14} width="8" height="2.5" rx="1" fill="#4A2E1B" />
              <rect
                x={jar2.x - 4}
                y={jar2.y - 11}
                width="8"
                height="11"
                rx="3"
                fill={idx % 2 === 0 ? '#D48C46' : '#6A8D7B'}
                stroke="#2E1B0E"
                strokeWidth="0.6"
              />
            </g>
          );
        })}

        {/* Henri — Master Roaster & Barista (NPC) */}
        <g transform={`translate(${baristaPos.x}, ${baristaPos.y})`}>
          <title>Henri — Master Roaster &amp; Barista (Café Staff)</title>
          <path
            d="M -13,18 C -13,2 13,2 13,18 Z"
            fill="#E8DEC8"
            stroke="#4A3525"
            strokeWidth="0.9"
          />
          <path
            d="M -8,6 L 8,6 L 10,18 L -10,18 Z"
            fill="#4A6B5B"
            stroke="#2C4237"
            strokeWidth="0.8"
          />
          <circle cx="0" cy="-3" r="7.5" fill="#F2C6A0" stroke="#5C3D28" strokeWidth="0.8" />
          <path d="M -8,-5 C -8,-13 8,-13 8,-5 Z" fill="#6E3B26" />
          <circle cx="-2.5" cy="-2.5" r="2.1" fill="none" stroke="#3B2314" strokeWidth="0.8" />
          <circle cx="2.8" cy="-2.5" r="2.1" fill="none" stroke="#3B2314" strokeWidth="0.8" />
          <path
            d="M -1.5,1.5 Q 0,3 2,1.5"
            fill="none"
            stroke="#5C3D28"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
        </g>

        <polygon
          points={isoPolygon([
            [x - 0.1, y - 0.1, 0.01],
            [x + dx + 0.18, y - 0.1, 0.01],
            [x + dx + 0.18, y + dy + 0.28, 0.01],
            [x - 0.1, y + dy + 0.28, 0.01],
          ])}
          fill="rgba(15, 9, 5, 0.42)"
        />

        <polygon points={counterFaces.leftFace} fill="#5C3820" stroke="#301C0E" strokeWidth="1" />
        <polygon points={counterFaces.rightFace} fill="#472A17" stroke="#301C0E" strokeWidth="1" />

        {[0.4, 0.85, 1.3, 1.75, 2.2, 2.65, 3.1, 3.5].map((offset) => {
          const pTop = isoToScreen(x + offset, y + dy, dz);
          const pBot = isoToScreen(x + offset, y + dy, 0.08);
          return (
            <line
              key={offset}
              x1={pTop.x}
              y1={pTop.y}
              x2={pBot.x}
              y2={pBot.y}
              stroke="#7A4D2E"
              strokeWidth="2.2"
            />
          );
        })}

        <polygon points={topSlab.leftFace} fill="#C9B39B" stroke="#7A6550" strokeWidth="0.8" />
        <polygon points={topSlab.rightFace} fill="#B09880" stroke="#7A6550" strokeWidth="0.8" />
        <polygon points={topSlab.top} fill="#EAE0D3" stroke="#9C8670" strokeWidth="1" />

        {/* Espresso Machine */}
        <g>
          <polygon points={espFaces.leftFace} fill="#B86B3D" stroke="#4D2913" strokeWidth="0.9" />
          <polygon points={espFaces.rightFace} fill="#8F4E27" stroke="#4D2913" strokeWidth="0.9" />
          <polygon points={espFaces.top} fill="#D8C8B4" stroke="#6E5A47" strokeWidth="0.9" />

          {[-12, 6].map((offsetX, i) => (
            <g key={i} transform={`translate(${espScreen.x + offsetX}, ${espScreen.y + 16})`}>
              <rect x="-4" y="-3" width="8" height="5" rx="1" fill="#3B2F2A" />
              <line x1="0" y1="1" x2="-7" y2="8" stroke="#261E1B" strokeWidth="2.2" strokeLinecap="round" />
              <ellipse cx="0" cy="8" rx="3.5" ry="2.2" fill="#FFFDF9" stroke="#B5A38F" strokeWidth="0.6" />
            </g>
          ))}

          <circle
            cx={espScreen.x - 3}
            cy={espScreen.y + 8}
            r="3.2"
            fill="#FFF8EB"
            stroke="#4D2913"
            strokeWidth="0.8"
          />
          <circle
            cx={espScreen.x + 12}
            cy={espScreen.y + 7}
            r="1.6"
            fill="#E56B4E"
            className={!reducedMotion ? 'animate-pulse' : ''}
          />

          <ellipse cx={espScreen.x - 8} cy={espScreen.y - 2} rx="4" ry="2.5" fill="#F7EFE6" stroke="#B5A38F" strokeWidth="0.6" />
          <ellipse cx={espScreen.x} cy={espScreen.y - 4} rx="4" ry="2.5" fill="#F7EFE6" stroke="#B5A38F" strokeWidth="0.6" />

          {!reducedMotion && (
            <g transform={`translate(${espScreen.x - 16}, ${espScreen.y + 14})`}>
              <path
                d="M 0,0 C -5,-7 3,-14 -2,-22"
                fill="none"
                stroke="#FFF8EB"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="steam-wisp-1"
              />
              <path
                d="M 3,-2 C 7,-9 -1,-16 3,-24"
                fill="none"
                stroke="#FFF8EB"
                strokeWidth="1.2"
                strokeLinecap="round"
                className="steam-wisp-2"
              />
            </g>
          )}
        </g>

        {/* Grinder */}
        <g transform={`translate(${grinderScreen.x}, ${grinderScreen.y})`}>
          <rect x="-6" y="-12" width="12" height="14" rx="2" fill="#2E2927" stroke="#1A1615" strokeWidth="0.8" />
          <path
            d="M -7,-24 L 7,-24 L 5,-12 L -5,-12 Z"
            fill="rgba(212, 140, 70, 0.45)"
            stroke="#8C6239"
            strokeWidth="0.8"
          />
          <ellipse cx="0" cy="-16" rx="4.5" ry="2.5" fill="#4A2C18" />
          <ellipse cx="0" cy="-24" rx="7" ry="2.8" fill="#3B2314" />
        </g>

        {/* Pastry Display Cloche */}
        <g>
          <polygon
            points={isoPolygon([
              [7.15, 1.45, dz + 0.1],
              [8.05, 1.45, dz + 0.1],
              [8.05, 2.2, dz + 0.1],
              [7.15, 2.2, dz + 0.1],
            ])}
            fill="#8C5834"
            stroke="#4A2C18"
            strokeWidth="0.8"
          />
          <g transform={`translate(${pastryCenter.x}, ${pastryCenter.y})`}>
            <ellipse cx="-7" cy="2" rx="5.5" ry="3.2" fill="#E39D42" stroke="#9E621B" strokeWidth="0.6" />
            <ellipse cx="4" cy="-2" rx="5.5" ry="3.2" fill="#E39D42" stroke="#9E621B" strokeWidth="0.6" />
            <circle cx="5" cy="5" r="4" fill="#D9534F" stroke="#F2C894" strokeWidth="1.2" />
          </g>
          <polygon
            points={pastryFaces.leftFace}
            fill="rgba(245, 238, 225, 0.25)"
            stroke="rgba(255, 248, 235, 0.65)"
            strokeWidth="0.8"
          />
          <polygon
            points={pastryFaces.rightFace}
            fill="rgba(235, 225, 210, 0.2)"
            stroke="rgba(255, 248, 235, 0.65)"
            strokeWidth="0.8"
          />
          <polygon
            points={pastryFaces.top}
            fill="rgba(255, 250, 240, 0.32)"
            stroke="rgba(255, 248, 235, 0.75)"
            strokeWidth="0.9"
          />
        </g>
      </g>
    );
  }
);

/**
 * Shared Communal Oak Table Base (in center of the room; seats central-1..4 sit around it).
 */
export const IsoCommunalTableBase: React.FC = React.memo(() => {
  const baseScreen = isoToScreen(5.2, 5.2, 0);
  const tableTopScreen = { x: 800, y: 516 };

  return (
    <g className="select-none pointer-events-none">
      <ellipse cx={baseScreen.x} cy={baseScreen.y + 4} rx="58" ry="32" fill="rgba(15, 9, 5, 0.42)" />
      {/* 4 sturdy wooden legs */}
      <line
        x1={baseScreen.x - 38}
        y1={tableTopScreen.y + 4}
        x2={baseScreen.x - 38}
        y2={baseScreen.y + 4}
        stroke="#4A2E1B"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <line
        x1={baseScreen.x + 38}
        y1={tableTopScreen.y + 4}
        x2={baseScreen.x + 38}
        y2={baseScreen.y + 4}
        stroke="#4A2E1B"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <line
        x1={baseScreen.x}
        y1={tableTopScreen.y + 22}
        x2={baseScreen.x}
        y2={baseScreen.y + 20}
        stroke="#3B2314"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* Large Isometric Honey-Oak Table Top */}
      <polygon
        points={`
          ${tableTopScreen.x},${tableTopScreen.y - 32}
          ${tableTopScreen.x + 64},${tableTopScreen.y}
          ${tableTopScreen.x},${tableTopScreen.y + 32}
          ${tableTopScreen.x - 64},${tableTopScreen.y}
        `}
        fill="#C98A4B"
        stroke="#5C381E"
        strokeWidth="1.2"
      />
      <polygon
        points={`
          ${tableTopScreen.x - 64},${tableTopScreen.y}
          ${tableTopScreen.x},${tableTopScreen.y + 32}
          ${tableTopScreen.x},${tableTopScreen.y + 38}
          ${tableTopScreen.x - 64},${tableTopScreen.y + 6}
        `}
        fill="#9E6530"
      />
      <polygon
        points={`
          ${tableTopScreen.x},${tableTopScreen.y + 32}
          ${tableTopScreen.x + 64},${tableTopScreen.y}
          ${tableTopScreen.x + 64},${tableTopScreen.y + 6}
          ${tableTopScreen.x},${tableTopScreen.y + 38}
        `}
        fill="#7D4E22"
      />

      {/* Centerpiece Ceramic Vase with Eucalyptus */}
      <g transform={`translate(${tableTopScreen.x}, ${tableTopScreen.y - 2})`}>
        <ellipse cx="0" cy="-4" rx="4.5" ry="6" fill="#DFC7B0" stroke="#8C735B" strokeWidth="0.7" />
        <path d="M -1,-9 C -5,-15 -3,-19 -6,-22" fill="none" stroke="#5A826A" strokeWidth="1.3" />
        <path d="M 0,-9 C 4,-15 6,-18 4,-22" fill="none" stroke="#6B967C" strokeWidth="1.3" />
        <circle cx="-4" cy="-16" r="2.2" fill="#73A185" />
        <circle cx="3" cy="-16" r="2.2" fill="#5A826A" />
      </g>
    </g>
  );
});

/**
 * Social Lounge Corner Coffee Table & Brass Floor Lamp (between lounge-1 sofa & lounge-2 armchair).
 */
export const IsoSocialLoungeCornerBase: React.FC = React.memo(() => {
  const tablePos = isoToScreen(8.35, 6.0, 0);
  const lampPos = isoToScreen(9.1, 5.1, 0);

  return (
    <g className="select-none pointer-events-none">
      {/* Woven Jute Round Lounge Rug */}
      <ellipse
        cx={tablePos.x}
        cy={tablePos.y + 2}
        rx="68"
        ry="36"
        fill="#A67D54"
        stroke="#D9B88F"
        strokeWidth="1.4"
      />
      <ellipse
        cx={tablePos.x}
        cy={tablePos.y + 2}
        rx="52"
        ry="27"
        fill="none"
        stroke="#7D5A38"
        strokeWidth="0.9"
        strokeDasharray="4 3"
      />

      {/* Warm Standing Brass Floor Lamp */}
      <g transform={`translate(${lampPos.x}, ${lampPos.y})`}>
        <ellipse cx="0" cy="3" rx="11" ry="6" fill="#7A5224" stroke="#3B2310" strokeWidth="0.9" />
        <line x1="0" y1="2" x2="0" y2="-56" stroke="#C8934B" strokeWidth="2.2" />
        <circle cx="0" cy="-58" r="28" fill="url(#warmLampHalo)" opacity="0.78" />
        <polygon
          points="-9,-66 9,-66 14,-52 -14,-52"
          fill="#F5DFB8"
          stroke="#8C5D26"
          strokeWidth="0.9"
        />
      </g>

      {/* Low Walnut & Brass Social Coffee Table */}
      <g transform={`translate(${tablePos.x}, ${tablePos.y})`}>
        <ellipse cx="0" cy="5" rx="28" ry="15" fill="rgba(14, 9, 5, 0.38)" />
        <line x1="-14" y1="-8" x2="-16" y2="5" stroke="#3B2314" strokeWidth="2.5" />
        <line x1="14" y1="-8" x2="16" y2="5" stroke="#3B2314" strokeWidth="2.5" />
        <ellipse cx="0" cy="-10" rx="26" ry="14" fill="#BA7C42" stroke="#59361A" strokeWidth="1.1" />
        {/* Pour-over server & art magazine on lounge table */}
        <polygon points="-12,-10 -2,-14 5,-10 -5,-6" fill="#F4ECE1" stroke="#8C735B" strokeWidth="0.6" />
        <circle cx="9" cy="-11" r="3.5" fill="#C86D51" />
      </g>
    </g>
  );
});

/**
 * Reusable Isometric Potted Plant.
 */
export const IsoPlant: React.FC<{
  isoX: number;
  isoY: number;
  scale?: number;
  variant?: 'fiddle' | 'monstera';
  reducedMotion?: boolean;
}> = React.memo(({ isoX, isoY, scale = 1, variant = 'fiddle', reducedMotion = false }) => {
  const pos = isoToScreen(isoX, isoY, 0);

  return (
    <g
      transform={`translate(${pos.x}, ${pos.y}) scale(${scale})`}
      className="select-none pointer-events-none"
    >
      <ellipse cx="0" cy="4" rx="18" ry="10" fill="rgba(16, 10, 5, 0.34)" />
      <path
        d="M -12,-18 L -9,3 C -5,7 5,7 9,3 L 12,-18 Z"
        fill="#C86D51"
        stroke="#7D3E29"
        strokeWidth="1"
      />
      <ellipse cx="0" cy="-18" rx="13" ry="6.5" fill="#D98266" stroke="#7D3E29" strokeWidth="0.9" />
      <ellipse cx="0" cy="-18" rx="10.5" ry="5" fill="#3D2618" />

      <g className={!reducedMotion ? 'plant-sway' : ''}>
        {variant === 'fiddle' ? (
          <>
            <path d="M 0,-18 C -2,-36 -6,-52 -10,-68" fill="none" stroke="#5C3D28" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M 0,-18 C 3,-34 8,-48 11,-62" fill="none" stroke="#5C3D28" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M 0,-32 C 0,-48 -1,-62 0,-76" fill="none" stroke="#5C3D28" strokeWidth="2" strokeLinecap="round" />
            {[
              { cx: -12, cy: -42, rx: 11, ry: 6.5, rot: -25, fill: '#3E6B4E' },
              { cx: 12, cy: -38, rx: 11, ry: 6.5, rot: 22, fill: '#4D805F' },
              { cx: -14, cy: -58, rx: 12, ry: 7, rot: -18, fill: '#5B946E' },
              { cx: 13, cy: -54, rx: 12, ry: 7, rot: 25, fill: '#3E6B4E' },
              { cx: -8, cy: -70, rx: 10, ry: 6, rot: -12, fill: '#6AA37D' },
              { cx: 9, cy: -66, rx: 10, ry: 6, rot: 14, fill: '#5B946E' },
              { cx: 0, cy: -78, rx: 11, ry: 6.5, rot: -4, fill: '#76B089' },
            ].map((leaf, i) => (
              <g key={i} transform={`translate(${leaf.cx}, ${leaf.cy}) rotate(${leaf.rot})`}>
                <ellipse cx="0" cy="0" rx={leaf.rx} ry={leaf.ry} fill={leaf.fill} stroke="#284A34" strokeWidth="0.8" />
                <line x1={-leaf.rx + 3} y1="0" x2={leaf.rx - 3} y2="0" stroke="#8CC49E" strokeWidth="0.7" opacity="0.7" />
              </g>
            ))}
          </>
        ) : (
          <>
            <path d="M 0,-18 C -8,-30 -16,-38 -22,-46" fill="none" stroke="#3E6B4E" strokeWidth="2.2" />
            <path d="M 0,-18 C 9,-30 16,-40 22,-48" fill="none" stroke="#3E6B4E" strokeWidth="2.2" />
            <path d="M 0,-18 C 0,-34 1,-46 0,-56" fill="none" stroke="#3E6B4E" strokeWidth="2.2" />
            <ellipse cx="-18" cy="-42" rx="13" ry="8" transform="rotate(-28 -18 -42)" fill="#4D805F" stroke="#284A34" strokeWidth="0.8" />
            <ellipse cx="18" cy="-44" rx="13" ry="8" transform="rotate(28 18 -44)" fill="#5B946E" stroke="#284A34" strokeWidth="0.8" />
            <ellipse cx="0" cy="-52" rx="14" ry="8.5" fill="#6AA37D" stroke="#284A34" strokeWidth="0.8" />
            <ellipse cx="-8" cy="-32" rx="11" ry="6.5" transform="rotate(-15 -8 -32)" fill="#3E6B4E" stroke="#284A34" strokeWidth="0.8" />
            <ellipse cx="9" cy="-32" rx="11" ry="6.5" transform="rotate(15 9 -32)" fill="#4D805F" stroke="#284A34" strokeWidth="0.8" />
          </>
        )}
      </g>
    </g>
  );
});

/**
 * Warm Brass & Opal Glass Hanging Pendant Light descending from the ceiling.
 */
export const IsoHangingLamp: React.FC<{
  isoX: number;
  isoY: number;
  cordTopZ?: number;
  lampZ?: number;
  reducedMotion?: boolean;
}> = React.memo(({ isoX, isoY, cordTopZ = 3.8, lampZ = 2.55, reducedMotion = false }) => {
  const topPos = isoToScreen(isoX, isoY, cordTopZ);
  const lampPos = isoToScreen(isoX, isoY, lampZ);

  return (
    <g className="pointer-events-none select-none">
      <ellipse cx={topPos.x} cy={topPos.y} rx="5" ry="2.5" fill="#8C6239" />
      <line
        x1={topPos.x}
        y1={topPos.y}
        x2={lampPos.x}
        y2={lampPos.y - 8}
        stroke="#3A2618"
        strokeWidth="1.4"
      />
      <polygon
        points={`${lampPos.x - 10},${lampPos.y} ${lampPos.x + 10},${lampPos.y} ${lampPos.x + 68},${lampPos.y + 115} ${lampPos.x - 68},${lampPos.y + 115}`}
        fill="url(#pendantConeGradient)"
        opacity="0.38"
        className={!reducedMotion ? 'lamp-breathe' : ''}
      />
      <circle cx={lampPos.x} cy={lampPos.y + 2} r="24" fill="url(#warmLampHalo)" opacity="0.75" />
      <path
        d={`M ${lampPos.x - 4},${lampPos.y - 8} L ${lampPos.x + 4},${lampPos.y - 8} L ${lampPos.x + 14},${lampPos.y} L ${lampPos.x - 14},${lampPos.y} Z`}
        fill="#D48C46"
        stroke="#6E3B1E"
        strokeWidth="0.9"
      />
      <ellipse cx={lampPos.x} cy={lampPos.y + 1.5} rx="6" ry="3.8" fill="#FFF4D2" />
    </g>
  );
});

interface IsoSeatStationProps {
  seat: SeatConfig;
  occupant: VisitorPresence | null;
  isSelfSeatedHere: boolean;
  isHovered: boolean;
  anySeatSelected: boolean;
  reducedMotion: boolean;
  onSelect: (seatId: SeatId) => void;
  onHoverChange: (seatId: SeatId | null) => void;
  children?: React.ReactNode;
}

/**
 * Renders one of the 12 interactive seating positions across the 3 Café Zones.
 * Visually distinguishes Available seats vs Occupied seats (and who is sitting there).
 */
export const IsoSeatStation: React.FC<IsoSeatStationProps> = React.memo(
  ({
    seat,
    occupant,
    isSelfSeatedHere,
    isHovered,
    anySeatSelected,
    reducedMotion,
    onSelect,
    onHoverChange,
    children,
  }) => {
    const baseScreen = isoToScreen(seat.isoX, seat.isoY, 0);
    const tableTopScreen = { x: seat.tableScreenX, y: seat.tableScreenY };
    const isOccupiedByOther = Boolean(occupant && !isSelfSeatedHere);
    const isOccupied = Boolean(occupant || isSelfSeatedHere);

    const chairShiftX = isOccupied
      ? seat.chairPullDx * 0.55
      : isHovered
      ? seat.chairPullDx * 0.35
      : 0;
    const chairShiftY = isOccupied
      ? seat.chairPullDy * 0.55
      : isHovered
      ? seat.chairPullDy * 0.35
      : 0;

    const isCentralSeat = seat.id.startsWith('central-');
    const isCounterSeat = seat.id.startsWith('counter-');
    const isLoungeSeat = seat.id.startsWith('lounge-');

    return (
      <g
        className={`${isOccupiedByOther ? 'cursor-not-allowed' : 'cursor-pointer'} select-none`}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(seat.id);
        }}
        onMouseEnter={() => onHoverChange(seat.id)}
        onMouseLeave={() => onHoverChange(null)}
        role="button"
        tabIndex={0}
        aria-label={`${seat.name} (${seat.zoneLabel}) — ${
          isOccupiedByOther
            ? `Occupied by ${occupant?.displayName}`
            : isSelfSeatedHere
            ? 'You are seated here'
            : 'Available seat'
        }`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(seat.id);
          }
        }}
      >
        {/* 1. Interactive Floor Selection & Availability Halo Ring */}
        <ellipse
          cx={seat.avatarScreenX}
          cy={seat.avatarScreenY + 4}
          rx={isCentralSeat || isCounterSeat ? 28 : 42}
          ry={isCentralSeat || isCounterSeat ? 16 : 24}
          fill={
            isSelfSeatedHere
              ? 'rgba(104, 211, 145, 0.22)'
              : isOccupiedByOther
              ? 'rgba(229, 107, 78, 0.16)'
              : isHovered
              ? 'rgba(243, 182, 100, 0.22)'
              : 'rgba(243, 182, 100, 0.05)'
          }
          stroke={
            isSelfSeatedHere
              ? '#68D391'
              : isOccupiedByOther
              ? 'rgba(229, 107, 78, 0.65)'
              : isHovered
              ? '#F3B664'
              : 'rgba(243, 182, 100, 0.3)'
          }
          strokeWidth={isSelfSeatedHere || isHovered ? '1.8' : '1'}
          strokeDasharray={isOccupied ? 'none' : '4 3'}
          className="transition-all duration-300"
        />

        {/* 2. Seat-Specific Chair / Stool / Sofa / Table Geometry */}
        {isCounterSeat ? (
          /* ROASTERY BAR STOOL (counter-1 or counter-2) */
          <g
            style={{
              transform: `translate(${seat.avatarScreenX + chairShiftX}px, ${
                seat.avatarScreenY + chairShiftY
              }px)`,
              transition: reducedMotion ? 'none' : 'transform 450ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <ellipse cx="0" cy="10" rx="16" ry="9" fill="rgba(15, 9, 5, 0.42)" />
            <line x1="-7" y1="-12" x2="-11" y2="10" stroke="#3B2314" strokeWidth="2.4" strokeLinecap="round" />
            <line x1="7" y1="-12" x2="11" y2="10" stroke="#3B2314" strokeWidth="2.4" strokeLinecap="round" />
            <line x1="0" y1="-14" x2="0" y2="13" stroke="#4D2E1B" strokeWidth="2.6" strokeLinecap="round" />
            <ellipse cx="0" cy="1" rx="10" ry="5.5" fill="none" stroke="#C9934B" strokeWidth="1.5" />
            <ellipse cx="0" cy="-14" rx="13" ry="7.5" fill="#8C4326" stroke="#4A2010" strokeWidth="1" />
            <ellipse cx="0" cy="-16" rx="12" ry="6.5" fill="#B55B38" />
          </g>
        ) : isCentralSeat ? (
          /* INDIVIDUAL CHAIR AROUND THE SHARED COMMUNAL OAK TABLE (central-1..4) */
          <g
            style={{
              transform: `translate(${seat.avatarScreenX + chairShiftX}px, ${
                seat.avatarScreenY + chairShiftY
              }px)`,
              transition: reducedMotion ? 'none' : 'transform 450ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <ellipse cx="0" cy="6" rx="14" ry="8" fill="rgba(15, 9, 5, 0.35)" />
            <line x1="-6" y1="-9" x2="-8" y2="6" stroke="#3E2515" strokeWidth="2.2" />
            <line x1="6" y1="-9" x2="8" y2="6" stroke="#3E2515" strokeWidth="2.2" />
            <ellipse cx="0" cy="-11" rx="13" ry="7.5" fill="#597563" stroke="#2D3E33" strokeWidth="1" />
            <path
              d="M -9,-12 C -10,-23 6,-24 9,-12"
              fill="none"
              stroke="#4A2E1B"
              strokeWidth="3.6"
              strokeLinecap="round"
            />
          </g>
        ) : isLoungeSeat ? (
          /* SOCIAL LOUNGE VELVET SOFA (lounge-1) OR CLUB ARMCHAIR (lounge-2) */
          <g
            style={{
              transform: `translate(${seat.avatarScreenX + chairShiftX}px, ${
                seat.avatarScreenY + chairShiftY
              }px)`,
              transition: reducedMotion ? 'none' : 'transform 450ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {seat.id === 'lounge-1' ? (
              /* Plush Emerald Velvet Lounge Sofa */
              <g>
                <ellipse cx="0" cy="8" rx="28" ry="15" fill="rgba(15, 9, 5, 0.42)" />
                <polygon
                  points="-22,-4 10,-20 26,-11 -6,5"
                  fill="#2E5E4E"
                  stroke="#1B3B30"
                  strokeWidth="1"
                />
                <polygon
                  points="-22,-4 -22,-22 10,-38 10,-20"
                  fill="#3B7562"
                  stroke="#1B3B30"
                  strokeWidth="1"
                />
                {/* Throw pillow */}
                <ellipse cx="-8" cy="-14" rx="5.5" ry="4" fill="#D98A3C" />
              </g>
            ) : (
              /* Cognac Leather Club Armchair */
              <g>
                <ellipse cx="0" cy="8" rx="20" ry="11" fill="rgba(15, 9, 5, 0.4)" />
                <ellipse cx="0" cy="-8" rx="16" ry="9.5" fill="#8C462B" stroke="#4A2010" strokeWidth="1" />
                <path
                  d="M -11,-9 C -8,-25 14,-24 13,-8"
                  fill="#A65535"
                  stroke="#4A2010"
                  strokeWidth="1.5"
                />
              </g>
            )}
          </g>
        ) : (
          /* QUIET STUDY ZONE TABLES & CHAIRS (window-1, window-2, quiet-corner, bookshelf-seat) */
          <g>
            <g
              style={{
                transform: `translate(${chairShiftX}px, ${chairShiftY}px)`,
                transition: reducedMotion ? 'none' : 'transform 450ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {seat.id === 'quiet-corner' ? (
                <g transform={`translate(${baseScreen.x - 24}, ${baseScreen.y - 16})`}>
                  <ellipse cx="0" cy="8" rx="22" ry="12" fill="rgba(15, 9, 5, 0.38)" />
                  <polygon points="-18,-6 8,-19 22,-11 -4,2" fill="#436656" stroke="#243B30" strokeWidth="1" />
                  <polygon points="-18,-6 -18,-26 8,-39 8,-19" fill="#547D6A" stroke="#243B30" strokeWidth="1" />
                  <polygon points="-18,-6 -4,2 -4,10 -18,2" fill="#314D40" />
                </g>
              ) : seat.id === 'bookshelf-seat' ? (
                <g transform={`translate(${baseScreen.x - 24}, ${baseScreen.y - 14})`}>
                  <ellipse cx="0" cy="8" rx="19" ry="11" fill="rgba(15, 9, 5, 0.38)" />
                  <line x1="-10" y1="-4" x2="-12" y2="8" stroke="#3B2314" strokeWidth="2.5" />
                  <line x1="10" y1="-4" x2="12" y2="8" stroke="#3B2314" strokeWidth="2.5" />
                  <ellipse cx="0" cy="-9" rx="16" ry="9.5" fill="#9E5031" stroke="#4D2312" strokeWidth="1" />
                  <path d="M -13,-10 C -15,-27 6,-28 12,-12" fill="#B5603E" stroke="#5C2B16" strokeWidth="2" />
                </g>
              ) : (
                <g transform={`translate(${baseScreen.x + 24}, ${baseScreen.y + 12})`}>
                  <ellipse cx="0" cy="6" rx="15" ry="8.5" fill="rgba(15, 9, 5, 0.35)" />
                  <line x1="-7" y1="-10" x2="-9" y2="6" stroke="#3E2515" strokeWidth="2.3" strokeLinecap="round" />
                  <line x1="7" y1="-10" x2="9" y2="6" stroke="#3E2515" strokeWidth="2.3" strokeLinecap="round" />
                  <line x1="0" y1="-8" x2="0" y2="8" stroke="#3E2515" strokeWidth="2.3" strokeLinecap="round" />
                  <ellipse cx="0" cy="-12" rx="13.5" ry="8" fill="#C97A42" stroke="#4F2D17" strokeWidth="1" />
                  <path d="M -7,-13 C 4,-26 15,-21 11,-9" fill="none" stroke="#523018" strokeWidth="3.8" strokeLinecap="round" />
                </g>
              )}
            </g>

            {/* Table Pedestal & Surface */}
            <ellipse cx={baseScreen.x} cy={baseScreen.y + 4} rx="34" ry="19" fill="rgba(15, 9, 5, 0.42)" />
            <ellipse cx={baseScreen.x} cy={baseScreen.y + 2} rx="14" ry="8" fill="#2E2522" stroke="#1A1412" strokeWidth="1" />
            <line
              x1={baseScreen.x}
              y1={baseScreen.y + 1}
              x2={tableTopScreen.x}
              y2={tableTopScreen.y + 4}
              stroke="#362B28"
              strokeWidth="5.5"
              strokeLinecap="round"
            />

            {seat.id === 'quiet-corner' || seat.id === 'bookshelf-seat' ? (
              <g>
                <polygon
                  points={`
                    ${tableTopScreen.x},${tableTopScreen.y - 21}
                    ${tableTopScreen.x + 42},${tableTopScreen.y}
                    ${tableTopScreen.x},${tableTopScreen.y + 21}
                    ${tableTopScreen.x - 42},${tableTopScreen.y}
                  `}
                  fill="#BA7C42"
                  stroke="#59361A"
                  strokeWidth="1.1"
                />
                <polygon
                  points={`
                    ${tableTopScreen.x - 42},${tableTopScreen.y}
                    ${tableTopScreen.x},${tableTopScreen.y + 21}
                    ${tableTopScreen.x},${tableTopScreen.y + 26}
                    ${tableTopScreen.x - 42},${tableTopScreen.y + 5}
                  `}
                  fill="#8F5B2D"
                />
                <polygon
                  points={`
                    ${tableTopScreen.x},${tableTopScreen.y + 21}
                    ${tableTopScreen.x + 42},${tableTopScreen.y}
                    ${tableTopScreen.x + 42},${tableTopScreen.y + 5}
                    ${tableTopScreen.x},${tableTopScreen.y + 26}
                  `}
                  fill="#6E4420"
                />
              </g>
            ) : (
              <g>
                <ellipse cx={tableTopScreen.x} cy={tableTopScreen.y + 3.5} rx="38" ry="21" fill="#9E6836" />
                <ellipse
                  cx={tableTopScreen.x}
                  cy={tableTopScreen.y}
                  rx="38"
                  ry="21"
                  fill="#D69A5C"
                  stroke="#6E4420"
                  strokeWidth="1.2"
                />
                <ellipse
                  cx={tableTopScreen.x}
                  cy={tableTopScreen.y}
                  rx="34"
                  ry="18.5"
                  fill="none"
                  stroke="#E8B882"
                  strokeWidth="0.6"
                  opacity="0.65"
                />
              </g>
            )}

            {seat.id === 'quiet-corner' && (
              <g transform={`translate(${tableTopScreen.x - 22}, ${tableTopScreen.y - 6})`}>
                <ellipse cx="0" cy="0" rx="18" ry="10" fill="url(#warmLampHalo)" opacity="0.65" />
                <ellipse cx="0" cy="0" rx="5" ry="3" fill="#B8863B" />
                <line x1="0" y1="0" x2="0" y2="-11" stroke="#C99749" strokeWidth="1.8" />
                <path d="M -7,-10 C -7,-16 7,-16 7,-10 Z" fill="#2E7D5B" stroke="#1B4D37" strokeWidth="0.8" />
              </g>
            )}
            {seat.id === 'bookshelf-seat' && (
              <g transform={`translate(${tableTopScreen.x - 22}, ${tableTopScreen.y - 5})`}>
                <polygon points="-8,0 2,-5 10,-1 0,4" fill="#9E3B33" stroke="#4A1A16" strokeWidth="0.6" />
                <polygon points="-7,-3 3,-8 11,-4 1,1" fill="#D48C46" stroke="#5C3818" strokeWidth="0.6" />
              </g>
            )}
            {(seat.id === 'window-1' || seat.id === 'window-2') && !isOccupied && (
              <g transform={`translate(${tableTopScreen.x - 14}, ${tableTopScreen.y - 3})`}>
                <ellipse cx="0" cy="0" rx="8" ry="4.5" fill="#F5EBE0" stroke="#B8A693" strokeWidth="0.6" />
                <path d="M -4,-1 C -2,-4 3,-4 4,-1 C 2,1 -2,1 -4,-1 Z" fill="#D98A36" stroke="#8C5219" strokeWidth="0.5" />
              </g>
            )}
          </g>
        )}

        {/* 3. Seated Workspace Props & Seated Avatar */}
        {children}

        {/* 4. Floating Seat Marker Pill when Available & Unoccupied */}
        {!anySeatSelected && !isOccupied && (() => {
          const badgeOffsetX =
            seat.id === 'central-1' || seat.id === 'central-4'
              ? -32
              : seat.id === 'central-2' || seat.id === 'central-3'
              ? 32
              : seat.id === 'lounge-1'
              ? -22
              : seat.id === 'lounge-2'
              ? 22
              : 0;
          const badgeOffsetY =
            seat.id === 'central-1' || seat.id === 'central-2'
              ? -38
              : seat.id === 'central-3' || seat.id === 'central-4'
              ? 18
              : seat.id === 'lounge-2'
              ? -16
              : -30;
          return (
            <g
              transform={`translate(${tableTopScreen.x + badgeOffsetX}, ${
                tableTopScreen.y + badgeOffsetY - (isHovered ? 6 : 0)
              })`}
              className="transition-transform duration-300 pointer-events-none"
            >
              <line
                x1="0"
                y1="6"
                x2={-badgeOffsetX * 0.45}
                y2="16"
                stroke={isHovered ? '#F3B664' : 'rgba(244, 236, 225, 0.38)'}
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <rect
                x={isHovered ? -74 : -58}
                y="-10"
                width={isHovered ? 148 : 116}
                height={isHovered ? 21 : 17}
                rx={8.5}
                fill={isHovered ? '#231710' : 'rgba(26, 18, 14, 0.84)'}
                stroke={isHovered ? '#F3B664' : 'rgba(212, 140, 70, 0.45)'}
                strokeWidth={isHovered ? '1.2' : '0.7'}
              />
              <circle
                cx={isHovered ? -62 : -47}
                cy={isHovered ? 0.5 : -1.5}
                r="2.8"
                fill={isHovered ? '#68D391' : '#F3B664'}
              />
              <text
                x="4"
                y={isHovered ? 3 : 1}
                textAnchor="middle"
                fill="#F7EDE2"
                fontSize={isHovered ? '8.2' : '7.2'}
                fontFamily="Plus Jakarta Sans, sans-serif"
                fontWeight="600"
              >
                {isHovered ? `Sit: ${seat.name}` : seat.name}
              </text>
            </g>
          );
        })()}
      </g>
    );
  }
);

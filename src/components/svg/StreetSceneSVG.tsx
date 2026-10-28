import React, { useState } from 'react';
import { TimeOfDay } from '../../types';

interface StreetSceneSVGProps {
  timeOfDay: TimeOfDay;
  isRaining: boolean;
  reducedMotion: boolean;
  onEnterCafe: () => void;
}

export const StreetSceneSVG: React.FC<StreetSceneSVGProps> = ({
  timeOfDay,
  isRaining,
  reducedMotion,
  onEnterCafe,
}) => {
  const [isDoorHovered, setIsDoorHovered] = useState(false);
  const [isDoorOpening, setIsDoorOpening] = useState(false);

  const handleEntranceClick = () => {
    if (isDoorOpening) return;
    setIsDoorOpening(true);
    onEnterCafe();
  };

  // Sky palette adapts to Afternoon, Dusk, or Night
  const skyColors = {
    afternoon: { top: '#2E3B4E', mid: '#785A56', bottom: '#D99B66' },
    dusk: { top: '#181D2E', mid: '#3A2E47', bottom: '#8F5849' },
    night: { top: '#0D111C', mid: '#181E2E', bottom: '#2B2838' },
  }[timeOfDay];

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none transition-transform duration-1000 ease-in-out ${
        isDoorOpening ? 'scale-[1.42] opacity-0' : 'scale-100 opacity-100'
      }`}
      style={{ transformOrigin: '50% 60%' }}
    >
      <svg
        viewBox="0 0 1600 960"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full block"
        role="img"
        aria-label="Eval Exec's Cafe Street Storefront — Click the entrance door to step inside"
      >
        <defs>
          {/* Sky Gradient */}
          <linearGradient id="streetSkyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={skyColors.top} />
            <stop offset="55%" stopColor={skyColors.mid} />
            <stop offset="100%" stopColor={skyColors.bottom} />
          </linearGradient>

          {/* Warm Interior Window Glow */}
          <linearGradient id="windowInteriorGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFE4B5" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#F5B056" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#C97332" stopOpacity="0.9" />
          </linearGradient>

          {/* Warm Light Spilling onto the Sidewalk */}
          <radialGradient id="sidewalkSpillGlow" cx="50%" cy="0%" r="75%">
            <stop offset="0%" stopColor="#FFDF9E" stopOpacity="0.52" />
            <stop offset="55%" stopColor="#E59843" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#E59843" stopOpacity="0" />
          </radialGradient>

          {/* Streetlamp Lantern Radial Glow */}
          <radialGradient id="streetLampHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFF4D4" stopOpacity="0.9" />
            <stop offset="35%" stopColor="#F5B358" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#F5B358" stopOpacity="0" />
          </radialGradient>

          {/* Brick Facade Pattern */}
          <pattern id="brickPattern" width="44" height="22" patternUnits="userSpaceOnUse">
            <rect width="44" height="22" fill="#59382B" />
            <rect x="1" y="1" width="20" height="9" rx="1" fill="#6B4333" />
            <rect x="23" y="1" width="20" height="9" rx="1" fill="#633D2E" />
            <rect x="-9" y="12" width="20" height="9" rx="1" fill="#633D2E" />
            <rect x="13" y="12" width="20" height="9" rx="1" fill="#704736" />
            <rect x="35" y="12" width="20" height="9" rx="1" fill="#6B4333" />
          </pattern>

          {/* Cobblestone Sidewalk Pattern */}
          <pattern id="cobblePattern" width="60" height="28" patternUnits="userSpaceOnUse">
            <rect width="60" height="28" fill="#2A2321" />
            <rect x="2" y="2" width="26" height="11" rx="3" fill="#38302D" />
            <rect x="31" y="2" width="27" height="11" rx="3" fill="#332B28" />
            <rect x="14" y="15" width="28" height="11" rx="3" fill="#3D3430" />
            <rect x="-10" y="15" width="21" height="11" rx="3" fill="#332B28" />
            <rect x="45" y="15" width="24" height="11" rx="3" fill="#352D2A" />
          </pattern>
        </defs>

        {/* ================= 1. ATMOSPHERIC SKY & CLOUDS ================= */}
        <rect x="0" y="0" width="1600" height="720" fill="url(#streetSkyGrad)" />

        {/* Subtle Twinkling Stars at Dusk / Night */}
        {timeOfDay !== 'afternoon' && (
          <g opacity={timeOfDay === 'night' ? 0.85 : 0.45}>
            {[
              [180, 90, 1.5],
              [340, 60, 1.8],
              [520, 120, 1.2],
              [760, 50, 2],
              [1040, 80, 1.5],
              [1290, 55, 1.8],
              [1440, 110, 1.4],
              [240, 160, 1.2],
              [1180, 145, 1.4],
            ].map(([cx, cy, r], idx) => (
              <circle key={idx} cx={cx} cy={cy} r={r} fill="#FFF8E7" />
            ))}
          </g>
        )}

        {/* Warm Setting Sun / Crescent Moon */}
        {timeOfDay === 'afternoon' ? (
          <circle cx="240" cy="185" r="56" fill="#FFDFA8" opacity="0.32" />
        ) : (
          <g transform="translate(235, 130)">
            <circle cx="0" cy="0" r="24" fill="#FFF4D2" opacity="0.88" />
            <circle cx="9" cy="-6" r="21" fill={skyColors.top} />
          </g>
        )}

        {/* Soft Drifting Clouds */}
        <g className={!reducedMotion ? 'cloud-drift-slow' : ''} opacity="0.28">
          <path
            d="M 120,165 Q 145,140 180,152 Q 210,130 245,150 Q 275,145 290,168 Z"
            fill="#FFE6C9"
          />
          <path
            d="M 1160,125 Q 1190,98 1230,112 Q 1265,92 1305,115 Q 1335,108 1350,130 Z"
            fill="#FFE6C9"
          />
          <path
            d="M 620,95 Q 650,72 685,84 Q 715,68 748,88 Z"
            fill="#FFE6C9"
          />
        </g>

        {/* Distant Neighbouring Parisian/Indie Rooftops Silhouette */}
        <polygon
          points="0,700 0,320 90,260 220,260 260,320 260,700"
          fill="#221B21"
        />
        <polygon
          points="1340,700 1340,300 1390,245 1540,245 1600,300 1600,700"
          fill="#221B21"
        />
        {/* Warm lit distant apartment windows */}
        <rect x="65" y="360" width="34" height="52" rx="3" fill="#E5A253" opacity="0.35" />
        <rect x="135" y="360" width="34" height="52" rx="3" fill="#3B2F36" />
        <rect x="65" y="450" width="34" height="52" rx="3" fill="#3B2F36" />
        <rect x="1420" y="350" width="36" height="54" rx="3" fill="#E5A253" opacity="0.4" />
        <rect x="1490" y="445" width="36" height="54" rx="3" fill="#E5A253" opacity="0.25" />

        {/* ================= 2. CENTRAL BUILDING FACADE & UPPER STORIES ================= */}
        {/* Main Brick Townhouse Architecture (x: 310..1290, y: 110..700) */}
        <rect x="310" y="130" width="980" height="570" fill="url(#brickPattern)" stroke="#2E1B13" strokeWidth="3" />

        {/* Mansard Slate Roof & Chimneys */}
        <polygon
          points="295,135 350,55 1250,55 1305,135"
          fill="#282B36"
          stroke="#191B22"
          strokeWidth="3"
        />
        {/* Roof Chimneys */}
        <rect x="410" y="22" width="44" height="40" fill="#59382B" stroke="#2E1B13" strokeWidth="2" />
        <rect x="1145" y="22" width="44" height="40" fill="#59382B" stroke="#2E1B13" strokeWidth="2" />

        {/* Stone Cornice Ledges */}
        <rect x="295" y="126" width="1010" height="16" rx="3" fill="#C2AE99" stroke="#5C4D3C" strokeWidth="2" />
        <rect x="302" y="332" width="996" height="14" rx="2" fill="#C2AE99" stroke="#5C4D3C" strokeWidth="2" />

        {/* Upper Floor Arched Windows with Wrought-Iron Juliet Balconies & Flower Boxes */}
        {[440, 740, 1040].map((wx, idx) => (
          <g key={idx} transform={`translate(${wx}, 175)`}>
            {/* Stone Window Surround */}
            <rect x="-8" y="-8" width="136" height="136" rx="8" fill="#B59F88" />
            {/* Window Recess */}
            <rect x="0" y="0" width="120" height="122" rx="4" fill="#2A2225" stroke="#4A3C32" strokeWidth="2" />
            {/* Soft Curtains & Warm Study Lamp Glow upstairs */}
            <rect
              x="6"
              y="6"
              width="108"
              height="110"
              fill={idx === 1 ? '#F2B463' : '#40343B'}
              opacity={idx === 1 ? 0.55 : 0.7}
            />
            {/* Mullions */}
            <line x1="60" y1="0" x2="60" y2="122" stroke="#B59F88" strokeWidth="4" />
            <line x1="0" y1="58" x2="120" y2="58" stroke="#B59F88" strokeWidth="3.5" />
            {/* Terracotta Window Flower Box */}
            <rect x="-4" y="110" width="128" height="18" rx="3" fill="#A85239" stroke="#5C2819" strokeWidth="1.5" />
            {/* Cascading Geraniums & Ivy */}
            <circle cx="18" cy="108" r="9" fill="#3D6B4E" />
            <circle cx="34" cy="110" r="8" fill="#4E8060" />
            <circle cx="60" cy="107" r="10" fill="#3D6B4E" />
            <circle cx="88" cy="109" r="9" fill="#4E8060" />
            <circle cx="104" cy="108" r="8" fill="#3D6B4E" />
            <circle cx="24" cy="105" r="4" fill="#E0634E" />
            <circle cx="64" cy="104" r="4.5" fill="#E88554" />
            <circle cx="94" cy="105" r="4" fill="#E0634E" />
            {/* Wrought-iron balcony railing */}
            <rect x="-10" y="96" width="140" height="32" fill="none" stroke="#1F1D20" strokeWidth="3" />
          </g>
        ))}

        {/* ================= 3. L'ATELIER AMBRE STOREFRONT (GROUND FLOOR) ================= */}
        {/* Deep Forest-Sage & Walnut Timber Storefront Surround (x: 325..1275, y: 346..705) */}
        <rect
          x="325"
          y="346"
          width="950"
          height="358"
          fill="#263B32"
          stroke="#16241E"
          strokeWidth="4"
        />
        {/* Decorative Pilasters */}
        <rect x="325" y="346" width="32" height="358" fill="#1E3028" stroke="#121F1A" strokeWidth="2" />
        <rect x="1243" y="346" width="32" height="358" fill="#1E3028" stroke="#121F1A" strokeWidth="2" />
        <rect x="668" y="420" width="24" height="284" fill="#1E3028" stroke="#121F1A" strokeWidth="2" />
        <rect x="908" y="420" width="24" height="284" fill="#1E3028" stroke="#121F1A" strokeWidth="2" />

        {/* Storefront Signboard Frieze (with Brass Frame & Hand-Lettered Café Name) */}
        <rect
          x="365"
          y="356"
          width="870"
          height="54"
          rx="4"
          fill="#1B1410"
          stroke="#C8934B"
          strokeWidth="2.5"
        />
        <rect
          x="371"
          y="362"
          width="858"
          height="42"
          rx="2"
          fill="none"
          stroke="rgba(200, 147, 75, 0.45)"
          strokeWidth="1"
        />
        <text
          x="800"
          y="391"
          textAnchor="middle"
          fill="#F6DFB7"
          fontSize="25"
          fontFamily="Fraunces, Georgia, serif"
          fontWeight="600"
          letterSpacing="5"
        >
          EVAL EXEC’S CAFE • STUDY &amp; ROASTERY
        </text>

        {/* Ornate Hanging Wrought-Iron Blade Sign on the Left Pilaster */}
        <g transform="translate(310, 415)">
          {/* Iron bracket */}
          <line x1="15" y1="0" x2="-62" y2="0" stroke="#1A1716" strokeWidth="4" strokeLinecap="round" />
          <path d="M 15,-18 Q -15,0 -35,0" fill="none" stroke="#1A1716" strokeWidth="2.5" />
          {/* Gentle swinging sign medallion */}
          <g className={!reducedMotion ? 'sign-swing' : ''} style={{ transformOrigin: '-30px 0px' }}>
            <line x1="-48" y1="0" x2="-48" y2="12" stroke="#C8934B" strokeWidth="2" />
            <line x1="-14" y1="0" x2="-14" y2="12" stroke="#C8934B" strokeWidth="2" />
            <rect
              x="-64"
              y="12"
              width="66"
              height="48"
              rx="8"
              fill="#211712"
              stroke="#D49A4E"
              strokeWidth="2.2"
            />
            {/* Steaming Cup Icon on Hanging Sign */}
            <path d="M -41,36 L -39,46 L -23,46 L -21,36 Z" fill="#F6DFB7" />
            <path d="M -21,38 C -16,38 -16,44 -22,44" fill="none" stroke="#F6DFB7" strokeWidth="1.8" />
            <path d="M -34,32 Q -36,26 -32,22" fill="none" stroke="#E5A253" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M -28,32 Q -26,26 -30,22" fill="none" stroke="#E5A253" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </g>

        {/* ================= 4. LARGE WINDOWS WITH WARM INTERIOR VIEW ================= */}
        {/* LEFT PICTURE WINDOW (x: 374..658, y: 448..636) — Shows Bookshelves, Pendant Lamps & Window Seat I */}
        <g transform="translate(374, 448)">
          {/* Window Frame & Warm Glowing Interior Backdrop */}
          <rect x="-6" y="-6" width="296" height="198" rx="4" fill="#3D2618" />
          <rect x="0" y="0" width="284" height="186" fill="url(#windowInteriorGlow)" />

          {/* Interior Silhouette Details Visible Through Left Window */}
          {/* Interior Bookshelf Silhouette */}
          <rect x="18" y="24" width="68" height="162" fill="rgba(74, 42, 24, 0.55)" />
          <line x1="18" y1="62" x2="86" y2="62" stroke="#3B2010" strokeWidth="4" />
          <line x1="18" y1="102" x2="86" y2="102" stroke="#3B2010" strokeWidth="4" />
          <line x1="18" y1="142" x2="86" y2="142" stroke="#3B2010" strokeWidth="4" />
          {/* Books on shelf */}
          <rect x="24" y="42" width="8" height="20" fill="#9E3B33" opacity="0.8" />
          <rect x="34" y="45" width="9" height="17" fill="#3E6B52" opacity="0.8" />
          <rect x="45" y="40" width="8" height="22" fill="#59412B" opacity="0.8" />
          <rect x="28" y="82" width="10" height="20" fill="#B85D3B" opacity="0.8" />
          <rect x="40" y="85" width="12" height="17" fill="#435E70" opacity="0.8" />

          {/* Hanging Interior Pendant Lamps */}
          <line x1="142" y1="0" x2="142" y2="46" stroke="#4A2C18" strokeWidth="2" />
          <polygon points="126,46 158,46 166,58 118,58" fill="#8C4A27" />
          <circle cx="142" cy="60" r="18" fill="#FFF7DE" opacity="0.7" />

          <line x1="226" y1="0" x2="226" y2="56" stroke="#4A2C18" strokeWidth="2" />
          <polygon points="212,56 240,56 248,66 204,66" fill="#8C4A27" />
          <circle cx="226" cy="68" r="16" fill="#FFF7DE" opacity="0.7" />

          {/* Window Table Silhouette & Steaming Cup Inside */}
          <rect x="135" y="148" width="96" height="8" rx="3" fill="#5C341B" />
          <rect x="178" y="156" width="10" height="30" fill="#3D2210" />
          {/* Laptop & Coffee silhouette inside window */}
          <polygon points="154,148 176,148 182,130 160,130" fill="#3B281D" />
          <rect x="198" y="139" width="10" height="9" rx="2" fill="#FFF6E5" />

          {/* Mullion Bars & Diagonal Glass Reflection */}
          <polygon points="18,0 58,0 0,110 0,65" fill="rgba(255, 252, 245, 0.16)" />
          <line x1="95" y1="0" x2="95" y2="186" stroke="#263B32" strokeWidth="5" />
          <line x1="189" y1="0" x2="189" y2="186" stroke="#263B32" strokeWidth="5" />
          <line x1="0" y1="62" x2="284" y2="62" stroke="#263B32" strokeWidth="4" />

          {/* Wainscoting Panel Below Left Window */}
          <rect x="-4" y="192" width="292" height="64" fill="#1E3028" stroke="#13201A" strokeWidth="2" />
          <rect x="12" y="202" width="124" height="44" fill="#23382E" stroke="#C8934B" strokeWidth="1" opacity="0.7" />
          <rect x="148" y="202" width="124" height="44" fill="#23382E" stroke="#C8934B" strokeWidth="1" opacity="0.7" />
        </g>

        {/* RIGHT PICTURE WINDOW (x: 942..1226, y: 448..636) — Shows Roastery Espresso Counter & Barista */}
        <g transform="translate(942, 448)">
          <rect x="-6" y="-6" width="296" height="198" rx="4" fill="#3D2618" />
          <rect x="0" y="0" width="284" height="186" fill="url(#windowInteriorGlow)" />

          {/* Hanging Edison Lamps Inside Right Window */}
          <line x1="78" y1="0" x2="78" y2="50" stroke="#4A2C18" strokeWidth="2" />
          <polygon points="62,50 94,50 102,62 54,62" fill="#8C4A27" />
          <circle cx="78" cy="64" r="18" fill="#FFF7DE" opacity="0.7" />

          <line x1="196" y1="0" x2="196" y2="44" stroke="#4A2C18" strokeWidth="2" />
          <polygon points="180,44 212,44 220,56 172,56" fill="#8C4A27" />
          <circle cx="196" cy="58" r="18" fill="#FFF7DE" opacity="0.7" />

          {/* Barista Silhouette & Espresso Counter Inside */}
          <circle cx="155" cy="98" r="13" fill="rgba(74, 42, 24, 0.65)" />
          <path d="M 134,135 C 134,110 176,110 176,135 Z" fill="rgba(74, 42, 24, 0.65)" />
          {/* Espresso Machine Silhouette */}
          <rect x="74" y="104" width="48" height="32" rx="3" fill="#6E3B20" />
          <rect x="40" y="134" width="215" height="52" fill="#4A2A18" />

          {/* Mullion Bars & Glass Reflection */}
          <polygon points="190,0 230,0 140,186 100,186" fill="rgba(255, 252, 245, 0.14)" />
          <line x1="95" y1="0" x2="95" y2="186" stroke="#263B32" strokeWidth="5" />
          <line x1="189" y1="0" x2="189" y2="186" stroke="#263B32" strokeWidth="5" />
          <line x1="0" y1="62" x2="284" y2="62" stroke="#263B32" strokeWidth="4" />

          {/* Wainscoting Panel Below Right Window */}
          <rect x="-4" y="192" width="292" height="64" fill="#1E3028" stroke="#13201A" strokeWidth="2" />
          <rect x="12" y="202" width="124" height="44" fill="#23382E" stroke="#C8934B" strokeWidth="1" opacity="0.7" />
          <rect x="148" y="202" width="124" height="44" fill="#23382E" stroke="#C8934B" strokeWidth="1" opacity="0.7" />
        </g>

        {/* Striped Terracotta & Cream Storefront Fabric Awning */}
        <g transform="translate(352, 412)">
          {/* Shadow under awning */}
          <rect x="6" y="34" width="884" height="16" fill="rgba(12, 8, 6, 0.45)" />
          {Array.from({ length: 18 }).map((_, idx) => {
            const stripeW = 49.7;
            const sx = idx * stripeW;
            const isTerracotta = idx % 2 === 0;
            return (
              <g key={idx}>
                <polygon
                  points={`${sx},0 ${sx + stripeW},0 ${sx + stripeW + 4},34 ${sx - 4},34`}
                  fill={isTerracotta ? '#B54B35' : '#EFE2CE'}
                  stroke="#3B1D14"
                  strokeWidth="0.8"
                />
                {/* Scalloped Valance Edge */}
                <path
                  d={`M ${sx - 4},34 Q ${sx + stripeW / 2},48 ${sx + stripeW + 4},34 Z`}
                  fill={isTerracotta ? '#963A26' : '#D9C7AE'}
                  stroke="#3B1D14"
                  strokeWidth="0.8"
                />
              </g>
            );
          })}
        </g>

        {/* ================= 5. THE WELCOMING CAFÉ ENTRANCE (INTERACTIVE DOORWAY) ================= */}
        <g
          transform="translate(705, 434)"
          onClick={handleEntranceClick}
          onMouseEnter={() => setIsDoorHovered(true)}
          onMouseLeave={() => setIsDoorHovered(false)}
          className="cursor-pointer"
          role="button"
          tabIndex={0}
          aria-label="Enter Eval Exec's Cafe"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleEntranceClick();
            }
          }}
        >
          {/* Outer Arched Mahogany Door Frame */}
          <rect
            x="-12"
            y="-8"
            width="214"
            height="278"
            rx="6"
            fill="#3B2214"
            stroke={isDoorHovered || isDoorOpening ? '#F5B864' : '#6E452B'}
            strokeWidth={isDoorHovered || isDoorOpening ? '3' : '2'}
          />

          {/* Warm Interior Threshold (Visible behind the door glass & when door swings open) */}
          <rect x="0" y="0" width="190" height="266" fill="url(#windowInteriorGlow)" />
          {/* Checkered / Herringbone Warm Interior Floor Glimpse inside doorway */}
          <polygon points="0,266 190,266 155,210 35,210" fill="#B87A42" opacity="0.85" />
          {/* Hanging Entryway Lantern Inside */}
          <line x1="95" y1="0" x2="95" y2="38" stroke="#5C361E" strokeWidth="2" />
          <circle cx="95" cy="44" r="14" fill="#FFF8E2" />

          {/* Transom Window Above Door with Gold Leaf Street Number "N° 24" */}
          <rect x="0" y="0" width="190" height="46" fill="rgba(42, 24, 14, 0.35)" stroke="#3B2214" strokeWidth="4" />
          <text
            x="95"
            y="30"
            textAnchor="middle"
            fill="#FFF0CC"
            fontSize="17"
            fontFamily="Fraunces, serif"
            fontWeight="600"
            letterSpacing="2"
          >
            N° 24
          </text>

          {/* Animated Swinging Walnut & Glass Café Door */}
          <g
            style={{
              transform:
                isDoorOpening
                  ? 'translate(8px, 4px) scaleX(0.28) skewY(12deg)'
                  : isDoorHovered
                  ? 'translate(4px, 1px) scaleX(0.84) skewY(4deg)'
                  : 'scaleX(1) skewY(0deg)',
              transformOrigin: '0px 150px',
              transition: reducedMotion ? 'none' : 'transform 650ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {/* Solid Walnut Door Stile & Rails */}
            <rect
              x="4"
              y="50"
              width="182"
              height="214"
              fill="#54311C"
              stroke="#2B170C"
              strokeWidth="3"
            />
            {/* Upper Arched Glass Pane in Door */}
            <rect
              x="22"
              y="66"
              width="146"
              height="116"
              rx="4"
              fill="rgba(255, 226, 173, 0.35)"
              stroke="#3B2010"
              strokeWidth="3"
            />
            {/* Etched Gold Filigree Border on Door Glass */}
            <rect
              x="29"
              y="73"
              width="132"
              height="102"
              rx="2"
              fill="none"
              stroke="#F7DFB2"
              strokeWidth="1"
              opacity="0.75"
            />
            {/* Hanging Cream & Brass "OPEN / BIENVENUE" Plaque on Door Glass */}
            <line x1="95" y1="95" x2="75" y2="112" stroke="#D49A4E" strokeWidth="1.5" />
            <line x1="95" y1="95" x2="115" y2="112" stroke="#D49A4E" strokeWidth="1.5" />
            <circle cx="95" cy="95" r="2.5" fill="#D49A4E" />
            <rect
              x="56"
              y="112"
              width="78"
              height="30"
              rx="5"
              fill="#FBF3E4"
              stroke="#B8833D"
              strokeWidth="1.8"
            />
            <text
              x="95"
              y="131"
              textAnchor="middle"
              fill="#3B2214"
              fontSize="11.5"
              fontFamily="Fraunces, serif"
              fontWeight="700"
              letterSpacing="1.5"
            >
              OPEN
            </text>

            {/* Lower Carved Wood Kick Panels */}
            <rect x="22" y="194" width="66" height="54" fill="#452715" stroke="#704327" strokeWidth="1.5" />
            <rect x="102" y="194" width="66" height="54" fill="#452715" stroke="#704327" strokeWidth="1.5" />
            {/* Brass Kickplate at Bottom */}
            <rect x="8" y="254" width="174" height="8" fill="#C8934B" />

            {/* Polished Brass Door Handle & Backplate */}
            <rect x="152" y="158" width="9" height="34" rx="4" fill="#E3B168" stroke="#7A521E" strokeWidth="1.2" />
            <circle cx="156.5" cy="175" r="4.5" fill="#FFF0C4" stroke="#7A521E" strokeWidth="1" />
          </g>

          {/* Stone Doorstep & Coir Welcome Mat */}
          <polygon points="-18,266 208,266 220,280 -30,280" fill="#8C7E72" stroke="#4D443D" strokeWidth="1.5" />
          <polygon points="10,270 180,270 190,282 0,282" fill="#9E6B43" stroke="#593A22" strokeWidth="1.2" />

          {/* Floating Interactive Entrance Invitation Pill */}
          <g
            transform={`translate(95, ${isDoorHovered ? -28 : -22})`}
            className="transition-all duration-300"
          >
            <rect
              x="-96"
              y="-18"
              width="192"
              height="34"
              rx="17"
              fill={isDoorHovered ? '#23160F' : 'rgba(24, 16, 12, 0.9)'}
              stroke="#F3B664"
              strokeWidth={isDoorHovered ? '2' : '1.3'}
            />
            <circle
              cx="-74"
              cy="-1"
              r="4.5"
              fill="#68D391"
              className={!reducedMotion ? 'animate-ping' : ''}
            />
            <circle cx="-74" cy="-1" r="4.5" fill="#68D391" />
            <text
              x="8"
              y="4"
              textAnchor="middle"
              fill="#FFF3DF"
              fontSize="12.5"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fontWeight="600"
            >
              {isDoorOpening ? 'Stepping Inside...' : 'Click Door to Enter Café'}
            </text>
          </g>
        </g>

        {/* ================= 6. COBBLESTONE SIDEWALK & WARM WINDOW LIGHT SPILL ================= */}
        {/* Sidewalk Surface */}
        <rect x="0" y="704" width="1600" height="170" fill="url(#cobblePattern)" />
        {/* Curb Stone Edge */}
        <rect x="0" y="700" width="1600" height="10" fill="#6E6259" />
        <rect x="0" y="866" width="1600" height="14" fill="#4D433C" />
        {/* Street Asphalt Foreground */}
        <rect x="0" y="880" width="1600" height="80" fill="#181414" />

        {/* Warm Golden Light Pools Spilling Out from Windows and Door onto Sidewalk */}
        <ellipse cx="516" cy="740" rx="190" ry="56" fill="url(#sidewalkSpillGlow)" className="pointer-events-none" />
        <ellipse
          cx="800"
          cy="755"
          rx={isDoorHovered || isDoorOpening ? 165 : 125}
          ry={isDoorHovered || isDoorOpening ? 68 : 48}
          fill="url(#sidewalkSpillGlow)"
          className="pointer-events-none transition-all duration-500"
        />
        <ellipse cx="1084" cy="740" rx="190" ry="56" fill="url(#sidewalkSpillGlow)" className="pointer-events-none" />

        {/* ================= 7. PLANTS, TREES, OUTDOOR SEATING & STREET PROPS ================= */}
        {/* Potted Olive Bushes Flanking the Entrance Door */}
        {[662, 938].map((px, idx) => (
          <g key={idx} transform={`translate(${px}, 696)`} className="pointer-events-none">
            <ellipse cx="0" cy="14" rx="26" ry="9" fill="rgba(10, 6, 4, 0.45)" />
            {/* Ribbed Terracotta Pot */}
            <polygon points="-20,-34 20,-34 15,12 -15,12" fill="#B85D3D" stroke="#632E1C" strokeWidth="1.5" />
            <rect x="-23" y="-40" width="46" height="8" rx="3" fill="#CC6B49" stroke="#632E1C" strokeWidth="1.5" />
            {/* Trunk & Swaying Olive Crown */}
            <line x1="0" y1="-40" x2="0" y2="-75" stroke="#523624" strokeWidth="4.5" />
            <g className={!reducedMotion ? 'plant-sway' : ''}>
              <circle cx="-14" cy="-84" r="18" fill="#496E56" />
              <circle cx="14" cy="-84" r="18" fill="#3E5E49" />
              <circle cx="0" cy="-98" r="22" fill="#588267" />
              <circle cx="-8" cy="-92" r="14" fill="#689678" />
            </g>
          </g>
        ))}

        {/* Outdoor Sidewalk Bistro Table & Two Wrought-Iron Chairs (Left Foreground) */}
        <g transform="translate(475, 765)">
          <ellipse cx="0" cy="22" rx="68" ry="18" fill="rgba(10, 6, 4, 0.42)" />
          {/* Left Wrought-Iron Chair */}
          <g transform="translate(-48, 0)">
            <path d="M -14,-38 C -16,-65 12,-65 10,-38 Z" fill="none" stroke="#242021" strokeWidth="3" />
            <ellipse cx="-2" cy="-22" rx="16" ry="6" fill="#9E4B32" stroke="#242021" strokeWidth="2" />
            <line x1="-14" y1="-22" x2="-18" y2="18" stroke="#242021" strokeWidth="2.8" />
            <line x1="10" y1="-22" x2="14" y2="18" stroke="#242021" strokeWidth="2.8" />
          </g>
          {/* Right Wrought-Iron Chair */}
          <g transform="translate(48, 0)">
            <path d="M -10,-38 C -12,-65 16,-65 14,-38 Z" fill="none" stroke="#242021" strokeWidth="3" />
            <ellipse cx="2" cy="-22" rx="16" ry="6" fill="#9E4B32" stroke="#242021" strokeWidth="2" />
            <line x1="-10" y1="-22" x2="-14" y2="18" stroke="#242021" strokeWidth="2.8" />
            <line x1="14" y1="-22" x2="18" y2="18" stroke="#242021" strokeWidth="2.8" />
          </g>
          {/* Round Marble Sidewalk Bistro Table */}
          <line x1="0" y1="-34" x2="0" y2="20" stroke="#211D1E" strokeWidth="4.5" />
          <path d="M -18,20 Q 0,10 18,20" fill="none" stroke="#211D1E" strokeWidth="3.5" strokeLinecap="round" />
          <ellipse cx="0" cy="-36" rx="36" ry="11" fill="#EFE6D8" stroke="#8C7762" strokeWidth="2.2" />
          {/* Open Book & Steaming Outdoor Coffee Cup on Bistro Table */}
          <polygon points="-22,-36 -6,-40 0,-34 -16,-31" fill="#FBF5EA" stroke="#8C735B" strokeWidth="0.9" />
          <ellipse cx="14" cy="-36" rx="6.5" ry="3" fill="#FFFDF9" stroke="#B5A38F" strokeWidth="0.8" />
          <path d="M 10,-43 L 11,-36 L 17,-36 L 18,-43 Z" fill="#C86D51" />
          {!reducedMotion && (
            <path
              d="M 14,-46 C 11,-53 17,-58 14,-64"
              fill="none"
              stroke="#FFF6E5"
              strokeWidth="1.3"
              strokeLinecap="round"
              className="steam-wisp-1"
            />
          )}
        </g>

        {/* Wooden Sidewalk Chalkboard Menu A-Frame Sign (Right of Entrance) */}
        <g transform="translate(1015, 735)">
          <ellipse cx="0" cy="30" rx="28" ry="9" fill="rgba(10, 6, 4, 0.45)" />
          <line x1="-4" y1="-38" x2="18" y2="26" stroke="#5C381E" strokeWidth="4" strokeLinecap="round" />
          <polygon
            points="-22,-38 14,-38 6,28 -30,28"
            fill="#6E4423"
            stroke="#3B2210"
            strokeWidth="2"
          />
          <polygon
            points="-18,-32 10,-32 3,18 -25,18"
            fill="#232B28"
          />
          <text x="-7" y="-17" textAnchor="middle" fill="#F6DFB7" fontSize="7.5" fontFamily="Fraunces, serif">
            TODAY’S POUR
          </text>
          <line x1="-18" y1="-12" x2="4" y2="-12" stroke="#D48C46" strokeWidth="0.8" />
          <text x="-8" y="-2" textAnchor="middle" fill="#E3D5C5" fontSize="6.5" fontFamily="Plus Jakarta Sans, sans-serif">
            • Single Origin
          </text>
          <text x="-9" y="8" textAnchor="middle" fill="#E3D5C5" fontSize="6.5" fontFamily="Plus Jakarta Sans, sans-serif">
            • Warm Croissant
          </text>
        </g>

        {/* Vintage Bicycle Leaning Near Right Window */}
        <g transform="translate(1165, 725)">
          <ellipse cx="0" cy="24" rx="52" ry="10" fill="rgba(10, 6, 4, 0.38)" />
          {/* Rear & Front Spokes Wheels */}
          <circle cx="-28" cy="4" r="20" fill="none" stroke="#292321" strokeWidth="3.5" />
          <circle cx="-28" cy="4" r="17" fill="none" stroke="#8C7E75" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx="28" cy="4" r="20" fill="none" stroke="#292321" strokeWidth="3.5" />
          <circle cx="28" cy="4" r="17" fill="none" stroke="#8C7E75" strokeWidth="1" strokeDasharray="3 3" />
          {/* Classic Emerald Frame */}
          <polygon points="-28,4 -4,4 14,-18 -14,-18" fill="none" stroke="#3D6B58" strokeWidth="3.2" strokeLinejoin="round" />
          <line x1="-14" y1="-18" x2="-18" y2="-26" stroke="#3D6B58" strokeWidth="3" />
          <line x1="28" y1="4" x2="12" y2="-28" stroke="#3D6B58" strokeWidth="3.2" />
          {/* Leather Saddle & Wicker Basket */}
          <ellipse cx="-18" cy="-27" rx="8" ry="3.5" fill="#7A3E24" />
          <path d="M 6,-28 Q 14,-32 18,-27" fill="none" stroke="#C9B8A6" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="15" y="-26" width="14" height="11" rx="2" fill="#C28D52" stroke="#6E4B26" strokeWidth="1" />
        </g>

        {/* ================= 8. GOLDEN GINKGO TREES & VINTAGE STREETLAMPS ================= */}
        {/* Left Ginkgo Tree with Swaying Golden Foliage */}
        <g transform="translate(165, 735)">
          <ellipse cx="0" cy="18" rx="44" ry="12" fill="rgba(10, 6, 4, 0.45)" />
          {/* Iron Tree Grate */}
          <ellipse cx="0" cy="14" rx="34" ry="9" fill="#26211F" stroke="#453C38" strokeWidth="1.5" />
          {/* Tree Trunk & Branches */}
          <path
            d="M -12,14 C -10,-90 -6,-180 -4,-280 L 8,-280 C 10,-180 12,-90 14,14 Z"
            fill="#422D22"
          />
          <path d="M -2,-220 C -45,-265 -85,-300 -115,-340" fill="none" stroke="#422D22" strokeWidth="10" strokeLinecap="round" />
          <path d="M 4,-240 C 48,-280 88,-315 118,-350" fill="none" stroke="#422D22" strokeWidth="9" strokeLinecap="round" />
          {/* Swaying Golden-Amber Canopy Clusters */}
          <g className={!reducedMotion ? 'tree-sway' : ''}>
            <circle cx="-85" cy="-345" r="58" fill="#C97D2E" opacity="0.92" />
            <circle cx="85" cy="-355" r="62" fill="#D98E32" opacity="0.92" />
            <circle cx="-25" cy="-395" r="72" fill="#E5A23C" opacity="0.95" />
            <circle cx="45" cy="-410" r="66" fill="#F0B449" opacity="0.92" />
            <circle cx="-55" cy="-315" r="46" fill="#E89D38" opacity="0.9" />
            <circle cx="30" cy="-325" r="52" fill="#D4832A" opacity="0.9" />
          </g>
        </g>

        {/* Right Ginkgo Tree */}
        <g transform="translate(1445, 740)">
          <ellipse cx="0" cy="18" rx="44" ry="12" fill="rgba(10, 6, 4, 0.45)" />
          <ellipse cx="0" cy="14" rx="34" ry="9" fill="#26211F" stroke="#453C38" strokeWidth="1.5" />
          <path
            d="M -12,14 C -10,-90 -6,-180 -4,-280 L 8,-280 C 10,-180 12,-90 14,14 Z"
            fill="#422D22"
          />
          <path d="M -2,-230 C -48,-275 -82,-310 -112,-345" fill="none" stroke="#422D22" strokeWidth="9" strokeLinecap="round" />
          <path d="M 4,-220 C 42,-260 78,-295 105,-335" fill="none" stroke="#422D22" strokeWidth="9" strokeLinecap="round" />
          <g className={!reducedMotion ? 'tree-sway' : ''}>
            <circle cx="-75" cy="-350" r="60" fill="#D98E32" opacity="0.92" />
            <circle cx="70" cy="-345" r="56" fill="#C97D2E" opacity="0.92" />
            <circle cx="-15" cy="-405" r="70" fill="#F0B449" opacity="0.95" />
            <circle cx="35" cy="-390" r="62" fill="#E5A23C" opacity="0.92" />
            <circle cx="-35" cy="-320" r="48" fill="#E89D38" opacity="0.9" />
          </g>
        </g>

        {/* Vintage Cast-Iron Streetlamp with Glowing Lantern Halo */}
        <g transform="translate(290, 755)">
          <ellipse cx="0" cy="18" rx="22" ry="8" fill="rgba(10, 6, 4, 0.5)" />
          {/* Cast-iron fluted base & post */}
          <polygon points="-12,16 12,16 7,-32 -7,-32" fill="#1E1D20" stroke="#363338" strokeWidth="1.5" />
          <rect x="-4" y="-310" width="8" height="280" fill="#1E1D20" />
          <rect x="-8" y="-260" width="16" height="6" rx="3" fill="#363338" />
          {/* Glowing Lantern Halo */}
          <circle
            cx="0"
            cy="-335"
            r="95"
            fill="url(#streetLampHalo)"
            className={!reducedMotion ? 'lamp-breathe' : ''}
          />
          {/* Lantern Glass Cage & Brass Finial */}
          <polygon
            points="-14,-310 14,-310 20,-346 -20,-346"
            fill="#FFF3D1"
            stroke="#1E1D20"
            strokeWidth="2.5"
          />
          <polygon points="-24,-346 24,-346 0,-366" fill="#1E1D20" />
          <circle cx="0" cy="-369" r="4" fill="#D49A4E" />
        </g>

        {/* ================= 9. ENVIRONMENTAL FALLING LEAVES & RAIN ================= */}
        {!reducedMotion && (
          <g className="pointer-events-none">
            {[
              { x: 260, y: 390, cls: 'falling-leaf-1', color: '#F0B449' },
              { x: 580, y: 310, cls: 'falling-leaf-2', color: '#E07A45' },
              { x: 960, y: 350, cls: 'falling-leaf-3', color: '#E5A23C' },
              { x: 1280, y: 380, cls: 'falling-leaf-1', color: '#D98236' },
            ].map((leaf, i) => (
              <g key={i} transform={`translate(${leaf.x}, ${leaf.y})`}>
                <ellipse
                  cx="0"
                  cy="0"
                  rx="6"
                  ry="3.2"
                  fill={leaf.color}
                  className={leaf.cls}
                />
              </g>
            ))}
          </g>
        )}

        {/* Atmospheric Rain Streaks when Rain Soundscape is Active */}
        {isRaining && (
          <g className="pointer-events-none" opacity="0.45">
            {Array.from({ length: 34 }).map((_, i) => {
              const rx = (i * 49) % 1580;
              const ry = (i * 83) % 820;
              return (
                <line
                  key={i}
                  x1={rx}
                  y1={ry}
                  x2={rx - 14}
                  y2={ry + 46}
                  stroke="#C9DCED"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  className={!reducedMotion ? 'rain-streak' : ''}
                  style={{ animationDelay: `${(i % 7) * 0.18}s` }}
                />
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
};

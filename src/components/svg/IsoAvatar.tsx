import React, { useState } from 'react';
import { ActivityStatus, ReactionEvent, SocialProvider, VisitorPresence } from '../../types';
import { validateSafeAvatarUrl } from '../../network/multiplayerClient';

interface IsoAvatarProps {
  visitor: VisitorPresence;
  x: number;
  y: number;
  isSelf: boolean;
  isSeated: boolean;
  isUserFocusing?: boolean;
  isLeaving?: boolean;
  activeReaction?: ReactionEvent | null;
  reducedMotion: boolean;
  onSelectVisitor?: (visitor: VisitorPresence) => void;
}

const STATUS_META: Record<
  ActivityStatus,
  { label: string; dotColor: string; badgeBg: string }
> = {
  focusing: { label: 'Focusing', dotColor: '#68D391', badgeBg: '#1C3829' },
  coding: { label: 'Coding', dotColor: '#63B3ED', badgeBg: '#1A2E40' },
  studying: { label: 'Studying', dotColor: '#F6AD55', badgeBg: '#3D2817' },
  reading: { label: 'Reading', dotColor: '#B794F4', badgeBg: '#2E2240' },
  break: { label: 'On Break', dotColor: '#FBD38D', badgeBg: '#3B301B' },
  chatting: { label: 'Open to Chat', dotColor: '#4FD1C5', badgeBg: '#193836' },
  dnd: { label: 'Do Not Disturb', dotColor: '#FC8181', badgeBg: '#3D1E1E' },
};

const REACTION_EMOJI: Record<string, { symbol: string; text: string }> = {
  wave: { symbol: '👋', text: 'Waves hello!' },
  hello: { symbol: '💬', text: 'Says hi!' },
  coffee: { symbol: '☕', text: 'Cheers!' },
  thumbsup: { symbol: '👍', text: 'Nice focus!' },
  celebrate: { symbol: '🎉', text: 'Session done!' },
};

const ProviderMiniBadge: React.FC<{
  provider: SocialProvider;
  cx: number;
  cy: number;
}> = ({ provider, cx, cy }) => {
  if (provider === 'github') {
    return (
      <g transform={`translate(${cx}, ${cy})`}>
        <circle cx="0" cy="0" r="4.2" fill="#181717" stroke="#F3B664" strokeWidth="0.6" />
        <path
          d="M 0,-2.6 C -1.45,-2.6 -2.6,-1.45 -2.6,0 C -2.6,1.15 -1.85,2.1 -0.8,2.45 C -0.68,2.48 -0.62,2.4 -0.62,2.32 L -0.62,1.85 C -1.35,2.0 -1.5,1.5 -1.5,1.5 C -1.62,1.2 -1.8,1.12 -1.8,1.12 C -2.02,0.96 -1.78,0.96 -1.78,0.96 C -1.52,0.98 -1.38,1.22 -1.38,1.22 C -1.15,1.62 -0.78,1.5 -0.62,1.42 C -0.6,1.25 -0.52,1.12 -0.45,1.05 C -1.02,0.98 -1.62,0.76 -1.62,-0.2 C -1.62,-0.48 -1.52,-0.72 -1.35,-0.9 C -1.38,-0.98 -1.48,-1.25 -1.32,-1.62 C -1.32,-1.62 -1.1,-1.68 -0.62,-1.35 C -0.4,-1.42 -0.2,-1.45 0,-1.45 C 0.2,-1.45 0.4,-1.42 0.62,-1.35 C 1.1,-1.68 1.32,-1.62 1.32,-1.62 C 1.48,-1.25 1.38,-0.98 1.35,-0.9 C 1.52,-0.72 1.62,-0.48 1.62,-0.2 C 1.62,0.76 1.02,0.98 0.45,1.05 C 0.55,1.15 0.62,1.32 0.62,1.58 L 0.62,2.32 C 0.62,2.4 0.68,2.48 0.8,2.45 C 1.85,2.1 2.6,1.15 2.6,0 C 2.6,-1.45 1.45,-2.6 0,-2.6 Z"
          fill="#FFFFFF"
        />
      </g>
    );
  }
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <circle cx="0" cy="0" r="4.2" fill="#0F1419" stroke="#F3B664" strokeWidth="0.6" />
      <path
        d="M -2.0,-2.0 L -0.4,0.1 L -2.1,2.0 L -1.4,2.0 L -0.1,0.5 L 1.0,2.0 L 2.1,2.0 L 0.4,-0.2 L 1.9,-2.0 L 1.2,-2.0 L 0.0,-0.6 L -0.9,-2.0 Z"
        fill="#FFFFFF"
      />
    </g>
  );
};

/**
 * Handcrafted Isometric 2.5D SVG Character Avatar with Integrated Real GitHub/X Profile Photo Badge
 */
export const IsoAvatar: React.FC<IsoAvatarProps> = React.memo(
  ({
    visitor,
    x,
    y,
    isSelf,
    isSeated,
    isUserFocusing = false,
    isLeaving = false,
    activeReaction,
    reducedMotion,
    onSelectVisitor,
  }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [imgFailed, setImgFailed] = useState(false);

    const { avatar, activityStatus, displayName, focusStartedAtMs } = visitor;
    const meta = STATUS_META[activityStatus] || STATUS_META.focusing;

    const primaryIdentity = visitor.primaryIdentity || null;
    const safeAvatarUrl = !imgFailed
      ? validateSafeAvatarUrl(visitor.avatarUrl || primaryIdentity?.avatarUrl)
      : null;

    const isWaving =
      activeReaction?.kind === 'wave' || activeReaction?.kind === 'hello';
    const isReading =
      activityStatus === 'reading' || activityStatus === 'studying';
    const isTyping =
      activityStatus === 'coding' || activityStatus === 'focusing';

    const focusMins =
      focusStartedAtMs && focusStartedAtMs > 0
        ? Math.max(1, Math.floor((Date.now() - focusStartedAtMs) / 60000))
        : null;

    const clipId = `iso-avatar-photo-${visitor.userId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const labelOpacity = isLeaving
      ? 0
      : isUserFocusing && !isHovered && !isSelf
      ? 0.42
      : 1;

    return (
      <g
        transform={`translate(${x + (isLeaving ? 14 : 0)}, ${y + (isLeaving ? 8 : 0)})`}
        opacity={isLeaving ? 0 : 1}
        className="cursor-pointer select-none transition-all duration-500"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          onSelectVisitor?.(visitor);
        }}
        role="button"
        tabIndex={0}
        aria-label={`${displayName}${primaryIdentity ? ` (@${primaryIdentity.username} on ${primaryIdentity.provider})` : ''} — ${meta.label}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onSelectVisitor?.(visitor);
          }
        }}
      >
        <defs>
          <clipPath id={clipId}>
            <circle cx="-41" cy="0" r="8.2" />
          </clipPath>
        </defs>

        {/* Subtle Ground / Seat Presence Halo */}
        <ellipse
          cx="0"
          cy={isSeated ? 6 : 12}
          rx={isSeated ? 16 : 14}
          ry={isSeated ? 9 : 8}
          fill={isSelf ? 'rgba(104, 211, 145, 0.25)' : 'rgba(243, 182, 100, 0.18)'}
          stroke={
            isHovered || isSelf
              ? isSelf
                ? '#68D391'
                : '#F3B664'
              : 'rgba(243, 182, 100, 0.35)'
          }
          strokeWidth={isHovered || isSelf ? '1.3' : '0.8'}
          strokeDasharray={isSelf ? undefined : '3 2'}
        />

        {/* Legs when standing */}
        {!isSeated && (
          <g>
            <line
              x1="-4"
              y1="0"
              x2="-4"
              y2="11"
              stroke="#2D3748"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <line
              x1="4"
              y1="0"
              x2="4"
              y2="11"
              stroke="#2D3748"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Torso / Cozy Sweater */}
        <path
          d="M -10,2 C -11,-10 -6,-15 0,-15 C 6,-15 11,-10 10,2 Z"
          fill={avatar.clothingColor}
          stroke="#1E140E"
          strokeWidth="1"
        />

        {/* Collar / Scarf detail */}
        {avatar.accessory === 'scarf' ? (
          <g>
            <path
              d="M -7,-13 C -3,-10 3,-10 7,-13 C 8,-10 6,-8 0,-8 C -6,-8 -8,-10 -7,-13 Z"
              fill="#D95B43"
              stroke="#5C1F14"
              strokeWidth="0.7"
            />
            <path
              d="M 2,-9 L 5,-1 L 1,0 L -1,-9 Z"
              fill="#D95B43"
              stroke="#5C1F14"
              strokeWidth="0.6"
            />
          </g>
        ) : (
          <path
            d="M -4,-14 Q 0,-11 4,-14"
            fill="none"
            stroke="#F4ECE1"
            strokeWidth="1.2"
          />
        )}

        {/* Arms (animated based on typing, reading, or waving) */}
        {isWaving ? (
          <g>
            <path
              d="M -10,-11 Q -14,-6 -8,-3"
              fill="none"
              stroke={avatar.clothingColor}
              strokeWidth="3.8"
              strokeLinecap="round"
            />
            <path
              d="M 10,-12 Q 18,-22 14,-28"
              fill="none"
              stroke={avatar.clothingColor}
              strokeWidth="3.8"
              strokeLinecap="round"
              className={!reducedMotion ? 'plant-sway' : ''}
            />
            <circle cx="14" cy="-29" r="2.5" fill={avatar.skinTone} />
          </g>
        ) : isTyping ? (
          <g className={!reducedMotion ? 'cat-breathe' : ''}>
            <path
              d="M -9,-10 Q -12,-4 -5,-2"
              fill="none"
              stroke={avatar.clothingColor}
              strokeWidth="3.6"
              strokeLinecap="round"
            />
            <path
              d="M 9,-10 Q 12,-4 5,-2"
              fill="none"
              stroke={avatar.clothingColor}
              strokeWidth="3.6"
              strokeLinecap="round"
            />
            <circle cx="-4.5" cy="-1.5" r="2.1" fill={avatar.skinTone} />
            <circle cx="4.5" cy="-1.5" r="2.1" fill={avatar.skinTone} />
          </g>
        ) : (
          <g>
            <path
              d="M -9,-10 Q -12,-3 -6,-1"
              fill="none"
              stroke={avatar.clothingColor}
              strokeWidth="3.6"
              strokeLinecap="round"
            />
            <path
              d="M 9,-10 Q 12,-3 6,-1"
              fill="none"
              stroke={avatar.clothingColor}
              strokeWidth="3.6"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Open Hardcover Book in hands when Reading/Studying */}
        {isReading && !isWaving && (
          <g transform="translate(0, -1)">
            <polygon
              points="-8,-2 0,-5 8,-2 0,2"
              fill="#F7EDE2"
              stroke="#6E4420"
              strokeWidth="0.9"
            />
            <line x1="0" y1="-5" x2="0" y2="2" stroke="#8C582B" strokeWidth="0.8" />
          </g>
        )}

        {/* Head & Face */}
        <circle
          cx="0"
          cy="-21"
          r="7.8"
          fill={avatar.skinTone}
          stroke="#4A2E1B"
          strokeWidth="0.8"
        />

        {/* Eyes & Gentle Expression */}
        <circle cx="-2.6" cy="-20.5" r="0.9" fill="#2B1A10" />
        <circle cx="2.6" cy="-20.5" r="0.9" fill="#2B1A10" />
        <ellipse cx="-4.5" cy="-19" rx="1.4" ry="0.8" fill="#E57A68" opacity="0.45" />
        <ellipse cx="4.5" cy="-19" rx="1.4" ry="0.8" fill="#E57A68" opacity="0.45" />
        <path
          d="M -1.5,-17.5 Q 0,-16.3 1.6,-17.5"
          fill="none"
          stroke="#4A2E1B"
          strokeWidth="0.8"
          strokeLinecap="round"
        />

        {/* Hair Styles */}
        {avatar.hairStyle === 'short' && (
          <path
            d="M -8,-22 C -8,-31 8,-31 8,-22 C 6,-25 -6,-25 -8,-22 Z"
            fill={avatar.hairColor}
          />
        )}
        {avatar.hairStyle === 'bun' && (
          <g>
            <circle cx="0" cy="-30.5" r="4.2" fill={avatar.hairColor} />
            <path
              d="M -8,-21 C -8,-30 8,-30 8,-21 C 5,-25 -5,-25 -8,-21 Z"
              fill={avatar.hairColor}
            />
          </g>
        )}
        {avatar.hairStyle === 'bob' && (
          <path
            d="M -8.5,-17 C -9.5,-31 9.5,-31 8.5,-17 L 6.5,-17 C 6.5,-24 -6.5,-24 -6.5,-17 Z"
            fill={avatar.hairColor}
          />
        )}
        {avatar.hairStyle === 'curly' && (
          <g fill={avatar.hairColor}>
            <circle cx="-6" cy="-24" r="3.8" />
            <circle cx="6" cy="-24" r="3.8" />
            <circle cx="-3" cy="-27.5" r="4.2" />
            <circle cx="3" cy="-27.5" r="4.2" />
            <circle cx="0" cy="-28.5" r="4" />
          </g>
        )}
        {avatar.hairStyle === 'beanie' && (
          <g>
            <path
              d="M -8.2,-22 C -8,-32 8,-32 8.2,-22 Z"
              fill="#C85A32"
              stroke="#5C2410"
              strokeWidth="0.7"
            />
            <rect
              x="-8.5"
              y="-24"
              width="17"
              height="3.2"
              rx="1.5"
              fill="#E07A52"
            />
            <circle cx="0" cy="-31" r="2.2" fill="#F4ECE1" />
          </g>
        )}

        {/* Optional Glasses Accessory */}
        {avatar.accessory === 'glasses' && (
          <g stroke="#3B2314" strokeWidth="0.85" fill="rgba(255, 250, 240, 0.2)">
            <circle cx="-2.8" cy="-20.5" r="2.2" />
            <circle cx="2.8" cy="-20.5" r="2.2" />
            <line x1="-0.6" y1="-20.5" x2="0.6" y2="-20.5" />
          </g>
        )}

        {/* Optional Studio Headphones Accessory */}
        {avatar.accessory === 'headphones' && (
          <g>
            <path
              d="M -8.5,-21 C -8.5,-31 8.5,-31 8.5,-21"
              fill="none"
              stroke="#2D3748"
              strokeWidth="2"
            />
            <ellipse
              cx="-8.5"
              cy="-20.5"
              rx="1.8"
              ry="3.2"
              fill="#E2A04A"
              stroke="#1A202C"
              strokeWidth="0.6"
            />
            <ellipse
              cx="8.5"
              cy="-20.5"
              rx="1.8"
              ry="3.2"
              fill="#E2A04A"
              stroke="#1A202C"
              strokeWidth="0.6"
            />
          </g>
        )}

        {/* Integrated Overhead Nameplate with Real Circular GitHub/X Profile Picture */}
        <g
          transform={`translate(0, ${isHovered ? -46 : -43})`}
          opacity={labelOpacity}
          className="transition-all duration-300"
        >
          {/* Main Nameplate Pill */}
          <rect
            x="-55"
            y={isHovered ? -13 : -11}
            width="112"
            height={isHovered ? 26 : 22}
            rx={isHovered ? 13 : 11}
            fill={isSelf ? 'rgba(20, 33, 25, 0.95)' : 'rgba(24, 16, 12, 0.92)'}
            stroke={
              isHovered
                ? '#F3B664'
                : isSelf
                ? '#68D391'
                : 'rgba(212, 140, 70, 0.55)'
            }
            strokeWidth={isHovered || isSelf ? '1.2' : '0.85'}
          />

          {/* Circular Avatar Frame & Fallback Monogram */}
          <circle
            cx="-41"
            cy="0"
            r="8.6"
            fill="#2B1C14"
            stroke={isSelf ? '#68D391' : '#F3B664'}
            strokeWidth="1"
          />
          <text
            x="-41"
            y="2.5"
            textAnchor="middle"
            fill="#F3B664"
            fontSize="7.2"
            fontFamily="Plus Jakarta Sans, sans-serif"
            fontWeight="700"
          >
            {displayName.slice(0, 1).toUpperCase()}
          </text>

          {/* Actual GitHub / X Profile Picture Clipped to Circle */}
          {safeAvatarUrl && (
            <image
              href={safeAvatarUrl}
              x="-49.5"
              y="-8.5"
              width="17"
              height="17"
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#${clipId})`}
              onError={() => setImgFailed(true)}
            />
          )}

          {/* Provider Badge (GitHub Octocat or X Logo) on Avatar Corner */}
          {primaryIdentity && (
            <ProviderMiniBadge
              provider={primaryIdentity.provider}
              cx={-34}
              cy={6}
            />
          )}

          {/* Activity Status Dot + Display Name */}
          <circle cx="-25" cy={isHovered ? -3.5 : -2.5} r="2.3" fill={meta.dotColor} />
          <text
            x="-19"
            y={isHovered ? -1 : 0}
            textAnchor="start"
            fill="#FAF0E4"
            fontSize="6.7"
            fontFamily="Plus Jakarta Sans, sans-serif"
            fontWeight="700"
          >
            {displayName.slice(0, 12)}
            {isSelf ? ' (You)' : ''}
          </text>

          {/* Sub-line: @username or Activity Status + Focus Duration */}
          <text
            x="-26"
            y={isHovered ? 7.2 : 6.2}
            textAnchor="start"
            fill={isHovered ? '#F3B664' : '#C9B39B'}
            fontSize="5.4"
            fontFamily="Plus Jakarta Sans, sans-serif"
            fontWeight="500"
          >
            {isHovered && primaryIdentity
              ? `@${primaryIdentity.username.slice(0, 12)} • ${meta.label}`
              : `${meta.label}${focusMins ? ` • ${focusMins}m` : ''}`}
          </text>
        </g>

        {/* Floating Reaction Bubble (Wave, Coffee, Celebrate, etc.) */}
        {activeReaction && (
          <g
            transform="translate(0, -68)"
            className={!reducedMotion ? 'animate-bounce' : ''}
          >
            <rect
              x="-54"
              y="-12"
              width="108"
              height="20"
              rx="10"
              fill="#231710"
              stroke="#F3B664"
              strokeWidth="1.2"
            />
            <text
              x="0"
              y="1.5"
              textAnchor="middle"
              fill="#FFE4B5"
              fontSize="8"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fontWeight="700"
            >
              {REACTION_EMOJI[activeReaction.kind]?.symbol || '👋'}{' '}
              {REACTION_EMOJI[activeReaction.kind]?.text || 'Hello!'}
            </text>
          </g>
        )}
      </g>
    );
  }
);

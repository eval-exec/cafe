import React from 'react';
import {
  ActivityStatus,
  AvatarConfig,
  ReactionEvent,
  ReactionKind,
  VisitorPresence,
} from '../../types';

interface IsoAvatarProps {
  visitor: VisitorPresence;
  x: number;
  y: number;
  isSelf: boolean;
  isSeated: boolean;
  activeReaction?: ReactionEvent | null;
  reducedMotion: boolean;
  onSelectVisitor?: (visitor: VisitorPresence) => void;
}

const STATUS_META: Record<
  ActivityStatus,
  { label: string; color: string; dotColor: string }
> = {
  focusing: { label: 'Focusing', color: '#F3B664', dotColor: '#F3B664' },
  coding: { label: 'Coding', color: '#68D391', dotColor: '#68D391' },
  studying: { label: 'Studying', color: '#90CDF4', dotColor: '#63B3ED' },
  reading: { label: 'Reading', color: '#F6AD55', dotColor: '#ED8936' },
  break: { label: 'On a Break', color: '#FBD38D', dotColor: '#ECC94B' },
  chatting: { label: 'Open to Chat', color: '#68D391', dotColor: '#48BB78' },
  dnd: { label: 'Do Not Disturb', color: '#FC8181', dotColor: '#F56565' },
};

const REACTION_EMOJI: Record<ReactionKind, { symbol: string; text: string }> = {
  wave: { symbol: '👋', text: 'Waved hello!' },
  hello: { symbol: '💬', text: 'Says bonjour!' },
  coffee: { symbol: '☕', text: 'Sent a warm espresso!' },
  thumbsup: { symbol: '👍', text: 'Cheered your focus!' },
  celebrate: { symbol: '🎉', text: 'Celebrated session!' },
};

export const IsoAvatar: React.FC<IsoAvatarProps> = React.memo(
  ({
    visitor,
    x,
    y,
    isSelf,
    isSeated,
    activeReaction,
    reducedMotion,
    onSelectVisitor,
  }) => {
    const { avatar, displayName, activityStatus, focusStartedAtMs } = visitor;
    const meta = STATUS_META[activityStatus] || STATUS_META.focusing;
    const isWaving = activeReaction?.kind === 'wave' || activeReaction?.kind === 'hello';
    const isTyping =
      isSeated && (activityStatus === 'coding' || activityStatus === 'focusing');
    const isReading = isSeated && activityStatus === 'reading';

    // Calculate elapsed focus minutes if visitor shares focus time
    const focusMins =
      focusStartedAtMs && focusStartedAtMs > 0
        ? Math.max(1, Math.floor((Date.now() - focusStartedAtMs) / 60000))
        : null;

    return (
      <g
        transform={`translate(${x}, ${y})`}
        onClick={(e) => {
          if (onSelectVisitor) {
            e.stopPropagation();
            onSelectVisitor(visitor);
          }
        }}
        className="cursor-pointer select-none group"
        role="button"
        tabIndex={0}
        aria-label={`${displayName} (${meta.label})`}
      >
        {/* Subtle Self Highlight Ring on Floor */}
        {isSelf && (
          <ellipse
            cx="0"
            cy="6"
            rx="18"
            ry="10"
            fill="rgba(104, 211, 145, 0.18)"
            stroke="#68D391"
            strokeWidth="1.2"
            strokeDasharray="3 2"
          />
        )}

        {/* Standing Legs (when standing in reception entryway) */}
        {!isSeated && (
          <g>
            <ellipse cx="0" cy="8" rx="12" ry="6.5" fill="rgba(12, 8, 5, 0.42)" />
            <line
              x1="-4"
              y1="-2"
              x2="-4"
              y2="7"
              stroke="#2D3748"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <line
              x1="4"
              y1="-2"
              x2="4"
              y2="7"
              stroke="#2D3748"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Torso / Cozy Sweater */}
        <path
          d="M -11,-2 C -12,-17 12,-17 11,-2 Z"
          fill={avatar.clothingColor}
          stroke="#2A1C14"
          strokeWidth="0.9"
        />

        {/* Optional Cozy Knit Scarf Accessory */}
        {avatar.accessory === 'scarf' && (
          <g>
            <path
              d="M -8,-14 Q 0,-11 8,-14 L 7,-10 Q 0,-7 -7,-10 Z"
              fill="#D96B43"
              stroke="#5C2816"
              strokeWidth="0.6"
            />
            <rect
              x="2"
              y="-11"
              width="3.8"
              height="8"
              rx="1.5"
              fill="#D96B43"
              stroke="#5C2816"
              strokeWidth="0.5"
            />
          </g>
        )}

        {/* Arms (Animated Typing, Reading Book, or Waving) */}
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
        ) : isReading ? (
          <g>
            <path
              d="M -9,-10 Q -8,-3 -3,-3"
              fill="none"
              stroke={avatar.clothingColor}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <path
              d="M 9,-10 Q 8,-3 3,-3"
              fill="none"
              stroke={avatar.clothingColor}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Held Open Hardcover Book */}
            <polygon
              points="-7,-6 0,-4 7,-6 7,-1 0,1 -7,-1"
              fill="#FBF3E4"
              stroke="#6E4423"
              strokeWidth="0.8"
            />
          </g>
        ) : (
          <g>
            <path
              d="M -10,-11 Q -12,-5 -7,-3"
              fill="none"
              stroke={avatar.clothingColor}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <path
              d="M 10,-11 Q 12,-5 7,-3"
              fill="none"
              stroke={avatar.clothingColor}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
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
        {/* Warm rosy cheeks */}
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

        {/* Overhead Name & Activity Status Pill */}
        <g transform="translate(0, -40)">
          <rect
            x="-48"
            y="-9"
            width="96"
            height="16"
            rx="8"
            fill={isSelf ? 'rgba(22, 34, 27, 0.92)' : 'rgba(24, 17, 13, 0.88)'}
            stroke={isSelf ? '#68D391' : 'rgba(212, 140, 70, 0.45)'}
            strokeWidth={isSelf ? '1.1' : '0.8'}
          />
          <circle cx="-39" cy="-1" r="2.6" fill={meta.dotColor} />
          <text
            x="3"
            y="1.8"
            textAnchor="middle"
            fill="#F9EFE3"
            fontSize="6.8"
            fontFamily="Plus Jakarta Sans, sans-serif"
            fontWeight="600"
          >
            {displayName.slice(0, 12)}
            {isSelf ? ' (You)' : ''}
            {focusMins ? ` • ${focusMins}m` : ''}
          </text>
        </g>

        {/* Floating Reaction Bubble (Wave, Coffee, Celebrate, etc.) */}
        {activeReaction && (
          <g
            transform="translate(0, -60)"
            className={!reducedMotion ? 'animate-bounce' : ''}
          >
            <rect
              x="-52"
              y="-12"
              width="104"
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

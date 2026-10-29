import React, { useState } from 'react';
import {
  Ban,
  Clock,
  Coffee,
  ExternalLink,
  Flag,
  Hand,
  Sparkles,
  UserCheck,
  UserPlus,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  ActivityStatus,
  ReactionKind,
  SeatId,
  SocialIdentity,
  SocialProvider,
  UserProfile,
  VisitorPresence,
} from '../../types';
import { SEATS } from '../../utils/isometric';
import {
  buildSafeProfileUrl,
  validateSafeAvatarUrl,
} from '../../network/multiplayerClient';

interface VisitorProfileCardModalProps {
  visitor: VisitorPresence | null;
  profile: UserProfile;
  currentSeatId: SeatId | null;
  seatOccupancy: Record<string, string>;
  onClose: () => void;
  onSendReaction: (kind: ReactionKind, targetUserId: string | null) => void;
  onAddFriend: (visitor: VisitorPresence) => void;
  onRemoveFriend: (userId: string) => void;
  onSelectSeat: (seatId: SeatId) => void;
  onInviteToTable: (visitor: VisitorPresence) => void;
  onToggleMuteUser: (userId: string) => void;
  onToggleBlockUser: (userId: string) => void;
  onReportUser: (userId: string, reason: string) => void;
  onRequireAuth: () => void;
}

const ACTIVITY_LABELS: Record<ActivityStatus, { label: string; badge: string }> = {
  focusing: {
    label: 'Focusing',
    badge: 'text-emerald-300 bg-emerald-950/60 border-emerald-500/35',
  },
  coding: {
    label: 'Coding',
    badge: 'text-sky-300 bg-sky-950/60 border-sky-500/35',
  },
  studying: {
    label: 'Studying',
    badge: 'text-amber-300 bg-amber-950/60 border-amber-500/35',
  },
  reading: {
    label: 'Reading',
    badge: 'text-purple-300 bg-purple-950/60 border-purple-500/35',
  },
  break: {
    label: 'On Break',
    badge: 'text-yellow-200 bg-yellow-950/60 border-yellow-500/35',
  },
  chatting: {
    label: 'Open to Chat',
    badge: 'text-teal-300 bg-teal-950/60 border-teal-500/35',
  },
  dnd: {
    label: 'Do Not Disturb',
    badge: 'text-rose-300 bg-rose-950/60 border-rose-500/35',
  },
};

export const ProviderIcon: React.FC<{
  provider: SocialProvider;
  className?: string;
}> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 0.5C5.65 0.5 0.5 5.65 0.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11.05 11.05 0 0 1 5.78 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35 0.5 12 0.5Z" />
  </svg>
);

export const VisitorProfileCardModal: React.FC<VisitorProfileCardModalProps> = ({
  visitor,
  profile,
  currentSeatId,
  seatOccupancy,
  onClose,
  onSendReaction,
  onAddFriend,
  onRemoveFriend,
  onSelectSeat,
  onInviteToTable,
  onToggleMuteUser,
  onToggleBlockUser,
  onReportUser,
  onRequireAuth,
}) => {
  const [imgError, setImgError] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  if (!visitor) return null;

  const isSelf = visitor.userId === profile.userId;
  const isFriend = profile.friends.some((f) => f.userId === visitor.userId);
  const isMuted = profile.mutedUserIds.includes(visitor.userId);
  const isBlocked = profile.blockedUserIds.includes(visitor.userId);

  const primaryIdentity: SocialIdentity | null = visitor.primaryIdentity || null;
  const publicIdentities: SocialIdentity[] =
    visitor.linkedIdentities && visitor.linkedIdentities.length > 0
      ? visitor.linkedIdentities.filter((i) => i.isPublic !== false)
      : primaryIdentity
      ? [primaryIdentity]
      : [];

  const safeAvatarUrl = !imgError
    ? validateSafeAvatarUrl(visitor.avatarUrl || primaryIdentity?.avatarUrl)
    : null;

  const actMeta =
    ACTIVITY_LABELS[visitor.activityStatus] || ACTIVITY_LABELS.focusing;
  const seatInfo = visitor.seatId ? SEATS[visitor.seatId] : null;

  const focusDurationMins =
    visitor.focusStartedAtMs && visitor.focusStartedAtMs > 0
      ? Math.max(1, Math.floor((Date.now() - visitor.focusStartedAtMs) / 60000))
      : null;

  // Check if there is an available seat at the visitor's table
  const findOpenSeatAtVisitorTable = (): SeatId | null => {
    if (!visitor.seatId || !SEATS[visitor.seatId]) return null;
    const tableId = SEATS[visitor.seatId].tableId;
    const candidates = (Object.keys(SEATS) as SeatId[]).filter(
      (sid) => SEATS[sid].tableId === tableId && sid !== visitor.seatId
    );
    return (
      candidates.find(
        (sid) => !seatOccupancy[sid] || seatOccupancy[sid] === profile.userId
      ) || null
    );
  };

  const openTableSeat = findOpenSeatAtVisitorTable();

  const showTempFeedback = (msg: string) => {
    setActionFeedback(msg);
    window.setTimeout(() => setActionFeedback(null), 2600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl cafe-glass-panel border border-amber-300/30 p-5 text-amber-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`${visitor.displayName} Social Profile Card`}
      >
        {/* Header with Real Social Avatar + Name + Provider Username */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3.5">
            <div className="relative w-16 h-16 rounded-full bg-amber-950/80 border-2 border-amber-400/60 flex items-center justify-center overflow-hidden shadow-lg shrink-0">
              {safeAvatarUrl ? (
                <img
                  src={safeAvatarUrl}
                  alt={visitor.displayName}
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl font-bold text-amber-200">
                  {visitor.displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
              {primaryIdentity && (
                <span
                  className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#140E0B] border border-amber-400/60 flex items-center justify-center text-amber-100 shadow"
                  title="Verified via GitHub"
                >
                  <ProviderIcon
                    provider={primaryIdentity.provider}
                    className="w-3 h-3"
                  />
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-serif text-lg font-semibold text-amber-50 leading-tight">
                  {visitor.displayName}
                </h3>
                {isSelf && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-semibold">
                    You
                  </span>
                )}
              </div>

              {primaryIdentity ? (
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-amber-200/80">
                  <ProviderIcon
                    provider={primaryIdentity.provider}
                    className="w-3.5 h-3.5 text-amber-300"
                  />
                  <span className="font-medium">@{primaryIdentity.username}</span>
                </div>
              ) : (
                <p className="text-xs text-amber-200/60 mt-0.5">Café Visitor</p>
              )}

              {/* Activity Status & Focus Duration Badge */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${actMeta.badge}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {actMeta.label}
                </span>
                {focusDurationMins !== null && (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/25 text-amber-200">
                    <Clock className="w-3 h-3 text-amber-300" />
                    {focusDurationMins}m in focus
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-amber-200/60 hover:text-amber-100 hover:bg-white/10 transition-colors"
            aria-label="Close visitor profile card"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Seat & Shared Focus Goal Info */}
        <div className="rounded-2xl bg-black/30 border border-amber-200/12 p-3 mb-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-amber-200/60">Current Seat</span>
            <span className="font-medium text-amber-100">
              {seatInfo ? `${seatInfo.name} (${seatInfo.zoneLabel})` : 'Standing in Lounge'}
            </span>
          </div>
          {visitor.shareFocusGoal && visitor.focusGoal && (
            <div className="pt-1.5 border-t border-amber-200/10">
              <span className="block text-[10px] uppercase tracking-wider text-amber-300/65">
                Current Focus Goal
              </span>
              <p className="text-xs text-amber-100 italic mt-0.5">
                “{visitor.focusGoal}”
              </p>
            </div>
          )}
        </div>

        {/* Public Linked Social Profiles (GitHub & X External Links) */}
        {publicIdentities.length > 0 && (
          <div className="space-y-1.5 mb-4">
            <span className="block text-[10px] uppercase tracking-wider text-amber-200/60 font-semibold">
              Verified Social Profiles
            </span>
            {publicIdentities.map((ident) => {
              const href = buildSafeProfileUrl(ident.provider, ident.username);
              return (
                <a
                  key={ident.id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 hover:bg-amber-500/15 border border-amber-200/15 hover:border-amber-400/40 transition-all text-xs text-amber-100 group"
                >
                  <span className="flex items-center gap-2">
                    <ProviderIcon
                      provider={ident.provider}
                      className="w-3.5 h-3.5 text-amber-300"
                    />
                    <span className="font-medium">
                      GitHub • @{ident.username}
                    </span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-amber-300/70 group-hover:text-amber-200 transition-colors" />
                </a>
              );
            })}
          </div>
        )}

        {actionFeedback && (
          <div className="mb-3 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/35 text-xs text-amber-100 text-center">
            {actionFeedback}
          </div>
        )}

        {/* Social Actions for Other Visitors */}
        {!isSelf && (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {/* Wave Button */}
              <button
                onClick={() => {
                  if (!profile.isAuthenticated) {
                    onRequireAuth();
                    return;
                  }
                  onSendReaction('wave', visitor.userId);
                  showTempFeedback(`Waved hello to ${visitor.displayName}! 👋`);
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-100 text-xs font-semibold transition-all"
              >
                <Hand className="w-3.5 h-3.5 text-amber-300" />
                Wave Hello
              </button>

              {/* Add / Remove Friend Button */}
              {isFriend ? (
                <button
                  onClick={() => {
                    onRemoveFriend(visitor.userId);
                    showTempFeedback(`Removed ${visitor.displayName} from friends.`);
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-rose-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-semibold transition-all"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Friends
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (!profile.isAuthenticated) {
                      onRequireAuth();
                      return;
                    }
                    onAddFriend(visitor);
                    showTempFeedback(`Added ${visitor.displayName} as a café friend!`);
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-amber-200/20 text-amber-100 text-xs font-semibold transition-all"
                >
                  <UserPlus className="w-3.5 h-3.5 text-amber-300" />
                  Add Friend
                </button>
              )}

              {/* Invite to Table */}
              <button
                onClick={() => {
                  if (!profile.isAuthenticated) {
                    onRequireAuth();
                    return;
                  }
                  onInviteToTable(visitor);
                  showTempFeedback(
                    currentSeatId
                      ? `Invited ${visitor.displayName} to your table!`
                      : `Copied table invite link for ${visitor.displayName}!`
                  );
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-amber-200/20 text-amber-100 text-xs font-semibold transition-all"
              >
                <Coffee className="w-3.5 h-3.5 text-amber-300" />
                Invite to Table
              </button>

              {/* Join Their Table if Open Seat Exists */}
              {openTableSeat ? (
                <button
                  onClick={() => {
                    if (!profile.isAuthenticated) {
                      onRequireAuth();
                      return;
                    }
                    onSelectSeat(openTableSeat);
                    onClose();
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/35 text-emerald-200 text-xs font-semibold transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Sit at Table
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (!profile.isAuthenticated) {
                      onRequireAuth();
                      return;
                    }
                    onSendReaction('coffee', visitor.userId);
                    showTempFeedback(`Sent a coffee clink to ${visitor.displayName}! ☕`);
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-amber-200/20 text-amber-100 text-xs font-semibold transition-all"
                >
                  <Coffee className="w-3.5 h-3.5 text-amber-300" />
                  Clink Coffee ☕
                </button>
              )}
            </div>

            {/* Safety & Moderation Bar: Mute, Block, Report */}
            <div className="flex items-center justify-between pt-3 border-t border-amber-200/12 text-[11px]">
              <button
                onClick={() => {
                  onToggleMuteUser(visitor.userId);
                  showTempFeedback(isMuted ? 'Unmuted visitor.' : 'Muted visitor.');
                }}
                className="flex items-center gap-1 text-amber-200/65 hover:text-amber-100 transition-colors"
              >
                {isMuted ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                {isMuted ? 'Unmute' : 'Mute'}
              </button>

              <button
                onClick={() => {
                  onToggleBlockUser(visitor.userId);
                  showTempFeedback(isBlocked ? 'Unblocked visitor.' : 'Blocked visitor.');
                }}
                className="flex items-center gap-1 text-amber-200/65 hover:text-rose-300 transition-colors"
              >
                <Ban className="w-3.5 h-3.5" />
                {isBlocked ? 'Unblock' : 'Block'}
              </button>

              <button
                onClick={() => {
                  onReportUser(visitor.userId, 'Reported from social profile card');
                  showTempFeedback('Report submitted to café moderators.');
                }}
                className="flex items-center gap-1 text-amber-200/65 hover:text-rose-300 transition-colors"
              >
                <Flag className="w-3.5 h-3.5" />
                Report
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

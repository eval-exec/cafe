import React, { useState } from 'react';
import {
  Ban,
  Coffee,
  Copy,
  Flag,
  Hand,
  Heart,
  MessageSquare,
  Send,
  ShieldAlert,
  Sparkles,
  ThumbsUp,
  UserPlus,
  Users,
  VolumeX,
  X,
} from 'lucide-react';
import {
  ChatMessage,
  FriendEntry,
  ReactionKind,
  SeatConfig,
  SeatId,
  UserProfile,
  VisitorPresence,
} from '../../types';
import { SEATS } from '../../utils/isometric';

interface SocialLoungeDrawerProps {
  isOpen: boolean;
  profile: UserProfile;
  visitors: VisitorPresence[];
  messages: ChatMessage[];
  activeSeat: SeatConfig | null;
  selectedVisitor: VisitorPresence | null;
  roomName: string;
  onClose: () => void;
  onSendReaction: (kind: ReactionKind, targetUserId?: string | null) => void;
  onSendChat: (tableId: string, text: string) => void;
  onSelectSeat: (seatId: SeatId) => void;
  onUpdateProfile: (next: UserProfile) => void;
  onReportUser: (userId: string, reason: string) => void;
  onClearSelectedVisitor: () => void;
}

export const SocialLoungeDrawer: React.FC<SocialLoungeDrawerProps> = ({
  isOpen,
  profile,
  visitors,
  messages,
  activeSeat,
  selectedVisitor,
  roomName,
  onClose,
  onSendReaction,
  onSendChat,
  onSelectSeat,
  onUpdateProfile,
  onReportUser,
  onClearSelectedVisitor,
}) => {
  const [tab, setTab] = useState<'people' | 'chat' | 'friends' | 'rules'>('people');
  const [chatInput, setChatInput] = useState('');
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [moderationNotice, setModerationNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  // Determine active conversation channel: table-scoped or social-lounge
  const currentTableChannel =
    activeSeat && activeSeat.allowsTableChat
      ? activeSeat.tableId
      : 'social-lounge';

  const isQuietStudyProtected =
    (activeSeat && !activeSeat.allowsTableChat) ||
    profile.activityStatus === 'dnd';

  // Filter out blocked or muted users from chat
  const visibleMessages = messages.filter(
    (m) =>
      m.tableId === currentTableChannel &&
      !profile.blockedUserIds.includes(m.senderId) &&
      !profile.mutedUserIds.includes(m.senderId)
  );

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    onSendChat(currentTableChannel, trimmed);
    setChatInput('');
  };

  const handleCopyInviteLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('scene', 'interior');
    if (activeSeat) {
      url.searchParams.set('table', activeSeat.tableId);
    }
    navigator.clipboard?.writeText(url.toString()).catch(() => {});
    setCopiedInvite(true);
    window.setTimeout(() => setCopiedInvite(false), 2200);
  };

  const toggleFriend = (visitor: VisitorPresence) => {
    const exists = profile.friends.some((f) => f.userId === visitor.userId);
    let nextFriends: FriendEntry[];
    if (exists) {
      nextFriends = profile.friends.filter((f) => f.userId !== visitor.userId);
    } else {
      nextFriends = [
        ...profile.friends,
        {
          userId: visitor.userId,
          displayName: visitor.displayName,
          avatar: visitor.avatar,
          addedAt: Date.now(),
        },
      ];
    }
    onUpdateProfile({ ...profile, friends: nextFriends });
  };

  const toggleMuteUser = (targetId: string) => {
    const isMuted = profile.mutedUserIds.includes(targetId);
    const nextMuted = isMuted
      ? profile.mutedUserIds.filter((id) => id !== targetId)
      : [...profile.mutedUserIds, targetId];
    onUpdateProfile({ ...profile, mutedUserIds: nextMuted });
    setModerationNotice(isMuted ? 'User unmuted.' : 'User muted for this session.');
    window.setTimeout(() => setModerationNotice(null), 2500);
  };

  const toggleBlockUser = (targetId: string) => {
    const isBlocked = profile.blockedUserIds.includes(targetId);
    const nextBlocked = isBlocked
      ? profile.blockedUserIds.filter((id) => id !== targetId)
      : [...profile.blockedUserIds, targetId];
    onUpdateProfile({ ...profile, blockedUserIds: nextBlocked });
    setModerationNotice(isBlocked ? 'User unblocked.' : 'User blocked.');
    window.setTimeout(() => setModerationNotice(null), 2500);
  };

  // Find an available seat at the same table as a friend/visitor
  const findAdjacentAvailableSeat = (visitorSeatId: SeatId | null): SeatId | null => {
    if (!visitorSeatId || !SEATS[visitorSeatId]) return null;
    const targetTable = SEATS[visitorSeatId].tableId;
    const occupiedIds = new Set(visitors.map((v) => v.seatId).filter(Boolean));
    const candidate = Object.values(SEATS).find(
      (s) => s.tableId === targetTable && !occupiedIds.has(s.id)
    );
    return candidate ? candidate.id : null;
  };

  return (
    <div
      className="fixed top-20 right-4 sm:right-6 z-40 w-[350px] sm:w-[400px] max-h-[75vh] flex flex-col rounded-2xl bg-[#1A130F]/95 backdrop-blur-xl border border-[#D48C46]/35 shadow-2xl p-4 text-[#F4ECE1] animate-fade-in"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#D48C46]/20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#D48C46]/20 border border-[#D48C46]/40 flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-[#F3B664]" />
          </div>
          <div>
            <h3 className="font-serif text-sm font-semibold text-[#F9EFE3]">
              {roomName} • Social &amp; Presence
            </h3>
            <p className="text-[11px] text-[#C8B6A6]">
              {visitors.length} {visitors.length === 1 ? 'person' : 'people'} in café room
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopyInviteLink}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#D48C46]/20 hover:bg-[#D48C46]/35 border border-[#F3B664]/40 text-[#FFE0B5] text-[10px] font-semibold transition-colors"
            title="Copy link to invite a friend to this café room"
          >
            <Copy className="w-3 h-3" />
            <span>{copiedInvite ? 'Copied!' : 'Invite Friend'}</span>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#C8B6A6] hover:text-[#F4ECE1] hover:bg-white/5"
            aria-label="Close social drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Lightweight Reactions Bar */}
      <div className="mb-3 p-2 rounded-xl bg-[#241A15] border border-white/5 shrink-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#C8B6A6] mb-1.5 flex items-center justify-between">
          <span>
            {selectedVisitor
              ? `Send reaction to ${selectedVisitor.displayName}:`
              : 'Send gentle reaction to room:'}
          </span>
          {selectedVisitor && (
            <button
              onClick={onClearSelectedVisitor}
              className="text-[#F3B664] hover:underline"
            >
              Clear target
            </button>
          )}
        </div>
        <div className="grid grid-cols-5 gap-1">
          {(
            [
              { kind: 'wave', label: 'Wave', icon: '👋' },
              { kind: 'hello', label: 'Bonjour', icon: '💬' },
              { kind: 'coffee', label: 'Coffee', icon: '☕' },
              { kind: 'thumbsup', label: 'Cheer', icon: '👍' },
              { kind: 'celebrate', label: 'Bravo', icon: '🎉' },
            ] as const
          ).map((rx) => (
            <button
              key={rx.kind}
              onClick={() =>
                onSendReaction(rx.kind, selectedVisitor?.userId || null)
              }
              className="flex flex-col items-center py-1.5 px-1 rounded-lg bg-[#1A130F] hover:bg-[#33241B] border border-white/5 hover:border-[#F3B664]/50 transition-all"
            >
              <span className="text-sm">{rx.icon}</span>
              <span className="text-[10px] text-[#D6C5B5] mt-0.5">{rx.label}</span>
            </button>
          ))}
        </div>
      </div>

      {moderationNotice && (
        <div className="mb-2.5 px-3 py-1.5 rounded-lg bg-[#D48C46]/20 border border-[#F3B664]/40 text-[11px] text-[#FFE0B5]">
          {moderationNotice}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex gap-1 border-b border-white/10 pb-2 mb-2.5 shrink-0">
        <button
          onClick={() => setTab('people')}
          className={`flex-1 py-1 rounded-lg text-xs font-semibold transition-colors ${
            tab === 'people'
              ? 'bg-[#D48C46]/25 text-[#FFE0B5]'
              : 'text-[#A89686] hover:text-[#F4ECE1]'
          }`}
        >
          In Café ({visitors.length})
        </button>
        <button
          onClick={() => setTab('chat')}
          className={`flex-1 py-1 rounded-lg text-xs font-semibold transition-colors ${
            tab === 'chat'
              ? 'bg-[#D48C46]/25 text-[#FFE0B5]'
              : 'text-[#A89686] hover:text-[#F4ECE1]'
          }`}
        >
          Table Chat ({visibleMessages.length})
        </button>
        <button
          onClick={() => setTab('friends')}
          className={`flex-1 py-1 rounded-lg text-xs font-semibold transition-colors ${
            tab === 'friends'
              ? 'bg-[#D48C46]/25 text-[#FFE0B5]'
              : 'text-[#A89686] hover:text-[#F4ECE1]'
          }`}
        >
          Friends ({profile.friends.length})
        </button>
        <button
          onClick={() => setTab('rules')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
            tab === 'rules'
              ? 'bg-[#D48C46]/25 text-[#FFE0B5]'
              : 'text-[#A89686] hover:text-[#F4ECE1]'
          }`}
          title="Community Guidelines & Safety"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
        {tab === 'people' && (
          <div className="space-y-2">
            {visitors.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#8C7A6B]">
                You are in Invisible Mode. Turn off Invisible Mode in your Avatar settings to appear in the room.
              </div>
            ) : (
              visitors.map((v) => {
                const isSelf = v.userId === profile.userId;
                const seatInfo = v.seatId ? SEATS[v.seatId] : null;
                const isFriend = profile.friends.some((f) => f.userId === v.userId);
                const isMuted = profile.mutedUserIds.includes(v.userId);
                const isBlocked = profile.blockedUserIds.includes(v.userId);
                const adjacentSeat = !isSelf
                  ? findAdjacentAvailableSeat(v.seatId)
                  : null;

                return (
                  <div
                    key={v.userId}
                    className={`p-2.5 rounded-xl border transition-all ${
                      isSelf
                        ? 'bg-[#251D17] border-[#68D391]/40'
                        : 'bg-[#241A15] border-white/5 hover:border-[#D48C46]/35'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-7 h-7 rounded-full border border-white/20 flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ backgroundColor: v.avatar.clothingColor }}
                        >
                          {v.displayName.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#F9EFE3] truncate flex items-center gap-1.5">
                            <span>{v.displayName}</span>
                            {isSelf && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#68D391]/20 text-[#9AE6B4]">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#C8B6A6] truncate">
                            {seatInfo
                              ? `${seatInfo.name} (${seatInfo.zoneLabel})`
                              : 'Standing in Reception'}{' '}
                            • <span className="text-[#F3B664]">{v.activityStatus}</span>
                          </div>
                          {v.focusGoal && (
                            <div className="text-[10px] text-[#9AE6B4] truncate mt-0.5">
                              Goal: “{v.focusGoal}”
                            </div>
                          )}
                        </div>
                      </div>

                      {!isSelf && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => onSendReaction('wave', v.userId)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-[#D48C46]/30 text-xs"
                            title={`Wave to ${v.displayName}`}
                          >
                            👋
                          </button>
                          <button
                            onClick={() => toggleFriend(v)}
                            className={`p-1.5 rounded-lg text-xs transition-colors ${
                              isFriend
                                ? 'bg-[#E56B4E]/20 text-[#F59E84]'
                                : 'bg-white/5 text-[#C8B6A6] hover:text-[#F4ECE1]'
                            }`}
                            title={isFriend ? 'Remove from Friends' : 'Save Friend'}
                          >
                            <Heart className="w-3.5 h-3.5 fill-current" />
                          </button>
                          <button
                            onClick={() => toggleMuteUser(v.userId)}
                            className={`p-1.5 rounded-lg text-xs ${
                              isMuted
                                ? 'bg-[#E06D53]/25 text-[#E06D53]'
                                : 'bg-white/5 text-[#A89686] hover:text-[#F4ECE1]'
                            }`}
                            title={isMuted ? 'Unmute user' : 'Mute user'}
                          >
                            <VolumeX className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => toggleBlockUser(v.userId)}
                            className={`p-1.5 rounded-lg text-xs ${
                              isBlocked
                                ? 'bg-[#E06D53]/30 text-[#E06D53]'
                                : 'bg-white/5 text-[#A89686] hover:text-[#E06D53]'
                            }`}
                            title={isBlocked ? 'Unblock user' : 'Block user'}
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              onReportUser(v.userId, 'Inappropriate behavior');
                              setModerationNotice(`Reported ${v.displayName} to moderation.`);
                              window.setTimeout(() => setModerationNotice(null), 2500);
                            }}
                            className="p-1.5 rounded-lg bg-white/5 text-[#A89686] hover:text-[#E06D53]"
                            title="Report inappropriate behavior"
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {adjacentSeat && (
                      <div className="mt-2 pt-1.5 border-t border-white/5 flex justify-end">
                        <button
                          onClick={() => onSelectSeat(adjacentSeat)}
                          className="text-[10px] font-semibold text-[#F3B664] hover:underline flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" /> Sit at same table ({SEATS[adjacentSeat].name})
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === 'chat' && (
          <div className="flex flex-col h-64">
            {/* Channel Banner */}
            <div className="mb-2 px-2.5 py-1.5 rounded-xl bg-[#241A15] border border-white/5 text-[11px] text-[#C8B6A6] flex items-center justify-between">
              <span>
                Channel:{' '}
                <strong className="text-[#FFE0B5]">
                  {currentTableChannel === 'central-table'
                    ? 'Communal Work Table'
                    : currentTableChannel === 'roastery-bar'
                    ? 'Roastery Espresso Bar'
                    : 'Social Lounge'}
                </strong>
              </span>
              {isQuietStudyProtected && (
                <span className="text-[10px] text-[#9AE6B4]">
                  Quiet Mode Protected
                </span>
              )}
            </div>

            {isQuietStudyProtected && (
              <div className="mb-2 px-3 py-2 rounded-xl bg-[#1E2E26]/70 border border-[#68D391]/30 text-[11px] text-[#A3E8BE]">
                You are in a Quiet Study seat or Do Not Disturb mode. Chat notifications are muted so your focus is never interrupted.
              </div>
            )}

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-2">
              {visibleMessages.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#8C7A6B] italic">
                  No messages at this table yet — say bonjour or share what you’re working on!
                </div>
              ) : (
                visibleMessages.map((msg) => {
                  const isMine = msg.senderId === profile.userId;
                  return (
                    <div
                      key={msg.id}
                      className={`p-2 rounded-xl text-xs ${
                        isMine
                          ? 'bg-[#D48C46]/20 border border-[#F3B664]/35 ml-6'
                          : 'bg-[#241A15] border border-white/5 mr-6'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-[#C8B6A6] mb-0.5">
                        <span className="font-semibold text-[#FFE0B5]">
                          {msg.senderName}
                        </span>
                        <span>
                          {new Date(msg.timestampMs).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-[#F4ECE1] break-words">{String(msg.text)}</p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleChatSubmit} className="flex gap-1.5 mt-auto">
              <input
                type="text"
                maxLength={280}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Write a friendly note to the table..."
                className="flex-1 px-3 py-1.5 rounded-xl bg-[#241A15] border border-white/10 text-xs text-[#F4ECE1] placeholder-[#8C7A6B] focus:outline-none focus:border-[#F3B664]"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-[#D48C46] hover:bg-[#E29A52] text-[#1A120D] font-semibold text-xs flex items-center gap-1 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {tab === 'friends' && (
          <div className="space-y-2">
            <div className="p-2.5 rounded-xl bg-[#241A15] border border-white/5 flex items-center justify-between">
              <div className="text-xs text-[#C8B6A6]">
                Invite a friend to study together in real time
              </div>
              <button
                onClick={handleCopyInviteLink}
                className="px-2.5 py-1 rounded-lg bg-[#D48C46] text-[#1A120D] font-semibold text-[11px]"
              >
                {copiedInvite ? 'Link Copied!' : 'Copy Invite Link'}
              </button>
            </div>

            {profile.friends.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#8C7A6B] italic">
                Click the heart icon next to any visitor in the café to save them to your Friends list.
              </div>
            ) : (
              profile.friends.map((friend) => {
                const onlineVisitor = visitors.find(
                  (v) => v.userId === friend.userId
                );
                const friendSeat = onlineVisitor?.seatId
                  ? SEATS[onlineVisitor.seatId]
                  : null;
                return (
                  <div
                    key={friend.userId}
                    className="p-2.5 rounded-xl bg-[#241A15] border border-white/5 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-semibold text-[#F9EFE3] flex items-center gap-1.5">
                        <span>{friend.displayName}</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            onlineVisitor ? 'bg-[#68D391]' : 'bg-[#6E655F]'
                          }`}
                        />
                      </div>
                      <div className="text-[10px] text-[#A89686]">
                        {onlineVisitor
                          ? friendSeat
                            ? `Online at ${friendSeat.name}`
                            : 'Online in Reception'
                          : 'Offline'}
                      </div>
                    </div>
                    {onlineVisitor && friendSeat && (
                      <button
                        onClick={() => {
                          const adj = findAdjacentAvailableSeat(onlineVisitor.seatId);
                          if (adj) onSelectSeat(adj);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#D48C46]/20 border border-[#F3B664]/40 text-[#FFE0B5] text-[10px] font-semibold"
                      >
                        Join Table
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === 'rules' && (
          <div className="space-y-2.5 text-xs text-[#D6C5B5] p-1">
            <h4 className="font-serif font-semibold text-sm text-[#F9EFE3]">
              Café Etiquette &amp; Community Safety
            </h4>
            <p className="text-[11px] leading-relaxed">
              Eval Exec’s Cafe is a peaceful sanctuary on the internet where people around the world can focus alone, together.
            </p>
            <ul className="space-y-1.5 text-[11px] list-disc pl-4 text-[#C8B6A6]">
              <li>
                <strong className="text-[#F4ECE1]">Respect the Zones:</strong> The Quiet Study Zone is free of chat interruptions. Use the Shared Work Table or Social Lounge for conversation.
              </li>
              <li>
                <strong className="text-[#F4ECE1]">Privacy by Default:</strong> Your personal tasks and focus goals remain private unless you explicitly toggle “Shared with Table”.
              </li>
              <li>
                <strong className="text-[#F4ECE1]">Safety Controls:</strong> You can mute, block, or report any visitor at any time from the “In Café” list, or switch on Invisible Mode in your Avatar settings.
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { Check, EyeOff, Sparkles, User, X } from 'lucide-react';
import {
  ActivityStatus,
  AvatarAccessory,
  HairStyle,
  UserProfile,
} from '../../types';
import { IsoAvatar } from '../svg/IsoAvatar';

interface AvatarProfileModalProps {
  profile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onChangeProfile: (next: UserProfile) => void;
}

const SKIN_TONES = ['#F9D9BD', '#F2C6A0', '#E0AC7E', '#C68858', '#8D5834', '#5C3820'];
const HAIR_COLORS = ['#231B18', '#4A2E1B', '#8C4326', '#D49A45', '#6E7582', '#9E3B33'];
const CLOTHING_COLORS = [
  '#4E7D6B',
  '#B85D3B',
  '#4A6278',
  '#8C4A32',
  '#6B5B7B',
  '#C98A3A',
];

const HAIR_STYLES: Array<{ id: HairStyle; label: string }> = [
  { id: 'short', label: 'Classic Crop' },
  { id: 'bob', label: 'Soft Bob' },
  { id: 'bun', label: 'Top Bun' },
  { id: 'curly', label: 'Curly Crown' },
  { id: 'beanie', label: 'Knit Beanie' },
];

const ACCESSORIES: Array<{ id: AvatarAccessory; label: string }> = [
  { id: 'glasses', label: 'Reading Glasses' },
  { id: 'headphones', label: 'Studio Headphones' },
  { id: 'scarf', label: 'Woven Scarf' },
  { id: 'none', label: 'None' },
];

const ACTIVITY_STATUSES: Array<{ id: ActivityStatus; label: string }> = [
  { id: 'focusing', label: 'Focusing' },
  { id: 'coding', label: 'Coding' },
  { id: 'studying', label: 'Studying' },
  { id: 'reading', label: 'Reading' },
  { id: 'break', label: 'On a Break' },
  { id: 'chatting', label: 'Open to Chat' },
  { id: 'dnd', label: 'Do Not Disturb' },
];

export const AvatarProfileModal: React.FC<AvatarProfileModalProps> = ({
  profile,
  isOpen,
  onClose,
  onChangeProfile,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-[#1A130F] border border-[#D48C46]/40 shadow-2xl p-5 text-[#F4ECE1] max-h-[88vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#D48C46]/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#D48C46]/20 border border-[#D48C46]/45 flex items-center justify-center">
              <User className="w-4 h-4 text-[#F3B664]" />
            </div>
            <div>
              <h2 className="font-serif text-base font-semibold text-[#F9EFE3]">
                Your Café Avatar &amp; Identity
              </h2>
              <p className="text-xs text-[#C8B6A6]">
                {profile.isRegistered
                  ? 'Saved Café Member Profile'
                  : 'Visiting as Guest • Changes save automatically'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#C8B6A6] hover:text-[#F4ECE1] hover:bg-white/5"
            aria-label="Close avatar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top Preview + Display Name & Status */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-4 p-3.5 rounded-2xl bg-[#241A15] border border-white/10">
          {/* Live Isometric SVG Avatar Preview */}
          <div className="w-28 h-28 rounded-2xl bg-[#18110D] border border-[#D48C46]/30 flex items-center justify-center shrink-0">
            <svg viewBox="-55 -55 110 75" className="w-full h-full">
              <IsoAvatar
                visitor={{
                  userId: profile.userId,
                  displayName: profile.displayName || 'Guest',
                  avatar: profile.avatar,
                  seatId: null,
                  activityStatus: profile.activityStatus,
                  shareFocusGoal: false,
                  invisible: profile.invisible,
                  lastHeartbeatMs: Date.now(),
                }}
                x={0}
                y={8}
                isSelf={true}
                isSeated={false}
                reducedMotion={false}
              />
            </svg>
          </div>

          <div className="flex-1 w-full space-y-2.5">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#C8B6A6] mb-1">
                Display Name
              </label>
              <input
                type="text"
                maxLength={24}
                value={profile.displayName}
                onChange={(e) =>
                  onChangeProfile({ ...profile, displayName: e.target.value })
                }
                placeholder="Your café name..."
                className="w-full px-3 py-1.5 rounded-xl bg-[#18110D] border border-[#D48C46]/35 text-xs text-[#F4ECE1] focus:outline-none focus:border-[#F3B664]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#C8B6A6] mb-1">
                Current Activity Status
              </label>
              <div className="flex flex-wrap gap-1">
                {ACTIVITY_STATUSES.map((st) => (
                  <button
                    key={st.id}
                    onClick={() =>
                      onChangeProfile({ ...profile, activityStatus: st.id })
                    }
                    className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                      profile.activityStatus === st.id
                        ? 'bg-[#D48C46]/25 border-[#F3B664] text-[#FFE0B5]'
                        : 'bg-[#18110D] border-white/10 text-[#C8B6A6] hover:text-[#F4ECE1]'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Appearance Customization Controls */}
        <div className="space-y-3.5 mb-4">
          {/* Skin Tone & Hair Color */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#C8B6A6] mb-1.5">
                Skin Tone
              </span>
              <div className="flex gap-2">
                {SKIN_TONES.map((color) => (
                  <button
                    key={color}
                    onClick={() =>
                      onChangeProfile({
                        ...profile,
                        avatar: { ...profile.avatar, skinTone: color },
                      })
                    }
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${
                      profile.avatar.skinTone === color
                        ? 'border-[#F3B664] scale-110'
                        : 'border-white/15'
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Skin tone ${color}`}
                  />
                ))}
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#C8B6A6] mb-1.5">
                Hair Color
              </span>
              <div className="flex gap-2">
                {HAIR_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() =>
                      onChangeProfile({
                        ...profile,
                        avatar: { ...profile.avatar, hairColor: color },
                      })
                    }
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${
                      profile.avatar.hairColor === color
                        ? 'border-[#F3B664] scale-110'
                        : 'border-white/15'
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Hair color ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Hair Style */}
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#C8B6A6] mb-1.5">
              Hair Style
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {HAIR_STYLES.map((hs) => (
                <button
                  key={hs.id}
                  onClick={() =>
                    onChangeProfile({
                      ...profile,
                      avatar: { ...profile.avatar, hairStyle: hs.id },
                    })
                  }
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-medium border transition-all ${
                    profile.avatar.hairStyle === hs.id
                      ? 'bg-[#D48C46]/25 border-[#F3B664] text-[#FFE0B5]'
                      : 'bg-[#241A15] border-white/10 text-[#C8B6A6] hover:text-[#F4ECE1]'
                  }`}
                >
                  {hs.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clothing Color */}
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#C8B6A6] mb-1.5">
              Sweater Color
            </span>
            <div className="flex gap-2.5">
              {CLOTHING_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() =>
                    onChangeProfile({
                      ...profile,
                      avatar: { ...profile.avatar, clothingColor: color },
                    })
                  }
                  className={`w-8 h-8 rounded-xl border-2 transition-transform ${
                    profile.avatar.clothingColor === color
                      ? 'border-[#F3B664] scale-110'
                      : 'border-white/15'
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Clothing color ${color}`}
                />
              ))}
            </div>
          </div>

          {/* Accessories */}
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#C8B6A6] mb-1.5">
              Accessory
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {ACCESSORIES.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() =>
                    onChangeProfile({
                      ...profile,
                      avatar: { ...profile.avatar, accessory: acc.id },
                    })
                  }
                  className={`py-1.5 px-2.5 rounded-xl text-[11px] font-medium border transition-all ${
                    profile.avatar.accessory === acc.id
                      ? 'bg-[#D48C46]/25 border-[#F3B664] text-[#FFE0B5]'
                      : 'bg-[#241A15] border-white/10 text-[#C8B6A6] hover:text-[#F4ECE1]'
                  }`}
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Privacy & Animation Comfort Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 p-3 rounded-xl bg-[#241A15] border border-white/5">
          <button
            onClick={() =>
              onChangeProfile({ ...profile, invisible: !profile.invisible })
            }
            className="flex items-center justify-between text-left p-1.5 rounded-lg hover:bg-white/5"
          >
            <div className="flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-[#F3B664]" />
              <div>
                <div className="text-xs font-medium">Invisible Mode</div>
                <div className="text-[10px] text-[#A89686]">
                  Study privately without public presence
                </div>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                profile.invisible
                  ? 'bg-[#68D391]/20 text-[#9AE6B4]'
                  : 'bg-white/5 text-[#A89686]'
              }`}
            >
              {profile.invisible ? 'ON' : 'OFF'}
            </span>
          </button>

          <button
            onClick={() =>
              onChangeProfile({
                ...profile,
                skipAnimations: !profile.skipAnimations,
              })
            }
            className="flex items-center justify-between text-left p-1.5 rounded-lg hover:bg-white/5"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#F3B664]" />
              <div>
                <div className="text-xs font-medium">Skip Seat Animations</div>
                <div className="text-[10px] text-[#A89686]">
                  Instant camera &amp; laptop transitions
                </div>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                profile.skipAnimations
                  ? 'bg-[#68D391]/20 text-[#9AE6B4]'
                  : 'bg-white/5 text-[#A89686]'
              }`}
            >
              {profile.skipAnimations ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        {/* Footer Save & Member Persistence */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
          <button
            onClick={() =>
              onChangeProfile({ ...profile, isRegistered: true })
            }
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              profile.isRegistered
                ? 'bg-[#68D391]/15 border-[#68D391]/40 text-[#9AE6B4]'
                : 'bg-[#281D17] border-[#D48C46]/40 text-[#FFE0B5] hover:bg-[#36271F]'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>
              {profile.isRegistered
                ? 'Café Passport Saved'
                : 'Save as Café Passport'}
            </span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#D48C46] hover:bg-[#E29A52] text-[#1A120D] text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

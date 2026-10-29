import React, { useState } from 'react';
import {
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  Link2,
  LogOut,
  ShieldCheck,
  Sparkles,
  Unlink,
  User,
  X,
} from 'lucide-react';
import {
  ActivityStatus,
  AvatarAccessory,
  HairStyle,
  SocialIdentity,
  SocialProvider,
  UserProfile,
} from '../../types';
import { ProviderIcon } from './VisitorProfileCardModal';
import { validateSafeAvatarUrl } from '../../network/multiplayerClient';

interface AvatarProfileModalProps {
  profile: UserProfile;
  authNotice?: string | null;
  onUpdateProfile: (next: UserProfile) => void;
  onStartOAuth: (
    provider: SocialProvider,
    mode: 'login' | 'link',
    usernameHint?: string,
    displayNameHint?: string
  ) => Promise<void>;
  onDisconnectIdentity: (identityId: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onClose: () => void;
}

const SKIN_TONES = [
  '#F9E0C7',
  '#F2C6A0',
  '#E0A878',
  '#C68652',
  '#8D5524',
  '#5C3818',
];

const HAIR_COLORS = [
  '#241811',
  '#4A2E1B',
  '#8C4A27',
  '#D49B4B',
  '#9E3B33',
  '#5A6B82',
];

const CLOTHING_COLORS = [
  '#4E7D6B',
  '#C85A32',
  '#3B5978',
  '#8A4F6A',
  '#C98A3A',
  '#4A5568',
];

const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: 'short', label: 'Classic Crop' },
  { id: 'bun', label: 'Top Bun' },
  { id: 'bob', label: 'Warm Bob' },
  { id: 'curly', label: 'Soft Curls' },
  { id: 'beanie', label: 'Knit Beanie' },
];

const ACCESSORIES: { id: AvatarAccessory; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'glasses', label: 'Round Glasses' },
  { id: 'headphones', label: 'Studio Headphones' },
  { id: 'scarf', label: 'Woven Scarf' },
];

const ACTIVITY_OPTIONS: { id: ActivityStatus; label: string; desc: string }[] = [
  { id: 'coding', label: 'Coding', desc: 'Building software at laptop' },
  { id: 'studying', label: 'Studying', desc: 'Notes & study session' },
  { id: 'reading', label: 'Reading', desc: 'Reading a hardcover book' },
  { id: 'focusing', label: 'Focusing', desc: 'Deep work at laptop' },
  { id: 'break', label: 'On Break', desc: 'Sipping coffee & relaxing' },
  { id: 'chatting', label: 'Open to Chat', desc: 'Welcoming conversation' },
  { id: 'dnd', label: 'Do Not Disturb', desc: 'No interruptions please' },
];

export const AvatarProfileModal: React.FC<AvatarProfileModalProps> = ({
  profile,
  authNotice,
  onUpdateProfile,
  onStartOAuth,
  onDisconnectIdentity,
  onSignOut,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'identity' | 'character'>(
    profile.isAuthenticated ? 'identity' : 'identity'
  );
  const [oauthStepProvider, setOauthStepProvider] = useState<SocialProvider | null>(null);
  const [oauthStepMode, setOauthStepMode] = useState<'login' | 'link'>('login');
  const [usernameInput, setUsernameInput] = useState('eval-exec');
  const [displayNameInput, setDisplayNameInput] = useState('Eval Exec');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const updateAvatar = (patch: Partial<typeof profile.avatar>) => {
    onUpdateProfile({
      ...profile,
      avatar: { ...profile.avatar, ...patch },
    });
  };

  const linkedGithub = profile.identities.find((i) => i.provider === 'github');

  const handleOpenProviderOAuth = (
    provider: SocialProvider,
    mode: 'login' | 'link'
  ) => {
    setLocalError(null);
    setOauthStepProvider(provider);
    setOauthStepMode(mode);
    setUsernameInput(linkedGithub?.username || 'eval-exec');
    setDisplayNameInput(profile.displayName || 'Eval Exec');
  };

  const handleConfirmOAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oauthStepProvider) return;
    const cleanHandle = usernameInput.replace(/^@/, '').trim();
    if (!cleanHandle) {
      setLocalError('Please enter a valid username.');
      return;
    }
    setIsSubmittingAuth(true);
    setLocalError(null);
    try {
      await onStartOAuth(
        oauthStepProvider,
        oauthStepMode,
        cleanHandle,
        displayNameInput.trim() || cleanHandle
      );
      setOauthStepProvider(null);
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Authentication failed. Please try again.'
      );
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const toggleIdentityVisibility = (ident: SocialIdentity) => {
    const nextIdentities = profile.identities.map((item) =>
      item.id === ident.id
        ? { ...item, isPublic: item.isPublic === false ? true : false }
        : item
    );
    onUpdateProfile({
      ...profile,
      identities: nextIdentities,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl cafe-glass-panel border border-amber-300/30 p-6 text-amber-50 shadow-2xl max-h-[90vh] overflow-y-auto cafe-scrollbar"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Social Identity, OAuth Sign-In & Avatar Customization"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-amber-200/15">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/35 flex items-center justify-center text-amber-300">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-semibold text-amber-50">
                {profile.isAuthenticated
                  ? 'Social Identity & Café Pass'
                  : "Sign In to Eval Exec's Cafe"}
              </h2>
              <p className="text-xs text-amber-200/65">
                {profile.isAuthenticated
                  ? 'Manage your linked GitHub account, profile photo, and character'
                  : 'Sign in with GitHub to claim seats, chat, and show your profile picture'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-amber-200/70 hover:text-amber-50 hover:bg-white/10 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Optional Banner for Auth Notice or Error */}
        {(authNotice || localError) && (
          <div className="mt-4 px-3.5 py-2.5 rounded-2xl bg-amber-500/15 border border-amber-400/35 text-xs text-amber-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-300 shrink-0" />
            <span>{localError || authNotice}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 bg-black/30 p-1 rounded-2xl mt-4 border border-amber-200/10">
          <button
            type="button"
            onClick={() => setActiveTab('identity')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'identity'
                ? 'bg-amber-500/25 text-amber-100 border border-amber-400/35'
                : 'text-amber-200/65 hover:text-amber-100'
            }`}
          >
            GitHub Identity
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('character')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'character'
                ? 'bg-amber-500/25 text-amber-100 border border-amber-400/35'
                : 'text-amber-200/65 hover:text-amber-100'
            }`}
          >
            Isometric Character & Activity
          </button>
        </div>

        {activeTab === 'identity' ? (
          <div className="mt-5 space-y-5">
            {/* OAuth 2.0 + PKCE Interactive Step (when user clicks Continue with GitHub or Connect Account) */}
            {oauthStepProvider ? (
              <form
                onSubmit={handleConfirmOAuth}
                className="p-4 rounded-2xl bg-black/45 border border-amber-400/35 space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/35 flex items-center justify-center text-amber-200">
                      <ProviderIcon
                        provider={oauthStepProvider}
                        className="w-4 h-4"
                      />
                    </span>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-200">
                        {oauthStepMode === 'link' ? 'Link' : 'Continue with'} GitHub
                      </h3>
                      <p className="text-[11px] text-amber-200/65">
                        OAuth 2.0 Authorization Code + PKCE (S256)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOauthStepProvider(null)}
                    className="text-xs text-amber-200/60 hover:text-amber-100"
                  >
                    Cancel
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-amber-200/80 mb-1">
                    GitHub Username
                  </label>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="eval-exec"
                    required
                    className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-amber-300/30 text-sm text-amber-50 focus:outline-none focus:border-amber-400"
                  />
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="text-[10px] text-amber-200/55">Quick presets:</span>
                    {[
                      { u: 'eval-exec', n: 'Eval Exec' },
                      { u: 'torvalds', n: 'Linus Torvalds' },
                      { u: 'gaearon', n: 'Dan Abramov' },
                      { u: 'yyx990803', n: 'Evan You' },
                    ].map((preset) => (
                      <button
                        key={preset.u}
                        type="button"
                        onClick={() => {
                          setUsernameInput(preset.u);
                          setDisplayNameInput(preset.n);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 hover:bg-amber-500/20 border border-amber-200/20 text-amber-200"
                      >
                        @{preset.u}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-amber-200/80 mb-1">
                    Display Name in Café
                  </label>
                  <input
                    type="text"
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    placeholder="Eval Exec"
                    className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-amber-300/30 text-sm text-amber-50 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="p-2.5 rounded-xl bg-black/35 border border-amber-200/10 text-[11px] text-amber-200/70">
                  <strong>Read-only profile scope:</strong> Retrieves only your public
                  GitHub ID, username, display name, and avatar_url. Never requests
                  repository, write, or email permissions.
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isSubmittingAuth}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-semibold text-xs shadow-lg transition-all disabled:opacity-50"
                  >
                    {isSubmittingAuth
                      ? 'Verifying OAuth 2.0 + PKCE...'
                      : 'Authorize with GitHub'}
                  </button>
                </div>
              </form>
            ) : !profile.isAuthenticated ? (
              /* Unauthenticated Primary Sign-In Button */
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-black/30 border border-amber-200/15 space-y-3">
                  <p className="text-xs text-amber-100/90 leading-relaxed">
                    You are currently exploring <strong>Eval Exec's Cafe</strong> in{' '}
                    <span className="text-amber-300 font-semibold">Preview Mode</span>.
                    Sign in with <strong>GitHub</strong> to display your real profile
                    photo above your isometric avatar, occupy a seat, chat at tables,
                    and connect with other visitors.
                  </p>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenProviderOAuth('github', 'login')}
                      className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl bg-[#181717] hover:bg-[#242323] border border-amber-300/35 text-white font-semibold text-xs shadow-lg transition-all"
                    >
                      <ProviderIcon provider="github" className="w-4 h-4" />
                      Continue with GitHub
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Authenticated Account & Linked Identities Management */
              <div className="space-y-4">
                {/* Active Public Identity Preview */}
                <div className="p-4 rounded-2xl bg-black/35 border border-amber-300/25 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const chosenAvatarIdent = profile.identities.find(
                        (i) => i.id === profile.preferredAvatarIdentityId
                      );
                      const safeUrl = validateSafeAvatarUrl(
                        chosenAvatarIdent?.avatarUrl ||
                          profile.identities[0]?.avatarUrl
                      );
                      return (
                        <div className="w-12 h-12 rounded-full bg-amber-950 border-2 border-emerald-400/70 flex items-center justify-center overflow-hidden shrink-0">
                          {safeUrl ? (
                            <img
                              src={safeUrl}
                              alt={profile.displayName}
                              referrerPolicy="no-referrer"
                              crossOrigin="anonymous"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-base font-bold text-amber-200">
                              {profile.displayName.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-serif font-semibold text-sm text-amber-50">
                          {profile.displayName}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-semibold">
                          Signed In
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-200/65 mt-0.5">
                        Internal Café ID:{' '}
                        <code className="text-amber-300/90">
                          {profile.userId.slice(0, 16)}
                        </code>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onSignOut}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/35 text-rose-200 text-xs font-semibold transition-all"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>

                {/* Display Name Selection */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-amber-200/80 mb-1.5">
                    Preferred Display Name
                  </label>
                  <input
                    type="text"
                    maxLength={32}
                    value={profile.displayName}
                    onChange={(e) =>
                      onUpdateProfile({ ...profile, displayName: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-black/35 border border-amber-200/20 text-sm text-amber-50 focus:outline-none focus:border-amber-400"
                  />
                  {profile.identities.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[10px] text-amber-200/55">
                        Use name from linked account:
                      </span>
                      {profile.identities.map((ident) => (
                        <button
                          key={ident.id}
                          type="button"
                          onClick={() =>
                            onUpdateProfile({
                              ...profile,
                              displayName: ident.displayName,
                            })
                          }
                          className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 hover:bg-amber-500/20 border border-amber-200/20 text-amber-200"
                        >
                          {ident.displayName} (@{ident.username})
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Linked GitHub Account */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-amber-200/80">
                      Linked GitHub Account
                    </label>
                    <span className="text-[10px] text-amber-200/60">
                      OAuth 2.0 + PKCE Verified
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {profile.identities.map((ident) => {
                      const isPrimary = profile.preferredIdentityId === ident.id;
                      const isAvatarSource =
                        profile.preferredAvatarIdentityId === ident.id;
                      const canDisconnect = profile.identities.length > 1;
                      const safeImg = validateSafeAvatarUrl(ident.avatarUrl);

                      return (
                        <div
                          key={ident.id}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            isPrimary
                              ? 'bg-amber-500/12 border-amber-400/45'
                              : 'bg-black/30 border-amber-200/15'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-amber-950 border border-amber-400/50 overflow-hidden flex items-center justify-center shrink-0">
                                {safeImg ? (
                                  <img
                                    src={safeImg}
                                    alt={ident.username}
                                    referrerPolicy="no-referrer"
                                    crossOrigin="anonymous"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <ProviderIcon
                                    provider={ident.provider}
                                    className="w-4 h-4 text-amber-200"
                                  />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <ProviderIcon
                                    provider={ident.provider}
                                    className="w-3.5 h-3.5 text-amber-300"
                                  />
                                  <span className="text-xs font-bold text-amber-50">
                                    @{ident.username}
                                  </span>
                                  <a
                                    href={ident.profileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-amber-300/75 hover:text-amber-200"
                                    title="Open external profile"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                                <p className="text-[11px] text-amber-200/65">
                                  {ident.displayName} • GitHub ID #{ident.providerUserId.slice(0, 10)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {/* Public Visibility Toggle */}
                              <button
                                type="button"
                                onClick={() => toggleIdentityVisibility(ident)}
                                className={`px-2 py-1 rounded-lg border text-[10px] font-medium flex items-center gap-1 transition-all ${
                                  ident.isPublic !== false
                                    ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200'
                                    : 'bg-white/5 border-amber-200/15 text-amber-200/60'
                                }`}
                                title="Toggle whether this GitHub profile link is visible on your public café card"
                              >
                                {ident.isPublic !== false ? (
                                  <>
                                    <Eye className="w-3 h-3" /> Public
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="w-3 h-3" /> Hidden
                                  </>
                                )}
                              </button>

                              {/* Disconnect Provider Button */}
                              <button
                                type="button"
                                disabled={!canDisconnect}
                                onClick={() => onDisconnectIdentity(ident.id)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 border border-amber-200/15 hover:border-rose-400/35 text-amber-200/65 hover:text-rose-200 disabled:opacity-35 disabled:pointer-events-none transition-all"
                                title={
                                  canDisconnect
                                    ? 'Disconnect GitHub'
                                    : 'At least one login provider must remain connected'
                                }
                              >
                                <Unlink className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Identity Role Selectors: Primary Badge & Profile Picture Source */}
                          <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-amber-200/10 flex-wrap">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateProfile({
                                  ...profile,
                                  preferredIdentityId: ident.id,
                                })
                              }
                              className={`text-[10px] px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1 transition-all ${
                                isPrimary
                                  ? 'bg-amber-500 text-stone-950 border-amber-400'
                                  : 'bg-white/5 text-amber-200/75 border-amber-200/15 hover:border-amber-300/40'
                              }`}
                            >
                              {isPrimary && <Check className="w-3 h-3" />}
                              {isPrimary
                                ? 'Primary Café Badge'
                                : 'Set as Primary Badge'}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                onUpdateProfile({
                                  ...profile,
                                  preferredAvatarIdentityId: ident.id,
                                })
                              }
                              className={`text-[10px] px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1 transition-all ${
                                isAvatarSource
                                  ? 'bg-amber-500/25 text-amber-100 border-amber-400/50'
                                  : 'bg-white/5 text-amber-200/75 border-amber-200/15 hover:border-amber-300/40'
                              }`}
                            >
                              {isAvatarSource && <Check className="w-3 h-3" />}
                              {isAvatarSource
                                ? 'Active Profile Photo'
                                : 'Use Profile Photo'}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Switch / Re-authenticate GitHub Account Button */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenProviderOAuth('github', 'login')}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-amber-200/20 text-xs font-semibold text-amber-100 transition-all"
                      >
                        <Link2 className="w-3.5 h-3.5 text-amber-300" />
                        <ProviderIcon provider="github" className="w-3.5 h-3.5" />
                        {linkedGithub
                          ? 'Switch GitHub Account'
                          : 'Connect GitHub Account'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Isometric Character & Activity Tab */
          <div className="mt-5 space-y-4">
            {/* Activity Status */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-amber-200/80 mb-2">
                Current Café Activity
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ACTIVITY_OPTIONS.map((opt) => {
                  const active = profile.activityStatus === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        onUpdateProfile({ ...profile, activityStatus: opt.id })
                      }
                      className={`text-left px-3 py-2 rounded-xl border transition-all ${
                        active
                          ? 'bg-amber-500/25 border-amber-400 text-amber-50'
                          : 'bg-black/25 border-amber-200/12 text-amber-200/70 hover:bg-white/5'
                      }`}
                    >
                      <div className="text-xs font-semibold">{opt.label}</div>
                      <div className="text-[10px] opacity-70">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Skin Tone & Hair Color */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-amber-200/80 mb-2">
                  Skin Tone
                </label>
                <div className="flex items-center gap-2">
                  {SKIN_TONES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => updateAvatar({ skinTone: color })}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        profile.avatar.skinTone === color
                          ? 'border-amber-300 scale-110'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`Skin tone ${color}`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-amber-200/80 mb-2">
                  Hair Color
                </label>
                <div className="flex items-center gap-2">
                  {HAIR_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => updateAvatar({ hairColor: color })}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        profile.avatar.hairColor === color
                          ? 'border-amber-300 scale-110'
                          : 'border-transparent'
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-amber-200/80 mb-2">
                Hair & Headwear
              </label>
              <div className="flex flex-wrap gap-2">
                {HAIR_STYLES.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => updateAvatar({ hairStyle: st.id })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      profile.avatar.hairStyle === st.id
                        ? 'bg-amber-500/25 border-amber-400 text-amber-50'
                        : 'bg-black/25 border-amber-200/15 text-amber-200/70 hover:bg-white/5'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sweater Color & Accessory */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-amber-200/80 mb-2">
                  Sweater Color
                </label>
                <div className="flex items-center gap-2">
                  {CLOTHING_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => updateAvatar({ clothingColor: color })}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        profile.avatar.clothingColor === color
                          ? 'border-amber-300 scale-110'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`Sweater color ${color}`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-amber-200/80 mb-2">
                  Accessory
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ACCESSORIES.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => updateAvatar({ accessory: acc.id })}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                        profile.avatar.accessory === acc.id
                          ? 'bg-amber-500/25 border-amber-400 text-amber-50'
                          : 'bg-black/25 border-amber-200/15 text-amber-200/70'
                      }`}
                    >
                      {acc.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Privacy & Comfort Toggles */}
            <div className="pt-2 border-t border-amber-200/15 space-y-2">
              <button
                type="button"
                onClick={() =>
                  onUpdateProfile({ ...profile, invisible: !profile.invisible })
                }
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-black/25 border border-amber-200/12 text-xs"
              >
                <span className="flex items-center gap-2 text-amber-100">
                  {profile.invisible ? (
                    <EyeOff className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>Invisible Study Mode (Hide my avatar from others)</span>
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    profile.invisible
                      ? 'bg-amber-500/25 text-amber-200'
                      : 'bg-white/10 text-amber-200/60'
                  }`}
                >
                  {profile.invisible ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateProfile({
                    ...profile,
                    skipAnimations: !profile.skipAnimations,
                  })
                }
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-black/25 border border-amber-200/12 text-xs"
              >
                <span className="flex items-center gap-2 text-amber-100">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Instant Transitions (Skip camera/door animations)</span>
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    profile.skipAnimations
                      ? 'bg-amber-500/25 text-amber-200'
                      : 'bg-white/10 text-amber-200/60'
                  }`}
                >
                  {profile.skipAnimations ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-semibold text-xs shadow-lg transition-all"
          >
            <Check className="w-3.5 h-3.5" />
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

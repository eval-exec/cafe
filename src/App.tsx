import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  CloudRain,
  Coffee,
  Compass,
  DoorOpen,
  Flame,
  Globe,
  Keyboard,
  ListTodo,
  LogIn,
  Maximize2,
  Minimize2,
  Moon,
  Music,
  Pause,
  Play,
  RotateCcw,
  Sun,
  Sunrise,
  Sunset,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { soundEngine } from './audio/soundEngine';
import { InteriorSceneSVG } from './components/svg/InteriorSceneSVG';
import { StreetSceneSVG } from './components/svg/StreetSceneSVG';
import { AudioMixerPopover } from './components/ui/AudioMixerPopover';
import { AvatarProfileModal } from './components/ui/AvatarProfileModal';
import { FocusOverlayPanel } from './components/ui/FocusOverlayPanel';
import { SocialLoungeDrawer } from './components/ui/SocialLoungeDrawer';
import {
  ProviderIcon,
  VisitorProfileCardModal,
} from './components/ui/VisitorProfileCardModal';
import {
  buildServerOAuthStartUrl,
  ConnectionStatus,
  fetchAuthSession,
  getApiBaseUrl,
  multiplayerClient,
  resolvePublicSocialProfile,
  validateSafeAvatarUrl,
} from './network/multiplayerClient';
import {
  AudioPreferences,
  CafeRoomId,
  ChatMessage,
  FocusPreferences,
  ReactionEvent,
  ReactionKind,
  SceneMode,
  SeatId,
  SeatZone,
  SharedTimerState,
  SocialIdentity,
  SocialProvider,
  TimeOfDay,
  TimerPhase,
  UserProfile,
  VisitorPresence,
} from './types';
import {
  CAFE_THEME_LIST,
  CAFE_THEMES,
  SEAT_LIST,
  SEATS,
} from './utils/isometric';

const AUDIO_STORAGE_KEY = 'eval_exec_cafe_audio_v3';
const FOCUS_STORAGE_KEY = 'eval_exec_cafe_focus_v2';
const PROFILE_STORAGE_KEY = 'eval_exec_cafe_profile_v2';
const SESSION_ID_KEY = 'eval_exec_cafe_session_uid_v2';

const DEFAULT_AUDIO_PREFS: AudioPreferences = {
  isPlaying: true,
  autoPlay: true,
  isMuted: false,
  quietMode: false,
  masterVolume: 0.75,
  musicStyle: 'lofi',
  musicVolume: 0.55,
  ambientVolumes: {
    cafe: 0.45,
    rain: 0.35,
    fire: 0.35,
    keyboard: 0.3,
  },
  ambientEnabled: {
    cafe: true,
    rain: true,
    fire: false,
    keyboard: false,
  },
  sfxEnabled: true,
};

const DEFAULT_FOCUS_PREFS: FocusPreferences = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  currentGoal: 'Deep work & peaceful study session',
  shareFocusGoal: true,
  completedSessions: 0,
  totalFocusMinutes: 0,
  tasks: [
    {
      id: 'welcome-1',
      text: "Sign in with GitHub & choose a seat in Eval Exec's Cafe",
      completed: false,
      createdAt: Date.now() - 120000,
    },
    {
      id: 'welcome-2',
      text: 'Click a visitor avatar to view their social card & wave hello',
      completed: false,
      createdAt: Date.now() - 60000,
    },
    {
      id: 'welcome-3',
      text: 'Complete a personal or shared table Pomodoro session',
      completed: false,
      createdAt: Date.now(),
    },
  ],
  history: [],
};

function createSessionIdentity(): {
  userId: string;
  authToken: string;
  defaultSubName: string;
  sessionId?: string;
} {
  try {
    const existing = sessionStorage.getItem(SESSION_ID_KEY);
    if (existing) {
      return JSON.parse(existing);
    }
  } catch {
    // ignore
  }
  const randSuffix = Math.floor(100 + Math.random() * 900);
  const created = {
    userId: `preview-${Date.now()}-${randSuffix}`,
    authToken: `tok-${Math.random().toString(36).slice(2)}-${Date.now()}`,
    defaultSubName: `Guest #${randSuffix}`,
  };
  try {
    sessionStorage.setItem(SESSION_ID_KEY, JSON.stringify(created));
  } catch {
    // ignore
  }
  return created;
}

export function App() {
  // Active Café Room (supports Multiple Cafés architecture)
  const [roomId, setRoomId] = useState<CafeRoomId>(() => {
    if (typeof window !== 'undefined') {
      const r = new URLSearchParams(window.location.search).get(
        'room'
      ) as CafeRoomId | null;
      if (r && CAFE_THEMES[r]) return r;
    }
    return 'eval-exec-flagship';
  });

  const activeTheme = CAFE_THEMES[roomId];

  // Scene & Seat State
  const [scene, setScene] = useState<SceneMode>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const seatParam = params.get('seat') as SeatId | null;
      if (seatParam && SEATS[seatParam]) return 'seated';
      const sceneParam = params.get('scene');
      if (sceneParam === 'interior' || sceneParam === 'seated') return sceneParam;
    }
    return 'street';
  });

  const [selectedSeatId, setSelectedSeatId] = useState<SeatId | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const seatParam = params.get('seat') as SeatId | null;
      if (seatParam && SEATS[seatParam]) return seatParam;
    }
    return null;
  });

  const [hoveredSeatId, setHoveredSeatId] = useState<SeatId | null>(null);
  const [seatZoneFilter, setSeatZoneFilter] = useState<'all' | SeatZone>('all');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Environment & Accessibility State
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(() => {
    if (typeof window !== 'undefined') {
      const tod = new URLSearchParams(window.location.search).get(
        'tod'
      ) as TimeOfDay | null;
      if (tod && ['morning', 'afternoon', 'dusk', 'night'].includes(tod))
        return tod;
    }
    return 'afternoon';
  });
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });
  const [isZenFullscreen, setIsZenFullscreen] = useState(false);

  // User Profile & Social Identity State
  const [profile, setProfile] = useState<UserProfile>(() => {
    const sessionIdent = createSessionIdentity();
    const params =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : null;
    const ghParam = params?.get('github');

    if (ghParam) {
      const prov: SocialProvider = 'github';
      const handle = ghParam
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 39) || 'eval-exec';
      const dispName =
        params?.get('name') ||
        (handle === 'eval-exec' ? 'Eval Exec' : handle);
      const userId = `usr_github_${handle.toLowerCase()}`;
      const identId = `id_github_${handle.toLowerCase()}`;
      const avatarUrl = `https://github.com/${handle}.png?size=160`;
      const ident: SocialIdentity = {
        id: identId,
        userId,
        provider: prov,
        providerUserId: handle.toLowerCase(),
        username: handle,
        displayName: dispName,
        avatarUrl,
        profileUrl: `https://github.com/${handle}`,
        isPublic: true,
      };
      return {
        userId,
        authToken: sessionIdent.authToken,
        isAuthenticated: true,
        displayName: dispName,
        preferredIdentityId: identId,
        preferredAvatarIdentityId: identId,
        identities: [ident],
        avatar: {
          skinTone: '#F2C6A0',
          hairStyle: 'short',
          hairColor: '#4A2E1B',
          clothingColor: '#4E7D6B',
          accessory: 'glasses',
        },
        activityStatus: 'coding',
        invisible: false,
        skipAnimations: false,
        favoriteSeats: [],
        friends: [],
        mutedUserIds: [],
        blockedUserIds: [],
      };
    }

    try {
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.isAuthenticated && Array.isArray(parsed.identities) && parsed.identities.length > 0) {
          return {
            ...parsed,
            sessionId: sessionIdent.sessionId || parsed.sessionId,
          };
        }
      }
    } catch {
      // ignore
    }

    const paletteChoices = ['#4E7D6B', '#B85D3B', '#4A6278', '#8C4A32', '#6B5B7B'];
    const randomColor =
      paletteChoices[Math.floor(Math.random() * paletteChoices.length)];
    return {
      userId: sessionIdent.userId,
      authToken: sessionIdent.authToken,
      isAuthenticated: false,
      displayName: sessionIdent.defaultSubName,
      preferredIdentityId: '',
      preferredAvatarIdentityId: null,
      identities: [],
      avatar: {
        skinTone: '#F2C6A0',
        hairStyle: 'short',
        hairColor: '#4A2E1B',
        clothingColor: randomColor,
        accessory: 'glasses',
      },
      activityStatus: 'focusing',
      invisible: false,
      skipAnimations: false,
      favoriteSeats: [],
      friends: [],
      mutedUserIds: [],
      blockedUserIds: [],
    };
  });

  const [authModalNotice, setAuthModalNotice] = useState<string | null>(null);

  // Persisted Audio Preferences
  const [audioPrefs, setAudioPrefs] = useState<AudioPreferences>(() => {
    try {
      const saved = localStorage.getItem(AUDIO_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const autoPlay = parsed.autoPlay ?? true;
        return {
          ...DEFAULT_AUDIO_PREFS,
          ...parsed,
          ambientVolumes: {
            ...DEFAULT_AUDIO_PREFS.ambientVolumes,
            ...(parsed.ambientVolumes || {}),
          },
          ambientEnabled: {
            ...DEFAULT_AUDIO_PREFS.ambientEnabled,
            ...(parsed.ambientEnabled || {}),
          },
          autoPlay,
          isPlaying: autoPlay ? true : Boolean(parsed.isPlaying),
        };
      }
    } catch {
      // ignore
    }
    return DEFAULT_AUDIO_PREFS;
  });

  // Persisted Focus Preferences
  const [focusPrefs, setFocusPrefs] = useState<FocusPreferences>(() => {
    try {
      const saved = localStorage.getItem(FOCUS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_FOCUS_PREFS,
          ...parsed,
          history: parsed.history || [],
        };
      }
    } catch {
      // ignore
    }
    return DEFAULT_FOCUS_PREFS;
  });

  // Real-Time Multiplayer State
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('reconnecting');
  const [visitors, setVisitors] = useState<VisitorPresence[]>([]);
  const [leavingVisitors, setLeavingVisitors] = useState<
    Record<string, VisitorPresence>
  >({});
  const [seatOccupancy, setSeatOccupancy] = useState<Record<string, string>>({});
  const [sharedTimers, setSharedTimers] = useState<
    Record<string, SharedTimerState>
  >({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activeReactions, setActiveReactions] = useState<
    Record<string, ReactionEvent>
  >({});
  const [selectedVisitor, setSelectedVisitor] =
    useState<VisitorPresence | null>(null);

  // Pomodoro Timer Runtime State
  const [timerPhase, setTimerPhase] = useState<TimerPhase>('focus');
  const [secondsLeft, setSecondsLeft] = useState<number>(
    focusPrefs.focusMinutes * 60
  );
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [focusStartedAtMs, setFocusStartedAtMs] = useState<number | null>(null);
  const [completionBanner, setCompletionBanner] = useState<string | null>(null);

  // Popover & Modal UI States
  const [isAudioOpen, setIsAudioOpen] = useState(false);
  const [isNotebookOpen, setIsNotebookOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isSocialOpen, setIsSocialOpen] = useState(false);
  const [isRoomMenuOpen, setIsRoomMenuOpen] = useState(false);

  // Resolve active primary identity & avatar URL from profile
  const activePrimaryIdentity: SocialIdentity | null = React.useMemo(() => {
    if (!profile.isAuthenticated || profile.identities.length === 0) return null;
    return (
      profile.identities.find((i) => i.id === profile.preferredIdentityId) ||
      profile.identities[0]
    );
  }, [profile.isAuthenticated, profile.identities, profile.preferredIdentityId]);

  const activeAvatarUrl: string | null = React.useMemo(() => {
    if (!profile.isAuthenticated || profile.identities.length === 0) return null;
    if (profile.preferredAvatarIdentityId) {
      const match = profile.identities.find(
        (i) => i.id === profile.preferredAvatarIdentityId
      );
      if (match?.avatarUrl) return validateSafeAvatarUrl(match.avatarUrl);
    }
    return validateSafeAvatarUrl(activePrimaryIdentity?.avatarUrl);
  }, [
    profile.isAuthenticated,
    profile.identities,
    profile.preferredAvatarIdentityId,
    activePrimaryIdentity,
  ]);

  // Hydrate OAuth 2.0 session on mount (handles ?auth_session=... or ?auth_error=... callback params)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const authSessionParam = url.searchParams.get('auth_session');
    const authErrorParam = url.searchParams.get('auth_error');

    if (authErrorParam) {
      const readableError =
        authErrorParam === 'IdentityAlreadyLinked'
          ? 'That GitHub account is already linked to another café user.'
          : authErrorParam === 'access_denied'
          ? 'Sign-in was cancelled.'
          : `Authentication error: ${authErrorParam}`;
      setCompletionBanner(readableError);
      setAuthModalNotice(readableError);
      setIsAvatarModalOpen(true);
      window.setTimeout(() => setCompletionBanner(null), 5000);
      url.searchParams.delete('auth_error');
      window.history.replaceState({}, '', url.toString());
    }

    const sessionToCheck = authSessionParam || profile.sessionId;
    if (authSessionParam) {
      url.searchParams.delete('auth_session');
      window.history.replaceState({}, '', url.toString());
    }

    fetchAuthSession(sessionToCheck).then((sess) => {
      if (sess && sess.authenticated && sess.user && sess.identities) {
        const u = sess.user;
        const idents = sess.identities;
        setProfile((prev) => ({
          ...prev,
          userId: u.id,
          authToken: sess.wsToken || prev.authToken,
          csrfToken: sess.csrfToken,
          sessionId: sess.sessionId,
          isAuthenticated: true,
          displayName: u.displayName,
          preferredIdentityId: u.preferredIdentityId,
          preferredAvatarIdentityId:
            u.preferredAvatarIdentityId !== undefined
              ? u.preferredAvatarIdentityId
              : u.preferredIdentityId,
          identities: idents,
          activityStatus: (u.activity as UserProfile['activityStatus']) || prev.activityStatus,
        }));
        if (authSessionParam) {
          setCompletionBanner(
            `Welcome to Eval Exec's Cafe, ${u.displayName}! Your verified profile picture is now active.`
          );
          window.setTimeout(() => setCompletionBanner(null), 4200);
        }
      }
    });
  }, []);

  // Connect to Real-Time Multiplayer Server / Mesh on Mount
  useEffect(() => {
    multiplayerClient.connect(
      roomId,
      {
        userId: profile.userId,
        authToken: profile.authToken,
        isAuthenticated: profile.isAuthenticated,
        displayName: profile.displayName,
        avatar: profile.avatar,
        avatarUrl: activeAvatarUrl,
        primaryIdentity: activePrimaryIdentity,
        linkedIdentities: profile.identities,
        activityStatus: profile.activityStatus,
        focusGoal: focusPrefs.currentGoal,
        shareFocusGoal: focusPrefs.shareFocusGoal,
        focusStartedAtMs,
        invisible: profile.invisible,
      },
      selectedSeatId
    );

    const unsubSnap = multiplayerClient.onSnapshot((snap) => {
      setVisitors((prevVisitors) => {
        // Detect any visitor who was present and just left so we can animate their departure
        const nextIds = new Set(snap.visitors.map((v) => v.userId));
        prevVisitors.forEach((oldV) => {
          if (!nextIds.has(oldV.userId)) {
            setLeavingVisitors((prevLeave) => ({
              ...prevLeave,
              [oldV.userId]: oldV,
            }));
            window.setTimeout(() => {
              setLeavingVisitors((prevLeave) => {
                const copy = { ...prevLeave };
                delete copy[oldV.userId];
                return copy;
              });
            }, 650);
          }
        });
        return snap.visitors;
      });
      setSeatOccupancy(snap.seatOccupancy || {});
      setSharedTimers(snap.sharedTimers || {});
      setChatMessages(snap.recentMessages || []);
    });

    const unsubLeft = multiplayerClient.onVisitorLeft(({ userId }) => {
      setVisitors((prev) => {
        const departing = prev.find((v) => v.userId === userId);
        if (departing) {
          setLeavingVisitors((prevLeave) => ({
            ...prevLeave,
            [userId]: departing,
          }));
          window.setTimeout(() => {
            setLeavingVisitors((prevLeave) => {
              const copy = { ...prevLeave };
              delete copy[userId];
              return copy;
            });
          }, 650);
        }
        return prev.filter((v) => v.userId !== userId);
      });
    });

    const unsubRx = multiplayerClient.onReaction((rx) => {
      soundEngine.playWaveChime();
      setActiveReactions((prev) => ({
        ...prev,
        [rx.senderId]: rx,
        ...(rx.targetUserId ? { [rx.targetUserId]: rx } : {}),
      }));
      window.setTimeout(() => {
        setActiveReactions((prev) => {
          const next = { ...prev };
          if (next[rx.senderId]?.id === rx.id) delete next[rx.senderId];
          if (rx.targetUserId && next[rx.targetUserId]?.id === rx.id) {
            delete next[rx.targetUserId];
          }
          return next;
        });
      }, 4200);
    });

    const unsubChat = multiplayerClient.onChat((msg) => {
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev.slice(-49), msg];
      });
    });

    const unsubStatus = multiplayerClient.onStatus((st) => {
      setConnectionStatus(st);
    });

    const unsubErr = multiplayerClient.onError((reason) => {
      if (reason.includes('AuthenticationRequired') || reason.includes('Sign in')) {
        setAuthModalNotice(
          'Please sign in with GitHub to claim a persistent seat or participate in multiplayer.'
        );
        setIsAvatarModalOpen(true);
      }
      setCompletionBanner(reason);
      window.setTimeout(() => setCompletionBanner(null), 3500);
    });

    return () => {
      unsubSnap();
      unsubLeft();
      unsubRx();
      unsubChat();
      unsubStatus();
      unsubErr();
    };
  }, []);

  // Sync Profile & Focus Goal Changes to Multiplayer Presence, Server & LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // ignore
    }
    multiplayerClient.updateIdentity({
      userId: profile.userId,
      authToken: profile.authToken,
      isAuthenticated: profile.isAuthenticated,
      displayName: profile.displayName,
      avatar: profile.avatar,
      avatarUrl: activeAvatarUrl,
      primaryIdentity: activePrimaryIdentity,
      linkedIdentities: profile.identities,
      activityStatus: profile.activityStatus,
      focusGoal: focusPrefs.currentGoal,
      shareFocusGoal: focusPrefs.shareFocusGoal,
      focusStartedAtMs,
      invisible: profile.invisible,
    });
  }, [
    profile,
    activeAvatarUrl,
    activePrimaryIdentity,
    focusPrefs.currentGoal,
    focusPrefs.shareFocusGoal,
    focusStartedAtMs,
  ]);

  // Sync Audio Preferences & Scene Filter
  useEffect(() => {
    soundEngine.updatePreferences(audioPrefs);
    try {
      localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(audioPrefs));
    } catch {
      // ignore
    }
  }, [audioPrefs]);

  useEffect(() => {
    soundEngine.setSceneMode(scene);
  }, [scene]);

  useEffect(() => {
    if (audioPrefs.autoPlay && audioPrefs.isPlaying) {
      soundEngine.initAndApply(audioPrefs);
    }
    const handleGestureUnlock = () => {
      soundEngine.unlockIfNeeded();
    };
    window.addEventListener('pointerdown', handleGestureUnlock, { passive: true });
    window.addEventListener('keydown', handleGestureUnlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleGestureUnlock);
      window.removeEventListener('keydown', handleGestureUnlock);
    };
  }, []);

  // Sync Focus Preferences to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(focusPrefs));
    } catch {
      // ignore
    }
  }, [focusPrefs]);

  // Active Seat & Active Shared Table Timer
  const activeSeat = selectedSeatId ? SEATS[selectedSeatId] : null;
  const activeTableTimer =
    activeSeat && sharedTimers[activeSeat.tableId]?.isRunning
      ? sharedTimers[activeSeat.tableId]
      : null;

  // Synchronize countdown with Server Shared Table Timer when participating
  useEffect(() => {
    if (
      !activeTableTimer ||
      !activeTableTimer.isRunning ||
      !activeTableTimer.participants.includes(profile.userId)
    ) {
      return;
    }
    setIsTimerRunning(true);
    const updateSyncedRemaining = () => {
      const elapsedSec = Math.floor(
        (Date.now() - activeTableTimer.startedAtMs) / 1000
      );
      const rem = Math.max(0, activeTableTimer.durationSec - elapsedSec);
      setSecondsLeft(rem);
    };
    updateSyncedRemaining();
    const id = window.setInterval(updateSyncedRemaining, 1000);
    return () => window.clearInterval(id);
  }, [activeTableTimer, profile.userId]);

  // Personal Pomodoro Timer Countdown Tick
  useEffect(() => {
    if (!isTimerRunning) return;
    if (
      activeTableTimer?.isRunning &&
      activeTableTimer.participants.includes(profile.userId)
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          soundEngine.playTimerComplete();
          setIsTimerRunning(false);
          setFocusStartedAtMs(null);

          if (timerPhase === 'focus') {
            const sessionMins = focusPrefs.focusMinutes;
            const seatLabel = selectedSeatId
              ? SEATS[selectedSeatId].name
              : 'Café Overview';

            setFocusPrefs((fp) => ({
              ...fp,
              completedSessions: fp.completedSessions + 1,
              totalFocusMinutes: fp.totalFocusMinutes + sessionMins,
              tasks: fp.tasks.map((t) =>
                t.id === 'welcome-3' ? { ...t, completed: true } : t
              ),
              history: [
                ...fp.history,
                {
                  id: `sess-${Date.now()}`,
                  completedAt: Date.now(),
                  durationMinutes: sessionMins,
                  goal: fp.currentGoal || 'Focused study session',
                  roomName: activeTheme.name,
                  seatName: seatLabel,
                },
              ],
            }));

            setCompletionBanner(
              `Focus session complete! (${sessionMins}m at ${seatLabel}). Enjoy a warm coffee break.`
            );
            window.setTimeout(() => setCompletionBanner(null), 5500);

            setTimerPhase('shortBreak');
            return focusPrefs.shortBreakMinutes * 60;
          } else {
            setCompletionBanner('Break finished! Ready for your next focus block.');
            window.setTimeout(() => setCompletionBanner(null), 4500);
            setTimerPhase('focus');
            return focusPrefs.focusMinutes * 60;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [
    isTimerRunning,
    timerPhase,
    focusPrefs.focusMinutes,
    focusPrefs.shortBreakMinutes,
    selectedSeatId,
    activeTheme.name,
    activeTableTimer,
    profile.userId,
  ]);

  // Prompt unauthenticated visitors to sign in with GitHub
  const handleRequireAuth = (reason?: string) => {
    setAuthModalNotice(
      reason ||
        'Sign in with GitHub to occupy a persistent seat, chat, add friends, and show your profile picture.'
    );
    setIsAvatarModalOpen(true);
  };

  // Start OAuth 2.0 + PKCE (S256) Login or Account Linking
  const handleStartOAuth = async (
    provider: SocialProvider,
    mode: 'login' | 'link',
    usernameHint?: string,
    displayNameHint?: string
  ) => {
    // If connected to the Rust OAuth 2.0 + PKCE server, execute the server OAuth redirect flow
    if (connectionStatus === 'connected-server') {
      const returnTo = window.location.href.split('#')[0];
      const oauthUrl = buildServerOAuthStartUrl({
        provider,
        mode,
        returnTo,
        sessionId: profile.sessionId,
        csrfToken: profile.csrfToken,
        loginHint: usernameHint,
      });
      window.location.assign(oauthUrl);
      return;
    }

    // Fallback for static GitHub Pages: Web Crypto SHA-256 PKCE + Live Public GitHub Profile Lookup
    const resolved = await resolvePublicSocialProfile(
      provider,
      usernameHint || 'eval-exec',
      displayNameHint
    );

    const newIdentId = `id_${provider}_${resolved.providerUserId}`;

    // Account-linking conflict check against existing active visitors in the room
    const conflictingVisitor = visitors.find(
      (v) =>
        v.userId !== profile.userId &&
        (v.primaryIdentity?.id === newIdentId ||
          v.linkedIdentities?.some((li) => li.id === newIdentId))
    );
    if (conflictingVisitor) {
      throw new Error(
        `@${resolved.username} (GitHub) is already linked to another active café visitor.`
      );
    }

    if (mode === 'link' && profile.isAuthenticated) {
      const newIdent: SocialIdentity = {
        id: newIdentId,
        userId: profile.userId,
        provider: resolved.provider,
        providerUserId: resolved.providerUserId,
        username: resolved.username,
        displayName: resolved.displayName,
        avatarUrl: resolved.avatarUrl,
        profileUrl: resolved.profileUrl,
        isPublic: true,
      };
      const filtered = profile.identities.filter((i) => i.id !== newIdentId);
      const nextIdentities = [...filtered, newIdent];
      setProfile((prev) => ({
        ...prev,
        identities: nextIdentities,
      }));
      setCompletionBanner(
        `Linked @${resolved.username} (GitHub) to your café account!`
      );
      window.setTimeout(() => setCompletionBanner(null), 4000);
    } else {
      // Login mode: use stable internal user ID derived from GitHub identity
      const internalUserId = `usr_${provider}_${resolved.providerUserId}`;
      const newIdent: SocialIdentity = {
        id: newIdentId,
        userId: internalUserId,
        provider: resolved.provider,
        providerUserId: resolved.providerUserId,
        username: resolved.username,
        displayName: resolved.displayName,
        avatarUrl: resolved.avatarUrl,
        profileUrl: resolved.profileUrl,
        isPublic: true,
      };
      setProfile((prev) => ({
        ...prev,
        userId: internalUserId,
        isAuthenticated: true,
        displayName: resolved.displayName,
        preferredIdentityId: newIdentId,
        preferredAvatarIdentityId: newIdentId,
        identities: [newIdent],
      }));
      setCompletionBanner(
        `Signed in as ${resolved.displayName} (@${resolved.username}) via GitHub!`
      );
      window.setTimeout(() => setCompletionBanner(null), 4000);
    }
    setAuthModalNotice(null);
  };

  // Update Profile & Sync with Server if Session Active
  const handleUpdateProfile = async (next: UserProfile) => {
    setProfile(next);
    if (next.sessionId && next.csrfToken && connectionStatus === 'connected-server') {
      try {
        await fetch(`${getApiBaseUrl()}/api/auth/preferences`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${next.sessionId}`,
            'X-CSRF-Token': next.csrfToken,
          },
          credentials: 'include',
          body: JSON.stringify({
            displayName: next.displayName,
            preferredIdentityId: next.preferredIdentityId,
            preferredAvatarIdentityId: next.preferredAvatarIdentityId,
            publicIdentityIds: next.identities
              .filter((i) => i.isPublic !== false)
              .map((i) => i.id),
            activity: next.activityStatus,
            avatar: next.avatar,
            friends: next.friends.map((f) => f.userId),
          }),
        });
      } catch {
        // ignore network error
      }
    }
  };

  // Disconnect a Linked Provider (GitHub or X)
  const handleDisconnectIdentity = async (identityId: string) => {
    if (profile.identities.length <= 1) {
      setAuthModalNotice(
        'Cannot disconnect your only login provider. Connect a second provider first.'
      );
      return;
    }

    if (
      profile.sessionId &&
      profile.csrfToken &&
      connectionStatus === 'connected-server'
    ) {
      try {
        const res = await fetch(
          `${getApiBaseUrl()}/api/auth/identities/${encodeURIComponent(
            identityId
          )}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${profile.sessionId}`,
              'X-CSRF-Token': profile.csrfToken,
            },
            credentials: 'include',
          }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.user && data.identities) {
            setProfile((prev) => ({
              ...prev,
              preferredIdentityId: data.user.preferredIdentityId,
              preferredAvatarIdentityId: data.user.preferredAvatarIdentityId,
              identities: data.identities,
            }));
            setCompletionBanner('Disconnected linked social provider.');
            window.setTimeout(() => setCompletionBanner(null), 3500);
            return;
          }
        }
      } catch {
        // fallback to local update
      }
    }

    const remaining = profile.identities.filter((i) => i.id !== identityId);
    if (remaining.length === 0) return;
    const fallbackId = remaining[0].id;
    setProfile((prev) => ({
      ...prev,
      identities: remaining,
      preferredIdentityId:
        prev.preferredIdentityId === identityId
          ? fallbackId
          : prev.preferredIdentityId,
      preferredAvatarIdentityId:
        prev.preferredAvatarIdentityId === identityId
          ? fallbackId
          : prev.preferredAvatarIdentityId,
    }));
    setCompletionBanner('Disconnected linked social provider.');
    window.setTimeout(() => setCompletionBanner(null), 3500);
  };

  // Sign Out & Immediately Remove Active Café Presence + Release Seat
  const handleSignOut = async () => {
    if (
      profile.sessionId &&
      profile.csrfToken &&
      connectionStatus === 'connected-server'
    ) {
      try {
        await fetch(`${getApiBaseUrl()}/api/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${profile.sessionId}`,
            'X-CSRF-Token': profile.csrfToken,
          },
          credentials: 'include',
        });
      } catch {
        // ignore
      }
    }

    multiplayerClient.removeActivePresence();
    try {
      localStorage.removeItem(PROFILE_STORAGE_KEY);
      sessionStorage.removeItem(SESSION_ID_KEY);
    } catch {
      // ignore
    }

    const freshGuest = createSessionIdentity();
    setSelectedSeatId(null);
    if (scene === 'seated') {
      setScene('interior');
    }
    setProfile((prev) => ({
      ...prev,
      userId: freshGuest.userId,
      authToken: freshGuest.authToken,
      sessionId: undefined,
      csrfToken: undefined,
      isAuthenticated: false,
      displayName: freshGuest.defaultSubName,
      preferredIdentityId: '',
      preferredAvatarIdentityId: null,
      identities: [],
    }));
    setIsAvatarModalOpen(false);
    setCompletionBanner(
      'Signed out of Eval Exec’s Cafe. Your seat has been released.'
    );
    window.setTimeout(() => setCompletionBanner(null), 4000);
  };

  // Switch Between Multiple Café Worlds
  const handleSwitchRoom = (nextRoomId: CafeRoomId) => {
    if (nextRoomId === roomId) {
      setIsRoomMenuOpen(false);
      return;
    }
    const nextTheme = CAFE_THEMES[nextRoomId];
    setRoomId(nextRoomId);
    setSelectedSeatId(null);
    if (scene === 'seated') setScene('interior');
    setTimeOfDay(nextTheme.defaultTimeOfDay);
    multiplayerClient.switchRoom(nextRoomId);
    setIsRoomMenuOpen(false);
    setCompletionBanner(`Entered ${nextTheme.name} — ${nextTheme.subtitle}`);
    window.setTimeout(() => setCompletionBanner(null), 3500);
  };

  // Enter the Café from the Street
  const handleEnterCafe = () => {
    soundEngine.unlockIfNeeded();
    if (audioPrefs.autoPlay) {
      const nextAudio: AudioPreferences = {
        ...audioPrefs,
        isPlaying: true,
        quietMode: false,
      };
      setAudioPrefs(nextAudio);
      soundEngine.initAndApply(nextAudio);
    }
    soundEngine.playDoorBell();

    if (reducedMotion || profile.skipAnimations) {
      setScene('interior');
      return;
    }

    setIsTransitioning(true);
    window.setTimeout(() => {
      setScene('interior');
      setIsTransitioning(false);
    }, 580);
  };

  // Return Outside to the Street View
  const handleReturnToStreet = () => {
    soundEngine.playDoorBell();
    multiplayerClient.claimSeat(null);
    setSelectedSeatId(null);
    setHoveredSeatId(null);
    setScene('street');
  };

  // Sit Down at One of the 12 Seats (Requires GitHub Authentication)
  const handleSelectSeat = (seatId: SeatId) => {
    if (!profile.isAuthenticated) {
      handleRequireAuth(
        `Sign in with GitHub to sit at ${SEATS[seatId].name} and join the live café.`
      );
      return;
    }

    const holderId = seatOccupancy[seatId];
    if (holderId && holderId !== profile.userId) {
      const holder = visitors.find((v) => v.userId === holderId);
      setCompletionBanner(
        `${SEATS[seatId].name} is currently occupied by ${
          holder?.displayName || 'another visitor'
        }.`
      );
      window.setTimeout(() => setCompletionBanner(null), 3200);
      return;
    }

    const claimed = multiplayerClient.claimSeat(seatId);
    if (!claimed) return;

    soundEngine.playSeatSelect();
    setSelectedSeatId(seatId);
    setHoveredSeatId(null);
    setScene('seated');

    const seatCfg = SEATS[seatId];
    const nextStatus =
      seatCfg.zone === 'lounge'
        ? 'chatting'
        : profile.activityStatus === 'break' || profile.activityStatus === 'chatting'
        ? 'focusing'
        : profile.activityStatus;

    if (nextStatus !== profile.activityStatus) {
      setProfile((prev) => ({ ...prev, activityStatus: nextStatus }));
    }

    if (!isTimerRunning && secondsLeft > 0 && seatCfg.zone !== 'lounge') {
      setIsTimerRunning(true);
      setFocusStartedAtMs(Date.now());
    }

    setFocusPrefs((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === 'welcome-1' ? { ...t, completed: true } : t
      ),
    }));
  };

  // Stand Up & Return to Café Interior Overview
  const handleStandUp = () => {
    soundEngine.playSeatSelect();
    multiplayerClient.claimSeat(null);
    setSelectedSeatId(null);
    setScene('interior');
  };

  // Switch Timer Phase or Duration
  const handleSelectPhaseDuration = (phase: TimerPhase, minutes: number) => {
    setIsTimerRunning(false);
    setFocusStartedAtMs(null);
    setTimerPhase(phase);
    setSecondsLeft(minutes * 60);
  };

  const handleResetTimer = () => {
    setIsTimerRunning(false);
    setFocusStartedAtMs(null);
    const mins =
      timerPhase === 'focus'
        ? focusPrefs.focusMinutes
        : timerPhase === 'shortBreak'
        ? focusPrefs.shortBreakMinutes
        : focusPrefs.longBreakMinutes;
    setSecondsLeft(mins * 60);
  };

  const handleToggleTimerRunning = () => {
    setIsTimerRunning((prev) => {
      const next = !prev;
      setFocusStartedAtMs(next ? Date.now() : null);
      return next;
    });
  };

  const handleSendReaction = (
    kind: ReactionKind,
    targetUserId: string | null = null
  ) => {
    if (!profile.isAuthenticated) {
      handleRequireAuth('Sign in with GitHub to wave and send reactions.');
      return;
    }
    multiplayerClient.sendReaction(kind, targetUserId);
    setFocusPrefs((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === 'welcome-2' ? { ...t, completed: true } : t
      ),
    }));
  };

  const handleAddFriend = (visitor: VisitorPresence) => {
    if (!profile.isAuthenticated) {
      handleRequireAuth('Sign in with GitHub to add café friends.');
      return;
    }
    if (profile.friends.some((f) => f.userId === visitor.userId)) return;
    const nextFriends = [
      ...profile.friends,
      {
        userId: visitor.userId,
        displayName: visitor.displayName,
        avatar: visitor.avatar,
        avatarUrl: visitor.avatarUrl || visitor.primaryIdentity?.avatarUrl || null,
        provider: visitor.primaryIdentity?.provider || null,
        username: visitor.primaryIdentity?.username || null,
        profileUrl: visitor.primaryIdentity?.profileUrl || null,
        addedAt: Date.now(),
      },
    ];
    handleUpdateProfile({ ...profile, friends: nextFriends });
  };

  const handleRemoveFriend = (userId: string) => {
    const nextFriends = profile.friends.filter((f) => f.userId !== userId);
    handleUpdateProfile({ ...profile, friends: nextFriends });
  };

  const handleInviteToTable = (visitor: VisitorPresence) => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    if (selectedSeatId) {
      const tableId = SEATS[selectedSeatId].tableId;
      const openSeat = SEAT_LIST.find(
        (s) =>
          s.tableId === tableId &&
          s.id !== selectedSeatId &&
          !seatOccupancy[s.id]
      );
      url.searchParams.set('seat', openSeat ? openSeat.id : selectedSeatId);
    } else {
      url.searchParams.set('scene', 'interior');
    }
    navigator.clipboard?.writeText(url.toString()).catch(() => {});
    multiplayerClient.sendReaction('wave', visitor.userId);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsZenFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsZenFullscreen(false);
    }
  };

  // Format MM:SS
  const totalPhaseSeconds = activeTableTimer?.isRunning
    ? activeTableTimer.durationSec
    : (timerPhase === 'focus'
        ? focusPrefs.focusMinutes
        : timerPhase === 'shortBreak'
        ? focusPrefs.shortBreakMinutes
        : focusPrefs.longBreakMinutes) * 60;
  const progressFraction =
    totalPhaseSeconds > 0
      ? Math.max(0, Math.min(1, 1 - secondsLeft / totalPhaseSeconds))
      : 0;
  const displayMins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const displaySecs = String(secondsLeft % 60).padStart(2, '0');

  const hoveredSeat = hoveredSeatId ? SEATS[hoveredSeatId] : null;
  const isRaining = audioPrefs.ambientEnabled.rain && !audioPrefs.quietMode;
  const isFireplaceActive = audioPrefs.ambientEnabled.fire && !audioPrefs.quietMode;

  // Authenticated visitors appear in the café; unauthenticated visitors preview the café
  const effectiveVisitors: VisitorPresence[] = React.useMemo(() => {
    const filtered = visitors.filter(
      (v) => !profile.blockedUserIds.includes(v.userId)
    );
    if (!profile.isAuthenticated || profile.invisible) {
      return filtered.filter((v) => v.userId !== profile.userId);
    }
    const publicIdents = profile.identities.filter((i) => i.isPublic !== false);
    const hasSelf = filtered.some((v) => v.userId === profile.userId);
    if (hasSelf) {
      return filtered.map((v) =>
        v.userId === profile.userId
          ? {
              ...v,
              isAuthenticated: true,
              displayName: profile.displayName,
              avatar: profile.avatar,
              avatarUrl: activeAvatarUrl,
              primaryIdentity: activePrimaryIdentity,
              linkedIdentities: publicIdents,
              seatId: selectedSeatId,
              activityStatus: profile.activityStatus,
              focusGoal: focusPrefs.shareFocusGoal
                ? focusPrefs.currentGoal
                : null,
            }
          : v
      );
    }
    return [
      ...filtered,
      {
        userId: profile.userId,
        isAuthenticated: true,
        displayName: profile.displayName,
        avatar: profile.avatar,
        avatarUrl: activeAvatarUrl,
        primaryIdentity: activePrimaryIdentity,
        linkedIdentities: publicIdents,
        seatId: selectedSeatId,
        activityStatus: profile.activityStatus,
        focusGoal: focusPrefs.shareFocusGoal ? focusPrefs.currentGoal : null,
        shareFocusGoal: focusPrefs.shareFocusGoal,
        focusStartedAtMs,
        invisible: false,
        lastHeartbeatMs: Date.now(),
      },
    ];
  }, [
    visitors,
    profile,
    activeAvatarUrl,
    activePrimaryIdentity,
    selectedSeatId,
    focusPrefs.currentGoal,
    focusPrefs.shareFocusGoal,
    focusStartedAtMs,
  ]);

  const filteredSeats = SEAT_LIST.filter(
    (s) => seatZoneFilter === 'all' || s.zone === seatZoneFilter
  );

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-[#181210] select-none"
      onClick={() => {
        if (isAudioOpen) setIsAudioOpen(false);
        if (isNotebookOpen) setIsNotebookOpen(false);
        if (isRoomMenuOpen) setIsRoomMenuOpen(false);
      }}
    >
      {/* ================= 1. FULL-VIEWPORT ILLUSTRATED SVG WORLD ================= */}
      <main className="w-full h-full">
        {scene === 'street' ? (
          <StreetSceneSVG
            timeOfDay={timeOfDay}
            isRaining={isRaining}
            reducedMotion={reducedMotion || isTimerRunning}
            onEnterCafe={handleEnterCafe}
          />
        ) : (
          <InteriorSceneSVG
            theme={activeTheme}
            selfUserId={profile.userId}
            visitors={effectiveVisitors}
            leavingVisitors={leavingVisitors}
            activeReactions={activeReactions}
            selectedSeatId={selectedSeatId}
            hoveredSeatId={hoveredSeatId}
            timeOfDay={timeOfDay}
            isRaining={isRaining}
            isFireplaceActive={isFireplaceActive}
            isTimerRunning={isTimerRunning}
            currentGoal={focusPrefs.currentGoal}
            reducedMotion={reducedMotion}
            skipAnimations={profile.skipAnimations}
            onSelectSeat={handleSelectSeat}
            onHoverSeat={setHoveredSeatId}
            onSelectVisitor={(v) => {
              setSelectedVisitor(v);
            }}
            onSipCoffee={() => soundEngine.playCoffeeSip()}
          />
        )}
      </main>

      {/* Warm Cross-Dissolve Veil when Stepping Through the Door */}
      <div
        className={`pointer-events-none fixed inset-0 z-30 bg-[#1B120C] transition-opacity duration-500 ${
          isTransitioning ? 'opacity-90' : 'opacity-0'
        }`}
      />

      {/* ================= 2. TOP FLOATING NAVIGATION, ROOM SWITCHER & PRESENCE BAR ================= */}
      <header className="fixed top-4 inset-x-4 sm:inset-x-6 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Café Emblem, Multi-Café Switcher & Scene Breadcrumb */}
        <div className="flex items-center gap-2 pointer-events-auto relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsRoomMenuOpen((prev) => !prev);
            }}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-[#1A130F]/90 hover:bg-[#241A14] backdrop-blur-md border border-[#D48C46]/35 shadow-lg text-left transition-colors"
            title="Switch Virtual Café Room"
          >
            <div className="w-7 h-7 rounded-xl bg-[#D48C46]/20 border border-[#D48C46]/45 flex items-center justify-center">
              <Coffee className="w-4 h-4 text-[#F3B664]" />
            </div>
            <div>
              <div className="font-serif text-sm font-semibold text-[#F9EFE3] leading-tight flex items-center gap-1.5">
                <span>{activeTheme.name}</span>
                <Globe className="w-3 h-3 text-[#D48C46]" />
              </div>
              <div className="text-[11px] text-[#C8B6A6] flex items-center gap-1.5">
                {scene === 'street' && <span>Storefront • Welcome</span>}
                {scene === 'interior' && <span>Interior • 3 Social Zones</span>}
                {scene === 'seated' && activeSeat && (
                  <span className="text-[#F3B664] font-medium">
                    {activeSeat.name} ({activeSeat.zoneLabel})
                  </span>
                )}
              </div>
            </div>
          </button>

          {/* Multiple Cafés Dropdown Menu */}
          {isRoomMenuOpen && (
            <div
              className="absolute top-14 left-0 z-50 w-72 rounded-2xl bg-[#1A130F]/95 backdrop-blur-xl border border-[#D48C46]/40 shadow-2xl p-2.5 animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#C8B6A6] px-2 py-1">
                Explore Virtual Café Worlds
              </div>
              <div className="space-y-1 mt-1">
                {CAFE_THEME_LIST.map((cafe) => {
                  const isCurrent = cafe.id === roomId;
                  return (
                    <button
                      key={cafe.id}
                      onClick={() => handleSwitchRoom(cafe.id)}
                      className={`w-full text-left p-2 rounded-xl border transition-all ${
                        isCurrent
                          ? 'bg-[#D48C46]/25 border-[#F3B664] text-[#F9EFE3]'
                          : 'bg-[#241A15]/80 border-white/5 text-[#C8B6A6] hover:text-[#F4ECE1] hover:border-[#D48C46]/35'
                      }`}
                    >
                      <div className="text-xs font-semibold flex items-center justify-between">
                        <span>{cafe.name}</span>
                        {isCurrent && (
                          <span className="text-[10px] text-[#68D391]">Current</span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#A89686]">{cafe.subtitle}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Contextual Scene Transition Button */}
          {scene === 'street' ? (
            <button
              onClick={handleEnterCafe}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#D48C46] hover:bg-[#E29A52] text-[#1A120D] font-semibold text-xs shadow-lg transition-all"
            >
              <DoorOpen className="w-4 h-4" />
              <span>Step Inside Café</span>
            </button>
          ) : scene === 'seated' ? (
            <button
              onClick={handleStandUp}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#241A14]/90 hover:bg-[#33241C] text-[#F4ECE1] border border-[#F3B664]/50 font-semibold text-xs shadow-lg transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#F3B664]" />
              <span>Stand Up / Overview</span>
            </button>
          ) : (
            <button
              onClick={handleReturnToStreet}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#1A130F]/85 hover:bg-[#281D17] text-[#C8B6A6] hover:text-[#F4ECE1] border border-white/10 text-xs shadow-lg transition-all"
            >
              <DoorOpen className="w-3.5 h-3.5 text-[#D48C46]" />
              <span className="hidden sm:inline">Street View</span>
            </button>
          )}
        </div>

        {/* Center: GitHub Social Identity Pill, Live Room Presence & Wave */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {profile.isAuthenticated ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAuthModalNotice(null);
                setIsAvatarModalOpen(true);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-[#1A130F]/90 hover:bg-[#281D17] backdrop-blur-md border border-[#68D391]/45 text-xs text-[#F4ECE1] shadow-lg transition-all"
              title="Manage your GitHub identity & isometric avatar"
            >
              <div className="relative w-6 h-6 rounded-full bg-amber-950 border border-[#68D391] overflow-hidden flex items-center justify-center shrink-0">
                {activeAvatarUrl ? (
                  <img
                    src={activeAvatarUrl}
                    alt={profile.displayName}
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[10px] font-bold text-amber-200">
                    {profile.displayName.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              {activePrimaryIdentity && (
                <ProviderIcon
                  provider={activePrimaryIdentity.provider}
                  className="w-3.5 h-3.5 text-[#F3B664]"
                />
              )}
              <span className="font-semibold max-w-[115px] truncate">
                {profile.displayName}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-[#F3B664] hidden sm:inline">
                {profile.activityStatus}
              </span>
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAuthModalNotice(null);
                setIsAvatarModalOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-[#241A14] to-[#2F2119] hover:from-[#2F2119] hover:to-[#3B291F] backdrop-blur-md border border-[#F3B664]/55 text-xs text-[#FFE0B5] font-semibold shadow-lg transition-all"
              title="Sign in with GitHub to claim a seat and display your profile picture"
            >
              <LogIn className="w-3.5 h-3.5 text-[#F3B664]" />
              <ProviderIcon provider="github" className="w-3.5 h-3.5" />
              <span>Sign In with GitHub</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-200 hidden md:inline">
                Preview Mode
              </span>
            </button>
          )}

          {/* Live Room Presence & Social Lounge Trigger */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsSocialOpen((prev) => !prev);
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-2xl backdrop-blur-md border text-xs font-semibold shadow-lg transition-all ${
              isSocialOpen
                ? 'bg-[#281D17] border-[#F3B664] text-[#FFE0B5]'
                : 'bg-[#1A130F]/90 border-[#D48C46]/30 text-[#F4ECE1] hover:border-[#F3B664]'
            }`}
            title={
              connectionStatus === 'connected-server'
                ? 'Connected to Live Rust/Axum Server'
                : 'Connected to Multi-Tab Room Mesh'
            }
          >
            <span className="w-2 h-2 rounded-full bg-[#68D391] animate-pulse" />
            <Users className="w-3.5 h-3.5 text-[#F3B664]" />
            <span>{effectiveVisitors.length} in Café</span>
          </button>

          {/* Quick Wave Button */}
          {scene !== 'street' && (
            <button
              onClick={() => handleSendReaction('wave', null)}
              className="p-2 rounded-2xl bg-[#1A130F]/90 hover:bg-[#281D17] backdrop-blur-md border border-[#D48C46]/30 text-xs shadow-lg transition-all"
              title="Wave hello to the café room (👋)"
            >
              👋
            </button>
          )}
        </div>

        {/* Right: Lighting Atmosphere (Morning / Afternoon / Dusk / Night), Rain, Motion & Zen Mode */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <div className="flex items-center bg-[#1A130F]/85 backdrop-blur-md p-1 rounded-2xl border border-[#D48C46]/25 shadow-lg">
            {(
              [
                {
                  id: 'morning',
                  label: 'Morning',
                  icon: <Sunrise className="w-3.5 h-3.5" />,
                },
                {
                  id: 'afternoon',
                  label: 'Afternoon',
                  icon: <Sun className="w-3.5 h-3.5" />,
                },
                {
                  id: 'dusk',
                  label: 'Evening',
                  icon: <Sunset className="w-3.5 h-3.5" />,
                },
                {
                  id: 'night',
                  label: 'Night',
                  icon: <Moon className="w-3.5 h-3.5" />,
                },
              ] as const
            ).map((tod) => (
              <button
                key={tod.id}
                onClick={() => setTimeOfDay(tod.id)}
                title={`${tod.label} lighting`}
                className={`flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-medium transition-all ${
                  timeOfDay === tod.id
                    ? 'bg-[#D48C46]/25 text-[#FFE0B5] border border-[#F3B664]/40'
                    : 'text-[#C8B6A6] hover:text-[#F4ECE1]'
                }`}
              >
                {tod.icon}
                <span className="hidden xl:inline">{tod.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() =>
              setAudioPrefs((prev) => ({
                ...prev,
                isPlaying: true,
                quietMode: false,
                ambientEnabled: {
                  ...prev.ambientEnabled,
                  rain: !prev.ambientEnabled.rain,
                },
              }))
            }
            title="Toggle Rainy Weather & Window Raindrops"
            className={`p-2 rounded-2xl backdrop-blur-md border shadow-lg transition-all ${
              isRaining
                ? 'bg-[#253545]/90 border-[#8AB8E6] text-[#B8D8F8]'
                : 'bg-[#1A130F]/85 border-white/10 text-[#C8B6A6] hover:text-[#F4ECE1]'
            }`}
          >
            <CloudRain className="w-4 h-4" />
          </button>

          <button
            onClick={() => setReducedMotion((prev) => !prev)}
            title={
              reducedMotion
                ? 'Reduced motion is ON'
                : 'Toggle Reduced Motion accessibility mode'
            }
            className={`px-2.5 py-2 rounded-2xl backdrop-blur-md border text-[11px] font-medium shadow-lg transition-all hidden md:flex items-center gap-1 ${
              reducedMotion
                ? 'bg-[#D48C46]/25 border-[#F3B664] text-[#FFE0B5]'
                : 'bg-[#1A130F]/85 border-white/10 text-[#C8B6A6] hover:text-[#F4ECE1]'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{reducedMotion ? 'Calm' : 'Motion'}</span>
          </button>

          <button
            onClick={toggleFullscreen}
            title="Toggle Fullscreen Distraction-Free Mode"
            className="p-2 rounded-2xl bg-[#1A130F]/85 backdrop-blur-md border border-white/10 text-[#C8B6A6] hover:text-[#F4ECE1] shadow-lg transition-all"
            aria-label="Toggle Fullscreen"
          >
            {isZenFullscreen ? (
              <Minimize2 className="w-4 h-4 text-[#F3B664]" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* ================= 3. HOVERED SEAT PREVIEW CARD & ZONE-FILTERED QUICK SEAT BAR ================= */}
      {scene === 'interior' && hoveredSeat && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-fade-in">
          <div className="px-4 py-2.5 rounded-2xl bg-[#1A130F]/95 backdrop-blur-xl border border-[#F3B664]/50 shadow-2xl max-w-md text-center">
            <div className="flex items-center justify-center gap-2 mb-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#D48C46]/25 text-[#FFE0B5]">
                {hoveredSeat.zoneLabel}
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#68D391]/15 text-[#9AE6B4]">
                {hoveredSeat.vibeTag}
              </span>
            </div>
            <h2 className="font-serif text-base font-semibold text-[#F9EFE3]">
              {hoveredSeat.name}
            </h2>
            <p className="text-xs text-[#C8B6A6] mt-0.5">{hoveredSeat.description}</p>
          </div>
        </div>
      )}

      {/* Zone-Grouped Quick Seat Selector Bar */}
      {scene !== 'street' && (
        <div className="fixed bottom-20 inset-x-4 z-20 flex justify-center pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-1 px-2.5 py-1.5 rounded-2xl bg-[#1A130F]/85 backdrop-blur-md border border-[#D48C46]/25 shadow-xl overflow-x-auto no-scrollbar max-w-full">
            {/* Zone Filter Pills */}
            <div className="flex items-center gap-0.5 pr-1.5 mr-1 border-r border-white/10 shrink-0">
              {(
                [
                  { id: 'all', label: 'All (12)' },
                  { id: 'quiet', label: 'Quiet Study' },
                  { id: 'shared', label: 'Shared Table' },
                  { id: 'lounge', label: 'Lounge & Bar' },
                ] as const
              ).map((zf) => (
                <button
                  key={zf.id}
                  onClick={() => setSeatZoneFilter(zf.id)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors ${
                    seatZoneFilter === zf.id
                      ? 'bg-[#D48C46]/30 text-[#FFE0B5]'
                      : 'text-[#A89686] hover:text-[#F4ECE1]'
                  }`}
                >
                  {zf.label}
                </button>
              ))}
            </div>

            {filteredSeats.map((seat) => {
              const isSelected = selectedSeatId === seat.id;
              const holderId = seatOccupancy[seat.id];
              const isTakenByOther = Boolean(holderId && holderId !== profile.userId);
              return (
                <button
                  key={seat.id}
                  onClick={() =>
                    isSelected ? handleStandUp() : handleSelectSeat(seat.id)
                  }
                  onMouseEnter={() => !selectedSeatId && setHoveredSeatId(seat.id)}
                  onMouseLeave={() => setHoveredSeatId(null)}
                  className={`px-2 py-1 rounded-xl text-[11px] font-medium transition-all shrink-0 flex items-center gap-1 whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#D48C46] text-[#1A120D] font-semibold shadow-sm'
                      : isTakenByOther
                      ? 'bg-[#E56B4E]/15 text-[#E59880] border border-[#E56B4E]/30'
                      : 'text-[#D6C5B5] hover:text-[#FFF3DF] hover:bg-white/5'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected
                        ? 'bg-[#1A120D]'
                        : isTakenByOther
                        ? 'bg-[#E56B4E]'
                        : 'bg-[#68D391]'
                    }`}
                  />
                  <span>{seat.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Toast Notification Banner */}
      {completionBanner && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 px-5 py-3 rounded-2xl bg-[#1E1612]/95 border border-[#68D391] shadow-2xl flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-[#68D391] shrink-0" />
          <span className="text-xs sm:text-sm font-medium text-[#F9EFE3]">
            {completionBanner}
          </span>
        </div>
      )}

      {/* ================= 4. OVERLAY PANELS & MODALS ================= */}
      <AudioMixerPopover
        prefs={audioPrefs}
        isOpen={isAudioOpen}
        onChange={setAudioPrefs}
        onClose={() => setIsAudioOpen(false)}
      />

      <FocusOverlayPanel
        prefs={focusPrefs}
        isOpen={isNotebookOpen}
        activePhase={timerPhase}
        activeSeat={activeSeat}
        sharedTimer={activeTableTimer}
        selfUserId={profile.userId}
        onClose={() => setIsNotebookOpen(false)}
        onChangePrefs={setFocusPrefs}
        onSelectPhaseDuration={handleSelectPhaseDuration}
        onStartSharedTimer={() => {
          if (!profile.isAuthenticated) {
            handleRequireAuth(
              'Sign in with GitHub to start a shared table Pomodoro timer.'
            );
            return;
          }
          if (!activeSeat) return;
          multiplayerClient.startSharedTimer(
            activeSeat.tableId,
            timerPhase,
            focusPrefs.focusMinutes * 60,
            focusPrefs.currentGoal || 'Collaborative Focus Session'
          );
        }}
        onJoinSharedTimer={() => {
          if (!profile.isAuthenticated) {
            handleRequireAuth(
              'Sign in with GitHub to join a shared table Pomodoro timer.'
            );
            return;
          }
          if (!activeSeat) return;
          multiplayerClient.joinSharedTimer(activeSeat.tableId);
        }}
        onStopSharedTimer={() => {
          if (!activeSeat) return;
          multiplayerClient.stopSharedTimer(activeSeat.tableId);
        }}
      />

      {isAvatarModalOpen && (
        <AvatarProfileModal
          profile={profile}
          authNotice={authModalNotice}
          onUpdateProfile={handleUpdateProfile}
          onStartOAuth={handleStartOAuth}
          onApplyVerifiedGithubSession={({
            session,
            providerUserId,
            username,
            displayName,
            avatarUrl,
            profileUrl,
          }) => {
            if (session && session.authenticated && session.user && session.identities) {
              const u = session.user;
              const idents = session.identities;
              setProfile((prev) => ({
                ...prev,
                userId: u.id,
                authToken: session.wsToken || prev.authToken,
                csrfToken: session.csrfToken,
                sessionId: session.sessionId,
                isAuthenticated: true,
                displayName: u.displayName,
                preferredIdentityId: u.preferredIdentityId,
                preferredAvatarIdentityId:
                  u.preferredAvatarIdentityId !== undefined
                    ? u.preferredAvatarIdentityId
                    : u.preferredIdentityId,
                identities: idents,
              }));
              setCompletionBanner(
                `Verified & signed in as ${u.displayName} (@${idents[0]?.username || u.displayName}) via GitHub!`
              );
              window.setTimeout(() => setCompletionBanner(null), 4200);
              setIsAvatarModalOpen(false);
              setAuthModalNotice(null);
              return;
            }
            if (providerUserId && username) {
              const internalUserId = `usr_github_${providerUserId}`;
              const newIdentId = `id_github_${providerUserId}`;
              const newIdent: SocialIdentity = {
                id: newIdentId,
                userId: internalUserId,
                provider: 'github',
                providerUserId,
                username,
                displayName: displayName || username,
                avatarUrl: avatarUrl || null,
                profileUrl: profileUrl || `https://github.com/${username}`,
                isPublic: true,
              };
              setProfile((prev) => ({
                ...prev,
                userId: internalUserId,
                isAuthenticated: true,
                displayName: displayName || username,
                preferredIdentityId: newIdentId,
                preferredAvatarIdentityId: newIdentId,
                identities: [newIdent],
              }));
              setCompletionBanner(
                `Verified & signed in as ${displayName || username} (@${username}) via GitHub!`
              );
              window.setTimeout(() => setCompletionBanner(null), 4200);
              setIsAvatarModalOpen(false);
              setAuthModalNotice(null);
            }
          }}
          onDisconnectIdentity={handleDisconnectIdentity}
          onSignOut={handleSignOut}
          onClose={() => {
            setIsAvatarModalOpen(false);
            setAuthModalNotice(null);
          }}
        />
      )}

      {selectedVisitor && (
        <VisitorProfileCardModal
          visitor={selectedVisitor}
          profile={profile}
          currentSeatId={selectedSeatId}
          seatOccupancy={seatOccupancy}
          onClose={() => setSelectedVisitor(null)}
          onSendReaction={handleSendReaction}
          onAddFriend={handleAddFriend}
          onRemoveFriend={handleRemoveFriend}
          onSelectSeat={handleSelectSeat}
          onInviteToTable={handleInviteToTable}
          onToggleMuteUser={(uid) => {
            const exists = profile.mutedUserIds.includes(uid);
            handleUpdateProfile({
              ...profile,
              mutedUserIds: exists
                ? profile.mutedUserIds.filter((id) => id !== uid)
                : [...profile.mutedUserIds, uid],
            });
          }}
          onToggleBlockUser={(uid) => {
            const exists = profile.blockedUserIds.includes(uid);
            handleUpdateProfile({
              ...profile,
              blockedUserIds: exists
                ? profile.blockedUserIds.filter((id) => id !== uid)
                : [...profile.blockedUserIds, uid],
            });
          }}
          onReportUser={(uid, reason) => multiplayerClient.reportUser(uid, reason)}
          onRequireAuth={() => {
            setSelectedVisitor(null);
            handleRequireAuth();
          }}
        />
      )}

      <SocialLoungeDrawer
        isOpen={isSocialOpen}
        profile={profile}
        visitors={effectiveVisitors}
        messages={chatMessages}
        activeSeat={activeSeat}
        selectedVisitor={null}
        roomName={activeTheme.name}
        onClose={() => setIsSocialOpen(false)}
        onSendReaction={handleSendReaction}
        onSendChat={(tableId, text) => {
          if (!profile.isAuthenticated) {
            handleRequireAuth('Sign in with GitHub to chat in the café.');
            return;
          }
          multiplayerClient.sendChat(tableId, text);
        }}
        onSelectSeat={handleSelectSeat}
        onUpdateProfile={handleUpdateProfile}
        onReportUser={(uid, reason) => multiplayerClient.reportUser(uid, reason)}
        onClearSelectedVisitor={() => setSelectedVisitor(null)}
      />

      {/* ================= 5. BOTTOM FLOATING AMBIENT DOCK ================= */}
      <footer className="fixed bottom-4 inset-x-4 sm:inset-x-6 z-20 flex items-center justify-between gap-2 pointer-events-none">
        {/* Left Dock: Soundscape & Ambience Controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const next: AudioPreferences = {
                ...audioPrefs,
                isPlaying: !audioPrefs.isPlaying,
                quietMode: false,
                isMuted: false,
              };
              setAudioPrefs(next);
              soundEngine.initAndApply(next);
            }}
            className={`p-2.5 rounded-2xl backdrop-blur-md border shadow-xl transition-all ${
              audioPrefs.isPlaying && !audioPrefs.quietMode && !audioPrefs.isMuted
                ? 'bg-[#D48C46] border-[#F3B664] text-[#1A120D]'
                : 'bg-[#1A130F]/90 border-[#D48C46]/30 text-[#F4ECE1] hover:border-[#F3B664]'
            }`}
            aria-label={audioPrefs.isPlaying ? 'Pause audio' : 'Play audio'}
          >
            {audioPrefs.isPlaying && !audioPrefs.quietMode && !audioPrefs.isMuted ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsAudioOpen((prev) => !prev);
              setIsNotebookOpen(false);
            }}
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl backdrop-blur-md border shadow-xl transition-all ${
              isAudioOpen
                ? 'bg-[#281D17] border-[#F3B664] text-[#FFE0B5]'
                : 'bg-[#1A130F]/90 border-[#D48C46]/30 text-[#F4ECE1] hover:border-[#D48C46]/60'
            }`}
          >
            <Music className="w-4 h-4 text-[#F3B664]" />
            <div className="text-left">
              <div className="text-xs font-semibold leading-tight flex items-center gap-1.5">
                <span>
                  {audioPrefs.quietMode
                    ? 'Quiet Mode'
                    : audioPrefs.musicStyle === 'lofi'
                    ? 'Lo-Fi Study'
                    : audioPrefs.musicStyle === 'jazz'
                    ? 'Soft Jazz'
                    : audioPrefs.musicStyle === 'piano'
                    ? 'Gentle Piano'
                    : 'Café Ambience'}
                </span>
                {!audioPrefs.quietMode && (
                  <span className="flex items-center gap-1">
                    {audioPrefs.ambientEnabled.cafe && (
                      <Coffee className="w-3 h-3 text-[#F3B664]" />
                    )}
                    {audioPrefs.ambientEnabled.rain && (
                      <CloudRain className="w-3 h-3 text-[#8AB8E6]" />
                    )}
                    {audioPrefs.ambientEnabled.fire && (
                      <Flame className="w-3 h-3 text-[#E87A48]" />
                    )}
                    {audioPrefs.ambientEnabled.keyboard && (
                      <Keyboard className="w-3 h-3 text-[#A3E8BE]" />
                    )}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-[#C8B6A6] hidden sm:block">
                {audioPrefs.isPlaying && !audioPrefs.quietMode
                  ? 'Soundscape Active • Click to Mix'
                  : 'Click to Customize Soundscape'}
              </div>
            </div>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setAudioPrefs((prev) => ({ ...prev, isMuted: !prev.isMuted }));
            }}
            className="p-2.5 rounded-2xl bg-[#1A130F]/90 backdrop-blur-md border border-white/10 text-[#C8B6A6] hover:text-[#F4ECE1] shadow-xl transition-all hidden sm:flex"
            aria-label="Toggle Mute"
          >
            {audioPrefs.isMuted || audioPrefs.quietMode ? (
              <VolumeX className="w-4 h-4 text-[#E06D53]" />
            ) : (
              <Volume2 className="w-4 h-4 text-[#F3B664]" />
            )}
          </button>
        </div>

        {/* Center Dock: Personal & Shared Table Pomodoro Timer */}
        <div
          className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl bg-[#1A130F]/90 backdrop-blur-md border border-[#D48C46]/35 shadow-xl pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative w-8 h-8 flex items-center justify-center">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="rgba(212, 140, 70, 0.2)"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke={timerPhase === 'focus' ? '#F3B664' : '#68D391'}
                strokeWidth="3"
                strokeDasharray={94.2}
                strokeDashoffset={94.2 * (1 - progressFraction)}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <span
              className={`w-2 h-2 rounded-full ${
                isTimerRunning ? 'bg-[#68D391] animate-pulse' : 'bg-[#D48C46]'
              }`}
            />
          </div>

          <button
            onClick={() => {
              setIsNotebookOpen((prev) => !prev);
              setIsAudioOpen(false);
            }}
            className="text-left group"
          >
            <div className="font-mono text-base sm:text-lg font-semibold text-[#F9EFE3] tracking-wider leading-none">
              {displayMins}:{displaySecs}
            </div>
            <div className="text-[10px] text-[#C8B6A6] group-hover:text-[#F3B664] transition-colors">
              {activeTableTimer?.isRunning
                ? `Shared Table (${activeTableTimer.participants.length})`
                : timerPhase === 'focus'
                ? 'Focus Session'
                : timerPhase === 'shortBreak'
                ? 'Short Break'
                : 'Coffee Break'}
            </div>
          </button>

          <button
            onClick={handleToggleTimerRunning}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isTimerRunning
                ? 'bg-[#362820] text-[#F3B664] border border-[#F3B664]/40'
                : 'bg-[#D48C46] text-[#1A120D] hover:bg-[#E29A52]'
            }`}
          >
            {isTimerRunning ? 'Pause' : 'Start'}
          </button>

          <button
            onClick={handleResetTimer}
            className="p-1.5 rounded-xl text-[#C8B6A6] hover:text-[#F4ECE1] hover:bg-white/5 transition-colors"
            aria-label="Reset Timer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Dock: Study Notebook & Tasks Trigger */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsNotebookOpen((prev) => !prev);
              setIsAudioOpen(false);
            }}
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl backdrop-blur-md border shadow-xl transition-all ${
              isNotebookOpen
                ? 'bg-[#281D17] border-[#F3B664] text-[#FFE0B5]'
                : 'bg-[#1A130F]/90 border-[#D48C46]/30 text-[#F4ECE1] hover:border-[#D48C46]/60'
            }`}
          >
            <ListTodo className="w-4 h-4 text-[#F3B664]" />
            <div className="text-left">
              <div className="text-xs font-semibold leading-tight flex items-center gap-1.5">
                <span>Study Notebook</span>
                <span className="px-1.5 py-0.2 rounded-full bg-[#D48C46]/25 text-[#FFE0B5] font-mono text-[10px]">
                  {focusPrefs.tasks.filter((t) => !t.completed).length}
                </span>
              </div>
              <div className="text-[10px] text-[#C8B6A6] hidden sm:block max-w-[140px] truncate">
                {focusPrefs.currentGoal || 'Tasks & Shared Timer'}
              </div>
            </div>
          </button>
        </div>
      </footer>
    </div>
  );
}
export default App;

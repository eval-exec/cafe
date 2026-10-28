import React, { useEffect, useState } from 'react';
import {
  Armchair,
  ArrowLeft,
  CheckCircle2,
  CloudRain,
  Coffee,
  Compass,
  DoorOpen,
  Flame,
  Globe,
  Hand,
  Keyboard,
  ListTodo,
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
  User,
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
  ConnectionStatus,
  multiplayerClient,
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
const PROFILE_STORAGE_KEY = 'eval_exec_cafe_profile_v1';
const SESSION_ID_KEY = 'eval_exec_cafe_session_uid_v1';

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
      text: "Choose a seat in Eval Exec's Cafe (Quiet, Shared, or Lounge)",
      completed: false,
      createdAt: Date.now() - 120000,
    },
    {
      id: 'welcome-2',
      text: 'Customize your isometric SVG avatar & wave to a visitor',
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

function createSessionIdentity(): { userId: string; authToken: string; defaultSubName: string } {
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
    userId: `visitor-${Date.now()}-${randSuffix}`,
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
      const r = new URLSearchParams(window.location.search).get('room') as CafeRoomId | null;
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
      const tod = new URLSearchParams(window.location.search).get('tod') as TimeOfDay | null;
      if (tod && ['morning', 'afternoon', 'dusk', 'night'].includes(tod)) return tod;
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

  // User Profile & Avatar Identity
  const [profile, setProfile] = useState<UserProfile>(() => {
    const sessionIdent = createSessionIdentity();
    const urlName =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('name')
        : null;
    try {
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          userId: sessionIdent.userId,
          authToken: sessionIdent.authToken,
          displayName: urlName || parsed.displayName || sessionIdent.defaultSubName,
        };
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
      displayName: urlName || sessionIdent.defaultSubName,
      isRegistered: false,
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

  // Connect to Real-Time Multiplayer Server / Mesh on Mount
  useEffect(() => {
    multiplayerClient.connect(
      roomId,
      {
        userId: profile.userId,
        authToken: profile.authToken,
        displayName: profile.displayName,
        avatar: profile.avatar,
        activityStatus: profile.activityStatus,
        focusGoal: focusPrefs.currentGoal,
        shareFocusGoal: focusPrefs.shareFocusGoal,
        focusStartedAtMs,
        invisible: profile.invisible,
      },
      selectedSeatId
    );

    const unsubSnap = multiplayerClient.onSnapshot((snap) => {
      setVisitors(snap.visitors);
      setSeatOccupancy(snap.seatOccupancy || {});
      setSharedTimers(snap.sharedTimers || {});
      setChatMessages(snap.recentMessages || []);
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
      setCompletionBanner(reason);
      window.setTimeout(() => setCompletionBanner(null), 3500);
    });

    return () => {
      unsubSnap();
      unsubRx();
      unsubChat();
      unsubStatus();
      unsubErr();
    };
  }, []);

  // Sync Profile & Focus Goal Changes to Multiplayer Presence & LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // ignore
    }
    multiplayerClient.updateIdentity({
      displayName: profile.displayName,
      avatar: profile.avatar,
      activityStatus: profile.activityStatus,
      focusGoal: focusPrefs.currentGoal,
      shareFocusGoal: focusPrefs.shareFocusGoal,
      focusStartedAtMs,
      invisible: profile.invisible,
    });
  }, [
    profile,
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
      // Handled by shared timer sync effect above
      return;
    }

    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          setFocusStartedAtMs(null);
          soundEngine.playTimerComplete();
          if (timerPhase === 'focus') {
            const record = {
              id: `sess-${Date.now()}`,
              completedAt: Date.now(),
              durationMinutes: focusPrefs.focusMinutes,
              goal: focusPrefs.currentGoal,
              roomName: activeTheme.name,
              seatName: activeSeat?.name || 'Café Overview',
            };
            setFocusPrefs((fp) => ({
              ...fp,
              completedSessions: fp.completedSessions + 1,
              totalFocusMinutes: fp.totalFocusMinutes + fp.focusMinutes,
              history: [record, ...(fp.history || []).slice(0, 29)],
              tasks: fp.tasks.map((t) =>
                t.id === 'welcome-3' ? { ...t, completed: true } : t
              ),
            }));
            multiplayerClient.sendReaction('celebrate', null);
            setCompletionBanner(
              'Focus session complete! Henri poured you a fresh cup of coffee ☕'
            );
          } else {
            setCompletionBanner('Break finished — ready to settle back into focus?');
          }
          window.setTimeout(() => setCompletionBanner(null), 6000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [
    isTimerRunning,
    timerPhase,
    activeTableTimer,
    profile.userId,
    focusPrefs.focusMinutes,
    focusPrefs.currentGoal,
    activeTheme.name,
    activeSeat,
  ]);

  // Keyboard shortcut: Escape closes popovers or stands up from seat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAvatarModalOpen || isAudioOpen || isNotebookOpen || isSocialOpen || isRoomMenuOpen) {
          setIsAvatarModalOpen(false);
          setIsAudioOpen(false);
          setIsNotebookOpen(false);
          setIsSocialOpen(false);
          setIsRoomMenuOpen(false);
        } else if (selectedSeatId) {
          handleStandUp();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isAvatarModalOpen,
    isAudioOpen,
    isNotebookOpen,
    isSocialOpen,
    isRoomMenuOpen,
    selectedSeatId,
  ]);

  // Switch Café Room Instance
  const handleSwitchRoom = (nextRoomId: CafeRoomId) => {
    const nextTheme = CAFE_THEMES[nextRoomId];
    setRoomId(nextRoomId);
    setSelectedSeatId(null);
    if (scene === 'seated') setScene('interior');
    setTimeOfDay(nextTheme.defaultTimeOfDay);
    multiplayerClient.switchRoom(nextRoomId);
    setIsRoomMenuOpen(false);
  };

  // Step Inside the Café from the Street
  const handleEnterCafe = () => {
    soundEngine.playDoorBell();

    if (audioPrefs.autoPlay && !audioPrefs.isPlaying && !audioPrefs.quietMode) {
      const nextAudio: AudioPreferences = {
        ...audioPrefs,
        isPlaying: true,
      };
      setAudioPrefs(nextAudio);
      soundEngine.initAndApply(nextAudio);
    }

    if (profile.skipAnimations || reducedMotion) {
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

  // Sit Down at One of the 12 Seats (Authoritative Seat Claiming)
  const handleSelectSeat = (seatId: SeatId) => {
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
    multiplayerClient.sendReaction(kind, targetUserId);
    setFocusPrefs((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === 'welcome-2' ? { ...t, completed: true } : t
      ),
    }));
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

  // Ensure our own avatar is always included in the rendered visitors list if not invisible
  const effectiveVisitors: VisitorPresence[] = React.useMemo(() => {
    const filtered = visitors.filter(
      (v) => !profile.blockedUserIds.includes(v.userId)
    );
    if (profile.invisible) {
      return filtered.filter((v) => v.userId !== profile.userId);
    }
    const hasSelf = filtered.some((v) => v.userId === profile.userId);
    if (hasSelf) {
      return filtered.map((v) =>
        v.userId === profile.userId
          ? {
              ...v,
              displayName: profile.displayName,
              avatar: profile.avatar,
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
        displayName: profile.displayName,
        avatar: profile.avatar,
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
              setIsSocialOpen(true);
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

        {/* Center: Live Multiplayer Presence, Wave & Avatar Customization Bar */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Avatar & Profile Trigger Pill */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsAvatarModalOpen(true);
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#1A130F]/90 hover:bg-[#281D17] backdrop-blur-md border border-[#D48C46]/30 text-xs text-[#F4ECE1] shadow-lg transition-all"
            title="Customize your SVG avatar & status"
          >
            <span
              className="w-3 h-3 rounded-full border border-white/40"
              style={{ backgroundColor: profile.avatar.clothingColor }}
            />
            <span className="font-semibold max-w-[105px] truncate">
              {profile.displayName}
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-[#F3B664] hidden sm:inline">
              {profile.activityStatus}
            </span>
          </button>

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
                { id: 'morning', label: 'Morning', icon: <Sunrise className="w-3.5 h-3.5" /> },
                { id: 'afternoon', label: 'Afternoon', icon: <Sun className="w-3.5 h-3.5" /> },
                { id: 'dusk', label: 'Evening', icon: <Sunset className="w-3.5 h-3.5" /> },
                { id: 'night', label: 'Night', icon: <Moon className="w-3.5 h-3.5" /> },
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
        onClose={() => setIsAudioOpen(false)}
        onChange={setAudioPrefs}
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
          if (!activeSeat) return;
          multiplayerClient.startSharedTimer(
            activeSeat.tableId,
            timerPhase,
            focusPrefs.focusMinutes * 60,
            focusPrefs.currentGoal || 'Collaborative Focus Session'
          );
        }}
        onJoinSharedTimer={() => {
          if (!activeSeat) return;
          multiplayerClient.joinSharedTimer(activeSeat.tableId);
        }}
        onStopSharedTimer={() => {
          if (!activeSeat) return;
          multiplayerClient.stopSharedTimer(activeSeat.tableId);
        }}
      />

      <AvatarProfileModal
        profile={profile}
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        onChangeProfile={setProfile}
      />

      <SocialLoungeDrawer
        isOpen={isSocialOpen}
        profile={profile}
        visitors={effectiveVisitors}
        messages={chatMessages}
        activeSeat={activeSeat}
        selectedVisitor={selectedVisitor}
        roomName={activeTheme.name}
        onClose={() => setIsSocialOpen(false)}
        onSendReaction={handleSendReaction}
        onSendChat={(tableId, text) => multiplayerClient.sendChat(tableId, text)}
        onSelectSeat={handleSelectSeat}
        onUpdateProfile={setProfile}
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

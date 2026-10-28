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
  ListTodo,
  Maximize2,
  Minimize2,
  Moon,
  Music,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Sun,
  Sunset,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { soundEngine } from './audio/soundEngine';
import { InteriorSceneSVG } from './components/svg/InteriorSceneSVG';
import { StreetSceneSVG } from './components/svg/StreetSceneSVG';
import { AudioMixerPopover } from './components/ui/AudioMixerPopover';
import { FocusOverlayPanel } from './components/ui/FocusOverlayPanel';
import {
  AudioPreferences,
  FocusPreferences,
  SceneMode,
  SeatId,
  TimeOfDay,
  TimerPhase,
} from './types';
import { SEAT_LIST, SEATS } from './utils/isometric';

const AUDIO_STORAGE_KEY = 'atelier_ambre_audio_v1';
const FOCUS_STORAGE_KEY = 'atelier_ambre_focus_v1';

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
  },
  ambientEnabled: {
    cafe: true,
    rain: false,
    fire: false,
  },
  sfxEnabled: true,
};

const DEFAULT_FOCUS_PREFS: FocusPreferences = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  currentGoal: 'Deep work & peaceful study session',
  completedSessions: 0,
  totalFocusMinutes: 0,
  tasks: [
    {
      id: 'welcome-1',
      text: "Choose your favorite seat in Eval Exec's Cafe",
      completed: false,
      createdAt: Date.now() - 120000,
    },
    {
      id: 'welcome-2',
      text: 'Blend warm lo-fi or jazz with café & rain ambience',
      completed: false,
      createdAt: Date.now() - 60000,
    },
    {
      id: 'welcome-3',
      text: 'Complete one focused 25-minute Pomodoro session',
      completed: false,
      createdAt: Date.now(),
    },
  ],
};

export function App() {
  // Scene & Seat State (supports optional URL parameters e.g. ?scene=interior&seat=window-1)
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
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Environment & Accessibility State
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(() => {
    if (typeof window !== 'undefined') {
      const tod = new URLSearchParams(window.location.search).get('tod');
      if (tod === 'afternoon' || tod === 'dusk' || tod === 'night') return tod;
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
          autoPlay,
          isPlaying: autoPlay ? true : Boolean(parsed.isPlaying),
        };
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_AUDIO_PREFS;
  });

  // Persisted Focus & Task Preferences
  const [focusPrefs, setFocusPrefs] = useState<FocusPreferences>(() => {
    try {
      const saved = localStorage.getItem(FOCUS_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_FOCUS_PREFS, ...JSON.parse(saved) };
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_FOCUS_PREFS;
  });

  // Pomodoro Timer Runtime State
  const [timerPhase, setTimerPhase] = useState<TimerPhase>('focus');
  const [secondsLeft, setSecondsLeft] = useState<number>(
    focusPrefs.focusMinutes * 60
  );
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [completionBanner, setCompletionBanner] = useState<string | null>(null);

  // Popover UI States
  const [isAudioOpen, setIsAudioOpen] = useState(false);
  const [isNotebookOpen, setIsNotebookOpen] = useState(false);

  // Sync Audio Preferences to LocalStorage & Web Audio Engine
  useEffect(() => {
    soundEngine.updatePreferences(audioPrefs);
    try {
      localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(audioPrefs));
    } catch {
      // ignore
    }
  }, [audioPrefs]);

  // Auto-play audio on mount and unlock Web Audio context on first user gesture if suspended by browser policy
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

  // Pomodoro Timer Countdown Tick
  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          soundEngine.playTimerComplete();
          if (timerPhase === 'focus') {
            setFocusPrefs((fp) => ({
              ...fp,
              completedSessions: fp.completedSessions + 1,
              totalFocusMinutes: fp.totalFocusMinutes + fp.focusMinutes,
            }));
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
  }, [isTimerRunning, timerPhase]);

  // Keyboard shortcut: Escape closes popovers or stands up from seat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAudioOpen || isNotebookOpen) {
          setIsAudioOpen(false);
          setIsNotebookOpen(false);
        } else if (selectedSeatId) {
          handleStandUp();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAudioOpen, isNotebookOpen, selectedSeatId]);

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

    setIsTransitioning(true);
    window.setTimeout(() => {
      setScene('interior');
      setIsTransitioning(false);
    }, 620);
  };

  // Return Outside to the Street View
  const handleReturnToStreet = () => {
    soundEngine.playDoorBell();
    setSelectedSeatId(null);
    setHoveredSeatId(null);
    setScene('street');
  };

  // Sit Down at One of the 6 Seats
  const handleSelectSeat = (seatId: SeatId) => {
    soundEngine.playSeatSelect();
    setSelectedSeatId(seatId);
    setHoveredSeatId(null);
    setScene('seated');

    if (
      audioPrefs.autoPlay &&
      !audioPrefs.isPlaying &&
      !audioPrefs.quietMode &&
      !audioPrefs.isMuted
    ) {
      const nextAudio: AudioPreferences = {
        ...audioPrefs,
        isPlaying: true,
      };
      setAudioPrefs(nextAudio);
      soundEngine.initAndApply(nextAudio);
    }

    // Auto-start focus session when sitting down if timer is at full duration
    if (!isTimerRunning && secondsLeft > 0) {
      setIsTimerRunning(true);
    }

    // Mark the first onboarding task complete if present
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
    setSelectedSeatId(null);
    setScene('interior');
  };

  // Switch Timer Phase or Duration
  const handleSelectPhaseDuration = (phase: TimerPhase, minutes: number) => {
    setIsTimerRunning(false);
    setTimerPhase(phase);
    setSecondsLeft(minutes * 60);
  };

  const handleResetTimer = () => {
    setIsTimerRunning(false);
    const mins =
      timerPhase === 'focus'
        ? focusPrefs.focusMinutes
        : timerPhase === 'shortBreak'
        ? focusPrefs.shortBreakMinutes
        : focusPrefs.longBreakMinutes;
    setSecondsLeft(mins * 60);
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
  const totalPhaseSeconds =
    (timerPhase === 'focus'
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

  const activeSeat = selectedSeatId ? SEATS[selectedSeatId] : null;
  const hoveredSeat = hoveredSeatId ? SEATS[hoveredSeatId] : null;
  const isRaining = audioPrefs.ambientEnabled.rain && !audioPrefs.quietMode;
  const isFireplaceActive = audioPrefs.ambientEnabled.fire && !audioPrefs.quietMode;

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-[#181210] select-none"
      onClick={() => {
        if (isAudioOpen) setIsAudioOpen(false);
        if (isNotebookOpen) setIsNotebookOpen(false);
      }}
    >
      {/* ================= 1. FULL-VIEWPORT ILLUSTRATED SVG WORLD ================= */}
      <main className="w-full h-full">
        {scene === 'street' ? (
          <StreetSceneSVG
            timeOfDay={timeOfDay}
            isRaining={isRaining}
            reducedMotion={reducedMotion}
            onEnterCafe={handleEnterCafe}
          />
        ) : (
          <InteriorSceneSVG
            selectedSeatId={selectedSeatId}
            hoveredSeatId={hoveredSeatId}
            timeOfDay={timeOfDay}
            isRaining={isRaining}
            isFireplaceActive={isFireplaceActive}
            isTimerRunning={isTimerRunning}
            currentGoal={focusPrefs.currentGoal}
            reducedMotion={reducedMotion}
            onSelectSeat={handleSelectSeat}
            onHoverSeat={setHoveredSeatId}
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

      {/* ================= 2. TOP FLOATING NAVIGATION & AMBIENCE BAR ================= */}
      <header className="fixed top-4 inset-x-4 sm:inset-x-6 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Café Emblem & Scene Navigation Breadcrumb */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-[#1A130F]/85 backdrop-blur-md border border-[#D48C46]/30 shadow-lg">
            <div className="w-7 h-7 rounded-xl bg-[#D48C46]/20 border border-[#D48C46]/45 flex items-center justify-center">
              <Coffee className="w-4 h-4 text-[#F3B664]" />
            </div>
            <div>
              <div className="font-serif text-sm font-semibold text-[#F9EFE3] leading-tight">
                Eval Exec’s Cafe
              </div>
              <div className="text-[11px] text-[#C8B6A6] flex items-center gap-1.5">
                {scene === 'street' && <span>Storefront • Welcome</span>}
                {scene === 'interior' && <span>Interior • Choose a Seat</span>}
                {scene === 'seated' && activeSeat && (
                  <span className="text-[#F3B664] font-medium">
                    Seated at {activeSeat.name}
                  </span>
                )}
              </div>
            </div>
          </div>

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
              <span>Stand Up / Change Seat</span>
            </button>
          ) : (
            <button
              onClick={handleReturnToStreet}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#1A130F]/85 hover:bg-[#281D17] text-[#C8B6A6] hover:text-[#F4ECE1] border border-white/10 text-xs shadow-lg transition-all"
            >
              <DoorOpen className="w-3.5 h-3.5 text-[#D48C46]" />
              <span className="hidden sm:inline">Step Outside to Street</span>
            </button>
          )}
        </div>

        {/* Center: Active Focus Intention Pill (When Seated) or Seat Prompt (When Exploring) */}
        <div className="hidden lg:flex items-center pointer-events-auto">
          {scene === 'seated' && activeSeat ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsNotebookOpen(true);
                setIsAudioOpen(false);
              }}
              className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#1A130F]/85 backdrop-blur-md border border-[#D48C46]/35 hover:border-[#F3B664] shadow-lg transition-all group"
            >
              <span className="w-2 h-2 rounded-full bg-[#68D391] animate-pulse" />
              <span className="text-xs text-[#C8B6A6]">Focusing on:</span>
              <span className="text-xs font-semibold text-[#F9EFE3] max-w-[260px] truncate">
                {focusPrefs.currentGoal || 'Peaceful study session'}
              </span>
              <span className="text-[10px] text-[#F3B664] opacity-70 group-hover:opacity-100">
                Edit
              </span>
            </button>
          ) : scene === 'interior' ? (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1A130F]/80 backdrop-blur-md border border-[#D48C46]/25 text-xs text-[#E5D6C5] shadow-md">
              <Armchair className="w-3.5 h-3.5 text-[#F3B664]" />
              <span>Click any of the 6 tables &amp; chairs below to sit down and open your laptop</span>
            </div>
          ) : null}
        </div>

        {/* Right: Lighting Atmosphere, Rain Quick-Toggle, Reduced Motion & Zen Mode */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Time of Day Lighting Selector */}
          <div className="flex items-center bg-[#1A130F]/85 backdrop-blur-md p-1 rounded-2xl border border-[#D48C46]/25 shadow-lg">
            {(
              [
                { id: 'afternoon', label: 'Afternoon', icon: <Sun className="w-3.5 h-3.5" /> },
                { id: 'dusk', label: 'Dusk', icon: <Sunset className="w-3.5 h-3.5" /> },
                { id: 'night', label: 'Night', icon: <Moon className="w-3.5 h-3.5" /> },
              ] as const
            ).map((tod) => (
              <button
                key={tod.id}
                onClick={() => setTimeOfDay(tod.id)}
                title={`${tod.label} lighting`}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
                  timeOfDay === tod.id
                    ? 'bg-[#D48C46]/25 text-[#FFE0B5] border border-[#F3B664]/40'
                    : 'text-[#C8B6A6] hover:text-[#F4ECE1]'
                }`}
              >
                {tod.icon}
                <span className="hidden md:inline">{tod.label}</span>
              </button>
            ))}
          </div>

          {/* Quick Rain Toggle */}
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
            title="Toggle Rain Against Windows"
            className={`p-2 rounded-2xl backdrop-blur-md border shadow-lg transition-all ${
              isRaining
                ? 'bg-[#253545]/90 border-[#8AB8E6] text-[#B8D8F8]'
                : 'bg-[#1A130F]/85 border-white/10 text-[#C8B6A6] hover:text-[#F4ECE1]'
            }`}
          >
            <CloudRain className="w-4 h-4" />
          </button>

          {/* Reduced Motion Accessibility Toggle */}
          <button
            onClick={() => setReducedMotion((prev) => !prev)}
            title={
              reducedMotion
                ? 'Reduced motion is ON (animations calmed)'
                : 'Toggle Reduced Motion accessibility mode'
            }
            className={`px-2.5 py-2 rounded-2xl backdrop-blur-md border text-[11px] font-medium shadow-lg transition-all hidden sm:flex items-center gap-1 ${
              reducedMotion
                ? 'bg-[#D48C46]/25 border-[#F3B664] text-[#FFE0B5]'
                : 'bg-[#1A130F]/85 border-white/10 text-[#C8B6A6] hover:text-[#F4ECE1]'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{reducedMotion ? 'Calm Motion' : 'Motion'}</span>
          </button>

          {/* Fullscreen Distraction-Free Zen Mode */}
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

      {/* ================= 3. HOVERED SEAT PREVIEW CARD & QUICK SEAT BAR ================= */}
      {/* Floating Seat Details Card when Hovering a Seat in Overview */}
      {scene === 'interior' && hoveredSeat && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-fade-in">
          <div className="px-4 py-2.5 rounded-2xl bg-[#1A130F]/95 backdrop-blur-xl border border-[#F3B664]/50 shadow-2xl max-w-md text-center">
            <div className="flex items-center justify-center gap-2 mb-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#D48C46]/25 text-[#FFE0B5]">
                {hoveredSeat.subtitle}
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

      {/* Compact Quick-Seat Selector Pill Bar (Available inside the Café so all 6 seats are also 1-click accessible on any screen size) */}
      {scene !== 'street' && (
        <div className="fixed bottom-20 inset-x-4 z-20 flex justify-center pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-[#1A130F]/85 backdrop-blur-md border border-[#D48C46]/25 shadow-xl overflow-x-auto no-scrollbar max-w-full">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#C8B6A6] px-1.5 shrink-0 hidden md:inline">
              Seats:
            </span>
            {SEAT_LIST.map((seat, idx) => {
              const isSelected = selectedSeatId === seat.id;
              return (
                <button
                  key={seat.id}
                  onClick={() =>
                    isSelected ? handleStandUp() : handleSelectSeat(seat.id)
                  }
                  onMouseEnter={() => !selectedSeatId && setHoveredSeatId(seat.id)}
                  onMouseLeave={() => setHoveredSeatId(null)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all shrink-0 flex items-center gap-1 whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#D48C46] text-[#1A120D] font-semibold shadow-sm'
                      : 'text-[#D6C5B5] hover:text-[#FFF3DF] hover:bg-white/5'
                  }`}
                >
                  <span className="font-mono text-[10px] opacity-70">{idx + 1}.</span>
                  <span>{seat.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Session Completion Toast Notification */}
      {completionBanner && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 px-5 py-3 rounded-2xl bg-[#1E1612]/95 border border-[#68D391] shadow-2xl flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-[#68D391] shrink-0" />
          <span className="text-xs sm:text-sm font-medium text-[#F9EFE3]">
            {completionBanner}
          </span>
        </div>
      )}

      {/* ================= 4. POPOVER PANELS (AUDIO MIXER & FOCUS NOTEBOOK) ================= */}
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
        onClose={() => setIsNotebookOpen(false)}
        onChangePrefs={setFocusPrefs}
        onSelectPhaseDuration={handleSelectPhaseDuration}
      />

      {/* ================= 5. BOTTOM FLOATING AMBIENT DOCK ================= */}
      <footer className="fixed bottom-4 inset-x-4 sm:inset-x-6 z-20 flex items-center justify-between gap-2 pointer-events-none">
        {/* Left Dock: Soundscape & Ambience Controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Play / Pause Instant Button */}
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
            title={audioPrefs.isPlaying ? 'Pause café audio' : 'Play café audio'}
          >
            {audioPrefs.isPlaying && !audioPrefs.quietMode && !audioPrefs.isMuted ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
          </button>

          {/* Open Soundscape Mixer Pill */}
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
                {/* Active Ambient Badges */}
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

          {/* Quick Mute Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAudioPrefs((prev) => ({ ...prev, isMuted: !prev.isMuted }));
            }}
            className="p-2.5 rounded-2xl bg-[#1A130F]/90 backdrop-blur-md border border-white/10 text-[#C8B6A6] hover:text-[#F4ECE1] shadow-xl transition-all hidden sm:flex"
            title={audioPrefs.isMuted ? 'Unmute' : 'Mute'}
            aria-label="Toggle Mute"
          >
            {audioPrefs.isMuted || audioPrefs.quietMode ? (
              <VolumeX className="w-4 h-4 text-[#E06D53]" />
            ) : (
              <Volume2 className="w-4 h-4 text-[#F3B664]" />
            )}
          </button>
        </div>

        {/* Center Dock: Pomodoro Focus Timer */}
        <div
          className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl bg-[#1A130F]/90 backdrop-blur-md border border-[#D48C46]/35 shadow-xl pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Circular Progress Ring + Phase Dot */}
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

          {/* Tabular Countdown Display */}
          <button
            onClick={() => {
              setIsNotebookOpen((prev) => !prev);
              setIsAudioOpen(false);
            }}
            className="text-left group"
            title="Click to customize focus timer & tasks"
          >
            <div className="font-mono text-base sm:text-lg font-semibold text-[#F9EFE3] tracking-wider leading-none">
              {displayMins}:{displaySecs}
            </div>
            <div className="text-[10px] text-[#C8B6A6] group-hover:text-[#F3B664] transition-colors">
              {timerPhase === 'focus'
                ? 'Focus Session'
                : timerPhase === 'shortBreak'
                ? 'Short Break'
                : 'Coffee Break'}
            </div>
          </button>

          {/* Timer Start / Pause */}
          <button
            onClick={() => setIsTimerRunning((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isTimerRunning
                ? 'bg-[#362820] text-[#F3B664] border border-[#F3B664]/40'
                : 'bg-[#D48C46] text-[#1A120D] hover:bg-[#E29A52]'
            }`}
          >
            {isTimerRunning ? 'Pause' : 'Start'}
          </button>

          {/* Timer Reset */}
          <button
            onClick={handleResetTimer}
            className="p-1.5 rounded-xl text-[#C8B6A6] hover:text-[#F4ECE1] hover:bg-white/5 transition-colors"
            title="Reset Timer"
            aria-label="Reset Timer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Dock: Study Notebook & Task List Trigger */}
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
                {focusPrefs.currentGoal || 'Tasks & Pomodoro Goals'}
              </div>
            </div>
          </button>
        </div>
      </footer>
    </div>
  );
}
export default App;

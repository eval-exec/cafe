import React from 'react';
import {
  CloudRain,
  Coffee,
  Flame,
  Music,
  Pause,
  Play,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AmbientLayerId, AudioPreferences, MusicStyle } from '../../types';

interface AudioMixerPopoverProps {
  prefs: AudioPreferences;
  isOpen: boolean;
  onClose: () => void;
  onChange: (next: AudioPreferences) => void;
}

const MUSIC_STYLES: Array<{ id: MusicStyle; label: string; desc: string }> = [
  { id: 'lofi', label: 'Lo-Fi Study', desc: 'Warm Rhodes & dusty vinyl beats' },
  { id: 'jazz', label: 'Soft Jazz', desc: 'Tines, upright bass & brushes' },
  { id: 'piano', label: 'Gentle Piano', desc: 'Peaceful felt piano arpeggios' },
  { id: 'none', label: 'Ambience Only', desc: 'Pure environmental sounds' },
];

const AMBIENT_LAYERS: Array<{
  id: AmbientLayerId;
  label: string;
  sub: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'cafe',
    label: 'Cozy Café Ambience',
    sub: 'Warm room murmur & porcelain clinks',
    icon: <Coffee className="w-4 h-4 text-[#F3B664]" />,
  },
  {
    id: 'rain',
    label: 'Rain Against Windows',
    sub: 'Soft patter on the café windowpanes',
    icon: <CloudRain className="w-4 h-4 text-[#8AB8E6]" />,
  },
  {
    id: 'fire',
    label: 'Fireplace Ambience',
    sub: 'Crackling hearth embers & warmth',
    icon: <Flame className="w-4 h-4 text-[#E87A48]" />,
  },
];

export const AudioMixerPopover: React.FC<AudioMixerPopoverProps> = ({
  prefs,
  isOpen,
  onClose,
  onChange,
}) => {
  if (!isOpen) return null;

  const togglePlay = () => {
    onChange({
      ...prefs,
      isPlaying: !prefs.isPlaying,
      quietMode: false,
      isMuted: false,
    });
  };

  const applyPreset = (
    preset: 'cafe' | 'jazz' | 'lofi' | 'piano' | 'rain' | 'fire' | 'quiet'
  ) => {
    if (preset === 'quiet') {
      onChange({
        ...prefs,
        quietMode: true,
        isPlaying: false,
      });
      return;
    }

    const next: AudioPreferences = {
      ...prefs,
      isPlaying: true,
      isMuted: false,
      quietMode: false,
    };

    if (preset === 'cafe') {
      next.musicStyle = 'none';
      next.ambientEnabled = { cafe: true, rain: false, fire: false };
      next.ambientVolumes = { ...next.ambientVolumes, cafe: 0.65 };
    } else if (preset === 'jazz') {
      next.musicStyle = 'jazz';
      next.musicVolume = 0.6;
      next.ambientEnabled = { cafe: true, rain: false, fire: false };
    } else if (preset === 'lofi') {
      next.musicStyle = 'lofi';
      next.musicVolume = 0.6;
      next.ambientEnabled = { cafe: true, rain: true, fire: false };
    } else if (preset === 'piano') {
      next.musicStyle = 'piano';
      next.musicVolume = 0.62;
      next.ambientEnabled = { cafe: false, rain: true, fire: true };
    } else if (preset === 'rain') {
      next.ambientEnabled = { ...next.ambientEnabled, rain: true };
      next.ambientVolumes = { ...next.ambientVolumes, rain: 0.65 };
    } else if (preset === 'fire') {
      next.ambientEnabled = { ...next.ambientEnabled, fire: true };
      next.ambientVolumes = { ...next.ambientVolumes, fire: 0.65 };
    }

    onChange(next);
  };

  return (
    <div
      className="fixed bottom-20 left-4 sm:left-6 z-40 w-[340px] sm:w-[380px] rounded-2xl bg-[#1A130F]/95 backdrop-blur-xl border border-[#D48C46]/30 shadow-2xl p-4 text-[#F4ECE1] animate-fade-in"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#D48C46]/20">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#D48C46]/20 border border-[#D48C46]/40 flex items-center justify-center">
            <Music className="w-3.5 h-3.5 text-[#F3B664]" />
          </div>
          <div>
            <h3 className="font-serif text-sm font-semibold tracking-wide text-[#F9EFE3]">
              Café Soundscape Mixer
            </h3>
            <p className="text-[11px] text-[#C8B6A6]">
              Blend background music with room ambience
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#C8B6A6] hover:text-[#F4ECE1] hover:bg-white/5 transition-colors"
          aria-label="Close sound mixer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Master Playback & Volume Row */}
      <div className="flex items-center gap-3 mb-4 bg-[#251B16] p-2.5 rounded-xl border border-[#D48C46]/15">
        <button
          onClick={togglePlay}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            prefs.isPlaying && !prefs.quietMode
              ? 'bg-[#D48C46] text-[#18110D] shadow-sm'
              : 'bg-[#362820] text-[#F4ECE1] hover:bg-[#453329]'
          }`}
        >
          {prefs.isPlaying && !prefs.quietMode ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Playing</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Play Audio</span>
            </>
          )}
        </button>

        <button
          onClick={() => onChange({ ...prefs, isMuted: !prefs.isMuted })}
          className="p-1.5 rounded-lg text-[#C8B6A6] hover:text-[#F4ECE1] hover:bg-white/5 transition-colors"
          title={prefs.isMuted ? 'Unmute' : 'Mute all'}
        >
          {prefs.isMuted || prefs.quietMode ? (
            <VolumeX className="w-4 h-4 text-[#E06D53]" />
          ) : (
            <Volume2 className="w-4 h-4 text-[#F3B664]" />
          )}
        </button>

        <div className="flex-1 flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={prefs.quietMode || prefs.isMuted ? 0 : prefs.masterVolume}
            onChange={(e) =>
              onChange({
                ...prefs,
                masterVolume: parseFloat(e.target.value),
                isMuted: false,
                quietMode: false,
              })
            }
            className="w-full accent-[#F3B664] h-1.5 bg-[#382A22] rounded-lg cursor-pointer"
            aria-label="Master volume"
          />
          <span className="font-mono text-[11px] text-[#C8B6A6] w-8 text-right">
            {Math.round((prefs.quietMode || prefs.isMuted ? 0 : prefs.masterVolume) * 100)}%
          </span>
        </div>
      </div>

      {/* 1-Click Soundscape Presets (All 7 Requested Modes) */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#C8B6A6] flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#F3B664]" /> Instant Soundscapes
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'lofi', label: 'Lo-Fi Study' },
            { id: 'jazz', label: 'Soft Jazz' },
            { id: 'piano', label: 'Gentle Piano' },
            { id: 'cafe', label: 'Cozy Café' },
            { id: 'rain', label: 'Rainy Window' },
            { id: 'fire', label: 'Fireplace' },
            { id: 'quiet', label: 'Quiet Mode' },
          ].map((p) => {
            const isActive =
              (p.id === 'quiet' && prefs.quietMode) ||
              (!prefs.quietMode &&
                prefs.isPlaying &&
                ((p.id === 'lofi' && prefs.musicStyle === 'lofi') ||
                  (p.id === 'jazz' && prefs.musicStyle === 'jazz') ||
                  (p.id === 'piano' && prefs.musicStyle === 'piano') ||
                  (p.id === 'cafe' && prefs.musicStyle === 'none' && prefs.ambientEnabled.cafe)));
            return (
              <button
                key={p.id}
                onClick={() =>
                  applyPreset(
                    p.id as 'cafe' | 'jazz' | 'lofi' | 'piano' | 'rain' | 'fire' | 'quiet'
                  )
                }
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                  isActive
                    ? 'bg-[#D48C46]/25 border-[#F3B664] text-[#FFE4B5]'
                    : 'bg-[#241A15] border-white/10 text-[#C8B6A6] hover:text-[#F4ECE1] hover:border-[#D48C46]/40'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Background Music Style Selection */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#C8B6A6]">
            Background Music
          </span>
          <div className="flex items-center gap-2 w-28">
            <span className="text-[10px] text-[#C8B6A6]">Vol</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={prefs.musicVolume}
              onChange={(e) =>
                onChange({ ...prefs, musicVolume: parseFloat(e.target.value) })
              }
              className="w-full accent-[#F3B664] h-1 bg-[#382A22] rounded-lg cursor-pointer"
              aria-label="Music volume"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {MUSIC_STYLES.map((style) => {
            const active = !prefs.quietMode && prefs.musicStyle === style.id;
            return (
              <button
                key={style.id}
                onClick={() =>
                  onChange({
                    ...prefs,
                    musicStyle: style.id,
                    isPlaying: true,
                    quietMode: false,
                  })
                }
                className={`text-left p-2 rounded-xl border transition-all ${
                  active
                    ? 'bg-[#D48C46]/20 border-[#F3B664] text-[#F9EFE3]'
                    : 'bg-[#231914]/90 border-white/5 text-[#C8B6A6] hover:border-[#D48C46]/30'
                }`}
              >
                <div className="text-xs font-semibold">{style.label}</div>
                <div className="text-[10px] text-[#A89686] truncate">{style.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mixable Ambient Layers */}
      <div className="space-y-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#C8B6A6] block">
          Mix Ambient Layers
        </span>
        {AMBIENT_LAYERS.map((layer) => {
          const enabled = prefs.ambientEnabled[layer.id];
          const volume = prefs.ambientVolumes[layer.id];
          return (
            <div
              key={layer.id}
              className={`p-2.5 rounded-xl border transition-all ${
                enabled && !prefs.quietMode
                  ? 'bg-[#281D17] border-[#D48C46]/40'
                  : 'bg-[#201712]/60 border-white/5 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <button
                  onClick={() =>
                    onChange({
                      ...prefs,
                      isPlaying: true,
                      quietMode: false,
                      ambientEnabled: {
                        ...prefs.ambientEnabled,
                        [layer.id]: !enabled,
                      },
                    })
                  }
                  className="flex items-center gap-2 text-left flex-1"
                >
                  {layer.icon}
                  <div>
                    <div className="text-xs font-medium text-[#F4ECE1]">{layer.label}</div>
                    <div className="text-[10px] text-[#A89686]">{layer.sub}</div>
                  </div>
                </button>
                <button
                  onClick={() =>
                    onChange({
                      ...prefs,
                      isPlaying: true,
                      quietMode: false,
                      ambientEnabled: {
                        ...prefs.ambientEnabled,
                        [layer.id]: !enabled,
                      },
                    })
                  }
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                    enabled && !prefs.quietMode
                      ? 'bg-[#68D391]/20 text-[#68D391] border border-[#68D391]/40'
                      : 'bg-white/5 text-[#A89686]'
                  }`}
                >
                  {enabled && !prefs.quietMode ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="flex items-center gap-2 pl-6">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={enabled ? volume : 0}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    onChange({
                      ...prefs,
                      isPlaying: true,
                      quietMode: false,
                      ambientEnabled: {
                        ...prefs.ambientEnabled,
                        [layer.id]: val > 0.02,
                      },
                      ambientVolumes: {
                        ...prefs.ambientVolumes,
                        [layer.id]: val,
                      },
                    });
                  }}
                  className="w-full accent-[#F3B664] h-1 bg-[#382A22] rounded-lg cursor-pointer"
                  aria-label={`${layer.label} volume`}
                />
                <span className="font-mono text-[10px] text-[#C8B6A6] w-7 text-right">
                  {Math.round((enabled ? volume : 0) * 100)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

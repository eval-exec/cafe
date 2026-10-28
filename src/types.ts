export type SceneMode = 'street' | 'interior' | 'seated';

export type TimeOfDay = 'afternoon' | 'dusk' | 'night';

export type SeatId =
  | 'window-1'
  | 'window-2'
  | 'quiet-corner'
  | 'central-table'
  | 'bookshelf-seat'
  | 'counter-seat';

export interface SeatConfig {
  id: SeatId;
  name: string;
  subtitle: string;
  description: string;
  vibeTag: string;
  lightingTag: string;
  // Isometric world coordinates (in grid units 0..12)
  isoX: number;
  isoY: number;
  isoZ: number;
  // Target SVG viewBox [x, y, width, height] when seated here
  cameraViewBox: [number, number, number, number];
  // Screen-space SVG coordinates (in 1600x1000 interior canvas) for table top center where laptop/coffee sit
  tableScreenX: number;
  tableScreenY: number;
  // Chair offset direction when pulling out
  chairPullDx: number;
  chairPullDy: number;
  // Laptop orientation ('se' | 'sw' | 'nw')
  laptopFacing: 'se' | 'sw';
}

export type MusicStyle = 'none' | 'lofi' | 'jazz' | 'piano';

export type AmbientLayerId = 'cafe' | 'rain' | 'fire';

export interface AudioPreferences {
  isPlaying: boolean;
  isMuted: boolean;
  quietMode: boolean;
  masterVolume: number;
  musicStyle: MusicStyle;
  musicVolume: number;
  ambientVolumes: Record<AmbientLayerId, number>;
   ambientEnabled: Record<AmbientLayerId, boolean>;
  sfxEnabled: boolean;
}

export interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export type TimerPhase = 'focus' | 'shortBreak' | 'longBreak';

export interface FocusPreferences {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  currentGoal: string;
  completedSessions: number;
  totalFocusMinutes: number;
  tasks: TaskItem[];
}

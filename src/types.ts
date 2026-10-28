export type SceneMode = 'street' | 'interior' | 'seated';

export type TimeOfDay = 'morning' | 'afternoon' | 'dusk' | 'night';

export type CafeRoomId =
  | 'eval-exec-flagship'
  | 'tokyo-rainy'
  | 'midnight-coding'
  | 'library-atrium';

export interface CafeThemeConfig {
  id: CafeRoomId;
  name: string;
  subtitle: string;
  tagline: string;
  wallPrimary: string;
  wallSecondary: string;
  wainscotColor: string;
  floorPrimary: string;
  floorSecondary: string;
  rugPrimary: string;
  defaultTimeOfDay: TimeOfDay;
  defaultMusic: MusicStyle;
  defaultRain: boolean;
}

export type SeatZone = 'quiet' | 'shared' | 'lounge';

export type SeatId =
  | 'window-1'
  | 'window-2'
  | 'quiet-corner'
  | 'bookshelf-seat'
  | 'central-1'
  | 'central-2'
  | 'central-3'
  | 'central-4'
  | 'counter-1'
  | 'counter-2'
  | 'lounge-1'
  | 'lounge-2';

export interface SeatConfig {
  id: SeatId;
  tableId: string;
  zone: SeatZone;
  zoneLabel: string;
  name: string;
  subtitle: string;
  description: string;
  vibeTag: string;
  lightingTag: string;
  allowsTableChat: boolean;
  allowsSharedTimer: boolean;
  // Isometric world coordinates (in grid units 0..10)
  isoX: number;
  isoY: number;
  isoZ: number;
  // Target SVG viewBox [x, y, width, height] when seated here
  cameraViewBox: [number, number, number, number];
  // Screen-space SVG coordinates for workspace items (laptop/coffee)
  tableScreenX: number;
  tableScreenY: number;
  // Screen-space SVG coordinates for the seated avatar
  avatarScreenX: number;
  avatarScreenY: number;
  // Chair offset direction when pulling out
  chairPullDx: number;
  chairPullDy: number;
  // Laptop orientation
  laptopFacing: 'se' | 'sw';
}

export type HairStyle = 'short' | 'bun' | 'bob' | 'curly' | 'beanie';
export type AvatarAccessory = 'none' | 'glasses' | 'headphones' | 'scarf';

export interface AvatarConfig {
  skinTone: string;
  hairStyle: HairStyle;
  hairColor: string;
  clothingColor: string;
  accessory: AvatarAccessory;
}

export type ActivityStatus =
  | 'focusing'
  | 'coding'
  | 'studying'
  | 'reading'
  | 'break'
  | 'chatting'
  | 'dnd';

export type SocialProvider = 'github' | 'x';

export interface SocialIdentity {
  id: string;
  userId: string;
  provider: SocialProvider;
  providerUserId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  profileUrl: string;
  isPublic?: boolean;
}

export interface CafeUser {
  id: string;
  displayName: string;
  preferredIdentityId: string;
  preferredAvatarIdentityId?: string | null;
  activity: ActivityStatus;
  isOnline: boolean;
  avatar?: AvatarConfig;
  friends?: string[];
}

export type ReactionKind = 'wave' | 'hello' | 'coffee' | 'thumbsup' | 'celebrate';

export interface VisitorPresence {
  userId: string;
  isAuthenticated?: boolean;
  displayName: string;
  avatar: AvatarConfig;
  avatarUrl?: string | null;
  primaryIdentity?: SocialIdentity | null;
  linkedIdentities?: SocialIdentity[];
  seatId: SeatId | null;
  activityStatus: ActivityStatus;
  focusGoal?: string | null;
  shareFocusGoal: boolean;
  focusStartedAtMs?: number | null;
  invisible: boolean;
  lastHeartbeatMs: number;
}

export interface SharedTimerState {
  tableId: string;
  phase: TimerPhase;
  durationSec: number;
  startedAtMs: number;
  isRunning: boolean;
  sharedGoal: string;
  participants: string[];
  hostUserId: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  tableId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  senderProvider?: SocialProvider | null;
  text: string;
  timestampMs: number;
}

export interface ReactionEvent {
  id: string;
  senderId: string;
  senderName: string;
  targetUserId?: string | null;
  kind: ReactionKind;
  timestampMs: number;
}

export interface RoomSnapshot {
  roomId: string;
  version: number;
  serverTimeMs: number;
  visitors: VisitorPresence[];
  seatOccupancy: Record<string, string>;
  sharedTimers: Record<string, SharedTimerState>;
  recentMessages: ChatMessage[];
}

export type MusicStyle = 'none' | 'lofi' | 'jazz' | 'piano';

export type AmbientLayerId = 'cafe' | 'rain' | 'fire' | 'keyboard';

export interface AudioPreferences {
  isPlaying: boolean;
  autoPlay: boolean;
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

export interface FocusSessionRecord {
  id: string;
  completedAt: number;
  durationMinutes: number;
  goal: string;
  roomName: string;
  seatName: string;
}

export interface FocusPreferences {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  currentGoal: string;
  shareFocusGoal: boolean;
  completedSessions: number;
  totalFocusMinutes: number;
  tasks: TaskItem[];
  history: FocusSessionRecord[];
}

export interface FriendEntry {
  userId: string;
  displayName: string;
  avatar: AvatarConfig;
  avatarUrl?: string | null;
  provider?: SocialProvider | null;
  username?: string | null;
  profileUrl?: string | null;
  addedAt: number;
}

export interface UserProfile {
  userId: string;
  authToken: string;
  csrfToken?: string;
  sessionId?: string;
  isAuthenticated: boolean;
  displayName: string;
  preferredIdentityId: string;
  preferredAvatarIdentityId: string | null;
  identities: SocialIdentity[];
  avatar: AvatarConfig;
  activityStatus: ActivityStatus;
  invisible: boolean;
  skipAnimations: boolean;
  favoriteSeats: SeatId[];
  friends: FriendEntry[];
  mutedUserIds: string[];
  blockedUserIds: string[];
}

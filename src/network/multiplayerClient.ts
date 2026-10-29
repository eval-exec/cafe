import { request as octokitRequest } from '@octokit/request';
import {
  ActivityStatus,
  AvatarConfig,
  CafeRoomId,
  CafeUser,
  ChatMessage,
  ReactionEvent,
  ReactionKind,
  RoomSnapshot,
  SeatId,
  SharedTimerState,
  SocialIdentity,
  SocialProvider,
  TimerPhase,
  VisitorPresence,
} from '../types';

export type ConnectionStatus = 'connected-server' | 'connected-local-mesh' | 'reconnecting';

export interface ClientIdentity {
  userId: string;
  authToken: string;
  isAuthenticated: boolean;
  displayName: string;
  avatar: AvatarConfig;
  avatarUrl: string | null;
  primaryIdentity: SocialIdentity | null;
  linkedIdentities: SocialIdentity[];
  activityStatus: ActivityStatus;
  focusGoal: string | null;
  shareFocusGoal: boolean;
  focusStartedAtMs: number | null;
  invisible: boolean;
}

export interface VisitorLeftEvent {
  userId: string;
  seatId: string | null;
}

type SnapshotListener = (snapshot: RoomSnapshot) => void;
type ReactionListener = (reaction: ReactionEvent) => void;
type ChatListener = (message: ChatMessage) => void;
type VisitorLeftListener = (evt: VisitorLeftEvent) => void;
type StatusListener = (status: ConnectionStatus) => void;
type ErrorListener = (reason: string) => void;

const ALLOWED_AVATAR_HOSTS = [
  'avatars.githubusercontent.com',
  'github.com',
];

export function validateSafeAvatarUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 512) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    const host = parsed.hostname.toLowerCase();
    const isAllowed = ALLOWED_AVATAR_HOSTS.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`)
    );
    return isAllowed ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function buildSafeProfileUrl(_provider: SocialProvider, username: string): string {
  const clean = username.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 39) || 'user';
  return `https://github.com/${clean}`;
}

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return 'https://cafe.eval-exec.com';
  const host = window.location.hostname;
  if (host === '127.0.0.1' || host === 'localhost') {
    return 'http://127.0.0.1:3001';
  }
  if (host.endsWith('github.io')) {
    return 'https://cafe.eval-exec.com';
  }
  return window.location.origin;
}

export interface AuthSessionResponse {
  authenticated: boolean;
  user?: CafeUser;
  identities?: SocialIdentity[];
  csrfToken?: string;
  wsToken?: string;
  sessionId?: string;
}

export async function fetchAuthSession(sessionId?: string): Promise<AuthSessionResponse | null> {
  try {
    const headers: Record<string, string> = {};
    if (sessionId) {
      headers['Authorization'] = `Bearer ${sessionId}`;
    }
    const url = sessionId
      ? `${getApiBaseUrl()}/api/auth/me?session_id=${encodeURIComponent(sessionId)}`
      : `${getApiBaseUrl()}/api/auth/me`;
    const res = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    if (!res.ok) return null;
    return (await res.json()) as AuthSessionResponse;
  } catch {
    return null;
  }
}

export function buildServerOAuthStartUrl(params: {
  provider: SocialProvider;
  mode: 'login' | 'link';
  returnTo: string;
  sessionId?: string;
  csrfToken?: string;
  loginHint?: string;
}): string {
  const u = new URL(`${getApiBaseUrl()}/api/auth/oauth/${params.provider}/start`);
  u.searchParams.set('mode', params.mode);
  u.searchParams.set('return_to', params.returnTo);
  if (params.sessionId) u.searchParams.set('session_id', params.sessionId);
  if (params.csrfToken) u.searchParams.set('csrf_token', params.csrfToken);
  if (params.loginHint) u.searchParams.set('login_hint', params.loginHint);
  return u.toString();
}

/**
 * Resolves a GitHub user's profile picture (`avatarUrl`) and email (`email`)
 * via Cloudflare Worker `/api/auth/github/login` and Octokit (`GET /users/{username}` + public events).
 */
export async function resolvePublicSocialProfile(
  provider: SocialProvider,
  rawUsername: string,
  customDisplayName?: string
): Promise<{
  provider: SocialProvider;
  providerUserId: string;
  username: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  profileUrl: string;
  pkceChallenge: string;
  serverSession?: AuthSessionResponse;
}> {
  const username = rawUsername.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 39);
  if (!username) {
    throw new Error('Please enter a valid GitHub username.');
  }

  // Generate Web Crypto PKCE S256 verifier & challenge
  const verifierBytes = new Uint8Array(32);
  window.crypto.getRandomValues(verifierBytes);
  const verifier = Array.from(verifierBytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const digest = await window.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  );
  const pkceChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  let providerUserId = `${provider}_${username.toLowerCase()}`;
  let displayName = (customDisplayName || '').trim() || username;
  let email: string | null = null;
  let avatarUrl: string | null = `https://github.com/${username}.png?size=160`;

  try {
    const resp = await octokitRequest('GET /users/{username}', {
      username,
    });
    const data = resp.data;
    if (data.id) providerUserId = String(data.id);
    if (!customDisplayName?.trim() && typeof data.name === 'string' && data.name.trim()) {
      displayName = data.name.trim();
    }
    if (typeof data.avatar_url === 'string') {
      avatarUrl = validateSafeAvatarUrl(data.avatar_url);
    }
    if (typeof data.email === 'string' && data.email.trim()) {
      email = data.email.trim();
    }

    if (!email) {
      const searchResp = await fetch(
        `https://api.github.com/search/commits?q=author:${encodeURIComponent(username)}&sort=author-date&order=desc&per_page=1`,
        { headers: { Accept: 'application/vnd.github+json' } }
      );
      if (searchResp.ok) {
        const searchJson = (await searchResp.json()) as Record<string, any>;
        const firstItem = searchJson?.items?.[0];
        const authorEmail =
          firstItem?.commit?.author?.email || firstItem?.commit?.committer?.email;
        if (
          typeof authorEmail === 'string' &&
          authorEmail.includes('@') &&
          !authorEmail.endsWith('noreply.github.com')
        ) {
          email = authorEmail.trim();
        }
      }
    }
  } catch {
    // Fallback to server resolution or github.com/{username}.png avatar URL
  }

  // Register session with Cloudflare Worker / API endpoint with resolved profile picture & email
  try {
    const apiRes = await fetch(`${getApiBaseUrl()}/api/auth/github/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        username,
        displayName,
        email: email || undefined,
        avatarUrl: avatarUrl || undefined,
        providerUserId,
      }),
    });
    if (apiRes.ok) {
      const sess = (await apiRes.json()) as AuthSessionResponse;
      const ident = sess.identities?.[0];
      if (sess.authenticated && sess.user && ident) {
        return {
          provider: 'github',
          providerUserId: ident.providerUserId,
          username: ident.username,
          displayName: sess.user.displayName,
          email: ident.email || email || null,
          avatarUrl: validateSafeAvatarUrl(ident.avatarUrl || avatarUrl),
          profileUrl: ident.profileUrl,
          pkceChallenge,
          serverSession: sess,
        };
      }
    }
  } catch {
    // Offline / static mesh fallback
  }

  return {
    provider,
    providerUserId,
    username,
    displayName,
    email,
    avatarUrl: validateSafeAvatarUrl(avatarUrl),
    profileUrl: buildSafeProfileUrl(provider, username),
    pkceChallenge,
  };
}

export class CafeMultiplayerClient {
  private ws: WebSocket | null = null;
  private channel: BroadcastChannel | null = null;
  private roomId: CafeRoomId = 'eval-exec-flagship';
  private identity: ClientIdentity | null = null;
  private currentSeatId: SeatId | null = null;
  private status: ConnectionStatus = 'reconnecting';

  private heartbeatTimer: number | null = null;
  private reconnectTimer: number | null = null;

  // Local mesh state (used when WebSocket server is unreachable, e.g. on static GitHub Pages)
  private meshPeers: Map<string, VisitorPresence> = new Map();
  private meshSeatOccupancy: Record<string, string> = {};
  private meshSharedTimers: Record<string, SharedTimerState> = {};
  private meshMessages: ChatMessage[] = [];
  private meshVersion = 1;

  private snapshotListeners = new Set<SnapshotListener>();
  private reactionListeners = new Set<ReactionListener>();
  private chatListeners = new Set<ChatListener>();
  private visitorLeftListeners = new Set<VisitorLeftListener>();
  private statusListeners = new Set<StatusListener>();
  private errorListeners = new Set<ErrorListener>();

  public connect(
    roomId: CafeRoomId,
    identity: ClientIdentity,
    initialSeat: SeatId | null = null
  ): void {
    this.roomId = roomId;
    this.identity = { ...identity };
    this.currentSeatId = identity.isAuthenticated ? initialSeat : null;

    this.setupBroadcastMesh();
    this.connectWebSocket();

    if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = window.setInterval(() => {
      this.sendHeartbeat();
    }, 8000);
  }

  private getWsUrl(): string {
    if (typeof window === 'undefined') return 'wss://cafe.eval-exec.com/ws';
    const host = window.location.hostname;
    if (host === '127.0.0.1' || host === 'localhost') {
      return `ws://127.0.0.1:3001/ws`;
    }
    if (host.endsWith('github.io')) {
      return `wss://cafe.eval-exec.com/ws`;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }

  private connectWebSocket(): void {
    if (typeof window === 'undefined') return;

    try {
      if (this.ws) {
        this.ws.onclose = null;
        this.ws.close();
      }

      const ws = new WebSocket(this.getWsUrl());
      this.ws = ws;

      ws.onopen = () => {
        this.setStatus('connected-server');
        this.sendJoinCommand();
        if (this.currentSeatId && this.identity?.isAuthenticated) {
          this.claimSeat(this.currentSeatId);
        }
      };

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          this.handleServerEvent(data);
        } catch {
          // ignore malformed frames
        }
      };

      ws.onerror = () => {
        if (this.status !== 'connected-server') {
          this.setStatus('connected-local-mesh');
          this.announceOnMesh();
        }
      };

      ws.onclose = () => {
        this.setStatus('connected-local-mesh');
        this.announceOnMesh();
        if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = window.setTimeout(() => {
          this.connectWebSocket();
        }, 5000);
      };
    } catch {
      this.setStatus('connected-local-mesh');
      this.announceOnMesh();
    }
  }

  private setupBroadcastMesh(): void {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    if (this.channel) {
      this.channel.close();
    }
    const bc = new BroadcastChannel(`eval_exec_cafe_room_${this.roomId}`);
    this.channel = bc;

    bc.onmessage = (evt) => {
      const msg = evt.data;
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'peer-presence') {
        const peer = msg.presence as VisitorPresence;
        if (peer.invisible || !peer.isAuthenticated) {
          this.meshPeers.delete(peer.userId);
        } else {
          this.meshPeers.set(peer.userId, peer);
        }
        this.rebuildMeshOccupancy();
        if (this.status === 'connected-local-mesh') {
          this.emitMeshSnapshot();
        }
        if (msg.requestReply && this.identity && this.identity.isAuthenticated) {
          this.announceOnMesh(false);
        }
      } else if (msg.type === 'peer-leave') {
        const oldPeer = this.meshPeers.get(msg.userId);
        this.meshPeers.delete(msg.userId);
        this.rebuildMeshOccupancy();
        if (this.status === 'connected-local-mesh') {
          this.visitorLeftListeners.forEach((cb) =>
            cb({ userId: msg.userId, seatId: oldPeer?.seatId || null })
          );
          this.emitMeshSnapshot();
        }
      } else if (msg.type === 'peer-reaction') {
        if (this.status === 'connected-local-mesh') {
          this.reactionListeners.forEach((cb) => cb(msg.reaction));
        }
      } else if (msg.type === 'peer-chat') {
        if (this.status === 'connected-local-mesh') {
          this.meshMessages.push(msg.message);
          this.chatListeners.forEach((cb) => cb(msg.message));
          this.emitMeshSnapshot();
        }
      } else if (msg.type === 'peer-timer') {
        if (this.status === 'connected-local-mesh') {
          if (msg.timer) {
            this.meshSharedTimers[msg.tableId] = msg.timer;
          } else {
            delete this.meshSharedTimers[msg.tableId];
          }
          this.emitMeshSnapshot();
        }
      }
    };

    window.addEventListener('beforeunload', () => {
      if (this.identity && this.channel) {
        this.channel.postMessage({ type: 'peer-leave', userId: this.identity.userId });
      }
    });
  }

  private announceOnMesh(requestReply = true): void {
    if (!this.identity) return;
    if (!this.identity.isAuthenticated || this.identity.invisible) {
      const existed = this.meshPeers.has(this.identity.userId);
      this.meshPeers.delete(this.identity.userId);
      this.rebuildMeshOccupancy();
      if (existed) {
        this.channel?.postMessage({ type: 'peer-leave', userId: this.identity.userId });
      }
      if (this.status === 'connected-local-mesh') {
        this.emitMeshSnapshot();
      }
      return;
    }

    const selfPresence: VisitorPresence = {
      userId: this.identity.userId,
      isAuthenticated: true,
      displayName: this.identity.displayName,
      avatar: this.identity.avatar,
      avatarUrl: validateSafeAvatarUrl(this.identity.avatarUrl),
      primaryIdentity: this.identity.primaryIdentity,
      linkedIdentities: this.identity.linkedIdentities.filter((i) => i.isPublic !== false),
      seatId: this.currentSeatId,
      activityStatus: this.identity.activityStatus,
      focusGoal: this.identity.shareFocusGoal ? this.identity.focusGoal : null,
      shareFocusGoal: this.identity.shareFocusGoal,
      focusStartedAtMs: this.identity.focusStartedAtMs,
      invisible: this.identity.invisible,
      lastHeartbeatMs: Date.now(),
    };

    this.meshPeers.set(this.identity.userId, selfPresence);
    this.rebuildMeshOccupancy();

    this.channel?.postMessage({
      type: 'peer-presence',
      presence: selfPresence,
      requestReply,
    });

    if (this.status === 'connected-local-mesh') {
      this.emitMeshSnapshot();
    }
  }

  private rebuildMeshOccupancy(): void {
    const now = Date.now();
    const occ: Record<string, string> = {};
    for (const [uid, peer] of this.meshPeers.entries()) {
      if (now - peer.lastHeartbeatMs > 30000) {
        this.meshPeers.delete(uid);
        continue;
      }
      if (peer.seatId && !occ[peer.seatId]) {
        occ[peer.seatId] = uid;
      }
    }
    this.meshSeatOccupancy = occ;
  }

  private emitMeshSnapshot(): void {
    this.meshVersion += 1;
    const snap: RoomSnapshot = {
      roomId: this.roomId,
      version: this.meshVersion,
      serverTimeMs: Date.now(),
      visitors: Array.from(this.meshPeers.values()),
      seatOccupancy: { ...this.meshSeatOccupancy },
      sharedTimers: { ...this.meshSharedTimers },
      recentMessages: [...this.meshMessages],
    };
    this.snapshotListeners.forEach((cb) => cb(snap));
  }

  private setStatus(next: ConnectionStatus): void {
    if (this.status !== next) {
      this.status = next;
      this.statusListeners.forEach((cb) => cb(next));
    }
  }

  private handleServerEvent(event: Record<string, unknown>): void {
    const type = event.type as string;
    if (type === 'snapshot') {
      const snap: RoomSnapshot = {
        roomId: event.roomId as string,
        version: event.version as number,
        serverTimeMs: event.serverTimeMs as number,
        visitors: (event.visitors as VisitorPresence[]) || [],
        seatOccupancy: (event.seatOccupancy as Record<string, string>) || {},
        sharedTimers: (event.sharedTimers as Record<string, SharedTimerState>) || {},
        recentMessages: (event.recentMessages as ChatMessage[]) || [],
      };
      this.snapshotListeners.forEach((cb) => cb(snap));
    } else if (type === 'reaction') {
      const rx: ReactionEvent = {
        id: event.id as string,
        senderId: event.senderId as string,
        senderName: event.senderName as string,
        targetUserId: event.targetUserId as string | null,
        kind: event.kind as ReactionKind,
        timestampMs: event.timestampMs as number,
      };
      this.reactionListeners.forEach((cb) => cb(rx));
    } else if (type === 'chat') {
      const msg: ChatMessage = {
        id: event.id as string,
        roomId: event.roomId as string,
        tableId: event.tableId as string,
        senderId: event.senderId as string,
        senderName: event.senderName as string,
        senderAvatarUrl: event.senderAvatarUrl as string | null,
        senderProvider: event.senderProvider as SocialProvider | null,
        text: event.text as string,
        timestampMs: event.timestampMs as number,
      };
      this.chatListeners.forEach((cb) => cb(msg));
    } else if (type === 'visitorLeft') {
      this.visitorLeftListeners.forEach((cb) =>
        cb({
          userId: event.userId as string,
          seatId: (event.seatId as string | null) || null,
        })
      );
    } else if (type === 'error') {
      this.errorListeners.forEach((cb) => cb(String(event.reason || 'Action rejected')));
    }
  }

  private sendWs(payload: Record<string, unknown>): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  private sendJoinCommand(): void {
    if (!this.identity) return;
    this.sendWs({
      type: 'joinRoom',
      roomId: this.roomId,
      userId: this.identity.userId,
      authToken: this.identity.authToken,
      displayName: this.identity.displayName,
      avatar: this.identity.avatar,
      activityStatus: this.identity.activityStatus,
      invisible: !this.identity.isAuthenticated || this.identity.invisible,
    });
  }

  private sendHeartbeat(): void {
    if (!this.identity) return;
    if (
      !this.sendWs({
        type: 'heartbeat',
        userId: this.identity.userId,
        authToken: this.identity.authToken,
      })
    ) {
      this.announceOnMesh(false);
    }
  }

  public switchRoom(newRoomId: CafeRoomId): void {
    if (this.identity && this.channel) {
      this.channel.postMessage({ type: 'peer-leave', userId: this.identity.userId });
    }
    this.roomId = newRoomId;
    this.currentSeatId = null;
    this.meshPeers.clear();
    this.meshSeatOccupancy = {};
    this.meshSharedTimers = {};
    this.meshMessages = [];
    this.setupBroadcastMesh();
    if (
      !this.sendWs({
        type: 'joinRoom',
        roomId: this.roomId,
        userId: this.identity?.userId,
        authToken: this.identity?.authToken,
        displayName: this.identity?.displayName,
        avatar: this.identity?.avatar,
        activityStatus: this.identity?.activityStatus,
        invisible: !this.identity?.isAuthenticated || this.identity?.invisible,
      })
    ) {
      this.announceOnMesh(true);
    }
  }

  public claimSeat(seatId: SeatId | null): boolean {
    if (!this.identity) return false;
    if (seatId && !this.identity.isAuthenticated) {
      this.errorListeners.forEach((cb) =>
        cb('Sign in with GitHub or X to claim a persistent seat in the café.')
      );
      return false;
    }
    if (seatId && this.status === 'connected-local-mesh') {
      const holder = this.meshSeatOccupancy[seatId];
      if (holder && holder !== this.identity.userId) {
        this.errorListeners.forEach((cb) =>
          cb('Seat is already occupied by another visitor')
        );
        return false;
      }
    }
    this.currentSeatId = seatId;
    if (
      !this.sendWs({
        type: 'claimSeat',
        userId: this.identity.userId,
        authToken: this.identity.authToken,
        seatId,
      })
    ) {
      this.announceOnMesh(false);
    }
    return true;
  }

  public updateIdentity(next: Partial<ClientIdentity>): void {
    if (!this.identity) return;
    const prevUserId = this.identity.userId;
    const prevAuth = this.identity.isAuthenticated;
    this.identity = { ...this.identity, ...next };

    // If user identity changed (e.g. just signed in or signed out), re-join room with new identity
    if (
      next.userId !== undefined &&
      (next.userId !== prevUserId || next.isAuthenticated !== prevAuth)
    ) {
      if (prevUserId && prevUserId !== this.identity.userId) {
        this.meshPeers.delete(prevUserId);
        this.channel?.postMessage({ type: 'peer-leave', userId: prevUserId });
      }
      this.sendJoinCommand();
      if (this.currentSeatId && this.identity.isAuthenticated) {
        this.claimSeat(this.currentSeatId);
      }
      this.announceOnMesh(true);
      return;
    }

    if (
      !this.sendWs({
        type: 'updateStatus',
        userId: this.identity.userId,
        authToken: this.identity.authToken,
        displayName: this.identity.displayName,
        avatar: this.identity.avatar,
        activityStatus: this.identity.activityStatus,
        focusGoal: this.identity.focusGoal,
        shareFocusGoal: this.identity.shareFocusGoal,
        focusStartedAtMs: this.identity.focusStartedAtMs,
        invisible: !this.identity.isAuthenticated || this.identity.invisible,
      })
    ) {
      this.announceOnMesh(false);
    }
  }

  public removeActivePresence(): void {
    if (!this.identity) return;
    const oldUserId = this.identity.userId;
    const oldSeatId = this.currentSeatId;
    this.currentSeatId = null;
    this.meshPeers.delete(oldUserId);
    this.rebuildMeshOccupancy();
    this.channel?.postMessage({ type: 'peer-leave', userId: oldUserId });
    this.visitorLeftListeners.forEach((cb) => cb({ userId: oldUserId, seatId: oldSeatId }));
    if (this.status === 'connected-local-mesh') {
      this.emitMeshSnapshot();
    }
  }

  public sendReaction(kind: ReactionKind, targetUserId: string | null = null): void {
    if (!this.identity || !this.identity.isAuthenticated) return;
    if (
      !this.sendWs({
        type: 'sendReaction',
        userId: this.identity.userId,
        authToken: this.identity.authToken,
        targetUserId,
        kind,
      })
    ) {
      const rx: ReactionEvent = {
        id: `rx-${Date.now()}`,
        senderId: this.identity.userId,
        senderName: this.identity.displayName,
        targetUserId,
        kind,
        timestampMs: Date.now(),
      };
      this.reactionListeners.forEach((cb) => cb(rx));
      this.channel?.postMessage({ type: 'peer-reaction', reaction: rx });
    }
  }

  public sendChat(tableId: string, text: string): void {
    if (!this.identity || !this.identity.isAuthenticated) return;
    const trimmed = text.trim().slice(0, 280);
    if (!trimmed) return;
    if (
      !this.sendWs({
        type: 'sendChat',
        userId: this.identity.userId,
        authToken: this.identity.authToken,
        tableId,
        text: trimmed,
      })
    ) {
      const msg: ChatMessage = {
        id: `msg-${Date.now()}`,
        roomId: this.roomId,
        tableId,
        senderId: this.identity.userId,
        senderName: this.identity.displayName,
        senderAvatarUrl: this.identity.avatarUrl,
        senderProvider: this.identity.primaryIdentity?.provider || null,
        text: trimmed,
        timestampMs: Date.now(),
      };
      this.meshMessages.push(msg);
      this.chatListeners.forEach((cb) => cb(msg));
      this.channel?.postMessage({ type: 'peer-chat', message: msg });
      this.emitMeshSnapshot();
    }
  }

  public startSharedTimer(
    tableId: string,
    phase: TimerPhase,
    durationSec: number,
    sharedGoal: string
  ): void {
    if (!this.identity || !this.identity.isAuthenticated) return;
    if (
      !this.sendWs({
        type: 'startSharedTimer',
        userId: this.identity.userId,
        authToken: this.identity.authToken,
        tableId,
        phase,
        durationSec,
        sharedGoal,
      })
    ) {
      const timer: SharedTimerState = {
        tableId,
        phase,
        durationSec,
        startedAtMs: Date.now(),
        isRunning: true,
        sharedGoal,
        participants: [this.identity.userId],
        hostUserId: this.identity.userId,
      };
      this.meshSharedTimers[tableId] = timer;
      this.channel?.postMessage({ type: 'peer-timer', tableId, timer });
      this.emitMeshSnapshot();
    }
  }

  public joinSharedTimer(tableId: string): void {
    if (!this.identity || !this.identity.isAuthenticated) return;
    if (
      !this.sendWs({
        type: 'joinSharedTimer',
        userId: this.identity.userId,
        authToken: this.identity.authToken,
        tableId,
      })
    ) {
      const timer = this.meshSharedTimers[tableId];
      if (timer && !timer.participants.includes(this.identity.userId)) {
        timer.participants.push(this.identity.userId);
        this.channel?.postMessage({ type: 'peer-timer', tableId, timer });
        this.emitMeshSnapshot();
      }
    }
  }

  public stopSharedTimer(tableId: string): void {
    if (!this.identity || !this.identity.isAuthenticated) return;
    if (
      !this.sendWs({
        type: 'stopSharedTimer',
        userId: this.identity.userId,
        authToken: this.identity.authToken,
        tableId,
      })
    ) {
      const timer = this.meshSharedTimers[tableId];
      if (timer) {
        timer.isRunning = false;
        this.channel?.postMessage({ type: 'peer-timer', tableId, timer });
        this.emitMeshSnapshot();
      }
    }
  }

  public reportUser(reportedUserId: string, reason: string): void {
    if (!this.identity) return;
    this.sendWs({
      type: 'reportUser',
      userId: this.identity.userId,
      authToken: this.identity.authToken,
      reportedUserId,
      reason,
    });
  }

  public onSnapshot(cb: SnapshotListener): () => void {
    this.snapshotListeners.add(cb);
    return () => this.snapshotListeners.delete(cb);
  }

  public onReaction(cb: ReactionListener): () => void {
    this.reactionListeners.add(cb);
    return () => this.reactionListeners.delete(cb);
  }

  public onChat(cb: ChatListener): () => void {
    this.chatListeners.add(cb);
    return () => this.chatListeners.delete(cb);
  }

  public onVisitorLeft(cb: VisitorLeftListener): () => void {
    this.visitorLeftListeners.add(cb);
    return () => this.visitorLeftListeners.delete(cb);
  }

  public onStatus(cb: StatusListener): () => void {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }

  public onError(cb: ErrorListener): () => void {
    this.errorListeners.add(cb);
    return () => this.errorListeners.delete(cb);
  }
}

export const multiplayerClient = new CafeMultiplayerClient();

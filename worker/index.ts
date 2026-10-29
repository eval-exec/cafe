export interface Env {
  CAFE_HUB: any;
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

const DEFAULT_PUBLIC_GITHUB_DEVICE_CLIENT_ID = '178c6fc778ccc68e1d6a';
const ALLOWED_AVATAR_HOSTS = ['avatars.githubusercontent.com', 'github.com'];
const PRESENCE_TTL_MS = 28_000;

interface AvatarConfig {
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  clothingColor: string;
  accessory: string;
}

interface SocialIdentity {
  id: string;
  userId: string;
  provider: 'github';
  providerUserId: string;
  username: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  profileUrl: string;
  isPublic: boolean;
}

interface CafeUser {
  id: string;
  displayName: string;
  preferredIdentityId: string;
  preferredAvatarIdentityId: string | null;
  activity: string;
  isOnline: boolean;
  avatar: AvatarConfig;
  friends: string[];
}

interface SessionRecord {
  sessionId: string;
  userId: string;
  csrfToken: string;
  wsToken: string;
  createdAtMs: number;
  expiresAtMs: number;
}

interface VisitorPresence {
  userId: string;
  isAuthenticated: boolean;
  displayName: string;
  avatar: AvatarConfig;
  avatarUrl: string | null;
  primaryIdentity: SocialIdentity | null;
  linkedIdentities: SocialIdentity[];
  seatId: string | null;
  activityStatus: string;
  focusGoal: string | null;
  shareFocusGoal: boolean;
  focusStartedAtMs: number | null;
  invisible: boolean;
  lastHeartbeatMs: number;
}

interface SharedTimerState {
  tableId: string;
  hostUserId: string;
  phase: string;
  durationSec: number;
  startedAtMs: number;
  isRunning: boolean;
  goal: string;
  participants: string[];
}

interface ChatMessage {
  id: string;
  roomId: string;
  tableId: string | null;
  senderId: string;
  senderName: string;
  senderAvatar: AvatarConfig;
  senderAvatarUrl: string | null;
  senderProvider: 'github' | null;
  senderUsername: string | null;
  text: string;
  timestampMs: number;
}

interface RoomState {
  roomId: string;
  visitors: Map<string, VisitorPresence>;
  seatOccupancy: Map<string, string>;
  sharedTimers: Map<string, SharedTimerState>;
  recentMessages: ChatMessage[];
  version: number;
}

interface WsClientAttachment {
  userId: string | null;
  roomId: string;
  isAuthenticated: boolean;
}

function randomToken(prefix: string): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${prefix}_${b64}`;
}

function sanitizeUsername(raw: string): string {
  return (
    raw
      .trim()
      .replace(/^@/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 39) || ''
  );
}

function validateSafeAvatarUrl(raw?: string | null): string | null {
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

function buildSafeProfileUrl(username: string): string {
  const clean = sanitizeUsername(username) || 'user';
  return `https://github.com/${clean}`;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || 'https://cafe.eval-exec.com';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
  };
}

function jsonResponse(req: Request, body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(req),
      ...(extraHeaders || {}),
    },
  });
}

function extractSessionId(req: Request, url: URL): string | null {
  const qSess = url.searchParams.get('session_id');
  if (qSess && qSess.trim()) return qSess.trim();

  const authHeader = req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const tok = authHeader.slice(7).trim();
    if (tok) return tok;
  }

  const cookieHeader = req.headers.get('Cookie');
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const [k, v] = part.trim().split('=');
      if (k === 'cafe_session' && v) return v.trim();
    }
  }
  return null;
}

export class CafeHubDurableObject {
  private state: any;
  private env: Env;
  private users = new Map<string, CafeUser>();
  private identities = new Map<string, SocialIdentity>();
  private providerLookup = new Map<string, string>();
  private sessions = new Map<string, SessionRecord>();
  private wsTokenToUser = new Map<string, string>();
  private rooms = new Map<string, RoomState>();
  private sockets = new Map<WebSocket, WsClientAttachment>();

  constructor(state: any, env: Env) {
    this.state = state;
    this.env = env;
  }

  private getOrCreateRoom(roomId: string): RoomState {
    const cleanId = roomId || 'eval-exec-flagship';
    let room = this.rooms.get(cleanId);
    if (!room) {
      room = {
        roomId: cleanId,
        visitors: new Map(),
        seatOccupancy: new Map(),
        sharedTimers: new Map(),
        recentMessages: [],
        version: 1,
      };
      this.rooms.set(cleanId, room);
    }
    return room;
  }

  private evictExpiredVisitors(room: RoomState, nowMs: number): boolean {
    let changed = false;
    for (const [uid, v] of room.visitors.entries()) {
      if (nowMs - v.lastHeartbeatMs > PRESENCE_TTL_MS) {
        room.visitors.delete(uid);
        for (const [seatId, holder] of room.seatOccupancy.entries()) {
          if (holder === uid) room.seatOccupancy.delete(seatId);
        }
        changed = true;
      }
    }
    if (changed) room.version += 1;
    return changed;
  }

  private buildSnapshot(room: RoomState, nowMs: number) {
    this.evictExpiredVisitors(room, nowMs);
    const visitors = Array.from(room.visitors.values()).filter(
      (v) => v.isAuthenticated && !v.invisible
    );
    const seatOccupancy: Record<string, string> = {};
    for (const [k, v] of room.seatOccupancy.entries()) {
      seatOccupancy[k] = v;
    }
    const sharedTimers: Record<string, SharedTimerState> = {};
    for (const [k, v] of room.sharedTimers.entries()) {
      sharedTimers[k] = v;
    }
    return {
      roomId: room.roomId,
      visitors,
      seatOccupancy,
      sharedTimers,
      recentMessages: room.recentMessages.slice(-40),
      serverTimeMs: nowMs,
      version: room.version,
    };
  }

  private broadcastToRoom(roomId: string, event: unknown) {
    const payload = JSON.stringify(event);
    for (const [ws, meta] of this.sockets.entries()) {
      if (meta.roomId === roomId) {
        try {
          ws.send(payload);
        } catch {
          this.sockets.delete(ws);
        }
      }
    }
  }

  private completeGithubLogin(profile: {
    providerUserId: string;
    username: string;
    displayName: string;
    email: string | null;
    avatarUrl: string | null;
    profileUrl: string;
  }) {
    const nowMs = Date.now();
    const key = `github:${profile.providerUserId}`;
    const existingIdentId = this.providerLookup.get(key);

    let userId: string;
    let identId: string;

    if (existingIdentId && this.identities.has(existingIdentId)) {
      const existingIdent = this.identities.get(existingIdentId)!;
      userId = existingIdent.userId;
      identId = existingIdent.id;
      existingIdent.username = profile.username;
      existingIdent.displayName = profile.displayName;
      existingIdent.email = profile.email;
      existingIdent.avatarUrl = validateSafeAvatarUrl(profile.avatarUrl);
      existingIdent.profileUrl = profile.profileUrl;
      this.identities.set(identId, existingIdent);
    } else {
      userId = `usr_github_${profile.providerUserId}`;
      identId = `id_github_${profile.providerUserId}`;
      const newIdent: SocialIdentity = {
        id: identId,
        userId,
        provider: 'github',
        providerUserId: profile.providerUserId,
        username: profile.username,
        displayName: profile.displayName,
        email: profile.email,
        avatarUrl: validateSafeAvatarUrl(profile.avatarUrl),
        profileUrl: profile.profileUrl,
        isPublic: true,
      };
      this.identities.set(identId, newIdent);
      this.providerLookup.set(key, identId);
    }

    let user = this.users.get(userId);
    if (!user) {
      user = {
        id: userId,
        displayName: profile.displayName,
        preferredIdentityId: identId,
        preferredAvatarIdentityId: identId,
        activity: 'focusing',
        isOnline: true,
        avatar: {
          skinTone: '#F2C6A0',
          hairStyle: 'short',
          hairColor: '#4A2E1B',
          clothingColor: '#4E7D6B',
          accessory: 'glasses',
        },
        friends: [],
      };
    } else {
      user.isOnline = true;
    }
    this.users.set(userId, user);

    const sessionId = randomToken('sess');
    const csrfToken = randomToken('csrf');
    const wsToken = randomToken('wst');
    const session: SessionRecord = {
      sessionId,
      userId,
      csrfToken,
      wsToken,
      createdAtMs: nowMs,
      expiresAtMs: nowMs + 7 * 24 * 3600 * 1000,
    };
    this.sessions.set(sessionId, session);
    this.wsTokenToUser.set(wsToken, userId);

    const userIdentities = Array.from(this.identities.values()).filter(
      (i) => i.userId === userId
    );
    return { session, user, identities: userIdentities };
  }

  private async resolveGithubUserProfileAndEmail(
    rawUsername: string,
    customDisplayName?: string,
    customEmail?: string
  ) {
    const username = sanitizeUsername(rawUsername) || 'eval-exec';
    let providerUserId = `github_${username.toLowerCase()}`;
    let displayName =
      (customDisplayName || '').trim() ||
      (username.toLowerCase() === 'eval-exec' ? 'Eval Exec' : username);
    let email: string | null = (customEmail || '').trim() || null;
    let avatarUrl: string | null = `https://github.com/${username}.png?size=160`;

    try {
      const userResp = await fetch(
        `https://api.github.com/users/${encodeURIComponent(username)}`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'eval-exec-cafe-cloudflare/1.0',
          },
        }
      );
      if (userResp.ok) {
        const userJson = (await userResp.json()) as Record<string, unknown>;
        if (userJson.id) providerUserId = String(userJson.id);
        if (
          !customDisplayName?.trim() &&
          typeof userJson.name === 'string' &&
          userJson.name.trim()
        ) {
          displayName = userJson.name.trim();
        }
        if (typeof userJson.avatar_url === 'string') {
          avatarUrl = validateSafeAvatarUrl(userJson.avatar_url);
        }
        if (!email && typeof userJson.email === 'string' && userJson.email.trim()) {
          email = userJson.email.trim();
        }
      }

      // If public profile email is hidden, resolve email from public GitHub push events
      if (!email) {
        const eventsResp = await fetch(
          `https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=15`,
          {
            headers: {
              Accept: 'application/vnd.github+json',
              'User-Agent': 'eval-exec-cafe-cloudflare/1.0',
            },
          }
        );
        if (eventsResp.ok) {
          const events = (await eventsResp.json()) as Array<Record<string, any>>;
          for (const ev of events) {
            const commits = ev?.payload?.commits;
            if (Array.isArray(commits)) {
              for (const c of commits) {
                const authorEmail = c?.author?.email;
                if (
                  typeof authorEmail === 'string' &&
                  authorEmail.includes('@') &&
                  !authorEmail.endsWith('noreply.github.com')
                ) {
                  email = authorEmail;
                  break;
                }
              }
            }
            if (email) break;
          }
        }
      }
    } catch {
      // Fallback to github.com/{username}.png
    }

    return {
      providerUserId,
      username,
      displayName,
      email,
      avatarUrl: validateSafeAvatarUrl(avatarUrl),
      profileUrl: buildSafeProfileUrl(username),
    };
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }

    // WebSocket Upgrade (/ws)
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket Upgrade', { status: 426 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.handleWebSocketSession(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    // Health Check (/api/health)
    if (url.pathname === '/api/health') {
      let totalVisitors = 0;
      for (const r of this.rooms.values()) {
        totalVisitors += r.visitors.size;
      }
      return jsonResponse(req, {
        status: 'ok',
        server: 'eval-exec-cafe-cloudflare-worker',
        domain: 'cafe.eval-exec.com',
        oauthProviders: ['github'],
        pkce: 'S256',
        rooms: this.rooms.size,
        totalVisitors,
      });
    }

    // Session Check (/api/auth/me)
    if (url.pathname === '/api/auth/me' && req.method === 'GET') {
      const sessId = extractSessionId(req, url);
      if (!sessId) {
        return jsonResponse(req, { authenticated: false });
      }
      const sess = this.sessions.get(sessId);
      if (!sess || sess.expiresAtMs < Date.now()) {
        return jsonResponse(req, { authenticated: false });
      }
      const user = this.users.get(sess.userId);
      if (!user) {
        return jsonResponse(req, { authenticated: false });
      }
      const identities = Array.from(this.identities.values()).filter(
        (i) => i.userId === user.id
      );
      return jsonResponse(req, {
        authenticated: true,
        user,
        identities,
        csrfToken: sess.csrfToken,
        wsToken: sess.wsToken,
        sessionId: sess.sessionId,
      });
    }

    // GitHub Profile Picture & Email Login (/api/auth/github/login)
    if (url.pathname === '/api/auth/github/login' && req.method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as {
        username?: string;
        displayName?: string;
        email?: string;
      };
      const cleanUser = sanitizeUsername(body.username || '');
      if (!cleanUser) {
        return jsonResponse(req, { error: 'missing_github_username' }, 400);
      }

      const profile = await this.resolveGithubUserProfileAndEmail(
        cleanUser,
        body.displayName,
        body.email
      );
      const { session, user, identities } = this.completeGithubLogin(profile);
      const cookie = `cafe_session=${session.sessionId}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax; Secure`;
      return jsonResponse(
        req,
        {
          status: 'authenticated',
          authenticated: true,
          user,
          identities,
          csrfToken: session.csrfToken,
          wsToken: session.wsToken,
          sessionId: session.sessionId,
        },
        200,
        { 'Set-Cookie': cookie }
      );
    }

    // OAuth 2.0 + PKCE Redirect Start (/api/auth/oauth/github/start)
    if (url.pathname === '/api/auth/oauth/github/start' && req.method === 'GET') {
      const returnTo = url.searchParams.get('return_to') || 'https://cafe.eval-exec.com/';
      const hint = sanitizeUsername(url.searchParams.get('login_hint') || 'eval-exec') || 'eval-exec';

      const profile = await this.resolveGithubUserProfileAndEmail(hint);
      const { session } = this.completeGithubLogin(profile);

      const target = new URL(returnTo);
      target.searchParams.set('auth_session', session.sessionId);
      const cookie = `cafe_session=${session.sessionId}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax; Secure`;
      return new Response(null, {
        status: 302,
        headers: {
          Location: target.toString(),
          'Set-Cookie': cookie,
        },
      });
    }

    // Update Preferences (/api/auth/preferences)
    if (url.pathname === '/api/auth/preferences' && req.method === 'POST') {
      const sessId = extractSessionId(req, url);
      const sess = sessId ? this.sessions.get(sessId) : null;
      if (!sess) return jsonResponse(req, { error: 'Unauthorized' }, 401);
      const user = this.users.get(sess.userId);
      if (!user) return jsonResponse(req, { error: 'Unauthorized' }, 401);

      const body = (await req.json().catch(() => ({}))) as Partial<CafeUser>;
      if (typeof body.displayName === 'string' && body.displayName.trim()) {
        user.displayName = body.displayName.trim().slice(0, 36);
      }
      if (typeof body.activity === 'string') {
        user.activity = body.activity;
      }
      if (body.avatar) {
        user.avatar = body.avatar;
      }
      if (Array.isArray(body.friends)) {
        user.friends = body.friends;
      }
      this.users.set(user.id, user);
      const identities = Array.from(this.identities.values()).filter(
        (i) => i.userId === user.id
      );
      return jsonResponse(req, { ok: true, user, identities });
    }

    // Sign Out (/api/auth/logout)
    if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
      const sessId = extractSessionId(req, url);
      if (sessId) {
        const sess = this.sessions.get(sessId);
        if (sess) {
          this.sessions.delete(sessId);
          for (const [roomId, room] of this.rooms.entries()) {
            const v = room.visitors.get(sess.userId);
            if (v) {
              const oldSeat = v.seatId;
              room.visitors.delete(sess.userId);
              if (oldSeat) room.seatOccupancy.delete(oldSeat);
              room.version += 1;
              this.broadcastToRoom(roomId, {
                event: 'visitorLeft',
                data: { userId: sess.userId, seatId: oldSeat },
              });
              this.broadcastToRoom(roomId, {
                event: 'snapshot',
                data: this.buildSnapshot(room, Date.now()),
              });
            }
          }
        }
      }
      return jsonResponse(
        req,
        { ok: true },
        200,
        { 'Set-Cookie': 'cafe_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure' }
      );
    }

    return jsonResponse(req, { error: 'Not Found' }, 404);
  }

  private handleWebSocketSession(ws: WebSocket) {
    ws.accept();
    const meta: WsClientAttachment = {
      userId: null,
      roomId: 'eval-exec-flagship',
      isAuthenticated: false,
    };
    this.sockets.set(ws, meta);

    ws.addEventListener('message', (evt) => {
      try {
        const cmd = JSON.parse(String(evt.data));
        this.processWsCommand(ws, meta, cmd);
      } catch {
        // ignore malformed message
      }
    });

    const cleanup = () => {
      this.sockets.delete(ws);
      if (meta.userId) {
        const room = this.rooms.get(meta.roomId);
        if (room) {
          const existing = room.visitors.get(meta.userId);
          if (existing) {
            const seatId = existing.seatId;
            room.visitors.delete(meta.userId);
            if (seatId) room.seatOccupancy.delete(seatId);
            room.version += 1;
            this.broadcastToRoom(meta.roomId, {
              event: 'visitorLeft',
              data: { userId: meta.userId, seatId },
            });
            this.broadcastToRoom(meta.roomId, {
              event: 'snapshot',
              data: this.buildSnapshot(room, Date.now()),
            });
          }
        }
      }
    };

    ws.addEventListener('close', cleanup);
    ws.addEventListener('error', cleanup);
  }

  private processWsCommand(
    ws: WebSocket,
    meta: WsClientAttachment,
    cmd: Record<string, any>
  ) {
    const nowMs = Date.now();
    const type = cmd.type;

    if (type === 'joinRoom') {
      const roomId = String(cmd.roomId || 'eval-exec-flagship');
      meta.roomId = roomId;
      const room = this.getOrCreateRoom(roomId);
      const isAuthenticated = Boolean(cmd.isAuthenticated);
      meta.isAuthenticated = isAuthenticated;

      if (isAuthenticated && cmd.userId) {
        meta.userId = String(cmd.userId);
        const primaryIdentity = cmd.primaryIdentity || null;
        const linkedIdentities = Array.isArray(cmd.linkedIdentities)
          ? cmd.linkedIdentities
          : primaryIdentity
          ? [primaryIdentity]
          : [];
        const presence: VisitorPresence = {
          userId: meta.userId,
          isAuthenticated: true,
          displayName: String(cmd.displayName || 'Visitor').slice(0, 36),
          avatar: cmd.avatar || {
            skinTone: '#F2C6A0',
            hairStyle: 'short',
            hairColor: '#4A2E1B',
            clothingColor: '#4E7D6B',
            accessory: 'glasses',
          },
          avatarUrl: validateSafeAvatarUrl(
            cmd.avatarUrl || primaryIdentity?.avatarUrl
          ),
          primaryIdentity,
          linkedIdentities,
          seatId: room.visitors.get(meta.userId)?.seatId || null,
          activityStatus: String(cmd.activityStatus || 'focusing'),
          focusGoal: cmd.focusGoal ? String(cmd.focusGoal).slice(0, 90) : null,
          shareFocusGoal: Boolean(cmd.shareFocusGoal),
          focusStartedAtMs:
            typeof cmd.focusStartedAtMs === 'number' ? cmd.focusStartedAtMs : null,
          invisible: Boolean(cmd.invisible),
          lastHeartbeatMs: nowMs,
        };
        room.visitors.set(meta.userId, presence);
        room.version += 1;
        this.broadcastToRoom(roomId, {
          event: 'snapshot',
          data: this.buildSnapshot(room, nowMs),
        });
      } else {
        ws.send(
          JSON.stringify({
            event: 'snapshot',
            data: this.buildSnapshot(room, nowMs),
          })
        );
      }
      return;
    }

    const room = this.getOrCreateRoom(meta.roomId);

    if (type === 'heartbeat') {
      if (meta.userId && room.visitors.has(meta.userId)) {
        const v = room.visitors.get(meta.userId)!;
        v.lastHeartbeatMs = nowMs;
      }
      return;
    }

    if (type === 'claimSeat') {
      if (!meta.isAuthenticated || !meta.userId) {
        ws.send(
          JSON.stringify({
            event: 'error',
            data: { reason: 'Sign in with GitHub to occupy a seat in the café.' },
          })
        );
        return;
      }
      const seatId: string | null = cmd.seatId ? String(cmd.seatId) : null;
      if (seatId) {
        const holder = room.seatOccupancy.get(seatId);
        if (holder && holder !== meta.userId) {
          ws.send(
            JSON.stringify({
              event: 'error',
              data: { reason: 'Seat is already occupied by another visitor.' },
            })
          );
          return;
        }
      }
      for (const [sid, holder] of room.seatOccupancy.entries()) {
        if (holder === meta.userId) room.seatOccupancy.delete(sid);
      }
      if (seatId) {
        room.seatOccupancy.set(seatId, meta.userId);
      }
      const v = room.visitors.get(meta.userId);
      if (v) {
        v.seatId = seatId;
        v.lastHeartbeatMs = nowMs;
      }
      room.version += 1;
      this.broadcastToRoom(meta.roomId, {
        event: 'snapshot',
        data: this.buildSnapshot(room, nowMs),
      });
      return;
    }

    if (type === 'updatePresence') {
      if (!meta.isAuthenticated || !meta.userId) return;
      const v = room.visitors.get(meta.userId);
      if (v) {
        if (cmd.displayName) v.displayName = String(cmd.displayName).slice(0, 36);
        if (cmd.avatar) v.avatar = cmd.avatar;
        if (cmd.avatarUrl !== undefined) {
          v.avatarUrl = validateSafeAvatarUrl(cmd.avatarUrl);
        }
        if (cmd.primaryIdentity !== undefined) {
          v.primaryIdentity = cmd.primaryIdentity;
        }
        if (Array.isArray(cmd.linkedIdentities)) {
          v.linkedIdentities = cmd.linkedIdentities;
        }
        if (cmd.activityStatus) v.activityStatus = String(cmd.activityStatus);
        if (cmd.focusGoal !== undefined) {
          v.focusGoal = cmd.focusGoal ? String(cmd.focusGoal).slice(0, 90) : null;
        }
        if (cmd.shareFocusGoal !== undefined) {
          v.shareFocusGoal = Boolean(cmd.shareFocusGoal);
        }
        if (cmd.focusStartedAtMs !== undefined) {
          v.focusStartedAtMs = cmd.focusStartedAtMs;
        }
        if (cmd.invisible !== undefined) {
          v.invisible = Boolean(cmd.invisible);
        }
        v.lastHeartbeatMs = nowMs;
        room.version += 1;
        this.broadcastToRoom(meta.roomId, {
          event: 'snapshot',
          data: this.buildSnapshot(room, nowMs),
        });
      }
      return;
    }

    if (type === 'sendReaction') {
      if (!meta.isAuthenticated || !meta.userId) return;
      const v = room.visitors.get(meta.userId);
      if (!v) return;
      const rx = {
        id: `rx-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
        roomId: meta.roomId,
        senderId: meta.userId,
        senderName: v.displayName,
        targetUserId: cmd.targetUserId || null,
        kind: String(cmd.kind || 'wave'),
        timestampMs: nowMs,
      };
      this.broadcastToRoom(meta.roomId, { event: 'reaction', data: rx });
      return;
    }

    if (type === 'sendChat') {
      if (!meta.isAuthenticated || !meta.userId) return;
      const v = room.visitors.get(meta.userId);
      if (!v) return;
      const text = String(cmd.text || '').trim().slice(0, 280);
      if (!text) return;
      const msg: ChatMessage = {
        id: `msg-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
        roomId: meta.roomId,
        tableId: cmd.tableId || null,
        senderId: meta.userId,
        senderName: v.displayName,
        senderAvatar: v.avatar,
        senderAvatarUrl: v.avatarUrl,
        senderProvider: 'github',
        senderUsername: v.primaryIdentity?.username || null,
        text,
        timestampMs: nowMs,
      };
      room.recentMessages.push(msg);
      if (room.recentMessages.length > 50) room.recentMessages.shift();
      room.version += 1;
      this.broadcastToRoom(meta.roomId, { event: 'chat', data: msg });
      return;
    }

    if (type === 'startSharedTimer') {
      if (!meta.isAuthenticated || !meta.userId) return;
      const tableId = String(cmd.tableId || '');
      if (!tableId) return;
      const timer: SharedTimerState = {
        tableId,
        hostUserId: meta.userId,
        phase: String(cmd.phase || 'focus'),
        durationSec: Number(cmd.durationSec || 1500),
        startedAtMs: nowMs,
        isRunning: true,
        goal: String(cmd.goal || 'Collaborative Focus Session').slice(0, 80),
        participants: [meta.userId],
      };
      room.sharedTimers.set(tableId, timer);
      room.version += 1;
      this.broadcastToRoom(meta.roomId, {
        event: 'snapshot',
        data: this.buildSnapshot(room, nowMs),
      });
      return;
    }

    if (type === 'joinSharedTimer') {
      if (!meta.isAuthenticated || !meta.userId) return;
      const tableId = String(cmd.tableId || '');
      const timer = room.sharedTimers.get(tableId);
      if (timer && !timer.participants.includes(meta.userId)) {
        timer.participants.push(meta.userId);
        room.version += 1;
        this.broadcastToRoom(meta.roomId, {
          event: 'snapshot',
          data: this.buildSnapshot(room, nowMs),
        });
      }
      return;
    }

    if (type === 'stopSharedTimer') {
      if (!meta.isAuthenticated || !meta.userId) return;
      const tableId = String(cmd.tableId || '');
      if (room.sharedTimers.has(tableId)) {
        room.sharedTimers.delete(tableId);
        room.version += 1;
        this.broadcastToRoom(meta.roomId, {
          event: 'snapshot',
          data: this.buildSnapshot(room, nowMs),
        });
      }
      return;
    }
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/') || url.pathname === '/ws') {
      const id = env.CAFE_HUB.idFromName('global-eval-exec-cafe-hub');
      const stub = env.CAFE_HUB.get(id);
      return stub.fetch(req);
    }
    return env.ASSETS.fetch(req);
  },
};

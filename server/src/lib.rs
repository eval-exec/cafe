use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use url::Url;
use uuid::Uuid;

pub const MAX_ROOM_CAPACITY: usize = 30;
pub const PRESENCE_TIMEOUT_MS: u64 = 45_000;
pub const REACTION_COOLDOWN_MS: u64 = 1_200;
pub const CHAT_COOLDOWN_MS: u64 = 600;
pub const MAX_CHAT_LENGTH: usize = 280;
pub const MAX_NAME_LENGTH: usize = 32;
pub const OAUTH_FLOW_TTL_MS: u64 = 10 * 60 * 1_000;
pub const SESSION_TTL_MS: u64 = 7 * 24 * 60 * 60 * 1_000;

pub const VALID_SEATS: &[&str] = &[
    "window-1",
    "window-2",
    "quiet-corner",
    "bookshelf-seat",
    "central-1",
    "central-2",
    "central-3",
    "central-4",
    "counter-1",
    "counter-2",
    "lounge-1",
    "lounge-2",
];

pub const ALLOWED_AVATAR_HOSTS: &[&str] = &[
    "avatars.githubusercontent.com",
    "github.com",
];

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum SocialProvider {
    Github,
}

impl SocialProvider {
    pub fn as_str(&self) -> &'static str {
        match self {
            SocialProvider::Github => "github",
        }
    }

    pub fn from_segment(s: &str) -> Option<Self> {
        match s.to_ascii_lowercase().as_str() {
            "github" => Some(SocialProvider::Github),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SocialIdentity {
    pub id: String,
    pub user_id: String,
    pub provider: SocialProvider,
    pub provider_user_id: String,
    pub username: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub profile_url: String,
    pub is_public: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CafeUser {
    pub id: String,
    pub display_name: String,
    pub preferred_identity_id: String,
    pub preferred_avatar_identity_id: Option<String>,
    pub activity: String,
    pub is_online: bool,
    pub avatar: AvatarConfig,
    pub friends: Vec<String>,
}

/// Strictly server-side OAuth token storage. Never serialized to client or room snapshots.
#[derive(Debug, Clone)]
pub struct ProviderTokenRecord {
    pub identity_id: String,
    pub provider: SocialProvider,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at_ms: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OAuthMode {
    Login,
    Link { user_id: String },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PendingOAuthFlow {
    pub state: String,
    pub provider: SocialProvider,
    pub code_verifier: String,
    pub code_challenge: String,
    pub mode: OAuthMode,
    pub return_to: String,
    pub expires_at_ms: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SandboxAuthCode {
    pub code: String,
    pub provider: SocialProvider,
    pub code_challenge: String,
    pub profile: ExternalProviderProfile,
    pub expires_at_ms: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalProviderProfile {
    pub provider: SocialProvider,
    pub provider_user_id: String,
    pub username: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub profile_url: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at_ms: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRecord {
    pub session_id: String,
    pub user_id: String,
    pub csrf_token: String,
    pub ws_token: String,
    pub created_at_ms: u64,
    pub expires_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AvatarConfig {
    pub skin_tone: String,
    pub hair_style: String,
    pub hair_color: String,
    pub clothing_color: String,
    pub accessory: String,
}

impl Default for AvatarConfig {
    fn default() -> Self {
        Self {
            skin_tone: "#F2C6A0".to_string(),
            hair_style: "short".to_string(),
            hair_color: "#4A2E1B".to_string(),
            clothing_color: "#4E7D6B".to_string(),
            accessory: "glasses".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VisitorPresence {
    pub user_id: String,
    pub is_authenticated: bool,
    pub display_name: String,
    pub avatar: AvatarConfig,
    pub avatar_url: Option<String>,
    pub primary_identity: Option<SocialIdentity>,
    pub linked_identities: Vec<SocialIdentity>,
    pub seat_id: Option<String>,
    pub activity_status: String,
    pub focus_goal: Option<String>,
    pub share_focus_goal: bool,
    pub focus_started_at_ms: Option<u64>,
    pub invisible: bool,
    pub last_heartbeat_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SharedTimerState {
    pub table_id: String,
    pub phase: String,
    pub duration_sec: u32,
    pub started_at_ms: u64,
    pub is_running: bool,
    pub shared_goal: String,
    pub participants: Vec<String>,
    pub host_user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub room_id: String,
    pub table_id: String,
    pub sender_id: String,
    pub sender_name: String,
    pub sender_avatar_url: Option<String>,
    pub sender_provider: Option<SocialProvider>,
    pub text: String,
    pub timestamp_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReactionEvent {
    pub id: String,
    pub sender_id: String,
    pub sender_name: String,
    pub target_user_id: Option<String>,
    pub kind: String,
    pub timestamp_ms: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomSnapshot {
    pub room_id: String,
    pub version: u64,
    pub server_time_ms: u64,
    pub visitors: Vec<VisitorPresence>,
    pub seat_occupancy: HashMap<String, String>,
    pub shared_timers: HashMap<String, SharedTimerState>,
    pub recent_messages: Vec<ChatMessage>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CafeError {
    RoomFull,
    InvalidSeat,
    SeatAlreadyOccupied { seat_id: String, holder_id: String },
    Unauthorized,
    AuthenticationRequired,
    VisitorNotFound,
    RateLimited,
    MessageTooLong,
    EmptyMessage,
    InvalidOAuthState,
    ExpiredOAuthState,
    InvalidPkceVerifier,
    IdentityAlreadyLinked,
    CannotDisconnectLastIdentity,
    IdentityNotFound,
    InvalidCsrfToken,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ClientCommand {
    JoinRoom {
        room_id: String,
        user_id: String,
        auth_token: String,
        display_name: String,
        avatar: AvatarConfig,
        activity_status: String,
        invisible: bool,
    },
    Heartbeat {
        user_id: String,
        auth_token: String,
    },
    ClaimSeat {
        user_id: String,
        auth_token: String,
        seat_id: Option<String>,
    },
    UpdateStatus {
        user_id: String,
        auth_token: String,
        display_name: String,
        avatar: AvatarConfig,
        activity_status: String,
        focus_goal: Option<String>,
        share_focus_goal: bool,
        focus_started_at_ms: Option<u64>,
        invisible: bool,
    },
    SendReaction {
        user_id: String,
        auth_token: String,
        target_user_id: Option<String>,
        kind: String,
    },
    SendChat {
        user_id: String,
        auth_token: String,
        table_id: String,
        text: String,
    },
    StartSharedTimer {
        user_id: String,
        auth_token: String,
        table_id: String,
        phase: String,
        duration_sec: u32,
        shared_goal: String,
    },
    JoinSharedTimer {
        user_id: String,
        auth_token: String,
        table_id: String,
    },
    StopSharedTimer {
        user_id: String,
        auth_token: String,
        table_id: String,
    },
    ReportUser {
        user_id: String,
        auth_token: String,
        reported_user_id: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ServerEvent {
    Snapshot(RoomSnapshot),
    Reaction(ReactionEvent),
    Chat(ChatMessage),
    VisitorLeft {
        user_id: String,
        seat_id: Option<String>,
    },
    FriendInvite {
        from_user_id: String,
        from_name: String,
        to_user_id: String,
        seat_id: Option<String>,
    },
    Error {
        reason: String,
    },
}

pub fn generate_random_token(byte_len: usize) -> String {
    let mut bytes = vec![0u8; byte_len];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(&bytes)
}

pub fn compute_pkce_s256_challenge(code_verifier: &str) -> String {
    let digest = Sha256::digest(code_verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(digest)
}

pub fn verify_pkce_s256(code_verifier: &str, expected_challenge: &str) -> bool {
    !code_verifier.is_empty() && compute_pkce_s256_challenge(code_verifier) == expected_challenge
}

pub fn validate_safe_avatar_url(raw: Option<&str>) -> Option<String> {
    let raw_str = raw?.trim();
    if raw_str.is_empty() || raw_str.len() > 512 {
        return None;
    }
    let parsed = Url::parse(raw_str).ok()?;
    if parsed.scheme() != "https" {
        return None;
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return None;
    }
    let host = parsed.host_str()?.to_ascii_lowercase();
    if ALLOWED_AVATAR_HOSTS
        .iter()
        .any(|allowed| host == *allowed || host.ends_with(&format!(".{}", allowed)))
    {
        Some(parsed.to_string())
    } else {
        None
    }
}

pub fn sanitize_username(input: &str) -> String {
    input
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .take(39)
        .collect()
}

pub fn build_safe_profile_url(provider: SocialProvider, username: &str) -> String {
    let clean = sanitize_username(username);
    let handle = if clean.is_empty() { "user" } else { &clean };
    match provider {
        SocialProvider::Github => format!("https://github.com/{}", handle),
    }
}

pub fn sanitize_return_to(return_to: Option<&str>) -> String {
    let Some(raw) = return_to else {
        return "/".to_string();
    };
    let trimmed = raw.trim();
    if trimmed.starts_with('/') && !trimmed.starts_with("//") {
        return trimmed.to_string();
    }
    if let Ok(parsed) = Url::parse(trimmed) {
        if let Some(host) = parsed.host_str() {
            if host == "127.0.0.1" || host == "localhost" || host == "eval-exec.github.io" {
                return parsed.to_string();
            }
        }
    }
    "/".to_string()
}

#[derive(Debug, Default)]
pub struct AuthStore {
    pub users: HashMap<String, CafeUser>,
    pub identities: HashMap<String, SocialIdentity>,
    /// Enforces unique (provider, provider_user_id) -> internal user_id
    pub provider_index: HashMap<(SocialProvider, String), String>,
    /// Server-only OAuth tokens keyed by identity_id
    pub provider_tokens: HashMap<String, ProviderTokenRecord>,
    /// Active sessions keyed by session_id
    pub sessions: HashMap<String, SessionRecord>,
    /// Active WebSocket tokens keyed by user_id -> Set of valid ws_tokens
    pub ws_tokens: HashMap<String, HashSet<String>>,
    /// Pending OAuth 2.0 + PKCE authorization flows keyed by state
    pub pending_oauth: HashMap<String, PendingOAuthFlow>,
    /// Local OAuth 2.0 PKCE authorization codes for self-contained sandbox flows
    pub sandbox_codes: HashMap<String, SandboxAuthCode>,
}

impl AuthStore {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn start_oauth_flow(
        &mut self,
        provider: SocialProvider,
        mode: OAuthMode,
        return_to: Option<&str>,
        now_ms: u64,
    ) -> PendingOAuthFlow {
        self.pending_oauth
            .retain(|_, flow| flow.expires_at_ms > now_ms);

        let state = generate_random_token(24);
        let code_verifier = generate_random_token(32);
        let code_challenge = compute_pkce_s256_challenge(&code_verifier);
        let safe_return = sanitize_return_to(return_to);

        let flow = PendingOAuthFlow {
            state: state.clone(),
            provider,
            code_verifier,
            code_challenge,
            mode,
            return_to: safe_return,
            expires_at_ms: now_ms + OAUTH_FLOW_TTL_MS,
        };
        self.pending_oauth.insert(state, flow.clone());
        flow
    }

    pub fn issue_sandbox_code(
        &mut self,
        provider: SocialProvider,
        code_challenge: String,
        profile: ExternalProviderProfile,
        now_ms: u64,
    ) -> String {
        self.sandbox_codes.retain(|_, c| c.expires_at_ms > now_ms);
        let code = format!("authcode_{}", generate_random_token(24));
        self.sandbox_codes.insert(
            code.clone(),
            SandboxAuthCode {
                code: code.clone(),
                provider,
                code_challenge,
                profile,
                expires_at_ms: now_ms + 300_000,
            },
        );
        code
    }

    pub fn exchange_sandbox_code(
        &mut self,
        code: &str,
        code_verifier: &str,
        expected_provider: SocialProvider,
        now_ms: u64,
    ) -> Result<ExternalProviderProfile, CafeError> {
        let record = self
            .sandbox_codes
            .remove(code)
            .ok_or(CafeError::InvalidOAuthState)?;
        if record.expires_at_ms < now_ms {
            return Err(CafeError::ExpiredOAuthState);
        }
        if record.provider != expected_provider {
            return Err(CafeError::InvalidOAuthState);
        }
        if !verify_pkce_s256(code_verifier, &record.code_challenge) {
            return Err(CafeError::InvalidPkceVerifier);
        }
        Ok(record.profile)
    }

    pub fn consume_oauth_state(
        &mut self,
        state: &str,
        expected_provider: SocialProvider,
        now_ms: u64,
    ) -> Result<PendingOAuthFlow, CafeError> {
        let flow = self
            .pending_oauth
            .remove(state)
            .ok_or(CafeError::InvalidOAuthState)?;
        if flow.expires_at_ms < now_ms {
            return Err(CafeError::ExpiredOAuthState);
        }
        if flow.provider != expected_provider {
            return Err(CafeError::InvalidOAuthState);
        }
        Ok(flow)
    }

    pub fn complete_oauth_authentication(
        &mut self,
        mode: OAuthMode,
        profile: ExternalProviderProfile,
        now_ms: u64,
    ) -> Result<(SessionRecord, CafeUser, Vec<SocialIdentity>), CafeError> {
        let clean_username = sanitize_username(&profile.username);
        if clean_username.is_empty() || profile.provider_user_id.trim().is_empty() {
            return Err(CafeError::Unauthorized);
        }
        let clean_display_name = {
            let s = RoomState::sanitize_text(&profile.display_name, MAX_NAME_LENGTH);
            if s.is_empty() {
                clean_username.clone()
            } else {
                s
            }
        };
        let safe_avatar = validate_safe_avatar_url(profile.avatar_url.as_deref());
        let safe_profile_url = build_safe_profile_url(profile.provider, &clean_username);
        let provider_key = (profile.provider, profile.provider_user_id.clone());

        let user_id = match mode {
            OAuthMode::Login => {
                if let Some(existing_user_id) = self.provider_index.get(&provider_key).cloned() {
                    existing_user_id
                } else {
                    let new_user_id = format!("usr_{}", Uuid::new_v4().simple());
                    let identity_id = format!(
                        "id_{}_{}",
                        profile.provider.as_str(),
                        profile.provider_user_id
                    );
                    let new_user = CafeUser {
                        id: new_user_id.clone(),
                        display_name: clean_display_name.clone(),
                        preferred_identity_id: identity_id.clone(),
                        preferred_avatar_identity_id: Some(identity_id),
                        activity: "focusing".to_string(),
                        is_online: true,
                        avatar: AvatarConfig::default(),
                        friends: Vec::new(),
                    };
                    self.users.insert(new_user_id.clone(), new_user);
                    new_user_id
                }
            }
            OAuthMode::Link { user_id } => {
                if !self.users.contains_key(&user_id) {
                    return Err(CafeError::Unauthorized);
                }
                if let Some(existing_owner) = self.provider_index.get(&provider_key) {
                    if existing_owner != &user_id {
                        return Err(CafeError::IdentityAlreadyLinked);
                    }
                }
                user_id
            }
        };

        let identity_id = format!(
            "id_{}_{}",
            profile.provider.as_str(),
            profile.provider_user_id
        );
        let existing_is_public = self
            .identities
            .get(&identity_id)
            .map(|i| i.is_public)
            .unwrap_or(true);

        let social_identity = SocialIdentity {
            id: identity_id.clone(),
            user_id: user_id.clone(),
            provider: profile.provider,
            provider_user_id: profile.provider_user_id.clone(),
            username: clean_username,
            display_name: clean_display_name,
            avatar_url: safe_avatar,
            profile_url: safe_profile_url,
            is_public: existing_is_public,
        };

        self.identities
            .insert(identity_id.clone(), social_identity);
        self.provider_index.insert(provider_key, user_id.clone());
        self.provider_tokens.insert(
            identity_id.clone(),
            ProviderTokenRecord {
                identity_id: identity_id.clone(),
                provider: profile.provider,
                access_token: profile.access_token,
                refresh_token: profile.refresh_token,
                expires_at_ms: profile.expires_at_ms,
            },
        );

        let user = self
            .users
            .get_mut(&user_id)
            .ok_or(CafeError::Unauthorized)?;
        user.is_online = true;
        if user.preferred_identity_id.is_empty()
            || !self.identities.contains_key(&user.preferred_identity_id)
        {
            user.preferred_identity_id = identity_id.clone();
        }
        if user.preferred_avatar_identity_id.is_none() {
            user.preferred_avatar_identity_id = Some(identity_id);
        }
        let user_snapshot = user.clone();
        let user_identities = self.get_user_identities(&user_id);
        let session = self.create_session(&user_id, now_ms);

        Ok((session, user_snapshot, user_identities))
    }

    pub fn create_session(&mut self, user_id: &str, now_ms: u64) -> SessionRecord {
        self.sessions.retain(|_, s| s.expires_at_ms > now_ms);
        let session_id = format!("sess_{}", generate_random_token(28));
        let csrf_token = format!("csrf_{}", generate_random_token(24));
        let ws_token = format!("wst_{}", generate_random_token(24));

        let record = SessionRecord {
            session_id: session_id.clone(),
            user_id: user_id.to_string(),
            csrf_token,
            ws_token: ws_token.clone(),
            created_at_ms: now_ms,
            expires_at_ms: now_ms + SESSION_TTL_MS,
        };

        self.sessions.insert(session_id, record.clone());
        self.ws_tokens
            .entry(user_id.to_string())
            .or_default()
            .insert(ws_token);
        record
    }

    pub fn validate_session(
        &self,
        session_id: &str,
        now_ms: u64,
    ) -> Option<(SessionRecord, CafeUser, Vec<SocialIdentity>)> {
        let session = self.sessions.get(session_id)?;
        if session.expires_at_ms < now_ms {
            return None;
        }
        let user = self.users.get(&session.user_id)?.clone();
        let identities = self.get_user_identities(&session.user_id);
        Some((session.clone(), user, identities))
    }

    pub fn validate_csrf(
        &self,
        session_id: &str,
        csrf_token: &str,
        now_ms: u64,
    ) -> Result<String, CafeError> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or(CafeError::Unauthorized)?;
        if session.expires_at_ms < now_ms {
            return Err(CafeError::Unauthorized);
        }
        if session.csrf_token != csrf_token || csrf_token.is_empty() {
            return Err(CafeError::InvalidCsrfToken);
        }
        Ok(session.user_id.clone())
    }

    pub fn is_valid_ws_token(&self, user_id: &str, token: &str) -> bool {
        self.ws_tokens
            .get(user_id)
            .map(|set| set.contains(token))
            .unwrap_or(false)
    }

    pub fn get_user_identities(&self, user_id: &str) -> Vec<SocialIdentity> {
        let mut list: Vec<SocialIdentity> = self
            .identities
            .values()
            .filter(|i| i.user_id == user_id)
            .cloned()
            .collect();
        list.sort_by(|a, b| a.id.cmp(&b.id));
        list
    }

    pub fn resolve_public_identity_bundle(
        &self,
        user_id: &str,
    ) -> Option<(CafeUser, Option<String>, Option<SocialIdentity>, Vec<SocialIdentity>)> {
        let user = self.users.get(user_id)?.clone();
        let identities = self.get_user_identities(user_id);
        let public_identities: Vec<SocialIdentity> =
            identities.iter().filter(|i| i.is_public).cloned().collect();

        let primary_identity = identities
            .iter()
            .find(|i| i.id == user.preferred_identity_id && i.is_public)
            .cloned()
            .or_else(|| public_identities.first().cloned())
            .or_else(|| identities.first().cloned());

        let avatar_url = user
            .preferred_avatar_identity_id
            .as_ref()
            .and_then(|aid| identities.iter().find(|i| &i.id == aid))
            .and_then(|i| i.avatar_url.clone())
            .or_else(|| primary_identity.as_ref().and_then(|i| i.avatar_url.clone()));

        Some((user, avatar_url, primary_identity, public_identities))
    }

    #[allow(clippy::too_many_arguments)]
    pub fn update_preferences(
        &mut self,
        session_id: &str,
        csrf_token: &str,
        display_name: Option<String>,
        preferred_identity_id: Option<String>,
        preferred_avatar_identity_id: Option<Option<String>>,
        public_identity_ids: Option<Vec<String>>,
        activity: Option<String>,
        avatar: Option<AvatarConfig>,
        friends: Option<Vec<String>>,
        now_ms: u64,
    ) -> Result<(CafeUser, Vec<SocialIdentity>), CafeError> {
        let user_id = self.validate_csrf(session_id, csrf_token, now_ms)?;
        let user_identity_ids: HashSet<String> = self
            .get_user_identities(&user_id)
            .into_iter()
            .map(|i| i.id)
            .collect();

        if let Some(ref public_ids) = public_identity_ids {
            let public_set: HashSet<String> = public_ids.iter().cloned().collect();
            for id in &user_identity_ids {
                if let Some(ident) = self.identities.get_mut(id) {
                    ident.is_public = public_set.contains(id);
                }
            }
        }

        let user = self
            .users
            .get_mut(&user_id)
            .ok_or(CafeError::Unauthorized)?;

        if let Some(name) = display_name {
            let clean = RoomState::sanitize_text(&name, MAX_NAME_LENGTH);
            if !clean.is_empty() {
                user.display_name = clean;
            }
        }

        if let Some(pref_id) = preferred_identity_id {
            if user_identity_ids.contains(&pref_id) {
                user.preferred_identity_id = pref_id;
            } else {
                return Err(CafeError::IdentityNotFound);
            }
        }

        if let Some(pref_avatar_opt) = preferred_avatar_identity_id {
            match pref_avatar_opt {
                Some(aid) => {
                    if user_identity_ids.contains(&aid) {
                        user.preferred_avatar_identity_id = Some(aid);
                    } else {
                        return Err(CafeError::IdentityNotFound);
                    }
                }
                None => {
                    user.preferred_avatar_identity_id = None;
                }
            }
        }

        if let Some(act) = activity {
            let clean_act = RoomState::sanitize_text(&act, 24);
            if !clean_act.is_empty() {
                user.activity = clean_act;
            }
        }

        if let Some(av) = avatar {
            user.avatar = av;
        }

        if let Some(fr) = friends {
            user.friends = fr.into_iter().take(100).collect();
        }

        let updated_user = user.clone();
        let updated_identities = self.get_user_identities(&user_id);
        Ok((updated_user, updated_identities))
    }

    pub fn disconnect_identity(
        &mut self,
        session_id: &str,
        csrf_token: &str,
        identity_id: &str,
        now_ms: u64,
    ) -> Result<(CafeUser, Vec<SocialIdentity>), CafeError> {
        let user_id = self.validate_csrf(session_id, csrf_token, now_ms)?;
        let current_identities = self.get_user_identities(&user_id);
        if !current_identities.iter().any(|i| i.id == identity_id) {
            return Err(CafeError::IdentityNotFound);
        }
        if current_identities.len() <= 1 {
            return Err(CafeError::CannotDisconnectLastIdentity);
        }

        if let Some(removed) = self.identities.remove(identity_id) {
            self.provider_index
                .remove(&(removed.provider, removed.provider_user_id));
            self.provider_tokens.remove(identity_id);
        }

        let remaining = self.get_user_identities(&user_id);
        let fallback_id = remaining[0].id.clone();

        let user = self
            .users
            .get_mut(&user_id)
            .ok_or(CafeError::Unauthorized)?;
        if user.preferred_identity_id == identity_id {
            user.preferred_identity_id = fallback_id.clone();
        }
        if user.preferred_avatar_identity_id.as_deref() == Some(identity_id) {
            user.preferred_avatar_identity_id = Some(fallback_id);
        }

        Ok((user.clone(), remaining))
    }

    pub fn logout_session(
        &mut self,
        session_id: &str,
        csrf_token: &str,
        now_ms: u64,
    ) -> Result<String, CafeError> {
        let user_id = self.validate_csrf(session_id, csrf_token, now_ms)?;
        if let Some(removed_session) = self.sessions.remove(session_id) {
            if let Some(tokens) = self.ws_tokens.get_mut(&user_id) {
                tokens.remove(&removed_session.ws_token);
            }
        }
        let still_has_session = self
            .sessions
            .values()
            .any(|s| s.user_id == user_id && s.expires_at_ms > now_ms);
        if !still_has_session {
            if let Some(user) = self.users.get_mut(&user_id) {
                user.is_online = false;
            }
        }
        Ok(user_id)
    }
}

#[derive(Debug, Default)]
pub struct RoomState {
    pub room_id: String,
    pub version: u64,
    pub visitors: HashMap<String, VisitorPresence>,
    pub auth_tokens: HashMap<String, String>,
    pub seat_occupancy: HashMap<String, String>,
    pub shared_timers: HashMap<String, SharedTimerState>,
    pub recent_messages: Vec<ChatMessage>,
    pub last_reaction_ms: HashMap<String, u64>,
    pub last_chat_ms: HashMap<String, u64>,
    pub reports: Vec<(String, String, String, u64)>,
}

impl RoomState {
    pub fn new(room_id: &str) -> Self {
        Self {
            room_id: room_id.to_string(),
            version: 1,
            ..Default::default()
        }
    }

    pub fn sanitize_text(input: &str, max_len: usize) -> String {
        input
            .chars()
            .filter(|c| !c.is_control())
            .take(max_len)
            .collect::<String>()
            .trim()
            .to_string()
    }

    pub fn validate_sender(&self, user_id: &str, token: &str) -> Result<(), CafeError> {
        match self.auth_tokens.get(user_id) {
            Some(expected) if expected == token => Ok(()),
            _ => Err(CafeError::Unauthorized),
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn join_or_reconnect_with_identity(
        &mut self,
        user_id: String,
        auth_token: String,
        is_authenticated: bool,
        display_name: String,
        avatar: AvatarConfig,
        avatar_url: Option<String>,
        primary_identity: Option<SocialIdentity>,
        linked_identities: Vec<SocialIdentity>,
        activity_status: String,
        invisible: bool,
        now_ms: u64,
    ) -> Result<RoomSnapshot, CafeError> {
        let is_existing = self.visitors.contains_key(&user_id);
        if !is_existing && self.visitors.len() >= MAX_ROOM_CAPACITY {
            return Err(CafeError::RoomFull);
        }

        if is_existing && !is_authenticated {
            self.validate_sender(&user_id, &auth_token)?;
        } else {
            self.auth_tokens.insert(user_id.clone(), auth_token);
        }

        let clean_name = {
            let s = Self::sanitize_text(&display_name, MAX_NAME_LENGTH);
            if s.is_empty() {
                "Café Visitor".to_string()
            } else {
                s
            }
        };

        let previous_seat = self.visitors.get(&user_id).and_then(|v| v.seat_id.clone());
        let seat_id = if invisible || !is_authenticated {
            if let Some(ref old_seat) = previous_seat {
                self.seat_occupancy.remove(old_seat);
            }
            None
        } else {
            previous_seat
        };

        let presence = VisitorPresence {
            user_id: user_id.clone(),
            is_authenticated,
            display_name: clean_name,
            avatar,
            avatar_url: validate_safe_avatar_url(avatar_url.as_deref()),
            primary_identity,
            linked_identities,
            seat_id,
            activity_status: Self::sanitize_text(&activity_status, 24),
            focus_goal: None,
            share_focus_goal: false,
            focus_started_at_ms: None,
            invisible,
            last_heartbeat_ms: now_ms,
        };

        self.visitors.insert(user_id, presence);
        self.version += 1;
        Ok(self.snapshot(now_ms))
    }

    pub fn join_or_reconnect(
        &mut self,
        user_id: String,
        auth_token: String,
        display_name: String,
        avatar: AvatarConfig,
        activity_status: String,
        invisible: bool,
        now_ms: u64,
    ) -> Result<RoomSnapshot, CafeError> {
        self.join_or_reconnect_with_identity(
            user_id,
            auth_token,
            true,
            display_name,
            avatar,
            None,
            None,
            Vec::new(),
            activity_status,
            invisible,
            now_ms,
        )
    }

    pub fn sync_authenticated_user(
        &mut self,
        user: &CafeUser,
        avatar_url: Option<String>,
        primary_identity: Option<SocialIdentity>,
        public_identities: Vec<SocialIdentity>,
        now_ms: u64,
    ) -> Option<RoomSnapshot> {
        let visitor = self.visitors.get_mut(&user.id)?;
        visitor.is_authenticated = true;
        visitor.display_name = user.display_name.clone();
        visitor.avatar = user.avatar.clone();
        visitor.avatar_url = validate_safe_avatar_url(avatar_url.as_deref());
        visitor.primary_identity = primary_identity;
        visitor.linked_identities = public_identities;
        visitor.activity_status = user.activity.clone();
        visitor.last_heartbeat_ms = now_ms;
        self.version += 1;
        Some(self.snapshot(now_ms))
    }

    pub fn claim_seat(
        &mut self,
        user_id: &str,
        auth_token: &str,
        seat_id: Option<String>,
        now_ms: u64,
    ) -> Result<RoomSnapshot, CafeError> {
        self.validate_sender(user_id, auth_token)?;
        let is_auth = self
            .visitors
            .get(user_id)
            .ok_or(CafeError::VisitorNotFound)?
            .is_authenticated;

        if seat_id.is_some() && !is_auth {
            return Err(CafeError::AuthenticationRequired);
        }

        if let Some(ref target_seat) = seat_id {
            if !VALID_SEATS.contains(&target_seat.as_str()) {
                return Err(CafeError::InvalidSeat);
            }
            if let Some(holder) = self.seat_occupancy.get(target_seat) {
                if holder != user_id {
                    return Err(CafeError::SeatAlreadyOccupied {
                        seat_id: target_seat.clone(),
                        holder_id: holder.clone(),
                    });
                }
            }
        }

        if let Some(visitor) = self.visitors.get_mut(user_id) {
            if let Some(ref old_seat) = visitor.seat_id {
                self.seat_occupancy.remove(old_seat);
            }
            visitor.seat_id = seat_id.clone();
            visitor.last_heartbeat_ms = now_ms;
        }

        if let Some(target_seat) = seat_id {
            self.seat_occupancy.insert(target_seat, user_id.to_string());
        }

        self.version += 1;
        Ok(self.snapshot(now_ms))
    }

    pub fn heartbeat(
        &mut self,
        user_id: &str,
        auth_token: &str,
        now_ms: u64,
    ) -> Result<(), CafeError> {
        self.validate_sender(user_id, auth_token)?;
        let visitor = self
            .visitors
            .get_mut(user_id)
            .ok_or(CafeError::VisitorNotFound)?;
        visitor.last_heartbeat_ms = now_ms;
        Ok(())
    }

    pub fn evict_expired_visitors(&mut self, now_ms: u64) -> usize {
        let expired_ids: Vec<String> = self
            .visitors
            .iter()
            .filter(|(_, v)| now_ms.saturating_sub(v.last_heartbeat_ms) > PRESENCE_TIMEOUT_MS)
            .map(|(id, _)| id.clone())
            .collect();

        let count = expired_ids.len();
        if count > 0 {
            for id in expired_ids {
                self.remove_visitor(&id);
            }
            self.version += 1;
        }
        count
    }

    pub fn remove_visitor(&mut self, user_id: &str) -> Option<String> {
        let mut released_seat = None;
        if let Some(v) = self.visitors.remove(user_id) {
            if let Some(seat) = v.seat_id {
                self.seat_occupancy.remove(&seat);
                released_seat = Some(seat);
            }
            self.version += 1;
        }
        self.auth_tokens.remove(user_id);
        self.last_reaction_ms.remove(user_id);
        self.last_chat_ms.remove(user_id);
        released_seat
    }

    #[allow(clippy::too_many_arguments)]
    pub fn update_status(
        &mut self,
        user_id: &str,
        auth_token: &str,
        display_name: String,
        avatar: AvatarConfig,
        activity_status: String,
        focus_goal: Option<String>,
        share_focus_goal: bool,
        focus_started_at_ms: Option<u64>,
        invisible: bool,
        now_ms: u64,
    ) -> Result<RoomSnapshot, CafeError> {
        self.validate_sender(user_id, auth_token)?;
        let visitor = self
            .visitors
            .get_mut(user_id)
            .ok_or(CafeError::VisitorNotFound)?;

        let clean_name = Self::sanitize_text(&display_name, MAX_NAME_LENGTH);
        if !clean_name.is_empty() {
            visitor.display_name = clean_name;
        }
        visitor.avatar = avatar;
        visitor.activity_status = Self::sanitize_text(&activity_status, 24);
        visitor.share_focus_goal = share_focus_goal;
        visitor.focus_goal = if share_focus_goal {
            focus_goal.map(|g| Self::sanitize_text(&g, 80))
        } else {
            None
        };
        visitor.focus_started_at_ms = focus_started_at_ms;
        visitor.invisible = invisible;
        visitor.last_heartbeat_ms = now_ms;

        if invisible {
            if let Some(old_seat) = visitor.seat_id.take() {
                self.seat_occupancy.remove(&old_seat);
            }
        }

        self.version += 1;
        Ok(self.snapshot(now_ms))
    }

    pub fn record_reaction(
        &mut self,
        user_id: &str,
        auth_token: &str,
        target_user_id: Option<String>,
        kind: String,
        now_ms: u64,
    ) -> Result<ReactionEvent, CafeError> {
        self.validate_sender(user_id, auth_token)?;
        let sender = self
            .visitors
            .get(user_id)
            .ok_or(CafeError::VisitorNotFound)?;
        if !sender.is_authenticated {
            return Err(CafeError::AuthenticationRequired);
        }

        if let Some(&last) = self.last_reaction_ms.get(user_id) {
            if now_ms.saturating_sub(last) < REACTION_COOLDOWN_MS {
                return Err(CafeError::RateLimited);
            }
        }
        self.last_reaction_ms.insert(user_id.to_string(), now_ms);

        Ok(ReactionEvent {
            id: format!("rx-{}-{}", user_id, now_ms),
            sender_id: user_id.to_string(),
            sender_name: sender.display_name.clone(),
            target_user_id,
            kind: Self::sanitize_text(&kind, 16),
            timestamp_ms: now_ms,
        })
    }

    pub fn record_chat(
        &mut self,
        user_id: &str,
        auth_token: &str,
        table_id: String,
        text: String,
        now_ms: u64,
    ) -> Result<ChatMessage, CafeError> {
        self.validate_sender(user_id, auth_token)?;
        let sender = self
            .visitors
            .get(user_id)
            .ok_or(CafeError::VisitorNotFound)?;
        if !sender.is_authenticated {
            return Err(CafeError::AuthenticationRequired);
        }

        if text.chars().count() > MAX_CHAT_LENGTH {
            return Err(CafeError::MessageTooLong);
        }
        let cleaned = Self::sanitize_text(&text, MAX_CHAT_LENGTH);
        if cleaned.is_empty() {
            return Err(CafeError::EmptyMessage);
        }

        if let Some(&last) = self.last_chat_ms.get(user_id) {
            if now_ms.saturating_sub(last) < CHAT_COOLDOWN_MS {
                return Err(CafeError::RateLimited);
            }
        }
        self.last_chat_ms.insert(user_id.to_string(), now_ms);

        let msg = ChatMessage {
            id: format!("msg-{}-{}", user_id, now_ms),
            room_id: self.room_id.clone(),
            table_id: Self::sanitize_text(&table_id, 24),
            sender_id: user_id.to_string(),
            sender_name: sender.display_name.clone(),
            sender_avatar_url: sender.avatar_url.clone(),
            sender_provider: sender.primary_identity.as_ref().map(|i| i.provider),
            text: cleaned,
            timestamp_ms: now_ms,
        };

        self.recent_messages.push(msg.clone());
        if self.recent_messages.len() > 50 {
            self.recent_messages.remove(0);
        }
        self.version += 1;
        Ok(msg)
    }

    pub fn start_shared_timer(
        &mut self,
        user_id: &str,
        auth_token: &str,
        table_id: String,
        phase: String,
        duration_sec: u32,
        shared_goal: String,
        now_ms: u64,
    ) -> Result<SharedTimerState, CafeError> {
        self.validate_sender(user_id, auth_token)?;
        let visitor = self
            .visitors
            .get(user_id)
            .ok_or(CafeError::VisitorNotFound)?;
        if !visitor.is_authenticated {
            return Err(CafeError::AuthenticationRequired);
        }

        let clamped_duration = duration_sec.clamp(60, 7200);
        let clean_table = Self::sanitize_text(&table_id, 24);
        let existing_participants = self
            .shared_timers
            .get(&clean_table)
            .map(|t| t.participants.clone())
            .unwrap_or_default();

        let mut participants_set: HashSet<String> = existing_participants.into_iter().collect();
        participants_set.insert(user_id.to_string());
        let mut participants: Vec<String> = participants_set.into_iter().collect();
        participants.sort();

        let timer = SharedTimerState {
            table_id: clean_table.clone(),
            phase: Self::sanitize_text(&phase, 16),
            duration_sec: clamped_duration,
            started_at_ms: now_ms,
            is_running: true,
            shared_goal: Self::sanitize_text(&shared_goal, 80),
            participants,
            host_user_id: user_id.to_string(),
        };

        self.shared_timers.insert(clean_table, timer.clone());
        self.version += 1;
        Ok(timer)
    }

    pub fn join_shared_timer(
        &mut self,
        user_id: &str,
        auth_token: &str,
        table_id: &str,
        now_ms: u64,
    ) -> Result<RoomSnapshot, CafeError> {
        self.validate_sender(user_id, auth_token)?;
        let visitor = self
            .visitors
            .get(user_id)
            .ok_or(CafeError::VisitorNotFound)?;
        if !visitor.is_authenticated {
            return Err(CafeError::AuthenticationRequired);
        }
        if let Some(timer) = self.shared_timers.get_mut(table_id) {
            if !timer.participants.contains(&user_id.to_string()) {
                timer.participants.push(user_id.to_string());
            }
            self.version += 1;
        }
        Ok(self.snapshot(now_ms))
    }

    pub fn stop_shared_timer(
        &mut self,
        user_id: &str,
        auth_token: &str,
        table_id: &str,
        now_ms: u64,
    ) -> Result<RoomSnapshot, CafeError> {
        self.validate_sender(user_id, auth_token)?;
        if let Some(timer) = self.shared_timers.get_mut(table_id) {
            timer.is_running = false;
            self.version += 1;
        }
        Ok(self.snapshot(now_ms))
    }

    pub fn snapshot(&self, now_ms: u64) -> RoomSnapshot {
        let visible_visitors: Vec<VisitorPresence> = self
            .visitors
            .values()
            .filter(|v| !v.invisible)
            .cloned()
            .collect();

        RoomSnapshot {
            room_id: self.room_id.clone(),
            version: self.version,
            server_time_ms: now_ms,
            visitors: visible_visitors,
            seat_occupancy: self.seat_occupancy.clone(),
            shared_timers: self.shared_timers.clone(),
            recent_messages: self.recent_messages.clone(),
        }
    }
}

pub struct CafeHub {
    pub rooms: RwLock<HashMap<String, RoomState>>,
    pub auth: RwLock<AuthStore>,
    pub tx: broadcast::Sender<(String, ServerEvent)>,
}

impl CafeHub {
    pub fn new() -> Arc<Self> {
        let (tx, _) = broadcast::channel(512);
        Arc::new(Self {
            rooms: RwLock::new(HashMap::new()),
            auth: RwLock::new(AuthStore::new()),
            tx,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_concurrent_seat_claim_race_allows_only_one_winner() {
        let hub = CafeHub::new();
        {
            let mut rooms = hub.rooms.write().await;
            let room = rooms
                .entry("eval-exec-flagship".to_string())
                .or_insert_with(|| RoomState::new("eval-exec-flagship"));
            room.join_or_reconnect(
                "user-alice".to_string(),
                "token-alice".to_string(),
                "Alice".to_string(),
                AvatarConfig::default(),
                "focusing".to_string(),
                false,
                1000,
            )
            .unwrap();
            room.join_or_reconnect(
                "user-bob".to_string(),
                "token-bob".to_string(),
                "Bob".to_string(),
                AvatarConfig::default(),
                "coding".to_string(),
                false,
                1000,
            )
            .unwrap();
        }

        let hub_a = hub.clone();
        let hub_b = hub.clone();

        let task_a = tokio::spawn(async move {
            let mut rooms = hub_a.rooms.write().await;
            let room = rooms.get_mut("eval-exec-flagship").unwrap();
            room.claim_seat(
                "user-alice",
                "token-alice",
                Some("window-1".to_string()),
                1050,
            )
        });

        let task_b = tokio::spawn(async move {
            let mut rooms = hub_b.rooms.write().await;
            let room = rooms.get_mut("eval-exec-flagship").unwrap();
            room.claim_seat(
                "user-bob",
                "token-bob",
                Some("window-1".to_string()),
                1050,
            )
        });

        let (res_a, res_b) = tokio::join!(task_a, task_b);
        let res_a = res_a.unwrap();
        let res_b = res_b.unwrap();

        assert!(
            (res_a.is_ok() && matches!(res_b, Err(CafeError::SeatAlreadyOccupied { .. })))
                || (res_b.is_ok() && matches!(res_a, Err(CafeError::SeatAlreadyOccupied { .. })))
        );

        let rooms = hub.rooms.read().await;
        let room = rooms.get("eval-exec-flagship").unwrap();
        assert_eq!(room.seat_occupancy.len(), 1);
        assert!(room.seat_occupancy.contains_key("window-1"));
    }

    #[test]
    fn test_presence_expiry_releases_occupied_seat() {
        let mut room = RoomState::new("eval-exec-flagship");
        room.join_or_reconnect(
            "user-1".to_string(),
            "secret-1".to_string(),
            "Clara".to_string(),
            AvatarConfig::default(),
            "studying".to_string(),
            false,
            1_000,
        )
        .unwrap();

        room.claim_seat("user-1", "secret-1", Some("quiet-corner".to_string()), 2_000)
            .unwrap();
        assert_eq!(
            room.seat_occupancy.get("quiet-corner"),
            Some(&"user-1".to_string())
        );

        let evicted_early = room.evict_expired_visitors(2_000 + PRESENCE_TIMEOUT_MS - 100);
        assert_eq!(evicted_early, 0);
        assert!(room.seat_occupancy.contains_key("quiet-corner"));

        let evicted_late = room.evict_expired_visitors(2_000 + PRESENCE_TIMEOUT_MS + 1);
        assert_eq!(evicted_late, 1);
        assert!(!room.seat_occupancy.contains_key("quiet-corner"));
        assert!(!room.visitors.contains_key("user-1"));
    }

    #[test]
    fn test_authorization_and_privacy_controls() {
        let mut room = RoomState::new("eval-exec-flagship");
        room.join_or_reconnect(
            "user-1".to_string(),
            "valid-token".to_string(),
            "Eval Exec".to_string(),
            AvatarConfig::default(),
            "coding".to_string(),
            false,
            1_000,
        )
        .unwrap();

        let spoof_attempt =
            room.claim_seat("user-1", "wrong-token", Some("central-1".to_string()), 1_200);
        assert_eq!(spoof_attempt, Err(CafeError::Unauthorized));

        let snap = room
            .update_status(
                "user-1",
                "valid-token",
                "Eval Exec".to_string(),
                AvatarConfig::default(),
                "focusing".to_string(),
                Some("Secret Unpublished Project".to_string()),
                false,
                Some(1_500),
                false,
                1_500,
            )
            .unwrap();
        assert_eq!(snap.visitors[0].focus_goal, None);

        let snap_shared = room
            .update_status(
                "user-1",
                "valid-token",
                "Eval Exec".to_string(),
                AvatarConfig::default(),
                "focusing".to_string(),
                Some("Rust Axum Multiplayer Architecture".to_string()),
                true,
                Some(1_500),
                false,
                1_600,
            )
            .unwrap();
        assert_eq!(
            snap_shared.visitors[0].focus_goal,
            Some("Rust Axum Multiplayer Architecture".to_string())
        );
    }

    #[test]
    fn test_shared_timer_synchronization_and_rate_limiting() {
        let mut room = RoomState::new("eval-exec-flagship");
        room.join_or_reconnect(
            "host-1".to_string(),
            "tok-1".to_string(),
            "Alice".to_string(),
            AvatarConfig::default(),
            "studying".to_string(),
            false,
            10_000,
        )
        .unwrap();
        room.join_or_reconnect(
            "peer-2".to_string(),
            "tok-2".to_string(),
            "Bob".to_string(),
            AvatarConfig::default(),
            "studying".to_string(),
            false,
            10_000,
        )
        .unwrap();

        let timer = room
            .start_shared_timer(
                "host-1",
                "tok-1",
                "central-table".to_string(),
                "focus".to_string(),
                1500,
                "Ship multiplayer virtual cafe".to_string(),
                15_000,
            )
            .unwrap();
        assert_eq!(timer.started_at_ms, 15_000);
        assert_eq!(timer.duration_sec, 1500);
        assert!(timer.is_running);

        let snap = room
            .join_shared_timer("peer-2", "tok-2", "central-table", 20_000)
            .unwrap();
        let synced = snap.shared_timers.get("central-table").unwrap();
        assert_eq!(synced.started_at_ms, 15_000);
        assert_eq!(
            synced.participants,
            vec!["host-1".to_string(), "peer-2".to_string()]
        );

        assert!(room
            .record_reaction(
                "host-1",
                "tok-1",
                Some("peer-2".to_string()),
                "wave".to_string(),
                20_000
            )
            .is_ok());
        assert_eq!(
            room.record_reaction(
                "host-1",
                "tok-1",
                Some("peer-2".to_string()),
                "wave".to_string(),
                20_500
            ),
            Err(CafeError::RateLimited)
        );
    }

    #[test]
    fn test_oauth_pkce_account_linking_and_conflict_protection() {
        let mut store = AuthStore::new();
        let now = 50_000;

        // 1. User 1 signs in with GitHub using OAuth 2.0 + PKCE (S256)
        let gh_flow = store.start_oauth_flow(
            SocialProvider::Github,
            OAuthMode::Login,
            Some("/?scene=interior"),
            now,
        );
        let gh_profile = ExternalProviderProfile {
            provider: SocialProvider::Github,
            provider_user_id: "10001".to_string(),
            username: "eval-exec".to_string(),
            display_name: "Eval Exec".to_string(),
            avatar_url: Some("https://avatars.githubusercontent.com/u/10001?v=4".to_string()),
            profile_url: "https://github.com/eval-exec".to_string(),
            access_token: "gho_secret_token_never_exposed".to_string(),
            refresh_token: None,
            expires_at_ms: None,
        };
        let auth_code = store.issue_sandbox_code(
            SocialProvider::Github,
            gh_flow.code_challenge.clone(),
            gh_profile,
            now + 10,
        );

        // Wrong PKCE code_verifier must fail
        assert_eq!(
            store.exchange_sandbox_code(
                &auth_code,
                "wrong_verifier",
                SocialProvider::Github,
                now + 20
            ),
            Err(CafeError::InvalidPkceVerifier)
        );

        // Re-issue code and verify valid PKCE verifier succeeds
        let gh_flow2 = store.start_oauth_flow(
            SocialProvider::Github,
            OAuthMode::Login,
            Some("/?scene=interior"),
            now + 30,
        );
        let auth_code2 = store.issue_sandbox_code(
            SocialProvider::Github,
            gh_flow2.code_challenge.clone(),
            ExternalProviderProfile {
                provider: SocialProvider::Github,
                provider_user_id: "10001".to_string(),
                username: "eval-exec".to_string(),
                display_name: "Eval Exec".to_string(),
                avatar_url: Some("https://avatars.githubusercontent.com/u/10001?v=4".to_string()),
                profile_url: "https://github.com/eval-exec".to_string(),
                access_token: "gho_secret_token".to_string(),
                refresh_token: None,
                expires_at_ms: None,
            },
            now + 40,
        );
        let consumed_flow = store
            .consume_oauth_state(&gh_flow2.state, SocialProvider::Github, now + 50)
            .unwrap();
        // State replay must fail
        assert_eq!(
            store.consume_oauth_state(&gh_flow2.state, SocialProvider::Github, now + 55),
            Err(CafeError::InvalidOAuthState)
        );

        let verified_profile = store
            .exchange_sandbox_code(
                &auth_code2,
                &consumed_flow.code_verifier,
                SocialProvider::Github,
                now + 60,
            )
            .unwrap();
        let (sess1, user1, identities1) = store
            .complete_oauth_authentication(consumed_flow.mode, verified_profile, now + 70)
            .unwrap();
        assert_eq!(user1.display_name, "Eval Exec");
        assert_eq!(identities1.len(), 1);
        assert_eq!(identities1[0].provider, SocialProvider::Github);
        assert_eq!(
            identities1[0].avatar_url,
            Some("https://avatars.githubusercontent.com/u/10001?v=4".to_string())
        );

        // Cannot disconnect the only linked identity
        assert_eq!(
            store.disconnect_identity(
                &sess1.session_id,
                &sess1.csrf_token,
                &identities1[0].id,
                now + 80
            ),
            Err(CafeError::CannotDisconnectLastIdentity)
        );

        // 2. Link a second GitHub account to User 1's cafe account
        let (_, user1_after_link, identities_after_link) = store
            .complete_oauth_authentication(
                OAuthMode::Link {
                    user_id: user1.id.clone(),
                },
                ExternalProviderProfile {
                    provider: SocialProvider::Github,
                    provider_user_id: "90009".to_string(),
                    username: "eval-exec-alt".to_string(),
                    display_name: "Eval Exec Alt".to_string(),
                    avatar_url: Some(
                        "https://avatars.githubusercontent.com/u/90009?v=4".to_string(),
                    ),
                    profile_url: "https://github.com/eval-exec-alt".to_string(),
                    access_token: "gho_secret_token_2".to_string(),
                    refresh_token: None,
                    expires_at_ms: None,
                },
                now + 100,
            )
            .unwrap();
        assert_eq!(user1_after_link.id, user1.id);
        assert_eq!(identities_after_link.len(), 2);

        // 3. User 2 signs in with a different GitHub account (even with the same display name — must NOT merge!)
        let (sess2, user2, _) = store
            .complete_oauth_authentication(
                OAuthMode::Login,
                ExternalProviderProfile {
                    provider: SocialProvider::Github,
                    provider_user_id: "88888".to_string(),
                    username: "second_visitor".to_string(),
                    display_name: "Eval Exec".to_string(),
                    avatar_url: Some(
                        "https://avatars.githubusercontent.com/u/88888?v=4".to_string(),
                    ),
                    profile_url: "https://github.com/second_visitor".to_string(),
                    access_token: "gho_token_2".to_string(),
                    refresh_token: None,
                    expires_at_ms: None,
                },
                now + 120,
            )
            .unwrap();
        assert_ne!(user1.id, user2.id);

        // User 2 trying to link User 1's GitHub identity must fail with IdentityAlreadyLinked
        let conflict = store.complete_oauth_authentication(
            OAuthMode::Link {
                user_id: user2.id.clone(),
            },
            ExternalProviderProfile {
                provider: SocialProvider::Github,
                provider_user_id: "10001".to_string(),
                username: "eval-exec".to_string(),
                display_name: "Eval Exec".to_string(),
                avatar_url: None,
                profile_url: "https://github.com/eval-exec".to_string(),
                access_token: "gho_conflict".to_string(),
                refresh_token: None,
                expires_at_ms: None,
            },
            now + 130,
        );
        assert_eq!(conflict, Err(CafeError::IdentityAlreadyLinked));

        // 4. User 1 can switch preferred identity and disconnect the first identity since 2 are linked
        let alt_identity_id = "id_github_90009".to_string();
        let (updated_u1, _) = store
            .update_preferences(
                &sess1.session_id,
                &sess1.csrf_token,
                Some("Eval Exec Alt".to_string()),
                Some(alt_identity_id.clone()),
                Some(Some(alt_identity_id.clone())),
                None,
                Some("coding".to_string()),
                None,
                None,
                now + 150,
            )
            .unwrap();
        assert_eq!(updated_u1.preferred_identity_id, alt_identity_id);

        let (_, remaining_identities) = store
            .disconnect_identity(
                &sess1.session_id,
                &sess1.csrf_token,
                "id_github_10001",
                now + 160,
            )
            .unwrap();
        assert_eq!(remaining_identities.len(), 1);
        assert_eq!(remaining_identities[0].provider, SocialProvider::Github);

        // 5. Logout invalidates session
        let logged_out_uid = store
            .logout_session(&sess2.session_id, &sess2.csrf_token, now + 200)
            .unwrap();
        assert_eq!(logged_out_uid, user2.id);
        assert!(store.validate_session(&sess2.session_id, now + 205).is_none());
    }

    #[test]
    fn test_unauthenticated_preview_cannot_claim_seat_or_chat() {
        let mut room = RoomState::new("eval-exec-flagship");
        room.join_or_reconnect_with_identity(
            "preview-guest-1".to_string(),
            "preview-tok".to_string(),
            false,
            "Preview Visitor".to_string(),
            AvatarConfig::default(),
            None,
            None,
            Vec::new(),
            "focusing".to_string(),
            false,
            1_000,
        )
        .unwrap();

        assert_eq!(
            room.claim_seat(
                "preview-guest-1",
                "preview-tok",
                Some("window-1".to_string()),
                1_100
            ),
            Err(CafeError::AuthenticationRequired)
        );
        assert_eq!(
            room.record_chat(
                "preview-guest-1",
                "preview-tok",
                "lounge".to_string(),
                "Hello!".to_string(),
                1_150
            ),
            Err(CafeError::AuthenticationRequired)
        );
    }
}

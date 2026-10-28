use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

pub const MAX_ROOM_CAPACITY: usize = 30;
pub const PRESENCE_TIMEOUT_MS: u64 = 45_000;
pub const REACTION_COOLDOWN_MS: u64 = 1_200;
pub const CHAT_COOLDOWN_MS: u64 = 600;
pub const MAX_CHAT_LENGTH: usize = 280;
pub const MAX_NAME_LENGTH: usize = 28;

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
    pub display_name: String,
    pub avatar: AvatarConfig,
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
    VisitorNotFound,
    RateLimited,
    MessageTooLong,
    EmptyMessage,
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
        let is_existing = self.visitors.contains_key(&user_id);
        if !is_existing && self.visitors.len() >= MAX_ROOM_CAPACITY {
            return Err(CafeError::RoomFull);
        }

        if is_existing {
            self.validate_sender(&user_id, &auth_token)?;
        } else {
            self.auth_tokens.insert(user_id.clone(), auth_token);
        }

        let clean_name = {
            let s = Self::sanitize_text(&display_name, MAX_NAME_LENGTH);
            if s.is_empty() {
                "Café Guest".to_string()
            } else {
                s
            }
        };

        let previous_seat = self.visitors.get(&user_id).and_then(|v| v.seat_id.clone());
        let seat_id = if invisible {
            if let Some(ref old_seat) = previous_seat {
                self.seat_occupancy.remove(old_seat);
            }
            None
        } else {
            previous_seat
        };

        let presence = VisitorPresence {
            user_id: user_id.clone(),
            display_name: clean_name,
            avatar,
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

    pub fn claim_seat(
        &mut self,
        user_id: &str,
        auth_token: &str,
        seat_id: Option<String>,
        now_ms: u64,
    ) -> Result<RoomSnapshot, CafeError> {
        self.validate_sender(user_id, auth_token)?;
        if !self.visitors.contains_key(user_id) {
            return Err(CafeError::VisitorNotFound);
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

        // Release any previous seat held by this user
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

    pub fn remove_visitor(&mut self, user_id: &str) {
        if let Some(v) = self.visitors.remove(user_id) {
            if let Some(seat) = v.seat_id {
                self.seat_occupancy.remove(&seat);
            }
        }
        self.auth_tokens.remove(user_id);
        self.last_reaction_ms.remove(user_id);
        self.last_chat_ms.remove(user_id);
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
        // Privacy guarantee: only store/broadcast focus_goal if share_focus_goal is true
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
        if !self.visitors.contains_key(user_id) {
            return Err(CafeError::VisitorNotFound);
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
    pub tx: broadcast::Sender<(String, ServerEvent)>,
}

impl CafeHub {
    pub fn new() -> Arc<Self> {
        let (tx, _) = broadcast::channel(512);
        Arc::new(Self {
            rooms: RwLock::new(HashMap::new()),
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

        // Spawn two concurrent tasks racing to claim "window-1"
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

        // Exactly one must succeed and one must fail with SeatAlreadyOccupied
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

        // Before timeout: visitor is still active
        let evicted_early = room.evict_expired_visitors(2_000 + PRESENCE_TIMEOUT_MS - 100);
        assert_eq!(evicted_early, 0);
        assert!(room.seat_occupancy.contains_key("quiet-corner"));

        // After timeout: visitor is evicted and their seat is freed automatically
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

        // Spoofed token must be rejected with Unauthorized
        let spoof_attempt =
            room.claim_seat("user-1", "wrong-token", Some("central-1".to_string()), 1_200);
        assert_eq!(spoof_attempt, Err(CafeError::Unauthorized));

        // Private focus goal must not be exposed when share_focus_goal is false
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

        // When share_focus_goal is true, the sanitized focus goal is shared
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

        // Start a shared 25-minute timer at the communal table at t=15_000ms
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

        // Peer joins the same shared timer; server timestamp remains anchored at 15_000ms
        let snap = room
            .join_shared_timer("peer-2", "tok-2", "central-table", 20_000)
            .unwrap();
        let synced = snap.shared_timers.get("central-table").unwrap();
        assert_eq!(synced.started_at_ms, 15_000);
        assert_eq!(synced.participants, vec!["host-1".to_string(), "peer-2".to_string()]);

        // Reaction rate-limiting test
        assert!(room
            .record_reaction("host-1", "tok-1", Some("peer-2".to_string()), "wave".to_string(), 20_000)
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
}

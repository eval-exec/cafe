use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use eval_exec_cafe_server::{CafeHub, ClientCommand, RoomState, ServerEvent};
use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use std::{
    net::SocketAddr,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use tower_http::cors::CorsLayer;

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[tokio::main]
async fn main() {
    let hub = CafeHub::new();

    // Background task to evict expired visitors every 5 seconds
    let sweep_hub = hub.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(5));
        loop {
            interval.tick().await;
            let ts = now_ms();
            let mut rooms = sweep_hub.rooms.write().await;
            for (room_id, room) in rooms.iter_mut() {
                if room.evict_expired_visitors(ts) > 0 {
                    let snap = room.snapshot(ts);
                    let _ = sweep_hub
                        .tx
                        .send((room_id.clone(), ServerEvent::Snapshot(snap)));
                }
            }
        }
    });

    let app = Router::new()
        .route("/api/health", get(health_handler))
        .route("/ws", get(ws_handler))
        .layer(CorsLayer::permissive())
        .with_state(hub);

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3001);
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    println!("Eval Exec's Cafe Rust/Axum Multiplayer Server listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_handler(State(hub): State<Arc<CafeHub>>) -> impl IntoResponse {
    let rooms = hub.rooms.read().await;
    let total_visitors: usize = rooms.values().map(|r| r.visitors.len()).sum();
    Json(json!({
        "status": "ok",
        "server": "eval-exec-cafe-rust-axum",
        "rooms": rooms.len(),
        "totalVisitors": total_visitors,
    }))
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(hub): State<Arc<CafeHub>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, hub))
}

async fn handle_socket(socket: WebSocket, hub: Arc<CafeHub>) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = hub.tx.subscribe();

    let current_room = Arc::new(tokio::sync::Mutex::new(String::from("eval-exec-flagship")));
    let current_user = Arc::new(tokio::sync::Mutex::new(Option::<String>::None));

    let room_for_send = current_room.clone();
    let mut send_task = tokio::spawn(async move {
        while let Ok((event_room, event)) = rx.recv().await {
            let active_room = room_for_send.lock().await.clone();
            if event_room == active_room {
                if let Ok(text) = serde_json::to_string(&event) {
                    if sender.send(Message::Text(text)).await.is_err() {
                        break;
                    }
                }
            }
        }
    });

    let hub_for_recv = hub.clone();
    let room_for_recv = current_room.clone();
    let user_for_recv = current_user.clone();

    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(Message::Text(text))) = receiver.next().await {
            let Ok(cmd) = serde_json::from_str::<ClientCommand>(&text) else {
                continue;
            };
            let ts = now_ms();

            match cmd {
                ClientCommand::JoinRoom {
                    room_id,
                    user_id,
                    auth_token,
                    display_name,
                    avatar,
                    activity_status,
                    invisible,
                } => {
                    let prev_room = {
                        let mut r = room_for_recv.lock().await;
                        let old = r.clone();
                        *r = room_id.clone();
                        old
                    };
                    *user_for_recv.lock().await = Some(user_id.clone());

                    let mut rooms = hub_for_recv.rooms.write().await;
                    if prev_room != room_id {
                        if let Some(old_room_state) = rooms.get_mut(&prev_room) {
                            old_room_state.remove_visitor(&user_id);
                            let old_snap = old_room_state.snapshot(ts);
                            let _ = hub_for_recv
                                .tx
                                .send((prev_room, ServerEvent::Snapshot(old_snap)));
                        }
                    }

                    let room = rooms
                        .entry(room_id.clone())
                        .or_insert_with(|| RoomState::new(&room_id));

                    match room.join_or_reconnect(
                        user_id,
                        auth_token,
                        display_name,
                        avatar,
                        activity_status,
                        invisible,
                        ts,
                    ) {
                        Ok(snap) => {
                            let _ = hub_for_recv
                                .tx
                                .send((room_id, ServerEvent::Snapshot(snap)));
                        }
                        Err(err) => {
                            let _ = hub_for_recv.tx.send((
                                room_id,
                                ServerEvent::Error {
                                    reason: format!("{:?}", err),
                                },
                            ));
                        }
                    }
                }
                ClientCommand::Heartbeat {
                    user_id,
                    auth_token,
                } => {
                    let active_room = room_for_recv.lock().await.clone();
                    let mut rooms = hub_for_recv.rooms.write().await;
                    if let Some(room) = rooms.get_mut(&active_room) {
                        let _ = room.heartbeat(&user_id, &auth_token, ts);
                    }
                }
                ClientCommand::ClaimSeat {
                    user_id,
                    auth_token,
                    seat_id,
                } => {
                    let active_room = room_for_recv.lock().await.clone();
                    let mut rooms = hub_for_recv.rooms.write().await;
                    if let Some(room) = rooms.get_mut(&active_room) {
                        match room.claim_seat(&user_id, &auth_token, seat_id, ts) {
                            Ok(snap) => {
                                let _ = hub_for_recv
                                    .tx
                                    .send((active_room, ServerEvent::Snapshot(snap)));
                            }
                            Err(err) => {
                                let _ = hub_for_recv.tx.send((
                                    active_room,
                                    ServerEvent::Error {
                                        reason: format!("{:?}", err),
                                    },
                                ));
                            }
                        }
                    }
                }
                ClientCommand::UpdateStatus {
                    user_id,
                    auth_token,
                    display_name,
                    avatar,
                    activity_status,
                    focus_goal,
                    share_focus_goal,
                    focus_started_at_ms,
                    invisible,
                } => {
                    let active_room = room_for_recv.lock().await.clone();
                    let mut rooms = hub_for_recv.rooms.write().await;
                    if let Some(room) = rooms.get_mut(&active_room) {
                        if let Ok(snap) = room.update_status(
                            &user_id,
                            &auth_token,
                            display_name,
                            avatar,
                            activity_status,
                            focus_goal,
                            share_focus_goal,
                            focus_started_at_ms,
                            invisible,
                            ts,
                        ) {
                            let _ = hub_for_recv
                                .tx
                                .send((active_room, ServerEvent::Snapshot(snap)));
                        }
                    }
                }
                ClientCommand::SendReaction {
                    user_id,
                    auth_token,
                    target_user_id,
                    kind,
                } => {
                    let active_room = room_for_recv.lock().await.clone();
                    let mut rooms = hub_for_recv.rooms.write().await;
                    if let Some(room) = rooms.get_mut(&active_room) {
                        if let Ok(rx_event) =
                            room.record_reaction(&user_id, &auth_token, target_user_id, kind, ts)
                        {
                            let _ = hub_for_recv
                                .tx
                                .send((active_room, ServerEvent::Reaction(rx_event)));
                        }
                    }
                }
                ClientCommand::SendChat {
                    user_id,
                    auth_token,
                    table_id,
                    text,
                } => {
                    let active_room = room_for_recv.lock().await.clone();
                    let mut rooms = hub_for_recv.rooms.write().await;
                    if let Some(room) = rooms.get_mut(&active_room) {
                        if let Ok(msg) =
                            room.record_chat(&user_id, &auth_token, table_id, text, ts)
                        {
                            let _ = hub_for_recv
                                .tx
                                .send((active_room, ServerEvent::Chat(msg)));
                        }
                    }
                }
                ClientCommand::StartSharedTimer {
                    user_id,
                    auth_token,
                    table_id,
                    phase,
                    duration_sec,
                    shared_goal,
                } => {
                    let active_room = room_for_recv.lock().await.clone();
                    let mut rooms = hub_for_recv.rooms.write().await;
                    if let Some(room) = rooms.get_mut(&active_room) {
                        if room
                            .start_shared_timer(
                                &user_id,
                                &auth_token,
                                table_id,
                                phase,
                                duration_sec,
                                shared_goal,
                                ts,
                            )
                            .is_ok()
                        {
                            let snap = room.snapshot(ts);
                            let _ = hub_for_recv
                                .tx
                                .send((active_room, ServerEvent::Snapshot(snap)));
                        }
                    }
                }
                ClientCommand::JoinSharedTimer {
                    user_id,
                    auth_token,
                    table_id,
                } => {
                    let active_room = room_for_recv.lock().await.clone();
                    let mut rooms = hub_for_recv.rooms.write().await;
                    if let Some(room) = rooms.get_mut(&active_room) {
                        if let Ok(snap) =
                            room.join_shared_timer(&user_id, &auth_token, &table_id, ts)
                        {
                            let _ = hub_for_recv
                                .tx
                                .send((active_room, ServerEvent::Snapshot(snap)));
                        }
                    }
                }
                ClientCommand::StopSharedTimer {
                    user_id,
                    auth_token,
                    table_id,
                } => {
                    let active_room = room_for_recv.lock().await.clone();
                    let mut rooms = hub_for_recv.rooms.write().await;
                    if let Some(room) = rooms.get_mut(&active_room) {
                        if let Ok(snap) =
                            room.stop_shared_timer(&user_id, &auth_token, &table_id, ts)
                        {
                            let _ = hub_for_recv
                                .tx
                                .send((active_room, ServerEvent::Snapshot(snap)));
                        }
                    }
                }
                ClientCommand::ReportUser {
                    user_id,
                    auth_token,
                    reported_user_id,
                    reason,
                } => {
                    let active_room = room_for_recv.lock().await.clone();
                    let mut rooms = hub_for_recv.rooms.write().await;
                    if let Some(room) = rooms.get_mut(&active_room) {
                        if room.validate_sender(&user_id, &auth_token).is_ok() {
                            room.reports.push((
                                user_id,
                                reported_user_id,
                                RoomState::sanitize_text(&reason, 120),
                                ts,
                            ));
                        }
                    }
                }
            }
        }
    });

    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };

    // Clean up visitor upon WebSocket disconnect
    let disconnected_user = current_user.lock().await.clone();
    let disconnected_room = current_room.lock().await.clone();
    if let Some(uid) = disconnected_user {
        let mut rooms = hub.rooms.write().await;
        if let Some(room) = rooms.get_mut(&disconnected_room) {
            room.remove_visitor(&uid);
            let snap = room.snapshot(now_ms());
            let _ = hub
                .tx
                .send((disconnected_room, ServerEvent::Snapshot(snap)));
        }
    }
}

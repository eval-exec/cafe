use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    http::{header, HeaderMap, StatusCode},
    response::{Html, IntoResponse, Redirect, Response},
    routing::{delete, get, post},
    Json, Router,
};
use eval_exec_cafe_server::{
    build_safe_profile_url, sanitize_return_to, sanitize_username, validate_safe_avatar_url,
    AvatarConfig, CafeError, CafeHub, ClientCommand, ExternalProviderProfile, OAuthMode, RoomState,
    ServerEvent, SocialProvider,
};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::json;
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use tower_http::cors::CorsLayer;
use url::Url;

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn extract_session_id(headers: &HeaderMap, query_session: Option<&str>) -> Option<String> {
    if let Some(auth_val) = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
    {
        if let Some(token) = auth_val.strip_prefix("Bearer ") {
            let trimmed = token.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    if let Some(cookie_hdr) = headers.get(header::COOKIE).and_then(|v| v.to_str().ok()) {
        for part in cookie_hdr.split(';') {
            let kv = part.trim();
            if let Some(val) = kv.strip_prefix("cafe_session=") {
                if !val.is_empty() {
                    return Some(val.to_string());
                }
            }
        }
    }
    query_session
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn extract_csrf_token(headers: &HeaderMap, query_csrf: Option<&str>) -> String {
    if let Some(val) = headers.get("x-csrf-token").and_then(|v| v.to_str().ok()) {
        return val.trim().to_string();
    }
    query_csrf.unwrap_or("").trim().to_string()
}

fn build_session_cookie(session_id: &str, max_age_sec: u64) -> String {
    let secure_flag = if std::env::var("COOKIE_SECURE").ok().as_deref() == Some("true") {
        "; Secure"
    } else {
        ""
    };
    format!(
        "cafe_session={}; HttpOnly; SameSite=Lax; Path=/; Max-Age={}{}",
        session_id, max_age_sec, secure_flag
    )
}

fn append_Redirect_param(base_url: &str, key: &str, val: &str) -> String {
    if let Ok(mut parsed) = Url::parse(base_url) {
        parsed.query_pairs_mut().append_pair(key, val);
        return parsed.to_string();
    }
    let sep = if base_url.contains('?') { '&' } else { '?' };
    format!("{}{}{}={}", base_url, sep, key, urlencoding_simple(val))
}

fn urlencoding_simple(input: &str) -> String {
    let mut u = Url::parse("https://example.com").unwrap();
    u.query_pairs_mut().append_pair("v", input);
    u.query()
        .unwrap_or("")
        .strip_prefix("v=")
        .unwrap_or("")
        .to_string()
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
        .route("/api/auth/me", get(auth_me_handler))
        .route("/api/auth/logout", post(auth_logout_handler))
        .route("/api/auth/preferences", post(auth_preferences_handler))
        .route(
            "/api/auth/identities/:identity_id",
            delete(auth_disconnect_identity_handler),
        )
        .route("/api/auth/oauth/:provider/start", get(oauth_start_handler))
        .route(
            "/api/auth/oauth/:provider/callback",
            get(oauth_callback_handler),
        )
        .route("/ws", get(ws_handler))
        .layer(CorsLayer::permissive())
        .with_state(hub);

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3001);
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    println!(
        "Eval Exec's Cafe Rust/Axum Multiplayer & OAuth 2.0 PKCE Server listening on http://{}",
        addr
    );

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_handler(State(hub): State<Arc<CafeHub>>) -> impl IntoResponse {
    let rooms = hub.rooms.read().await;
    let total_visitors: usize = rooms.values().map(|r| r.visitors.len()).sum();
    Json(json!({
        "status": "ok",
        "server": "eval-exec-cafe-rust-axum",
        "oauthProviders": ["github"],
        "pkce": "S256",
        "rooms": rooms.len(),
        "totalVisitors": total_visitors,
    }))
}

async fn auth_me_handler(
    State(hub): State<Arc<CafeHub>>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> Response {
    let ts = now_ms();
    let Some(session_id) = extract_session_id(&headers, params.get("session_id").map(|s| s.as_str()))
    else {
        return Json(json!({ "authenticated": false })).into_response();
    };

    let auth = hub.auth.read().await;
    let Some((session, user, identities)) = auth.validate_session(&session_id, ts) else {
        return (
            [(header::SET_COOKIE, build_session_cookie("", 0))],
            Json(json!({ "authenticated": false })),
        )
            .into_response();
    };

    Json(json!({
        "authenticated": true,
        "user": user,
        "identities": identities,
        "csrfToken": session.csrf_token,
        "wsToken": session.ws_token,
        "sessionId": session.session_id,
    }))
    .into_response()
}

#[derive(Deserialize)]
struct OAuthStartQuery {
    mode: Option<String>,
    return_to: Option<String>,
    session_id: Option<String>,
    csrf_token: Option<String>,
    login_hint: Option<String>,
}

async fn oauth_start_handler(
    Path(provider_str): Path<String>,
    State(hub): State<Arc<CafeHub>>,
    headers: HeaderMap,
    Query(q): Query<OAuthStartQuery>,
) -> Response {
    let Some(provider) = SocialProvider::from_segment(&provider_str) else {
        return (StatusCode::BAD_REQUEST, "Unsupported OAuth provider").into_response();
    };

    let ts = now_ms();
    let safe_return = sanitize_return_to(q.return_to.as_deref());

    let mode = if q.mode.as_deref() == Some("link") {
        let Some(sess_id) = extract_session_id(&headers, q.session_id.as_deref()) else {
            let err_url = append_Redirect_param(&safe_return, "auth_error", "session_expired");
            return Redirect::to(&err_url).into_response();
        };
        let csrf = extract_csrf_token(&headers, q.csrf_token.as_deref());
        let auth = hub.auth.read().await;
        match auth.validate_csrf(&sess_id, &csrf, ts) {
            Ok(user_id) => OAuthMode::Link { user_id },
            Err(_) => {
                let err_url = append_Redirect_param(&safe_return, "auth_error", "invalid_csrf");
                return Redirect::to(&err_url).into_response();
            }
        }
    } else {
        OAuthMode::Login
    };

    let flow = {
        let mut auth = hub.auth.write().await;
        auth.start_oauth_flow(provider, mode, Some(&safe_return), ts)
    };

    let server_base = std::env::var("SERVER_PUBLIC_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:3001".to_string());
    let callback_uri = format!(
        "{}/api/auth/oauth/{}/callback",
        server_base.trim_end_matches('/'),
        provider.as_str()
    );

    match provider {
        SocialProvider::Github => {
            if let Ok(client_id) = std::env::var("GITHUB_CLIENT_ID") {
                if !client_id.trim().is_empty() {
                    let mut auth_url =
                        Url::parse("https://github.com/login/oauth/authorize").unwrap();
                    auth_url
                        .query_pairs_mut()
                        .append_pair("client_id", client_id.trim())
                        .append_pair("redirect_uri", &callback_uri)
                        .append_pair("scope", "read:user user:email")
                        .append_pair("state", &flow.state)
                        .append_pair("code_challenge", &flow.code_challenge)
                        .append_pair("code_challenge_method", "S256");
                    return Redirect::to(auth_url.as_str()).into_response();
                }
            }
        }
    }

    let err_url = append_Redirect_param(
        &safe_return,
        "auth_error",
        "GitHub OAuth App (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET) is not configured yet.",
    );
    Redirect::to(&err_url).into_response()
}

#[derive(Deserialize)]
struct OAuthCallbackQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
}

async fn oauth_callback_handler(
    Path(provider_str): Path<String>,
    State(hub): State<Arc<CafeHub>>,
    Query(q): Query<OAuthCallbackQuery>,
) -> Response {
    let Some(provider) = SocialProvider::from_segment(&provider_str) else {
        return (StatusCode::BAD_REQUEST, "Unsupported OAuth provider").into_response();
    };

    let ts = now_ms();
    let Some(state_str) = q.state.as_deref() else {
        return (StatusCode::BAD_REQUEST, "Missing OAuth state parameter").into_response();
    };

    let flow = {
        let mut auth = hub.auth.write().await;
        match auth.consume_oauth_state(state_str, provider, ts) {
            Ok(f) => f,
            Err(_) => {
                return Redirect::to("/?auth_error=invalid_or_expired_state").into_response();
            }
        }
    };

    if let Some(err_code) = q.error.as_deref() {
        let redirect_err = append_Redirect_param(&flow.return_to, "auth_error", err_code);
        return Redirect::to(&redirect_err).into_response();
    }

    let Some(code_str) = q.code.as_deref() else {
        let redirect_err = append_Redirect_param(&flow.return_to, "auth_error", "missing_code");
        return Redirect::to(&redirect_err).into_response();
    };

    let profile_result: Result<ExternalProviderProfile, CafeError> =
        if code_str.starts_with("authcode_") {
            let mut auth = hub.auth.write().await;
            auth.exchange_sandbox_code(code_str, &flow.code_verifier, provider, ts)
        } else {
            exchange_live_oauth_code(provider, code_str, &flow.code_verifier).await
        };

    let profile = match profile_result {
        Ok(p) => p,
        Err(err) => {
            let redirect_err =
                append_Redirect_param(&flow.return_to, "auth_error", &format!("{:?}", err));
            return Redirect::to(&redirect_err).into_response();
        }
    };

    let auth_outcome = {
        let mut auth = hub.auth.write().await;
        auth.complete_oauth_authentication(flow.mode, profile, ts)
    };

    match auth_outcome {
        Ok((session, user, _identities)) => {
            // Sync updated social identity to any room where this user is already present
            let bundle = {
                let auth = hub.auth.read().await;
                auth.resolve_public_identity_bundle(&user.id)
            };
            if let Some((u, av_url, primary_id, public_ids)) = bundle {
                let mut rooms = hub.rooms.write().await;
                for (room_id, room) in rooms.iter_mut() {
                    if let Some(snap) = room.sync_authenticated_user(
                        &u,
                        av_url.clone(),
                        primary_id.clone(),
                        public_ids.clone(),
                        ts,
                    ) {
                        let _ = hub.tx.send((room_id.clone(), ServerEvent::Snapshot(snap)));
                    }
                }
            }

            let target_url =
                append_Redirect_param(&flow.return_to, "auth_session", &session.session_id);
            let cookie = build_session_cookie(&session.session_id, 7 * 24 * 3600);
            ([(header::SET_COOKIE, cookie)], Redirect::to(&target_url)).into_response()
        }
        Err(err) => {
            let redirect_err =
                append_Redirect_param(&flow.return_to, "auth_error", &format!("{:?}", err));
            Redirect::to(&redirect_err).into_response()
        }
    }
}

async fn exchange_live_oauth_code(
    provider: SocialProvider,
    code: &str,
    code_verifier: &str,
) -> Result<ExternalProviderProfile, CafeError> {
    let client = reqwest::Client::builder()
        .user_agent("eval-exec-cafe-oauth/1.0")
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|_| CafeError::Unauthorized)?;

    let server_base = std::env::var("SERVER_PUBLIC_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:3001".to_string());
    let callback_uri = format!(
        "{}/api/auth/oauth/{}/callback",
        server_base.trim_end_matches('/'),
        provider.as_str()
    );

    match provider {
        SocialProvider::Github => {
            let client_id =
                std::env::var("GITHUB_CLIENT_ID").map_err(|_| CafeError::Unauthorized)?;
            let client_secret =
                std::env::var("GITHUB_CLIENT_SECRET").map_err(|_| CafeError::Unauthorized)?;

            let token_resp = client
                .post("https://github.com/login/oauth/access_token")
                .header(header::ACCEPT, "application/json")
                .json(&json!({
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "redirect_uri": callback_uri,
                    "code_verifier": code_verifier,
                }))
                .send()
                .await
                .map_err(|_| CafeError::Unauthorized)?
                .json::<serde_json::Value>()
                .await
                .map_err(|_| CafeError::Unauthorized)?;

            let access_token = token_resp
                .get("access_token")
                .and_then(|v| v.as_str())
                .ok_or(CafeError::Unauthorized)?
                .to_string();

            let user_resp = client
                .get("https://api.github.com/user")
                .header(header::AUTHORIZATION, format!("Bearer {}", access_token))
                .header(header::ACCEPT, "application/vnd.github+json")
                .send()
                .await
                .map_err(|_| CafeError::Unauthorized)?
                .json::<serde_json::Value>()
                .await
                .map_err(|_| CafeError::Unauthorized)?;

            let id = user_resp
                .get("id")
                .and_then(|v| v.as_u64())
                .ok_or(CafeError::Unauthorized)?
                .to_string();
            let login = user_resp
                .get("login")
                .and_then(|v| v.as_str())
                .ok_or(CafeError::Unauthorized)?
                .to_string();
            let name = user_resp
                .get("name")
                .and_then(|v| v.as_str())
                .filter(|s| !s.trim().is_empty())
                .unwrap_or(&login)
                .to_string();
            let mut email = user_resp
                .get("email")
                .and_then(|v| v.as_str())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty());

            if email.is_none() {
                if let Ok(emails_resp) = client
                    .get("https://api.github.com/user/emails")
                    .header(header::AUTHORIZATION, format!("Bearer {}", access_token))
                    .header(header::ACCEPT, "application/vnd.github+json")
                    .send()
                    .await
                {
                    if emails_resp.status().is_success() {
                        if let Ok(serde_json::Value::Array(emails)) =
                            emails_resp.json::<serde_json::Value>().await
                        {
                            for item in &emails {
                                let is_primary =
                                    item.get("primary").and_then(|v| v.as_bool()).unwrap_or(false);
                                let is_verified =
                                    item.get("verified").and_then(|v| v.as_bool()).unwrap_or(false);
                                if is_primary && is_verified {
                                    if let Some(em) = item.get("email").and_then(|v| v.as_str()) {
                                        if !em.trim().is_empty() {
                                            email = Some(em.trim().to_string());
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            let avatar_url = validate_safe_avatar_url(
                user_resp.get("avatar_url").and_then(|v| v.as_str()),
            );

            Ok(ExternalProviderProfile {
                provider: SocialProvider::Github,
                provider_user_id: id,
                username: login.clone(),
                display_name: name,
                email,
                avatar_url,
                profile_url: build_safe_profile_url(SocialProvider::Github, &login),
                access_token,
                refresh_token: None,
                expires_at_ms: None,
            })
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PreferencesUpdatePayload {
    display_name: Option<String>,
    preferred_identity_id: Option<String>,
    preferred_avatar_identity_id: Option<Option<String>>,
    public_identity_ids: Option<Vec<String>>,
    activity: Option<String>,
    avatar: Option<AvatarConfig>,
    friends: Option<Vec<String>>,
}

async fn auth_preferences_handler(
    State(hub): State<Arc<CafeHub>>,
    headers: HeaderMap,
    Json(payload): Json<PreferencesUpdatePayload>,
) -> Response {
    let ts = now_ms();
    let Some(session_id) = extract_session_id(&headers, None) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "Unauthorized" })),
        )
            .into_response();
    };
    let csrf = extract_csrf_token(&headers, None);

    let update_res = {
        let mut auth = hub.auth.write().await;
        auth.update_preferences(
            &session_id,
            &csrf,
            payload.display_name,
            payload.preferred_identity_id,
            payload.preferred_avatar_identity_id,
            payload.public_identity_ids,
            payload.activity,
            payload.avatar,
            payload.friends,
            ts,
        )
    };

    match update_res {
        Ok((user, identities)) => {
            let bundle = {
                let auth = hub.auth.read().await;
                auth.resolve_public_identity_bundle(&user.id)
            };
            if let Some((u, av_url, primary_id, public_ids)) = bundle {
                let mut rooms = hub.rooms.write().await;
                for (room_id, room) in rooms.iter_mut() {
                    if let Some(snap) = room.sync_authenticated_user(
                        &u,
                        av_url.clone(),
                        primary_id.clone(),
                        public_ids.clone(),
                        ts,
                    ) {
                        let _ = hub.tx.send((room_id.clone(), ServerEvent::Snapshot(snap)));
                    }
                }
            }
            Json(json!({
                "user": user,
                "identities": identities,
            }))
            .into_response()
        }
        Err(err) => (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": format!("{:?}", err) })),
        )
            .into_response(),
    }
}

async fn auth_disconnect_identity_handler(
    Path(identity_id): Path<String>,
    State(hub): State<Arc<CafeHub>>,
    headers: HeaderMap,
) -> Response {
    let ts = now_ms();
    let Some(session_id) = extract_session_id(&headers, None) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "Unauthorized" })),
        )
            .into_response();
    };
    let csrf = extract_csrf_token(&headers, None);

    let res = {
        let mut auth = hub.auth.write().await;
        auth.disconnect_identity(&session_id, &csrf, &identity_id, ts)
    };

    match res {
        Ok((user, identities)) => {
            let bundle = {
                let auth = hub.auth.read().await;
                auth.resolve_public_identity_bundle(&user.id)
            };
            if let Some((u, av_url, primary_id, public_ids)) = bundle {
                let mut rooms = hub.rooms.write().await;
                for (room_id, room) in rooms.iter_mut() {
                    if let Some(snap) = room.sync_authenticated_user(
                        &u,
                        av_url.clone(),
                        primary_id.clone(),
                        public_ids.clone(),
                        ts,
                    ) {
                        let _ = hub.tx.send((room_id.clone(), ServerEvent::Snapshot(snap)));
                    }
                }
            }
            Json(json!({
                "user": user,
                "identities": identities,
            }))
            .into_response()
        }
        Err(err) => (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": format!("{:?}", err) })),
        )
            .into_response(),
    }
}

async fn auth_logout_handler(State(hub): State<Arc<CafeHub>>, headers: HeaderMap) -> Response {
    let ts = now_ms();
    let Some(session_id) = extract_session_id(&headers, None) else {
        return (
            [(header::SET_COOKIE, build_session_cookie("", 0))],
            Json(json!({ "ok": true })),
        )
            .into_response();
    };
    let csrf = extract_csrf_token(&headers, None);

    let logout_res = {
        let mut auth = hub.auth.write().await;
        auth.logout_session(&session_id, &csrf, ts)
    };

    match logout_res {
        Ok(user_id) => {
            // Immediately remove user's active café presence and release their seat across all rooms
            let mut rooms = hub.rooms.write().await;
            for (room_id, room) in rooms.iter_mut() {
                if room.visitors.contains_key(&user_id) {
                    let released_seat = room.remove_visitor(&user_id);
                    let _ = hub.tx.send((
                        room_id.clone(),
                        ServerEvent::VisitorLeft {
                            user_id: user_id.clone(),
                            seat_id: released_seat,
                        },
                    ));
                    let snap = room.snapshot(ts);
                    let _ = hub.tx.send((room_id.clone(), ServerEvent::Snapshot(snap)));
                }
            }
            (
                [(header::SET_COOKIE, build_session_cookie("", 0))],
                Json(json!({ "ok": true, "removedUserId": user_id })),
            )
                .into_response()
        }
        Err(err) => (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": format!("{:?}", err) })),
        )
            .into_response(),
    }
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

                    // Check if this user_id + auth_token is a verified OAuth session
                    let auth_bundle = {
                        let auth = hub_for_recv.auth.read().await;
                        if auth.is_valid_ws_token(&user_id, &auth_token) {
                            auth.resolve_public_identity_bundle(&user_id)
                        } else {
                            None
                        }
                    };

                    let mut rooms = hub_for_recv.rooms.write().await;
                    if prev_room != room_id {
                        if let Some(old_room_state) = rooms.get_mut(&prev_room) {
                            let released = old_room_state.remove_visitor(&user_id);
                            let _ = hub_for_recv.tx.send((
                                prev_room.clone(),
                                ServerEvent::VisitorLeft {
                                    user_id: user_id.clone(),
                                    seat_id: released,
                                },
                            ));
                            let old_snap = old_room_state.snapshot(ts);
                            let _ = hub_for_recv
                                .tx
                                .send((prev_room, ServerEvent::Snapshot(old_snap)));
                        }
                    }

                    let room = rooms
                        .entry(room_id.clone())
                        .or_insert_with(|| RoomState::new(&room_id));

                    let join_res = if let Some((u, av_url, primary_id, public_ids)) = auth_bundle {
                        room.join_or_reconnect_with_identity(
                            u.id,
                            auth_token,
                            true,
                            u.display_name,
                            avatar,
                            av_url,
                            primary_id,
                            public_ids,
                            activity_status,
                            invisible,
                            ts,
                        )
                    } else {
                        // Unauthenticated visitor joins in read-only preview mode (invisible in social roster)
                        room.join_or_reconnect_with_identity(
                            user_id,
                            auth_token,
                            false,
                            display_name,
                            avatar,
                            None,
                            None,
                            Vec::new(),
                            activity_status,
                            true,
                            ts,
                        )
                    };

                    match join_res {
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
                        match room.record_reaction(
                            &user_id,
                            &auth_token,
                            target_user_id,
                            kind,
                            ts,
                        ) {
                            Ok(rx_event) => {
                                let _ = hub_for_recv
                                    .tx
                                    .send((active_room, ServerEvent::Reaction(rx_event)));
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
                ClientCommand::SendChat {
                    user_id,
                    auth_token,
                    table_id,
                    text,
                } => {
                    let active_room = room_for_recv.lock().await.clone();
                    let mut rooms = hub_for_recv.rooms.write().await;
                    if let Some(room) = rooms.get_mut(&active_room) {
                        match room.record_chat(&user_id, &auth_token, table_id, text, ts) {
                            Ok(msg) => {
                                let _ = hub_for_recv
                                    .tx
                                    .send((active_room, ServerEvent::Chat(msg)));
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
                            let clean_reason = RoomState::sanitize_text(&reason, 160);
                            room.reports
                                .push((user_id, reported_user_id, clean_reason, ts));
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

    // Clean up disconnected visitor immediately and broadcast VisitorLeft + Snapshot
    let uid_opt = { current_user.lock().await.clone() };
    if let Some(uid) = uid_opt {
        let active_room = current_room.lock().await.clone();
        let ts = now_ms();
        let mut rooms = hub.rooms.write().await;
        if let Some(room) = rooms.get_mut(&active_room) {
            let released = room.remove_visitor(&uid);
            let _ = hub.tx.send((
                active_room.clone(),
                ServerEvent::VisitorLeft {
                    user_id: uid,
                    seat_id: released,
                },
            ));
            let snap = room.snapshot(ts);
            let _ = hub.tx.send((active_room, ServerEvent::Snapshot(snap)));
        }
    }
}

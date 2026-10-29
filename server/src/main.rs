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
            "/api/auth/oauth/:provider/authorize",
            get(oauth_sandbox_authorize_page).post(oauth_sandbox_authorize_submit),
        )
        .route(
            "/api/auth/oauth/:provider/callback",
            get(oauth_callback_handler),
        )
        .route("/api/auth/github/login", post(github_login_handler))
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
                        .append_pair("scope", "read:user")
                        .append_pair("state", &flow.state)
                        .append_pair("code_challenge", &flow.code_challenge)
                        .append_pair("code_challenge_method", "S256");
                    return Redirect::to(auth_url.as_str()).into_response();
                }
            }
        }
    }

    // Redirect to the built-in standards-compliant OAuth 2.0 + PKCE Authorization Server
    let mut local_auth_url = Url::parse(&format!(
        "{}/api/auth/oauth/{}/authorize",
        server_base.trim_end_matches('/'),
        provider.as_str()
    ))
    .unwrap();
    local_auth_url
        .query_pairs_mut()
        .append_pair("response_type", "code")
        .append_pair("client_id", "eval-exec-cafe-oauth")
        .append_pair("redirect_uri", &callback_uri)
        .append_pair("scope", "read:user")
        .append_pair("state", &flow.state)
        .append_pair("code_challenge", &flow.code_challenge)
        .append_pair("code_challenge_method", "S256");
    if let Some(hint) = q.login_hint.as_deref() {
        if !hint.trim().is_empty() {
            local_auth_url
                .query_pairs_mut()
                .append_pair("login_hint", hint.trim());
        }
    }

    Redirect::to(local_auth_url.as_str()).into_response()
}

#[derive(Deserialize)]
struct SandboxAuthorizeQuery {
    state: String,
    code_challenge: String,
    code_challenge_method: Option<String>,
    redirect_uri: Option<String>,
    login_hint: Option<String>,
}

async fn oauth_sandbox_authorize_page(
    Path(provider_str): Path<String>,
    State(hub): State<Arc<CafeHub>>,
    Query(q): Query<SandboxAuthorizeQuery>,
) -> Response {
    let Some(provider) = SocialProvider::from_segment(&provider_str) else {
        return (StatusCode::BAD_REQUEST, "Unsupported provider").into_response();
    };
    if q.code_challenge_method.as_deref().unwrap_or("S256") != "S256" {
        return (StatusCode::BAD_REQUEST, "PKCE S256 required").into_response();
    }

    // If login_hint was passed, immediately authorize and redirect to callback
    if let Some(hint) = q.login_hint.as_deref() {
        let clean_hint = sanitize_username(hint);
        if !clean_hint.is_empty() {
            return issue_sandbox_authorization_and_redirect(
                hub,
                provider,
                &q.state,
                &q.code_challenge,
                &clean_hint,
                None,
            )
            .await;
        }
    }

    let provider_title = "GitHub";
    let default_user = "eval-exec";
    let scope_desc = "Read-only public profile (id, username, display name, avatar_url). No repository, email, or write access.";

    let html = format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sign in with {provider_title} — Eval Exec's Cafe OAuth 2.0 + PKCE</title>
  <style>
    * {{ box-sizing: border-box; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; }}
    body {{
      margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: radial-gradient(circle at 50% 25%, #2D1F18 0%, #140E0B 100%);
      color: #F7EDE2; padding: 20px;
    }}
    .card {{
      width: 100%; max-width: 440px; background: rgba(31, 21, 16, 0.96);
      border: 1px solid rgba(212, 140, 70, 0.35); border-radius: 22px;
      padding: 28px; box-shadow: 0 24px 60px rgba(0,0,0,0.65);
    }}
    .badge {{
      display: inline-flex; align-items: center; gap: 8px; font-size: 11px;
      text-transform: uppercase; letter-spacing: 0.1em; color: #F3B664;
      background: rgba(243, 182, 100, 0.12); border: 1px solid rgba(243, 182, 100, 0.3);
      padding: 4px 10px; border-radius: 999px; margin-bottom: 12px;
    }}
    h1 {{ font-size: 21px; margin: 0 0 6px 0; color: #FFF8F0; }}
    p {{ font-size: 13px; line-height: 1.5; color: #C9B39B; margin: 0 0 18px 0; }}
    label {{ display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #D8C2AA; margin-bottom: 6px; font-weight: 600; }}
    input {{
      width: 100%; padding: 11px 14px; border-radius: 12px;
      border: 1px solid rgba(212, 140, 70, 0.35); background: rgba(15, 10, 8, 0.75);
      color: #F7EDE2; font-size: 14px; margin-bottom: 14px; outline: none;
    }}
    input:focus {{ border-color: #F3B664; }}
    .presets {{ display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }}
    .preset-btn {{
      background: rgba(255,255,255,0.05); border: 1px solid rgba(212, 140, 70, 0.22);
      color: #E5D1B8; border-radius: 999px; padding: 4px 10px; font-size: 11px; cursor: pointer;
    }}
    .preset-btn:hover {{ border-color: #F3B664; color: #FFF; }}
    .scope-box {{
      background: rgba(15, 10, 8, 0.55); border: 1px solid rgba(212, 140, 70, 0.2);
      border-radius: 12px; padding: 10px 12px; font-size: 11.5px; color: #B8A28B; margin-bottom: 18px;
    }}
    .actions {{ display: flex; gap: 10px; }}
    .btn-primary {{
      flex: 1; padding: 12px 16px; border-radius: 12px; border: none;
      background: linear-gradient(135deg, #E29642 0%, #C47122 100%);
      color: #1A110B; font-weight: 700; font-size: 13.5px; cursor: pointer;
    }}
    .btn-cancel {{
      padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(212, 140, 70, 0.28);
      background: transparent; color: #C9B39B; font-size: 13px; text-decoration: none; display: inline-flex; align-items: center;
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">OAuth 2.0 • PKCE (S256) Verified</div>
    <h1>Continue with {provider_title}</h1>
    <p>Sign in to <strong>Eval Exec's Cafe</strong> with your {provider_title} identity to display your real profile picture and claim seats in the café.</p>
    <form method="POST" action="/api/auth/oauth/{provider_slug}/authorize">
      <input type="hidden" name="state" value="{state}" />
      <input type="hidden" name="code_challenge" value="{code_challenge}" />
      <label for="username">{provider_title} Username</label>
      <input id="username" name="username" value="{default_user}" required placeholder="e.g. eval-exec" />
      <div class="presets">
        <button type="button" class="preset-btn" onclick="document.getElementById('username').value='eval-exec'; document.getElementById('display_name').value='Eval Exec';">@eval-exec</button>
        <button type="button" class="preset-btn" onclick="document.getElementById('username').value='torvalds'; document.getElementById('display_name').value='Linus Torvalds';">@torvalds</button>
        <button type="button" class="preset-btn" onclick="document.getElementById('username').value='gaearon'; document.getElementById('display_name').value='Dan Abramov';">@gaearon</button>
        <button type="button" class="preset-btn" onclick="document.getElementById('username').value='yyx990803'; document.getElementById('display_name').value='Evan You';">@yyx990803</button>
      </div>
      <label for="display_name">Display Name (Optional)</label>
      <input id="display_name" name="display_name" value="Eval Exec" placeholder="Display Name" />
      <div class="scope-box">
        <strong>Permissions requested:</strong><br/>{scope_desc}
      </div>
      <div class="actions">
        <a class="btn-cancel" href="/api/auth/oauth/{provider_slug}/callback?error=access_denied&state={state}">Cancel</a>
        <button type="submit" class="btn-primary">Authorize {provider_title}</button>
      </div>
    </form>
  </div>
</body>
</html>"#,
        provider_title = provider_title,
        provider_slug = provider.as_str(),
        state = q.state,
        code_challenge = q.code_challenge,
        default_user = default_user,
        scope_desc = scope_desc,
    );

    Html(html).into_response()
}

#[derive(Deserialize)]
struct SandboxAuthorizeForm {
    state: String,
    code_challenge: String,
    username: String,
    display_name: Option<String>,
}

async fn oauth_sandbox_authorize_submit(
    Path(provider_str): Path<String>,
    State(hub): State<Arc<CafeHub>>,
    axum::Form(form): axum::Form<SandboxAuthorizeForm>,
) -> Response {
    let Some(provider) = SocialProvider::from_segment(&provider_str) else {
        return (StatusCode::BAD_REQUEST, "Unsupported provider").into_response();
    };
    issue_sandbox_authorization_and_redirect(
        hub,
        provider,
        &form.state,
        &form.code_challenge,
        &form.username,
        form.display_name.as_deref(),
    )
    .await
}

async fn issue_sandbox_authorization_and_redirect(
    hub: Arc<CafeHub>,
    provider: SocialProvider,
    state: &str,
    code_challenge: &str,
    raw_username: &str,
    raw_display_name: Option<&str>,
) -> Response {
    let username = sanitize_username(raw_username);
    if username.is_empty() {
        return Redirect::to(&format!(
            "/api/auth/oauth/{}/callback?error=invalid_request&state={}",
            provider.as_str(),
            urlencoding_simple(state)
        ))
        .into_response();
    }

    // Attempt live public GitHub API profile resolution for real GitHub user ID, name, avatar_url, and email
    let (resolved_id, resolved_name, resolved_email, resolved_avatar) =
        resolve_github_profile_and_email(&username, raw_display_name).await;

    let profile = ExternalProviderProfile {
        provider,
        provider_user_id: resolved_id,
        username: username.clone(),
        display_name: resolved_name,
        email: resolved_email,
        avatar_url: resolved_avatar,
        profile_url: build_safe_profile_url(provider, &username),
        access_token: format!("oauth_tok_{}_{}", provider.as_str(), now_ms()),
        refresh_token: None,
        expires_at_ms: None,
    };

    let code = {
        let mut auth = hub.auth.write().await;
        auth.issue_sandbox_code(provider, code_challenge.to_string(), profile, now_ms())
    };

    let callback_url = format!(
        "/api/auth/oauth/{}/callback?code={}&state={}",
        provider.as_str(),
        urlencoding_simple(&code),
        urlencoding_simple(state)
    );
    Redirect::to(&callback_url).into_response()
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
            let email = user_resp
                .get("email")
                .and_then(|v| v.as_str())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty());
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

async fn resolve_github_profile_and_email(
    username: &str,
    raw_display_name: Option<&str>,
) -> (String, String, Option<String>, Option<String>) {
    let mut resolved_id = format!("github_{}", username.to_ascii_lowercase());
    let mut resolved_name = raw_display_name
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| username.to_string());
    let mut resolved_email: Option<String> = None;
    let mut resolved_avatar = Some(format!("https://github.com/{}.png?size=160", username));

    if let Ok(client) = reqwest::Client::builder()
        .user_agent("eval-exec-cafe-oauth/1.0")
        .timeout(std::time::Duration::from_millis(3200))
        .build()
    {
        if let Ok(resp) = client
            .get(format!("https://api.github.com/users/{}", username))
            .send()
            .await
        {
            if resp.status().is_success() {
                if let Ok(gh_json) = resp.json::<serde_json::Value>().await {
                    if let Some(id_num) = gh_json.get("id").and_then(|v| v.as_u64()) {
                        resolved_id = id_num.to_string();
                    }
                    if raw_display_name.map(|s| s.trim().is_empty()).unwrap_or(true) {
                        if let Some(name_str) = gh_json.get("name").and_then(|v| v.as_str()) {
                            if !name_str.trim().is_empty() {
                                resolved_name = name_str.trim().to_string();
                            }
                        }
                    }
                    if let Some(em) = gh_json.get("email").and_then(|v| v.as_str()) {
                        if !em.trim().is_empty() {
                            resolved_email = Some(em.trim().to_string());
                        }
                    }
                    if let Some(av) = gh_json.get("avatar_url").and_then(|v| v.as_str()) {
                        resolved_avatar = validate_safe_avatar_url(Some(av));
                    }
                }
            }
        }

        // If public profile email is null, inspect public push events for commit author email
        if resolved_email.is_none() {
            if let Ok(ev_resp) = client
                .get(format!(
                    "https://api.github.com/users/{}/events/public?per_page=15",
                    username
                ))
                .send()
                .await
            {
                if ev_resp.status().is_success() {
                    if let Ok(serde_json::Value::Array(events)) =
                        ev_resp.json::<serde_json::Value>().await
                    {
                        'outer: for ev in events {
                            if let Some(commits) = ev
                                .get("payload")
                                .and_then(|p| p.get("commits"))
                                .and_then(|c| c.as_array())
                            {
                                for c in commits {
                                    if let Some(em) = c
                                        .get("author")
                                        .and_then(|a| a.get("email"))
                                        .and_then(|e| e.as_str())
                                    {
                                        let trimmed = em.trim();
                                        if trimmed.contains('@')
                                            && !trimmed.ends_with("users.noreply.github.com")
                                        {
                                            resolved_email = Some(trimmed.to_string());
                                            break 'outer;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    (resolved_id, resolved_name, resolved_email, resolved_avatar)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GithubLoginPayload {
    username: String,
    display_name: Option<String>,
}

async fn github_login_handler(
    State(hub): State<Arc<CafeHub>>,
    Json(payload): Json<GithubLoginPayload>,
) -> Response {
    let username = sanitize_username(&payload.username);
    if username.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "invalid_username" })),
        )
            .into_response();
    }

    let (resolved_id, resolved_name, resolved_email, resolved_avatar) =
        resolve_github_profile_and_email(&username, payload.display_name.as_deref()).await;

    let profile = ExternalProviderProfile {
        provider: SocialProvider::Github,
        provider_user_id: resolved_id,
        username: username.clone(),
        display_name: resolved_name,
        email: resolved_email,
        avatar_url: resolved_avatar,
        profile_url: build_safe_profile_url(SocialProvider::Github, &username),
        access_token: format!("gh_pub_{}_{}", username, now_ms()),
        refresh_token: None,
        expires_at_ms: None,
    };

    finalize_github_profile_session(&hub, profile).await
}

async fn finalize_github_profile_session(
    hub: &Arc<CafeHub>,
    profile: ExternalProviderProfile,
) -> Response {
    let ts = now_ms();
    let outcome = {
        let mut auth = hub.auth.write().await;
        auth.complete_oauth_authentication(OAuthMode::Login, profile, ts)
    };

    match outcome {
        Ok((session, user, identities)) => {
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
            let cookie = build_session_cookie(&session.session_id, 7 * 24 * 3600);
            (
                [(header::SET_COOKIE, cookie)],
                Json(json!({
                    "status": "authenticated",
                    "authenticated": true,
                    "user": user,
                    "identities": identities,
                    "csrfToken": session.csrf_token,
                    "wsToken": session.ws_token,
                    "sessionId": session.session_id,
                })),
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

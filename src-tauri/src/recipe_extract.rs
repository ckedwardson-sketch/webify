// Pulls "just the recipe" out of an arbitrary recipe URL — the same
// approach sites like justtherecipe.com use: almost every recipe site
// embeds a schema.org Recipe block as JSON-LD (a <script
// type="application/ld+json"> tag) for Google's benefit, so instead of
// scraping visible markup we read that structured data directly.
//
// GETTING THE HTML: a plain reqwest fetch (fetch_via_http, below) gets
// blocked outright (402/403/429) by nearly every real recipe site's
// anti-bot layer (Cloudflare/Akamai) — confirmed by testing the same
// URLs with both rustls-tls and native-tls reqwest backends and seeing
// identical blocks that a normal browser (or even plain curl, using the
// same Windows Schannel TLS stack) sails through. That's a TLS/JA3
// fingerprinting problem, not a header or parsing one, and it's not
// realistically fixable by tuning reqwest's request shape.
//
// So on desktop, fetch_via_webview is tried first: it opens the URL in
// a real (hidden) Tauri webview window — an actual browser engine, so
// it's indistinguishable from normal browsing to any anti-bot layer —
// and once the page loads, evaluates a small script that collects the
// page's own <script type="application/ld+json"> tags and hands them
// back via eval_with_callback. fetch_via_http (the original plain-fetch
// approach) is kept as the fallback for mobile (where opening arbitrary
// hidden webview windows isn't part of this app's supported pattern)
// and for the rare case the webview path itself fails.
//
// Deliberately regex-based for the HTTP-fallback path rather than a
// full HTML parser (html5ever/scraper) — see Cargo.toml's opt-level
// note about this machine's limited RAM during release builds; a real
// parser is heavier to build.

use regex::Regex;
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;

#[derive(Serialize)]
pub struct ExtractedRecipe {
    pub title: String,
    pub text: String,
}

fn client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        )
        .build()
        .map_err(|e| e.to_string())
}

fn html_unescape(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
}

fn page_title(html: &str) -> Option<String> {
    let re = Regex::new(r"(?is)<title[^>]*>(.*?)</title>").ok()?;
    let caps = re.captures(html)?;
    let raw = caps.get(1)?.as_str();
    let title = html_unescape(raw.trim());
    if title.is_empty() {
        None
    } else {
        Some(title)
    }
}

// Recipe sites nest the Recipe object differently: a bare object, an
// object inside a top-level array, or an object inside a "@graph"
// array — this hunts recursively for whichever one it is.
fn find_recipe(value: &Value) -> Option<&Value> {
    match value {
        Value::Object(map) => {
            if let Some(t) = map.get("@type") {
                let is_recipe = match t {
                    Value::String(s) => s.eq_ignore_ascii_case("recipe"),
                    Value::Array(arr) => arr
                        .iter()
                        .any(|v| v.as_str().map(|s| s.eq_ignore_ascii_case("recipe")).unwrap_or(false)),
                    _ => false,
                };
                if is_recipe {
                    return Some(value);
                }
            }
            if let Some(graph) = map.get("@graph") {
                if let Some(found) = find_recipe(graph) {
                    return Some(found);
                }
            }
            None
        }
        Value::Array(items) => items.iter().find_map(find_recipe),
        _ => None,
    }
}

// Flattens recipeIngredient/recipeInstructions shapes into plain lines:
// a bare string, an array of strings, an array of HowToStep { text },
// or an array of HowToSection { name, itemListElement: [...] }.
fn as_string_list(value: &Value) -> Vec<String> {
    match value {
        Value::String(s) => s
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .collect(),
        Value::Array(items) => items.iter().flat_map(as_string_list).collect(),
        Value::Object(map) => {
            if let Some(text) = map.get("text").and_then(|v| v.as_str()) {
                return vec![text.trim().to_string()];
            }
            if let Some(items) = map.get("itemListElement") {
                let mut out = Vec::new();
                if let Some(name) = map.get("name").and_then(|v| v.as_str()) {
                    out.push(format!("— {} —", name));
                }
                out.extend(as_string_list(items));
                return out;
            }
            Vec::new()
        }
        _ => Vec::new(),
    }
}

fn first_string(value: &Value) -> Option<String> {
    match value {
        Value::String(s) => Some(s.clone()),
        Value::Array(items) => items.iter().find_map(first_string),
        _ => None,
    }
}

// "PT20M" -> "20 min", "PT1H30M" -> "1 hr 30 min". Anything this
// simple parser doesn't recognize is passed through as-is.
fn friendly_duration(iso: &str) -> String {
    let re = match Regex::new(r"^PT(?:(\d+)H)?(?:(\d+)M)?$") {
        Ok(r) => r,
        Err(_) => return iso.to_string(),
    };
    if let Some(caps) = re.captures(iso) {
        let hours: u32 = caps.get(1).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
        let minutes: u32 = caps.get(2).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
        let mut parts = Vec::new();
        if hours > 0 {
            parts.push(format!("{} hr", hours));
        }
        if minutes > 0 {
            parts.push(format!("{} min", minutes));
        }
        if !parts.is_empty() {
            return parts.join(" ");
        }
    }
    iso.to_string()
}

fn format_recipe(recipe: &Value) -> (String, String) {
    let title = recipe
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    let mut out = String::new();

    if let Some(desc) = recipe.get("description").and_then(|v| v.as_str()) {
        let desc = desc.trim();
        if !desc.is_empty() {
            out.push_str(desc);
            out.push_str("\n\n");
        }
    }

    let mut meta: Vec<String> = Vec::new();
    if let Some(y) = recipe.get("recipeYield").and_then(first_string) {
        meta.push(format!("Yield: {}", y));
    }
    if let Some(p) = recipe.get("prepTime").and_then(|v| v.as_str()) {
        meta.push(format!("Prep: {}", friendly_duration(p)));
    }
    if let Some(c) = recipe.get("cookTime").and_then(|v| v.as_str()) {
        meta.push(format!("Cook: {}", friendly_duration(c)));
    }
    if let Some(t) = recipe.get("totalTime").and_then(|v| v.as_str()) {
        meta.push(format!("Total: {}", friendly_duration(t)));
    }
    if !meta.is_empty() {
        out.push_str(&meta.join("  •  "));
        out.push_str("\n\n");
    }

    let ingredients = recipe
        .get("recipeIngredient")
        .or_else(|| recipe.get("ingredients"))
        .map(as_string_list)
        .unwrap_or_default();
    if !ingredients.is_empty() {
        out.push_str("Ingredients:\n");
        for ing in &ingredients {
            out.push_str("- ");
            out.push_str(ing);
            out.push('\n');
        }
        out.push('\n');
    }

    let instructions = recipe
        .get("recipeInstructions")
        .map(as_string_list)
        .unwrap_or_default();
    if !instructions.is_empty() {
        out.push_str("Instructions:\n");
        let mut step_num = 1;
        for step in &instructions {
            if let Some(heading) = step.strip_prefix('—') {
                out.push_str("—");
                out.push_str(heading);
                out.push('\n');
            } else {
                out.push_str(&format!("{}. {}\n", step_num, step));
                step_num += 1;
            }
        }
    }

    (title, out.trim_end().to_string())
}

// Shared by both fetch paths: given the raw text of each <script
// type="application/ld+json"> tag found on the page (already JSON —
// no HTML-entity unescaping needed by the time either path calls this),
// finds a Recipe object among them and formats it, or explains why not.
fn build_extracted(ld_json_blocks: &[String], fallback_title: String) -> Result<ExtractedRecipe, String> {
    let mut recipe_json: Option<Value> = None;
    for raw in ld_json_blocks {
        if let Ok(value) = serde_json::from_str::<Value>(raw) {
            if let Some(found) = find_recipe(&value) {
                recipe_json = Some(found.clone());
                break;
            }
        }
    }

    match recipe_json {
        Some(recipe) => {
            let (title, text) = format_recipe(&recipe);
            let title = if title.is_empty() { fallback_title } else { title };
            if text.is_empty() {
                Err(format!(
                    "Found a recipe on \"{}\" but it had no ingredients or steps to pull.",
                    title
                ))
            } else {
                Ok(ExtractedRecipe { title, text })
            }
        }
        None => Err(format!(
            "No recipe data found on \"{}\" — this site may not publish structured recipe data.",
            fallback_title
        )),
    }
}

// The original plain-HTTP-fetch approach — kept as the fallback path
// (mobile, or if the webview path below fails) even though it gets
// blocked by most sites' anti-bot layers. See the module doc comment.
fn fetch_via_http(url: &str) -> Result<ExtractedRecipe, String> {
    let resp = client()?
        .get(url)
        .header("Accept", "text/html,application/xhtml+xml")
        .send()
        .map_err(|e| format!("Couldn't reach that page: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("That page returned an error (status {})", resp.status()));
    }

    let html = resp.text().map_err(|e| e.to_string())?;
    let fallback_title = page_title(&html).unwrap_or_else(|| url.to_string());

    let script_re = Regex::new(r#"(?is)<script[^>]+type=["']application/ld\+json["'][^>]*>(.*?)</script>"#)
        .map_err(|e| e.to_string())?;

    let blocks: Vec<String> = script_re
        .captures_iter(&html)
        .map(|caps| html_unescape(caps.get(1).map(|m| m.as_str()).unwrap_or("")))
        .collect();

    build_extracted(&blocks, fallback_title)
}

#[cfg(desktop)]
mod webview_fetch {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::mpsc;
    use std::sync::Mutex;
    use tauri::webview::PageLoadEvent;
    use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};

    // The script run inside the hidden window once it finishes loading —
    // collects every JSON-LD block plus the page's own title (which
    // schema.org data sometimes omits) and returns them as one JSON
    // string, which eval_with_callback then re-serializes as its String
    // callback argument (so the Rust side unwraps a JSON string twice).
    const EXTRACT_JS: &str = r#"(function() {
      try {
        var scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(function(s){ return s.textContent; });
        return JSON.stringify({ title: document.title || "", scripts: scripts });
      } catch (e) {
        return JSON.stringify({ title: document.title || "", scripts: [], error: String(e) });
      }
    })()"#;

    fn next_label() -> String {
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        format!("recipe-extract-{}", COUNTER.fetch_add(1, Ordering::SeqCst))
    }

    pub fn fetch(app: &AppHandle, url: &str) -> Result<ExtractedRecipe, String> {
        let parsed = tauri::Url::parse(url).map_err(|e| e.to_string())?;
        let (tx, rx) = mpsc::channel::<String>();
        let tx = Mutex::new(Some(tx));

        log::debug!("recipe_extract: opening hidden webview for {url}");
        let window = WebviewWindowBuilder::new(app, next_label(), WebviewUrl::External(parsed))
            .visible(false)
            .inner_size(1000.0, 800.0)
            .on_page_load(move |window, payload| {
                log::debug!("recipe_extract: page_load event {:?}", payload.event());
                if !matches!(payload.event(), PageLoadEvent::Finished) {
                    return;
                }
                // Fn, not FnOnce — on_page_load fires for both Started and
                // Finished, so guard against sending more than once.
                let sender = tx.lock().ok().and_then(|mut guard| guard.take());
                if let Some(sender) = sender {
                    log::debug!("recipe_extract: page finished loading, running extraction script");
                    let _ = window.eval_with_callback(EXTRACT_JS, move |result| {
                        log::debug!("recipe_extract: extraction script returned a result");
                        let _ = sender.send(result);
                    });
                }
            })
            .build()
            .map_err(|e| format!("Couldn't open a page-fetch window: {}", e))?;
        log::debug!("recipe_extract: webview window created, waiting for page load");

        let raw = rx.recv_timeout(Duration::from_secs(20));
        let _ = window.close();
        let raw = raw.map_err(|_| "Timed out waiting for the page to load.".to_string())?;

        // eval_with_callback JSON-serializes whatever the script returned —
        // our script already returned a JSON string, so this first parse
        // just unwraps that outer quoting/escaping back to plain text.
        let inner: String = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
        let payload: Value = serde_json::from_str(&inner).map_err(|e| e.to_string())?;

        let title = payload
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let scripts: Vec<String> = payload
            .get("scripts")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();

        let fallback_title = if title.is_empty() { url.to_string() } else { title };
        build_extracted(&scripts, fallback_title)
    }
}

// Must be `async` (not a plain blocking fn): a non-async #[tauri::command]
// runs INLINE on the thread that received the IPC message, which is the
// main event-loop thread. WebviewWindowBuilder::build() needs to dispatch
// window-creation work back onto that same main thread and wait for it —
// so if this command itself were occupying the main thread, that wait
// would deadlock forever with no error and no timeout (exactly the
// "stuck on Pulling..." symptom this was rewritten to fix). Making the
// command async lets Tauri run it via the async runtime instead, and
// spawn_blocking below hands the actual blocking work (mpsc recv, sync
// reqwest, window build) to a dedicated blocking-pool thread so neither
// the main thread nor an async worker thread is ever blocked by it.
#[tauri::command]
pub async fn fetch_recipe_from_url(app: tauri::AppHandle, url: String) -> Result<ExtractedRecipe, String> {
    log::debug!("recipe_extract: fetch_recipe_from_url called for {url}");
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(desktop)]
        {
            match webview_fetch::fetch(&app, &url) {
                Ok(extracted) => return Ok(extracted),
                Err(webview_err) => {
                    log::warn!("recipe_extract: webview fetch failed ({webview_err}), falling back to direct HTTP fetch");
                    return fetch_via_http(&url)
                        .map_err(|http_err| format!("{webview_err} (direct fetch also failed: {http_err})"));
                }
            }
        }
        #[cfg(mobile)]
        {
            let _ = &app;
            fetch_via_http(&url)
        }
    })
    .await
    .map_err(|e| format!("Internal error while fetching the recipe: {e}"))?
}

// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{
    AppHandle, Manager, State, SystemTray, SystemTrayEvent, SystemTrayMenu, CustomMenuItem,
};

// ─── Shared state ────────────────────────────────────────────────────────────

struct CvProcess(Arc<Mutex<Option<tauri::api::process::CommandChild>>>);

// ─── Tauri commands ──────────────────────────────────────────────────────────

/// Start the Python CV sidecar and wire its stdout → Tauri events.
#[tauri::command]
async fn start_cv_service(
    app: AppHandle,
    state: State<'_, CvProcess>,
) -> Result<(), String> {
    let mut lock = state.0.lock().unwrap();
    if lock.is_some() {
        return Ok(()); // already running
    }

    let (mut rx, child) = tauri::api::process::Command::new_sidecar("posture-cv")
        .map_err(|e| e.to_string())?
        .spawn()
        .map_err(|e| e.to_string())?;

    *lock = Some(child);
    drop(lock);

    // Forward stdout JSON lines as typed Tauri events to the window.
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                tauri::api::process::CommandEvent::Stdout(line) => {
                    // Each line is a JSON object with a "type" field.
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&line) {
                        let event_name = val
                            .get("type")
                            .and_then(|t| t.as_str())
                            .unwrap_or("cv_event")
                            .to_string();
                        let _ = app.emit_all(&event_name, &val);
                    }
                }
                tauri::api::process::CommandEvent::Stderr(line) => {
                    eprintln!("[cv-sidecar] {}", line);
                }
                _ => {}
            }
        }
    });

    Ok(())
}

/// Send a JSON command to the Python sidecar via stdin.
#[tauri::command]
async fn send_cv_command(
    state: State<'_, CvProcess>,
    command: serde_json::Value,
) -> Result<(), String> {
    let mut lock = state.0.lock().unwrap();
    if let Some(child) = lock.as_mut() {
        let line = serde_json::to_string(&command).map_err(|e| e.to_string())? + "\n";
        child.write(line.as_bytes()).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("CV service not running".into())
    }
}

/// Stop the Python CV sidecar.
#[tauri::command]
async fn stop_cv_service(state: State<'_, CvProcess>) -> Result<(), String> {
    let mut lock = state.0.lock().unwrap();
    if let Some(mut child) = lock.take() {
        child.kill().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ─── Main ────────────────────────────────────────────────────────────────────

fn main() {
    let tray_menu = SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("open", "Open PostureXP"))
        .add_item(CustomMenuItem::new("quit", "Quit"));

    let tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .manage(CvProcess(Arc::new(Mutex::new(None))))
        .system_tray(tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "open" => {
                    if let Some(win) = app.get_window("main") {
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                }
                "quit" => std::process::exit(0),
                _ => {}
            },
            SystemTrayEvent::LeftClick { .. } => {
                if let Some(win) = app.get_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            _ => {}
        })
        .on_window_event(|event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event.event() {
                // Minimize to tray instead of quitting
                event.window().hide().unwrap();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            start_cv_service,
            send_cv_command,
            stop_cv_service,
        ])
        .run(tauri::generate_context!())
        .expect("error while running PostureXP");
}

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

mod sync_engine;

#[tauri::command]
async fn start_sync(
    source_path: String,
    dest_type: String,
    dest_config: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    sync_engine::start_sync(source_path, dest_type, dest_config, app).await
}

#[tauri::command]
async fn stop_sync(sync_id: String) -> Result<(), String> {
    sync_engine::stop_sync(&sync_id).await
}

#[tauri::command]
async fn get_sync_status() -> Result<Vec<sync_engine::SyncStatus>, String> {
    sync_engine::get_all_status().await
}

#[tauri::command]
async fn check_rclone() -> Result<bool, String> {
    sync_engine::check_rclone_installed().await
}

#[tauri::command]
async fn get_rclone_version() -> Result<String, String> {
    sync_engine::get_rclone_version().await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Setup system tray
            let show = MenuItem::with_id(app, "show", "Buka Sisbackup", true, None::<&str>)?;
            let sync_item = MenuItem::with_id(app, "force_sync", "Sync Sekarang", true, None::<&str>)?;
            let pause_item = MenuItem::with_id(app, "pause", "Pause Sync", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Keluar", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show, &sync_item, &pause_item, &quit])?;

            let tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Sisbackup - Backup Sekolah")
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "force_sync" => {
                        // Will emit event to frontend to trigger sync
                        let _ = app.emit("tray-force-sync", ());
                    }
                    "pause" => {
                        let _ = app.emit("tray-pause", ());
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_sync,
            stop_sync,
            get_sync_status,
            check_rclone,
            get_rclone_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Sisbackup client");
}

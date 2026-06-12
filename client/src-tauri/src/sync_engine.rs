use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::AppHandle;
use tokio::process::Command;
use uuid::Uuid;

static ACTIVE_SYNCS: Mutex<Option<HashMap<String, SyncTask>>> = Mutex::new(None);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub id: String,
    pub source_path: String,
    pub dest_label: String,
    pub progress: f32,
    pub state: String, // idle, syncing, paused, error, completed
    pub files_done: u32,
    pub files_total: u32,
    pub bytes_done: u64,
    pub bytes_total: u64,
    pub error_message: Option<String>,
}

struct SyncTask {
    status: SyncStatus,
    child: Option<tokio::process::Child>,
}

pub async fn start_sync(
    source_path: String,
    dest_type: String,
    dest_config: String,
    app: AppHandle,
) -> Result<String, String> {
    let sync_id = Uuid::new_v4().to_string();

    // Build rclone command based on dest_type
    let dest_name = match dest_type.as_str() {
        "local_server" => {
            let config: serde_json::Value = serde_json::from_str(&dest_config)
                .map_err(|e| format!("Invalid config: {}", e))?;
            format!(":sftp:{}@{}:{}",
                config["username"].as_str().unwrap_or("user"),
                config["host"].as_str().unwrap_or("localhost"),
                config["path"].as_str().unwrap_or("/backup"))
        }
        "google_drive" => {
            let config: serde_json::Value = serde_json::from_str(&dest_config)
                .map_err(|e| format!("Invalid config: {}", e))?;
            format!("gdrive:{}", config["folder"].as_str().unwrap_or("Sisbackup"))
        }
        "onedrive" => {
            let config: serde_json::Value = serde_json::from_str(&dest_config)
                .map_err(|e| format!("Invalid config: {}", e))?;
            format!("onedrive:{}", config["folder"].as_str().unwrap_or("Sisbackup"))
        }
        "local" => {
            let config: serde_json::Value = serde_json::from_str(&dest_config)
                .map_err(|e| format!("Invalid config: {}", e))?;
            config["path"].as_str().unwrap_or("./backup").to_string()
        }
        _ => return Err(format!("Unknown destination type: {}", dest_type)),
    };

    let source = source_path.clone();
    let id = sync_id.clone();

    let task = SyncTask {
        status: SyncStatus {
            id: sync_id.clone(),
            source_path,
            dest_label: format!("{}:{}", dest_type, dest_name),
            progress: 0.0,
            state: "syncing".to_string(),
            files_done: 0,
            files_total: 0,
            bytes_done: 0,
            bytes_total: 0,
            error_message: None,
        },
        child: None,
    };

    {
        let mut map = ACTIVE_SYNCS.lock().unwrap();
        if map.is_none() {
            *map = Some(HashMap::new());
        }
        map.as_mut().unwrap().insert(sync_id, task);
    }

    // Spawn rclone sync in background
    tokio::spawn(async move {
        let result = run_rclone_sync(&source, &dest_name, &id).await;

        let mut map = ACTIVE_SYNCS.lock().unwrap();
        if let Some(ref mut map) = *map {
            if let Some(task) = map.get_mut(&id) {
                match result {
                    Ok(()) => {
                        task.status.state = "completed".to_string();
                        task.status.progress = 100.0;
                    }
                    Err(e) => {
                        task.status.state = "error".to_string();
                        task.status.error_message = Some(e);
                    }
                }
                // Emit status update
                let _ = app.emit("sync-status-update", &task.status);
            }
        }
    });

    Ok(sync_id)
}

async fn run_rclone_sync(source: &str, dest: &str, _sync_id: &str) -> Result<(), String> {
    let output = Command::new("rclone")
        .args([
            "sync",
            source,
            dest,
            "--progress",
            "--stats-one-line",
            "--stats", "5s",
            "--ignore-existing",
            "--verbose",
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run rclone: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("rclone error: {}", stderr));
    }

    Ok(())
}

pub async fn stop_sync(sync_id: &str) -> Result<(), String> {
    let mut map = ACTIVE_SYNCS.lock().unwrap();
    if let Some(ref mut map) = *map {
        if let Some(task) = map.get_mut(sync_id) {
            if let Some(ref mut child) = task.child {
                let _ = child.kill().await;
            }
            task.status.state = "paused".to_string();
            map.remove(sync_id);
        }
    }
    Ok(())
}

pub async fn get_all_status() -> Result<Vec<SyncStatus>, String> {
    let map = ACTIVE_SYNCS.lock().unwrap();
    if let Some(ref map) = *map {
        Ok(map.values().map(|t| t.status.clone()).collect())
    } else {
        Ok(vec![])
    }
}

pub async fn check_rclone_installed() -> Result<bool, String> {
    match Command::new("rclone").arg("version").output().await {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

pub async fn get_rclone_version() -> Result<String, String> {
    let output = Command::new("rclone")
        .arg("version")
        .arg("--short")
        .output()
        .await
        .map_err(|e| format!("Failed to run rclone: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err("rclone not found".to_string())
    }
}

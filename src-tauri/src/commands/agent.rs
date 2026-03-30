use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;
use tracing::info;

fn get_agents_dir(app: &AppHandle) -> PathBuf {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data dir");
    let agents_dir = app_data_dir.join("agents");
    
    if !agents_dir.exists() {
        fs::create_dir_all(&agents_dir).expect("Failed to create agents directory");
    }
    
    agents_dir
}

#[tauri::command]
pub fn list_agent_files(app: AppHandle) -> Result<Vec<String>, String> {
    let agents_dir = get_agents_dir(&app);
    
    let entries = fs::read_dir(&agents_dir)
        .map_err(|e| format!("Failed to read agents directory: {}", e))?;
    
    let files: Vec<String> = entries
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            let path = entry.path();
            path.is_file() && (path.extension().map(|e| e == "txt" || e == "md").unwrap_or(false))
        })
        .filter_map(|entry| {
            entry
                .file_name()
                .to_str()
                .map(|s| s.to_string())
        })
        .collect();
    
    info!("Listed {} agent files", files.len());
    Ok(files)
}

#[tauri::command]
pub fn read_agent_file(app: AppHandle, file_name: String) -> Result<String, String> {
    let agents_dir = get_agents_dir(&app);
    let file_path = agents_dir.join(&file_name);
    
    if !file_path.exists() {
        return Err(format!("File not found: {}", file_name));
    }
    
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    info!("Read agent file: {}", file_name);
    Ok(content)
}

#[tauri::command]
pub fn create_agent_file(app: AppHandle, file_name: String, content: String) -> Result<(), String> {
    let agents_dir = get_agents_dir(&app);
    let file_path = agents_dir.join(&file_name);
    
    if file_path.exists() {
        return Err(format!("File already exists: {}", file_name));
    }
    
    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to create file: {}", e))?;
    
    info!("Created agent file: {}", file_name);
    Ok(())
}

#[tauri::command]
pub fn save_agent_file(app: AppHandle, file_name: String, content: String) -> Result<(), String> {
    let agents_dir = get_agents_dir(&app);
    let file_path = agents_dir.join(&file_name);
    
    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to save file: {}", e))?;
    
    info!("Saved agent file: {}", file_name);
    Ok(())
}

#[tauri::command]
pub fn delete_agent_file(app: AppHandle, file_name: String) -> Result<(), String> {
    let agents_dir = get_agents_dir(&app);
    let file_path = agents_dir.join(&file_name);
    
    if !file_path.exists() {
        return Err(format!("File not found: {}", file_name));
    }
    
    fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete file: {}", e))?;
    
    info!("Deleted agent file: {}", file_name);
    Ok(())
}
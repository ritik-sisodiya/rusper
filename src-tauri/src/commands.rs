use crate::audio::{self, AudioRecorder};
use crate::groq::transcribe_audio;
use crate::injector::copy_and_inject_text;
use crate::parse_shortcut_str;
use crate::state::AppState;
use std::path::PathBuf;
use std::sync::{atomic::Ordering, Mutex};
use tauri::{AppHandle, Manager, State, WebviewWindow};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

static ACTIVE_RECORDER: Mutex<Option<AudioRecorder>> = Mutex::new(None);

pub fn get_config_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(app_data) = std::env::var("APPDATA") {
            let p = PathBuf::from(app_data).join("Rusper");
            let _ = std::fs::create_dir_all(&p);
            return p;
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(home) = std::env::var("HOME") {
            let p = PathBuf::from(home).join(".config").join("rusper");
            let _ = std::fs::create_dir_all(&p);
            return p;
        }
    }
    let p = std::env::temp_dir().join("rusper");
    let _ = std::fs::create_dir_all(&p);
    p
}

fn sanitize_key(raw: &str) -> Option<String> {
    let cleaned = raw
        .trim()
        .trim_matches('"')
        .trim_matches('\'')
        .trim()
        .to_string();
    if !cleaned.is_empty() && cleaned.starts_with("gsk_") {
        Some(cleaned)
    } else {
        None
    }
}

pub fn get_saved_api_key() -> Option<String> {
    let config_file = get_config_dir().join("flow_dictate_key.txt");
    if let Ok(content) = std::fs::read_to_string(&config_file) {
        if let Some(valid_key) = sanitize_key(&content) {
            return Some(valid_key);
        }
    }
    let legacy_file = std::env::temp_dir().join("flow_dictate_key.txt");
    if let Ok(content) = std::fs::read_to_string(&legacy_file) {
        if let Some(valid_key) = sanitize_key(&content) {
            return Some(valid_key);
        }
    }
    std::env::var("GROQ_API_KEY").ok().and_then(|k| sanitize_key(&k))
}

fn save_api_key_to_disk(key: &str) -> Result<(), String> {
    let config_file = get_config_dir().join("flow_dictate_key.txt");
    let _ = std::fs::write(&config_file, key);
    let legacy_file = std::env::temp_dir().join("flow_dictate_key.txt");
    let _ = std::fs::write(&legacy_file, key);
    Ok(())
}

#[tauri::command]
pub async fn get_api_key(state: State<'_, AppState>) -> Result<Option<String>, String> {
    if let Ok(guard) = state.custom_api_key.lock() {
        if let Some(ref key) = *guard {
            if let Some(valid) = sanitize_key(key) {
                return Ok(Some(valid));
            }
        }
    }
    let disk_key = get_saved_api_key();
    if let Some(ref k) = disk_key {
        if let Ok(mut guard) = state.custom_api_key.lock() {
            *guard = Some(k.clone());
        }
    }
    Ok(disk_key)
}

#[tauri::command]
pub async fn save_api_key(key: String, state: State<'_, AppState>) -> Result<(), String> {
    let trimmed = key.trim().trim_matches('"').trim_matches('\'').trim().to_string();
    if !trimmed.starts_with("gsk_") {
        return Err("API key must begin with 'gsk_'".to_string());
    }
    save_api_key_to_disk(&trimmed)?;
    if let Ok(mut guard) = state.custom_api_key.lock() {
        *guard = Some(trimmed);
    }
    Ok(())
}

pub fn get_saved_hotkey_str() -> String {
    let config_file = get_config_dir().join("flow_dictate_hotkey.txt");
    if let Ok(content) = std::fs::read_to_string(&config_file) {
        let trimmed = content.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    let legacy_file = std::env::temp_dir().join("flow_dictate_hotkey.txt");
    if let Ok(content) = std::fs::read_to_string(&legacy_file) {
        let trimmed = content.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    "ScrollLock".to_string()
}

pub fn save_hotkey_str(hotkey: &str) {
    let config_file = get_config_dir().join("flow_dictate_hotkey.txt");
    let _ = std::fs::write(&config_file, hotkey);
    let legacy_file = std::env::temp_dir().join("flow_dictate_hotkey.txt");
    let _ = std::fs::write(&legacy_file, hotkey);
}

pub fn get_saved_mode_str() -> String {
    let config_file = get_config_dir().join("flow_dictate_mode.txt");
    if let Ok(content) = std::fs::read_to_string(&config_file) {
        let trimmed = content.trim();
        if trimmed == "push_to_talk" || trimmed == "interactive" {
            return trimmed.to_string();
        }
    }
    let legacy_file = std::env::temp_dir().join("flow_dictate_mode.txt");
    if let Ok(content) = std::fs::read_to_string(&legacy_file) {
        let trimmed = content.trim();
        if trimmed == "push_to_talk" || trimmed == "interactive" {
            return trimmed.to_string();
        }
    }
    "interactive".to_string()
}

pub fn save_mode_str(mode: &str) {
    let config_file = get_config_dir().join("flow_dictate_mode.txt");
    let _ = std::fs::write(&config_file, mode);
    let legacy_file = std::env::temp_dir().join("flow_dictate_mode.txt");
    let _ = std::fs::write(&legacy_file, mode);
}

#[tauri::command]
pub async fn get_dictation_mode(state: State<'_, AppState>) -> Result<String, String> {
    if let Ok(guard) = state.dictation_mode.lock() {
        if !guard.is_empty() {
            return Ok(guard.clone());
        }
    }
    let saved = get_saved_mode_str();
    if let Ok(mut guard) = state.dictation_mode.lock() {
        *guard = saved.clone();
    }
    Ok(saved)
}

#[tauri::command]
pub async fn set_dictation_mode(mode: String, state: State<'_, AppState>) -> Result<(), String> {
    if mode != "interactive" && mode != "push_to_talk" {
        return Err("Invalid dictation mode".to_string());
    }
    save_mode_str(&mode);
    if let Ok(mut guard) = state.dictation_mode.lock() {
        *guard = mode;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_saved_hotkey() -> Result<String, String> {
    Ok(get_saved_hotkey_str())
}

#[tauri::command]
pub async fn register_hotkey(
    app: AppHandle,
    hotkey: Option<String>,
    shortcut: Option<String>,
) -> Result<(), String> {
    let key_str = hotkey
        .or(shortcut)
        .ok_or_else(|| "No hotkey combination provided".to_string())?;
    let shortcut_obj = parse_shortcut_str(&key_str)
        .ok_or_else(|| format!("Invalid shortcut combination: '{}'", key_str))?;

    // 1. Unregister previously saved hotkey if any
    let prev_key_str = get_saved_hotkey_str();
    if let Some(prev_shortcut) = parse_shortcut_str(&prev_key_str) {
        let _ = app.global_shortcut().unregister(prev_shortcut);
    }

    // 2. Unregister target shortcut if already tracked, and unregister all
    let _ = app.global_shortcut().unregister(shortcut_obj);
    let _ = app.global_shortcut().unregister_all();

    // 3. Register target shortcut if not already registered
    if !app.global_shortcut().is_registered(shortcut_obj) {
        if let Err(e) = app.global_shortcut().register(shortcut_obj) {
            let err_msg = e.to_string();
            if !err_msg.to_lowercase().contains("already registered") {
                return Err(format!("Failed to register OS hotkey '{}': {}", key_str, err_msg));
            }
        }
    }

    save_hotkey_str(&key_str);
    Ok(())
}

pub fn get_saved_overlay_position_str() -> String {
    let config_file = get_config_dir().join("flow_dictate_overlay_pos.txt");
    if let Ok(content) = std::fs::read_to_string(&config_file) {
        let trimmed = content.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    let legacy_file = std::env::temp_dir().join("flow_dictate_overlay_pos.txt");
    if let Ok(content) = std::fs::read_to_string(&legacy_file) {
        let trimmed = content.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    "bottom-center".to_string()
}

pub fn save_overlay_position_str(pos: &str) {
    let config_file = get_config_dir().join("flow_dictate_overlay_pos.txt");
    let _ = std::fs::write(&config_file, pos);
    let legacy_file = std::env::temp_dir().join("flow_dictate_overlay_pos.txt");
    let _ = std::fs::write(&legacy_file, pos);
}

pub fn compute_window_position(
    monitor_width: u32,
    monitor_height: u32,
    window_width: u32,
    window_height: u32,
    scale_factor: f64,
    position: &str,
) -> (i32, i32) {
    match position {
        "bottom-right" => (
            monitor_width as i32 - window_width as i32 - (40.0 * scale_factor) as i32,
            monitor_height as i32 - window_height as i32 - (85.0 * scale_factor) as i32,
        ),
        "top-right" => (
            monitor_width as i32 - window_width as i32 - (40.0 * scale_factor) as i32,
            (40.0 * scale_factor) as i32,
        ),
        "center" => (
            (monitor_width as i32 - window_width as i32) / 2,
            (monitor_height as i32 - window_height as i32) / 2,
        ),
        _ => ( // "bottom-center"
            (monitor_width as i32 - window_width as i32) / 2,
            monitor_height as i32 - window_height as i32 - (85.0 * scale_factor) as i32,
        ),
    }
}

#[tauri::command]
pub async fn set_overlay_position(app: AppHandle, position: String) -> Result<(), String> {
    save_overlay_position_str(&position);
    let mode = get_saved_mode_str();
    sync_window_size(app, mode).await?;
    Ok(())
}

#[tauri::command]
pub async fn get_overlay_position() -> Result<String, String> {
    Ok(get_saved_overlay_position_str())
}

pub fn get_saved_device_str() -> Option<String> {
    let config_file = get_config_dir().join("flow_dictate_device.txt");
    if let Ok(content) = std::fs::read_to_string(&config_file) {
        let trimmed = content.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    let legacy_file = std::env::temp_dir().join("flow_dictate_device.txt");
    if let Ok(content) = std::fs::read_to_string(&legacy_file) {
        let trimmed = content.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    None
}

pub fn save_device_str(device: &str) {
    let config_file = get_config_dir().join("flow_dictate_device.txt");
    let _ = std::fs::write(&config_file, device);
    let legacy_file = std::env::temp_dir().join("flow_dictate_device.txt");
    let _ = std::fs::write(&legacy_file, device);
}

#[tauri::command]
pub async fn get_audio_devices() -> Result<Vec<String>, String> {
    Ok(audio::get_available_devices())
}

#[tauri::command]
pub async fn get_selected_audio_device(state: State<'_, AppState>) -> Result<Option<String>, String> {
    if let Ok(guard) = state.selected_audio_device.lock() {
        if guard.is_some() {
            return Ok(guard.clone());
        }
    }
    let saved = get_saved_device_str();
    if let Ok(mut guard) = state.selected_audio_device.lock() {
        *guard = saved.clone();
    }
    Ok(saved)
}

#[tauri::command]
pub async fn set_selected_audio_device(device_name: String, state: State<'_, AppState>) -> Result<(), String> {
    save_device_str(&device_name);
    if let Ok(mut guard) = state.selected_audio_device.lock() {
        *guard = Some(device_name);
    }
    Ok(())
}

#[tauri::command]
pub async fn start_mic_test(app_handle: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let dev_name = {
        let memory = state.selected_audio_device.lock().ok().and_then(|g| g.clone());
        memory.or_else(get_saved_device_str)
    };
    audio::start_mic_test_stream(app_handle, dev_name)
}

#[tauri::command]
pub async fn stop_mic_test() -> Result<(), String> {
    audio::stop_mic_test_stream();
    Ok(())
}

#[tauri::command]
pub async fn start_recording(app_handle: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    if state.is_recording.load(Ordering::SeqCst) {
        return Ok(());
    }

    let dev_name = {
        let memory = state.selected_audio_device.lock().ok().and_then(|g| g.clone());
        memory.or_else(get_saved_device_str)
    };

    let (recorder, _) = AudioRecorder::new(app_handle, dev_name)?;
    let mut guard = ACTIVE_RECORDER
        .lock()
        .map_err(|_| "Failed to lock active recorder mutex".to_string())?;

    *guard = Some(recorder);
    state.is_recording.store(true, Ordering::SeqCst);
    Ok(())
}

pub fn get_saved_system_prompt_str() -> String {
    let config_file = get_config_dir().join("flow_dictate_system_prompt.txt");
    if let Ok(content) = std::fs::read_to_string(&config_file) {
        let trimmed = content.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    let legacy_file = std::env::temp_dir().join("flow_dictate_system_prompt.txt");
    if let Ok(content) = std::fs::read_to_string(&legacy_file) {
        let trimmed = content.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    "You are an intelligent voice dictation cleaning engine. Your mission is to convert raw, rambling, stream-of-consciousness spoken voice into crisp, clear, publication-ready text.\n\n\
    CORE PROCESSING DIRECTIVES:\n\
    1. STRIP EMOTIONAL VENTING & META-COMMENTARY: Remove all emotional venting, complaints, frustration, conversational throat-clearing, and meta-talk (e.g., 'Ugh I hate this bug', 'Why is this so hard', 'Let me see', 'How do I say this'). Keep only the actual core message, thought, or instruction.\n\
    2. RESOLVE SELF-CORRECTIONS & ABANDONED THOUGHTS: If the speaker backtracks, changes their mind, corrects dates/times/names/plans, or replaces a thought mid-sentence (e.g., 'Let\\'s do Tuesday... wait no, Wednesday afternoon'), ONLY output the final chosen thought ('Let\\'s do Wednesday afternoon.'). Erase the discarded first attempt.\n\
    3. REMOVE FILLER WORDS & HESITATIONS: Completely eliminate 'um', 'uh', 'like', 'you know', 'I mean', 'basically', 'so yeah', and stuttered/repeated words ('the the', 'we need to we need to').\n\
    4. PERFECT PUNCTUATION & CAPITALIZATION: Structure into clear sentences, paragraphs, or lists where natural. Capitalize correctly.\n\
    5. PRESERVE ACCURACY & INTENT: Never invent facts or change the speaker\\'s true meaning.\n\
    6. BRAND & VOCABULARY SPELLING: Always spell the app name as 'Rusper' (never 'Raspur', 'Raspar', 'Rosper', 'Rasper', 'Russper', or 'Rustper').\n\n\
    OUTPUT CONSTRAINT:\n\
    Output ONLY the final cleaned text. Do NOT include greetings, conversational replies, explanations, markdown quotes, or thinking blocks.".to_string()
}

pub fn save_system_prompt_str(prompt: &str) {
    let config_file = get_config_dir().join("flow_dictate_system_prompt.txt");
    let _ = std::fs::write(&config_file, prompt);
    let legacy_file = std::env::temp_dir().join("flow_dictate_system_prompt.txt");
    let _ = std::fs::write(&legacy_file, prompt);
}

pub fn apply_pure_window_attributes(window: &tauri::WebviewWindow) {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::Graphics::Dwm::{
            DwmSetWindowAttribute, DWMWA_BORDER_COLOR, DWMWA_WINDOW_CORNER_PREFERENCE,
            DWMWCP_DONOTROUND,
        };
        use windows_sys::Win32::Foundation::HWND;

        if let Ok(hwnd) = window.hwnd() {
            let hwnd_val = hwnd.0 as HWND;
            unsafe {
                // 1. Prevent Windows 11 default window frame rounding
                let corner_pref: u32 = DWMWCP_DONOTROUND as u32;
                let _ = DwmSetWindowAttribute(
                    hwnd_val,
                    DWMWA_WINDOW_CORNER_PREFERENCE as u32,
                    &corner_pref as *const _ as *const _,
                    std::mem::size_of::<u32>() as u32,
                );

                // 2. Remove Windows 11 1px border line
                let color_none: u32 = 0xFFFFFFFE; // DWMWA_COLOR_NONE
                let _ = DwmSetWindowAttribute(
                    hwnd_val,
                    DWMWA_BORDER_COLOR as u32,
                    &color_none as *const _ as *const _,
                    std::mem::size_of::<u32>() as u32,
                );
            }
        }
    }
}

#[tauri::command]
pub async fn sync_window_size(app: AppHandle, mode: String) -> Result<(), String> {
    if let Some(main_window) = app.get_webview_window("main") {
        apply_pure_window_attributes(&main_window);
        if let Ok(Some(monitor)) = main_window.primary_monitor() {
            let monitor_size = monitor.size();
            let scale_factor = monitor.scale_factor();
            let (w_logical, h_logical) = if mode == "push_to_talk" {
                (160.0, 44.0)
            } else {
                (360.0, 200.0)
            };
            let window_width = (w_logical * scale_factor).round() as u32;
            let window_height = (h_logical * scale_factor).round() as u32;
            let pos_str = get_saved_overlay_position_str();
            let (x, y) = compute_window_position(
                monitor_size.width,
                monitor_size.height,
                window_width,
                window_height,
                scale_factor,
                &pos_str,
            );

            let _ = main_window.set_size(tauri::PhysicalSize::new(window_width, window_height));
            let _ = main_window.set_position(tauri::PhysicalPosition::new(x, y));
            apply_pure_window_attributes(&main_window);
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn get_system_prompt(state: State<'_, AppState>) -> Result<String, String> {
    if let Ok(guard) = state.system_prompt.lock() {
        if !guard.trim().is_empty() {
            return Ok(guard.clone());
        }
    }
    let saved = get_saved_system_prompt_str();
    if let Ok(mut guard) = state.system_prompt.lock() {
        *guard = saved.clone();
    }
    Ok(saved)
}

#[tauri::command]
pub async fn save_system_prompt(prompt: String, state: State<'_, AppState>) -> Result<(), String> {
    save_system_prompt_str(&prompt);
    if let Ok(mut guard) = state.system_prompt.lock() {
        *guard = prompt;
    }
    Ok(())
}

pub fn is_meaningful_speech(text: &str) -> bool {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return false;
    }
    let lower = trimmed.to_lowercase();
    let lower_clean = lower.trim_matches(|c: char| c.is_ascii_punctuation() || c.is_whitespace());
    
    if lower_clean.is_empty() {
        return false;
    }

    let hallucinations = [
        "no speech detected",
        "no audio detected",
        "there is no text to refine",
        "there is no text to refine the input is empty",
        "the input is empty",
        "no text provided",
        "there is no audio",
        "input is empty",
        "thank you",
        "thank you for watching",
        "subtitles by",
        "amara.org",
        "bye",
        "you",
        "so",
        "the end",
    ];

    for h in hallucinations {
        if lower_clean == h || lower_clean.starts_with("subtitles by") || lower_clean.contains("amara.org") || lower_clean.contains("no text to refine") || lower_clean.contains("input is empty") {
            return false;
        }
    }

    true
}

#[tauri::command]
pub async fn stop_recording_and_process(
    state: State<'_, AppState>,
) -> Result<String, String> {
    if !state.is_recording.load(Ordering::SeqCst) {
        return Err("Not currently recording".to_string());
    }

    let recorder = ACTIVE_RECORDER
        .lock()
        .map_err(|_| "Mutex error")?
        .take()
        .ok_or_else(|| "No active recorder found".to_string())?;

    let audio_path = recorder.stop();
    state.is_recording.store(false, Ordering::SeqCst);

    let api_key = {
        let memory_key = state.custom_api_key.lock().ok().and_then(|g| g.clone()).and_then(|k| sanitize_key(&k));
        memory_key.or_else(get_saved_api_key).ok_or_else(|| {
            "Groq API key not found or invalid. Please check Settings to configure your API key.".to_string()
        })?
    };

    let sys_prompt = {
        let memory = state.system_prompt.lock().ok().and_then(|g| if g.trim().is_empty() { None } else { Some(g.clone()) });
        memory.unwrap_or_else(get_saved_system_prompt_str)
    };

    let raw_transcript = transcribe_audio(audio_path, &api_key, Some(&sys_prompt))
        .await
        .map_err(|e| format!("Transcription failed: {:#}", e))?;

    let final_transcript = if is_meaningful_speech(&raw_transcript) {
        raw_transcript
    } else {
        "(No audio detected)".to_string()
    };

    if let Ok(mut last) = state.last_transcription.lock() {
        *last = final_transcript.clone();
    }

    Ok(final_transcript)
}

#[tauri::command]
pub async fn accept_text(window: WebviewWindow, state: State<'_, AppState>) -> Result<(), String> {
    let text = state
        .last_transcription
        .lock()
        .map_err(|_| "Mutex error")?
        .clone();
    let _ = window.hide();

    if is_meaningful_speech(&text) {
        tokio::task::spawn_blocking(move || {
            let _ = copy_and_inject_text(&text);
        });
    }

    Ok(())
}

#[tauri::command]
pub async fn cancel_popover(window: WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
fn is_valid_foreground_text_field() -> bool {
    #[link(name = "user32")]
    extern "system" {
        fn GetForegroundWindow() -> isize;
        fn GetClassNameW(hWnd: isize, lpClassName: *mut u16, nMaxCount: i32) -> i32;
    }

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd == 0 {
            return false;
        }
        let mut class_name = [0u16; 256];
        let len = GetClassNameW(hwnd, class_name.as_mut_ptr(), 256);
        if len > 0 {
            let class_str = String::from_utf16_lossy(&class_name[..len as usize]);
            let lower = class_str.to_lowercase();
            if lower == "progman" || lower == "workerw" || lower == "shell_traywnd" {
                return false;
            }
        }
        true
    }
}

#[cfg(not(target_os = "windows"))]
fn is_valid_foreground_text_field() -> bool {
    true
}

#[tauri::command]
pub async fn validate_active_text_field() -> Result<bool, String> {
    Ok(is_valid_foreground_text_field())
}

#[tauri::command]
pub async fn undo_last_injection() -> Result<(), String> {
    tokio::task::spawn_blocking(|| -> Result<(), String> {
        #[cfg(target_os = "windows")]
        {
            crate::injector::restore_active_foreground_window();
            std::thread::sleep(std::time::Duration::from_millis(60));
            crate::injector::simulate_undo()?;
        }
        #[cfg(not(target_os = "windows"))]
        {
            use enigo::{Direction, Enigo, Key, Keyboard, Settings};
            let mut enigo = Enigo::new(&Settings::default()).map_err(|e| format!("Enigo init error: {:?}", e))?;
            #[cfg(target_os = "macos")]
            let modifier = Key::Meta;
            #[cfg(not(target_os = "macos"))]
            let modifier = Key::Control;

            let _ = enigo.key(modifier, Direction::Press);
            let _ = enigo.key(Key::Z, Direction::Click);
            let _ = enigo.key(modifier, Direction::Release);
        }
        Ok(())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/c", "start", "", &url])
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
        Ok(())
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
        Ok(())
    }
}

#[tauri::command]
pub async fn test_prompt_expansion(
    input: String,
    prompt: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let api_key = {
        let memory_key = state.custom_api_key.lock().ok().and_then(|g| g.clone()).and_then(|k| sanitize_key(&k));
        memory_key.or_else(get_saved_api_key).ok_or_else(|| {
            "Groq API key not found. Please save a valid API key in settings.".to_string()
        })?
    };

    let sys_prompt = prompt.unwrap_or_else(|| {
        let memory = state.system_prompt.lock().ok().and_then(|g| if g.trim().is_empty() { None } else { Some(g.clone()) });
        memory.unwrap_or_else(get_saved_system_prompt_str)
    });

    crate::groq::refine_text_with_llm(&input, &api_key, &sys_prompt)
        .await
        .map_err(|e| format!("Prompt expansion test failed: {:#}", e))
}



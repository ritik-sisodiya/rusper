<p align="center">
  <img src="https://raw.githubusercontent.com/ajinkya-cell/rusper/main/public/logo.png" alt="Rusper Logo" width="108" height="108" style="border-radius: 24px; box-shadow: 0 10px 35px rgba(0,0,0,0.6);" />
</p>

<h1 align="center">🎙️ Rusper v0.1.0 — Initial Public Release</h1>

<p align="center">
  <strong>The Blazingly Fast, Privacy-First AI Voice Dictation OS for Windows.</strong>
</p>

<p align="center">
  <em>Say goodbye to $20/month subscriptions. Speak naturally at 200+ WPM with sub-300ms cloud inference using your own free Groq API key.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Release-v0.1.0--alpha-emerald?style=for-the-badge&logo=windows" alt="Version">
  <img src="https://img.shields.io/badge/License-AGPLv3_%2B_Trademark-blue?style=for-the-badge" alt="License">
  <a href="https://console.groq.com/keys"><img src="https://img.shields.io/badge/Powered_by-Groq_LPU-orange?style=for-the-badge&logo=fastapi" alt="Groq LPU"></a>
  <a href="https://tauri.app/"><img src="https://img.shields.io/badge/Built_with-Tauri_v2_%2B_Rust-24c8db?style=for-the-badge&logo=rust" alt="Tauri + Rust"></a>
  <img src="https://img.shields.io/badge/Cost-%240%20%2F%20Free%20Forever-success?style=for-the-badge" alt="Free">
</p>

---

## ⚡ What is Rusper?

**Rusper** is a native, ultra-responsive Windows voice dictation companion built from scratch with **Rust**, **Tauri v2**, and **Groq Whisper LPUs**. It sits quietly in your system tray and turns your natural stream-of-consciousness speech into crisp, publication-ready text across **any application** in under **300 milliseconds**.

Unlike proprietary tools that lock your microphone behind recurring monthly subscriptions, Rusper is **100% free**, **open-source (AGPLv3)**, and uses the **BYOK (Bring Your Own Key)** model with **Groq LPUs**—meaning your audio streams directly from your PC to your private Groq endpoint with zero intermediate telemetry, zero logging, and zero server fees.

---

## ⚔️ Rusper vs. The Competition

| Feature | 🎙️ **Rusper** | 💸 **Wispr Flow** | 🪟 **Windows Dictation** |
| :--- | :---: | :---: | :---: |
| **Pricing** | **100% Free Forever (BYOK)** | **$12 – $20 / month** | Free (Bundled) |
| **Speed / Latency** | **Sub-300ms** (Groq LPUs) | ~400ms – 700ms | 1.5s – 3.0s |
| **Speech-to-Text Model** | **Whisper Large v3 Turbo** | Proprietary Whisper | Microsoft Speech SDK |
| **Developer Prompt Expansion** | **Yes** (*"make it 50 words"*, *"enhance prompt"*) | Basic Formatting | None |
| **Operating Modes** | **Push-to-Talk + Interactive Review + Toggle** | Push-to-Talk only | Toggle only |
| **Audio Privacy** | **Direct to your API Key** | Sent to Cloud SaaS | Microsoft Cloud Telemetry |
| **Custom LLM Personas** | **Yes** (Coding, Email, Casual, Raw) | Limited | None |
| **System RAM Footprint** | **~25 MB RAM** (Rust + WASAPI) | Electron (~300+ MB) | Windows Background Service |

---

## 🌟 Key Highlights & Capabilities

### 1. ⚡ Sub-300ms Speech-to-Text via Groq LPUs
Powered by Groq's Language Processing Units (LPUs), Rusper executes OpenAI's **Whisper Large v3 Turbo** model in the cloud at **~216x real-time speed**. You get instant, accurate transcription with zero local CPU spikes, zero GPU strain, and zero fan noise.

### 2. 🎯 Dual Operating Modes & Tap-to-Toggle
* **Push-to-Talk Capsule**: Hold your hotkey while speaking. Releasing the key transcribes your audio and immediately auto-pastes it into whatever application you're focused on (VS Code, Chrome, Slack, Word, Discord, Terminal).
* **Interactive Review Mode**: Tap your hotkey once to record. A floating tactile card appears, allowing you to review the text, trigger one-click copy, re-record (`R`), cancel (`Esc`), or inject directly (`Enter`).
* **Tap-to-Toggle**: Press the hotkey once to start recording, press it again to finish and transcribe.

### 3. 🧠 Developer Mode: Spoken Length & Prompt Expansion
When using **Developer Mode**, you can speak natural prompt-length directives and architectural requests aloud. The engine automatically strips the command phrase, extracts your core technical seed thought, and enriches it into a comprehensive specification:

| Spoken Cue | What Rusper Synthesizes |
| :--- | :--- |
| **🗣️ *"make it 50 words"*** | Expands the spoken concept to ~50 words with concrete inputs, outputs, and edge cases. |
| **🗣️ *"enhance this prompt to more words"*** | Generates a full architectural specification ready to paste directly into Claude, ChatGPT, or Cursor. |
| **🗣️ *"expand to 100 words"*** | Crafts an in-depth, multi-paragraph prompt or GitHub Pull Request description. |
| **🗣️ *"condense to 20 words"*** | Distills rambling thoughts into a clean, punchy single-line command. |

### 4. 🗣️ Smart Verbal Self-Correction & Emotion Stripping
Backtracking mid-sentence is automatically resolved. Saying:
> *"Ugh I'm so annoyed with this bug, wait no, let's actually just fix the database query by adding an index on user_id, yeah that should do it, oh wait also tell John to deploy it by 5pm."*

Synthesizes cleanly into:
> **"Add an index on user_id to fix the database query, and tell John to deploy it by 5:00 PM."**

### 5. 🛡️ 100% Native Windows Keystroke Injection & Focus Caret Restoration
Rusper captures your active foreground window handle (`HWND`) the moment you trigger dictation. When transcription completes, it automatically restores focus to your exact text caret and dispatches native Win32 `SendInput` (`VK_CONTROL` + `VK_V`), guaranteeing flawless auto-pasting across all desktop software.

### 6. 📁 Persistent AppData Architecture
All settings, hotkeys, custom prompts, and API keys are stored permanently in `%APPDATA%\Rusper`, ensuring configurations survive app updates, reboots, and disk cleanups.

---

## 🏗️ Architecture & Data Pipeline

```mermaid
flowchart LR
    A[🎙️ Microphone / WASAPI] -->|16kHz Mono Stream| B[🦀 Rust Engine]
    B -->|WAV Payload| C[⚡ Groq Whisper LPU]
    C -->|Raw Transcript| D[🧠 LLM Refiner]
    D -->|Polished Text| E[📋 Windows Clipboard]
    E -->|Win32 SendInput Paste| F[💻 Target Application]
    
    style A fill:#17171a,stroke:#34d399,stroke-width:2px,color:#fff
    style B fill:#17171a,stroke:#24c8db,stroke-width:2px,color:#fff
    style C fill:#17171a,stroke:#f97316,stroke-width:2px,color:#fff
    style D fill:#17171a,stroke:#a855f7,stroke-width:2px,color:#fff
    style E fill:#17171a,stroke:#38bdf8,stroke-width:2px,color:#fff
    style F fill:#17171a,stroke:#10b981,stroke-width:2px,color:#fff
```

---

## 🚀 3-Step Quick Start

### Step 1: Download & Install
1. Download **`rusper_0.1.0_x64-setup.exe`** from the Assets table below.
2. Run the installer.
3. *(If the blue Windows SmartScreen popup appears: click **More info** $\rightarrow$ **Run anyway**)*.

### Step 2: Connect Your Free Groq Key
1. Generate a free API key at **[console.groq.com/keys](https://console.groq.com/keys)** (takes ~30 seconds).
2. Open the **Rusper Dashboard** from your system tray.
3. Paste your key in the **AI Engine & Keys** tab and click **Save Key**.

### Step 3: Start Dictating!
Press **`ScrollLock`** (or your custom hotkey) anywhere in Windows and start speaking!

---

## ⌨️ Keyboard Shortcuts Reference

| Action | Shortcut | Context |
| :--- | :--- | :--- |
| **Start Dictating** | `ScrollLock` *(or custom hotkey)* | Anywhere in Windows |
| **Finish & Transcribe** | `Enter` or `Done` button *(or press hotkey again)* | Interactive Mode |
| **Accept & Paste Text** | `Enter` or `✓ Paste` button | Review Screen |
| **Re-record / Redo** | `R` key | Review Screen |
| **Dismiss / Cancel** | `Escape` or `✕` button | Any Overlay |
| **Push-to-Talk** | Hold `ScrollLock` $\rightarrow$ Release | Push-to-Talk Capsule |

---

## 📦 Verified Checksums (SHA-256)

Verify the authenticity and integrity of your downloaded files:

| File | Description | SHA-256 Checksum |
| :--- | :--- | :--- |
| **`rusper_0.1.0_x64-setup.exe`** | Windows NSIS Standalone Installer | `FE2716FF045214F64AAD75C03E1D00475E3E61991655358C7B917E96E758ED42` |

To verify the checksum on your PC, open PowerShell and run:
```powershell
Get-FileHash -Algorithm SHA256 "rusper_0.1.0_x64-setup.exe"
```

---

## ❓ Frequently Asked Questions (FAQ)

<details>
<summary><strong>Why does Windows SmartScreen show a blue warning?</strong></summary>
<br>
Windows SmartScreen displays a warning for new open-source software that does not yet possess an expensive EV code-signing certificate (which costs hundreds of dollars per year). Click <strong>"More info"</strong> and then <strong>"Run anyway"</strong>. Rusper is 100% open-source and you can inspect every line of code in this repository.
</details>

<details>
<summary><strong>Is my voice data private?</strong></summary>
<br>
Yes. Rusper has zero telemetry, zero trackers, and zero central servers. Audio streams encrypted via HTTPS directly from your local computer to your own Groq API account.
</details>

<details>
<summary><strong>Can I change the global hotkey?</strong></summary>
<br>
Yes! Open the Dashboard from your system tray, navigate to <strong>Hotkeys & Overlay</strong>, and choose from presets like <code>ScrollLock</code>, <code>Pause</code>, <code>Insert</code>, <code>F8</code>, <code>F9</code>, <code>F12</code>, <code>Ctrl + Shift + Space</code>, or build a custom combo.
</details>

---

## 🛡️ License & Trademark

Rusper is open source licensed under the **[GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE)** with **Section 7 Trademark & Brand Protection**:
* **Copyleft**: Any derivative work must remain 100% open source under the same AGPLv3 license.
* **Trademark**: The name **"Rusper"**, the Rusper logo, and brand design assets are the exclusive intellectual property of the project creator.

---

<p align="center">
  <strong>Built with ❤️ for developers, writers, and thinkers who love speed, privacy, and tactile software.</strong>
</p>


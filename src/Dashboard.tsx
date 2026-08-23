import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { motion, AnimatePresence } from 'framer-motion';
import { openExternalUrl } from './utils/opener';

type Tab = 'api' | 'audio' | 'mode' | 'hotkeys' | 'prompts' | 'article';

const PRESET_SHORTCUTS = [
  'ScrollLock',
  'Pause',
  'Insert',
  'F8',
  'F9',
  'F12',
  'Ctrl + Alt + D',
  'Ctrl + Shift + Space',
  'Alt + Space',
  'Ctrl + Alt + S',
];

const PROMPT_PRESETS = [
  {
    id: 'banger',
    name: '🔥 Smart Self-Correction & Emotion Stripping (Banger)',
    desc: 'Strips emotional venting, complaints, rambles, and filler words while resolving mid-sentence plan revisions and self-corrections into crisp, publication-ready text.',
    prompt: `You are an intelligent voice dictation cleaning engine. Your mission is to convert raw, rambling, stream-of-consciousness spoken voice into crisp, clear, publication-ready text.

CORE PROCESSING DIRECTIVES:
1. STRIP EMOTIONAL VENTING & META-COMMENTARY: Remove all emotional venting, complaints, frustration, conversational throat-clearing, and meta-talk (e.g., "Ugh I hate this bug", "Why is this so hard", "Let me see", "How do I say this"). Keep only the actual core message, thought, or instruction.
2. RESOLVE SELF-CORRECTIONS & ABANDONED THOUGHTS: If the speaker backtracks, changes their mind, corrects dates/times/names/plans, or replaces a thought mid-sentence (e.g., "Let's do Tuesday... wait no, Wednesday afternoon"), ONLY output the final chosen thought ("Let's do Wednesday afternoon."). Erase the discarded first attempt.
3. REMOVE FILLER WORDS & HESITATIONS: Completely eliminate "um", "uh", "like", "you know", "I mean", "basically", "so yeah", and stuttered/repeated words ("the the", "we need to we need to").
4. PERFECT PUNCTUATION & CAPITALIZATION: Structure into clear sentences, paragraphs, or lists where natural. Capitalize correctly.
5. PRESERVE ACCURACY & INTENT: Never invent facts or change the speaker's true meaning.
6. BRAND & KEYWORD SPELLING: Always spell the app name as "Rusper" (never "Raspur", "Raspar", "Rosper", "Rasper", "Rustper", or "Russper").

EXAMPLES:
Input: "Ugh I'm so annoyed with this bug, wait no, let's actually just fix the database query by adding an index on user_id, yeah that should do it, oh wait also tell John to deploy it by 5pm."
Output: Add an index on user_id to fix the database query, and tell John to deploy it by 5:00 PM.

Input: "Hey so um I was thinking we should maybe, you know, schedule the team meeting for 10am... actually no scratch that, 10am is too early let's do 2pm in room 4B... wait room 4A because the projector is better there."
Output: Schedule the team meeting for 2:00 PM in room 4A.

OUTPUT CONSTRAINT:
Output ONLY the final cleaned text. Do NOT include greetings, conversational replies, explanations, markdown quotes, or thinking blocks.`,
  },
  {
    id: 'email',
    name: '✉️ Professional Email & Workplace Message',
    desc: 'Transforms spoken rambles into clean, structured corporate emails and Slack/Teams messages.',
    prompt: `You are a professional executive writing assistant. Transform spoken dictation into clear, well-structured professional emails or workplace messages.

DIRECTIVES:
1. Resolve all mid-sentence self-corrections and speech revisions cleanly.
2. Format with clean paragraph breaks, proper greeting/sign-off if implied, and logical bullet points when lists are spoken.
3. Maintain a professional, polite, and direct corporate tone.
4. Erase all filler phrases, stutters, and verbal hesitations.
5. BRAND & VOCABULARY: Always spell the app name as "Rusper".
Output ONLY the finalized message body.

EXAMPLES:
Input: "hey team quick update we finished the API endpoints and tomorrow... wait Monday we launch"
Output: Hi Team,\n\nQuick update: we have completed the API endpoints. We are scheduled to launch on Monday.`,
  },
  {
    id: 'developer',
    name: '💻 Developer & Technical Specification',
    desc: 'Preserves code syntax, technical terms (camelCase, JSON, PostgreSQL), and auto-detects spoken length commands ("make it 50 words", "enhance this prompt to more words").',
    prompt: `You are a senior software engineering writing and prompt engineering assistant. Your mission is to format spoken technical notes, commit messages, PR descriptions, architectural thoughts, and AI prompts into clean, robust developer specifications.

CORE DIRECTIVES:
1. RESOLVE SELF-CORRECTIONS & CODE TERMS:
   - Resolve backtracking cleanly ("let's use Postgres... wait no, Redis" -> "Let's use Redis").
   - Preserve technical terms, API endpoints, variable names, and code syntax accurately (camelCase, snake_case, JSON, OAuth2, Docker, async/await).
   - Wrap code variables, signatures, and file names in markdown backticks (\`foo\`).

2. DYNAMIC SPOKEN LENGTH & PROMPT EXPANSION:
   - Detect spoken length or expansion directives such as:
     * "make it [N] words", "expand to [N] words", "target [N] words", "[N] word prompt"
     * "enhance this prompt to more words", "elaborate on this prompt", "make this prompt more detailed"
     * "condense this prompt", "shorten to [N] words"
   - When a length/expansion command is detected:
     a) Strip out the literal command trigger (do NOT write "make it 50 words" in the output).
     b) Extract the core technical concept or prompt goal.
     c) Dynamically expand the seed thought into a comprehensive, high-quality developer prompt or technical specification matching the requested length (~N words), incorporating inputs/outputs, edge case considerations, architectural constraints, and structure.

3. BRAND & VOCABULARY:
   - Always spell the application name as "Rusper" (never "Raspur", "Raspar", "Rosper", "Rasper", "Rustper", or "Russper").

4. OUTPUT CONSTRAINT:
   - Output ONLY the final polished, expanded developer prompt or documentation text. Never include conversational preambles, explanations, quotes, or markdown code block fences around the whole response.

EXAMPLES:
Input: "create a fast api endpoint for uploading images make it 50 words"
Output: Create a FastAPI endpoint \`/upload/image\` that accepts multipart image files (\`PNG\`, \`JPEG\`, \`WebP\`) with a 10MB size limit. Validate MIME types, generate unique UUID filenames, stream chunks asynchronously to local storage or an S3 bucket, and return a JSON payload with the file URL and upload timestamp.

Input: "build a custom react hook for debounce enhance this prompt to more words"
Output: Develop a TypeScript custom React hook named \`useDebounce<T>\` that takes a generic value and a delay in milliseconds. Use \`useEffect\` and \`setTimeout\` to delay updating the debounced state until the timer completes. Ensure proper cleanup on unmount or value change to prevent memory leaks, and include unit test examples with Vitest.`,
  },
  {
    id: 'summary',
    name: '📝 Executive Summary & Action Items',
    desc: 'Converts raw spoken brain dumps into concise markdown bullet points and action items.',
    prompt: `You are an executive assistant specializing in rapid note synthesis. Convert spoken brain dumps and meeting rambles into clean, bulleted action items and summary points.

DIRECTIVES:
1. Extract key decisions, action items, and main points.
2. Eliminate all speech revisions, stuttering, and conversational fluff.
3. BRAND SPELLING: Always spell the app name as "Rusper".
4. Present information using clear markdown bullet points and bold section headers where helpful. Output ONLY the structured summary.`,
  },
  {
    id: 'verbatim',
    name: '✍️ Minimal Polish & Clean Verbatim (Strict Original Words)',
    desc: 'Low-polishing mode: Fixes capitalization, punctuation, and stutters while keeping your EXACT spoken words and phrasing 100% intact.',
    prompt: `You are a minimal voice transcription cleaner. Your ONLY job is to add proper capitalization, fix spelling errors, add basic punctuation, and remove repeated stuttered words (e.g. 'the the').

STRICT DIRECTIVES:
1. DO NOT REWRITE OR REPHRASE: Keep the speaker's EXACT words, word order, and original phrasing completely intact. Do not change words or sentence structures.
2. DO NOT ALTER MEANING: Do not summarize, reorganize, or rewrite any thoughts.
3. STUTTER & FILLER REMOVAL ONLY: Remove duplicated stuttered words ('I I', 'the the') and explicit fillers ('um', 'uh').
4. PUNCTUATION & CAPITALIZATION ONLY: Insert missing periods, commas, question marks, and initial sentence capitalization.
5. BRAND SPELLING: If the user says the application name "Rusper", ensure it is spelled as "Rusper" (not "Raspur", "Raspar", "Rosper", etc.).
6. Output ONLY the minimally cleaned text with no comments or conversational fluff.`,
  },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('api');
  const [apiKey, setApiKey] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('whisper-large-v3-turbo');
  const [systemPrompt, setSystemPrompt] = useState(PROMPT_PRESETS[0].prompt);

  const [selectedShortcut, setSelectedShortcut] = useState('ScrollLock');
  const [customModifier, setCustomModifier] = useState('None');
  const [customKey, setCustomKey] = useState('ScrollLock');
  const [overlayPosition, setOverlayPosition] = useState('bottom-center');
  const [hotkeySaveStatus, setHotkeySaveStatus] = useState<string | null>(null);
  const [dictationMode, setDictationModeState] = useState<'interactive' | 'push_to_talk'>('interactive');
  const [hoveredPresetId, setHoveredPresetId] = useState<string | null>(null);
  const [isSafeguardsOpen, setIsSafeguardsOpen] = useState<boolean>(false);

  const [audioDevices, setAudioDevices] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('default');
  const [isTestingMic, setIsTestingMic] = useState<boolean>(false);
  const [micVolume, setMicVolume] = useState<number>(0);

  useEffect(() => {
    invoke<string | null>('get_api_key').then((key) => { if (key) setApiKey(key); }).catch(() => {});
    invoke<string>('get_saved_hotkey').then((hk) => { if (hk) setSelectedShortcut(hk); }).catch(() => {});
    invoke<string>('get_dictation_mode').then((m) => { if (m === 'push_to_talk' || m === 'interactive') setDictationModeState(m); }).catch(() => {});
    invoke<string>('get_system_prompt').then((prompt) => { if (prompt && prompt.trim()) setSystemPrompt(prompt); }).catch(() => {});
    invoke<string[]>('get_audio_devices').then((devs) => { if (devs && devs.length > 0) setAudioDevices(devs); }).catch(() => {});
    invoke<string | null>('get_selected_audio_device').then((dev) => { if (dev) setSelectedDevice(dev); }).catch(() => {});
    invoke<string>('get_overlay_position').then((pos) => { if (pos) setOverlayPosition(pos); }).catch(() => {});
  }, []);

  const micTestTimerRef = useRef<number | null>(null);

  const stopTestingMic = useCallback(async () => {
    if (micTestTimerRef.current) {
      clearTimeout(micTestTimerRef.current);
      micTestTimerRef.current = null;
    }
    setIsTestingMic(false);
    setMicVolume(0);
    try {
      await invoke('stop_mic_test');
    } catch (err) {
      console.error('Stop mic test error:', err);
    }
  }, []);

  useEffect(() => {
    const unlisten = listen<number>('test-audio-volume', (event) => setMicVolume(event.payload));
    return () => {
      unlisten.then((fn: () => void) => fn());
      if (micTestTimerRef.current) clearTimeout(micTestTimerRef.current);
      invoke('stop_mic_test').catch(() => {});
    };
  }, []);

  const handleDeviceChange = async (deviceName: string) => {
    setSelectedDevice(deviceName);
    try {
      await invoke('set_selected_audio_device', { deviceName });
      setHotkeySaveStatus(`Microphone set to "${deviceName}" ✓`);
      setTimeout(() => setHotkeySaveStatus(null), 3000);
      if (isTestingMic) {
        if (micTestTimerRef.current) clearTimeout(micTestTimerRef.current);
        await invoke('start_mic_test');
        micTestTimerRef.current = window.setTimeout(() => {
          stopTestingMic();
          setHotkeySaveStatus('Mic test finished (1 min limit reached) ✓');
          setTimeout(() => setHotkeySaveStatus(null), 3000);
        }, 60000);
      }
    } catch (err) { console.error('Device change error:', err); }
  };

  const toggleMicTest = async () => {
    if (isTestingMic) {
      await stopTestingMic();
    } else {
      setIsTestingMic(true);
      try {
        await invoke('start_mic_test');
        if (micTestTimerRef.current) clearTimeout(micTestTimerRef.current);
        micTestTimerRef.current = window.setTimeout(() => {
          stopTestingMic();
          setHotkeySaveStatus('Mic test finished (1 min limit reached) ✓');
          setTimeout(() => setHotkeySaveStatus(null), 3000);
        }, 60000);
      } catch (err) {
        console.error('Start mic test error:', err);
        setIsTestingMic(false);
        setHotkeySaveStatus(`Mic test error: ${err}`);
        setTimeout(() => setHotkeySaveStatus(null), 4000);
      }
    }
  };

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) { setSaveStatus('Please enter a valid API key'); return; }
    try {
      await invoke('save_api_key', { key: apiKey.trim() });
      setSaveStatus('API key saved successfully ✓');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) { setSaveStatus(`Failed to save: ${err}`); }
  };

  const handleApplySystemPromptPreset = async (promptText: string) => {
    setSystemPrompt(promptText);
    try {
      await invoke('save_system_prompt', { prompt: promptText });
      setSaveStatus('System prompt updated & active ✓');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) { setSaveStatus(`Failed to save prompt: ${err}`); }
  };

  const handleSetDictationMode = async (mode: 'interactive' | 'push_to_talk') => {
    setDictationModeState(mode);
    try {
      await invoke('set_dictation_mode', { mode });
      await invoke('sync_window_size', { mode }).catch(() => {});
      setHotkeySaveStatus(`Mode switched to ${mode === 'interactive' ? 'Interactive Review' : 'Push-to-Talk'} ✓`);
      setTimeout(() => setHotkeySaveStatus(null), 3000);
    } catch (err) { console.error('Set mode error:', err); }
  };

  const handleApplyPresetShortcut = async (shortcut: string) => {
    try {
      await invoke('register_hotkey', { hotkey: shortcut, shortcut });
      setSelectedShortcut(shortcut);
      setHotkeySaveStatus(`Global trigger registered: "${shortcut}" ✓`);
    } catch (err) {
      setHotkeySaveStatus(`Hotkey registration failed: ${err}`);
    }
    setTimeout(() => setHotkeySaveStatus(null), 3500);
  };

  const handleSaveCustomShortcut = async () => {
    let shortcut = customKey;
    if (customModifier !== 'None') shortcut = `${customModifier} + ${customKey}`;
    try {
      await invoke('register_hotkey', { hotkey: shortcut, shortcut });
      setSelectedShortcut(shortcut);
      setHotkeySaveStatus(`Custom shortcut registered: "${shortcut}" ✓`);
    } catch (err) {
      setHotkeySaveStatus(`Hotkey registration failed: ${err}`);
    }
    setTimeout(() => setHotkeySaveStatus(null), 3500);
  };

  const handleSetOverlayPosition = async (posId: string) => {
    setOverlayPosition(posId);
    try {
      await invoke('set_overlay_position', { position: posId });
      setHotkeySaveStatus(`Overlay position set to "${posId.replace('-', ' ')}" ✓`);
    } catch (err) { setHotkeySaveStatus(`Position update error: ${err}`); }
    setTimeout(() => setHotkeySaveStatus(null), 3000);
  };

  const navTabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'api', label: 'AI Engine & Keys', icon: '⚡' },
    { id: 'audio', label: 'Audio & Devices', icon: '🎙️' },
    { id: 'mode', label: 'Dictation Modes', icon: '🎯' },
    { id: 'hotkeys', label: 'Hotkeys & Overlay', icon: '⌨️' },
    { id: 'prompts', label: 'Prompt Engine', icon: '🧠' },
    { id: 'article', label: 'Why', icon: '💡' },
  ];

  return (
    <div className="w-screen h-screen bg-[#070709] text-white flex flex-col select-none overflow-hidden font-ui p-6 gap-4">
      {/* Top Branding Header (Directly on canvas with zero boxed section) */}
      <div className="flex items-center justify-between shrink-0 px-1 pt-0.5">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Rusper Logo"
            className="w-7 h-7 rounded-xl object-contain shadow-[0_2px_12px_rgba(0,0,0,0.6)] border border-white/10"
          />
          <h1 className="font-display italic text-3xl font-normal tracking-wide text-white leading-none">
            Rusper
          </h1>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden gap-5">
        {/* Left Sidebar */}
        <aside className="w-64 flex flex-col gap-4 shrink-0">
          <nav className="skeuo-dashboard-card rounded-2xl p-2.5 flex flex-col gap-1.5 border border-white/[0.08]">
            {navTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl font-ui text-xs transition cursor-pointer text-left ${
                    isActive ? 'text-zinc-950 font-bold' : 'text-zinc-400 font-medium hover:text-white hover:bg-white/5'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTabPill"
                      className="absolute inset-0 bg-white rounded-xl shadow-[0_2px_8px_rgba(255,255,255,0.2)]"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10 text-sm">{tab.icon}</span>
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="skeuo-dashboard-card rounded-2xl p-4 flex flex-col gap-2 mt-auto border border-white/[0.08]">
            <div className="flex items-center justify-between">
              <span className="font-ui text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Active Trigger</span>
              <span className="font-code text-[10px] text-zinc-400">{dictationMode === 'interactive' ? 'Interactive' : 'Push-to-Talk'}</span>
            </div>
            <div className="flex items-center gap-1.5 font-code text-xs text-white">
              <span className="skeuo-sub-panel px-3 py-1 rounded-lg text-xs font-bold text-zinc-100 border border-white/10">{selectedShortcut}</span>
            </div>
            <p className="font-ui text-[11px] text-zinc-400 leading-tight">Press anywhere in Windows to initiate voice dictation.</p>
          </div>
        </aside>

        {/* Right Main Content Panel */}
        <main className="flex-1 skeuo-dashboard-card rounded-2xl overflow-hidden flex flex-col relative border border-white/[0.08]">
          {/* Scrollable Viewport */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 relative scroll-smooth">
            <AnimatePresence mode="wait">
              {activeTab === 'api' && (
              <motion.div key="api" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-6">
                <div>
                  <h2 className="font-display text-2xl font-normal text-white">Groq Cloud API & Whisper Model</h2>
                  <p className="font-ui text-xs text-zinc-400 mt-0.5">Connect your Groq credentials for sub-300ms speech-to-text inference.</p>
                </div>
                <form onSubmit={handleSaveApiKey} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="font-ui text-xs font-semibold text-zinc-300">Groq API Key</label>
                      <button
                        type="button"
                        onClick={() => openExternalUrl('https://console.groq.com/keys')}
                        className="font-ui text-xs text-zinc-400 hover:text-white underline cursor-pointer transition flex items-center gap-1"
                        title="Open Groq Console in your default browser to generate a free API key"
                      >
                        Create API Key on Groq ↗
                      </button>
                    </div>
                    <div className="flex gap-3">
                      <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="gsk_..." className="skeuo-sub-well flex-1 rounded-xl px-4 py-2.5 text-xs text-white font-code placeholder-zinc-600 focus:outline-none transition" />
                      <button type="submit" className="skeuo-raised-btn px-5 py-2.5 rounded-xl text-xs font-ui font-bold transition cursor-pointer text-zinc-950">Save Key</button>
                    </div>
                    {saveStatus && <span className="font-ui text-xs font-medium text-emerald-400 mt-1">{saveStatus}</span>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-ui text-xs font-semibold text-zinc-300">Whisper AI Model</label>
                    <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="skeuo-sub-well w-full rounded-xl px-4 py-2.5 text-xs text-white font-code focus:outline-none transition cursor-pointer">
                      <option value="whisper-large-v3-turbo">whisper-large-v3-turbo (Ultra Fast • ~200ms latency)</option>
                      <option value="whisper-large-v3">whisper-large-v3 (Maximum Accuracy • Multilingual)</option>
                    </select>
                  </div>
                  <div className="skeuo-sub-panel rounded-2xl p-4 flex flex-col gap-2 mt-2 border border-white/[0.06]">
                    <span className="font-ui text-xs font-semibold text-white flex items-center gap-1.5">⚡ Hardware Acceleration Overview</span>
                    <p className="font-ui text-[11px] text-zinc-400 leading-relaxed">Rusper uses Groq's Language Processing Units (LPUs) to execute Whisper Large v3 directly in the cloud at <strong>~216x real-time speed</strong>, eliminating CPU spikes and fan noise on your local machine.</p>
                  </div>
                </form>
              </motion.div>
            )}

            {activeTab === 'audio' && (
              <motion.div key="audio" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-6">
                <div>
                  <h2 className="font-display text-2xl font-normal text-white">Audio Input & Live Microphone Test</h2>
                  <p className="font-ui text-xs text-zinc-400 mt-0.5">Select input device and test real-time sampling levels at 16kHz mono.</p>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="font-ui text-xs font-semibold text-zinc-300">Active Microphone</label>
                      <button type="button" onClick={() => { invoke<string[]>('get_audio_devices').then((devs) => { if (devs) setAudioDevices(devs); }); }} className="font-code text-[11px] text-zinc-400 hover:text-white underline cursor-pointer">↻ Refresh Devices</button>
                    </div>
                    <select value={selectedDevice} onChange={(e) => handleDeviceChange(e.target.value)} className="skeuo-sub-well w-full rounded-xl px-4 py-2.5 text-xs text-white font-code cursor-pointer focus:outline-none transition">
                      <option value="default">Default Windows Microphone (System Default)</option>
                      {audioDevices.map((dev, idx) => <option key={idx} value={dev}>{dev}</option>)}
                    </select>
                  </div>
                  <div className="skeuo-sub-panel rounded-2xl p-5 flex flex-col gap-4 border border-white/[0.06]">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-ui font-semibold text-zinc-200">Live Audio Level Meter</span>
                        {isTestingMic && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
                      </div>
                      <button type="button" onClick={toggleMicTest} className={`px-3.5 py-1.5 rounded-lg font-ui text-xs font-bold transition cursor-pointer border ${isTestingMic ? 'bg-rose-950 text-rose-200 border-rose-700 hover:bg-rose-900' : 'skeuo-raised-btn text-zinc-950'}`}>
                        {isTestingMic ? '⏹ Stop Testing' : '▶ Test Microphone Live'}
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-full h-3.5 skeuo-sub-well rounded-full overflow-hidden p-0.5 relative">
                        <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full transition-all duration-75 shadow-[0_0_8px_rgba(52,211,153,0.5)]" style={{ width: `${Math.min(100, Math.max(3, Math.round(micVolume * 100)))}%` }} />
                      </div>
                      <span className="font-code text-xs font-bold text-white shrink-0 w-12 text-right">{Math.min(100, Math.round(micVolume * 100))}%</span>
                    </div>
                    <div className="flex items-end justify-between h-14 pt-2 px-3 bg-black/40 rounded-xl border border-white/[0.04] overflow-hidden">
                      {Array.from({ length: 16 }).map((_, i) => {
                        const taper = Math.sin(((i + 1) / 17) * Math.PI);
                        const baseVol = Math.round(micVolume * 100);
                        const wave = Math.sin(i * 0.65 + baseVol * 0.08);
                        const dynamicHeight = isTestingMic && baseVol > 0
                          ? Math.min(100, Math.max(12, Math.round(baseVol * taper * (0.7 + wave * 0.3))))
                          : 12;
                        return (
                          <div
                            key={i}
                            className={`w-2 rounded-full transition-all duration-75 ${
                              isTestingMic && baseVol > 0
                                ? 'bg-gradient-to-t from-emerald-500 via-teal-400 to-white shadow-[0_0_6px_rgba(45,212,191,0.7)]'
                                : 'bg-white/10'
                            }`}
                            style={{ height: `${dynamicHeight}%` }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'mode' && (
              <motion.div key="mode" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-6">
                <div>
                  <h2 className="font-display text-2xl font-normal text-white">Dictation Operating Modes</h2>
                  <p className="font-ui text-xs text-zinc-400 mt-0.5">Choose how Rusper interacts with your speech and Windows applications.</p>
                </div>
                {hotkeySaveStatus && <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs px-4 py-2.5 rounded-xl font-medium font-ui">{hotkeySaveStatus}</div>}
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => handleSetDictationMode('interactive')} className={`relative p-5 rounded-2xl flex flex-col gap-2 transition cursor-pointer text-left border ${dictationMode === 'interactive' ? 'bg-white text-zinc-950 border-white/50 shadow-md font-bold' : 'skeuo-sub-panel text-zinc-300 hover:text-white border-white/[0.06]'}`}>
                      {dictationMode === 'interactive' && (<svg className="w-5 h-5 text-zinc-950 absolute top-4 right-4" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm3.707 8.707a1 1 0 00-1.414-1.414L11 12.586l-1.707-1.707a1 1 0 00-1.414 1.414l2.414 2.414a1 1 0 001.414 0l4.707-4.707z" clipRule="evenodd" /></svg>)}
                      <span className="font-ui text-sm font-bold">Interactive Review Mode</span>
                      <p className={`font-ui text-xs leading-relaxed ${dictationMode === 'interactive' ? 'text-zinc-700' : 'text-zinc-400'}`}>Click hotkey once to record. Displays a floating card to review, redo, or edit before pasting.</p>
                    </button>
                    <button onClick={() => handleSetDictationMode('push_to_talk')} className={`relative p-5 rounded-2xl flex flex-col gap-2 transition cursor-pointer text-left border ${dictationMode === 'push_to_talk' ? 'bg-white text-zinc-950 border-white/50 shadow-md font-bold' : 'skeuo-sub-panel text-zinc-300 hover:text-white border-white/[0.06]'}`}>
                      {dictationMode === 'push_to_talk' && (<svg className="w-5 h-5 text-zinc-950 absolute top-4 right-4" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm3.707 8.707a1 1 0 00-1.414-1.414L11 12.586l-1.707-1.707a1 1 0 00-1.414 1.414l2.414 2.414a1 1 0 001.414 0l4.707-4.707z" clipRule="evenodd" /></svg>)}
                      <span className="font-ui text-sm font-bold">Push-to-Talk Capsule</span>
                      <p className={`font-ui text-xs leading-relaxed ${dictationMode === 'push_to_talk' ? 'text-zinc-700' : 'text-zinc-400'}`}>Hold hotkey while speaking. Releasing key transcribes & auto-pastes directly into active app.</p>
                    </button>
                  </div>
                  <div className="skeuo-sub-panel rounded-2xl border border-white/[0.06] overflow-hidden text-xs">
                    <button type="button" onClick={() => setIsSafeguardsOpen(!isSafeguardsOpen)} className="w-full px-4 py-3 flex items-center justify-between font-ui font-semibold text-white cursor-pointer hover:bg-white/5 transition">
                      <span className="flex items-center gap-2"><span>🛡️</span> Built-in Smart Dictation Safeguards & Limits</span>
                      <span className="font-code text-xs text-zinc-400">{isSafeguardsOpen ? '▲ Hide' : '▼ View Details'}</span>
                    </button>
                    <AnimatePresence>
                      {isSafeguardsOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-4 pb-4 border-t border-white/[0.04]">
                          <ul className="font-ui text-[11px] text-zinc-400 leading-relaxed flex flex-col gap-2 list-disc pl-4 mt-3">
                            <li><strong>90-Second Max Recording Limit</strong>: Automatic stop and transcribe to prevent runaway audio buffers.</li>
                            <li><strong>15-Second Silence Auto-Pause</strong>: Auto-pauses recording if no audio volume is detected for 15 seconds.</li>
                            <li><strong>Active Text Field Validation</strong>: Verifies active focused window before injecting clipboard text.</li>
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'hotkeys' && (
              <motion.div key="hotkeys" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-6">
                <div>
                  <h2 className="font-display text-2xl font-normal text-white">Global Hotkeys & Screen Placement</h2>
                  <p className="font-ui text-xs text-zinc-400 mt-0.5">Configure OS-wide global key triggers and floating overlay position.</p>
                </div>
                {hotkeySaveStatus && (
                  <div
                    className={`text-xs px-4 py-2.5 rounded-xl font-medium font-ui border transition-all ${
                      hotkeySaveStatus.includes('failed') || hotkeySaveStatus.includes('error') || hotkeySaveStatus.includes('Failed')
                        ? 'bg-red-950/80 border-red-800 text-red-300'
                        : 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                    }`}
                  >
                    {hotkeySaveStatus}
                  </div>
                )}
                <div className="skeuo-sub-panel rounded-2xl px-6 py-4 flex items-center justify-between border border-white/[0.06] bg-[#09090c]/80">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-ui text-sm font-semibold text-white tracking-tight">
                      Active Global Key Trigger
                    </span>
                    <span className="font-ui text-[11px] text-zinc-400">
                      Press this key anywhere in Windows to start dictating
                    </span>
                  </div>
                  <span className="skeuo-raised-btn px-6 py-2.5 rounded-xl text-sm font-code font-bold text-zinc-950 tracking-wide shadow-md shrink-0">
                    {selectedShortcut}
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  <label className="font-ui text-xs font-semibold text-zinc-300">Quick Shortcut Presets</label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {PRESET_SHORTCUTS.map((preset) => (
                      <button key={preset} onClick={() => handleApplyPresetShortcut(preset)} className={`px-3 py-2.5 rounded-xl text-xs font-code transition cursor-pointer border ${selectedShortcut === preset ? 'bg-white text-zinc-950 font-bold border-white/40 shadow-md' : 'skeuo-sub-well text-zinc-300 hover:text-white hover:border-zinc-600'}`}>
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="skeuo-sub-panel rounded-2xl p-4 flex flex-col gap-3 border border-white/[0.06]">
                  <label className="font-ui text-xs font-semibold text-zinc-300">Build Custom Shortcut</label>
                  <div className="flex items-center gap-3">
                    <select value={customModifier} onChange={(e) => setCustomModifier(e.target.value)} className="skeuo-sub-well rounded-xl px-3 py-2 text-xs text-white font-code cursor-pointer">
                      <option value="None">None (Single Key)</option>
                      <option value="Ctrl + Alt">Ctrl + Alt</option>
                      <option value="Ctrl + Shift">Ctrl + Shift</option>
                      <option value="Alt">Alt</option>
                      <option value="Ctrl">Ctrl</option>
                      <option value="Shift">Shift</option>
                    </select>
                    <span className="font-ui text-xs text-zinc-400 font-bold">+</span>
                    <select value={customKey} onChange={(e) => setCustomKey(e.target.value)} className="skeuo-sub-well rounded-xl px-3 py-2 text-xs text-white font-code cursor-pointer">
                      <option value="Insert">Insert</option>
                      <option value="ScrollLock">ScrollLock</option>
                      <option value="Pause">Pause</option>
                      <option value="Space">Space</option>
                      <option value="F1">F1</option>
                      <option value="F2">F2</option>
                      <option value="F3">F3</option>
                      <option value="F4">F4</option>
                      <option value="F5">F5</option>
                      <option value="F6">F6</option>
                      <option value="F7">F7</option>
                      <option value="F8">F8</option>
                      <option value="F9">F9</option>
                      <option value="F10">F10</option>
                      <option value="F11">F11</option>
                      <option value="F12">F12</option>
                      <option value="D">D</option>
                      <option value="S">S</option>
                      <option value="A">A</option>
                      <option value="V">V</option>
                      <option value="Q">Q</option>
                      <option value="W">W</option>
                      <option value="Delete">Delete</option>
                      <option value="Home">Home</option>
                      <option value="End">End</option>
                      <option value="PageUp">PageUp</option>
                      <option value="PageDown">PageDown</option>
                      <option value="CapsLock">CapsLock</option>
                    </select>
                    <button onClick={handleSaveCustomShortcut} className="skeuo-raised-btn font-ui text-zinc-950 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ml-auto">Set Hotkey</button>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <label className="font-ui text-xs font-semibold text-zinc-300">Overlay Screen Position</label>
                  <div className="grid grid-cols-4 gap-2.5">
                    {[
                      { id: 'bottom-center', label: 'Bottom Center' },
                      { id: 'bottom-right', label: 'Bottom Right' },
                      { id: 'top-right', label: 'Top Right' },
                      { id: 'center', label: 'Screen Center' },
                    ].map((pos) => (
                      <button key={pos.id} onClick={() => handleSetOverlayPosition(pos.id)} className={`px-3 py-2 rounded-xl font-ui text-xs font-medium transition cursor-pointer border ${overlayPosition === pos.id ? 'bg-white text-zinc-950 font-bold border-white/40 shadow-md' : 'skeuo-sub-well text-zinc-300 hover:text-white hover:border-zinc-600'}`}>
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'prompts' && (
              <motion.div key="prompts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-6">
                <div>
                  <h2 className="font-display text-2xl font-normal text-white">AI Prompt Tuning & Presets</h2>
                  <p className="font-ui text-xs text-zinc-400 mt-0.5">Choose from specialized editing personas or write your custom LLM instructions.</p>
                </div>
                {saveStatus && <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs px-4 py-2.5 rounded-xl font-medium font-ui">{saveStatus}</div>}
                
                {/* Persona Presets */}
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <label className="font-ui text-xs font-semibold text-zinc-300">Preset Personas</label>
                    <span className="font-code text-[11px] text-zinc-400">Hover for details • Click to apply</span>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {PROMPT_PRESETS.map((preset) => {
                      const isSelected = systemPrompt.trim() === preset.prompt.trim();
                      const isHovered = hoveredPresetId === preset.id;
                      return (
                        <button key={preset.id} type="button" onMouseEnter={() => setHoveredPresetId(preset.id)} onMouseLeave={() => setHoveredPresetId(null)} onClick={() => handleApplySystemPromptPreset(preset.prompt)} className={`p-3.5 rounded-xl flex flex-col gap-1 transition cursor-pointer text-left border ${isSelected ? 'bg-white text-zinc-950 border-white/50 shadow-md font-bold' : 'skeuo-sub-panel text-zinc-300 hover:text-white border-white/[0.06]'}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-ui text-xs font-bold">{preset.name}</span>
                            {isSelected && <span className="text-[10px] bg-zinc-950 text-white px-2 py-0.5 rounded font-code font-semibold">ACTIVE</span>}
                          </div>
                          <AnimatePresence>
                            {(isHovered || isSelected) && (
                              <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className={`font-ui text-[11px] leading-relaxed mt-1 overflow-hidden ${isSelected ? 'text-zinc-700' : 'text-zinc-400'}`}>{preset.desc}</motion.p>
                            )}
                          </AnimatePresence>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Developer Mode Spoken Length & Prompt Expansion Showcase */}
                <div className="skeuo-sub-panel rounded-2xl p-5 flex flex-col gap-3.5 border border-white/[0.06] bg-[#09090c]/80">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⚡</span>
                      <span className="font-ui text-xs font-bold text-white tracking-wide">Developer Mode: Spoken Length & Prompt Expansion</span>
                    </div>
                    <span className="text-[10px] font-code bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 px-2.5 py-0.5 rounded-full font-semibold">AUTO-DETECT ACTIVE</span>
                  </div>

                  <p className="font-ui text-xs text-zinc-400 leading-relaxed">
                    When using <strong>Developer Mode</strong>, you can speak natural length adjustments and prompt enhancement commands. The engine automatically strips the command phrase, extracts the technical seed thought, and enriches it with architectural requirements, input/output contracts, and code syntax to match your target length.
                  </p>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div className="skeuo-sub-well p-3 rounded-xl border border-white/[0.04] flex flex-col gap-1">
                      <span className="font-code text-[11px] text-zinc-200 font-semibold flex items-center gap-1.5">
                        <span className="text-cyan-400 font-bold">🗣️</span> "make it 50 words"
                      </span>
                      <p className="font-ui text-[11px] text-zinc-400 leading-tight">Expands the spoken concept to approximately 50 words with technical details.</p>
                    </div>
                    <div className="skeuo-sub-well p-3 rounded-xl border border-white/[0.04] flex flex-col gap-1">
                      <span className="font-code text-[11px] text-zinc-200 font-semibold flex items-center gap-1.5">
                        <span className="text-purple-400 font-bold">🗣️</span> "enhance this prompt to more words"
                      </span>
                      <p className="font-ui text-[11px] text-zinc-400 leading-tight">Generates a comprehensive specification covering inputs, outputs, and edge cases.</p>
                    </div>
                    <div className="skeuo-sub-well p-3 rounded-xl border border-white/[0.04] flex flex-col gap-1">
                      <span className="font-code text-[11px] text-zinc-200 font-semibold flex items-center gap-1.5">
                        <span className="text-amber-400 font-bold">🗣️</span> "expand to 100 words"
                      </span>
                      <p className="font-ui text-[11px] text-zinc-400 leading-tight">Builds an in-depth multi-section prompt or PR description.</p>
                    </div>
                    <div className="skeuo-sub-well p-3 rounded-xl border border-white/[0.04] flex flex-col gap-1">
                      <span className="font-code text-[11px] text-zinc-200 font-semibold flex items-center gap-1.5">
                        <span className="text-emerald-400 font-bold">🗣️</span> "condense to 20 words"
                      </span>
                      <p className="font-ui text-[11px] text-zinc-400 leading-tight">Distills wordy thoughts into a punchy, minimal developer command.</p>
                    </div>
                  </div>
                </div>

                {/* Custom Prompt Instructions */}
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex justify-between items-center">
                    <label className="font-ui text-xs font-semibold text-zinc-300">Custom Prompt Instructions</label>
                    <button type="button" onClick={() => handleApplySystemPromptPreset(systemPrompt)} className="font-ui text-xs text-white font-semibold underline hover:text-zinc-300 transition cursor-pointer">Save Custom Prompt</button>
                  </div>
                  <textarea rows={8} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} className="skeuo-sub-well w-full rounded-xl p-3.5 text-xs text-zinc-200 font-code leading-relaxed focus:outline-none transition resize-none" />
                </div>
              </motion.div>
            )}

            {activeTab === 'article' && (
              <motion.div key="article" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-6 max-w-2xl">
                <div>
                  <div className="flex items-center gap-2 font-code text-xs text-zinc-400 mb-1">
                    <span>STORY</span> • <span>THE INSPIRATION</span>
                  </div>
                  <h2 className="font-display text-3xl font-normal text-white tracking-normal leading-snug">Why I Built Rusper</h2>
                  <p className="font-ui text-xs text-zinc-400 mt-1">A personal project built for speed, simplicity, and freedom.</p>
                </div>
                <div className="skeuo-sub-panel rounded-2xl p-6 flex flex-col gap-4 border border-white/[0.06] bg-[#09090c]/60">
                  <article className="font-ui text-zinc-300 leading-relaxed flex flex-col gap-4 text-sm">
                    <p>
                      Recently, I saw an advertisement for tools like Whisper Flow and other voice dictation apps. The core concept felt magical: just talk, and your thoughts appear instantly on the screen without typing.
                    </p>
                    <p>
                      However, when I checked them out, I realized almost all of them were either bloated or locked behind recurring monthly subscriptions. I wondered: <em>why should something as natural as speaking to your computer cost a monthly fee?</em>
                    </p>
                    <p>
                      I had never worked with <strong>Rust</strong> before. But I did know one thing: <strong>Rust makes desktop software blazingly fast and lightweight.</strong> So I teamed up with <strong>Antigravity</strong> to build <strong>Rusper</strong> from scratch.
                    </p>
                    <p>
                      Rusper is <strong>100% free</strong> and open. There are no subscriptions, no credit cards, and no paywalls. All you need is your own free Groq API key, and it works like an absolute charm—transcribing your voice in milliseconds across any code editor, browser, or app you use.
                    </p>
                    <p className="text-zinc-400 text-xs italic pt-2 border-t border-white/[0.06]">
                      I hope Rusper saves you countless hours of typing and lets your ideas flow naturally. Enjoy! ✨
                    </p>
                  </article>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}

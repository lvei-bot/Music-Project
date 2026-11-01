/**
 * Mode A: Instrument Trainer Component
 * Complete setup, active session, history traversal, reveal controls,
 * difficult bookmarks, duration extensions, presets, and 100% silent pacing.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle,
  Bookmark,
  BookmarkCheck,
  Settings,
  Eye,
  EyeOff,
  Clock,
  Sparkles,
  Save,
  Trash2,
  X,
  Plus,
} from 'lucide-react';
import {
  ScaleType,
  ChordTypeFilter,
  InversionType,
  DiatonicChord,
  buildDiatonicChord,
  formatScaleName,
  CIRCLE_OF_FIFTHS,
  TONICS_BY_PITCH_CLASS,
} from '../theory/musicEngine';
import {
  CompletedSessionRecord,
  DifficultChordBookmark,
  SettingsPreset,
  saveBookmark,
  deleteBookmark,
  saveCompletedSession,
  saveActiveRecovery,
  savePreset,
  deletePreset,
} from '../storage/indexedDb';
import { formatDurationMs } from '../session/timingEngine';

export interface InstrumentTrainerSettings {
  displayMode: 'arabic' | 'roman' | 'chord_name';
  enabledPitchClasses: number[]; // 0..11
  keyChangeMode: 'fixed' | 'after_chords' | 'after_time';
  keyChangeInterval: number; // chords count or seconds
  keyProgression: 'circle_of_fifths' | 'random';
  enabledScales: ScaleType[];
  scaleChangeMode: 'per_chord' | 'on_key_change' | 'manual';
  enabledDegrees: number[]; // 1..7
  chordType: ChordTypeFilter;
  inversion: 'root' | 'first' | 'second' | 'third' | 'any';
  ordering: 'sequential' | 'random' | 'no_repeat' | 'shuffled_cycle';
  progressionMode: 'manual' | 'auto';
  autoIntervalSeconds: number; // 1, 2, 3, 5, or custom
  startCountdown: 0 | 3 | 5;
  timerDisplayStyle: 'progress_seconds' | 'seconds' | 'hidden';
  plannedDurationMinutes: number | null; // null = unlimited
  hideChordName: boolean;
  hideNotes: boolean;
}

export const DEFAULT_TRAINER_SETTINGS: InstrumentTrainerSettings = {
  displayMode: 'chord_name',
  enabledPitchClasses: [0], // C by default
  keyChangeMode: 'fixed',
  keyChangeInterval: 10,
  keyProgression: 'circle_of_fifths',
  enabledScales: ['major'],
  scaleChangeMode: 'on_key_change',
  enabledDegrees: [1, 2, 3, 4, 5, 6, 7],
  chordType: 'triads',
  inversion: 'root',
  ordering: 'shuffled_cycle',
  progressionMode: 'auto',
  autoIntervalSeconds: 3,
  startCountdown: 3,
  timerDisplayStyle: 'progress_seconds',
  plannedDurationMinutes: 5,
  hideChordName: false,
  hideNotes: false,
};

interface InstrumentTrainerViewProps {
  onSessionComplete: (session: CompletedSessionRecord) => void;
  bookmarks: DifficultChordBookmark[];
  onRefreshBookmarks: () => void;
  presets: SettingsPreset[];
  onRefreshPresets: () => void;
  initialSettings?: Partial<InstrumentTrainerSettings>;
  forcedChords?: DiatonicChord[]; // For focused review or collections
}

export const InstrumentTrainerView: React.FC<InstrumentTrainerViewProps> = ({
  onSessionComplete,
  bookmarks,
  onRefreshBookmarks,
  presets,
  onRefreshPresets,
  initialSettings,
  forcedChords,
}) => {
  const [settings, setSettings] = useState<InstrumentTrainerSettings>({
    ...DEFAULT_TRAINER_SETTINGS,
    ...initialSettings,
  });

  const [sessionState, setSessionState] = useState<'setup' | 'countdown' | 'active' | 'expired' | 'completed'>('setup');
  const [countdownRemaining, setCountdownRemaining] = useState<number>(3);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [showInSessionSettings, setShowInSessionSettings] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [revealed, setRevealed] = useState<boolean>(false);

  // Timing tracking
  const [activeElapsedMs, setActiveElapsedMs] = useState<number>(0);
  const [pausedElapsedMs, setPausedElapsedMs] = useState<number>(0);
  const [chordRemainingMs, setChordRemainingMs] = useState<number>(0);
  const [cumulativeExtensionMinutes, setCumulativeExtensionMinutes] = useState<number>(0);

  // History & Navigation
  const [chordHistory, setChordHistory] = useState<DiatonicChord[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  // Generator pool state
  const poolRef = useRef<DiatonicChord[]>([]);
  const currentKeyIndexRef = useRef<number>(0);
  const chordsInCurrentKeyRef = useRef<number>(0);
  const keyTimeElapsedRef = useRef<number>(0);

  // Preset management modal
  const [newPresetName, setNewPresetName] = useState('');
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);

  // Wall clock tracking
  const sessionStartTimeRef = useRef<number>(0);
  const lastActiveTimestampRef = useRef<number>(0);
  const lastPauseTimestampRef = useRef<number>(0);

  const currentChord: DiatonicChord | null =
    currentIndex >= 0 && currentIndex < chordHistory.length ? chordHistory[currentIndex] : null;

  const isBookmarked = currentChord
    ? bookmarks.some(b => b.chordName === currentChord.name && b.keyTonic === currentChord.keyTonic)
    : false;

  // ---------------- GENERATOR LOGIC ----------------

  const getTonicName = (pc: number): string => {
    return TONICS_BY_PITCH_CLASS[pc]?.major || 'C';
  };

  const generateNextChord = (): DiatonicChord => {
    // If forced chords exist (e.g. from collections or bookmarks)
    if (forcedChords && forcedChords.length > 0) {
      if (settings.ordering === 'sequential') {
        const nextIdx = chordHistory.length % forcedChords.length;
        return forcedChords[nextIdx];
      }
      return forcedChords[Math.floor(Math.random() * forcedChords.length)];
    }

    // Determine current Key
    let tonic = getTonicName(settings.enabledPitchClasses[0] ?? 0);
    if (settings.enabledPitchClasses.length > 1) {
      if (settings.keyChangeMode === 'after_chords' && chordsInCurrentKeyRef.current >= settings.keyChangeInterval) {
        currentKeyIndexRef.current = (currentKeyIndexRef.current + 1) % settings.enabledPitchClasses.length;
        chordsInCurrentKeyRef.current = 0;
      }
      const pc = settings.enabledPitchClasses[currentKeyIndexRef.current % settings.enabledPitchClasses.length];
      tonic = getTonicName(pc);
    }

    // Determine Scale
    const scale = settings.enabledScales.length > 0 ? settings.enabledScales[0] : 'major';

    // If pool empty, repopulate
    if (poolRef.current.length === 0) {
      const candidates: DiatonicChord[] = [];
      for (const deg of settings.enabledDegrees) {
        if (settings.chordType === 'triads' || settings.chordType === 'both') {
          let inv: InversionType = 0;
          if (settings.inversion === 'first') inv = 1;
          else if (settings.inversion === 'second') inv = 2;
          else if (settings.inversion === 'any') inv = Math.floor(Math.random() * 3) as InversionType;
          candidates.push(buildDiatonicChord(tonic, scale, deg, 'triad', inv));
        }
        if (settings.chordType === 'sevenths' || settings.chordType === 'both') {
          let inv: InversionType = 0;
          if (settings.inversion === 'first') inv = 1;
          else if (settings.inversion === 'second') inv = 2;
          else if (settings.inversion === 'third') inv = 3;
          else if (settings.inversion === 'any') inv = Math.floor(Math.random() * 4) as InversionType;
          candidates.push(buildDiatonicChord(tonic, scale, deg, 'seventh', inv));
        }
      }

      if (settings.ordering === 'shuffled_cycle') {
        poolRef.current = candidates.sort(() => Math.random() - 0.5);
      } else {
        poolRef.current = candidates;
      }
    }

    let nextChord: DiatonicChord;
    if (settings.ordering === 'sequential') {
      nextChord = poolRef.current.shift()!;
    } else if (settings.ordering === 'shuffled_cycle') {
      nextChord = poolRef.current.shift()!;
    } else if (settings.ordering === 'no_repeat') {
      const lastChord = chordHistory[chordHistory.length - 1];
      const filtered = poolRef.current.filter(c => !lastChord || c.name !== lastChord.name);
      nextChord = (filtered.length > 0 ? filtered : poolRef.current)[Math.floor(Math.random() * poolRef.current.length)];
    } else {
      // fully random
      nextChord = poolRef.current[Math.floor(Math.random() * poolRef.current.length)];
    }

    chordsInCurrentKeyRef.current += 1;
    return nextChord;
  };

  // ---------------- SESSION START / CONTROLS ----------------

  const handleStartSession = () => {
    // Validate configuration
    if (settings.enabledDegrees.length === 0) {
      alert('Please enable at least one scale degree (1–7).');
      return;
    }
    if (settings.enabledScales.length === 0) {
      alert('Please enable at least one scale.');
      return;
    }
    if (settings.enabledPitchClasses.length === 0) {
      alert('Please enable at least one key.');
      return;
    }

    poolRef.current = [];
    currentKeyIndexRef.current = 0;
    chordsInCurrentKeyRef.current = 0;
    keyTimeElapsedRef.current = 0;

    const first = generateNextChord();
    setChordHistory([first]);
    setCurrentIndex(0);
    setRevealed(false);
    setShowDetails(false);
    setActiveElapsedMs(0);
    setPausedElapsedMs(0);
    setCumulativeExtensionMinutes(0);
    setChordRemainingMs(settings.autoIntervalSeconds * 1000);
    setIsPaused(false);

    sessionStartTimeRef.current = Date.now();
    lastActiveTimestampRef.current = Date.now();

    if (settings.startCountdown > 0 && settings.progressionMode === 'auto') {
      setCountdownRemaining(settings.startCountdown);
      setSessionState('countdown');
    } else {
      setSessionState('active');
    }
  };

  const handleNextChord = () => {
    setRevealed(false);
    if (currentIndex < chordHistory.length - 1) {
      // Traversing existing forward
      setCurrentIndex(prev => prev + 1);
    } else {
      // Generate new chord
      const next = generateNextChord();
      setChordHistory(prev => [...prev, next]);
      setCurrentIndex(prev => prev + 1);
    }
    setChordRemainingMs(settings.autoIntervalSeconds * 1000);
  };

  const handlePreviousChord = () => {
    if (currentIndex > 0) {
      // In auto mode, Previous automatically pauses
      if (settings.progressionMode === 'auto' && !isPaused) {
        setIsPaused(true);
        lastPauseTimestampRef.current = Date.now();
      }
      setCurrentIndex(prev => prev - 1);
      setRevealed(false);
    }
  };

  const handleTogglePause = () => {
    if (isPaused) {
      // Resume: jump to newest chord and restart countdown
      setIsPaused(false);
      setCurrentIndex(chordHistory.length - 1);
      setChordRemainingMs(settings.autoIntervalSeconds * 1000);
      lastActiveTimestampRef.current = Date.now();
      if (lastPauseTimestampRef.current) {
        setPausedElapsedMs(prev => prev + (Date.now() - lastPauseTimestampRef.current));
      }
    } else {
      setIsPaused(true);
      lastPauseTimestampRef.current = Date.now();
    }
  };

  const handleToggleBookmark = async () => {
    if (!currentChord) return;
    if (isBookmarked) {
      const existing = bookmarks.find(b => b.chordName === currentChord.name && b.keyTonic === currentChord.keyTonic);
      if (existing) {
        await deleteBookmark(existing.id);
        onRefreshBookmarks();
      }
    } else {
      const newBk: DifficultChordBookmark = {
        id: `bk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        chordName: currentChord.name,
        keyTonic: currentChord.keyTonic,
        scaleType: currentChord.scaleType,
        degree: currentChord.degree,
        quality: currentChord.quality,
        romanNumeral: currentChord.romanNumeral,
        notes: currentChord.notes.map(n => n.formatted),
        createdAt: Date.now(),
        mastered: false,
      };
      await saveBookmark(newBk);
      onRefreshBookmarks();
    }
  };

  const handleExtendSession = (additionalMinutes: number) => {
    setCumulativeExtensionMinutes(prev => prev + additionalMinutes);
    setSessionState('active');
    setIsPaused(false);
    lastActiveTimestampRef.current = Date.now();
  };

  const handleEndSession = async () => {
    const now = Date.now();
    const finalWallClock = Math.floor((now - sessionStartTimeRef.current) / 1000);
    const finalActive = Math.floor(activeElapsedMs / 1000);
    const finalPaused = Math.floor(pausedElapsedMs / 1000);

    const record: CompletedSessionRecord = {
      id: `session_inst_${Date.now()}`,
      mode: 'instrument',
      startedAt: sessionStartTimeRef.current,
      completedAt: now,
      activeDurationSeconds: finalActive,
      pausedDurationSeconds: finalPaused,
      wallClockDurationSeconds: finalWallClock,
      settingsSnapshot: { ...settings },
      summary: {
        totalItems: chordHistory.length,
      },
      excludedFromAnalytics: false,
    };

    await saveCompletedSession(record, []);
    await saveActiveRecovery(null);
    onSessionComplete(record);
    setSessionState('completed');
  };

  // ---------------- AUTO-PAUSE & LIFECYCLE ----------------

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && sessionState === 'active' && !isPaused) {
        setIsPaused(true);
        lastPauseTimestampRef.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [sessionState, isPaused]);

  // Save active recovery periodically
  useEffect(() => {
    if (sessionState === 'active' && currentChord) {
      saveActiveRecovery({
        id: 'recovery_trainer',
        mode: 'instrument',
        savedAt: Date.now(),
        activeElapsedMs,
        settings,
        state: {
          chordHistory,
          currentIndex,
        },
      });
    }
  }, [sessionState, activeElapsedMs, currentIndex, chordHistory, settings]);

  // Main countdown timer (silent 3s/5s start)
  useEffect(() => {
    if (sessionState !== 'countdown') return;

    const timer = setInterval(() => {
      setCountdownRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setSessionState('active');
          lastActiveTimestampRef.current = Date.now();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionState]);

  // Main tick loop for active practice
  useEffect(() => {
    if (sessionState !== 'active' || isPaused) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - (lastActiveTimestampRef.current || now);
      lastActiveTimestampRef.current = now;

      setActiveElapsedMs(prev => {
        const next = prev + delta;

        // Check planned session duration
        const totalAllowance = settings.plannedDurationMinutes
          ? (settings.plannedDurationMinutes + cumulativeExtensionMinutes) * 60 * 1000
          : null;

        if (totalAllowance && next >= totalAllowance) {
          setSessionState('expired');
        }

        return next;
      });

      // Auto progression countdown
      if (settings.progressionMode === 'auto') {
        setChordRemainingMs(prev => {
          if (prev <= 100) {
            handleNextChord();
            return settings.autoIntervalSeconds * 1000;
          }
          return prev - 100;
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [sessionState, isPaused, settings, cumulativeExtensionMinutes, currentIndex, chordHistory]);

  // ---------------- RENDER ----------------

  if (sessionState === 'setup') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-200">
        <div className="border-b border-[#29251F]/15 dark:border-[#EDE8E1]/15 pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#A68A55] dark:text-[#CBB07E]">
              <span>Mode A</span>
              <span>•</span>
              <span>Hands-Free Instrument Practice</span>
            </div>
            <h1 className="font-editorial text-3xl font-bold text-[#29251F] dark:text-[#EDE8E1] mt-1">
              Instrument Trainer Setup
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSavePresetModal(true)}
              type="button"
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[#29251F]/20 dark:border-[#EDE8E1]/20 text-[#29251F] dark:text-[#EDE8E1] hover:bg-[#EAE5DC] dark:hover:bg-[#221F1C] flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Preset</span>
            </button>
            <button
              onClick={handleStartSession}
              type="button"
              className="px-5 py-2 text-xs font-bold rounded-lg bg-[#29251F] dark:bg-[#EDE8E1] text-[#F8F6F1] dark:text-[#181614] hover:bg-black dark:hover:bg-white flex items-center gap-2 shadow-xs"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Session</span>
            </button>
          </div>
        </div>

        {/* Presets List */}
        {presets.filter(p => p.mode === 'instrument').length > 0 && (
          <div className="p-4 rounded-xl bg-[#EAE5DC]/30 dark:bg-[#221F1C]/30 border border-[#29251F]/10 dark:border-[#EDE8E1]/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A68A55] dark:text-[#CBB07E] block mb-2">
              Saved Presets
            </span>
            <div className="flex flex-wrap gap-2">
              {presets.filter(p => p.mode === 'instrument').map(p => (
                <div key={p.id} className="inline-flex items-center gap-1 bg-[#F8F6F1] dark:bg-[#181614] border border-[#29251F]/15 dark:border-[#EDE8E1]/15 rounded-lg px-2.5 py-1 text-xs">
                  <button
                    onClick={() => setSettings({ ...DEFAULT_TRAINER_SETTINGS, ...p.settings })}
                    type="button"
                    className="font-semibold text-[#29251F] dark:text-[#EDE8E1] hover:text-[#A68A55]"
                  >
                    {p.name}
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`Delete preset "${p.name}"?`)) {
                        await deletePreset(p.id);
                        onRefreshPresets();
                      }
                    }}
                    type="button"
                    className="text-[#29251F]/40 hover:text-red-500 p-0.5"
                    aria-label="Delete preset"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Configuration Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Display & Tonics */}
          <div className="p-5 rounded-2xl bg-[#EAE5DC]/20 dark:bg-[#221F1C]/20 border border-[#29251F]/10 dark:border-[#EDE8E1]/10 space-y-4">
            <h3 className="font-editorial font-bold text-base text-[#29251F] dark:text-[#EDE8E1]">
              1. Display & Keys
            </h3>

            <div>
              <label className="text-xs font-semibold text-[#29251F]/70 dark:text-[#EDE8E1]/70 block mb-1.5">
                Primary Display Notation
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['chord_name', 'roman', 'arabic'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, displayMode: mode }))}
                    className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition-all ${
                      settings.displayMode === mode
                        ? 'bg-[#29251F] dark:bg-[#EDE8E1] text-[#F8F6F1] dark:text-[#181614] border-transparent'
                        : 'border-[#29251F]/15 dark:border-[#EDE8E1]/15 text-[#29251F]/70 dark:text-[#EDE8E1]/70'
                    }`}
                  >
                    {mode === 'chord_name' ? 'Chord Names' : mode === 'roman' ? 'Roman (I-vii)' : 'Arabic (1-7)'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#29251F]/70 dark:text-[#EDE8E1]/70">
                  Select Keys (Pitch Classes)
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, enabledPitchClasses: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }))}
                    className="text-[10px] font-bold text-[#A68A55] hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-xs text-[#29251F]/30">•</span>
                  <button
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, enabledPitchClasses: [0] }))}
                    className="text-[10px] font-bold text-[#A68A55] hover:underline"
                  >
                    Clear (C Only)
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(pc => {
                  const tonicName = getTonicName(pc);
                  const isSelected = settings.enabledPitchClasses.includes(pc);
                  return (
                    <button
                      key={pc}
                      type="button"
                      onClick={() => {
                        setSettings(s => {
                          const exists = s.enabledPitchClasses.includes(pc);
                          if (exists && s.enabledPitchClasses.length === 1) return s; // Keep at least one
                          const next = exists
                            ? s.enabledPitchClasses.filter(x => x !== pc)
                            : [...s.enabledPitchClasses, pc];
                          return { ...s, enabledPitchClasses: next };
                        });
                      }}
                      className={`h-9 text-xs font-bold rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-[#A68A55] text-white border-[#A68A55]'
                          : 'bg-[#F8F6F1] dark:bg-[#181614] border-[#29251F]/15 dark:border-[#EDE8E1]/15 text-[#29251F]/80 dark:text-[#EDE8E1]/80'
                      }`}
                    >
                      {tonicName}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Scales & Degrees */}
          <div className="p-5 rounded-2xl bg-[#EAE5DC]/20 dark:bg-[#221F1C]/20 border border-[#29251F]/10 dark:border-[#EDE8E1]/10 space-y-4">
            <h3 className="font-editorial font-bold text-base text-[#29251F] dark:text-[#EDE8E1]">
              2. Scales & Degrees
            </h3>

            <div>
              <label className="text-xs font-semibold text-[#29251F]/70 dark:text-[#EDE8E1]/70 block mb-1.5">
                Enabled Scales
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['major', 'natural_minor', 'harmonic_minor'] as ScaleType[]).map(sc => {
                  const isChecked = settings.enabledScales.includes(sc);
                  return (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => {
                        setSettings(s => {
                          const exists = s.enabledScales.includes(sc);
                          if (exists && s.enabledScales.length === 1) return s;
                          return {
                            ...s,
                            enabledScales: exists ? s.enabledScales.filter(x => x !== sc) : [...s.enabledScales, sc],
                          };
                        });
                      }}
                      className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition-all ${
                        isChecked
                          ? 'bg-[#29251F] dark:bg-[#EDE8E1] text-[#F8F6F1] dark:text-[#181614] border-transparent'
                          : 'border-[#29251F]/15 dark:border-[#EDE8E1]/15 text-[#29251F]/70 dark:text-[#EDE8E1]/70'
                      }`}
                    >
                      {formatScaleName(sc)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#29251F]/70 dark:text-[#EDE8E1]/70">
                  Scale Degrees (1–7)
                </label>
                <button
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, enabledDegrees: [1, 2, 3, 4, 5, 6, 7] }))}
                  className="text-[10px] font-bold text-[#A68A55] hover:underline"
                >
                  Enable All
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {[1, 2, 3, 4, 5, 6, 7].map(deg => {
                  const isSelected = settings.enabledDegrees.includes(deg);
                  return (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => {
                        setSettings(s => {
                          const exists = s.enabledDegrees.includes(deg);
                          if (exists && s.enabledDegrees.length === 1) return s;
                          return {
                            ...s,
                            enabledDegrees: exists ? s.enabledDegrees.filter(x => x !== deg) : [...s.enabledDegrees, deg],
                          };
                        });
                      }}
                      className={`h-9 text-xs font-bold rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-[#A68A55] text-white border-[#A68A55]'
                          : 'bg-[#F8F6F1] dark:bg-[#181614] border-[#29251F]/15 dark:border-[#EDE8E1]/15 text-[#29251F]/80 dark:text-[#EDE8E1]/80'
                      }`}
                    >
                      {deg}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-semibold text-[#29251F]/70 dark:text-[#EDE8E1]/70 block mb-1">
                  Chord Voicing
                </label>
                <select
                  value={settings.chordType}
                  onChange={e => setSettings(s => ({ ...s, chordType: e.target.value as ChordTypeFilter }))}
                  className="w-full text-xs font-semibold py-1.5 px-2 rounded-lg bg-[#F8F6F1] dark:bg-[#181614] border border-[#29251F]/15 dark:border-[#EDE8E1]/15 text-[#29251F] dark:text-[#EDE8E1]"
                >
                  <option value="triads">Triads (Default)</option>
                  <option value="sevenths">7th Chords</option>
                  <option value="both">Mixed Triads & 7ths</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#29251F]/70 dark:text-[#EDE8E1]/70 block mb-1">
                  Inversion
                </label>
                <select
                  value={settings.inversion}
                  onChange={e => setSettings(s => ({ ...s, inversion: e.target.value as any }))}
                  className="w-full text-xs font-semibold py-1.5 px-2 rounded-lg bg-[#F8F6F1] dark:bg-[#181614] border border-[#29251F]/15 dark:border-[#EDE8E1]/15 text-[#29251F] dark:text-[#EDE8E1]"
                >
                  <option value="root">Root Position Only</option>
                  <option value="first">1st Inversion</option>
                  <option value="second">2nd Inversion</option>
                  <option value="third">3rd Inversion (7ths)</option>
                  <option value="any">Random Valid Inversion</option>
                </select>
              </div>
            </div>
          </div>

          {/* Progression & Pacing */}
          <div className="p-5 rounded-2xl bg-[#EAE5DC]/20 dark:bg-[#221F1C]/20 border border-[#29251F]/10 dark:border-[#EDE8E1]/10 space-y-4">
            <h3 className="font-editorial font-bold text-base text-[#29251F] dark:text-[#EDE8E1]">
              3. Progression & Timing
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#29251F]/70 dark:text-[#EDE8E1]/70 block mb-1">
                  Progression Mode
                </label>
                <select
                  value={settings.progressionMode}
                  onChange={e => setSettings(s => ({ ...s, progressionMode: e.target.value as any }))}
                  className="w-full text-xs font-semibold py-1.5 px-2 rounded-lg bg-[#F8F6F1] dark:bg-[#181614] border border-[#29251F]/15 dark:border-[#EDE8E1]/15 text-[#29251F] dark:text-[#EDE8E1]"
                >
                  <option value="auto">Auto-Advancing (Timer)</option>
                  <option value="manual">Manual (Press Next)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#29251F]/70 dark:text-[#EDE8E1]/70 block mb-1">
                  Time Per Chord
                </label>
                <select
                  disabled={settings.progressionMode === 'manual'}
                  value={settings.autoIntervalSeconds}
                  onChange={e => setSettings(s => ({ ...s, autoIntervalSeconds: Number(e.target.value) }))}
                  className="w-full text-xs font-semibold py-1.5 px-2 rounded-lg bg-[#F8F6F1] dark:bg-[#181614] border border-[#29251F]/15 dark:border-[#EDE8E1]/15 text-[#29251F] dark:text-[#EDE8E1] disabled:opacity-40"
                >
                  <option value={1}>1 second (Brisk)</option>
                  <option value={2}>2 seconds</option>
                  <option value={3}>3 seconds (Standard)</option>
                  <option value={5}>5 seconds</option>
                  <option value={8}>8 seconds</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#29251F]/70 dark:text-[#EDE8E1]/70 block mb-1">
                  Session Duration
                </label>
                <select
                  value={settings.plannedDurationMinutes ?? 'unlimited'}
                  onChange={e => setSettings(s => ({ ...s, plannedDurationMinutes: e.target.value === 'unlimited' ? null : Number(e.target.value) }))}
                  className="w-full text-xs font-semibold py-1.5 px-2 rounded-lg bg-[#F8F6F1] dark:bg-[#181614] border border-[#29251F]/15 dark:border-[#EDE8E1]/15 text-[#29251F] dark:text-[#EDE8E1]"
                >
                  <option value={1}>1 minute</option>
                  <option value={3}>3 minutes</option>
                  <option value={5}>5 minutes</option>
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value="unlimited">Unlimited (Manual End)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#29251F]/70 dark:text-[#EDE8E1]/70 block mb-1">
                  Silent Countdown
                </label>
                <select
                  value={settings.startCountdown}
                  onChange={e => setSettings(s => ({ ...s, startCountdown: Number(e.target.value) as any }))}
                  className="w-full text-xs font-semibold py-1.5 px-2 rounded-lg bg-[#F8F6F1] dark:bg-[#181614] border border-[#29251F]/15 dark:border-[#EDE8E1]/15 text-[#29251F] dark:text-[#EDE8E1]"
                >
                  <option value={0}>None</option>
                  <option value={3}>3 seconds (Default)</option>
                  <option value={5}>5 seconds</option>
                </select>
              </div>
            </div>
          </div>

          {/* Reveal & Ordering Options */}
          <div className="p-5 rounded-2xl bg-[#EAE5DC]/20 dark:bg-[#221F1C]/20 border border-[#29251F]/10 dark:border-[#EDE8E1]/10 space-y-4">
            <h3 className="font-editorial font-bold text-base text-[#29251F] dark:text-[#EDE8E1]">
              4. Ordering & Reveal
            </h3>

            <div>
              <label className="text-xs font-semibold text-[#29251F]/70 dark:text-[#EDE8E1]/70 block mb-1">
                Progression Order
              </label>
              <select
                value={settings.ordering}
                onChange={e => setSettings(s => ({ ...s, ordering: e.target.value as any }))}
                className="w-full text-xs font-semibold py-1.5 px-2 rounded-lg bg-[#F8F6F1] dark:bg-[#181614] border border-[#29251F]/15 dark:border-[#EDE8E1]/15 text-[#29251F] dark:text-[#EDE8E1]"
              >
                <option value="shuffled_cycle">Shuffled Cycle (Exhaust pool before repeat)</option>
                <option value="no_repeat">No Immediate Repeat Random</option>
                <option value="sequential">Sequential Scale Order (1-7)</option>
                <option value="random">Fully Random</option>
              </select>
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#29251F]/80 dark:text-[#EDE8E1]/80">
                <input
                  type="checkbox"
                  checked={settings.hideChordName}
                  onChange={e => setSettings(s => ({ ...s, hideChordName: e.target.checked }))}
                  className="rounded border-[#29251F]/20 text-[#A68A55] focus:ring-[#A68A55]"
                />
                <span>Hide Chord Name initially (Require manual "Reveal" or self-testing)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#29251F]/80 dark:text-[#EDE8E1]/80">
                <input
                  type="checkbox"
                  checked={settings.hideNotes}
                  onChange={e => setSettings(s => ({ ...s, hideNotes: e.target.checked }))}
                  className="rounded border-[#29251F]/20 text-[#A68A55] focus:ring-[#A68A55]"
                />
                <span>Hide Individual Spelled Notes by default</span>
              </label>
            </div>
          </div>
        </div>

        {/* Save Preset Modal */}
        {showSavePresetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-xl bg-[#F8F6F1] dark:bg-[#181614] border border-[#29251F]/20 dark:border-[#EDE8E1]/20 p-5 shadow-2xl space-y-4">
              <h3 className="font-editorial font-bold text-base text-[#29251F] dark:text-[#EDE8E1]">
                Save Current Trainer Settings
              </h3>
              <input
                type="text"
                placeholder="e.g. Major Triads 3s Cycle"
                value={newPresetName}
                onChange={e => setNewPresetName(e.target.value)}
                className="w-full text-xs font-semibold p-2 rounded-lg bg-[#EAE5DC]/50 dark:bg-[#221F1C]/50 border border-[#29251F]/20 dark:border-[#EDE8E1]/20 text-[#29251F] dark:text-[#EDE8E1] outline-hidden focus:border-[#A68A55]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSavePresetModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md border border-[#29251F]/20 dark:border-[#EDE8E1]/20"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!newPresetName.trim()) return;
                    await savePreset({
                      id: `preset_inst_${Date.now()}`,
                      mode: 'instrument',
                      name: newPresetName.trim(),
                      settings: { ...settings },
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                    });
                    onRefreshPresets();
                    setShowSavePresetModal(false);
                    setNewPresetName('');
                  }}
                  className="px-4 py-1.5 text-xs font-bold rounded-md bg-[#A68A55] text-white"
                >
                  Save Preset
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------- COUNTDOWN VIEW ----------------
  if (sessionState === 'countdown') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-6 text-center animate-in fade-in duration-300">
        <span className="text-xs uppercase font-bold tracking-widest text-[#A68A55] dark:text-[#CBB07E]">
          Ready at Instrument • Silent Start
        </span>
        <div className="font-editorial text-8xl sm:text-9xl font-bold text-[#29251F] dark:text-[#EDE8E1]">
          {countdownRemaining}
        </div>
        <p className="text-xs text-[#29251F]/60 dark:text-[#EDE8E1]/60">
          First chord will display automatically.
        </p>
      </div>
    );
  }

  // ---------------- ACTIVE OR EXPIRED SESSION VIEW ----------------
  const totalAllowanceMs = settings.plannedDurationMinutes
    ? (settings.plannedDurationMinutes + cumulativeExtensionMinutes) * 60 * 1000
    : null;

  const sessionProgressPercent = totalAllowanceMs
    ? Math.min(100, Math.round((activeElapsedMs / totalAllowanceMs) * 100))
    : 0;

  const chordProgressPercent = settings.progressionMode === 'auto'
    ? Math.max(0, Math.min(100, (chordRemainingMs / (settings.autoIntervalSeconds * 1000)) * 100))
    : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-10 space-y-6 select-none animate-in fade-in duration-150">
      {/* Top Session Status Bar */}
      <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-[#EAE5DC]/40 dark:bg-[#221F1C]/40 border border-[#29251F]/10 dark:border-[#EDE8E1]/10 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-bold text-[#29251F] dark:text-[#EDE8E1]">
            {currentChord ? `${currentChord.keyTonic} ${formatScaleName(currentChord.scaleType)}` : ''}
          </span>
          <span className="text-[#29251F]/30 dark:text-[#EDE8E1]/30">•</span>
          <span className="text-[#29251F]/70 dark:text-[#EDE8E1]/70">
            Chord {currentIndex + 1} of {chordHistory.length}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-[#29251F] dark:text-[#EDE8E1]">
            <Clock className="w-3.5 h-3.5 text-[#A68A55]" />
            <span>{formatDurationMs(activeElapsedMs)}</span>
            {totalAllowanceMs && (
              <span className="text-[#29251F]/40 dark:text-[#EDE8E1]/40">
                / {formatDurationMs(totalAllowanceMs)}
              </span>
            )}
          </div>

          <button
            onClick={() => {
              // Opening in-session settings automatically pauses
              if (!isPaused) handleTogglePause();
              setShowInSessionSettings(true);
            }}
            type="button"
            className="p-1.5 rounded-md hover:bg-[#EAE5DC] dark:hover:bg-[#221F1C] text-[#29251F]/70 dark:text-[#EDE8E1]/70"
            title="Session settings (pauses session)"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Bars */}
      <div className="space-y-1">
        {totalAllowanceMs && (
          <div className="h-1.5 rounded-full bg-[#EAE5DC] dark:bg-[#221F1C] overflow-hidden">
            <div
              className="h-full bg-[#A68A55] transition-all duration-300"
              style={{ width: `${sessionProgressPercent}%` }}
            />
          </div>
        )}
        {settings.progressionMode === 'auto' && !isPaused && (
          <div className="h-1 rounded-full bg-[#EAE5DC]/50 dark:bg-[#221F1C]/50 overflow-hidden">
            <div
              className="h-full bg-[#29251F]/30 dark:bg-[#EDE8E1]/30 transition-all duration-100"
              style={{ width: `${chordProgressPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Expiry Banner if Planned Duration Reached */}
      {sessionState === 'expired' && (
        <div className="p-4 rounded-xl bg-[#2D7A4D]/10 dark:bg-[#48A66C]/10 border border-[#2D7A4D]/30 dark:border-[#48A66C]/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="font-editorial font-bold text-sm text-[#2D7A4D] dark:text-[#48A66C]">
              Planned Practice Time Complete
            </h4>
            <p className="text-xs text-[#29251F]/70 dark:text-[#EDE8E1]/70">
              Current chord remains visible. You can finish your session or extend by +5, +10, or +15 minutes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExtendSession(5)}
              type="button"
              className="px-2.5 py-1 text-xs font-semibold rounded-md border border-[#29251F]/20 dark:border-[#EDE8E1]/20 hover:bg-[#EAE5DC] dark:hover:bg-[#221F1C]"
            >
              +5 min
            </button>
            <button
              onClick={() => handleExtendSession(10)}
              type="button"
              className="px-2.5 py-1 text-xs font-semibold rounded-md border border-[#29251F]/20 dark:border-[#EDE8E1]/20 hover:bg-[#EAE5DC] dark:hover:bg-[#221F1C]"
            >
              +10 min
            </button>
            <button
              onClick={handleEndSession}
              type="button"
              className="px-4 py-1.5 text-xs font-bold rounded-md bg-[#2D7A4D] dark:bg-[#48A66C] text-white"
            >
              Finish Session
            </button>
          </div>
        </div>
      )}

      {/* Dominant Chord Stage */}
      <div className="min-h-[400px] sm:min-h-[460px] flex flex-col items-center justify-center p-6 sm:p-12 rounded-3xl bg-[#EAE5DC]/30 dark:bg-[#221F1C]/30 border border-[#29251F]/15 dark:border-[#EDE8E1]/15 relative">
        {/* Difficult Chord Bookmark Button */}
        <button
          onClick={handleToggleBookmark}
          type="button"
          className="absolute top-4 right-4 p-2 rounded-lg text-[#29251F]/60 dark:text-[#EDE8E1]/60 hover:text-[#A68A55] transition-colors"
          title={isBookmarked ? 'Bookmarked as difficult chord (click to remove)' : 'Bookmark as difficult chord'}
        >
          {isBookmarked ? (
            <BookmarkCheck className="w-5 h-5 text-[#A68A55]" />
          ) : (
            <Bookmark className="w-5 h-5" />
          )}
        </button>

        {currentChord ? (
          <div className="text-center space-y-4 max-w-lg">
            {/* Degree / Roman Supertitle */}
            <div className="space-y-1">
              <span className="text-xs uppercase font-bold tracking-widest text-[#A68A55] dark:text-[#CBB07E]">
                Scale Degree {currentChord.degree}
              </span>
              <div className="font-editorial text-2xl sm:text-3xl font-semibold text-[#29251F]/80 dark:text-[#EDE8E1]/80">
                {currentChord.romanNumeral}
              </div>
            </div>

            {/* Dominant Chord Name (or Hidden) */}
            <div className="py-2">
              {settings.hideChordName && !revealed ? (
                <div className="space-y-3">
                  <div className="font-editorial text-5xl sm:text-7xl font-bold tracking-tight text-[#29251F]/20 dark:text-[#EDE8E1]/20">
                    ???
                  </div>
                  <button
                    onClick={() => setRevealed(true)}
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md bg-[#A68A55] text-white"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Reveal Chord Name</span>
                  </button>
                </div>
              ) : (
                <div className="font-editorial text-6xl sm:text-8xl md:text-9xl font-bold tracking-tight text-[#29251F] dark:text-[#EDE8E1] transition-all">
                  {currentChord.name}
                </div>
              )}
            </div>

            {/* Spelled Notes or Details */}
            {(!settings.hideNotes || revealed || showDetails) && (
              <div className="text-sm font-semibold tracking-wide text-[#29251F]/70 dark:text-[#EDE8E1]/70">
                Notes: {currentChord.notes.map(n => n.formatted).join(' - ')}
                {currentChord.inversion !== 0 && (
                  <span className="text-xs text-[#A68A55] ml-2 font-normal">
                    (Bass: {currentChord.bass.formatted})
                  </span>
                )}
              </div>
            )}

            {/* Expandable Theory Details */}
            {showDetails && (
              <div className="pt-4 border-t border-[#29251F]/10 dark:border-[#EDE8E1]/10 text-xs text-[#29251F]/60 dark:text-[#EDE8E1]/60 space-y-1 animate-in fade-in">
                <p>Quality: {currentChord.quality}</p>
                <p>Root: {currentChord.root.formatted} • Inversion: {currentChord.inversion === 0 ? 'Root Position' : `${currentChord.inversion}st/nd Inversion`}</p>
                <p>Key Context: {currentChord.keyTonic} {formatScaleName(currentChord.scaleType)}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-sm text-[#29251F]/50">No chord generated.</div>
        )}
      </div>

      {/* Main Transport & Navigation Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePreviousChord}
            disabled={currentIndex <= 0}
            type="button"
            className="px-3.5 py-2 text-xs font-bold rounded-lg border border-[#29251F]/20 dark:border-[#EDE8E1]/20 text-[#29251F] dark:text-[#EDE8E1] hover:bg-[#EAE5DC] dark:hover:bg-[#221F1C] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
            title="Step back in chord history (pauses in auto mode)"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Previous</span>
          </button>

          <button
            onClick={handleTogglePause}
            type="button"
            className="px-4 py-2 text-xs font-bold rounded-lg border border-[#29251F]/20 dark:border-[#EDE8E1]/20 text-[#29251F] dark:text-[#EDE8E1] hover:bg-[#EAE5DC] dark:hover:bg-[#221F1C] flex items-center gap-1.5"
          >
            {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          <button
            onClick={handleNextChord}
            type="button"
            className="px-5 py-2 text-xs font-bold rounded-lg bg-[#29251F] dark:bg-[#EDE8E1] text-[#F8F6F1] dark:text-[#181614] hover:bg-black dark:hover:bg-white flex items-center gap-1.5 shadow-xs"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDetails(prev => !prev)}
            type="button"
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-[#29251F]/15 dark:border-[#EDE8E1]/15 text-[#29251F]/70 dark:text-[#EDE8E1]/70 hover:bg-[#EAE5DC]/50 dark:hover:bg-[#221F1C]/50"
          >
            {showDetails ? 'Hide Details' : 'Details'}
          </button>

          <button
            onClick={handleEndSession}
            type="button"
            className="px-3 py-2 text-xs font-semibold rounded-lg text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            End Session
          </button>
        </div>
      </div>

      {/* In-Session Settings Modal */}
      {showInSessionSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#F8F6F1] dark:bg-[#181614] border border-[#29251F]/20 dark:border-[#EDE8E1]/20 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#29251F]/10 dark:border-[#EDE8E1]/10 pb-3">
              <h3 className="font-editorial font-bold text-base text-[#29251F] dark:text-[#EDE8E1]">
                In-Session Trainer Settings
              </h3>
              <button
                onClick={() => setShowInSessionSettings(false)}
                type="button"
                className="p-1 rounded-md text-[#29251F]/60 dark:text-[#EDE8E1]/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#29251F]/60 dark:text-[#EDE8E1]/60">
              Session is paused. Changes apply only to future generated chords, never past history.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Time Per Chord</label>
                <select
                  value={settings.autoIntervalSeconds}
                  onChange={e => setSettings(s => ({ ...s, autoIntervalSeconds: Number(e.target.value) }))}
                  className="w-full text-xs font-semibold p-2 rounded-lg bg-[#EAE5DC]/50 dark:bg-[#221F1C]/50 border border-[#29251F]/20"
                >
                  <option value={1}>1 second</option>
                  <option value={2}>2 seconds</option>
                  <option value={3}>3 seconds</option>
                  <option value={5}>5 seconds</option>
                  <option value={8}>8 seconds</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Display Mode</label>
                <select
                  value={settings.displayMode}
                  onChange={e => setSettings(s => ({ ...s, displayMode: e.target.value as any }))}
                  className="w-full text-xs font-semibold p-2 rounded-lg bg-[#EAE5DC]/50 dark:bg-[#221F1C]/50 border border-[#29251F]/20"
                >
                  <option value="chord_name">Chord Name</option>
                  <option value="roman">Roman Numeral</option>
                  <option value="arabic">Arabic Degree</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  setShowInSessionSettings(false);
                  handleTogglePause();
                }}
                type="button"
                className="px-4 py-2 text-xs font-bold rounded-lg bg-[#29251F] dark:bg-[#EDE8E1] text-[#F8F6F1] dark:text-[#181614]"
              >
                Apply & Resume
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Mode A: Instrument Trainer Component
 * Rebuilt to faithfully match chord-prototype.html
 * High-contrast editorial layout: 12-column config, oversized display chords,
 * piano keyboard diagram with C-E-G / bass highlighting, sticky transport bar,
 * and comprehensive session review.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ScaleType,
  ChordTypeFilter,
  InversionType,
  DiatonicChord,
  buildDiatonicChord,
  formatScaleName,
  CIRCLE_OF_FIFTHS,
  TONICS_BY_PITCH_CLASS,
  KEY_DISPLAY_LIST,
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
import { PianoDiagram } from './PianoDiagram';

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
  showDiagram?: boolean;
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
  progressionMode: 'manual',
  autoIntervalSeconds: 4,
  startCountdown: 3,
  timerDisplayStyle: 'progress_seconds',
  plannedDurationMinutes: null,
  hideChordName: false,
  hideNotes: false,
  showDiagram: true,
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

const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtT = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
};

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export const InstrumentTrainerView: React.FC<InstrumentTrainerViewProps> = ({
  onSessionComplete,
  bookmarks,
  onRefreshBookmarks,
  presets,
  onRefreshPresets,
  initialSettings,
  forcedChords,
}) => {
  // Settings State
  const [settings, setSettings] = useState<InstrumentTrainerSettings>(() => ({
    ...DEFAULT_TRAINER_SETTINGS,
    ...initialSettings,
  }));

  // Accordion open state
  const [openGroups, setOpenGroups] = useState<{ [key: number]: boolean }>({
    1: true,
    2: true,
    3: false,
    4: false,
  });

  const toggleGroup = (n: number) => {
    setOpenGroups(prev => ({ ...prev, [n]: !prev[n] }));
  };

  // Session State
  const [sessionState, setSessionState] = useState<'config' | 'countdown' | 'active' | 'completed'>('config');
  const [chordHistory, setChordHistory] = useState<DiatonicChord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // Timers and Countdown
  const [countdownRemaining, setCountdownRemaining] = useState<number>(3);
  const [activeElapsedMs, setActiveElapsedMs] = useState(0);
  const [pausedElapsedMs, setPausedElapsedMs] = useState(0);
  const [chordRemainingMs, setChordRemainingMs] = useState(settings.autoIntervalSeconds * 1000);

  // Presets
  const [presetNameInput, setPresetNameInput] = useState('');
  const [showPresetSave, setShowPresetSave] = useState(false);

  // Pool & Engine Refs
  const poolRef = useRef<DiatonicChord[]>([]);
  const currentKeyIndexRef = useRef<number>(0);
  const chordsInCurrentKeyRef = useRef<number>(0);
  const sessionStartTimeRef = useRef<number>(0);
  const lastActiveTimestampRef = useRef<number>(0);
  const lastPauseTimestampRef = useRef<number>(0);

  // Key Selection Helper
  const getTonicName = (pc: number): string => {
    return TONICS_BY_PITCH_CLASS[pc]?.[0] || 'C';
  };

  // Generate Chord based on settings
  const generateNextChord = (): DiatonicChord => {
    if (forcedChords && forcedChords.length > 0) {
      const idx = chordsInCurrentKeyRef.current % forcedChords.length;
      chordsInCurrentKeyRef.current += 1;
      return forcedChords[idx];
    }

    // Determine current tonic
    let tonic = 'C';
    if (settings.keyProgression === 'circle_of_fifths') {
      const circlePc = CIRCLE_OF_FIFTHS[currentKeyIndexRef.current % CIRCLE_OF_FIFTHS.length];
      tonic = getTonicName(circlePc);
    } else {
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
    if (settings.ordering === 'sequential' || settings.ordering === 'shuffled_cycle') {
      nextChord = poolRef.current.shift()!;
    } else if (settings.ordering === 'no_repeat') {
      const lastChord = chordHistory[chordHistory.length - 1];
      const filtered = poolRef.current.filter(c => !lastChord || c.name !== lastChord.name);
      nextChord = (filtered.length > 0 ? filtered : poolRef.current)[Math.floor(Math.random() * poolRef.current.length)];
    } else {
      nextChord = poolRef.current[Math.floor(Math.random() * poolRef.current.length)];
    }

    chordsInCurrentKeyRef.current += 1;
    return nextChord;
  };

  // ---------------- SESSION CONTROLS ----------------

  const handleStartSession = () => {
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

    const first = generateNextChord();
    setChordHistory([first]);
    setCurrentIndex(0);
    setRevealed(false);
    setActiveElapsedMs(0);
    setPausedElapsedMs(0);
    setChordRemainingMs(settings.autoIntervalSeconds * 1000);
    setIsPaused(false);
    setIsEnding(false);

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
      setCurrentIndex(prev => prev + 1);
    } else {
      const next = generateNextChord();
      setChordHistory(prev => [...prev, next]);
      setCurrentIndex(prev => prev + 1);
    }
    setChordRemainingMs(settings.autoIntervalSeconds * 1000);
  };

  const handlePreviousChord = () => {
    if (currentIndex > 0) {
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

  const handleToggleBookmarkForChord = async (chord: DiatonicChord) => {
    const existing = bookmarks.find(b => b.chordName === chord.name && b.keyTonic === chord.keyTonic);
    if (existing) {
      await deleteBookmark(existing.id);
      onRefreshBookmarks();
    } else {
      const newBk: DifficultChordBookmark = {
        id: `bk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        chordName: chord.name,
        keyTonic: chord.keyTonic,
        scaleType: chord.scaleType,
        degree: chord.degree,
        quality: chord.quality,
        romanNumeral: chord.romanNumeral,
        notes: chord.notes.map(n => n.formatted),
        createdAt: Date.now(),
        mastered: false,
      };
      await saveBookmark(newBk);
      onRefreshBookmarks();
    }
  };

  const handleEndSession = async () => {
    if (isEnding) return;
    setIsEnding(true);
    setIsPaused(true);

    try {
      const now = Date.now();
      const startTime = sessionStartTimeRef.current || now;
      const finalWallClock = Math.max(1, Math.floor((now - startTime) / 1000));
      const finalActive = Math.floor(activeElapsedMs / 1000);
      const finalPaused = Math.floor(pausedElapsedMs / 1000);

      const record: CompletedSessionRecord = {
        id: `session_inst_${Date.now()}`,
        mode: 'instrument',
        startedAt: startTime,
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
      setSessionState('completed');
      onSessionComplete(record);
    } catch (err) {
      console.error('Error ending instrument trainer session:', err);
      setSessionState('completed');
    } finally {
      setIsEnding(false);
    }
  };

  // ---------------- TIMERS EFFECT ----------------

  // Countdown timer
  useEffect(() => {
    if (sessionState !== 'countdown') return;
    if (countdownRemaining <= 0) {
      setSessionState('active');
      lastActiveTimestampRef.current = Date.now();
      return;
    }
    const timer = setInterval(() => {
      setCountdownRemaining(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionState, countdownRemaining]);

  // Active Session Progression Timer
  useEffect(() => {
    if (sessionState !== 'active' || isPaused) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const dt = now - lastActiveTimestampRef.current;
      lastActiveTimestampRef.current = now;

      setActiveElapsedMs(prev => prev + dt);

      if (settings.progressionMode === 'auto') {
        setChordRemainingMs(prev => {
          if (prev <= dt) {
            handleNextChord();
            return settings.autoIntervalSeconds * 1000;
          }
          return prev - dt;
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [sessionState, isPaused, settings.progressionMode, settings.autoIntervalSeconds, currentIndex, chordHistory]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (sessionState !== 'active') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleNextChord();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePreviousChord();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        handleTogglePause();
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        if (chordHistory[currentIndex]) {
          handleToggleBookmarkForChord(chordHistory[currentIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sessionState, currentIndex, chordHistory, isPaused]);

  // ---------------- RENDER VIEWS ----------------

  const currentChord = chordHistory[currentIndex];
  const isBookmarked = currentChord
    ? bookmarks.some(b => b.chordName === currentChord.name && b.keyTonic === currentChord.keyTonic)
    : false;

  const currentTonic = getTonicName(settings.enabledPitchClasses[0] || 0);
  const currentScale = settings.enabledScales[0] || 'major';
  const autoMode = settings.progressionMode === 'auto';
  const validationError =
    settings.enabledDegrees.length === 0
      ? 'Select at least one degree to start.'
      : settings.enabledPitchClasses.length === 0
      ? 'Select at least one key.'
      : '';

  // 1. COUNTDOWN VIEW
  if (sessionState === 'countdown') {
    return (
      <div className="count" role="status" aria-label={`Starting in ${countdownRemaining}`}>
        <div className="micro">Starting in</div>
        <div className="n tnum">{countdownRemaining}</div>
        <button
          type="button"
          className="btn !bg-[var(--ink)] !text-white"
          style={{ marginTop: '32px' }}
          onClick={() => {
            setSessionState('active');
            lastActiveTimestampRef.current = Date.now();
          }}
        >
          Skip countdown
        </button>
      </div>
    );
  }

  // 2. ACTIVE SESSION VIEW
  if (sessionState === 'active' && currentChord) {
    const hidden = settings.hideNotes && !revealed;
    const autoProgressFrac = autoMode
      ? Math.max(0, Math.min(1, 1 - chordRemainingMs / (settings.autoIntervalSeconds * 1000)))
      : 0;

    return (
      <div className="view sess">
        {/* Top Meta Strip */}
        <div className="meta micro">
          <div className="muted">
            Key
            <b>
              {currentChord.keyTonic} {formatScaleName(currentChord.scaleType).toLowerCase()}
            </b>
          </div>
          <div className="muted">
            Chord
            <b className="tnum">
              {pad2(currentIndex + 1)} / {chordHistory.length > currentIndex + 1 ? pad2(chordHistory.length) : '∞'}
            </b>
          </div>
          <div className="muted">
            Advance
            <b>{autoMode ? `Auto · ${settings.autoIntervalSeconds}s` : 'Manual · press Next'}</b>
          </div>
          <div className="muted">
            Time
            <b className="tnum">{fmtT(activeElapsedMs)}</b>
          </div>
        </div>

        {/* Progress bar */}
        <div className="pbar" aria-hidden="true">
          {autoMode && <i style={{ width: `${autoProgressFrac * 100}%` }} />}
        </div>

        {/* Main Stage */}
        <div className="s-main">
          {/* Left Column: Huge Chord & Degree */}
          <div className="s-left">
            <div className="micro muted">
              Play this chord
              {currentChord.inversion > 0
                ? ` · ${['', '1st', '2nd', '3rd'][currentChord.inversion]} inversion`
                : ' · root position'}
            </div>
            <h1
              className={`display chord ${currentChord.name.length > 6 ? 'long' : ''}`}
              aria-label={currentChord.name}
            >
              {currentChord.name}
            </h1>
            <div className="roman">
              <span className="rn">
                {currentChord.romanNumeral}
              </span>{' '}
              <span className="micro muted" style={{ letterSpacing: '.12em', marginLeft: '10px', verticalAlign: 'middle' }}>
                degree {currentChord.degree} · {currentChord.quality}
              </span>
            </div>

            {/* Note constituent blocks */}
            <div className="notes-line" aria-label="Chord notes" hidden={hidden}>
              {currentChord.notes.map((n, i) => (
                <span key={i} className={i === 0 ? 'bass' : ''}>
                  {n.spelling}
                </span>
              ))}
            </div>

            {/* In-session tools */}
            <div className="tools">
              <button
                type="button"
                onClick={() => handleToggleBookmarkForChord(currentChord)}
                aria-pressed={isBookmarked}
              >
                {isBookmarked ? '■ Bookmarked' : '□ Bookmark'}
              </button>
              {settings.hideNotes && (
                <button
                  type="button"
                  onClick={() => setRevealed(prev => !prev)}
                  aria-pressed={revealed}
                >
                  {revealed ? 'Hide notes' : 'Reveal notes'}
                </button>
              )}
              <button
                type="button"
                onClick={handleEndSession}
                disabled={isEnding}
              >
                {isEnding ? 'Finishing…' : 'Finish session'}
              </button>
            </div>
          </div>

          {/* Right Column: Accent Block + Keyboard Diagram */}
          <div className="s-right" hidden={settings.showDiagram === false}>
            <div className="acc-block"></div>
            {hidden ? (
              <div className="cover">
                <button type="button" onClick={() => setRevealed(true)}>
                  Reveal notes ↗
                </button>
              </div>
            ) : (
              <div className="piano">
                <PianoDiagram chord={currentChord} />
              </div>
            )}
            <div className="vlab micro vert" aria-hidden="true">
              Practice / {pad2(currentIndex + 1)}
            </div>
          </div>
        </div>

        {/* Bottom Sticky Transport Bar */}
        <div className="bar">
          <button
            type="button"
            className="b pv"
            onClick={handlePreviousChord}
            disabled={currentIndex === 0}
          >
            <span>←</span>
            <span>Previous</span>
          </button>
          <button
            type="button"
            className="b pa"
            onClick={handleTogglePause}
            disabled={!autoMode}
          >
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
            <span>{autoMode ? (isPaused ? '▶' : '❚❚') : '—'}</span>
          </button>
          <button
            type="button"
            className="b next"
            onClick={handleNextChord}
            aria-label="Next chord"
          >
            <span>next</span>
            <span className="ar" aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. COMPLETED RESULTS VIEW
  if (sessionState === 'completed') {
    const totalCount = chordHistory.length;
    const sessionKeyLabel = `${currentTonic} ${formatScaleName(currentScale).toLowerCase()}`;
    const bmCount = chordHistory.filter(c =>
      bookmarks.some(b => b.chordName === c.name && b.keyTonic === c.keyTonic)
    ).length;

    return (
      <div className="view">
        <div className="res">
          <div className="num">
            <div className="micro muted">Session complete / Instrument trainer</div>
            <div className="display" aria-label={`${totalCount} chords`}>
              {pad2(totalCount)}
              <small>chords</small>
            </div>
          </div>

          <div className="mx">
            <div className="mrow micro">
              <span>Time</span>
              <b className="tnum">{fmtT(activeElapsedMs)}</b>
            </div>
            <div className="mrow micro">
              <span>Key</span>
              <b>{sessionKeyLabel}</b>
            </div>
            <div className="mrow micro">
              <span>Bookmarked</span>
              <b>{bmCount}</b>
            </div>
            <div className="mrow micro">
              <span>Advance</span>
              <b>{autoMode ? `Auto · ${settings.autoIntervalSeconds}s` : 'Manual'}</b>
            </div>
          </div>

          <div className="ctas">
            <button
              type="button"
              className="btn acc-bg big"
              onClick={handleStartSession}
            >
              <span>Practise again</span>
              <span>↗</span>
            </button>
            <button
              type="button"
              className="btn big"
              onClick={() => setSessionState('config')}
            >
              <span>Settings</span>
              <span>←</span>
            </button>
            <button
              type="button"
              className="btn ghost big"
              onClick={() => {
                window.location.hash = '#collections';
              }}
            >
              <span>Collection</span>
              <span>→</span>
            </button>
          </div>

          <div className="review">
            <h2 className="display">played.</h2>
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Chord</th>
                  <th>Degree</th>
                  <th>Notes</th>
                  <th>Bookmark</th>
                </tr>
              </thead>
              <tbody>
                {chordHistory.map((c, i) => {
                  const bkm = bookmarks.some(b => b.chordName === c.name && b.keyTonic === c.keyTonic);
                  return (
                    <tr key={i}>
                      <td className="st">{pad2(i + 1)}</td>
                      <td className="font-bold">{c.name}</td>
                      <td>
                        {c.romanNumeral} ({c.quality})
                      </td>
                      <td>{c.notes.map(n => n.spelling).join(' · ')}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleToggleBookmarkForChord(c)}
                          className="tag"
                          style={{ borderColor: bkm ? 'var(--accent)' : 'var(--line)', color: bkm ? 'var(--accent)' : 'inherit' }}
                        >
                          {bkm ? '■ Saved' : '□ Save'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 4. CONFIG / SETTINGS VIEW
  const summaryRows = [
    ['Key / scale', `${currentTonic} ${formatScaleName(currentScale).toLowerCase()}`],
    [
      'Chord set',
      settings.chordType === 'triads'
        ? 'Triads'
        : settings.chordType === 'sevenths'
        ? 'Sevenths'
        : 'Triads + sevenths',
    ],
    [
      'Degrees',
      settings.enabledDegrees.length === 7
        ? 'All seven'
        : settings.enabledDegrees.map(d => ROMAN_NUMERALS[d - 1]).join(' ') || 'None',
    ],
    [
      'Advance',
      settings.progressionMode === 'manual' ? 'Manual · Next' : `Auto · ${settings.autoIntervalSeconds}s`,
    ],
  ];

  return (
    <div className="view">
      <div className="cfg">
        {/* Left Sticky Header Column */}
        <aside className="cfg-head">
          <div className="micro muted">Mode A / Instrument trainer</div>
          <h1 className="display">practice.</h1>
          <div className="cfg-sum micro">
            {summaryRows.map(([label, val]) => (
              <div key={label}>
                <span className="muted">{label}</span>
                <b>{val}</b>
              </div>
            ))}
          </div>
          <div className="warn micro" role="alert" id="warn">
            {validationError}
          </div>
          <button
            type="button"
            className="start"
            onClick={handleStartSession}
            disabled={!!validationError}
          >
            <span className="micro">
              Trainer · {currentTonic} {formatScaleName(currentScale).toLowerCase()}
            </span>
            <span className="big">
              start<br />session ↗
            </span>
          </button>
        </aside>

        {/* Right Body with Accordion Groups */}
        <div className="cfg-body">
          {/* Group 01: Musical Material */}
          <section className="grp">
            <button
              type="button"
              className="grp-h"
              onClick={() => toggleGroup(1)}
              aria-expanded={openGroups[1]}
            >
              <span className="micro">01</span>
              <span className="t">Musical material</span>
              <span className="micro muted v">
                {currentTonic} {formatScaleName(currentScale).toLowerCase()} · {settings.chordType}
              </span>
              <span className="pm" aria-hidden="true">
                {openGroups[1] ? '−' : '+'}
              </span>
            </button>
            {openGroups[1] && (
              <div className="grp-c">
                {/* 12-Key Picker */}
                <div className="setting">
                  <div className="lab micro">
                    Key
                    <small>Select the root tonic key for chords.</small>
                  </div>
                  <div>
                    <div className="keys" role="group" aria-label="Key tonic">
                      {KEY_DISPLAY_LIST.map(k => {
                        const isSelected = settings.enabledPitchClasses.includes(k.pitchClass);
                        return (
                          <button
                            key={k.pitchClass}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => {
                              setSettings(prev => ({
                                ...prev,
                                enabledPitchClasses: [k.pitchClass],
                              }));
                            }}
                            aria-label={`Key ${k.fullName}`}
                            title={k.fullName}
                          >
                            <span className="key-main">{k.primaryName}</span>
                            {k.enharmonicName && <span className="key-sub">{k.enharmonicName}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Scale selection */}
                <div className="setting">
                  <div className="lab micro">Scale</div>
                  <div className="seg" role="group">
                    {(['major', 'minor', 'harmonic_minor'] as ScaleType[]).map(scale => {
                      const isSel = settings.enabledScales.includes(scale);
                      return (
                        <button
                          key={scale}
                          type="button"
                          aria-pressed={isSel}
                          onClick={() => setSettings(prev => ({ ...prev, enabledScales: [scale] }))}
                        >
                          {formatScaleName(scale)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Chord set */}
                <div className="setting">
                  <div className="lab micro">Chord set</div>
                  <div className="seg" role="group">
                    {(['triads', 'sevenths', 'both'] as ChordTypeFilter[]).map(type => (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={settings.chordType === type}
                        onClick={() => setSettings(prev => ({ ...prev, chordType: type }))}
                      >
                        {type === 'triads' ? 'Triads' : type === 'sevenths' ? 'Sevenths' : 'Both'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Degrees 1-7 */}
                <div className="setting">
                  <div className="lab micro">
                    Degrees
                    <small>Toggle which scale degrees are active.</small>
                  </div>
                  <div className="degs" role="group" aria-label="Scale degrees">
                    {[1, 2, 3, 4, 5, 6, 7].map(deg => {
                      const on = settings.enabledDegrees.includes(deg);
                      const sampleChord = buildDiatonicChord(
                        currentTonic,
                        currentScale,
                        deg,
                        settings.chordType === 'sevenths' ? 'seventh' : 'triad'
                      );
                      return (
                        <button
                          key={deg}
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            setSettings(prev => {
                              const exists = prev.enabledDegrees.includes(deg);
                              const updated = exists
                                ? prev.enabledDegrees.filter(d => d !== deg)
                                : [...prev.enabledDegrees, deg].sort();
                              return { ...prev, enabledDegrees: updated };
                            });
                          }}
                        >
                          <span className="r">{sampleChord.romanNumeral}</span>
                          <span className="c">{sampleChord.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Inversions */}
                <div className="setting">
                  <div className="lab micro">Inversions</div>
                  <div className="seg" role="group">
                    {(['root', 'any'] as Array<'root' | 'any'>).map(inv => (
                      <button
                        key={inv}
                        type="button"
                        aria-pressed={settings.inversion === inv}
                        onClick={() => setSettings(prev => ({ ...prev, inversion: inv }))}
                      >
                        {inv === 'root' ? 'Root only' : 'Any inversion'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Group 02: Session Flow */}
          <section className="grp">
            <button
              type="button"
              className="grp-h"
              onClick={() => toggleGroup(2)}
              aria-expanded={openGroups[2]}
            >
              <span className="micro">02</span>
              <span className="t">Session flow</span>
              <span className="micro muted v">
                {settings.progressionMode === 'manual' ? 'Manual' : `Auto ${settings.autoIntervalSeconds}s`}
              </span>
              <span className="pm" aria-hidden="true">
                {openGroups[2] ? '−' : '+'}
              </span>
            </button>
            {openGroups[2] && (
              <div className="grp-c">
                <div className="setting">
                  <div className="lab micro">
                    Advance
                    <small>Manual always keeps the Next button.</small>
                  </div>
                  <div className="seg" role="group">
                    {(['manual', 'auto'] as Array<'manual' | 'auto'>).map(prog => (
                      <button
                        key={prog}
                        type="button"
                        aria-pressed={settings.progressionMode === prog}
                        onClick={() => setSettings(prev => ({ ...prev, progressionMode: prog }))}
                      >
                        {prog === 'manual' ? 'Manual' : 'Automatic'}
                      </button>
                    ))}
                  </div>
                </div>

                {settings.progressionMode === 'auto' && (
                  <>
                    <div className="setting">
                      <div className="lab micro">Interval</div>
                      <div>
                        <div className="stepper">
                          <button
                            type="button"
                            onClick={() =>
                              setSettings(prev => ({
                                ...prev,
                                autoIntervalSeconds: Math.max(1, prev.autoIntervalSeconds - 1),
                              }))
                            }
                            aria-label="Decrease interval"
                          >
                            −
                          </button>
                          <span className="val">{settings.autoIntervalSeconds}s</span>
                          <button
                            type="button"
                            onClick={() =>
                              setSettings(prev => ({
                                ...prev,
                                autoIntervalSeconds: Math.min(20, prev.autoIntervalSeconds + 1),
                              }))
                            }
                            aria-label="Increase interval"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="setting">
                      <div className="lab micro">Start countdown</div>
                      <div className="seg" role="group">
                        {([0, 3, 5] as Array<0 | 3 | 5>).map(cd => (
                          <button
                            key={cd}
                            type="button"
                            aria-pressed={settings.startCountdown === cd}
                            onClick={() => setSettings(prev => ({ ...prev, startCountdown: cd }))}
                          >
                            {cd === 0 ? 'Off' : `${cd}s`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Group 03: Display */}
          <section className="grp">
            <button
              type="button"
              className="grp-h"
              onClick={() => toggleGroup(3)}
              aria-expanded={openGroups[3]}
            >
              <span className="micro">03</span>
              <span className="t">Display</span>
              <span className="micro muted v">
                {settings.hideNotes ? 'Notes on reveal' : 'Notes shown'} · Keyboard diagram{' '}
                {settings.showDiagram !== false ? 'on' : 'off'}
              </span>
              <span className="pm" aria-hidden="true">
                {openGroups[3] ? '−' : '+'}
              </span>
            </button>
            {openGroups[3] && (
              <div className="grp-c">
                <div className="setting">
                  <div className="lab micro">Notes</div>
                  <div className="seg" role="group">
                    <button
                      type="button"
                      aria-pressed={!settings.hideNotes}
                      onClick={() => setSettings(prev => ({ ...prev, hideNotes: false }))}
                    >
                      Always shown
                    </button>
                    <button
                      type="button"
                      aria-pressed={settings.hideNotes}
                      onClick={() => setSettings(prev => ({ ...prev, hideNotes: true }))}
                    >
                      Hidden until reveal
                    </button>
                  </div>
                </div>

                <div className="setting">
                  <div className="lab micro">Keyboard diagram</div>
                  <div className="seg" role="group">
                    <button
                      type="button"
                      aria-pressed={settings.showDiagram !== false}
                      onClick={() => setSettings(prev => ({ ...prev, showDiagram: true }))}
                    >
                      On
                    </button>
                    <button
                      type="button"
                      aria-pressed={settings.showDiagram === false}
                      onClick={() => setSettings(prev => ({ ...prev, showDiagram: false }))}
                    >
                      Off
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Group 04: Presets */}
          <section className="grp">
            <button
              type="button"
              className="grp-h"
              onClick={() => toggleGroup(4)}
              aria-expanded={openGroups[4]}
            >
              <span className="micro">04</span>
              <span className="t">Presets</span>
              <span className="micro muted v">
                {presets.filter(p => p.mode === 'instrument').length} saved
              </span>
              <span className="pm" aria-hidden="true">
                {openGroups[4] ? '−' : '+'}
              </span>
            </button>
            {openGroups[4] && (
              <div className="grp-c">
                <div className="space-y-4">
                  {presets
                    .filter(p => p.mode === 'instrument')
                    .map(p => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between py-2 border-b border-[var(--line)]"
                      >
                        <div>
                          <b className="text-sm">{p.name}</b>
                          <div className="micro muted">
                            {p.settings.chordType} · {p.settings.progressionMode}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSettings(prev => ({ ...prev, ...p.settings }));
                            }}
                            className="btn !min-h-[38px] !px-3 !text-xs"
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await deletePreset(p.id);
                              onRefreshPresets();
                            }}
                            className="btn ghost !min-h-[38px] !px-3 !text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}

                  {showPresetSave ? (
                    <div className="pt-2 flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Preset Name"
                        value={presetNameInput}
                        onChange={e => setPresetNameInput(e.target.value)}
                        className="border border-[var(--ink)] bg-[var(--paper)] px-3 py-2 text-sm flex-1 font-bold"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!presetNameInput.trim()) return;
                          await savePreset({
                            id: `preset_${Date.now()}`,
                            mode: 'instrument',
                            name: presetNameInput.trim(),
                            createdAt: Date.now(),
                            settings: { ...settings },
                          });
                          setPresetNameInput('');
                          setShowPresetSave(false);
                          onRefreshPresets();
                        }}
                        className="btn !min-h-[40px] !px-4 !text-xs"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPresetSave(false)}
                        className="btn ghost !min-h-[40px] !px-3 !text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowPresetSave(true)}
                      className="btn ghost !min-h-[44px] !px-4 !text-xs mt-2"
                    >
                      + Save Current as Preset
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

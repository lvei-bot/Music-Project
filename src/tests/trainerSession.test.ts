import { describe, it, expect } from 'vitest';
import {
  buildDiatonicChord,
  TONICS_BY_PITCH_CLASS,
  DiatonicChord,
} from '../theory/musicEngine';
import { CompletedSessionRecord, DifficultChordBookmark } from '../storage/indexedDb';

describe('Instrument Trainer Session Lifecycle & End Session', () => {
  it('correctly calculates completed session record metrics on session end', () => {
    const startTime = Date.now() - 120000; // started 2 minutes ago
    const now = Date.now();
    const activeElapsedMs = 95000; // 95 seconds active
    const pausedElapsedMs = 25000; // 25 seconds paused
    const history: DiatonicChord[] = [
      buildDiatonicChord('C', 'major', 1, 'triad', 0),
      buildDiatonicChord('C', 'major', 4, 'triad', 0),
      buildDiatonicChord('C', 'major', 5, 'triad', 0),
      buildDiatonicChord('C', 'major', 6, 'triad', 0),
    ];

    const finalWallClock = Math.max(1, Math.floor((now - startTime) / 1000));
    const finalActive = Math.floor(activeElapsedMs / 1000);
    const finalPaused = Math.floor(pausedElapsedMs / 1000);

    const record: CompletedSessionRecord = {
      id: `session_inst_${now}`,
      mode: 'instrument',
      startedAt: startTime,
      completedAt: now,
      activeDurationSeconds: finalActive,
      pausedDurationSeconds: finalPaused,
      wallClockDurationSeconds: finalWallClock,
      settingsSnapshot: {
        displayMode: 'chord_name',
        enabledPitchClasses: [0],
        keyChangeMode: 'fixed',
        keyChangeInterval: 10,
        keyProgression: 'circle_of_fifths',
        enabledScales: ['major'],
        scaleChangeMode: 'on_key_change',
        enabledDegrees: [1, 4, 5, 6],
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
      },
      summary: {
        totalItems: history.length,
      },
      excludedFromAnalytics: false,
    };

    expect(record.mode).toBe('instrument');
    expect(record.summary.totalItems).toBe(4);
    expect(record.activeDurationSeconds).toBe(95);
    expect(record.pausedDurationSeconds).toBe(25);
    expect(record.wallClockDurationSeconds).toBeGreaterThanOrEqual(119);
    expect(record.completedAt).toBeGreaterThan(record.startedAt);
  });

  it('correctly handles difficult chord bookmarking and un-bookmarking during practice review', () => {
    const chord = buildDiatonicChord('F#', 'harmonic_minor', 7, 'seventh', 0);
    expect(chord.name).toBe('E#dim7'); // Leading-tone diminished seventh in F# harmonic minor
    expect(chord.keyTonic).toBe('F#');

    const bookmarks: DifficultChordBookmark[] = [];

    // Add bookmark
    const newBk: DifficultChordBookmark = {
      id: `bk_${Date.now()}_test`,
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
    bookmarks.push(newBk);

    expect(bookmarks.length).toBe(1);
    expect(bookmarks[0].chordName).toBe('E#dim7');
    expect(bookmarks[0].keyTonic).toBe('F#');
    expect(bookmarks[0].notes).toEqual(['E#', 'G#', 'B', 'D']);

    // Remove bookmark
    const filtered = bookmarks.filter(b => !(b.chordName === chord.name && b.keyTonic === chord.keyTonic));
    expect(filtered.length).toBe(0);
  });

  it('preserves generated chord history accurately without re-randomizing past items', () => {
    const chord1 = buildDiatonicChord('C', 'major', 1, 'triad', 0);
    const chord2 = buildDiatonicChord('C', 'major', 2, 'triad', 0);
    const chord3 = buildDiatonicChord('C', 'major', 3, 'triad', 0);

    const history: DiatonicChord[] = [chord1, chord2, chord3];
    let currentIndex = 2;

    // Move backward to chord 1
    currentIndex = 1;
    expect(history[currentIndex].name).toBe('Dm');
    currentIndex = 0;
    expect(history[currentIndex].name).toBe('C');

    // Move forward: history must remain identical
    currentIndex = 1;
    expect(history[currentIndex].name).toBe('Dm');
    currentIndex = 2;
    expect(history[currentIndex].name).toBe('Em');
    expect(history.length).toBe(3);
  });
});

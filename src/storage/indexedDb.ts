/**
 * IndexedDB Storage Layer with schema versioning, transaction safety,
 * recoverable session storage, and full JSON backup/restore.
 */

import { openDB, IDBPDatabase } from 'idb';
import { QuizAttemptRecord, ManualLearningEvent } from '../learning/masteryModel';

export interface CompletedSessionRecord {
  id: string;
  mode: 'instrument' | 'quiz';
  startedAt: number;
  completedAt: number;
  activeDurationSeconds: number;
  pausedDurationSeconds: number;
  wallClockDurationSeconds: number;
  settingsSnapshot: any;
  summary: {
    totalItems: number;
    correctCount?: number;
    hintedCount?: number;
    wrongCount?: number;
    skippedCount?: number;
    timeoutCount?: number;
    accuracyPercent?: number;
    independentRecallPercent?: number;
  };
  excludedFromAnalytics: boolean;
}

export interface CustomChordCollection {
  id: string;
  name: string;
  type: 'fixed' | 'transposable';
  referenceKey: string; // e.g. "C"
  chords: string[]; // e.g. ["Cmaj7", "Am7", "Dm7", "G7"]
  playback: 'sequential' | 'random' | 'shuffled_cycle';
  createdAt: number;
  updatedAt: number;
}

export interface DifficultChordBookmark {
  id: string;
  chordName: string;
  keyTonic: string;
  scaleType: string;
  degree: number;
  quality: string;
  romanNumeral: string;
  notes: string[];
  createdAt: number;
  mastered: boolean;
}

export interface SettingsPreset {
  id: string;
  mode: 'instrument' | 'quiz';
  name: string;
  settings: any;
  createdAt: number;
  updatedAt: number;
}

export interface ActiveSessionRecovery {
  id: string;
  mode: 'instrument' | 'quiz';
  savedAt: number;
  activeElapsedMs: number;
  settings: any;
  state: any;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  dailyGoalMinutes: number;
  soundDisabledNoticeDismissed?: boolean;
}

const DB_NAME = 'ChordTrainerDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDatabase(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionsStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionsStore.createIndex('by_mode', 'mode');
          sessionsStore.createIndex('by_completedAt', 'completedAt');
        }
        if (!db.objectStoreNames.contains('quiz_attempts')) {
          const attemptsStore = db.createObjectStore('quiz_attempts', { keyPath: 'id' });
          attemptsStore.createIndex('by_sessionId', 'sessionId');
          attemptsStore.createIndex('by_conceptId', 'conceptId');
          attemptsStore.createIndex('by_timestamp', 'timestamp');
        }
        if (!db.objectStoreNames.contains('manual_events')) {
          const eventsStore = db.createObjectStore('manual_events', { keyPath: 'id' });
          eventsStore.createIndex('by_conceptId', 'conceptId');
          eventsStore.createIndex('by_timestamp', 'timestamp');
        }
        if (!db.objectStoreNames.contains('collections')) {
          const collectionsStore = db.createObjectStore('collections', { keyPath: 'id' });
          collectionsStore.createIndex('by_name', 'name');
        }
        if (!db.objectStoreNames.contains('bookmarks')) {
          const bookmarksStore = db.createObjectStore('bookmarks', { keyPath: 'id' });
          bookmarksStore.createIndex('by_createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('presets')) {
          const presetsStore = db.createObjectStore('presets', { keyPath: 'id' });
          presetsStore.createIndex('by_mode', 'mode');
        }
        if (!db.objectStoreNames.contains('app_state')) {
          db.createObjectStore('app_state');
        }
      },
    });
  }
  return dbPromise;
}

// ---------------- SESSIONS & ATTEMPTS ----------------

export async function saveCompletedSession(
  session: CompletedSessionRecord,
  attempts: QuizAttemptRecord[] = []
): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction(['sessions', 'quiz_attempts'], 'readwrite');
  await tx.objectStore('sessions').put(session);
  const attemptsStore = tx.objectStore('quiz_attempts');
  for (const attempt of attempts) {
    await attemptsStore.put(attempt);
  }
  await tx.done;
}

export async function getAllSessions(): Promise<CompletedSessionRecord[]> {
  const db = await getDatabase();
  const sessions = await db.getAll('sessions');
  return sessions.sort((a, b) => b.completedAt - a.completedAt);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction(['sessions', 'quiz_attempts'], 'readwrite');
  await tx.objectStore('sessions').delete(sessionId);

  // Delete all associated attempts using index
  const attemptsStore = tx.objectStore('quiz_attempts');
  const index = attemptsStore.index('by_sessionId');
  let cursor = await index.openCursor(IDBKeyRange.only(sessionId));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function toggleSessionAnalyticsExclusion(sessionId: string, excluded: boolean): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction('sessions', 'readwrite');
  const session = await tx.store.get(sessionId);
  if (session) {
    session.excludedFromAnalytics = excluded;
    await tx.store.put(session);
  }
  await tx.done;
}

export async function getAllQuizAttempts(): Promise<QuizAttemptRecord[]> {
  const db = await getDatabase();
  return db.getAll('quiz_attempts');
}

// ---------------- MANUAL LEARNING EVENTS ----------------

export async function saveManualLearningEvent(event: ManualLearningEvent): Promise<void> {
  const db = await getDatabase();
  await db.put('manual_events', event);
}

export async function getAllManualLearningEvents(): Promise<ManualLearningEvent[]> {
  const db = await getDatabase();
  return db.getAll('manual_events');
}

// ---------------- CUSTOM COLLECTIONS ----------------

export async function getAllCollections(): Promise<CustomChordCollection[]> {
  const db = await getDatabase();
  const cols = await db.getAll('collections');
  return cols.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveCollection(collection: CustomChordCollection): Promise<void> {
  const db = await getDatabase();
  await db.put('collections', collection);
}

export async function deleteCollection(id: string): Promise<void> {
  const db = await getDatabase();
  await db.delete('collections', id);
}

// ---------------- DIFFICULT CHORD BOOKMARKS ----------------

export async function getAllBookmarks(): Promise<DifficultChordBookmark[]> {
  const db = await getDatabase();
  const bks = await db.getAll('bookmarks');
  return bks.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveBookmark(bookmark: DifficultChordBookmark): Promise<void> {
  const db = await getDatabase();
  await db.put('bookmarks', bookmark);
}

export async function deleteBookmark(id: string): Promise<void> {
  const db = await getDatabase();
  await db.delete('bookmarks', id);
}

export async function toggleBookmarkMastered(id: string, mastered: boolean): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction('bookmarks', 'readwrite');
  const bk = await tx.store.get(id);
  if (bk) {
    bk.mastered = mastered;
    await tx.store.put(bk);
  }
  await tx.done;
}

// ---------------- PRESETS ----------------

export async function getAllPresets(mode?: 'instrument' | 'quiz'): Promise<SettingsPreset[]> {
  const db = await getDatabase();
  const presets: SettingsPreset[] = await db.getAll('presets');
  if (mode) {
    return presets.filter(p => p.mode === mode).sort((a, b) => a.name.localeCompare(b.name));
  }
  return presets.sort((a, b) => a.name.localeCompare(b.name));
}

export async function savePreset(preset: SettingsPreset): Promise<void> {
  const db = await getDatabase();
  await db.put('presets', preset);
}

export async function deletePreset(id: string): Promise<void> {
  const db = await getDatabase();
  await db.delete('presets', id);
}

// ---------------- RECOVERY & APP STATE ----------------

export async function saveActiveRecovery(recovery: ActiveSessionRecovery | null): Promise<void> {
  const db = await getDatabase();
  if (recovery) {
    await db.put('app_state', recovery, 'active_recovery');
  } else {
    await db.delete('app_state', 'active_recovery');
  }
}

export async function getActiveRecovery(): Promise<ActiveSessionRecovery | null> {
  const db = await getDatabase();
  return (await db.get('app_state', 'active_recovery')) || null;
}

export async function getUserPreferences(): Promise<UserPreferences> {
  const db = await getDatabase();
  const prefs = await db.get('app_state', 'preferences');
  return (
    prefs || {
      theme: 'system',
      dailyGoalMinutes: 10,
    }
  );
}

export async function saveUserPreferences(prefs: UserPreferences): Promise<void> {
  const db = await getDatabase();
  await db.put('app_state', prefs, 'preferences');
}

// ---------------- QUIZ SETTINGS PERSISTENCE ----------------

export const LOCAL_QUIZ_SETTINGS_KEY = 'chord_trainer_quiz_settings';

export function getLocalQuizSettings(): any | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_QUIZ_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLocalQuizSettings(settings: any): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LOCAL_QUIZ_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export async function getSavedQuizSettings(): Promise<any | null> {
  try {
    const db = await getDatabase();
    return (await db.get('app_state', 'quiz_settings')) || null;
  } catch {
    return null;
  }
}

export async function saveSavedQuizSettings(settings: any): Promise<void> {
  try {
    const db = await getDatabase();
    await db.put('app_state', settings, 'quiz_settings');
  } catch {
    // ignore
  }
}

// ---------------- BACKUP & RESTORE ----------------

export interface AppBackupData {
  version: 1;
  exportedAt: string;
  appName: string;
  sessions: CompletedSessionRecord[];
  quizAttempts: QuizAttemptRecord[];
  manualEvents: ManualLearningEvent[];
  collections: CustomChordCollection[];
  bookmarks: DifficultChordBookmark[];
  presets: SettingsPreset[];
  preferences: UserPreferences;
}

export async function createFullBackup(): Promise<AppBackupData> {
  const [sessions, quizAttempts, manualEvents, collections, bookmarks, presets, preferences] =
    await Promise.all([
      getAllSessions(),
      getAllQuizAttempts(),
      getAllManualLearningEvents(),
      getAllCollections(),
      getAllBookmarks(),
      getAllPresets(),
      getUserPreferences(),
    ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    appName: 'Diatonic Chord Practice & Trainer',
    sessions,
    quizAttempts,
    manualEvents,
    collections,
    bookmarks,
    presets,
    preferences,
  };
}

export interface BackupValidationResult {
  isValid: boolean;
  error?: string;
  summary?: {
    sessionsCount: number;
    attemptsCount: number;
    collectionsCount: number;
    bookmarksCount: number;
    presetsCount: number;
  };
}

export function validateBackupData(data: any): BackupValidationResult {
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: 'Backup file is empty or not valid JSON.' };
  }
  if (data.version !== 1) {
    return { isValid: false, error: `Unsupported backup version (${data.version}). Expected version 1.` };
  }
  if (!Array.isArray(data.sessions) || !Array.isArray(data.quizAttempts)) {
    return { isValid: false, error: 'Malformed backup structure: missing sessions or attempts data.' };
  }

  return {
    isValid: true,
    summary: {
      sessionsCount: data.sessions.length,
      attemptsCount: data.quizAttempts.length,
      collectionsCount: Array.isArray(data.collections) ? data.collections.length : 0,
      bookmarksCount: Array.isArray(data.bookmarks) ? data.bookmarks.length : 0,
      presetsCount: Array.isArray(data.presets) ? data.presets.length : 0,
    },
  };
}

export async function restoreFullBackup(data: AppBackupData): Promise<void> {
  const validation = validateBackupData(data);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid backup data');
  }

  const db = await getDatabase();
  const tx = db.transaction(
    ['sessions', 'quiz_attempts', 'manual_events', 'collections', 'bookmarks', 'presets', 'app_state'],
    'readwrite'
  );

  // Clear all stores transactionally
  await Promise.all([
    tx.objectStore('sessions').clear(),
    tx.objectStore('quiz_attempts').clear(),
    tx.objectStore('manual_events').clear(),
    tx.objectStore('collections').clear(),
    tx.objectStore('bookmarks').clear(),
    tx.objectStore('presets').clear(),
    tx.objectStore('app_state').delete('preferences'),
    tx.objectStore('app_state').delete('active_recovery'),
  ]);

  // Repopulate
  for (const s of data.sessions || []) await tx.objectStore('sessions').put(s);
  for (const a of data.quizAttempts || []) await tx.objectStore('quiz_attempts').put(a);
  for (const m of data.manualEvents || []) await tx.objectStore('manual_events').put(m);
  for (const c of data.collections || []) await tx.objectStore('collections').put(c);
  for (const b of data.bookmarks || []) await tx.objectStore('bookmarks').put(b);
  for (const p of data.presets || []) await tx.objectStore('presets').put(p);
  if (data.preferences) {
    await tx.objectStore('app_state').put(data.preferences, 'preferences');
  }

  await tx.done;
}

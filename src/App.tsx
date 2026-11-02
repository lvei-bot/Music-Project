/**
 * Main Application Component: Stark Editorial Diatonic Chord Training Suite
 * Rebuilt to faithfully match chord-prototype.html
 * Assembles Home, Instrument Trainer, Quiz, Collections, Bookmarks,
 * Progress, History, and Backup into a cohesive offline-first PWA.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header, NavTab } from './ui/Header';
import { HomeView } from './ui/HomeView';
import { InstrumentTrainerView, InstrumentTrainerSettings } from './ui/InstrumentTrainerView';
import { QuizView, QuizSettings } from './ui/QuizView';
import { CollectionsView } from './ui/CollectionsView';
import { BookmarksView } from './ui/BookmarksView';
import { ProgressView } from './ui/ProgressView';
import { HistoryView } from './ui/HistoryView';
import { BackupModal } from './ui/BackupModal';
import { OfflineIndicator } from './ui/OfflineIndicator';

import {
  getAllSessions,
  getAllQuizAttempts,
  getAllManualLearningEvents,
  getAllCollections,
  getAllBookmarks,
  getAllPresets,
  getUserPreferences,
  saveUserPreferences,
  getActiveRecovery,
  saveActiveRecovery,
  CompletedSessionRecord,
  CustomChordCollection,
  DifficultChordBookmark,
  SettingsPreset,
  UserPreferences,
  ActiveSessionRecovery,
} from './storage/indexedDb';
import {
  QuizAttemptRecord,
  ManualLearningEvent,
  reconstructMasteryStates,
  ConceptMasteryState,
} from './learning/masteryModel';
import { DiatonicChord } from './theory/musicEngine';
import { QuizQuestion, createQuizQuestion } from './engine/quizEngine';

export const App: React.FC = () => {
  const [activeTab, setActiveTabState] = useState<NavTab>(() => {
    const hash = window.location.hash.replace('#', '') as NavTab;
    const validTabs: NavTab[] = ['home', 'trainer', 'quiz', 'collections', 'bookmarks', 'progress', 'history', 'backup'];
    return validTabs.includes(hash) ? hash : 'home';
  });

  const setActiveTab = (tab: NavTab) => {
    setActiveTabState(tab);
    try {
      window.location.hash = `#${tab}`;
    } catch {}
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as NavTab;
      const validTabs: NavTab[] = ['home', 'trainer', 'quiz', 'collections', 'bookmarks', 'progress', 'history', 'backup'];
      if (validTabs.includes(hash)) {
        setActiveTabState(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const [sessions, setSessions] = useState<CompletedSessionRecord[]>([]);
  const [attempts, setAttempts] = useState<QuizAttemptRecord[]>([]);
  const [manualEvents, setManualEvents] = useState<ManualLearningEvent[]>([]);
  const [collections, setCollections] = useState<CustomChordCollection[]>([]);
  const [bookmarks, setBookmarks] = useState<DifficultChordBookmark[]>([]);
  const [presets, setPresets] = useState<SettingsPreset[]>([]);
  const [activeRecovery, setActiveRecovery] = useState<ActiveSessionRecovery | null>(null);

  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: 'system',
    dailyGoalMinutes: 10,
  });

  // Dynamic configuration overrides for launching specific flows
  const [trainerInitialSettings, setTrainerInitialSettings] = useState<Partial<InstrumentTrainerSettings> | undefined>(undefined);
  const [trainerForcedChords, setTrainerForcedChords] = useState<DiatonicChord[] | undefined>(undefined);
  const [quizInitialSettings, setQuizInitialSettings] = useState<Partial<QuizSettings> | undefined>(undefined);
  const [quizOverrideQuestions, setQuizOverrideQuestions] = useState<QuizQuestion[] | undefined>(undefined);

  // Backup modal toggle
  const [showBackupModal, setShowBackupModal] = useState(false);

  // Load all user data from IndexedDB
  const refreshAllData = useCallback(async () => {
    try {
      const [
        loadedSessions,
        loadedAttempts,
        loadedEvents,
        loadedCols,
        loadedBks,
        loadedPresets,
        loadedPrefs,
        loadedRecovery,
      ] = await Promise.all([
        getAllSessions(),
        getAllQuizAttempts(),
        getAllManualLearningEvents(),
        getAllCollections(),
        getAllBookmarks(),
        getAllPresets(),
        getUserPreferences(),
        getActiveRecovery(),
      ]);

      setSessions(loadedSessions);
      setAttempts(loadedAttempts);
      setManualEvents(loadedEvents);
      setCollections(loadedCols);
      setBookmarks(loadedBks);
      setPresets(loadedPresets);
      setPreferences(loadedPrefs);
      setActiveRecovery(loadedRecovery);
    } catch (err) {
      console.error('Failed to load data from IndexedDB:', err);
    }
  }, []);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // Sync theme with document.documentElement
  useEffect(() => {
    const root = document.documentElement;
    if (preferences.theme === 'dark') {
      root.classList.add('dark');
    } else if (preferences.theme === 'light') {
      root.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    }
  }, [preferences.theme]);

  const handleUpdatePreferences = async (newPrefs: UserPreferences) => {
    setPreferences(newPrefs);
    await saveUserPreferences(newPrefs);
  };

  // Reconstruct concept mastery map deterministically
  const conceptStates: Map<string, ConceptMasteryState> = reconstructMasteryStates(attempts, manualEvents);

  // Handle Session Completion
  const handleSessionComplete = async () => {
    await refreshAllData();
  };

  // Continue Last Session handler
  const handleContinueLastSession = () => {
    if (sessions.length === 0) return;
    const last = sessions[0];
    if (last.mode === 'instrument') {
      setTrainerInitialSettings(last.settingsSnapshot);
      setTrainerForcedChords(undefined);
      setActiveTab('trainer');
    } else {
      setQuizInitialSettings(last.settingsSnapshot);
      setQuizOverrideQuestions(undefined);
      setActiveTab('quiz');
    }
  };

  // Resume / Discard Interrupted Recovery
  const handleResumeRecovery = () => {
    if (!activeRecovery) return;
    if (activeRecovery.mode === 'instrument') {
      setTrainerInitialSettings(activeRecovery.settings);
      setTrainerForcedChords(activeRecovery.state?.chordHistory);
      setActiveTab('trainer');
    } else {
      setQuizInitialSettings(activeRecovery.settings);
      setActiveTab('quiz');
    }
  };

  const handleDiscardRecovery = async () => {
    await saveActiveRecovery(null);
    setActiveRecovery(null);
  };

  // Launch Focused Review Quiz
  const handleStartFocusedReview = (reviewType: 'needs_review' | 'due' | 'both') => {
    const candidateQuestions: QuizQuestion[] = [];
    const pool = Array.from(conceptStates.values()).filter(c => {
      if (reviewType === 'needs_review') return c.status === 'needs_review';
      if (reviewType === 'due') return c.status === 'mastered' && c.isDue;
      return c.status === 'needs_review' || (c.status === 'mastered' && c.isDue);
    });

    for (const c of pool) {
      const parts = c.conceptId.split('_');
      const scale = parts[0] as any;
      const degMatch = c.conceptId.match(/deg(\d)/);
      const degree = degMatch ? Number(degMatch[1]) : 1;
      const chordType = c.conceptId.includes('seventh') ? 'seventh' : 'triad';
      const dir = c.conceptId.includes('chord_to_degree') ? 'chord_to_degree' : 'degree_to_chord';

      const q = createQuizQuestion('C', scale, degree, chordType, dir, 'typed', 4);
      candidateQuestions.push(q);
    }

    if (candidateQuestions.length === 0) {
      alert('No concepts currently due or needing review. Starting standard quiz.');
      setActiveTab('quiz');
      return;
    }

    setQuizOverrideQuestions(candidateQuestions);
    setQuizInitialSettings({ focusedReviewPool: reviewType });
    setActiveTab('quiz');
  };

  // Launch Collection Trainer
  const handleLaunchCollectionTrainer = (chords: DiatonicChord[]) => {
    setTrainerForcedChords(chords);
    setTrainerInitialSettings({ ordering: 'shuffled_cycle' });
    setActiveTab('trainer');
  };

  // Launch Bookmarks Trainer
  const handleLaunchBookmarksTrainer = (chords: DiatonicChord[]) => {
    setTrainerForcedChords(chords);
    setTrainerInitialSettings({ ordering: 'shuffled_cycle' });
    setActiveTab('trainer');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--canvas)] text-[var(--ink)]">
      <a className="skip" href="#main">
        Skip to content
      </a>

      {/* Top Editorial Header */}
      <Header
        activeTab={activeTab}
        onSelectTab={tab => {
          if (tab === 'backup') {
            setShowBackupModal(true);
          } else {
            setActiveTab(tab);
          }
        }}
        preferences={preferences}
        onUpdatePreferences={handleUpdatePreferences}
      />

      {/* Main Content Area */}
      <main id="main" tabIndex={-1} className="flex-1 w-full" role="main">
        {activeTab === 'home' && (
          <HomeView
            onSelectTab={setActiveTab}
            sessions={sessions}
            activeRecovery={activeRecovery}
            onResumeRecovery={handleResumeRecovery}
            onDiscardRecovery={handleDiscardRecovery}
            onContinueLastSession={handleContinueLastSession}
            conceptStates={conceptStates}
            bookmarks={bookmarks}
            onStartFocusedReview={handleStartFocusedReview}
            dailyGoalMinutes={preferences.dailyGoalMinutes}
          />
        )}

        {activeTab === 'trainer' && (
          <InstrumentTrainerView
            onSessionComplete={handleSessionComplete}
            bookmarks={bookmarks}
            onRefreshBookmarks={refreshAllData}
            presets={presets}
            onRefreshPresets={refreshAllData}
            initialSettings={trainerInitialSettings}
            forcedChords={trainerForcedChords}
          />
        )}

        {activeTab === 'quiz' && (
          <QuizView
            onSessionComplete={handleSessionComplete}
            conceptStates={conceptStates}
            presets={presets}
            onRefreshPresets={refreshAllData}
            initialSettings={quizInitialSettings}
            overrideQuestions={quizOverrideQuestions}
          />
        )}

        {activeTab === 'collections' && (
          <CollectionsView
            collections={collections}
            onRefreshCollections={refreshAllData}
            onLaunchCollectionTrainer={handleLaunchCollectionTrainer}
          />
        )}

        {activeTab === 'bookmarks' && (
          <BookmarksView
            bookmarks={bookmarks}
            onRefreshBookmarks={refreshAllData}
            onLaunchFocusedTrainer={handleLaunchBookmarksTrainer}
          />
        )}

        {activeTab === 'progress' && (
          <ProgressView
            sessions={sessions}
            conceptStates={conceptStates}
            onStartFocusedReview={handleStartFocusedReview}
            dailyGoalMinutes={preferences.dailyGoalMinutes}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            sessions={sessions}
            onRefreshHistory={refreshAllData}
          />
        )}
      </main>

      {/* Full Backup Modal */}
      {showBackupModal && (
        <BackupModal
          onClose={() => setShowBackupModal(false)}
          onRestoreSuccess={refreshAllData}
        />
      )}

      {/* Offline Status Toast */}
      <OfflineIndicator />
    </div>
  );
};

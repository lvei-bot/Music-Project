/**
 * Home View: Printed Music Journal Aesthetic
 * Editorial introduction, entries to both modes, compact stats,
 * interrupted-session recovery, continue last session, and SR review indicator.
 */

import React from 'react';
import {
  Music,
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
  Flame,
  Clock,
  CheckCircle2,
  AlertCircle,
  Bookmark,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { NavTab } from './Header';
import { CompletedSessionRecord, ActiveSessionRecovery, DifficultChordBookmark } from '../storage/indexedDb';
import { ConceptMasteryState } from '../learning/masteryModel';
import { formatDurationMs } from '../session/timingEngine';

interface HomeViewProps {
  onSelectTab: (tab: NavTab) => void;
  sessions: CompletedSessionRecord[];
  activeRecovery: ActiveSessionRecovery | null;
  onResumeRecovery: () => void;
  onDiscardRecovery: () => void;
  onContinueLastSession: () => void;
  conceptStates: Map<string, ConceptMasteryState>;
  bookmarks: DifficultChordBookmark[];
  onStartFocusedReview: (mode: 'needs_review' | 'due' | 'both') => void;
  dailyGoalMinutes?: number;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onSelectTab,
  sessions,
  activeRecovery,
  onResumeRecovery,
  onDiscardRecovery,
  onContinueLastSession,
  conceptStates,
  bookmarks,
  onStartFocusedReview,
  dailyGoalMinutes = 10,
}) => {
  // Aggregate stats
  const activeSessions = sessions.filter(s => !s.excludedFromAnalytics);
  const totalActiveSeconds = activeSessions.reduce((acc, s) => acc + s.activeDurationSeconds, 0);

  // Daily streak calculation (days with >= dailyGoalMinutes active practice)
  const goalSeconds = dailyGoalMinutes * 60;
  const sessionsByDay = new Map<string, number>();
  for (const s of activeSessions) {
    const day = new Date(s.completedAt).toISOString().split('T')[0];
    sessionsByDay.set(day, (sessionsByDay.get(day) || 0) + s.activeDurationSeconds);
  }

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const dayStr = checkDate.toISOString().split('T')[0];
    const sec = sessionsByDay.get(dayStr) || 0;
    if (i === 0 && sec < goalSeconds) {
      // Today is not complete yet, continue checking yesterday without breaking
      continue;
    }
    if (sec >= goalSeconds) {
      streak += 1;
    } else {
      break;
    }
  }

  // Mastery counts
  let needsReviewCount = 0;
  let masteredCount = 0;
  let dueCount = 0;
  for (const state of conceptStates.values()) {
    if (state.status === 'needs_review') needsReviewCount += 1;
    else if (state.status === 'mastered') {
      masteredCount += 1;
      if (state.isDue) dueCount += 1;
    }
  }

  const lastSession = sessions.length > 0 ? sessions[0] : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-10">
      {/* Interrupted Session Recovery Banner */}
      {activeRecovery && (
        <div className="p-4 sm:p-5 rounded-xl bg-[#A68A55]/10 dark:bg-[#CBB07E]/10 border border-[#A68A55]/30 dark:border-[#CBB07E]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#A68A55] text-white flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-editorial font-bold text-base text-[#29251F] dark:text-[#EDE8E1]">
                Interrupted Session Recovered
              </h3>
              <p className="text-xs text-[#29251F]/70 dark:text-[#EDE8E1]/70">
                You have a paused {activeRecovery.mode === 'instrument' ? 'Instrument Trainer' : 'Quiz'} session from{' '}
                {new Date(activeRecovery.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={onDiscardRecovery}
              type="button"
              className="px-3 py-1.5 text-xs font-semibold rounded-md border border-[#29251F]/20 dark:border-[#EDE8E1]/20 text-[#29251F]/70 dark:text-[#EDE8E1]/70 hover:bg-[#EAE5DC] dark:hover:bg-[#221F1C] transition-colors"
            >
              Discard
            </button>
            <button
              onClick={onResumeRecovery}
              type="button"
              className="px-4 py-1.5 text-xs font-semibold rounded-md bg-[#29251F] dark:bg-[#EDE8E1] text-[#F8F6F1] dark:text-[#181614] hover:bg-black dark:hover:bg-white transition-colors flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Resume Paused</span>
            </button>
          </div>
        </div>
      )}

      {/* Editorial Header Statement */}
      <div className="space-y-3 border-b border-[#29251F]/15 dark:border-[#EDE8E1]/15 pb-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#A68A55] dark:text-[#CBB07E]">
          <span>Exercise Journal No. 1</span>
          <span>•</span>
          <span>Offline Diatonic Harmony</span>
        </div>
        <h1 className="font-editorial text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#29251F] dark:text-[#EDE8E1] leading-tight">
          Master diatonic chord degrees with clarity, precision, and silence.
        </h1>
        <p className="text-sm sm:text-base text-[#29251F]/75 dark:text-[#EDE8E1]/75 max-w-3xl leading-relaxed">
          Designed for musicians practicing at the instrument or training recall on the move. Completely silent,
          offline-first, with rigorous 12-tone voice-leading spelling, harmonic minor support, and adaptive spaced repetition.
        </p>

        {/* Quick Actions Row */}
        <div className="pt-4 flex flex-wrap items-center gap-3">
          {lastSession && (
            <button
              onClick={onContinueLastSession}
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#EAE5DC] dark:bg-[#221F1C] text-[#29251F] dark:text-[#EDE8E1] border border-[#29251F]/15 dark:border-[#EDE8E1]/15 text-xs font-bold hover:border-[#A68A55] transition-colors"
              title="Start a new session with previous settings"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#A68A55]" />
              <span>Continue Last Session ({lastSession.mode === 'instrument' ? 'Trainer' : 'Quiz'})</span>
            </button>
          )}

          {dueCount > 0 && (
            <button
              onClick={() => onStartFocusedReview('due')}
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#B85D19]/15 dark:bg-[#D47732]/20 border border-[#B85D19]/40 text-[#B85D19] dark:text-[#D47732] text-xs font-bold hover:bg-[#B85D19]/25 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{dueCount} Concept{dueCount > 1 ? 's' : ''} Due for Spaced Review</span>
            </button>
          )}
        </div>
      </div>

      {/* Mode Entry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mode A: Instrument Trainer */}
        <div className="group relative rounded-2xl bg-[#EAE5DC]/40 dark:bg-[#221F1C]/40 border border-[#29251F]/15 dark:border-[#EDE8E1]/15 p-6 sm:p-8 flex flex-col justify-between hover:border-[#A68A55] transition-all shadow-2xs">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-lg bg-[#29251F] dark:bg-[#EDE8E1] text-[#F8F6F1] dark:text-[#181614] flex items-center justify-center">
                <Music className="w-5 h-5" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#A68A55] dark:text-[#CBB07E]">
                Mode A • At Instrument
              </span>
            </div>

            <h2 className="font-editorial text-2xl font-bold text-[#29251F] dark:text-[#EDE8E1]">
              Instrument Trainer
            </h2>
            <p className="text-xs sm:text-sm text-[#29251F]/70 dark:text-[#EDE8E1]/70 leading-relaxed">
              Hands-free visual prompter for keyboard, guitar, or bass. Automatic or manual progression, circle of
              fifths, triad/seventh voicings, inversions, and persistent bookmarks for difficult chords.
            </p>
          </div>

          <div className="pt-6 border-t border-[#29251F]/10 dark:border-[#EDE8E1]/10 mt-6 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#29251F]/60 dark:text-[#EDE8E1]/60">
              {bookmarks.length > 0 ? `${bookmarks.length} bookmarked chords` : 'Silent visual pacing'}
            </span>
            <button
              onClick={() => onSelectTab('trainer')}
              type="button"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#29251F] dark:bg-[#EDE8E1] text-[#F8F6F1] dark:text-[#181614] text-xs font-bold hover:bg-black dark:hover:bg-white transition-colors"
            >
              <span>Open Trainer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mode B: No-Instrument Quiz */}
        <div className="group relative rounded-2xl bg-[#EAE5DC]/40 dark:bg-[#221F1C]/40 border border-[#29251F]/15 dark:border-[#EDE8E1]/15 p-6 sm:p-8 flex flex-col justify-between hover:border-[#A68A55] transition-all shadow-2xs">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-lg bg-[#A68A55] text-white flex items-center justify-center">
                <HelpCircle className="w-5 h-5" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#A68A55] dark:text-[#CBB07E]">
                Mode B • Theory Recall
              </span>
            </div>

            <h2 className="font-editorial text-2xl font-bold text-[#29251F] dark:text-[#EDE8E1]">
              No-Instrument Quiz
            </h2>
            <p className="text-xs sm:text-sm text-[#29251F]/70 dark:text-[#EDE8E1]/70 leading-relaxed">
              Diatonic scale-degree and chord identification. Type answers using the on-screen notation toolbar or
              choose multiple choice. Intelligent enharmonic grading, hints, and mistake tracking.
            </p>
          </div>

          <div className="pt-6 border-t border-[#29251F]/10 dark:border-[#EDE8E1]/10 mt-6 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#29251F]/60 dark:text-[#EDE8E1]/60">
              {needsReviewCount > 0 ? `${needsReviewCount} concepts need review` : 'Mastery tracking'}
            </span>
            <button
              onClick={() => onSelectTab('quiz')}
              type="button"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#A68A55] text-white text-xs font-bold hover:bg-[#8e7443] transition-colors"
            >
              <span>Open Quiz</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Practice Journal Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl bg-[#EAE5DC]/30 dark:bg-[#221F1C]/30 border border-[#29251F]/10 dark:border-[#EDE8E1]/10">
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#29251F]/50 dark:text-[#EDE8E1]/50 flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#A68A55]" /> Total Practice
          </span>
          <p className="font-editorial text-xl sm:text-2xl font-bold text-[#29251F] dark:text-[#EDE8E1]">
            {formatDurationMs(totalActiveSeconds * 1000)}
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#29251F]/50 dark:text-[#EDE8E1]/50 flex items-center gap-1">
            <Flame className="w-3 h-3 text-[#B85D19]" /> Daily Streak
          </span>
          <p className="font-editorial text-xl sm:text-2xl font-bold text-[#29251F] dark:text-[#EDE8E1]">
            {streak} Day{streak === 1 ? '' : 's'}
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#29251F]/50 dark:text-[#EDE8E1]/50 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-[#2D7A4D] dark:text-[#48A66C]" /> Mastered
          </span>
          <p className="font-editorial text-xl sm:text-2xl font-bold text-[#29251F] dark:text-[#EDE8E1]">
            {masteredCount}
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#29251F]/50 dark:text-[#EDE8E1]/50 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-[#B85D19] dark:text-[#D47732]" /> Needs Review
          </span>
          <p className="font-editorial text-xl sm:text-2xl font-bold text-[#29251F] dark:text-[#EDE8E1]">
            {needsReviewCount}
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Progress & Mastery Analytics View
 * Editorial practice analytics: active practice time by mode,
 * completed sessions, accuracy, independent recall, practice calendar heat map,
 * and concept mastery table with expandable key-specific breakdowns.
 */

import React, { useState } from 'react';
import {
  BarChart3,
  Flame,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Play,
  RotateCcw,
} from 'lucide-react';
import { CompletedSessionRecord } from '../storage/indexedDb';
import { ConceptMasteryState } from '../learning/masteryModel';
import { formatDurationMs } from '../session/timingEngine';

interface ProgressViewProps {
  sessions: CompletedSessionRecord[];
  conceptStates: Map<string, ConceptMasteryState>;
  onStartFocusedReview: (mode: 'needs_review' | 'due' | 'both') => void;
  dailyGoalMinutes?: number;
}

export const ProgressView: React.FC<ProgressViewProps> = ({
  sessions,
  conceptStates,
  onStartFocusedReview,
  dailyGoalMinutes = 10,
}) => {
  const [timeframe, setTimeframe] = useState<'lifetime' | '30days' | '7days'>('lifetime');
  const [expandedConceptId, setExpandedConceptId] = useState<string | null>(null);

  const activeSessions = sessions.filter(s => !s.excludedFromAnalytics);

  // Timeframe filter
  const now = Date.now();
  const filteredSessions = activeSessions.filter(s => {
    if (timeframe === '7days') return s.completedAt >= now - 7 * 86400000;
    if (timeframe === '30days') return s.completedAt >= now - 30 * 86400000;
    return true;
  });

  const totalActiveSeconds = filteredSessions.reduce((acc, s) => acc + s.activeDurationSeconds, 0);
  const trainerActiveSeconds = filteredSessions.filter(s => s.mode === 'instrument').reduce((acc, s) => acc + s.activeDurationSeconds, 0);
  const quizActiveSeconds = filteredSessions.filter(s => s.mode === 'quiz').reduce((acc, s) => acc + s.activeDurationSeconds, 0);

  // Quiz calculations
  const quizSessions = filteredSessions.filter(s => s.mode === 'quiz');
  let totalAttempts = 0;
  let totalCorrect = 0;
  let totalUnhinted = 0;
  let totalHinted = 0;

  for (const qs of quizSessions) {
    if (qs.summary) {
      totalAttempts += qs.summary.totalItems || 0;
      totalCorrect += qs.summary.correctCount || 0;
      totalHinted += qs.summary.hintedCount || 0;
      totalUnhinted += (qs.summary.correctCount || 0) - (qs.summary.hintedCount || 0);
    }
  }

  const overallAccuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
  const independentRecall = totalAttempts > 0 ? Math.round((totalUnhinted / totalAttempts) * 100) : 0;

  // Concept counts
  let needsReviewCount = 0;
  let masteredCount = 0;
  let dueCount = 0;
  const conceptList = Array.from(conceptStates.values());

  for (const c of conceptList) {
    if (c.status === 'needs_review') needsReviewCount += 1;
    else if (c.status === 'mastered') {
      masteredCount += 1;
      if (c.isDue) dueCount += 1;
    }
  }

  // 30-day practice calendar matrix
  const daysGrid: Array<{ dateStr: string; dayNum: number; activeMinutes: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    const dateStr = d.toISOString().split('T')[0];
    const sec = activeSessions
      .filter(s => new Date(s.completedAt).toISOString().split('T')[0] === dateStr)
      .reduce((acc, s) => acc + s.activeDurationSeconds, 0);

    daysGrid.push({
      dateStr,
      dayNum: d.getDate(),
      activeMinutes: Math.round(sec / 60),
    });
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-200">
      <div className="border-b border-[#29251F]/15 dark:border-[#EDE8E1]/15 pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#A68A55] dark:text-[#CBB07E]">
            Practice Mastery
          </span>
          <h1 className="font-editorial text-3xl font-bold text-[#29251F] dark:text-[#EDE8E1] mt-1">
            Progress & Performance
          </h1>
          <p className="text-xs sm:text-sm text-[#29251F]/70 dark:text-[#EDE8E1]/70">
            Authoritative tracking of active practice hours, concept mastery, and spaced repetition schedules.
          </p>
        </div>

        {/* Timeframe Filter */}
        <div className="flex items-center gap-1 bg-[#EAE5DC]/50 dark:bg-[#221F1C]/50 p-1 rounded-lg border border-[#29251F]/10 dark:border-[#EDE8E1]/10 text-xs">
          {[
            { id: '7days', label: 'Last 7 Days' },
            { id: '30days', label: 'Last 30 Days' },
            { id: 'lifetime', label: 'Lifetime' },
          ].map(tf => (
            <button
              key={tf.id}
              onClick={() => setTimeframe(tf.id as any)}
              type="button"
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                timeframe === tf.id
                  ? 'bg-[#F8F6F1] dark:bg-[#181614] text-[#29251F] dark:text-[#EDE8E1] shadow-2xs'
                  : 'text-[#29251F]/70 dark:text-[#EDE8E1]/70 hover:text-[#29251F]'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Aggregate Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#EAE5DC]/30 dark:bg-[#221F1C]/30 border border-[#29251F]/10 dark:border-[#EDE8E1]/10">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#29251F]/60 dark:text-[#EDE8E1]/60 block mb-1">
            Total Active Practice
          </span>
          <span className="font-editorial text-2xl sm:text-3xl font-bold text-[#29251F] dark:text-[#EDE8E1] block">
            {formatDurationMs(totalActiveSeconds * 1000)}
          </span>
          <span className="text-[10px] text-[#29251F]/50 block mt-1">
            Trainer: {formatDurationMs(trainerActiveSeconds * 1000)} • Quiz: {formatDurationMs(quizActiveSeconds * 1000)}
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-[#EAE5DC]/30 dark:bg-[#221F1C]/30 border border-[#29251F]/10 dark:border-[#EDE8E1]/10">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#A68A55] dark:text-[#CBB07E] block mb-1">
            Overall Accuracy
          </span>
          <span className="font-editorial text-2xl sm:text-3xl font-bold text-[#A68A55] dark:text-[#CBB07E] block">
            {overallAccuracy}%
          </span>
          <span className="text-[10px] text-[#29251F]/50 block mt-1">
            Independent Recall: {independentRecall}%
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-[#EAE5DC]/30 dark:bg-[#221F1C]/30 border border-[#29251F]/10 dark:border-[#EDE8E1]/10">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#2D7A4D] dark:text-[#48A66C] block mb-1">
            Mastered Concepts
          </span>
          <span className="font-editorial text-2xl sm:text-3xl font-bold text-[#2D7A4D] dark:text-[#48A66C] block">
            {masteredCount}
          </span>
          <span className="text-[10px] text-[#29251F]/50 block mt-1">
            {dueCount} Due for review
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-[#EAE5DC]/30 dark:bg-[#221F1C]/30 border border-[#29251F]/10 dark:border-[#EDE8E1]/10">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#B85D19] dark:text-[#D47732] block mb-1">
            Needs Review
          </span>
          <span className="font-editorial text-2xl sm:text-3xl font-bold text-[#B85D19] dark:text-[#D47732] block">
            {needsReviewCount}
          </span>
          <span className="text-[10px] text-[#29251F]/50 block mt-1">
            Pending weakness signals
          </span>
        </div>
      </div>

      {/* 30-Day Practice Heatmap */}
      <div className="p-6 rounded-2xl bg-[#EAE5DC]/30 dark:bg-[#221F1C]/30 border border-[#29251F]/10 dark:border-[#EDE8E1]/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#A68A55]" />
            <h3 className="font-editorial font-bold text-base text-[#29251F] dark:text-[#EDE8E1]">
              Practice Calendar (Last 30 Days)
            </h3>
          </div>
          <span className="text-xs text-[#29251F]/60 dark:text-[#EDE8E1]/60">
            Daily Goal: {dailyGoalMinutes} min active time
          </span>
        </div>

        <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 pt-2">
          {daysGrid.map(d => {
            const metGoal = d.activeMinutes >= dailyGoalMinutes;
            let bg = 'bg-[#F8F6F1] dark:bg-[#181614] text-[#29251F]/50 dark:text-[#EDE8E1]/50';
            if (d.activeMinutes > 0 && !metGoal) {
              bg = 'bg-[#A68A55]/30 text-[#A68A55] font-bold';
            } else if (metGoal) {
              bg = 'bg-[#2D7A4D] text-white font-bold';
            }

            return (
              <div
                key={d.dateStr}
                className={`p-2 rounded-lg border border-[#29251F]/10 text-center transition-all ${bg}`}
                title={`${d.dateStr}: ${d.activeMinutes} min active practice`}
              >
                <span className="text-[11px] block">{d.dayNum}</span>
                <span className="text-[9px] block opacity-80">{d.activeMinutes}m</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Focused Review Launchpad */}
      {(needsReviewCount > 0 || dueCount > 0) && (
        <div className="p-6 rounded-2xl bg-[#A68A55]/10 dark:bg-[#CBB07E]/10 border border-[#A68A55]/30 dark:border-[#CBB07E]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-editorial font-bold text-lg text-[#29251F] dark:text-[#EDE8E1]">
              Launch Focused Review Session
            </h3>
            <p className="text-xs text-[#29251F]/70 dark:text-[#EDE8E1]/70">
              Target {needsReviewCount} weak concepts and {dueCount} concepts due for spaced repetition.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {needsReviewCount > 0 && (
              <button
                onClick={() => onStartFocusedReview('needs_review')}
                type="button"
                className="px-3.5 py-2 text-xs font-bold rounded-lg border border-[#B85D19] text-[#B85D19] hover:bg-[#B85D19]/10"
              >
                Review Weak Only ({needsReviewCount})
              </button>
            )}
            {dueCount > 0 && (
              <button
                onClick={() => onStartFocusedReview('due')}
                type="button"
                className="px-3.5 py-2 text-xs font-bold rounded-lg border border-[#A68A55] text-[#A68A55] hover:bg-[#A68A55]/10"
              >
                Spaced Due Only ({dueCount})
              </button>
            )}
            <button
              onClick={() => onStartFocusedReview('both')}
              type="button"
              className="px-4 py-2 text-xs font-bold rounded-lg bg-[#29251F] dark:bg-[#EDE8E1] text-[#F8F6F1] dark:text-[#181614] flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#A68A55]" />
              <span>Targeted Mixed Review (70/30)</span>
            </button>
          </div>
        </div>
      )}

      {/* Concept Breakdown Table */}
      <div className="space-y-3">
        <h3 className="font-editorial font-bold text-lg text-[#29251F] dark:text-[#EDE8E1]">
          Diatonic Concept Mastery Details ({conceptList.length})
        </h3>

        {conceptList.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-[#EAE5DC]/20 dark:bg-[#221F1C]/20 border border-[#29251F]/10 text-xs text-[#29251F]/50">
            No quiz attempts recorded yet. Take quizzes to build your concept mastery profile.
          </div>
        ) : (
          <div className="space-y-2">
            {conceptList.map(c => {
              const isExpanded = expandedConceptId === c.conceptId;
              let statusBadge = 'bg-[#EAE5DC] text-[#29251F]';
              if (c.status === 'needs_review') statusBadge = 'bg-[#B85D19]/15 text-[#B85D19] border border-[#B85D19]/30';
              else if (c.status === 'mastered') statusBadge = 'bg-[#2D7A4D]/15 text-[#2D7A4D] border border-[#2D7A4D]/30';

              return (
                <div
                  key={c.conceptId}
                  className="rounded-xl border border-[#29251F]/10 dark:border-[#EDE8E1]/10 bg-[#F8F6F1] dark:bg-[#181614] overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedConceptId(isExpanded ? null : c.conceptId)}
                    type="button"
                    className="w-full p-3.5 flex items-center justify-between text-left text-xs hover:bg-[#EAE5DC]/30 dark:hover:bg-[#221F1C]/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusBadge}`}>
                        {c.status.replace('_', ' ')}
                      </span>
                      <span className="font-bold text-[#29251F] dark:text-[#EDE8E1]">
                        {c.conceptId.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-[#29251F]/60 dark:text-[#EDE8E1]/60">
                      <span>
                        Streak: <strong>{c.independentStreak}</strong>
                      </span>
                      {c.isDue && (
                        <span className="text-[#B85D19] font-bold">Due for SR</span>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-4 bg-[#EAE5DC]/20 dark:bg-[#221F1C]/20 border-t border-[#29251F]/10 dark:border-[#EDE8E1]/10 text-xs space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>Total Attempts: <strong>{c.totalAttempts}</strong></div>
                        <div>Unhinted Correct: <strong>{c.unhintedCorrectCount}</strong></div>
                        <div>Hint Assisted: <strong>{c.hintedCorrectCount}</strong></div>
                        <div>Wrong Answers: <strong>{c.wrongCount}</strong></div>
                      </div>
                      <div className="text-[#29251F]/70 dark:text-[#EDE8E1]/70 pt-1">
                        Next Review Scheduled: <strong>{c.dueDate || 'None'}</strong> (Interval step: {c.srIntervalIndex + 1}/8)
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

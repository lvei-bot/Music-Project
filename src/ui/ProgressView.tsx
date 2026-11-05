/**
 * Progress & Mastery Analytics View
 * Rebuilt with prototype editorial layout: .page, .lrow, and thin .prog bars.
 */

import React, { useState } from 'react';
import { CompletedSessionRecord } from '../storage/indexedDb';
import { ConceptMasteryState } from '../learning/masteryModel';

interface ProgressViewProps {
  sessions: CompletedSessionRecord[];
  conceptStates: Map<string, ConceptMasteryState>;
  onStartFocusedReview: (mode: 'needs_review' | 'due' | 'both') => void;
  dailyGoalMinutes?: number;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export const ProgressView: React.FC<ProgressViewProps> = ({
  sessions,
  conceptStates,
  onStartFocusedReview,
  dailyGoalMinutes = 10,
}) => {
  const [expandedConceptId, setExpandedConceptId] = useState<string | null>(null);

  const activeSessions = sessions.filter(s => !s.excludedFromAnalytics);
  const now = Date.now();

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

  // Aggregate stats by degree (1..7)
  const degreeStats: { [deg: number]: { total: number; correct: number } } = {};
  for (let d = 1; d <= 7; d++) {
    degreeStats[d] = { total: 0, correct: 0 };
  }

  conceptList.forEach(c => {
    const degMatch = c.conceptId.match(/deg(\d)/);
    if (degMatch) {
      const deg = Number(degMatch[1]);
      if (degreeStats[deg]) {
        const attempts = c.lifetimeAttempts ?? c.totalAttempts ?? 0;
        const correct = c.lifetimeCorrect ?? ((c.unhintedCorrectCount || 0) + (c.hintedCorrectCount || 0));
        degreeStats[deg].total += attempts;
        degreeStats[deg].correct += correct;
      }
    }
  });

  const hasData = sessions.length > 0 || conceptList.length > 0;

  return (
    <div className="view page">
      {/* Header */}
      <div className="flex items-baseline justify-between flex-wrap gap-4 border-b border-[var(--ink)] pb-4">
        <div>
          <div className="micro muted">Mastery / by degree &amp; concept</div>
          <h1 className="display" style={{ margin: '8px 0 0' }}>
            {hasData ? 'progress.' : 'no data yet.'}
          </h1>
        </div>

        {(needsReviewCount > 0 || dueCount > 0) && (
          <div className="flex items-center gap-2">
            {needsReviewCount > 0 && (
              <button
                type="button"
                onClick={() => onStartFocusedReview('needs_review')}
                className="btn ghost !min-h-[44px] !px-4 !text-xs"
              >
                <span>Weak ({needsReviewCount})</span>
                <span>↺</span>
              </button>
            )}
            {dueCount > 0 && (
              <button
                type="button"
                onClick={() => onStartFocusedReview('due')}
                className="btn acc-bg !min-h-[44px] !px-4 !text-xs"
              >
                <span>Spaced Due ({dueCount})</span>
                <span>↗</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onStartFocusedReview('both')}
              className="btn !min-h-[44px] !px-4 !text-xs"
            >
              <span>Targeted 70/30</span>
              <span>↗</span>
            </button>
          </div>
        )}
      </div>

      {hasData ? (
        <div className="space-y-12 mt-8">
          {/* Degree Mastery List (prototype .lrow with .prog bars) */}
          <div>
            <div className="micro muted mb-4">Diatonic Scale Degrees (I–VII)</div>
            {[1, 2, 3, 4, 5, 6, 7].map(k => {
              const s = degreeStats[k];
              const p = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
              const isLow = s.total > 0 && p < 60;
              const isMastered = s.total >= 4 && p >= 90;

              return (
                <div key={k} className="lrow">
                  <span className="micro">{pad2(k)}</span>
                  <span className="t">{ROMAN[k - 1]}</span>
                  <span className="mid">
                    <span className="micro">
                      {s.total > 0 ? `${p}% · ${s.correct} of ${s.total}` : 'Not practised'}
                      {isLow ? ' · needs review' : isMastered ? ' · mastered' : ''}
                    </span>
                    <div className="prog" role="img" aria-label={`${p} percent`}>
                      <i className={isLow ? 'lo' : ''} style={{ width: `${p}%` }} />
                    </div>
                  </span>
                  <span></span>
                </div>
              );
            })}
          </div>

          {/* 30-Day Calendar Heatmap */}
          <div className="border-t border-[var(--ink)] pt-8">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="display" style={{ fontSize: '2rem' }}>
                consistency.
              </h2>
              <span className="micro muted">Daily Goal: {dailyGoalMinutes}m active</span>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
              {daysGrid.map(d => {
                const met = d.activeMinutes >= dailyGoalMinutes;
                const active = d.activeMinutes > 0;
                return (
                  <div
                    key={d.dateStr}
                    className="p-2 border text-center"
                    style={{
                      background: met ? 'var(--ink)' : active ? 'var(--surface)' : 'transparent',
                      color: met ? '#fff' : 'inherit',
                      borderColor: active ? 'var(--ink)' : 'var(--line)',
                    }}
                    title={`${d.dateStr}: ${d.activeMinutes} min`}
                  >
                    <span className="micro block font-bold">{d.dayNum}</span>
                    <span className="text-[10px] block opacity-80">{d.activeMinutes}m</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full Concept Table */}
          {conceptList.length > 0 && (
            <div className="border-t border-[var(--ink)] pt-8">
              <h2 className="display" style={{ fontSize: '2rem', marginBottom: '16px' }}>
                concepts.
              </h2>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Concept</th>
                    <th>Status</th>
                    <th>Accuracy</th>
                    <th>Last Practised</th>
                  </tr>
                </thead>
                <tbody>
                  {conceptList.map(c => (
                    <tr key={c.conceptId}>
                      <td className="font-bold">{c.conceptId.replace(/_/g, ' ')}</td>
                      <td>
                        <span
                          className={`tag ${
                            c.status === 'mastered' ? 'ok' : c.status === 'needs_review' ? 'no' : 'sk'
                          }`}
                        >
                          {c.status === 'mastered' ? 'Mastered' : c.status === 'needs_review' ? 'Weak' : 'Learning'}
                        </span>
                      </td>
                      <td>
                        {(() => {
                          const attempts = c.lifetimeAttempts ?? c.totalAttempts ?? 0;
                          const correct = c.lifetimeCorrect ?? ((c.unhintedCorrectCount || 0) + (c.hintedCorrectCount || 0));
                          return attempts > 0 ? `${Math.round((correct / attempts) * 100)}% (${correct}/${attempts})` : '—';
                        })()}
                      </td>
                      <td className="micro muted">
                        {(() => {
                          const t = c.lastAttemptTimestamp ?? c.lastAttemptAt;
                          return t ? new Date(t).toLocaleDateString() : '—';
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="empty">
          <div className="display">empty.</div>
          <p>
            Complete trainer or quiz sessions to track your scale degree accuracy, consistency, and spaced repetition schedule.
          </p>
          <button
            type="button"
            className="btn acc-bg big"
            onClick={() => (window.location.hash = '#quiz')}
          >
            <span>Open Quiz</span>
            <span>↗</span>
          </button>
        </div>
      )}
    </div>
  );
};

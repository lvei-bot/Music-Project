/**
 * Session History View
 * Rebuilt with prototype editorial layout: .page, .tbl, and .tag states.
 */

import React, { useState } from 'react';
import {
  CompletedSessionRecord,
  deleteSession,
  toggleSessionAnalyticsExclusion,
} from '../storage/indexedDb';

interface HistoryViewProps {
  sessions: CompletedSessionRecord[];
  onRefreshHistory: () => void;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtT = (s: number) => {
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
};

export const HistoryView: React.FC<HistoryViewProps> = ({
  sessions,
  onRefreshHistory,
}) => {
  const [modeFilter, setModeFilter] = useState<'all' | 'instrument' | 'quiz'>('all');
  const [selectedSession, setSelectedSession] = useState<CompletedSessionRecord | null>(null);

  const filteredSessions = sessions.filter(s => {
    if (modeFilter === 'instrument') return s.mode === 'instrument';
    if (modeFilter === 'quiz') return s.mode === 'quiz';
    return true;
  });

  const handleDelete = async (sessionId: string) => {
    if (
      confirm(
        'Delete this session? Associated attempts will be removed and learning mastery state will be cleanly recomputed.'
      )
    ) {
      await deleteSession(sessionId);
      if (selectedSession?.id === sessionId) setSelectedSession(null);
      onRefreshHistory();
    }
  };

  const handleToggleExclusion = async (s: CompletedSessionRecord) => {
    await toggleSessionAnalyticsExclusion(s.id, !s.excludedFromAnalytics);
    onRefreshHistory();
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(sessions, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_history_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="view page">
      {/* Header */}
      <div className="flex items-baseline justify-between flex-wrap gap-4 border-b border-[var(--ink)] pb-4">
        <div>
          <div className="micro muted">Practice Log / {pad2(sessions.length)} records</div>
          <h1 className="display" style={{ margin: '8px 0 0' }}>
            {sessions.length ? 'history.' : 'no sessions.'}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="seg" role="group">
            <button
              type="button"
              aria-pressed={modeFilter === 'all'}
              onClick={() => setModeFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              aria-pressed={modeFilter === 'instrument'}
              onClick={() => setModeFilter('instrument')}
            >
              Trainer
            </button>
            <button
              type="button"
              aria-pressed={modeFilter === 'quiz'}
              onClick={() => setModeFilter('quiz')}
            >
              Quiz
            </button>
          </div>

          {sessions.length > 0 && (
            <button
              type="button"
              onClick={handleExportJSON}
              className="btn ghost !min-h-[44px] !px-4 !text-xs"
            >
              <span>Export JSON</span>
              <span>↓</span>
            </button>
          )}
        </div>
      </div>

      {filteredSessions.length > 0 ? (
        <div className="mt-8">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Mode</th>
                <th>Active Time</th>
                <th>Items</th>
                <th>Summary</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map((s, i) => (
                <tr key={s.id}>
                  <td className="st">
                    <span className="block font-bold">
                      {new Date(s.completedAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="micro muted block">
                      {new Date(s.completedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </td>
                  <td>
                    <span className="tag">
                      {s.mode === 'instrument' ? 'Trainer' : 'Quiz'}
                    </span>
                  </td>
                  <td>{fmtT(s.activeDurationSeconds)}</td>
                  <td>{s.summary?.totalItems || 0}</td>
                  <td>
                    {s.mode === 'quiz' ? (
                      <span className="font-bold">
                        {s.summary?.correctCount ?? 0} / {s.summary?.totalItems ?? 0} ({s.summary?.accuracyPercent ?? 0}%)
                      </span>
                    ) : (
                      <span className="micro muted">
                        {s.settingsSnapshot.progressionMode} · {s.settingsSnapshot.chordType}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleToggleExclusion(s)}
                      className={`tag ${s.excludedFromAnalytics ? 'no' : 'ok'}`}
                      title={s.excludedFromAnalytics ? 'Excluded from analytics' : 'Included in analytics'}
                    >
                      {s.excludedFromAnalytics ? 'Excluded' : 'Active'}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      className="x"
                      title="Delete record"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <div className="display">empty.</div>
          <p>Complete your first instrument training or quiz session to record history.</p>
        </div>
      )}
    </div>
  );
};

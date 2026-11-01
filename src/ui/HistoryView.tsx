/**
 * Session History View
 * Filter by mode / date, view details, toggle analytics inclusion,
 * delete session with deterministic learning state recomputation,
 * and export/import sessions.
 */

import React, { useState } from 'react';
import {
  History,
  Trash2,
  Eye,
  EyeOff,
  Filter,
  Download,
  Music,
  HelpCircle,
  Calendar,
  Clock,
  CheckCircle2,
  X,
} from 'lucide-react';
import {
  CompletedSessionRecord,
  deleteSession,
  toggleSessionAnalyticsExclusion,
} from '../storage/indexedDb';
import { formatDurationMs } from '../session/timingEngine';

interface HistoryViewProps {
  sessions: CompletedSessionRecord[];
  onRefreshHistory: () => void;
}

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
    if (confirm('Delete this session? Associated attempts will be removed and learning mastery state will be cleanly recomputed.')) {
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
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-200">
      <div className="border-b border-[#29251F]/15 dark:border-[#EDE8E1]/15 pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#A68A55] dark:text-[#CBB07E]">
            Practice Log
          </span>
          <h1 className="font-editorial text-3xl font-bold text-[#29251F] dark:text-[#EDE8E1] mt-1">
            Session History
          </h1>
          <p className="text-xs sm:text-sm text-[#29251F]/70 dark:text-[#EDE8E1]/70">
            Chronological records for Instrument Trainer and Theory Quizzes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJSON}
            type="button"
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg border border-[#29251F]/20 dark:border-[#EDE8E1]/20 hover:bg-[#EAE5DC] dark:hover:bg-[#221F1C] flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Sessions JSON</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-[#29251F]/10 dark:border-[#EDE8E1]/10 pb-3 text-xs">
        {[
          { id: 'all', label: `All Sessions (${sessions.length})` },
          { id: 'instrument', label: `Instrument Trainer (${sessions.filter(s => s.mode === 'instrument').length})` },
          { id: 'quiz', label: `Quizzes (${sessions.filter(s => s.mode === 'quiz').length})` },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setModeFilter(tab.id as any)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              modeFilter === tab.id
                ? 'bg-[#A68A55] text-white'
                : 'text-[#29251F]/70 dark:text-[#EDE8E1]/70 hover:bg-[#EAE5DC]/50 dark:hover:bg-[#221F1C]/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sessions Table */}
      <div className="space-y-3">
        {filteredSessions.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-[#EAE5DC]/20 dark:bg-[#221F1C]/20 border border-[#29251F]/10 text-xs text-[#29251F]/50">
            No completed sessions found for this filter.
          </div>
        ) : (
          filteredSessions.map(s => {
            const isSelected = selectedSession?.id === s.id;
            return (
              <div
                key={s.id}
                className={`p-4 rounded-xl border transition-all ${
                  s.excludedFromAnalytics
                    ? 'opacity-60 bg-[#EAE5DC]/10 border-[#29251F]/10'
                    : 'bg-[#F8F6F1] dark:bg-[#181614] border-[#29251F]/15 dark:border-[#EDE8E1]/15 hover:border-[#A68A55]'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        s.mode === 'instrument'
                          ? 'bg-[#29251F] dark:bg-[#EDE8E1] text-[#F8F6F1] dark:text-[#181614]'
                          : 'bg-[#A68A55] text-white'
                      }`}
                    >
                      {s.mode === 'instrument' ? <Music className="w-4 h-4" /> : <HelpCircle className="w-4 h-4" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-editorial text-base font-bold text-[#29251F] dark:text-[#EDE8E1]">
                          {s.mode === 'instrument' ? 'Instrument Trainer Session' : 'Theory Quiz Session'}
                        </span>
                        {s.excludedFromAnalytics && (
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-500">
                            Excluded from Analytics
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#29251F]/60 dark:text-[#EDE8E1]/60 mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                        <span>{new Date(s.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        <span>•</span>
                        <span>Active Time: <strong>{formatDurationMs(s.activeDurationSeconds * 1000)}</strong></span>
                        <span>•</span>
                        <span>Total Items: <strong>{s.summary.totalItems}</strong></span>
                        {s.summary.accuracyPercent !== undefined && (
                          <>
                            <span>•</span>
                            <span>Accuracy: <strong>{s.summary.accuracyPercent}%</strong></span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => handleToggleExclusion(s)}
                      type="button"
                      className="px-2.5 py-1 text-xs rounded-md border border-[#29251F]/15 dark:border-[#EDE8E1]/15 text-[#29251F]/70 dark:text-[#EDE8E1]/70 hover:bg-[#EAE5DC]"
                      title={s.excludedFromAnalytics ? 'Include in analytics' : 'Exclude from analytics (retains learning attempts)'}
                    >
                      {s.excludedFromAnalytics ? 'Include' : 'Exclude'}
                    </button>

                    <button
                      onClick={() => setSelectedSession(isSelected ? null : s)}
                      type="button"
                      className="px-3 py-1 text-xs font-semibold rounded-md border border-[#29251F]/20 hover:bg-[#EAE5DC]"
                    >
                      {isSelected ? 'Hide' : 'Details'}
                    </button>

                    <button
                      onClick={() => handleDelete(s.id)}
                      type="button"
                      className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-md"
                      title="Delete session"
                      aria-label="Delete session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded Session Snapshot Details */}
                {isSelected && (
                  <div className="mt-4 pt-3 border-t border-[#29251F]/10 dark:border-[#EDE8E1]/10 text-xs space-y-2 animate-in fade-in">
                    <h5 className="font-bold text-[#29251F] dark:text-[#EDE8E1]">Settings Snapshot:</h5>
                    <pre className="p-3 rounded-lg bg-[#EAE5DC]/30 dark:bg-[#221F1C]/30 text-[11px] overflow-x-auto font-mono text-[#29251F]/80 dark:text-[#EDE8E1]/80">
                      {JSON.stringify(s.settingsSnapshot, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

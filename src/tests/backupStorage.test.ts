import { describe, it, expect } from 'vitest';
import { validateBackupData } from '../storage/indexedDb';

describe('Storage & Backup Validation', () => {
  it('validates a correct version 1 backup structure', () => {
    const validBackup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      appName: 'Diatonic Chord Practice & Trainer',
      sessions: [
        {
          id: 's1',
          mode: 'quiz',
          startedAt: 1000,
          completedAt: 2000,
          activeDurationSeconds: 60,
          pausedDurationSeconds: 0,
          wallClockDurationSeconds: 60,
          settingsSnapshot: {},
          summary: { totalItems: 10, correctCount: 9 },
          excludedFromAnalytics: false,
        },
      ],
      quizAttempts: [
        {
          id: 'a1',
          sessionId: 's1',
          conceptId: 'major_deg1_triad',
          keyConceptId: 'C_major_deg1_triad',
          timestamp: 1050,
          isCorrect: true,
          usedHint: false,
          isSkipped: false,
          isTimeout: false,
        },
      ],
      manualEvents: [],
      collections: [],
      bookmarks: [],
      presets: [],
      preferences: { theme: 'system', dailyGoalMinutes: 10 },
    };

    const res = validateBackupData(validBackup);
    expect(res.isValid).toBe(true);
    expect(res.summary?.sessionsCount).toBe(1);
    expect(res.summary?.attemptsCount).toBe(1);
  });

  it('rejects unsupported backup versions', () => {
    const invalidVersion = {
      version: 2,
      sessions: [],
      quizAttempts: [],
    };
    const res = validateBackupData(invalidVersion);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Unsupported backup version');
  });

  it('rejects malformed or empty data', () => {
    expect(validateBackupData(null).isValid).toBe(false);
    expect(validateBackupData('not json').isValid).toBe(false);
    expect(validateBackupData({ version: 1 }).isValid).toBe(false);
  });
});

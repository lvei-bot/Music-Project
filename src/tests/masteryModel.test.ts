import { describe, it, expect } from 'vitest';
import {
  createInitialConceptState,
  applyAttemptRecord,
  applyManualEvent,
  reconstructMasteryStates,
  QuizAttemptRecord,
  SR_INTERVALS_DAYS,
} from '../learning/masteryModel';

describe('Learning & Mastery State Machine', () => {
  it('moves from Normal to Needs Review after 2 incorrect attempts', () => {
    const state = createInitialConceptState('test_concept');
    expect(state.status).toBe('normal');

    // 1st wrong
    applyAttemptRecord(state, {
      id: 'a1',
      sessionId: 's1',
      conceptId: 'test_concept',
      keyConceptId: 'k1',
      timestamp: 1000,
      isCorrect: false,
      usedHint: false,
      isSkipped: false,
      isTimeout: false,
    });
    expect(state.status).toBe('normal');
    expect(state.incorrectSignals).toBe(1);

    // 2nd wrong
    applyAttemptRecord(state, {
      id: 'a2',
      sessionId: 's1',
      conceptId: 'test_concept',
      keyConceptId: 'k1',
      timestamp: 2000,
      isCorrect: false,
      usedHint: false,
      isSkipped: false,
      isTimeout: false,
    });
    expect(state.status).toBe('needs_review');
    expect(state.incorrectSignals).toBe(0); // reset upon transition
  });

  it('moves from Normal to Needs Review after 3 hinted attempts', () => {
    const state = createInitialConceptState('test_concept');

    for (let i = 0; i < 3; i++) {
      applyAttemptRecord(state, {
        id: `a${i}`,
        sessionId: 's1',
        conceptId: 'test_concept',
        keyConceptId: 'k1',
        timestamp: 1000 + i * 100,
        isCorrect: true,
        usedHint: true,
        isSkipped: false,
        isTimeout: false,
      });
    }

    expect(state.status).toBe('needs_review');
  });

  it('moves from Needs Review to Mastered after 3 consecutive unhinted correct answers', () => {
    const state = createInitialConceptState('test_concept');
    state.status = 'needs_review';

    // 3 consecutive unhinted correct answers
    for (let i = 1; i <= 3; i++) {
      applyAttemptRecord(state, {
        id: `a${i}`,
        sessionId: 's1',
        conceptId: 'test_concept',
        keyConceptId: 'k1',
        timestamp: 1000 + i * 1000,
        isCorrect: true,
        usedHint: false,
        isSkipped: false,
        isTimeout: false,
      });
    }

    expect(state.status).toBe('mastered');
    expect(state.independentStreak).toBe(3);
    expect(state.srIntervalIndex).toBe(0); // 1 day interval
    expect(state.dueDate).not.toBeNull();
  });

  it('breaks streak on hint or skip', () => {
    const state = createInitialConceptState('test_concept');
    state.status = 'needs_review';

    // 2 unhinted correct
    applyAttemptRecord(state, { id: '1', sessionId: 's1', conceptId: 'c1', keyConceptId: 'k1', timestamp: 1, isCorrect: true, usedHint: false, isSkipped: false, isTimeout: false });
    applyAttemptRecord(state, { id: '2', sessionId: 's1', conceptId: 'c1', keyConceptId: 'k1', timestamp: 2, isCorrect: true, usedHint: false, isSkipped: false, isTimeout: false });
    expect(state.independentStreak).toBe(2);

    // Skip breaks streak
    applyAttemptRecord(state, { id: '3', sessionId: 's1', conceptId: 'c1', keyConceptId: 'k1', timestamp: 3, isCorrect: false, usedHint: false, isSkipped: true, isTimeout: false });
    expect(state.independentStreak).toBe(0);
    expect(state.status).toBe('needs_review');
  });

  describe('Spaced Repetition Schedule', () => {
    it('advances intervals on consecutive unhinted correct answers in Mastered state', () => {
      const state = createInitialConceptState('test_concept');
      state.status = 'mastered';
      state.srIntervalIndex = 0; // 1 day

      // 1st review unhinted correct -> interval advances to index 1 (3 days)
      applyAttemptRecord(state, { id: '1', sessionId: 's1', conceptId: 'c1', keyConceptId: 'k1', timestamp: 10000, isCorrect: true, usedHint: false, isSkipped: false, isTimeout: false });
      expect(state.srIntervalIndex).toBe(1);

      // 2nd review unhinted correct -> interval advances to index 2 (7 days)
      applyAttemptRecord(state, { id: '2', sessionId: 's1', conceptId: 'c1', keyConceptId: 'k1', timestamp: 20000, isCorrect: true, usedHint: false, isSkipped: false, isTimeout: false });
      expect(state.srIntervalIndex).toBe(2);
    });

    it('resets interval to 1 day on wrong answer in Mastered state', () => {
      const state = createInitialConceptState('test_concept');
      state.status = 'mastered';
      state.srIntervalIndex = 4; // 30 days

      applyAttemptRecord(state, { id: '1', sessionId: 's1', conceptId: 'c1', keyConceptId: 'k1', timestamp: 10000, isCorrect: false, usedHint: false, isSkipped: false, isTimeout: false });
      expect(state.srIntervalIndex).toBe(0); // reset to 1 day
      expect(state.incorrectSignals).toBe(1);
      expect(state.status).toBe('mastered'); // 1 error does not immediately revoke mastery
    });

    it('reopens Mastered to Needs Review after 2 subsequent wrong answers', () => {
      const state = createInitialConceptState('test_concept');
      state.status = 'mastered';

      applyAttemptRecord(state, { id: '1', sessionId: 's1', conceptId: 'c1', keyConceptId: 'k1', timestamp: 10000, isCorrect: false, usedHint: false, isSkipped: false, isTimeout: false });
      applyAttemptRecord(state, { id: '2', sessionId: 's1', conceptId: 'c1', keyConceptId: 'k1', timestamp: 20000, isCorrect: false, usedHint: false, isSkipped: false, isTimeout: false });

      expect(state.status).toBe('needs_review');
    });
  });

  describe('Deterministic State Reconstruction', () => {
    it('rebuilds identical state from ordered events', () => {
      const attempts: QuizAttemptRecord[] = [
        { id: 'a1', sessionId: 's1', conceptId: 'c1', keyConceptId: 'k1', timestamp: 1000, isCorrect: false, usedHint: false, isSkipped: false, isTimeout: false },
        { id: 'a2', sessionId: 's1', conceptId: 'c1', keyConceptId: 'k1', timestamp: 2000, isCorrect: false, usedHint: false, isSkipped: false, isTimeout: false },
        { id: 'a3', sessionId: 's2', conceptId: 'c1', keyConceptId: 'k1', timestamp: 3000, isCorrect: true, usedHint: false, isSkipped: false, isTimeout: false },
        { id: 'a4', sessionId: 's2', conceptId: 'c1', keyConceptId: 'k1', timestamp: 4000, isCorrect: true, usedHint: false, isSkipped: false, isTimeout: false },
        { id: 'a5', sessionId: 's2', conceptId: 'c1', keyConceptId: 'k1', timestamp: 5000, isCorrect: true, usedHint: false, isSkipped: false, isTimeout: false },
      ];

      const states = reconstructMasteryStates(attempts, []);
      const c1State = states.get('c1');

      expect(c1State).toBeDefined();
      expect(c1State?.status).toBe('mastered');
      expect(c1State?.totalAttempts).toBe(5);
      expect(c1State?.unhintedCorrectCount).toBe(3);
      expect(c1State?.wrongCount).toBe(2);
    });
  });
});

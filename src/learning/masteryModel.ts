/**
 * Learning & Mastery Model: State Machine, Spaced Repetition (SR),
 * and Deterministic Event-Based State Reconstruction.
 */

export type MasteryStatus = 'normal' | 'needs_review' | 'mastered';

export interface QuizAttemptRecord {
  id: string;
  sessionId: string;
  conceptId: string;
  keyConceptId: string;
  timestamp: number;
  isCorrect: boolean;
  usedHint: boolean;
  isSkipped: boolean;
  isTimeout: boolean;
  userAnswer?: string;
}

export type ManualLearningActionType = 'manual_needs_review' | 'manual_mastered' | 'manual_reopen';

export interface ManualLearningEvent {
  id: string;
  conceptId: string;
  type: ManualLearningActionType;
  timestamp: number;
  note?: string;
}

export interface ConceptMasteryState {
  conceptId: string;
  status: MasteryStatus;
  incorrectSignals: number; // Pending wrong signals
  hintedSignals: number; // Pending hinted signals
  independentStreak: number; // Consecutive unhinted correct answers
  totalAttempts: number;
  unhintedCorrectCount: number;
  hintedCorrectCount: number;
  wrongCount: number;
  skippedCount: number;
  timeoutCount: number;
  srIntervalIndex: number; // 0..7 -> [1, 3, 7, 14, 30, 60, 120, 180]
  dueDate: string | null; // ISO YYYY-MM-DD
  isDue: boolean;
  lastAttemptAt: number | null;
  masteredAt: number | null;
}

export const SR_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60, 120, 180];

/**
 * Format timestamp into local calendar date string (YYYY-MM-DD)
 */
export function toLocalDateString(timestamp: number): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Add days to a timestamp and get resulting local YYYY-MM-DD
 */
export function addDaysToLocalDate(timestamp: number, days: number): string {
  const d = new Date(timestamp);
  d.setDate(d.getDate() + days);
  return toLocalDateString(d.getTime());
}

/**
 * Compare whether dueDate is today or earlier in local time
 */
export function isDueDatePassed(dueDate: string | null, nowTimestamp: number = Date.now()): boolean {
  if (!dueDate) return false;
  const todayStr = toLocalDateString(nowTimestamp);
  return dueDate <= todayStr;
}

/**
 * Initial empty concept state
 */
export function createInitialConceptState(conceptId: string): ConceptMasteryState {
  return {
    conceptId,
    status: 'normal',
    incorrectSignals: 0,
    hintedSignals: 0,
    independentStreak: 0,
    totalAttempts: 0,
    unhintedCorrectCount: 0,
    hintedCorrectCount: 0,
    wrongCount: 0,
    skippedCount: 0,
    timeoutCount: 0,
    srIntervalIndex: 0,
    dueDate: null,
    isDue: false,
    lastAttemptAt: null,
    masteredAt: null,
  };
}

type TimelineEvent =
  | { kind: 'attempt'; data: QuizAttemptRecord }
  | { kind: 'manual'; data: ManualLearningEvent };

/**
 * Reconstruct mastery states deterministically from raw attempts and manual events
 */
export function reconstructMasteryStates(
  attempts: QuizAttemptRecord[],
  manualEvents: ManualLearningEvent[],
  nowTimestamp: number = Date.now()
): Map<string, ConceptMasteryState> {
  const stateMap = new Map<string, ConceptMasteryState>();

  // Combine and sort events strictly chronologically
  const timeline: TimelineEvent[] = [
    ...attempts.map(a => ({ kind: 'attempt' as const, data: a })),
    ...manualEvents.map(m => ({ kind: 'manual' as const, data: m })),
  ].sort((a, b) => {
    if (a.data.timestamp !== b.data.timestamp) {
      return a.data.timestamp - b.data.timestamp;
    }
    // Stable tie-breaker: attempts before manual events, then by ID
    if (a.kind !== b.kind) return a.kind === 'attempt' ? -1 : 1;
    return a.data.id.localeCompare(b.data.id);
  });

  for (const item of timeline) {
    const conceptId = item.data.conceptId;
    let state = stateMap.get(conceptId);
    if (!state) {
      state = createInitialConceptState(conceptId);
      stateMap.set(conceptId, state);
    }

    if (item.kind === 'manual') {
      applyManualEvent(state, item.data);
    } else {
      applyAttemptRecord(state, item.data);
    }
  }

  // Update isDue flag based on nowTimestamp
  for (const state of stateMap.values()) {
    if (state.status === 'mastered' && state.dueDate) {
      state.isDue = isDueDatePassed(state.dueDate, nowTimestamp);
    } else {
      state.isDue = false;
    }
  }

  return stateMap;
}

/**
 * Apply a single attempt according to Section 13 & 14 rules
 */
export function applyAttemptRecord(state: ConceptMasteryState, attempt: QuizAttemptRecord) {
  state.totalAttempts += 1;
  state.lastAttemptAt = attempt.timestamp;

  if (attempt.isSkipped) {
    state.skippedCount += 1;
    state.independentStreak = 0; // breaks streak
    return;
  }

  if (attempt.isTimeout) {
    state.timeoutCount += 1;
    state.independentStreak = 0; // breaks streak
    return;
  }

  if (!attempt.isCorrect) {
    state.wrongCount += 1;
    state.independentStreak = 0; // breaks streak

    if (state.status === 'normal') {
      state.incorrectSignals += 1;
      if (state.incorrectSignals >= 2) {
        state.status = 'needs_review';
        state.incorrectSignals = 0;
        state.hintedSignals = 0;
      }
    } else if (state.status === 'mastered') {
      state.incorrectSignals += 1;
      // SR reset on wrong
      state.srIntervalIndex = 0;
      state.dueDate = addDaysToLocalDate(attempt.timestamp, SR_INTERVALS_DAYS[0]);

      if (state.incorrectSignals >= 2) {
        state.status = 'needs_review';
        state.dueDate = null;
        state.isDue = false;
        state.incorrectSignals = 0;
        state.hintedSignals = 0;
      }
    }
    return;
  }

  // Correct answer
  if (attempt.usedHint) {
    state.hintedCorrectCount += 1;
    state.independentStreak = 0; // breaks streak

    if (state.status === 'normal') {
      state.hintedSignals += 1;
      if (state.hintedSignals >= 3) {
        state.status = 'needs_review';
        state.incorrectSignals = 0;
        state.hintedSignals = 0;
      }
    } else if (state.status === 'mastered') {
      state.hintedSignals += 1;
      // Hinted correct keeps current interval
      state.dueDate = addDaysToLocalDate(attempt.timestamp, SR_INTERVALS_DAYS[state.srIntervalIndex]);

      if (state.hintedSignals >= 3) {
        state.status = 'needs_review';
        state.dueDate = null;
        state.isDue = false;
        state.incorrectSignals = 0;
        state.hintedSignals = 0;
      }
    }
    return;
  }

  // Unhinted correct answer
  state.unhintedCorrectCount += 1;
  state.independentStreak += 1;

  if (state.status === 'normal') {
    if (state.independentStreak >= 3) {
      // Clears pending weakness signals
      state.incorrectSignals = 0;
      state.hintedSignals = 0;
    }
  } else if (state.status === 'needs_review') {
    if (state.independentStreak >= 3) {
      // Promoted to Mastered!
      state.status = 'mastered';
      state.masteredAt = attempt.timestamp;
      state.incorrectSignals = 0;
      state.hintedSignals = 0;
      state.srIntervalIndex = 0;
      state.dueDate = addDaysToLocalDate(attempt.timestamp, SR_INTERVALS_DAYS[0]);
    }
  } else if (state.status === 'mastered') {
    // Unhinted correct advances SR interval
    state.srIntervalIndex = Math.min(state.srIntervalIndex + 1, SR_INTERVALS_DAYS.length - 1);
    const days = SR_INTERVALS_DAYS[state.srIntervalIndex];
    state.dueDate = addDaysToLocalDate(attempt.timestamp, days);
    state.incorrectSignals = 0;
    state.hintedSignals = 0;
  }
}

/**
 * Apply explicit manual action
 */
export function applyManualEvent(state: ConceptMasteryState, event: ManualLearningEvent) {
  if (event.type === 'manual_needs_review') {
    state.status = 'needs_review';
    state.dueDate = null;
    state.isDue = false;
    state.independentStreak = 0;
    state.incorrectSignals = 0;
    state.hintedSignals = 0;
  } else if (event.type === 'manual_mastered') {
    state.status = 'mastered';
    state.masteredAt = event.timestamp;
    state.independentStreak = 3;
    state.incorrectSignals = 0;
    state.hintedSignals = 0;
    state.srIntervalIndex = 0;
    state.dueDate = addDaysToLocalDate(event.timestamp, SR_INTERVALS_DAYS[0]);
  } else if (event.type === 'manual_reopen') {
    state.status = 'normal';
    state.dueDate = null;
    state.isDue = false;
    state.independentStreak = 0;
    state.incorrectSignals = 0;
    state.hintedSignals = 0;
  }
}

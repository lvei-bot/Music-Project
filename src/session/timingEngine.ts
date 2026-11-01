/**
 * Authoritative Timing Engine for Instrument Trainer and Quiz Sessions.
 * Handles single-clock active timing, freeze-on-pause/hide, deadlines,
 * countdowns, and duration extensions.
 */

export interface TimingState {
  status: 'idle' | 'countdown' | 'running' | 'paused' | 'expired' | 'completed';
  startedAt: number; // Wall-clock timestamp when session started
  activeElapsedMs: number; // Accumulated milliseconds of genuine active practice
  pausedElapsedMs: number; // Accumulated milliseconds in paused state
  wallClockElapsedMs: number; // Total wall-clock duration
  lastActiveSliceStart: number | null; // Timestamp when current active slice began
  lastPauseSliceStart: number | null; // Timestamp when current pause slice began

  // Planned session duration
  plannedDurationMs: number | null; // null = unlimited / manual
  cumulativeExtensionMs: number; // Sum of +5, +10, +15 min extensions
  totalAllowanceMs: number | null;

  // Next chord countdown (Instrument trainer auto mode)
  chordIntervalMs: number | null;
  chordElapsedMs: number;
  chordRemainingMs: number;
}

export function createInitialTimingState(
  plannedDurationMinutes: number | null = null,
  chordIntervalSeconds: number | null = null
): TimingState {
  const plannedMs = plannedDurationMinutes ? plannedDurationMinutes * 60 * 1000 : null;
  const chordMs = chordIntervalSeconds ? chordIntervalSeconds * 1000 : null;

  return {
    status: 'idle',
    startedAt: 0,
    activeElapsedMs: 0,
    pausedElapsedMs: 0,
    wallClockElapsedMs: 0,
    lastActiveSliceStart: null,
    lastPauseSliceStart: null,

    plannedDurationMs: plannedMs,
    cumulativeExtensionMs: 0,
    totalAllowanceMs: plannedMs,

    chordIntervalMs: chordMs,
    chordElapsedMs: 0,
    chordRemainingMs: chordMs || 0,
  };
}

/**
 * Format milliseconds into MM:SS or HH:MM:SS
 */
export function formatDurationMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Format seconds into MM:SS
 */
export function formatSeconds(seconds: number): string {
  return formatDurationMs(seconds * 1000);
}

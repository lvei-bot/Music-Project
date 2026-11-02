/**
 * Home View: Stark High-Contrast Editorial Design
 * Faithfully matches chord-prototype.html with oversized wordmark,
 * vivid #FF4B30 accent block, abstract piano artwork, action rows,
 * and the three movements index.
 */

import React from 'react';
import { NavTab } from './Header';
import { CompletedSessionRecord, ActiveSessionRecovery, DifficultChordBookmark } from '../storage/indexedDb';
import { ConceptMasteryState } from '../learning/masteryModel';

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

// Abstract keyboard artwork where C-E-G chord tones rise above the rest
const ArtSVG: React.FC = () => {
  const w = 60;
  const keys = 7;
  const tops = [30, 230, 0, 230, 90, 230, 230];
  const whiteRects: React.ReactNode[] = [];
  for (let i = 0; i < keys; i++) {
    const raised = [0, 2, 4].includes(i);
    whiteRects.push(
      <rect
        key={`w-${i}`}
        x={i * w + 1.5}
        y={tops[i]}
        width={w - 3}
        height={1000 - tops[i]}
        fill={raised ? '#111' : '#fff'}
        stroke="#111"
        strokeWidth="2.5"
      />
    );
  }

  const blackRects: React.ReactNode[] = [];
  [0, 1, 3, 4, 5].forEach(i => {
    const isRaised = [0, 2, 4].includes(i) || [0, 2, 4].includes(i + 1);
    blackRects.push(
      <rect
        key={`b-${i}`}
        x={(i + 1) * w - 13}
        y={230}
        width={26}
        height={250}
        fill="#111"
        stroke={isRaised ? '#fff' : '#111'}
        strokeWidth="1.5"
      />
    );
  });

  const markers: React.ReactNode[] = [];
  [0, 2, 4].forEach(i => {
    markers.push(
      <rect
        key={`m-${i}`}
        x={i * w + 17}
        y={tops[i] + 16}
        width={26}
        height={5}
        fill="#fff"
      />
    );
  });

  return (
    <svg viewBox="0 0 420 1000" preserveAspectRatio="xMidYMin slice" aria-hidden="true" focusable="false">
      {whiteRects}
      {blackRects}
      {markers}
    </svg>
  );
};

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
}) => {
  // Mastery counts
  let dueCount = 0;
  for (const state of conceptStates.values()) {
    if (state.status === 'mastered' && state.isDue) dueCount += 1;
  }

  const lastSession = sessions.length > 0 ? sessions[0] : null;

  return (
    <div className="view">
      {/* Interrupted Session Recovery Banner */}
      {activeRecovery && (
        <div className="mx-auto max-w-[var(--content-max)] px-[var(--pad)] pt-4">
          <div className="border-2 border-[var(--ink)] bg-[var(--accent)] text-[var(--ink)] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="micro font-black tracking-wider">Interrupted Session Recovered</div>
              <div className="font-bold text-sm mt-1">
                Paused {activeRecovery.mode === 'instrument' ? 'Instrument Trainer' : 'Quiz'} session from{' '}
                {new Date(activeRecovery.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onDiscardRecovery}
                className="btn ghost !min-h-[44px] !px-4 !text-xs"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={onResumeRecovery}
                className="btn !min-h-[44px] !px-5 !text-xs !bg-[var(--ink)] !text-white"
              >
                Resume Paused →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="hero" aria-labelledby="h1">
        <div className="stage" id="stage">
          <h1 id="h1" className="display wordmark">chord.</h1>
          <div className="acc-block">
            <button
              type="button"
              className="sq go"
              onClick={() => onSelectTab('trainer')}
              aria-label="Start instrument trainer setup"
            >
              →
            </button>
          </div>
          <div className="art">
            <ArtSVG />
          </div>
          <div className="blurb micro muted">
            <span>Diatonic chord practice for scale degrees, triads &amp; sevenths.</span>
            <span>Silent. Offline-first. No accounts. Keep practising.</span>
          </div>
          <div className="vtext" aria-hidden="true">
            <div className="vert">
              Diatonic<br />chord practice
            </div>
            <i></i>
          </div>
          <div className="num" aria-hidden="true">07</div>
        </div>

        <div className="actions">
          <button
            type="button"
            className="act"
            onClick={() => onSelectTab('trainer')}
          >
            <span>
              Instrument trainer
              <small>Chords on screen. You play them.</small>
            </span>
            <span aria-hidden="true">→</span>
          </button>
          <button
            type="button"
            className="act"
            onClick={() => onSelectTab('quiz')}
          >
            <span>
              No-instrument quiz
              <small>Name the chord. Name the degree.</small>
            </span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      {/* Quick session resume or due spaced review triggers */}
      {(lastSession || dueCount > 0) && (
        <section className="px-[var(--pad)] py-6 border-t border-[var(--line)]">
          <div className="max-w-[var(--content-max)] mx-auto flex flex-wrap items-center gap-4">
            {lastSession && (
              <button
                type="button"
                onClick={onContinueLastSession}
                className="btn !min-h-[48px] !text-xs"
              >
                <span>Continue Last ({lastSession.mode === 'instrument' ? 'Trainer' : 'Quiz'})</span>
                <span>↺</span>
              </button>
            )}
            {dueCount > 0 && (
              <button
                type="button"
                onClick={() => onStartFocusedReview('due')}
                className="btn acc-bg !min-h-[48px] !text-xs"
              >
                <span>{dueCount} Concept{dueCount > 1 ? 's' : ''} Due for Spaced Review</span>
                <span>↗</span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* Three Movements Editorial Index */}
      <section className="rows" aria-label="How it works">
        <div className="lead">
          <div className="micro muted">Edition 01 / Practice index</div>
          <h2
            className="display"
            style={{ fontSize: 'clamp(2.6rem, 5vw, 5rem)', marginTop: '14px' }}
          >
            three<br />movements.
          </h2>
        </div>
        <div className="list">
          <button
            type="button"
            className="rrow"
            onClick={() => onSelectTab('trainer')}
          >
            <span className="micro">01</span>
            <span className="t">train</span>
            <p>
              Chords arrive on a timer or on your command. Notes, inversion and a keyboard diagram support the hands.
            </p>
            <span className="ar" aria-hidden="true">↗</span>
          </button>
          <button
            type="button"
            className="rrow"
            onClick={() => onSelectTab('quiz')}
          >
            <span className="micro">02</span>
            <span className="t">test</span>
            <p>
              Choose a key, then identify diatonic chords and degrees by typing or multiple choice.
            </p>
            <span className="ar" aria-hidden="true">↗</span>
          </button>
          <button
            type="button"
            className="rrow"
            onClick={() => onSelectTab('progress')}
          >
            <span className="micro">03</span>
            <span className="t">review</span>
            <p>
              Weak degrees surface as thin bars. Bookmarked chords wait in your collection.
            </p>
            <span className="ar" aria-hidden="true">↗</span>
          </button>
        </div>
      </section>

      {/* Editorial Footer */}
      <footer className="foot">
        <span className="micro">Diatonic Chord Practice · Offline-First PWA</span>
        <span className="micro muted">Grotesk / Manrope · Accent #FF4B30</span>
      </footer>
    </div>
  );
};

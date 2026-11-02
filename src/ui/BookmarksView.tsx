/**
 * Difficult Chord Bookmarks View
 * Rebuilt with prototype editorial layout: .page, .lrow, and .empty states.
 */

import React, { useState } from 'react';
import {
  DifficultChordBookmark,
  deleteBookmark,
  toggleBookmarkMastered,
} from '../storage/indexedDb';
import { DiatonicChord } from '../theory/musicEngine';

interface BookmarksViewProps {
  bookmarks: DifficultChordBookmark[];
  onRefreshBookmarks: () => void;
  onLaunchFocusedTrainer: (chords: DiatonicChord[]) => void;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export const BookmarksView: React.FC<BookmarksViewProps> = ({
  bookmarks,
  onRefreshBookmarks,
  onLaunchFocusedTrainer,
}) => {
  const [filter, setFilter] = useState<'all' | 'needs_practice' | 'mastered'>('needs_practice');

  const filteredBookmarks = bookmarks.filter(b => {
    if (filter === 'needs_practice') return !b.mastered;
    if (filter === 'mastered') return b.mastered;
    return true;
  });

  const handleLaunchSession = () => {
    const activeBookmarks = bookmarks.filter(b => !b.mastered);
    const targetPool = activeBookmarks.length > 0 ? activeBookmarks : bookmarks;

    if (targetPool.length === 0) {
      alert('No bookmarked chords to practice.');
      return;
    }

    const converted: DiatonicChord[] = targetPool.map((b, idx) => ({
      id: `bk_chord_${idx}`,
      keyTonic: b.keyTonic,
      keyPitchClass: 0,
      scaleType: b.scaleType as any,
      degree: b.degree,
      chordType: b.chordName.includes('7') ? 'seventh' : 'triad',
      inversion: 0,
      root: { letter: 'C', accidental: '', pitchClass: 0, formatted: b.chordName },
      bass: { letter: 'C', accidental: '', pitchClass: 0, formatted: b.chordName },
      notes: b.notes.map(n => ({ letter: 'C', accidental: '', pitchClass: 0, formatted: n })),
      quality: b.quality,
      qualityCode: 'maj',
      name: b.chordName,
      rootName: b.chordName,
      romanNumeral: b.romanNumeral,
      arabicDegree: String(b.degree),
    }));

    onLaunchFocusedTrainer(converted);
  };

  return (
    <div className="view page">
      <div className="flex items-baseline justify-between flex-wrap gap-4 border-b border-[var(--ink)] pb-4">
        <div>
          <div className="micro muted">Difficult Chords / {pad2(bookmarks.length)} flagged</div>
          <h1 className="display" style={{ margin: '8px 0 0' }}>
            {bookmarks.length ? 'bookmarks.' : 'no bookmarks.'}
          </h1>
        </div>

        {bookmarks.length > 0 && (
          <div className="flex items-center gap-3">
            {/* Filter buttons */}
            <div className="seg" role="group">
              <button
                type="button"
                aria-pressed={filter === 'needs_practice'}
                onClick={() => setFilter('needs_practice')}
              >
                Needs Practice
              </button>
              <button
                type="button"
                aria-pressed={filter === 'mastered'}
                onClick={() => setFilter('mastered')}
              >
                Mastered
              </button>
              <button
                type="button"
                aria-pressed={filter === 'all'}
                onClick={() => setFilter('all')}
              >
                All
              </button>
            </div>

            <button
              type="button"
              onClick={handleLaunchSession}
              className="btn acc-bg !min-h-[48px] !px-5"
            >
              <span>Practice Bookmarks</span>
              <span>↗</span>
            </button>
          </div>
        )}
      </div>

      {filteredBookmarks.length > 0 ? (
        <div className="mt-6">
          {filteredBookmarks.map((x, i) => (
            <div key={x.id} className="lrow">
              <span className="micro">{pad2(i + 1)}</span>
              <span className="t">{x.chordName}</span>
              <span className="mid micro muted">
                {x.keyTonic} · {x.romanNumeral} (degree {x.degree}) · {x.notes.join(' · ')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await toggleBookmarkMastered(x.id, !x.mastered);
                    onRefreshBookmarks();
                  }}
                  className="tag"
                  style={{
                    borderColor: x.mastered ? 'var(--success)' : 'var(--line)',
                    color: x.mastered ? 'var(--success)' : 'inherit',
                  }}
                >
                  {x.mastered ? '✓ Mastered' : '○ Active'}
                </button>
                <button
                  type="button"
                  className="x"
                  onClick={async () => {
                    await deleteBookmark(x.id);
                    onRefreshBookmarks();
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">
          <div className="display">empty.</div>
          <p>
            {bookmarks.length === 0
              ? 'Flag difficult chords during an instrument session using the Bookmark tool. They will persist on this device.'
              : 'No chords in this filter view.'}
          </p>
          <button
            type="button"
            className="btn acc-bg big"
            onClick={() => (window.location.hash = '#trainer')}
          >
            <span>Open Trainer</span>
            <span>↗</span>
          </button>
        </div>
      )}
    </div>
  );
};

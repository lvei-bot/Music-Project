/**
 * Difficult Chord Bookmarks View
 * Manage persistent "Needs Practice" bookmarks from instrument sessions,
 * filter active vs mastered, and launch focused instrument practice.
 */

import React, { useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  Play,
  Trash2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
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
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-200">
      <div className="border-b border-[#29251F]/15 dark:border-[#EDE8E1]/15 pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#A68A55] dark:text-[#CBB07E]">
            Instrument Focus
          </span>
          <h1 className="font-editorial text-3xl font-bold text-[#29251F] dark:text-[#EDE8E1] mt-1">
            Difficult Chord Bookmarks
          </h1>
          <p className="text-xs sm:text-sm text-[#29251F]/70 dark:text-[#EDE8E1]/70">
            Chords manually flagged during instrument practice for targeted physical recall.
          </p>
        </div>

        {bookmarks.length > 0 && (
          <button
            onClick={handleLaunchSession}
            type="button"
            className="px-4 py-2 text-xs font-bold rounded-lg bg-[#29251F] dark:bg-[#EDE8E1] text-[#F8F6F1] dark:text-[#181614] hover:bg-black dark:hover:bg-white flex items-center gap-2 shadow-xs"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Practice Bookmarked Chords</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-[#29251F]/10 dark:border-[#EDE8E1]/10 pb-3">
        {[
          { id: 'needs_practice', label: `Needs Practice (${bookmarks.filter(b => !b.mastered).length})` },
          { id: 'mastered', label: `Mastered (${bookmarks.filter(b => b.mastered).length})` },
          { id: 'all', label: `All (${bookmarks.length})` },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id as any)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filter === tab.id
                ? 'bg-[#A68A55] text-white'
                : 'text-[#29251F]/70 dark:text-[#EDE8E1]/70 hover:bg-[#EAE5DC]/50 dark:hover:bg-[#221F1C]/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bookmarks List */}
      <div className="space-y-3">
        {filteredBookmarks.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-[#EAE5DC]/20 dark:bg-[#221F1C]/20 border border-[#29251F]/10 text-xs text-[#29251F]/50">
            No bookmarks found in this view. Flag tricky chords during active Instrument Trainer sessions using the bookmark icon.
          </div>
        ) : (
          filteredBookmarks.map(b => (
            <div
              key={b.id}
              className="p-4 rounded-xl bg-[#EAE5DC]/30 dark:bg-[#221F1C]/30 border border-[#29251F]/15 dark:border-[#EDE8E1]/15 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#29251F] dark:bg-[#EDE8E1] text-[#F8F6F1] dark:text-[#181614] flex items-center justify-center font-bold text-sm">
                  {b.romanNumeral}
                </div>
                <div>
                  <div className="font-editorial text-lg font-bold text-[#29251F] dark:text-[#EDE8E1]">
                    {b.chordName}
                  </div>
                  <div className="text-[11px] text-[#29251F]/60 dark:text-[#EDE8E1]/60">
                    Degree {b.degree} in {b.keyTonic} ({b.quality}) • Notes: {b.notes.join(' - ')}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    await toggleBookmarkMastered(b.id, !b.mastered);
                    onRefreshBookmarks();
                  }}
                  type="button"
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 ${
                    b.mastered
                      ? 'border-[#2D7A4D]/30 text-[#2D7A4D] bg-[#2D7A4D]/10'
                      : 'border-[#29251F]/20 text-[#29251F]/70 dark:text-[#EDE8E1]/70 hover:bg-[#EAE5DC]'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{b.mastered ? 'Mastered' : 'Mark Mastered'}</span>
                </button>

                <button
                  onClick={async () => {
                    await deleteBookmark(b.id);
                    onRefreshBookmarks();
                  }}
                  type="button"
                  className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg"
                  title="Remove bookmark"
                  aria-label="Remove bookmark"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

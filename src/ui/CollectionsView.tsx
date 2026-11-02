/**
 * Custom Chord Collections View
 * Rebuilt with prototype editorial layout: .page, .lrow, and .empty states.
 */

import React, { useState } from 'react';
import {
  CustomChordCollection,
  saveCollection,
  deleteCollection,
} from '../storage/indexedDb';
import { DiatonicChord, buildDiatonicChord } from '../theory/musicEngine';

interface CollectionsViewProps {
  collections: CustomChordCollection[];
  onRefreshCollections: () => void;
  onLaunchCollectionTrainer: (chords: DiatonicChord[]) => void;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export const CollectionsView: React.FC<CollectionsViewProps> = ({
  collections,
  onRefreshCollections,
  onLaunchCollectionTrainer,
}) => {
  const [selectedColId, setSelectedColId] = useState<string | null>(
    collections.length > 0 ? collections[0].id : null
  );

  const [newChordInput, setNewChordInput] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<'fixed' | 'transposable'>('fixed');
  const [newColRefKey, setNewColRefKey] = useState('C');

  const [importTextModal, setImportTextModal] = useState(false);
  const [importPlainText, setImportPlainText] = useState('');

  const currentCollection = collections.find(c => c.id === selectedColId) || null;

  const handleAddChord = async () => {
    if (!currentCollection || !newChordInput.trim()) return;
    const trimmed = newChordInput.trim();

    if (currentCollection.chords.includes(trimmed)) {
      alert('This chord is already in the collection.');
      return;
    }

    const updated: CustomChordCollection = {
      ...currentCollection,
      chords: [...currentCollection.chords, trimmed],
      updatedAt: Date.now(),
    };

    await saveCollection(updated);
    onRefreshCollections();
    setNewChordInput('');
  };

  const handleRemoveChord = async (index: number) => {
    if (!currentCollection) return;
    const updatedChords = [...currentCollection.chords];
    updatedChords.splice(index, 1);
    const updated: CustomChordCollection = {
      ...currentCollection,
      chords: updatedChords,
      updatedAt: Date.now(),
    };
    await saveCollection(updated);
    onRefreshCollections();
  };

  const handleMoveChord = async (index: number, direction: 'up' | 'down') => {
    if (!currentCollection) return;
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= currentCollection.chords.length) return;

    const chords = [...currentCollection.chords];
    const temp = chords[index];
    chords[index] = chords[newIdx];
    chords[newIdx] = temp;

    const updated: CustomChordCollection = {
      ...currentCollection,
      chords,
      updatedAt: Date.now(),
    };
    await saveCollection(updated);
    onRefreshCollections();
  };

  const handleLaunch = () => {
    if (!currentCollection || currentCollection.chords.length === 0) {
      alert('Add at least one chord to the collection before practicing.');
      return;
    }

    const converted: DiatonicChord[] = currentCollection.chords.map((chordStr, idx) => {
      const isSev = chordStr.includes('7');
      const isMin = chordStr.includes('m') && !chordStr.includes('maj');
      const isDim = chordStr.includes('dim') || chordStr.includes('°');
      const isAug = chordStr.includes('aug') || chordStr.includes('+');

      const quality = isSev
        ? chordStr.includes('maj7')
          ? 'major seventh'
          : isMin
          ? 'minor seventh'
          : isDim
          ? 'half-diminished seventh'
          : 'dominant seventh'
        : isMin
        ? 'minor'
        : isDim
        ? 'diminished'
        : isAug
        ? 'augmented'
        : 'major';

      return {
        id: `col_chord_${idx}`,
        keyTonic: currentCollection.referenceKey || 'C',
        keyPitchClass: 0,
        scaleType: 'major',
        degree: 1,
        chordType: isSev ? 'seventh' : 'triad',
        inversion: 0,
        root: { letter: 'C', accidental: '', pitchClass: 0, formatted: chordStr },
        bass: { letter: 'C', accidental: '', pitchClass: 0, formatted: chordStr },
        notes: [{ letter: 'C', accidental: '', pitchClass: 0, formatted: chordStr }],
        quality,
        qualityCode: isMin ? 'min' : isDim ? 'dim' : isAug ? 'aug' : 'maj',
        name: chordStr,
        rootName: chordStr,
        romanNumeral: 'I',
        arabicDegree: '1',
      };
    });

    onLaunchCollectionTrainer(converted);
  };

  return (
    <div className="view page">
      {/* Header */}
      <div className="flex items-baseline justify-between flex-wrap gap-4 border-b border-[var(--ink)] pb-4">
        <div>
          <div className="micro muted">Library / {pad2(collections.length)} sets</div>
          <h1 className="display" style={{ margin: '8px 0 0' }}>
            {collections.length ? 'collections.' : 'nothing here.'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportTextModal(true)}
            type="button"
            className="btn ghost !min-h-[44px] !px-4 !text-xs"
          >
            <span>Import</span>
            <span>↓</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            type="button"
            className="btn acc-bg !min-h-[44px] !px-4 !text-xs"
          >
            <span>New Collection</span>
            <span>+</span>
          </button>
        </div>
      </div>

      {collections.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mt-8">
          {/* Collection Selectors List */}
          <div className="md:col-span-4 border-r border-[var(--line)] pr-4 space-y-2">
            <span className="micro muted block mb-2">Saved Collections</span>
            {collections.map((c, i) => {
              const isSelected = c.id === selectedColId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedColId(c.id)}
                  className={`w-full text-left p-3 border transition-colors flex items-center justify-between ${
                    isSelected
                      ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
                      : 'border-[var(--line)] hover:bg-[var(--surface)]'
                  }`}
                >
                  <div>
                    <div className="font-bold text-sm">{c.name}</div>
                    <div className="micro opacity-70 mt-0.5">
                      {c.chords.length} chords · {c.type}
                    </div>
                  </div>
                  <span className="micro">{pad2(i + 1)}</span>
                </button>
              );
            })}
          </div>

          {/* Collection Content */}
          <div className="md:col-span-8">
            {currentCollection ? (
              <div>
                <div className="flex items-baseline justify-between flex-wrap gap-4 border-b border-[var(--line)] pb-4">
                  <div>
                    <h2 className="display" style={{ fontSize: '2.4rem' }}>
                      {currentCollection.name}
                    </h2>
                    <span className="micro muted">
                      {currentCollection.type}
                      {currentCollection.type === 'transposable' && ` · Key: ${currentCollection.referenceKey}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleLaunch}
                      type="button"
                      className="btn acc-bg !min-h-[44px] !px-5"
                    >
                      <span>Practise Set</span>
                      <span>↗</span>
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Delete collection "${currentCollection.name}"?`)) {
                          await deleteCollection(currentCollection.id);
                          onRefreshCollections();
                          setSelectedColId(null);
                        }
                      }}
                      type="button"
                      className="btn ghost !min-h-[44px] !px-3"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Add chord input */}
                <div className="flex gap-0 mt-6">
                  <input
                    type="text"
                    placeholder="Add chord (e.g. Cmaj7, Am7, G7/B)"
                    value={newChordInput}
                    onChange={e => setNewChordInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChord();
                      }
                    }}
                    className="border border-[var(--ink)] bg-[var(--paper)] px-4 py-3 text-sm font-bold flex-1"
                  />
                  <button
                    onClick={handleAddChord}
                    type="button"
                    className="btn !min-h-[48px] !px-6"
                  >
                    Add
                  </button>
                </div>

                {/* Chords list */}
                <div className="mt-6">
                  {currentCollection.chords.length === 0 ? (
                    <p className="micro muted py-8 text-center">No chords added yet.</p>
                  ) : (
                    currentCollection.chords.map((chord, idx) => (
                      <div key={idx} className="lrow">
                        <span className="micro">{pad2(idx + 1)}</span>
                        <span className="t">{chord}</span>
                        <span className="mid"></span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveChord(idx, 'up')}
                            disabled={idx === 0}
                            className="x"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveChord(idx, 'down')}
                            disabled={idx === currentCollection.chords.length - 1}
                            className="x"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveChord(idx)}
                            className="x"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <p className="micro muted">Select a collection on the left.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="empty">
          <div className="display">empty.</div>
          <p>
            Save custom chord progressions or song reference sets to practice them in the Instrument Trainer.
          </p>
          <button
            type="button"
            className="btn acc-bg big"
            onClick={() => setShowCreateModal(true)}
          >
            <span>Create Collection</span>
            <span>+</span>
          </button>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Create Collection">
          <div className="row-top">
            <span className="mark">New Collection</span>
            <button
              type="button"
              className="micro"
              onClick={() => setShowCreateModal(false)}
            >
              Close ✕
            </button>
          </div>
          <div className="max-w-xl mx-auto w-full py-8 space-y-6">
            <div className="setting">
              <div className="lab micro">Name</div>
              <input
                type="text"
                placeholder="e.g. Autumn Leaves, Jazz Standards"
                value={newColName}
                onChange={e => setNewColName(e.target.value)}
                className="border border-[var(--ink)] bg-[var(--paper)] p-3 font-bold"
              />
            </div>
            <div className="setting">
              <div className="lab micro">Type</div>
              <div className="seg" role="group">
                <button
                  type="button"
                  aria-pressed={newColType === 'fixed'}
                  onClick={() => setNewColType('fixed')}
                >
                  Fixed Song
                </button>
                <button
                  type="button"
                  aria-pressed={newColType === 'transposable'}
                  onClick={() => setNewColType('transposable')}
                >
                  Transposable
                </button>
              </div>
            </div>
            <button
              type="button"
              className="btn acc-bg big w-full mt-6"
              onClick={async () => {
                if (!newColName.trim()) return;
                const newCol: CustomChordCollection = {
                  id: `col_${Date.now()}`,
                  name: newColName.trim(),
                  type: newColType,
                  referenceKey: newColRefKey,
                  chords: [],
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };
                await saveCollection(newCol);
                onRefreshCollections();
                setSelectedColId(newCol.id);
                setNewColName('');
                setShowCreateModal(false);
              }}
            >
              <span>Create Collection</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importTextModal && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Import Text">
          <div className="row-top">
            <span className="mark">Import Chords</span>
            <button
              type="button"
              className="micro"
              onClick={() => setImportTextModal(false)}
            >
              Close ✕
            </button>
          </div>
          <div className="max-w-xl mx-auto w-full py-8 space-y-6">
            <p className="micro muted">
              Paste chord symbols separated by commas, spaces, or lines (e.g. Cmaj7, Am7, Dm7, G7).
            </p>
            <textarea
              rows={6}
              value={importPlainText}
              onChange={e => setImportPlainText(e.target.value)}
              placeholder="Cmaj7, Am7, Dm7, G7"
              className="w-full border border-[var(--ink)] bg-[var(--paper)] p-3 font-bold"
            />
            <button
              type="button"
              className="btn acc-bg big w-full"
              onClick={async () => {
                if (!importPlainText.trim()) return;
                const parsed = importPlainText
                  .split(/[\n, -]+/)
                  .map(s => s.trim())
                  .filter(Boolean);
                if (parsed.length === 0) return;

                const newCol: CustomChordCollection = {
                  id: `col_imp_${Date.now()}`,
                  name: `Imported Set (${parsed.length})`,
                  type: 'fixed',
                  referenceKey: 'C',
                  chords: parsed,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };
                await saveCollection(newCol);
                onRefreshCollections();
                setSelectedColId(newCol.id);
                setImportPlainText('');
                setImportTextModal(false);
              }}
            >
              <span>Import as New Collection</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

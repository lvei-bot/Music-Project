/**
 * Custom Chord Collections View
 * Create, rename, delete collections, add/remove chords,
 * reorder with accessible Up/Down buttons, fixed vs transposable,
 * import/export plain text or JSON, and launch directly into Instrument Trainer.
 */

import React, { useState } from 'react';
import {
  FolderHeart,
  Plus,
  Play,
  Download,
  Upload,
  ArrowUp,
  ArrowDown,
  Trash2,
  X,
  Edit2,
  Check,
} from 'lucide-react';
import {
  CustomChordCollection,
  saveCollection,
  deleteCollection,
} from '../storage/indexedDb';
import { parseUserChordInput } from '../engine/quizEngine';
import { DiatonicChord, buildDiatonicChord } from '../theory/musicEngine';

interface CollectionsViewProps {
  collections: CustomChordCollection[];
  onRefreshCollections: () => void;
  onLaunchCollectionTrainer: (chords: DiatonicChord[]) => void;
}

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

  // Add chord to current collection
  const handleAddChord = async () => {
    if (!currentCollection || !newChordInput.trim()) return;
    const trimmed = newChordInput.trim();

    // Prevent duplicates
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

  // Remove chord
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

  // Reorder chord accessible up/down
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

  // Launch trainer with these chords
  const handleLaunch = () => {
    if (!currentCollection || currentCollection.chords.length === 0) {
      alert('Collection has no chords.');
      return;
    }

    // Convert string chord representations into DiatonicChord structure
    const converted: DiatonicChord[] = currentCollection.chords.map((chordStr, idx) => {
      return {
        id: `custom_${chordStr}_${idx}`,
        keyTonic: currentCollection.referenceKey || 'C',
        keyPitchClass: 0,
        scaleType: 'major',
        degree: idx + 1,
        chordType: chordStr.includes('7') ? 'seventh' : 'triad',
        inversion: 0,
        root: { letter: 'C', accidental: '', pitchClass: 0, formatted: chordStr.replace(/[^A-Ga-g#b]/g, '') || 'C' },
        bass: { letter: 'C', accidental: '', pitchClass: 0, formatted: chordStr.replace(/[^A-Ga-g#b]/g, '') || 'C' },
        notes: [],
        quality: 'Custom',
        qualityCode: 'maj',
        name: chordStr,
        rootName: chordStr,
        romanNumeral: `Chord ${idx + 1}`,
        arabicDegree: String(idx + 1),
      };
    });

    onLaunchCollectionTrainer(converted);
  };

  // Export as Plain Text
  const handleExportPlainText = () => {
    if (!currentCollection) return;
    const text = currentCollection.chords.join(', ');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentCollection.name.toLowerCase().replace(/\s+/g, '_')}_chords.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import Plain Text
  const handleImportPlainText = async () => {
    if (!importPlainText.trim() || !newColName.trim()) {
      alert('Please provide a collection name and chord list.');
      return;
    }

    const chords = importPlainText
      .split(/[,;\n]+/)
      .map(c => c.trim())
      .filter(c => c.length > 0);

    if (chords.length === 0) {
      alert('No valid chords found in text.');
      return;
    }

    const newCol: CustomChordCollection = {
      id: `col_${Date.now()}`,
      name: newColName.trim(),
      type: newColType,
      referenceKey: newColRefKey,
      chords,
      playback: 'shuffled_cycle',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await saveCollection(newCol);
    onRefreshCollections();
    setSelectedColId(newCol.id);
    setImportTextModal(false);
    setImportPlainText('');
    setNewColName('');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-200">
      <div className="border-b border-[#29251F]/15 dark:border-[#EDE8E1]/15 pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#A68A55] dark:text-[#CBB07E]">
            User Libraries
          </span>
          <h1 className="font-editorial text-3xl font-bold text-[#29251F] dark:text-[#EDE8E1] mt-1">
            Custom Chord Collections
          </h1>
          <p className="text-xs sm:text-sm text-[#29251F]/70 dark:text-[#EDE8E1]/70">
            Create fixed song progressions or transposable reference chord sets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportTextModal(true)}
            type="button"
            className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[#29251F]/20 dark:border-[#EDE8E1]/20 hover:bg-[#EAE5DC] dark:hover:bg-[#221F1C] flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Text</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            type="button"
            className="px-4 py-2 text-xs font-bold rounded-lg bg-[#A68A55] text-white hover:bg-[#8e7443] flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>New Collection</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Collections List */}
        <div className="space-y-2">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#29251F]/60 dark:text-[#EDE8E1]/60 block mb-1">
            Collections ({collections.length})
          </span>
          {collections.map(c => {
            const isSelected = c.id === selectedColId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedColId(c.id)}
                className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                  isSelected
                    ? 'bg-[#EAE5DC] dark:bg-[#221F1C] border-[#A68A55] font-bold text-[#29251F] dark:text-[#EDE8E1]'
                    : 'bg-[#F8F6F1] dark:bg-[#181614] border-[#29251F]/10 dark:border-[#EDE8E1]/10 text-[#29251F]/80 dark:text-[#EDE8E1]/80 hover:bg-[#EAE5DC]/50'
                }`}
              >
                <div>
                  <div className="text-xs">{c.name}</div>
                  <div className="text-[10px] text-[#29251F]/50 dark:text-[#EDE8E1]/50 mt-0.5">
                    {c.chords.length} chord{c.chords.length === 1 ? '' : 's'} • {c.type}
                  </div>
                </div>
                <FolderHeart className="w-4 h-4 text-[#A68A55]" />
              </button>
            );
          })}
        </div>

        {/* Collection Details & Editor */}
        <div className="md:col-span-2 p-6 rounded-2xl bg-[#EAE5DC]/30 dark:bg-[#221F1C]/30 border border-[#29251F]/15 dark:border-[#EDE8E1]/15 space-y-6">
          {currentCollection ? (
            <>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#29251F]/10 dark:border-[#EDE8E1]/10 pb-4">
                <div>
                  <h3 className="font-editorial text-xl font-bold text-[#29251F] dark:text-[#EDE8E1]">
                    {currentCollection.name}
                  </h3>
                  <span className="text-xs text-[#29251F]/60 dark:text-[#EDE8E1]/60">
                    Type: <strong className="capitalize">{currentCollection.type}</strong>
                    {currentCollection.type === 'transposable' && ` (Ref Key: ${currentCollection.referenceKey})`}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportPlainText}
                    type="button"
                    className="p-1.5 rounded-lg border border-[#29251F]/20 text-[#29251F]/70 dark:text-[#EDE8E1]/70 hover:bg-[#EAE5DC]"
                    title="Export as plain text"
                  >
                    <Download className="w-3.5 h-3.5" />
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
                    className="p-1.5 rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/10"
                    title="Delete collection"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleLaunch}
                    type="button"
                    className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#29251F] dark:bg-[#EDE8E1] text-[#F8F6F1] dark:text-[#181614] flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Practice Chords</span>
                  </button>
                </div>
              </div>

              {/* Add Chord Row */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Cmaj7, Am7, F#m, G7/B"
                  value={newChordInput}
                  onChange={e => setNewChordInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddChord();
                    }
                  }}
                  className="flex-1 text-xs font-semibold p-2.5 rounded-lg bg-[#F8F6F1] dark:bg-[#181614] border border-[#29251F]/20 dark:border-[#EDE8E1]/20 outline-hidden focus:border-[#A68A55]"
                />
                <button
                  onClick={handleAddChord}
                  type="button"
                  className="px-4 text-xs font-bold rounded-lg bg-[#A68A55] text-white hover:bg-[#8e7443]"
                >
                  Add Chord
                </button>
              </div>

              {/* Chord Items List with accessible reorder */}
              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {currentCollection.chords.length === 0 ? (
                  <p className="text-xs text-[#29251F]/50 text-center py-6">No chords in this collection yet.</p>
                ) : (
                  currentCollection.chords.map((chord, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-[#F8F6F1] dark:bg-[#181614] border border-[#29251F]/10 dark:border-[#EDE8E1]/10 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[#29251F]/40 dark:text-[#EDE8E1]/40 text-[11px] w-5">
                          {idx + 1}.
                        </span>
                        <span className="font-bold text-[#29251F] dark:text-[#EDE8E1] text-sm">
                          {chord}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMoveChord(idx, 'up')}
                          disabled={idx === 0}
                          type="button"
                          className="p-1 rounded hover:bg-[#EAE5DC] dark:hover:bg-[#221F1C] disabled:opacity-20"
                          title="Move Up"
                          aria-label="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveChord(idx, 'down')}
                          disabled={idx === currentCollection.chords.length - 1}
                          type="button"
                          className="p-1 rounded hover:bg-[#EAE5DC] dark:hover:bg-[#221F1C] disabled:opacity-20"
                          title="Move Down"
                          aria-label="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveChord(idx)}
                          type="button"
                          className="p-1 rounded text-red-500 hover:bg-red-500/10 ml-1"
                          title="Remove chord"
                          aria-label="Remove chord"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-xs text-[#29251F]/50">
              Select or create a chord collection to view chords.
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-[#F8F6F1] dark:bg-[#181614] border border-[#29251F]/20 dark:border-[#EDE8E1]/20 p-5 shadow-2xl space-y-4">
            <h3 className="font-editorial font-bold text-base text-[#29251F] dark:text-[#EDE8E1]">
              Create New Collection
            </h3>
            <div>
              <label className="text-xs font-semibold block mb-1">Collection Name</label>
              <input
                type="text"
                placeholder="e.g. Autumn Leaves A-Section"
                value={newColName}
                onChange={e => setNewColName(e.target.value)}
                className="w-full text-xs font-semibold p-2 rounded-lg bg-[#EAE5DC]/50 dark:bg-[#221F1C]/50 border border-[#29251F]/20"
              />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">Collection Type</label>
              <select
                value={newColType}
                onChange={e => setNewColType(e.target.value as any)}
                className="w-full text-xs font-semibold p-2 rounded-lg bg-[#EAE5DC]/50 dark:bg-[#221F1C]/50 border border-[#29251F]/20"
              >
                <option value="fixed">Fixed (Preserve exact chords)</option>
                <option value="transposable">Transposable (Relative to Key)</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded-md border border-[#29251F]/20"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!newColName.trim()) return;
                  const newCol: CustomChordCollection = {
                    id: `col_${Date.now()}`,
                    name: newColName.trim(),
                    type: newColType,
                    referenceKey: 'C',
                    chords: [],
                    playback: 'shuffled_cycle',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  };
                  await saveCollection(newCol);
                  onRefreshCollections();
                  setSelectedColId(newCol.id);
                  setShowCreateModal(false);
                  setNewColName('');
                }}
                className="px-4 py-1.5 text-xs font-bold rounded-md bg-[#A68A55] text-white"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Text Modal */}
      {importTextModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-[#F8F6F1] dark:bg-[#181614] border border-[#29251F]/20 dark:border-[#EDE8E1]/20 p-5 shadow-2xl space-y-4">
            <h3 className="font-editorial font-bold text-base text-[#29251F] dark:text-[#EDE8E1]">
              Import Chords from Plain Text
            </h3>
            <div>
              <label className="text-xs font-semibold block mb-1">Collection Name</label>
              <input
                type="text"
                placeholder="e.g. Imported Standard"
                value={newColName}
                onChange={e => setNewColName(e.target.value)}
                className="w-full text-xs font-semibold p-2 rounded-lg bg-[#EAE5DC]/50 dark:bg-[#221F1C]/50 border border-[#29251F]/20"
              />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">
                Paste Chords (Comma, semicolon, or newline separated)
              </label>
              <textarea
                rows={4}
                placeholder="e.g. Cmaj7, Am7, Dm7, G7, Em7, A7, Dm7, G7"
                value={importPlainText}
                onChange={e => setImportPlainText(e.target.value)}
                className="w-full text-xs font-semibold p-2 rounded-lg bg-[#EAE5DC]/50 dark:bg-[#221F1C]/50 border border-[#29251F]/20"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setImportTextModal(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded-md border border-[#29251F]/20"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportPlainText}
                className="px-4 py-1.5 text-xs font-bold rounded-md bg-[#A68A55] text-white"
              >
                Import Collection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

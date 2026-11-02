/**
 * Full Manual Versioned Backup & Restore Component
 * Rebuilt to match the editorial aesthetic: stark borders, Grotesk typography,
 * clear transactional validation, and no soft pills.
 */

import React, { useState } from 'react';
import {
  createFullBackup,
  validateBackupData,
  restoreFullBackup,
  BackupValidationResult,
  AppBackupData,
} from '../storage/indexedDb';

interface BackupModalProps {
  onClose: () => void;
  onRestoreSuccess: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  onClose,
  onRestoreSuccess,
}) => {
  const [selectedFileContent, setSelectedFileContent] = useState<AppBackupData | null>(null);
  const [validation, setValidation] = useState<BackupValidationResult | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDownloadBackup = async () => {
    try {
      const data = await createFullBackup();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chord_trainer_backup_v1_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Backup failed: ${err?.message || err}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setValidation(null);
    setSelectedFileContent(null);
    setRestoreSuccess(false);

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const val = validateBackupData(parsed);
        setValidation(val);
        if (val.isValid) {
          setSelectedFileContent(parsed);
        } else {
          setErrorMessage(val.error || 'Invalid backup format');
        }
      } catch (err: any) {
        setErrorMessage('File could not be parsed as valid JSON.');
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!selectedFileContent || !validation?.isValid) return;

    const confirmMsg =
      'WARNING: Restoring this backup will replace your current sessions, attempts, bookmarks, and collections with the snapshot contents. Do you wish to proceed?';
    if (!window.confirm(confirmMsg)) return;

    setIsRestoring(true);
    setErrorMessage(null);

    try {
      await restoreFullBackup(selectedFileContent);
      setIsRestoring(false);
      setRestoreSuccess(true);
      setTimeout(() => {
        onRestoreSuccess();
        onClose();
      }, 900);
    } catch (err: any) {
      setIsRestoring(false);
      setErrorMessage(`Restore failed: ${err?.message || err}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div
        className="w-full max-w-xl border-2 border-[var(--ink)] bg-[var(--canvas)] p-6 sm:p-8 space-y-6 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-title"
      >
        <div className="flex items-start justify-between border-b border-[var(--ink)] pb-4">
          <div>
            <span className="micro muted">Data Integrity · Version 1</span>
            <h2 id="backup-title" className="display" style={{ fontSize: '2.4rem', margin: '4px 0 0' }}>
              backup &amp; restore.
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="micro font-bold p-1 hover:underline"
            aria-label="Close dialog"
          >
            Close ✕
          </button>
        </div>

        {/* Section 1: Export */}
        <div className="space-y-3">
          <div className="micro font-bold">01 Export Snapshot</div>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            Download your complete database: practice sessions, quiz attempts, custom collections, bookmarks, and settings presets as a single JSON file.
          </p>
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="btn w-full"
          >
            <span>Download Backup JSON</span>
            <span>↓</span>
          </button>
        </div>

        {/* Section 2: Import */}
        <div className="border-t border-[var(--line)] pt-6 space-y-3">
          <div className="micro font-bold">02 Restore from Snapshot</div>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            Select a verified backup file. Contents will be validated before replacement.
          </p>

          <label className="block border border-[var(--ink)] p-4 cursor-pointer hover:bg-[var(--surface)] text-center transition-colors">
            <span className="micro font-bold block">
              {selectedFileContent ? '✓ Backup File Loaded' : 'Click to Select Backup JSON File'}
            </span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="sr"
            />
          </label>

          {errorMessage && (
            <div className="p-3 border border-[var(--error)] text-[var(--error)] micro font-bold" role="alert">
              ✕ {errorMessage}
            </div>
          )}

          {validation?.isValid && validation.counts && (
            <div className="p-4 border border-[var(--ink)] bg-[var(--surface)] space-y-2">
              <span className="micro font-bold text-[var(--success)] block">
                ✓ Valid Backup Snapshot (Version {selectedFileContent?.version})
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Sessions: <b>{validation.counts.sessions}</b></div>
                <div>Quiz Attempts: <b>{validation.counts.quizAttempts}</b></div>
                <div>Collections: <b>{validation.counts.collections}</b></div>
                <div>Bookmarks: <b>{validation.counts.bookmarks}</b></div>
                <div>Presets: <b>{validation.counts.presets}</b></div>
              </div>
            </div>
          )}

          {validation?.isValid && (
            <button
              type="button"
              onClick={handleExecuteRestore}
              disabled={isRestoring}
              className="btn acc-bg big w-full mt-2"
            >
              <span>{isRestoring ? 'Restoring Snapshot…' : 'Restore & Overwrite Database'}</span>
              <span>→</span>
            </button>
          )}

          {restoreSuccess && (
            <div className="p-3 border border-[var(--success)] text-[var(--success)] micro font-bold text-center">
              ✓ Database restored successfully. Reopening…
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

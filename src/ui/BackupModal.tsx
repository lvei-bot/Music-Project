/**
 * Full Manual Versioned Backup & Restore Component
 * Download full user database JSON, parse, validate, preview contents,
 * warn about complete replacement, and execute transactional restore.
 */

import React, { useState } from 'react';
import {
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  X,
  FileCheck,
  ShieldAlert,
} from 'lucide-react';
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
      }, 1200);
    } catch (err: any) {
      setIsRestoring(false);
      setErrorMessage(`Restore failed: ${err?.message || err}. Existing data was preserved.`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-[#F8F6F1] dark:bg-[#181614] border border-[#29251F]/20 dark:border-[#EDE8E1]/20 p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#29251F]/10 dark:border-[#EDE8E1]/10 pb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A68A55] dark:text-[#CBB07E]">
              Data Safety & Local Storage
            </span>
            <h2 className="font-editorial text-2xl font-bold text-[#29251F] dark:text-[#EDE8E1]">
              Backup & Restore
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-lg text-[#29251F]/60 dark:text-[#EDE8E1]/60 hover:text-[#29251F]"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[#29251F]/70 dark:text-[#EDE8E1]/70 leading-relaxed">
          All your practice sessions, learning mastery streaks, custom collections, and bookmarks are stored safely
          in your browser’s IndexedDB. Because this app operates completely offline without cloud databases or accounts,
          download periodic backups to protect against browser cache clearing.
        </p>

        {/* Action Blocks */}
        <div className="space-y-4">
          {/* Export Button */}
          <div className="p-4 rounded-xl bg-[#EAE5DC]/30 dark:bg-[#221F1C]/30 border border-[#29251F]/10 dark:border-[#EDE8E1]/10 flex items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-xs text-[#29251F] dark:text-[#EDE8E1]">Download Complete Backup</h4>
              <p className="text-[11px] text-[#29251F]/60 dark:text-[#EDE8E1]/60">
                Exports all sessions, learning state, collections, and presets to a single JSON file.
              </p>
            </div>
            <button
              onClick={handleDownloadBackup}
              type="button"
              className="px-4 py-2 text-xs font-bold rounded-lg bg-[#29251F] dark:bg-[#EDE8E1] text-[#F8F6F1] dark:text-[#181614] hover:bg-black dark:hover:bg-white flex items-center gap-1.5 shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>

          {/* Import / Restore Section */}
          <div className="p-4 rounded-xl bg-[#EAE5DC]/30 dark:bg-[#221F1C]/30 border border-[#29251F]/10 dark:border-[#EDE8E1]/10 space-y-3">
            <div>
              <h4 className="font-bold text-xs text-[#29251F] dark:text-[#EDE8E1]">Restore from Backup File</h4>
              <p className="text-[11px] text-[#29251F]/60 dark:text-[#EDE8E1]/60">
                Select a previously exported JSON backup to validate and restore.
              </p>
            </div>

            <input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#A68A55] file:text-white hover:file:bg-[#8e7443] cursor-pointer"
            />

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Preview of validated backup */}
            {validation?.isValid && validation.summary && (
              <div className="p-3.5 rounded-lg bg-[#2D7A4D]/10 dark:bg-[#48A66C]/10 border border-[#2D7A4D]/25 dark:border-[#48A66C]/25 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-[#2D7A4D] dark:text-[#48A66C]">
                  <FileCheck className="w-4 h-4" />
                  <span>Backup Validated Successfully</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-[#29251F]/80 dark:text-[#EDE8E1]/80">
                  <span>Sessions: <strong>{validation.summary.sessionsCount}</strong></span>
                  <span>Quiz Attempts: <strong>{validation.summary.attemptsCount}</strong></span>
                  <span>Collections: <strong>{validation.summary.collectionsCount}</strong></span>
                  <span>Bookmarks: <strong>{validation.summary.bookmarksCount}</strong></span>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleExecuteRestore}
                    disabled={isRestoring}
                    type="button"
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-[#2D7A4D] dark:bg-[#48A66C] text-white hover:opacity-90 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isRestoring ? 'Restoring...' : 'Confirm Full Restore'}
                  </button>
                </div>
              </div>
            )}

            {/* Restore Success Confirmation */}
            {restoreSuccess && (
              <div className="p-3 rounded-lg bg-[#2D7A4D]/15 border border-[#2D7A4D]/30 text-[#2D7A4D] text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Database restored successfully. Updating views...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

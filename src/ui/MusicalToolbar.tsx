/**
 * Responsive Musical Notation Toolbar
 * Inserts musical symbols at caret / selection, preserves focus,
 * supports touch & keyboard, and prevents accidental submission.
 */

import React from 'react';

interface MusicalToolbarProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  mode: 'chord' | 'degree';
  value: string;
  onChange: (newValue: string) => void;
  disabled?: boolean;
}

export const MusicalToolbar: React.FC<MusicalToolbarProps> = ({
  inputRef,
  mode,
  value,
  onChange,
  disabled = false,
}) => {
  const insertSymbol = (symbol: string) => {
    const input = inputRef.current;
    if (!input) {
      onChange(value + symbol);
      return;
    }

    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    const newValue = value.slice(0, start) + symbol + value.slice(end);

    onChange(newValue);

    // Maintain focus and set caret immediately after inserted symbol
    setTimeout(() => {
      input.focus();
      const newPos = start + symbol.length;
      input.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const chordButtons = [
    { label: '♯', text: '♯', desc: 'Sharp symbol' },
    { label: '𝄪', text: '𝄪', desc: 'Double sharp symbol' },
    { label: '♭', text: '♭', desc: 'Flat symbol' },
    { label: '♮', text: '♮', desc: 'Natural symbol' },
    { label: '°', text: '°', desc: 'Diminished degree / symbol' },
    { label: 'ø', text: 'ø', desc: 'Half-diminished symbol' },
    { label: 'Δ', text: 'Δ', desc: 'Major 7th triangle symbol' },
    { label: '7', text: '7', desc: 'Seventh extension' },
    { label: '/', text: '/', desc: 'Slash inversion' },
    { label: 'maj', text: 'maj', desc: 'Major quality' },
    { label: 'm', text: 'm', desc: 'Minor quality' },
    { label: 'dim', text: 'dim', desc: 'Diminished quality' },
    { label: 'aug', text: 'aug', desc: 'Augmented quality' },
  ];

  const degreeButtons = [
    { label: '1', text: '1', desc: 'Scale degree 1' },
    { label: '2', text: '2', desc: 'Scale degree 2' },
    { label: '3', text: '3', desc: 'Scale degree 3' },
    { label: '4', text: '4', desc: 'Scale degree 4' },
    { label: '5', text: '5', desc: 'Scale degree 5' },
    { label: '6', text: '6', desc: 'Scale degree 6' },
    { label: '7', text: '7', desc: 'Scale degree 7' },
    { label: 'I', text: 'I', desc: 'Roman degree I' },
    { label: 'ii', text: 'ii', desc: 'Roman degree ii' },
    { label: 'iii', text: 'iii', desc: 'Roman degree iii' },
    { label: 'IV', text: 'IV', desc: 'Roman degree IV' },
    { label: 'V', text: 'V', desc: 'Roman degree V' },
    { label: 'vi', text: 'vi', desc: 'Roman degree vi' },
    { label: 'vii°', text: 'vii°', desc: 'Roman degree vii°' },
  ];

  const buttons = mode === 'chord' ? chordButtons : degreeButtons;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 p-2 bg-[#EAE5DC]/60 dark:bg-[#221F1C]/80 border border-[#29251F]/10 dark:border-[#EDE8E1]/10 rounded-lg select-none"
      role="toolbar"
      aria-label="Musical Notation Symbols"
    >
      <span className="text-[10px] font-semibold tracking-wider uppercase text-[#29251F]/60 dark:text-[#EDE8E1]/50 px-1">
        Notation:
      </span>
      {buttons.map(btn => (
        <button
          key={btn.text}
          type="button"
          disabled={disabled}
          onMouseDown={e => {
            // Prevent input blur before click handler
            e.preventDefault();
            insertSymbol(btn.text);
          }}
          className="min-w-8 h-8 px-2 flex items-center justify-center text-sm font-semibold rounded bg-[#F8F6F1] dark:bg-[#181614] text-[#29251F] dark:text-[#EDE8E1] border border-[#29251F]/15 dark:border-[#EDE8E1]/15 hover:border-[#A68A55] dark:hover:border-[#CBB07E] hover:bg-[#F8F6F1]/80 active:scale-95 transition-all shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={btn.desc}
          title={btn.desc}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
};

/**
 * Piano Keyboard Diagram Component
 * Renders an accessible SVG piano keyboard with highlighted chord tones
 * and a vivid #FF4B30 red square indicator for the bass note.
 * Ported faithfully from chord-prototype.html.
 */

import React from 'react';
import { DiatonicChord } from '../theory/musicEngine';

interface PianoDiagramProps {
  chord: DiatonicChord;
  className?: string;
}

export const PianoDiagram: React.FC<PianoDiagramProps> = ({ chord, className }) => {
  // Absolute semitone per chord tone, ascending from bass
  let prev = -1;
  const abs = chord.notes.map((n, i) => {
    let s = n.pitchClass;
    if (i === 0) {
      prev = s;
    } else {
      while (s <= prev) s += 12;
      prev = s;
    }
    return s;
  });

  const minVal = Math.min(...abs);
  const maxVal = Math.max(...abs);
  const base = Math.floor(minVal / 12) * 12;
  const span = maxVal - base >= 24 ? 3 : 2;

  // Map absolute semitones to note representation
  const sel = new Map<number, typeof chord.notes[0]>(
    abs.map((s, i) => [s, chord.notes[i]])
  );

  const W = 26;
  const H = 190;
  const BH = 116;
  const BW = 17;
  const WP = [0, 2, 4, 5, 7, 9, 11];
  const BK = [0, 1, 3, 4, 5];
  const n = span * 7;

  const whiteKeys: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const semi = base + Math.floor(i / 7) * 12 + WP[i % 7];
    const on = sel.has(semi);
    const note = sel.get(semi);
    const isBass = semi === abs[0];

    whiteKeys.push(
      <g key={`w-${i}`}>
        <rect
          x={i * W}
          y={0}
          width={W}
          height={H}
          fill={on ? '#111' : '#fff'}
          stroke="#111"
          strokeWidth="1.5"
        />
        {on && note && (
          <>
            <text
              x={i * W + W / 2}
              y={H - 14}
              textAnchor="middle"
              fontFamily="Space Grotesk, Grotesk, sans-serif"
              fontWeight="700"
              fontSize="11"
              fill="#fff"
            >
              {note.spelling}
            </text>
            {isBass && (
              <rect
                x={i * W + W / 2 - 4}
                y={H - 38}
                width={8}
                height={8}
                fill="#FF4B30"
              />
            )}
          </>
        )}
      </g>
    );
  }

  const blackKeys: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    if (!BK.includes(i % 7)) continue;
    const semi = base + Math.floor(i / 7) * 12 + WP[i % 7] + 1;
    const on = sel.has(semi);
    const note = sel.get(semi);

    blackKeys.push(
      <g key={`b-${i}`}>
        <rect
          x={(i + 1) * W - BW / 2}
          y={0}
          width={BW}
          height={BH}
          fill={on ? '#fff' : '#111'}
          stroke="#111"
          strokeWidth="1.5"
        />
        {on && note && (
          <text
            x={(i + 1) * W}
            y={BH - 12}
            textAnchor="middle"
            fontFamily="Space Grotesk, Grotesk, sans-serif"
            fontWeight="700"
            fontSize="9.5"
            fill="#111"
          >
            {note.spelling}
          </text>
        )}
      </g>
    );
  }

  const label = `Keyboard showing ${chord.notes.map(n => n.spelling).join(', ')}, bass ${chord.bassNote.spelling}`;

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${n * W} ${H}`}
        role="img"
        aria-label={label}
        className="w-full h-auto block"
      >
        {whiteKeys}
        {blackKeys}
      </svg>
    </div>
  );
};

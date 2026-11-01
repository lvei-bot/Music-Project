import { describe, it, expect } from 'vitest';
import {
  buildScaleNotes,
  buildDiatonicChord,
  parseNoteString,
  getScaleDiatonicChords,
  transposeNote,
} from '../theory/musicEngine';

describe('Music Theory Engine', () => {
  describe('Scale construction & note spelling', () => {
    it('constructs C Major scale with correct natural notes', () => {
      const notes = buildScaleNotes('C', 'major');
      expect(notes.map(n => n.formatted)).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    });

    it('constructs F# Major scale correctly preserving diatonic letters and E#', () => {
      const notes = buildScaleNotes('F#', 'major');
      expect(notes.map(n => n.formatted)).toEqual(['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#']);
    });

    it('constructs Db Major scale correctly preserving diatonic letters', () => {
      const notes = buildScaleNotes('Db', 'major');
      expect(notes.map(n => n.formatted)).toEqual(['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C']);
    });

    it('constructs A Harmonic Minor scale with raised G# (augmented 2nd between F and G#)', () => {
      const notes = buildScaleNotes('A', 'harmonic_minor');
      expect(notes.map(n => n.formatted)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G#']);
    });

    it('constructs C Harmonic Minor scale with Eb, Ab, and B♮', () => {
      const notes = buildScaleNotes('C', 'harmonic_minor');
      expect(notes.map(n => n.formatted)).toEqual(['C', 'D', 'Eb', 'F', 'G', 'Ab', 'B']);
    });
  });

  describe('Diatonic Triads', () => {
    it('generates standard C Major diatonic triads', () => {
      const chords = getScaleDiatonicChords('C', 'major', 'triads');
      expect(chords.length).toBe(7);
      expect(chords.map(c => c.name)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
      expect(chords.map(c => c.romanNumeral)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
    });

    it('identifies augmented triad on degree 3 of Harmonic Minor', () => {
      const chord = buildDiatonicChord('A', 'harmonic_minor', 3, 'triad');
      expect(chord.quality).toBe('Augmented');
      expect(chord.name).toBe('Caug');
      expect(chord.romanNumeral).toBe('III+');
    });

    it('identifies major V chord in Harmonic Minor', () => {
      const chord = buildDiatonicChord('A', 'harmonic_minor', 5, 'triad');
      expect(chord.quality).toBe('Major');
      expect(chord.name).toBe('E');
      expect(chord.romanNumeral).toBe('V');
    });
  });

  describe('Diatonic 7th Chords', () => {
    it('generates C Major 7th chords correctly', () => {
      const chords = getScaleDiatonicChords('C', 'major', 'sevenths');
      expect(chords.map(c => c.name)).toEqual(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5']);
      expect(chords.map(c => c.romanNumeral)).toEqual(['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7']);
    });

    it('identifies fully diminished 7th chord on degree 7 of Harmonic Minor', () => {
      const chord = buildDiatonicChord('A', 'harmonic_minor', 7, 'seventh');
      expect(chord.quality).toBe('Diminished 7th');
      expect(chord.qualityCode).toBe('dim7');
      expect(chord.name).toBe('G#dim7');
      expect(chord.romanNumeral).toBe('vii°7');
    });

    it('identifies Minor-Major 7th chord on degree 1 of Harmonic Minor', () => {
      const chord = buildDiatonicChord('A', 'harmonic_minor', 1, 'seventh');
      expect(chord.quality).toBe('Minor-Major 7th');
      expect(chord.qualityCode).toBe('minmaj7');
      expect(chord.name).toBe('Am(maj7)');
      expect(chord.romanNumeral).toBe('im(maj7)');
    });
  });

  describe('Inversions & Slash Chords', () => {
    it('constructs 1st inversion triad with third in bass', () => {
      const chord = buildDiatonicChord('C', 'major', 1, 'triad', 1);
      expect(chord.inversion).toBe(1);
      expect(chord.bass.formatted).toBe('E');
      expect(chord.name).toBe('C/E');
      expect(chord.romanNumeral).toBe('I⁶');
    });

    it('constructs 3rd inversion 7th chord with seventh in bass', () => {
      const chord = buildDiatonicChord('C', 'major', 5, 'seventh', 3);
      expect(chord.inversion).toBe(3);
      expect(chord.bass.formatted).toBe('F');
      expect(chord.name).toBe('G7/F');
      expect(chord.romanNumeral).toBe('V7⁴₂');
    });
  });

  describe('Note transposition', () => {
    it('transposes C up 7 semitones to G', () => {
      const note = parseNoteString('C')!;
      const transposed = transposeNote(note, 7);
      expect(transposed.formatted).toBe('G');
    });
  });
});

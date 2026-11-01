import { describe, it, expect } from 'vitest';
import {
  createQuizQuestion,
  gradeQuizAnswer,
  normalizeMusicalText,
  parseUserChordInput,
  generateDistractors,
} from '../engine/quizEngine';
import { buildDiatonicChord } from '../theory/musicEngine';

describe('Quiz Engine & Grading', () => {
  describe('Musical Text Normalization', () => {
    it('normalizes Unicode sharp, flat, and chord symbols', () => {
      expect(normalizeMusicalText('C♯maj7')).toBe('C#maj7');
      expect(normalizeMusicalText('B♭m7')).toBe('Bbm7');
      expect(normalizeMusicalText('CΔ')).toBe('Cmaj7');
      expect(normalizeMusicalText('Bø7')).toBe('Bm7b5');
      expect(normalizeMusicalText('B°7')).toBe('Bdim7');
    });
  });

  describe('User Chord Input Parsing', () => {
    it('parses basic major and minor chords', () => {
      expect(parseUserChordInput('C')?.rootPitchClass).toBe(0);
      expect(parseUserChordInput('C')?.qualityCode).toBe('maj');

      expect(parseUserChordInput('Dm')?.rootPitchClass).toBe(2);
      expect(parseUserChordInput('Dm')?.qualityCode).toBe('min');
    });

    it('parses accidental chords and extensions', () => {
      const parsed = parseUserChordInput('F#m7b5');
      expect(parsed?.rootPitchClass).toBe(6);
      expect(parsed?.qualityCode).toBe('m7b5');
    });

    it('parses slash chords with bass notes', () => {
      const parsed = parseUserChordInput('G7/B');
      expect(parsed?.rootPitchClass).toBe(7);
      expect(parsed?.qualityCode).toBe('7');
      expect(parsed?.bassPitchClass).toBe(11);
    });
  });

  describe('Semantic Grading', () => {
    it('grades exact match as correct for degree_to_chord', () => {
      const q = createQuizQuestion('C', 'major', 2, 'triad', 'degree_to_chord');
      const res = gradeQuizAnswer(q, 'Dm');
      expect(res.isCorrect).toBe(true);
    });

    it('grades legitimate enharmonic input as correct', () => {
      const q = createQuizQuestion('Db', 'major', 1, 'triad', 'degree_to_chord');
      // In 12-TET, C# has same pitch class and quality
      const res = gradeQuizAnswer(q, 'C#');
      expect(res.isCorrect).toBe(true);
    });

    it('rejects wrong chord quality', () => {
      const q = createQuizQuestion('C', 'major', 2, 'triad', 'degree_to_chord');
      const res = gradeQuizAnswer(q, 'D'); // Major instead of Minor
      expect(res.isCorrect).toBe(false);
    });

    it('grades chord_to_degree with Arabic number or Roman numeral', () => {
      const q = createQuizQuestion('C', 'major', 5, 'triad', 'chord_to_degree');
      expect(gradeQuizAnswer(q, '5').isCorrect).toBe(true);
      expect(gradeQuizAnswer(q, '5th').isCorrect).toBe(true);
      expect(gradeQuizAnswer(q, 'V').isCorrect).toBe(true);
      expect(gradeQuizAnswer(q, 'v').isCorrect).toBe(true);
      expect(gradeQuizAnswer(q, '4').isCorrect).toBe(false);
    });
  });

  describe('Distractor Generator', () => {
    it('generates exact number of requested distractors with no duplicates', () => {
      const chord = buildDiatonicChord('C', 'major', 1, 'triad');
      const options = generateDistractors('C', 'major', 1, 'triad', 'degree_to_chord', chord, 4);

      expect(options.length).toBe(4);
      expect(options).toContain(chord.name);
      // Verify no duplicates
      const unique = new Set(options);
      expect(unique.size).toBe(4);
    });

    it('generates distinct options for chord_to_degree', () => {
      const chord = buildDiatonicChord('C', 'major', 3, 'triad');
      const options = generateDistractors('C', 'major', 3, 'triad', 'chord_to_degree', chord, 4);

      expect(options.length).toBe(4);
      expect(options).toContain('3');
      const unique = new Set(options);
      expect(unique.size).toBe(4);
    });
  });
});

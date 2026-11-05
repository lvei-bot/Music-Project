import { describe, it, expect } from 'vitest';
import {
  createQuizQuestion,
  gradeQuizAnswer,
  normalizeMusicalText,
  parseUserChordInput,
  generateDistractors,
  generateQuizQuestions,
  isValidQuizQuestion,
} from '../engine/quizEngine';
import { buildDiatonicChord, getStandardKeyTonic } from '../theory/musicEngine';

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

  describe('Key Selection & Question Exclusivity', () => {
    it('generates questions exclusively from a single fixed key (C)', () => {
      const questions = generateQuizQuestions({
        enabledPitchClasses: [0], // C
        enabledScales: ['major'],
        questionCount: 40,
        direction: 'degree_to_chord',
        answerMode: 'typed',
      });

      expect(questions.length).toBe(40);
      for (const q of questions) {
        expect(q.chord.keyPitchClass).toBe(0);
        expect(q.keyTonic).toBe('C');
        expect(q.prompt.subText).toContain('in C Major');
      }
    });

    it('generates questions exclusively from a single accidental key (F#)', () => {
      const questions = generateQuizQuestions({
        enabledPitchClasses: [6], // F#
        enabledScales: ['major'],
        questionCount: 30,
        direction: 'chord_to_degree',
        answerMode: 'multiple_choice',
      });

      expect(questions.length).toBe(30);
      for (const q of questions) {
        expect(q.chord.keyPitchClass).toBe(6);
        expect(q.keyTonic).toBe('F#');
        expect(q.options).toBeDefined();
        expect(q.options?.length).toBe(4);
        expect(q.options).toContain(String(q.degree));
      }
    });

    it('generates questions exclusively from multiple selected keys and NEVER unselected keys', () => {
      const selectedKeys = [2, 7, 9]; // D, G, A
      const unselectedKeys = [0, 1, 3, 4, 5, 6, 8, 10, 11];

      const questions = generateQuizQuestions({
        enabledPitchClasses: selectedKeys,
        enabledScales: ['major', 'natural_minor'],
        questionCount: 60,
        direction: 'mixed',
        answerMode: 'multiple_choice',
      });

      expect(questions.length).toBe(60);
      for (const q of questions) {
        expect(selectedKeys).toContain(q.chord.keyPitchClass);
        expect(unselectedKeys).not.toContain(q.chord.keyPitchClass);
      }
    });

    it('supports selecting all 12 tonic pitch classes', () => {
      const all12 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      const questions = generateQuizQuestions({
        enabledPitchClasses: all12,
        enabledScales: ['major'],
        questionCount: 50,
      });

      expect(questions.length).toBe(50);
      const generatedPCs = new Set(questions.map(q => q.chord.keyPitchClass));
      // Over 50 questions across 12 keys, multiple distinct keys should appear
      expect(generatedPCs.size).toBeGreaterThanOrEqual(5);
    });

    it('prevents generating questions when no keys are selected (empty list)', () => {
      const questions = generateQuizQuestions({
        enabledPitchClasses: [],
        enabledScales: ['major'],
        questionCount: 10,
      });

      expect(questions).toEqual([]);
    });

    it('prevents generating questions when no scales are selected', () => {
      const questions = generateQuizQuestions({
        enabledPitchClasses: [0],
        enabledScales: [],
        questionCount: 10,
      });

      expect(questions).toEqual([]);
    });

    it('works across both question directions and answer modes', () => {
      const qDegreeToChordTyped = generateQuizQuestions({
        enabledPitchClasses: [4], // E
        enabledScales: ['major'],
        questionCount: 5,
        direction: 'degree_to_chord',
        answerMode: 'typed',
      });
      for (const q of qDegreeToChordTyped) {
        expect(q.direction).toBe('degree_to_chord');
        expect(q.chord.keyPitchClass).toBe(4);
        expect(q.correctAnswerText).toBe(q.chord.name);
      }

      const qChordToDegreeMC = generateQuizQuestions({
        enabledPitchClasses: [4], // E
        enabledScales: ['major'],
        questionCount: 5,
        direction: 'chord_to_degree',
        answerMode: 'multiple_choice',
        mcOptionCount: 4,
      });
      for (const q of qChordToDegreeMC) {
        expect(q.direction).toBe('chord_to_degree');
        expect(q.chord.keyPitchClass).toBe(4);
        expect(q.correctAnswerText).toBe(String(q.degree));
        expect(q.options?.length).toBe(4);
      }
    });
  });

  describe('Key Selection & Scale Selection Synergy', () => {
    it('uses Db tonic for pitch class 1 in Major and C# tonic for pitch class 1 in Minor', () => {
      const qMajor = generateQuizQuestions({
        enabledPitchClasses: [1],
        enabledScales: ['major'],
        questionCount: 10,
      });
      for (const q of qMajor) {
        expect(q.keyTonic).toBe('Db');
        expect(q.prompt.subText).toContain('in Db Major');
      }

      const qMinor = generateQuizQuestions({
        enabledPitchClasses: [1],
        enabledScales: ['harmonic_minor'],
        questionCount: 10,
      });
      for (const q of qMinor) {
        expect(q.keyTonic).toBe('C#');
        expect(q.prompt.subText).toContain('in C# Harmonic Minor');
      }
    });

    it('spells accurate double accidentals in harmonic minor (G# harmonic minor leading tone F##)', () => {
      // In G# harmonic minor (pc = 8), degree 7 is F##dim7 (vii°7)
      const q = createQuizQuestion('G#', 'harmonic_minor', 7, 'seventh', 'degree_to_chord', 'typed');
      expect(q.correctAnswerText).toBe('F##dim7');
      expect(q.chord.romanNumeral).toBe('vii°7');
      expect(q.chord.notes.map(n => n.formatted)).toEqual(['F##', 'A#', 'C#', 'E']);

      // Accepts F##dim7, Fxdim7, F𝄪dim7, and 12-TET enharmonic Gdim7
      expect(gradeQuizAnswer(q, 'F##dim7').isCorrect).toBe(true);
      expect(gradeQuizAnswer(q, 'Fxdim7').isCorrect).toBe(true);
      expect(gradeQuizAnswer(q, 'F𝄪dim7').isCorrect).toBe(true);
      expect(gradeQuizAnswer(q, 'Gdim7').isCorrect).toBe(true);
    });
  });

  describe('Key Settings Restoration & Persistence', () => {
    it('restores custom selected keys correctly when merged with defaults', () => {
      const defaultSettings = {
        direction: 'degree_to_chord',
        answerMode: 'typed',
        enabledPitchClasses: [0], // C default
        enabledScales: ['major'],
        enabledDegrees: [1, 2, 3, 4, 5, 6, 7],
        chordType: 'triads',
      };

      const savedUserKeys = {
        enabledPitchClasses: [1, 4, 11], // Db, E, B
        enabledScales: ['major', 'harmonic_minor'],
      };

      const restoredSettings = {
        ...defaultSettings,
        ...savedUserKeys,
      };

      expect(restoredSettings.enabledPitchClasses).toEqual([1, 4, 11]);
      expect(restoredSettings.enabledScales).toEqual(['major', 'harmonic_minor']);
      expect(restoredSettings.chordType).toBe('triads');

      // Verify questions generated from restored settings only use keys [1, 4, 11]
      const questions = generateQuizQuestions({
        enabledPitchClasses: restoredSettings.enabledPitchClasses,
        enabledScales: restoredSettings.enabledScales as any,
        questionCount: 30,
      });
      for (const q of questions) {
        expect([1, 4, 11]).toContain(q.chord.keyPitchClass);
      }
    });
  });

  describe('Comprehensive Question Type Validation & No-Undefined Guarantee', () => {
    it('generates fully valid questions with zero undefined values across all scales, chords, and directions', () => {
      const scales: ('major' | 'natural_minor' | 'harmonic_minor')[] = ['major', 'natural_minor', 'harmonic_minor'];
      const chordTypes: ('triads' | 'sevenths' | 'both')[] = ['triads', 'sevenths', 'both'];
      const directions: ('degree_to_chord' | 'chord_to_degree' | 'mixed')[] = ['degree_to_chord', 'chord_to_degree', 'mixed'];
      const answerModes: ('typed' | 'multiple_choice')[] = ['typed', 'multiple_choice'];

      for (const scale of scales) {
        for (const chordType of chordTypes) {
          for (const direction of directions) {
            for (const mode of answerModes) {
              const questions = generateQuizQuestions({
                enabledPitchClasses: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
                enabledScales: [scale],
                enabledDegrees: [1, 2, 3, 4, 5, 6, 7],
                chordType,
                direction,
                answerMode: mode,
                questionCount: 5,
              });

              expect(questions.length).toBe(5);

              for (const q of questions) {
                // Must pass strict runtime validator
                expect(isValidQuizQuestion(q)).toBe(true);

                // Check core properties
                expect(q.degree).toBeGreaterThanOrEqual(1);
                expect(q.degree).toBeLessThanOrEqual(7);
                expect(q.targetDegree).toBe(q.degree);
                expect(q.chord).toBeDefined();
                expect(q.chord.name).toBeDefined();
                expect(q.chord.name).not.toBe('undefined');
                expect(q.targetChord).toBe(q.chord);
                expect(q.correctAnswerText).toBeDefined();
                expect(q.correctAnswerText).not.toBe('undefined');
                expect(q.correctAnswer).toBe(q.correctAnswerText);
                expect(q.prompt.primaryText).not.toContain('undefined');
                expect(q.prompt.subText).not.toContain('undefined');

                if (mode === 'multiple_choice') {
                  expect(q.options).toBeDefined();
                  expect(q.options?.length).toBeGreaterThanOrEqual(2);
                  expect(q.multipleChoiceOptions).toEqual(q.options);
                  for (const opt of q.options!) {
                    expect(opt).not.toBe('undefined');
                    expect(opt.length).toBeGreaterThan(0);
                  }
                }
              }
            }
          }
        }
      }
    });

    it('isValidQuizQuestion correctly rejects incomplete or undefined questions', () => {
      expect(isValidQuizQuestion(null)).toBe(false);
      expect(isValidQuizQuestion({})).toBe(false);
      expect(isValidQuizQuestion({ id: '1', degree: undefined, chord: { name: 'C' } })).toBe(false);
      expect(isValidQuizQuestion({ id: '1', degree: 1, keyTonic: 'C', scaleType: 'major', chord: null })).toBe(false);
      expect(isValidQuizQuestion({ id: '1', degree: 1, keyTonic: 'C', scaleType: 'major', chord: { name: '' }, correctAnswerText: 'C' })).toBe(false);
    });
  });
});


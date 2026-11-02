/**
 * Quiz Engine: Question Generation, Distractor Generation,
 * Robust Musical Parsing & Semantic Grading, and Hints.
 */

import {
  DiatonicChord,
  ScaleType,
  ChordTypeFilter,
  buildDiatonicChord,
  parseNoteString,
  formatScaleName,
  getStandardKeyTonic,
} from '../theory/musicEngine';

export type QuestionDirection = 'degree_to_chord' | 'chord_to_degree';
export type AnswerMode = 'typed' | 'multiple_choice';

export interface QuizQuestion {
  id: string; // Unique question presentation ID
  conceptId: string; // General concept ID e.g. "major_deg2_seventh_deg2chord"
  keyConceptId: string; // Key-specific concept ID e.g. "C_major_deg2_seventh_deg2chord"
  keyTonic: string;
  scaleType: ScaleType;
  degree: number;
  chordType: 'triad' | 'seventh';
  direction: QuestionDirection;
  chord: DiatonicChord;
  prompt: {
    title: string;
    primaryText: string;
    subText: string;
    degreeLabel: string;
    romanLabel: string;
    keyLabel: string;
  };
  correctAnswerText: string;
  acceptableAnswers: string[];
  options?: string[]; // Multiple choice options
  hint: string;
  compactExplanation: string;
  expandedExplanation: string;
}

export interface QuizGradingResult {
  isCorrect: boolean;
  userAnswer: string;
  canonicalAnswer: string;
  feedbackMessage: string;
  parsedMeaning?: any;
}

/**
 * Generate a unique general concept identifier
 */
export function getGeneralConceptId(scaleType: ScaleType, degree: number, chordType: 'triad'|'seventh', direction: QuestionDirection): string {
  return `${scaleType}_deg${degree}_${chordType}_${direction}`;
}

/**
 * Generate a unique key-specific concept identifier
 */
export function getKeyConceptId(keyTonic: string, scaleType: ScaleType, degree: number, chordType: 'triad'|'seventh', direction: QuestionDirection): string {
  return `${keyTonic}_${scaleType}_deg${degree}_${chordType}_${direction}`;
}

/**
 * Build a structured quiz question
 */
export function createQuizQuestion(
  keyTonic: string,
  scaleType: ScaleType,
  degree: number,
  chordType: 'triad' | 'seventh',
  direction: QuestionDirection,
  answerMode: AnswerMode = 'typed',
  mcOptionCount: number = 4
): QuizQuestion {
  const chord = buildDiatonicChord(keyTonic, scaleType, degree, chordType);
  const conceptId = getGeneralConceptId(scaleType, degree, chordType, direction);
  const keyConceptId = getKeyConceptId(keyTonic, scaleType, degree, chordType, direction);
  const id = `q_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const scaleName = formatScaleName(scaleType);
  const degreeOrdinal = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'][degree - 1];

  let promptTitle = '';
  let primaryText = '';
  let subText = '';
  let correctAnswerText = '';
  const acceptableAnswers: string[] = [];

  if (direction === 'degree_to_chord') {
    promptTitle = `Identify the diatonic ${chordType}`;
    primaryText = `Degree ${degree}`;
    subText = `in ${keyTonic} ${scaleName}`;
    correctAnswerText = chord.name;
    acceptableAnswers.push(chord.name.toLowerCase());
    // Also accept root name if same
    if (chord.rootName !== chord.name) {
      acceptableAnswers.push(chord.rootName.toLowerCase());
    }
    // Accept alternate double accidentals spelling (e.g. Fxdim7 for F##dim7)
    if (chord.name.includes('##')) {
      acceptableAnswers.push(chord.name.replace(/##/g, 'x').toLowerCase());
      acceptableAnswers.push(chord.name.replace(/##/g, '𝄪').toLowerCase());
    }
    if (chord.name.includes('bb')) {
      acceptableAnswers.push(chord.name.replace(/bb/g, '𝄫').toLowerCase());
    }
  } else {
    // chord_to_degree
    promptTitle = `Identify the scale degree for chord`;
    primaryText = chord.name;
    subText = `in ${keyTonic} ${scaleName}`;
    correctAnswerText = String(degree);
    acceptableAnswers.push(String(degree));
    acceptableAnswers.push(chord.romanNumeral.toLowerCase());
    acceptableAnswers.push(degreeOrdinal.toLowerCase());
  }

  // Generate intelligent hint
  const rootIntervalFromTonic = (chord.root.pitchClass - chord.keyPitchClass + 12) % 12;
  const hint = direction === 'degree_to_chord'
    ? `The root note is the ${degreeOrdinal} note of the ${scaleName} scale, which has a ${chord.quality.toLowerCase()} chord quality.`
    : `Consider what degree of ${keyTonic} ${scaleName} begins on ${chord.root.formatted}.`;

  const compactExplanation = `${chord.name} is the diatonic ${chord.quality} chord on degree ${degree} (${chord.romanNumeral}) of ${keyTonic} ${scaleName}. Notes: ${chord.notes.map(n => n.formatted).join(' - ')}.`;
  const expandedExplanation = `In the key of ${keyTonic} ${scaleName}, scale degree ${degree} is ${chord.root.formatted}. Stacking diatonic thirds gives ${chord.notes.map(n => n.formatted).join(', ')}. The interval structure results in a ${chord.quality} quality (${chord.romanNumeral}).`;

  let options: string[] | undefined = undefined;
  if (answerMode === 'multiple_choice') {
    options = generateDistractors(keyTonic, scaleType, degree, chordType, direction, chord, mcOptionCount);
  }

  return {
    id,
    conceptId,
    keyConceptId,
    keyTonic,
    scaleType,
    degree,
    chordType,
    direction,
    chord,
    prompt: {
      title: promptTitle,
      primaryText,
      subText,
      degreeLabel: `Scale Degree ${degree}`,
      romanLabel: chord.romanNumeral,
      keyLabel: `${keyTonic} ${scaleName}`,
    },
    correctAnswerText,
    acceptableAnswers,
    options,
    hint,
    compactExplanation,
    expandedExplanation,
  };
}

/**
 * Generate distinct, musically valid, plausible distractors for multiple choice.
 * Guarantees no duplicate options and no enharmonically identical duplicates!
 */
export function generateDistractors(
  keyTonic: string,
  scaleType: ScaleType,
  correctDegree: number,
  chordType: 'triad' | 'seventh',
  direction: QuestionDirection,
  correctChord: DiatonicChord,
  count: number = 4
): string[] {
  const validCount = Math.max(2, Math.min(6, count));

  if (direction === 'chord_to_degree') {
    const allDegrees = [1, 2, 3, 4, 5, 6, 7];
    const distractors = allDegrees
      .filter(d => d !== correctDegree)
      .sort(() => Math.random() - 0.5)
      .slice(0, validCount - 1)
      .map(d => String(d));

    const options = [String(correctDegree), ...distractors];
    // Shuffle options
    return options.sort(() => Math.random() - 0.5);
  }

  // degree_to_chord direction: generate plausible chords from this scale and chromatic neighbors
  const poolChords: DiatonicChord[] = [];
  for (let d = 1; d <= 7; d++) {
    if (d !== correctDegree) {
      poolChords.push(buildDiatonicChord(keyTonic, scaleType, d, chordType));
    }
  }

  const distinctNames = new Set<string>();
  distinctNames.add(correctChord.name);
  const correctRootPC = correctChord.root.pitchClass;
  const correctQuality = correctChord.qualityCode;

  const candidateDistractors: string[] = [];

  // 1. Other chords from the same key
  for (const c of poolChords.sort(() => Math.random() - 0.5)) {
    if (c.root.pitchClass !== correctRootPC || c.qualityCode !== correctQuality) {
      if (!distinctNames.has(c.name)) {
        distinctNames.add(c.name);
        candidateDistractors.push(c.name);
      }
    }
  }

  // 2. Chords with same root but alternate qualities (e.g. Cmin instead of Cmaj)
  const rootStr = correctChord.root.formatted;
  const alternateQualities = chordType === 'triad'
    ? ['m', '', 'dim', 'aug']
    : ['7', 'maj7', 'm7', 'm7b5', 'dim7'];

  for (const q of alternateQualities) {
    const cand = `${rootStr}${q}`;
    if (!distinctNames.has(cand)) {
      distinctNames.add(cand);
      candidateDistractors.push(cand);
    }
  }

  const selectedDistractors = candidateDistractors.slice(0, validCount - 1);
  const finalOptions = [correctChord.name, ...selectedDistractors];

  // Shuffle final options
  return finalOptions.sort(() => Math.random() - 0.5);
}

/**
 * Text and Unicode normalization for musical input
 */
export function normalizeMusicalText(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, '') // remove inner whitespace
    .replace(/𝄪/g, '##')
    .replace(/𝄫/g, 'bb')
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/♮/g, '')
    .replace(/Δ/g, 'maj7')
    .replace(/ø7?/g, 'm7b5')
    .replace(/°7?/g, 'dim7')
    .replace(/\+maj7/g, 'augmaj7')
    .replace(/\+/g, 'aug')
    .replace(/([A-Ga-g])x\b/gi, '$1##')
    .replace(/([A-Ga-g])x([a-z0-9])/gi, '$1##$2');
}

/**
 * Parse structured musical meaning from user input for chord names
 */
export function parseUserChordInput(input: string): {
  rootPitchClass: number | null;
  qualityCode: string | null;
  bassPitchClass: number | null;
} | null {
  const norm = normalizeMusicalText(input);
  if (!norm) return null;

  // Split slash chord if any
  const parts = norm.split('/');
  const chordPart = parts[0];
  const bassPart = parts[1] || null;

  // Extract root note: letter + optional accidental (including ##, bb, x, 𝄪, 𝄫)
  const match = chordPart.match(/^([A-Ga-g])([#b]{1,2}|x|X|𝄪|𝄫)?(.*)$/);
  if (!match) return null;

  let accidentalPart = match[2] || '';
  if (accidentalPart.toLowerCase() === 'x' || accidentalPart === '𝄪') accidentalPart = '##';
  if (accidentalPart === '𝄫') accidentalPart = 'bb';

  const noteStr = `${match[1].toUpperCase()}${accidentalPart}`;
  const parsedNote = parseNoteString(noteStr);
  if (!parsedNote) return null;

  const qualityStr = match[3].toLowerCase();
  let qualityCode: string = 'maj';

  if (qualityStr === '' || qualityStr === 'maj' || qualityStr === 'major') {
    qualityCode = 'maj';
  } else if (qualityStr === 'm' || qualityStr === 'min' || qualityStr === 'minor' || qualityStr === '-') {
    qualityCode = 'min';
  } else if (qualityStr === 'dim' || qualityStr === 'o') {
    qualityCode = 'dim';
  } else if (qualityStr === 'aug') {
    qualityCode = 'aug';
  } else if (qualityStr === 'maj7' || qualityStr === 'm7+' || qualityStr === 'major7') {
    qualityCode = 'maj7';
  } else if (qualityStr === '7' || qualityStr === 'dom7') {
    qualityCode = '7';
  } else if (qualityStr === 'm7' || qualityStr === 'min7' || qualityStr === '-7') {
    qualityCode = 'min7';
  } else if (qualityStr === 'm(maj7)' || qualityStr === 'mmaj7' || qualityStr === 'minmaj7') {
    qualityCode = 'minmaj7';
  } else if (qualityStr === 'm7b5' || qualityStr === 'min7b5' || qualityStr === 'halfdim') {
    qualityCode = 'm7b5';
  } else if (qualityStr === 'dim7' || qualityStr === 'fulldim') {
    qualityCode = 'dim7';
  } else if (qualityStr === 'augmaj7') {
    qualityCode = 'augmaj7';
  } else {
    // Fallback: try raw matching
    qualityCode = qualityStr;
  }

  let bassPitchClass: number | null = null;
  if (bassPart) {
    const parsedBass = parseNoteString(bassPart);
    if (parsedBass) {
      bassPitchClass = parsedBass.pitchClass;
    }
  }

  return {
    rootPitchClass: parsedNote.pitchClass,
    qualityCode,
    bassPitchClass,
  };
}

/**
 * Semantic musical grader for quiz responses
 */
export function gradeQuizAnswer(question: QuizQuestion, userInput: string): QuizGradingResult {
  const trimmed = userInput.trim();
  if (!trimmed) {
    return {
      isCorrect: false,
      userAnswer: '',
      canonicalAnswer: question.correctAnswerText,
      feedbackMessage: 'Please enter an answer.',
    };
  }

  if (question.direction === 'chord_to_degree') {
    const norm = trimmed.toLowerCase().replace(/^(deg|degree|scale degree)\s*/, '');

    // Check direct number
    if (norm === String(question.degree) || norm === `${question.degree}st` || norm === `${question.degree}nd` || norm === `${question.degree}rd` || norm === `${question.degree}th`) {
      return {
        isCorrect: true,
        userAnswer: trimmed,
        canonicalAnswer: String(question.degree),
        feedbackMessage: 'Correct!',
      };
    }

    // Check Roman numeral match
    const roman = question.chord.romanNumeral.toLowerCase().replace(/°|ø|\+|7|maj7|⁶|⁴|₂|₃|₅/g, '');
    const userRoman = norm.replace(/°|ø|\+|7|maj7|⁶|⁴|₂|₃|₅/g, '');
    if (userRoman === roman || userRoman === question.chord.romanNumeral.toLowerCase()) {
      return {
        isCorrect: true,
        userAnswer: trimmed,
        canonicalAnswer: String(question.degree),
        feedbackMessage: 'Correct!',
      };
    }

    return {
      isCorrect: false,
      userAnswer: trimmed,
      canonicalAnswer: `${question.degree} (${question.chord.romanNumeral})`,
      feedbackMessage: `Incorrect. The correct degree is ${question.degree}.`,
    };
  }

  // degree_to_chord direction
  // First, check direct text equivalence after normalization
  const normalizedUser = normalizeMusicalText(trimmed).toLowerCase();
  const normalizedCanonical = normalizeMusicalText(question.correctAnswerText).toLowerCase();

  if (normalizedUser === normalizedCanonical) {
    return {
      isCorrect: true,
      userAnswer: trimmed,
      canonicalAnswer: question.correctAnswerText,
      feedbackMessage: 'Correct!',
    };
  }

  // Parse structured musical meaning to grant credit for legitimate enharmonics
  const parsedUser = parseUserChordInput(trimmed);
  if (parsedUser && parsedUser.rootPitchClass !== null) {
    const isRootMatch = parsedUser.rootPitchClass === question.chord.root.pitchClass;
    const isQualityMatch = parsedUser.qualityCode === question.chord.qualityCode;
    const isBassMatch = parsedUser.bassPitchClass === null || parsedUser.bassPitchClass === question.chord.bass.pitchClass;

    if (isRootMatch && isQualityMatch && isBassMatch) {
      return {
        isCorrect: true,
        userAnswer: trimmed,
        canonicalAnswer: question.correctAnswerText,
        feedbackMessage: 'Correct (enharmonic match)!',
        parsedMeaning: parsedUser,
      };
    }
  }

  return {
    isCorrect: false,
    userAnswer: trimmed,
    canonicalAnswer: question.correctAnswerText,
    feedbackMessage: `Incorrect. Expected ${question.correctAnswerText}.`,
    parsedMeaning: parsedUser,
  };
}

export interface GenerateQuizOptions {
  enabledPitchClasses: number[];
  enabledScales: ScaleType[];
  enabledDegrees?: number[];
  chordType?: ChordTypeFilter;
  direction?: QuestionDirection | 'mixed';
  answerMode?: AnswerMode;
  mcOptionCount?: number;
  questionCount?: number;
}

/**
 * Generate quiz questions exclusively from selected keys, scales, degrees, and chord types.
 */
export function generateQuizQuestions(options: GenerateQuizOptions): QuizQuestion[] {
  if (!options.enabledPitchClasses || options.enabledPitchClasses.length === 0) {
    return [];
  }
  if (!options.enabledScales || options.enabledScales.length === 0) {
    return [];
  }

  const pitchClasses = options.enabledPitchClasses;
  const scales = options.enabledScales;
  const degrees = options.enabledDegrees && options.enabledDegrees.length > 0
    ? options.enabledDegrees
    : [1, 2, 3, 4, 5, 6, 7];
  const chordTypeFilter = options.chordType || 'triads';
  const count = options.questionCount ?? 10;
  const answerMode = options.answerMode ?? 'typed';
  const mcOptionCount = options.mcOptionCount ?? 4;
  const directionSetting = options.direction ?? 'degree_to_chord';

  const list: QuizQuestion[] = [];

  for (let i = 0; i < count; i++) {
    const pc = pitchClasses[Math.floor(Math.random() * pitchClasses.length)];
    const scale = scales[Math.floor(Math.random() * scales.length)];
    const degree = degrees[Math.floor(Math.random() * degrees.length)];
    const tonic = getStandardKeyTonic(pc, scale);

    const chordType = chordTypeFilter === 'both'
      ? (Math.random() > 0.5 ? 'triad' : 'seventh')
      : chordTypeFilter === 'sevenths'
        ? 'seventh'
        : 'triad';

    const dir: QuestionDirection = directionSetting === 'mixed'
      ? (Math.random() > 0.5 ? 'degree_to_chord' : 'chord_to_degree')
      : directionSetting;

    const q = createQuizQuestion(tonic, scale, degree, chordType, dir, answerMode, mcOptionCount);
    list.push(q);
  }

  return list;
}


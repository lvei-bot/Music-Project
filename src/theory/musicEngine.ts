/**
 * Authoritative Music Theory Engine for Chord Number Practice & Trainer
 * Supports all 12 pitch classes, major / natural minor / harmonic minor scales,
 * 7 scale degrees, diatonic triads & 7th chords, accurate note spelling
 * (including double accidentals & augmented seconds), inversions,
 * Roman numerals, and transposition.
 */

export type ScaleType = 'major' | 'natural_minor' | 'harmonic_minor';
export type ChordTypeFilter = 'triads' | 'sevenths' | 'both';
export type InversionType = 0 | 1 | 2 | 3; // 0=Root, 1=1st, 2=2nd, 3=3rd

export interface NoteSpelling {
  letter: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
  accidental: '' | '#' | '##' | 'b' | 'bb';
  pitchClass: number; // 0..11
  formatted: string; // e.g. "C#", "Bb", "Fx"
  spelling?: string; // Aliased for compatibility
}

export interface DiatonicChord {
  id: string; // Stable identifier e.g. "C_major_deg1_triad_inv0"
  keyTonic: string; // e.g. "C", "F#", "Bb"
  keyPitchClass: number; // 0..11
  scaleType: ScaleType;
  degree: number; // 1..7
  chordType: 'triad' | 'seventh';
  inversion: InversionType;
  root: NoteSpelling;
  bass: NoteSpelling;
  bassNote?: NoteSpelling; // Aliased for compatibility
  notes: NoteSpelling[];
  quality: string; // e.g. "Major", "Minor", "Diminished", "Dominant 7th"
  qualityCode: 'maj' | 'min' | 'dim' | 'aug' | 'maj7' | '7' | 'min7' | 'minmaj7' | 'm7b5' | 'dim7' | 'augmaj7';
  name: string; // Conventional chord name e.g. "Cmaj", "F#m7", "G7/B"
  rootName: string; // e.g. "C", "F#m"
  romanNumeral: string; // e.g. "I", "ii", "V7", "viiø7"
  arabicDegree: string; // e.g. "1", "2"
}

export const LETTER_NAMES: Array<'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'> = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const LETTER_SEMITONES: Record<'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B', number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  natural_minor: [0, 2, 3, 5, 7, 8, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
};

export const COMMON_KEY_NAMES = [
  'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F',
  'C#', 'Gb', 'Cb',
  'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'
];

/**
 * Standard Tonics by Pitch Class (0..11) for Major and Minor
 */
export const TONICS_BY_PITCH_CLASS: Record<number, { major: string; minor: string; altMajor?: string; altMinor?: string }> = {
  0: { major: 'C', minor: 'C' },
  1: { major: 'Db', minor: 'C#', altMajor: 'C#' },
  2: { major: 'D', minor: 'D' },
  3: { major: 'Eb', minor: 'D#', altMinor: 'Eb' },
  4: { major: 'E', minor: 'E' },
  5: { major: 'F', minor: 'F' },
  6: { major: 'F#', minor: 'F#', altMajor: 'Gb' },
  7: { major: 'G', minor: 'G' },
  8: { major: 'Ab', minor: 'G#', altMinor: 'Ab' },
  9: { major: 'A', minor: 'A' },
  10: { major: 'Bb', minor: 'Bb', altMinor: 'A#' },
  11: { major: 'B', minor: 'B', altMajor: 'Cb' },
};

/**
 * Resolve standard, musically correct tonic spelling for a given pitch class and scale type.
 */
export function getStandardKeyTonic(pitchClass: number, scaleType: ScaleType): string {
  const pc = ((pitchClass % 12) + 12) % 12;
  const info = TONICS_BY_PITCH_CLASS[pc];
  if (!info) return 'C';
  if (scaleType === 'major') {
    return info.major;
  }
  // For minor scales:
  if (pc === 3 && info.altMinor) {
    return info.altMinor; // 'Eb' minor (6 flats)
  }
  return info.minor;
}

export interface KeyDisplayInfo {
  pitchClass: number;
  primaryName: string;
  enharmonicName?: string;
  fullName: string;
  label: string;
}

export const KEY_DISPLAY_LIST: KeyDisplayInfo[] = [
  { pitchClass: 0, primaryName: 'C', fullName: 'C', label: 'C' },
  { pitchClass: 1, primaryName: 'D♭', enharmonicName: 'C♯', fullName: 'D♭ / C♯', label: 'D♭' },
  { pitchClass: 2, primaryName: 'D', fullName: 'D', label: 'D' },
  { pitchClass: 3, primaryName: 'E♭', enharmonicName: 'D♯', fullName: 'E♭ / D♯', label: 'E♭' },
  { pitchClass: 4, primaryName: 'E', fullName: 'E', label: 'E' },
  { pitchClass: 5, primaryName: 'F', fullName: 'F', label: 'F' },
  { pitchClass: 6, primaryName: 'F♯', enharmonicName: 'G♭', fullName: 'F♯ / G♭', label: 'F♯' },
  { pitchClass: 7, primaryName: 'G', fullName: 'G', label: 'G' },
  { pitchClass: 8, primaryName: 'A♭', enharmonicName: 'G♯', fullName: 'A♭ / G♯', label: 'A♭' },
  { pitchClass: 9, primaryName: 'A', fullName: 'A', label: 'A' },
  { pitchClass: 10, primaryName: 'B♭', enharmonicName: 'A♯', fullName: 'B♭ / A♯', label: 'B♭' },
  { pitchClass: 11, primaryName: 'B', fullName: 'B', label: 'B' },
];

/**
 * Parse a note string into letter and accidental
 */
export function parseNoteString(str: string): NoteSpelling | null {
  const trimmed = str.trim();
  if (!trimmed) return null;
  const letter = trimmed[0].toUpperCase() as 'C'|'D'|'E'|'F'|'G'|'A'|'B';
  if (!LETTER_NAMES.includes(letter)) return null;

  let accidentalStr = trimmed.slice(1).replace(/♯/g, '#').replace(/♭/g, 'b');
  let accidental: ''|'#'|'##'|'b'|'bb' = '';
  if (accidentalStr === '#' || accidentalStr === '♯') accidental = '#';
  else if (accidentalStr === '##' || accidentalStr === 'x' || accidentalStr === '𝄪') accidental = '##';
  else if (accidentalStr === 'b' || accidentalStr === '♭') accidental = 'b';
  else if (accidentalStr === 'bb' || accidentalStr === '𝄫') accidental = 'bb';
  else if (accidentalStr === '') accidental = '';
  else return null;

  let pc = LETTER_SEMITONES[letter];
  if (accidental === '#') pc += 1;
  else if (accidental === '##') pc += 2;
  else if (accidental === 'b') pc -= 1;
  else if (accidental === 'bb') pc -= 2;
  pc = (pc + 120) % 12;

  const formatted = `${letter}${accidental}`;
  return { letter, accidental, pitchClass: pc, formatted, spelling: formatted };
}

/**
 * Given a tonic note and scale type, build all 7 spelled scale degrees
 * preserving strict diatonic letter sequence.
 */
export function buildScaleNotes(tonicStr: string, scaleType: ScaleType): NoteSpelling[] {
  const tonicParsed = parseNoteString(tonicStr);
  if (!tonicParsed) {
    throw new Error(`Invalid tonic note: ${tonicStr}`);
  }

  const intervals = SCALE_INTERVALS[scaleType];
  const tonicLetterIndex = LETTER_NAMES.indexOf(tonicParsed.letter);

  const notes: NoteSpelling[] = [];

  for (let degreeIndex = 0; degreeIndex < 7; degreeIndex++) {
    const letter = LETTER_NAMES[(tonicLetterIndex + degreeIndex) % 7];
    const targetPitchClass = (tonicParsed.pitchClass + intervals[degreeIndex]) % 12;
    const naturalPitchClass = LETTER_SEMITONES[letter];

    // Accidental difference from natural semitone
    let diff = (targetPitchClass - naturalPitchClass + 12) % 12;
    if (diff > 6) diff -= 12; // Wrap around to handle flats (-1, -2) and sharps (+1, +2)

    let accidental: ''|'#'|'##'|'b'|'bb' = '';
    if (diff === 0) accidental = '';
    else if (diff === 1) accidental = '#';
    else if (diff === 2) accidental = '##';
    else if (diff === -1) accidental = 'b';
    else if (diff === -2) accidental = 'bb';
    else {
      // Extremely rare theoretical fallback (e.g. triple sharp/flat in exotic keys)
      accidental = diff > 0 ? '#' : 'b';
    }

    notes.push({
      letter,
      accidental,
      pitchClass: targetPitchClass,
      formatted: `${letter}${accidental}`
    });
  }

  return notes;
}

/**
 * Roman numerals 1..7
 */
const ROMAN_NUMERALS_UPPER = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const ROMAN_NUMERALS_LOWER = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];

/**
 * Build a diatonic chord for a specific scale degree
 */
export function buildDiatonicChord(
  tonicStr: string,
  scaleType: ScaleType,
  degree: number, // 1..7
  chordType: 'triad' | 'seventh',
  inversion: InversionType = 0
): DiatonicChord {
  const scaleNotes = buildScaleNotes(tonicStr, scaleType);
  const degreeIndex = degree - 1; // 0..6

  const root = scaleNotes[degreeIndex];
  const third = scaleNotes[(degreeIndex + 2) % 7];
  const fifth = scaleNotes[(degreeIndex + 4) % 7];
  const seventh = scaleNotes[(degreeIndex + 6) % 7];

  const chordNotes = chordType === 'triad' ? [root, third, fifth] : [root, third, fifth, seventh];

  // Inversion determines bass note:
  // 0 -> root
  // 1 -> third
  // 2 -> fifth
  // 3 -> seventh
  const bass = chordNotes[inversion % chordNotes.length];

  // Intervals in semitones relative to root
  const thirdInterval = (third.pitchClass - root.pitchClass + 12) % 12;
  const fifthInterval = (fifth.pitchClass - root.pitchClass + 12) % 12;
  const seventhInterval = chordType === 'seventh' ? (seventh.pitchClass - root.pitchClass + 12) % 12 : null;

  let quality = '';
  let qualityCode: DiatonicChord['qualityCode'] = 'maj';
  let qualitySuffix = '';
  let romanPrefix = ROMAN_NUMERALS_UPPER[degreeIndex];
  let romanSuffix = '';

  if (chordType === 'triad') {
    if (thirdInterval === 4 && fifthInterval === 7) {
      quality = 'Major';
      qualityCode = 'maj';
      qualitySuffix = '';
      romanPrefix = ROMAN_NUMERALS_UPPER[degreeIndex];
      romanSuffix = '';
    } else if (thirdInterval === 3 && fifthInterval === 7) {
      quality = 'Minor';
      qualityCode = 'min';
      qualitySuffix = 'm';
      romanPrefix = ROMAN_NUMERALS_LOWER[degreeIndex];
      romanSuffix = '';
    } else if (thirdInterval === 3 && fifthInterval === 6) {
      quality = 'Diminished';
      qualityCode = 'dim';
      qualitySuffix = 'dim';
      romanPrefix = ROMAN_NUMERALS_LOWER[degreeIndex];
      romanSuffix = '°';
    } else if (thirdInterval === 4 && fifthInterval === 8) {
      quality = 'Augmented';
      qualityCode = 'aug';
      qualitySuffix = 'aug';
      romanPrefix = ROMAN_NUMERALS_UPPER[degreeIndex];
      romanSuffix = '+';
    }
  } else {
    // 7th chords
    if (thirdInterval === 4 && fifthInterval === 7 && seventhInterval === 11) {
      quality = 'Major 7th';
      qualityCode = 'maj7';
      qualitySuffix = 'maj7';
      romanPrefix = ROMAN_NUMERALS_UPPER[degreeIndex];
      romanSuffix = 'maj7';
    } else if (thirdInterval === 4 && fifthInterval === 7 && seventhInterval === 10) {
      quality = 'Dominant 7th';
      qualityCode = '7';
      qualitySuffix = '7';
      romanPrefix = ROMAN_NUMERALS_UPPER[degreeIndex];
      romanSuffix = '7';
    } else if (thirdInterval === 3 && fifthInterval === 7 && seventhInterval === 10) {
      quality = 'Minor 7th';
      qualityCode = 'min7';
      qualitySuffix = 'm7';
      romanPrefix = ROMAN_NUMERALS_LOWER[degreeIndex];
      romanSuffix = '7';
    } else if (thirdInterval === 3 && fifthInterval === 7 && seventhInterval === 11) {
      quality = 'Minor-Major 7th';
      qualityCode = 'minmaj7';
      qualitySuffix = 'm(maj7)';
      romanPrefix = ROMAN_NUMERALS_LOWER[degreeIndex];
      romanSuffix = 'm(maj7)';
    } else if (thirdInterval === 3 && fifthInterval === 6 && seventhInterval === 10) {
      quality = 'Half-Diminished 7th';
      qualityCode = 'm7b5';
      qualitySuffix = 'm7b5';
      romanPrefix = ROMAN_NUMERALS_LOWER[degreeIndex];
      romanSuffix = 'ø7';
    } else if (thirdInterval === 3 && fifthInterval === 6 && seventhInterval === 9) {
      quality = 'Diminished 7th';
      qualityCode = 'dim7';
      qualitySuffix = 'dim7';
      romanPrefix = ROMAN_NUMERALS_LOWER[degreeIndex];
      romanSuffix = '°7';
    } else if (thirdInterval === 4 && fifthInterval === 8 && seventhInterval === 11) {
      quality = 'Augmented-Major 7th';
      qualityCode = 'augmaj7';
      qualitySuffix = 'aug(maj7)';
      romanPrefix = ROMAN_NUMERALS_UPPER[degreeIndex];
      romanSuffix = '+maj7';
    }
  }

  const rootName = `${root.formatted}${qualitySuffix}`;
  let fullName = rootName;
  if (inversion !== 0) {
    fullName = `${rootName}/${bass.formatted}`;
  }

  // Inversion figures for Roman numerals
  let romanInversion = '';
  if (chordType === 'triad') {
    if (inversion === 1) romanInversion = '⁶';
    else if (inversion === 2) romanInversion = '⁶₄';
  } else {
    if (inversion === 1) romanInversion = '⁶₅';
    else if (inversion === 2) romanInversion = '⁴₃';
    else if (inversion === 3) romanInversion = '⁴₂';
  }

  const romanNumeral = `${romanPrefix}${romanSuffix}${romanInversion}`;

  const tonicParsed = parseNoteString(tonicStr)!;
  const id = `${tonicStr}_${scaleType}_deg${degree}_${chordType}_inv${inversion}`;

  return {
    id,
    keyTonic: tonicStr,
    keyPitchClass: tonicParsed.pitchClass,
    scaleType,
    degree,
    chordType,
    inversion,
    root: { ...root, spelling: root.formatted },
    bass: { ...bass, spelling: bass.formatted },
    bassNote: { ...bass, spelling: bass.formatted },
    notes: chordNotes.map(n => ({ ...n, spelling: n.formatted })),
    quality,
    qualityCode,
    name: fullName,
    rootName,
    romanNumeral,
    arabicDegree: String(degree),
  };
}

/**
 * Get all 7 diatonic chords for a given key, scale, and chord type
 */
export function getScaleDiatonicChords(
  tonicStr: string,
  scaleType: ScaleType,
  chordTypeFilter: ChordTypeFilter = 'triads',
  inversion: InversionType = 0
): DiatonicChord[] {
  const chords: DiatonicChord[] = [];

  for (let degree = 1; degree <= 7; degree++) {
    if (chordTypeFilter === 'triads' || chordTypeFilter === 'both') {
      chords.push(buildDiatonicChord(tonicStr, scaleType, degree, 'triad', inversion));
    }
    if (chordTypeFilter === 'sevenths' || chordTypeFilter === 'both') {
      chords.push(buildDiatonicChord(tonicStr, scaleType, degree, 'seventh', inversion));
    }
  }

  return chords;
}

/**
 * Transpose a spelled note by a semitone interval while choosing the best sensible spelling
 */
export function transposeNote(note: NoteSpelling, semitones: number, preferSharps: boolean = true): NoteSpelling {
  const newPC = (note.pitchClass + semitones + 120) % 12;
  const sharpNames: Array<{ letter: NoteSpelling['letter']; accidental: NoteSpelling['accidental'] }> = [
    { letter: 'C', accidental: '' },
    { letter: 'C', accidental: '#' },
    { letter: 'D', accidental: '' },
    { letter: 'D', accidental: '#' },
    { letter: 'E', accidental: '' },
    { letter: 'F', accidental: '' },
    { letter: 'F', accidental: '#' },
    { letter: 'G', accidental: '' },
    { letter: 'G', accidental: '#' },
    { letter: 'A', accidental: '' },
    { letter: 'A', accidental: '#' },
    { letter: 'B', accidental: '' },
  ];
  const flatNames: Array<{ letter: NoteSpelling['letter']; accidental: NoteSpelling['accidental'] }> = [
    { letter: 'C', accidental: '' },
    { letter: 'D', accidental: 'b' },
    { letter: 'D', accidental: '' },
    { letter: 'E', accidental: 'b' },
    { letter: 'E', accidental: '' },
    { letter: 'F', accidental: '' },
    { letter: 'G', accidental: 'b' },
    { letter: 'G', accidental: '' },
    { letter: 'A', accidental: 'b' },
    { letter: 'A', accidental: '' },
    { letter: 'B', accidental: 'b' },
    { letter: 'B', accidental: '' },
  ];

  const choice = preferSharps ? sharpNames[newPC] : flatNames[newPC];
  return {
    letter: choice.letter,
    accidental: choice.accidental,
    pitchClass: newPC,
    formatted: `${choice.letter}${choice.accidental}`,
  };
}

/**
 * Check if two chords are musically equivalent in 12-TET
 * (same root pitch class, same quality, same extension, same bass pitch class)
 */
export function areChordsEquivalent(a: DiatonicChord, b: DiatonicChord): boolean {
  if (a.root.pitchClass !== b.root.pitchClass) return false;
  if (a.qualityCode !== b.qualityCode) return false;
  if (a.chordType !== b.chordType) return false;
  if (a.bass.pitchClass !== b.bass.pitchClass) return false;
  return true;
}

/**
 * Format scale name for clean UI presentation
 */
export function formatScaleName(scaleType: ScaleType | string): string {
  switch (scaleType) {
    case 'major': return 'Major';
    case 'natural_minor':
    case 'minor':
      return 'Natural Minor';
    case 'harmonic_minor':
    case 'harmonic':
      return 'Harmonic Minor';
    default:
      return String(scaleType);
  }
}

/**
 * Circle of Fifths order for smooth key progression
 */
export const CIRCLE_OF_FIFTHS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
export const CIRCLE_OF_FIFTHS_MINOR = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'];

/**
 * Mode B: No-Instrument Quiz Component
 * Rebuilt to faithfully match chord-prototype.html
 * High-contrast editorial layout: 12-column config with Key Selection matrix,
 * two-column quiz stage with red accent bar and notation toolbar,
 * and comprehensive results review.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ScaleType,
  ChordTypeFilter,
  TONICS_BY_PITCH_CLASS,
  formatScaleName,
  KEY_DISPLAY_LIST,
  buildDiatonicChord,
} from '../theory/musicEngine';
import {
  QuizQuestion,
  QuestionDirection,
  AnswerMode,
  gradeQuizAnswer,
  QuizGradingResult,
  generateQuizQuestions,
} from '../engine/quizEngine';
import {
  QuizAttemptRecord,
  CompletedSessionRecord,
  saveCompletedSession,
  saveActiveRecovery,
  SettingsPreset,
  savePreset,
  deletePreset,
  getSavedQuizSettings,
  saveSavedQuizSettings,
  saveLocalQuizSettings,
} from '../storage/indexedDb';
import { ConceptMasteryState } from '../learning/masteryModel';

export interface QuizSettings {
  direction: QuestionDirection | 'mixed';
  answerMode: AnswerMode;
  mcOptionCount: 2 | 3 | 4 | 6;
  enabledPitchClasses: number[];
  enabledScales: ScaleType[];
  enabledDegrees: number[];
  chordType: ChordTypeFilter;
  ordering: 'shuffled_cycle' | 'no_repeat' | 'random';
  endingMode: 'question_count' | 'timed' | 'unlimited';
  questionCountLimit: number;
  sessionTimeMinutes: number;
  perQuestionTimerSeconds: number;
  feedbackTiming: 'immediate' | 'results_only';
  feedbackStyle: 'compact' | 'expanded';
  autoAdvanceDelaySeconds: number;
  enableHints: boolean;
  reintroduceMistakes: boolean;
  showKey?: boolean;
  focusedReviewPool?: 'all' | 'needs_review' | 'due' | 'both';
}

export const DEFAULT_QUIZ_SETTINGS: QuizSettings = {
  direction: 'degree_to_chord',
  answerMode: 'typed',
  mcOptionCount: 4,
  enabledPitchClasses: [0], // C by default
  enabledScales: ['major'],
  enabledDegrees: [1, 2, 3, 4, 5, 6, 7],
  chordType: 'triads',
  ordering: 'shuffled_cycle',
  endingMode: 'question_count',
  questionCountLimit: 10,
  sessionTimeMinutes: 5,
  perQuestionTimerSeconds: 0,
  feedbackTiming: 'immediate',
  feedbackStyle: 'compact',
  autoAdvanceDelaySeconds: 0,
  enableHints: true,
  reintroduceMistakes: false,
  showKey: true,
  focusedReviewPool: 'all',
};

interface QuestionAttemptSummary {
  question: QuizQuestion;
  userAnswer: string;
  isCorrect: boolean;
  usedHint: boolean;
  isSkipped: boolean;
  isTimeout: boolean;
  explanation: string;
}

interface QuizViewProps {
  onSessionComplete: (session: CompletedSessionRecord) => void;
  conceptStates: Map<string, ConceptMasteryState>;
  presets: SettingsPreset[];
  onRefreshPresets: () => void;
  initialSettings?: Partial<QuizSettings>;
  overrideQuestions?: QuizQuestion[];
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtT = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
};

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export const QuizView: React.FC<QuizViewProps> = ({
  onSessionComplete,
  conceptStates,
  presets,
  onRefreshPresets,
  initialSettings,
  overrideQuestions,
}) => {
  const [settings, setSettings] = useState<QuizSettings>(() => ({
    ...DEFAULT_QUIZ_SETTINGS,
    ...initialSettings,
  }));

  const [openGroups, setOpenGroups] = useState<{ [key: number]: boolean }>({
    1: true,
    2: true,
    3: false,
    4: false,
  });

  const toggleGroup = (n: number) => {
    setOpenGroups(prev => ({ ...prev, [n]: !prev[n] }));
  };

  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [quizState, setQuizState] = useState<'config' | 'active' | 'completed'>('config');

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [selectedMCOption, setSelectedMCOption] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<QuizGradingResult | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [usedHintThisQuestion, setUsedHintThisQuestion] = useState(false);
  const [showHintText, setShowHintText] = useState(false);
  const [hintsUsedTotal, setHintsUsedTotal] = useState(0);

  const [attempts, setAttempts] = useState<QuizAttemptRecord[]>([]);
  const [summaryItems, setSummaryItems] = useState<QuestionAttemptSummary[]>([]);
  const [selectedQuestionsForPractice, setSelectedQuestionsForPractice] = useState<Set<number>>(new Set());

  const sessionStartRef = useRef<number>(0);
  const typedInputRef = useRef<HTMLInputElement>(null);

  const [presetNameInput, setPresetNameInput] = useState('');
  const [showPresetSave, setShowPresetSave] = useState(false);

  const currentQuestion: QuizQuestion | null = questions[currentIndex] || null;

  // Restore saved quiz settings from IndexedDB on mount
  useEffect(() => {
    let isMounted = true;
    getSavedQuizSettings().then(saved => {
      if (isMounted && saved) {
        setSettings(prev => ({
          ...prev,
          ...saved,
          ...(initialSettings || {}),
        }));
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (initialSettings) {
      setSettings(prev => ({ ...prev, ...initialSettings }));
    }
  }, [initialSettings]);

  useEffect(() => {
    saveLocalQuizSettings(settings);
    saveSavedQuizSettings(settings).catch(() => {});
  }, [settings]);

  // Key Selection Handlers
  const handleToggleKey = (pc: number) => {
    setSettings(prev => {
      const exists = prev.enabledPitchClasses.includes(pc);
      const next = exists
        ? prev.enabledPitchClasses.filter(x => x !== pc)
        : [...prev.enabledPitchClasses, pc].sort((a, b) => a - b);
      if (next.length > 0) {
        setValidationMessage(null);
      }
      return { ...prev, enabledPitchClasses: next };
    });
  };

  const handleSelectAllKeys = () => {
    setSettings(prev => ({
      ...prev,
      enabledPitchClasses: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    }));
    setValidationMessage(null);
  };

  const handleClearAllKeys = () => {
    setSettings(prev => ({
      ...prev,
      enabledPitchClasses: [],
    }));
    setValidationMessage('Please select at least one key before starting the quiz.');
  };

  // Question Generation
  const generateQuestionList = (): QuizQuestion[] => {
    if (overrideQuestions && overrideQuestions.length > 0) {
      return [...overrideQuestions];
    }

    return generateQuizQuestions({
      enabledPitchClasses: settings.enabledPitchClasses,
      enabledScales: settings.enabledScales,
      enabledDegrees: settings.enabledDegrees,
      chordType: settings.chordType,
      direction: settings.direction,
      answerMode: settings.answerMode,
      mcOptionCount: settings.mcOptionCount,
      questionCount: settings.questionCountLimit,
    });
  };

  // Start Quiz
  const handleStartQuiz = () => {
    if (settings.enabledPitchClasses.length === 0) {
      setValidationMessage('Please select at least one key before starting the quiz.');
      return;
    }
    if (settings.enabledScales.length === 0) {
      setValidationMessage('Please select at least one scale.');
      return;
    }
    if (settings.enabledDegrees.length === 0) {
      setValidationMessage('Please select at least one degree.');
      return;
    }

    setValidationMessage(null);

    const list = generateQuestionList();
    if (list.length === 0) {
      setValidationMessage('No questions could be generated with the current settings.');
      return;
    }

    setQuestions(list);
    setCurrentIndex(0);
    setTypedAnswer('');
    setSelectedMCOption(null);
    setCurrentResult(null);
    setIsLocked(false);
    setUsedHintThisQuestion(false);
    setShowHintText(false);
    setHintsUsedTotal(0);
    setAttempts([]);
    setSummaryItems([]);
    sessionStartRef.current = Date.now();

    setQuizState('active');
    setTimeout(() => typedInputRef.current?.focus(), 80);
  };

  const handleRetryEntireQuiz = () => {
    const list = generateQuestionList();
    if (list.length === 0) return;
    setQuestions(list);
    setCurrentIndex(0);
    setTypedAnswer('');
    setSelectedMCOption(null);
    setCurrentResult(null);
    setIsLocked(false);
    setUsedHintThisQuestion(false);
    setShowHintText(false);
    setHintsUsedTotal(0);
    setAttempts([]);
    setSummaryItems([]);
    setSelectedQuestionsForPractice(new Set());
    sessionStartRef.current = Date.now();
    setQuizState('active');
    setTimeout(() => typedInputRef.current?.focus(), 80);
  };

  const handleRetryIncorrect = () => {
    const incorrectQuestions = summaryItems
      .filter(s => !s.isCorrect)
      .map(s => s.question);
    if (incorrectQuestions.length === 0) return;
    setQuestions(incorrectQuestions);
    setCurrentIndex(0);
    setTypedAnswer('');
    setSelectedMCOption(null);
    setCurrentResult(null);
    setIsLocked(false);
    setUsedHintThisQuestion(false);
    setShowHintText(false);
    setHintsUsedTotal(0);
    setAttempts([]);
    setSummaryItems([]);
    setSelectedQuestionsForPractice(new Set());
    sessionStartRef.current = Date.now();
    setQuizState('active');
    setTimeout(() => typedInputRef.current?.focus(), 80);
  };

  const handlePracticeSelected = () => {
    if (selectedQuestionsForPractice.size === 0) {
      alert('Please select at least one question to practice.');
      return;
    }
    const practiceSet = Array.from(selectedQuestionsForPractice).map(idx => summaryItems[idx].question);
    setQuestions(practiceSet);
    setCurrentIndex(0);
    setTypedAnswer('');
    setSelectedMCOption(null);
    setCurrentResult(null);
    setIsLocked(false);
    setUsedHintThisQuestion(false);
    setShowHintText(false);
    setHintsUsedTotal(0);
    setAttempts([]);
    setSummaryItems([]);
    setSelectedQuestionsForPractice(new Set());
    sessionStartRef.current = Date.now();
    setQuizState('active');
    setTimeout(() => typedInputRef.current?.focus(), 80);
  };

  // Submit Answer
  const handleSubmitAnswer = (answerToGrade?: string) => {
    if (isLocked || !currentQuestion) return;

    const answer =
      answerToGrade ?? (settings.answerMode === 'multiple_choice' ? selectedMCOption : typedAnswer) ?? '';
    if (!answer.trim()) return;

    const result = gradeQuizAnswer(currentQuestion, answer);
    setCurrentResult(result);
    setIsLocked(true);

    const attempt: QuizAttemptRecord = {
      id: `attempt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sessionId: `session_quiz_${sessionStartRef.current}`,
      conceptId: currentQuestion.conceptId,
      keyConceptId: currentQuestion.keyConceptId,
      timestamp: Date.now(),
      isCorrect: result.isCorrect,
      usedHint: usedHintThisQuestion,
      isSkipped: false,
      isTimeout: false,
      userAnswer: answer,
    };

    setAttempts(prev => [...prev, attempt]);
    setSummaryItems(prev => [
      ...prev,
      {
        question: currentQuestion,
        userAnswer: answer,
        isCorrect: result.isCorrect,
        usedHint: usedHintThisQuestion,
        isSkipped: false,
        isTimeout: false,
        explanation: currentQuestion.compactExplanation,
      },
    ]);
  };

  const handleSkip = () => {
    if (isLocked || !currentQuestion) return;

    const attempt: QuizAttemptRecord = {
      id: `attempt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sessionId: `session_quiz_${sessionStartRef.current}`,
      conceptId: currentQuestion.conceptId,
      keyConceptId: currentQuestion.keyConceptId,
      timestamp: Date.now(),
      isCorrect: false,
      usedHint: usedHintThisQuestion,
      isSkipped: true,
      isTimeout: false,
      userAnswer: '[Skipped]',
    };

    setAttempts(prev => [...prev, attempt]);
    setSummaryItems(prev => [
      ...prev,
      {
        question: currentQuestion,
        userAnswer: '[Skipped]',
        isCorrect: false,
        usedHint: usedHintThisQuestion,
        isSkipped: true,
        isTimeout: false,
        explanation: currentQuestion.compactExplanation,
      },
    ]);

    setCurrentResult({
      isCorrect: false,
      isExactMatch: false,
      feedbackMessage: 'Question skipped.',
      normalizedAnswer: '',
    });
    setIsLocked(true);
  };

  const handleAdvanceToNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setTypedAnswer('');
      setSelectedMCOption(null);
      setCurrentResult(null);
      setIsLocked(false);
      setUsedHintThisQuestion(false);
      setShowHintText(false);
      setTimeout(() => typedInputRef.current?.focus(), 80);
    } else {
      handleFinishQuiz();
    }
  };

  const handleFinishQuiz = async () => {
    const now = Date.now();
    const startTime = sessionStartRef.current || now;
    const duration = Math.max(1, Math.floor((now - startTime) / 1000));

    const correctCount = summaryItems.filter(s => s.isCorrect).length;

    const record: CompletedSessionRecord = {
      id: `session_quiz_${now}`,
      mode: 'quiz',
      startedAt: startTime,
      completedAt: now,
      activeDurationSeconds: duration,
      pausedDurationSeconds: 0,
      wallClockDurationSeconds: duration,
      settingsSnapshot: { ...settings },
      summary: {
        totalItems: summaryItems.length,
        correctCount,
        accuracyPercent: summaryItems.length > 0 ? Math.round((correctCount / summaryItems.length) * 100) : 0,
      },
      excludedFromAnalytics: false,
    };

    await saveCompletedSession(record, attempts);
    await saveActiveRecovery(null);
    setQuizState('completed');
    onSessionComplete(record);
  };

  const handleInsertSymbol = (symbol: string) => {
    if (!typedInputRef.current) {
      setTypedAnswer(prev => prev + symbol);
      return;
    }
    const input = typedInputRef.current;
    const start = input.selectionStart || typedAnswer.length;
    const end = input.selectionEnd || typedAnswer.length;
    const updated = typedAnswer.substring(0, start) + symbol + typedAnswer.substring(end);
    setTypedAnswer(updated);
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + symbol.length, start + symbol.length);
    }, 10);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (quizState !== 'active') return;

      if (e.key === 'Enter') {
        if (!isLocked) {
          e.preventDefault();
          handleSubmitAnswer();
        } else {
          e.preventDefault();
          handleAdvanceToNext();
        }
      } else if (settings.answerMode === 'multiple_choice' && !isLocked && /^[1-4]$/.test(e.key)) {
        if (currentQuestion?.multipleChoiceOptions) {
          const idx = parseInt(e.key, 10) - 1;
          const opt = currentQuestion.multipleChoiceOptions[idx];
          if (opt) {
            setSelectedMCOption(opt);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quizState, isLocked, typedAnswer, selectedMCOption, currentIndex, questions]);

  // ---------------- RENDER VIEWS ----------------

  // 1. ACTIVE QUIZ SESSION VIEW
  if (quizState === 'active' && currentQuestion) {
    const isD2C = currentQuestion.direction === 'degree_to_chord';
    const bigPromptText = isD2C
      ? `${currentQuestion.targetDegree}`
      : currentQuestion.targetChord.name;
    const subtitleText = isD2C
      ? `Degree ${currentQuestion.targetDegree} · ${currentQuestion.chordType} chord`
      : `Which degree is this chord in ${currentQuestion.keyTonic} ${formatScaleName(currentQuestion.scaleType).toLowerCase()}?`;
    const promptKicker = isD2C ? 'Name the chord' : 'Name the degree';

    const showKeyBadge = settings.showKey !== false;
    const progressFrac = (currentIndex + (isLocked ? 1 : 0)) / questions.length;

    return (
      <div className="view sess">
        {/* Top Meta Strip */}
        <div className="meta micro">
          <div className="muted">
            Key
            <b>
              {showKeyBadge
                ? `${currentQuestion.keyTonic} ${formatScaleName(currentQuestion.scaleType).toLowerCase()}`
                : 'Hidden'}
            </b>
          </div>
          <div className="muted">
            Question
            <b className="tnum">
              {pad2(currentIndex + 1)} / {pad2(questions.length)}
            </b>
          </div>
          <div className="muted">
            Mode
            <b>{settings.answerMode === 'typed' ? 'Typed' : 'Multiple choice'}</b>
          </div>
          <div className="muted">
            Hints
            <b>{settings.enableHints ? `${hintsUsedTotal} used` : 'Off'}</b>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="pbar" aria-hidden="true">
          <i style={{ width: `${progressFrac * 100}%` }} />
        </div>

        {/* Question Main Stage */}
        <div className="q-main">
          {/* Left Column: Prompt */}
          <div className="q-prompt">
            <div className="micro muted">{promptKicker}</div>
            <h1
              className={`display big ${bigPromptText.length > 5 ? 'long' : ''}`}
              aria-label={isD2C ? `Degree ${currentQuestion.targetDegree}` : currentQuestion.targetChord.name}
            >
              {bigPromptText}
            </h1>
            <div className="sub">{subtitleText}</div>
          </div>

          {/* Right Column: Answer Input & Controls */}
          <div className="q-ans">
            <div className="acc-bar" aria-hidden="true"></div>

            {settings.answerMode === 'typed' ? (
              <div>
                <div className="field">
                  <label className="micro" htmlFor="ans">
                    {isD2C ? 'Your chord (e.g. B♭m7, G, F#dim)' : 'Your answer (e.g. 5 or V)'}
                  </label>
                  <input
                    id="ans"
                    ref={typedInputRef}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    inputMode="text"
                    value={typedAnswer}
                    onChange={e => setTypedAnswer(e.target.value)}
                    disabled={isLocked}
                    placeholder={isD2C ? 'D, Em, G7…' : '1–7 or I–VII'}
                  />
                </div>

                {/* Notation Helpers toolbar */}
                {!isLocked && (
                  <div className="helpers">
                    <span className="micro muted">Insert</span>
                    {['♯', '♭', '°', 'ø', 'Δ'].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleInsertSymbol(s)}
                        aria-label={`Insert ${s}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Multiple Choice Options */
              <div className="mc" role="group" aria-label="Answer choices">
                {currentQuestion.multipleChoiceOptions?.map((opt, i) => {
                  const isSelected = selectedMCOption === opt;
                  let cls = '';
                  if (isLocked) {
                    if (opt === currentQuestion.correctAnswer) cls = 'right';
                    else if (isSelected) cls = 'wrong';
                    else cls = 'dim';
                  }

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => !isLocked && setSelectedMCOption(opt)}
                      aria-pressed={isSelected}
                      className={cls}
                      disabled={isLocked}
                    >
                      <span className="i">{pad2(i + 1)}</span>
                      <span className="o">{opt}</span>
                      <span className="m" aria-hidden="true"></span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Action Tools */}
            <div className="qtools">
              <button
                type="button"
                className="pri"
                onClick={() => handleSubmitAnswer()}
                disabled={isLocked}
              >
                <span>Submit</span>
                <span aria-hidden="true">↵</span>
              </button>
              {settings.enableHints && (
                <button
                  type="button"
                  onClick={() => {
                    if (!showHintText) {
                      setShowHintText(true);
                      setUsedHintThisQuestion(true);
                      setHintsUsedTotal(prev => prev + 1);
                    }
                  }}
                  disabled={isLocked}
                >
                  Hint
                </button>
              )}
              <button type="button" onClick={handleSkip} disabled={isLocked}>
                Skip
              </button>
            </div>

            {/* Hint Box */}
            {showHintText && !isLocked && (
              <div className="hint" role="note">
                <span className="micro muted">Hint</span>
                <br />
                {currentQuestion.hint}
              </div>
            )}

            {/* Immediate Feedback Box */}
            {isLocked && currentResult && (
              <div
                className={`fb ${
                  currentResult.feedbackMessage === 'Question skipped.'
                    ? 'skip'
                    : currentResult.isCorrect
                    ? 'ok'
                    : 'no'
                }`}
                id="fbbox"
              >
                <div className="st">
                  <span className="ic" aria-hidden="true">
                    {currentResult.feedbackMessage === 'Question skipped.'
                      ? '–'
                      : currentResult.isCorrect
                      ? '✓'
                      : '✕'}
                  </span>
                  {currentResult.feedbackMessage === 'Question skipped.'
                    ? 'skipped.'
                    : currentResult.isCorrect
                    ? 'correct.'
                    : 'not quite.'}
                </div>

                <dl className="micro">
                  <dt className="muted">Expected</dt>
                  <dd style={{ textTransform: 'none', letterSpacing: '0', fontSize: '1.05rem' }}>
                    {currentQuestion.correctAnswer}
                  </dd>
                  <dt className="muted">You answered</dt>
                  <dd style={{ textTransform: 'none', letterSpacing: '0', fontSize: '1.05rem' }}>
                    {(settings.answerMode === 'multiple_choice' ? selectedMCOption : typedAnswer) || '—'}
                  </dd>
                  <dt className="muted">Notes</dt>
                  <dd style={{ textTransform: 'none', letterSpacing: '0', fontSize: '1.05rem' }}>
                    {currentQuestion.targetChord.notes.map(n => n.spelling).join(' · ')}
                  </dd>
                </dl>

                <p>
                  {currentResult.feedbackMessage && `${currentResult.feedbackMessage} `}
                  {currentQuestion.compactExplanation}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Transport Bar */}
        <div className="bar" style={{ gridTemplateColumns: '1fr 2fr' }}>
          <button
            type="button"
            className="b pa"
            onClick={handleFinishQuiz}
            style={{ borderRight: '1px solid var(--ink)' }}
          >
            <span>End quiz</span>
            <span aria-hidden="true">✕</span>
          </button>
          <button
            type="button"
            className="b next"
            onClick={handleAdvanceToNext}
            disabled={!isLocked}
          >
            <span>{currentIndex >= questions.length - 1 ? 'finish' : 'next'}</span>
            <span className="ar" aria-hidden="true">
              →
            </span>
          </button>
        </div>
      </div>
    );
  }

  // 2. COMPLETED RESULTS VIEW
  if (quizState === 'completed') {
    const correctCount = summaryItems.filter(s => s.isCorrect).length;
    const skippedCount = summaryItems.filter(s => s.isSkipped).length;
    const hintedCount = summaryItems.filter(s => s.usedHint).length;
    const pct = summaryItems.length > 0 ? Math.round((correctCount / summaryItems.length) * 100) : 0;
    const totalTime = sessionStartRef.current ? Date.now() - sessionStartRef.current : 0;

    // Weak concepts calculation
    const weakDegreesMap: { [deg: number]: number } = {};
    summaryItems
      .filter(s => !s.isCorrect)
      .forEach(s => {
        weakDegreesMap[s.question.targetDegree] = (weakDegreesMap[s.question.targetDegree] || 0) + 1;
      });
    const weakList = Object.keys(weakDegreesMap)
      .map(Number)
      .sort((a, b) => weakDegreesMap[b] - weakDegreesMap[a])
      .slice(0, 3)
      .map(d => ROMAN_NUMERALS[d - 1])
      .join(' ');

    const toggleSelectPractice = (idx: number) => {
      setSelectedQuestionsForPractice(prev => {
        const next = new Set(prev);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        return next;
      });
    };

    return (
      <div className="view">
        <div className="res">
          <div className="num">
            <div className="micro muted">Session complete / No-instrument quiz</div>
            <div className="display" aria-label={`${pct} percent`}>
              {pct}
              <small>%</small>
            </div>
          </div>

          <div className="mx">
            <div className="mrow micro">
              <span>Accuracy</span>
              <b>
                {correctCount} / {summaryItems.length}
              </b>
            </div>
            <div className="mrow micro">
              <span>Time</span>
              <b className="tnum">{fmtT(totalTime)}</b>
            </div>
            <div className="mrow micro">
              <span>Hints used</span>
              <b>{hintedCount}</b>
            </div>
            <div className="mrow micro">
              <span>Skipped</span>
              <b>{skippedCount}</b>
            </div>
            <div className="mrow micro">
              <span>Weak concepts</span>
              <b>{weakList || 'None'}</b>
            </div>
          </div>

          <div className="ctas">
            <button type="button" className="btn acc-bg big" onClick={handleRetryEntireQuiz}>
              <span>Retry</span>
              <span>↗</span>
            </button>
            <button type="button" className="btn big" onClick={() => setQuizState('config')}>
              <span>Return to settings</span>
              <span>←</span>
            </button>
            {correctCount < summaryItems.length ? (
              <button type="button" className="btn ghost big" onClick={handleRetryIncorrect}>
                <span>Retry incorrect</span>
                <span>↺</span>
              </button>
            ) : (
              <span></span>
            )}
          </div>

          {/* Review Table */}
          <div className="review">
            <div className="flex items-baseline justify-between mb-4 flex-wrap gap-4">
              <h2 className="display">review.</h2>
              {selectedQuestionsForPractice.size > 0 && (
                <button
                  type="button"
                  onClick={handlePracticeSelected}
                  className="btn !min-h-[44px] !px-4 !text-xs !bg-[var(--ink)] !text-white"
                >
                  Practice {selectedQuestionsForPractice.size} Selected →
                </button>
              )}
            </div>

            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Status</th>
                  <th>Question</th>
                  <th>Your answer</th>
                  <th>Correct</th>
                  <th>Select</th>
                </tr>
              </thead>
              <tbody>
                {summaryItems.map((item, i) => {
                  const isD2C = item.question.direction === 'degree_to_chord';
                  const qLabel = isD2C
                    ? `Degree ${item.question.targetDegree} in ${item.question.keyTonic} ${formatScaleName(item.question.scaleType).toLowerCase()}`
                    : `${item.question.targetChord.name} in ${item.question.keyTonic} ${formatScaleName(item.question.scaleType).toLowerCase()}`;
                  const isChecked = selectedQuestionsForPractice.has(i);

                  return (
                    <tr key={i}>
                      <td className="st">{pad2(i + 1)}</td>
                      <td>
                        <span className={`tag ${item.isSkipped ? 'sk' : item.isCorrect ? 'ok' : 'no'}`}>
                          {item.isSkipped ? '– Skipped' : item.isCorrect ? '✓ Correct' : '✕ Wrong'}
                        </span>
                      </td>
                      <td className="font-semibold">{qLabel}</td>
                      <td>{item.userAnswer}</td>
                      <td className="font-bold">{item.question.correctAnswer}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => toggleSelectPractice(i)}
                          className="tag"
                          style={{
                            borderColor: isChecked ? 'var(--accent)' : 'var(--line)',
                            color: isChecked ? 'var(--accent)' : 'inherit',
                          }}
                        >
                          {isChecked ? '■ Picked' : '□ Pick'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 3. CONFIGURATION / SETTINGS VIEW
  const selectedKeysCount = settings.enabledPitchClasses.length;
  const keySummaryText =
    selectedKeysCount === 12
      ? 'All 12 keys'
      : selectedKeysCount === 1
      ? `${TONICS_BY_PITCH_CLASS[settings.enabledPitchClasses[0]]?.[0] || 'C'} key`
      : `${selectedKeysCount} keys selected`;

  const summaryRows = [
    ['Keys', keySummaryText],
    ['Scale', settings.enabledScales.map(formatScaleName).join(', ')],
    [
      'Chord set',
      settings.chordType === 'triads'
        ? 'Triads'
        : settings.chordType === 'sevenths'
        ? 'Sevenths'
        : 'Triads + sevenths',
    ],
    [
      'Questions',
      `${settings.questionCountLimit} · ${settings.answerMode === 'typed' ? 'typed' : 'choice'}`,
    ],
  ];

  return (
    <div className="view">
      <div className="cfg">
        {/* Left Sticky Header Column */}
        <aside className="cfg-head">
          <div className="micro muted">Mode B / No-instrument quiz</div>
          <h1 className="display">configure.</h1>
          <div className="cfg-sum micro">
            {summaryRows.map(([label, val]) => (
              <div key={label}>
                <span className="muted">{label}</span>
                <b>{val}</b>
              </div>
            ))}
          </div>
          <div className="warn micro" role="alert" id="warn">
            {validationMessage}
          </div>
          <button
            type="button"
            className="start"
            onClick={handleStartQuiz}
            disabled={!!validationMessage || settings.enabledPitchClasses.length === 0}
          >
            <span className="micro">Quiz · {keySummaryText}</span>
            <span className="big">
              start<br />session ↗
            </span>
          </button>
        </aside>

        {/* Right Body with Accordion Groups */}
        <div className="cfg-body">
          {/* Group 01: Musical Material */}
          <section className="grp">
            <button
              type="button"
              className="grp-h"
              onClick={() => toggleGroup(1)}
              aria-expanded={openGroups[1]}
            >
              <span className="micro">01</span>
              <span className="t">Musical material</span>
              <span className="micro muted v">
                {keySummaryText} · {settings.chordType}
              </span>
              <span className="pm" aria-hidden="true">
                {openGroups[1] ? '−' : '+'}
              </span>
            </button>
            {openGroups[1] && (
              <div className="grp-c">
                {/* Key Selection matrix */}
                <div className="setting">
                  <div className="lab micro">
                    Key selection
                    <small>Choose 1, multiple, or all 12 keys.</small>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={handleSelectAllKeys}
                        className="micro font-bold underline"
                      >
                        Select All
                      </button>
                      <span className="micro muted">·</span>
                      <button
                        type="button"
                        onClick={handleClearAllKeys}
                        className="micro font-bold underline"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="keys" role="group" aria-label="Key selection">
                      {KEY_DISPLAY_LIST.map(k => {
                        const isSelected = settings.enabledPitchClasses.includes(k.pitchClass);
                        return (
                          <button
                            key={k.pitchClass}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => handleToggleKey(k.pitchClass)}
                            aria-label={`Key ${k.label}`}
                          >
                            {k.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Scale selection */}
                <div className="setting">
                  <div className="lab micro">Scale</div>
                  <div className="seg" role="group">
                    {(['major', 'minor', 'harmonic_minor'] as ScaleType[]).map(scale => {
                      const isSel = settings.enabledScales.includes(scale);
                      return (
                        <button
                          key={scale}
                          type="button"
                          aria-pressed={isSel}
                          onClick={() => {
                            setSettings(prev => {
                              const exists = prev.enabledScales.includes(scale);
                              if (exists && prev.enabledScales.length === 1) return prev;
                              const updated = exists
                                ? prev.enabledScales.filter(s => s !== scale)
                                : [...prev.enabledScales, scale];
                              return { ...prev, enabledScales: updated };
                            });
                          }}
                        >
                          {formatScaleName(scale)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Chord set */}
                <div className="setting">
                  <div className="lab micro">Chord set</div>
                  <div className="seg" role="group">
                    {(['triads', 'sevenths', 'both'] as ChordTypeFilter[]).map(type => (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={settings.chordType === type}
                        onClick={() => setSettings(prev => ({ ...prev, chordType: type }))}
                      >
                        {type === 'triads' ? 'Triads' : type === 'sevenths' ? 'Sevenths' : 'Both'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scale degrees */}
                <div className="setting">
                  <div className="lab micro">
                    Degrees
                    <small>Toggle which scale degrees are queried.</small>
                  </div>
                  <div className="degs" role="group" aria-label="Scale degrees">
                    {[1, 2, 3, 4, 5, 6, 7].map(deg => {
                      const on = settings.enabledDegrees.includes(deg);
                      const tonicName = TONICS_BY_PITCH_CLASS[settings.enabledPitchClasses[0] || 0]?.[0] || 'C';
                      const scale = settings.enabledScales[0] || 'major';
                      const sampleChord = buildDiatonicChord(
                        tonicName,
                        scale,
                        deg,
                        settings.chordType === 'sevenths' ? 'seventh' : 'triad'
                      );
                      return (
                        <button
                          key={deg}
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            setSettings(prev => {
                              const exists = prev.enabledDegrees.includes(deg);
                              const updated = exists
                                ? prev.enabledDegrees.filter(d => d !== deg)
                                : [...prev.enabledDegrees, deg].sort();
                              return { ...prev, enabledDegrees: updated };
                            });
                          }}
                        >
                          <span className="r">{sampleChord.romanNumeral}</span>
                          <span className="c">{sampleChord.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Group 02: Session Flow */}
          <section className="grp">
            <button
              type="button"
              className="grp-h"
              onClick={() => toggleGroup(2)}
              aria-expanded={openGroups[2]}
            >
              <span className="micro">02</span>
              <span className="t">Session flow</span>
              <span className="micro muted v">
                {settings.answerMode === 'typed' ? 'Typed' : 'Choice'} · {settings.questionCountLimit} Q
              </span>
              <span className="pm" aria-hidden="true">
                {openGroups[2] ? '−' : '+'}
              </span>
            </button>
            {openGroups[2] && (
              <div className="grp-c">
                <div className="setting">
                  <div className="lab micro">Direction</div>
                  <div className="seg" role="group">
                    <button
                      type="button"
                      aria-pressed={settings.direction === 'mixed'}
                      onClick={() => setSettings(prev => ({ ...prev, direction: 'mixed' }))}
                    >
                      Both
                    </button>
                    <button
                      type="button"
                      aria-pressed={settings.direction === 'degree_to_chord'}
                      onClick={() => setSettings(prev => ({ ...prev, direction: 'degree_to_chord' }))}
                    >
                      Degree → chord
                    </button>
                    <button
                      type="button"
                      aria-pressed={settings.direction === 'chord_to_degree'}
                      onClick={() => setSettings(prev => ({ ...prev, direction: 'chord_to_degree' }))}
                    >
                      Chord → degree
                    </button>
                  </div>
                </div>

                <div className="setting">
                  <div className="lab micro">Answer mode</div>
                  <div className="seg" role="group">
                    <button
                      type="button"
                      aria-pressed={settings.answerMode === 'typed'}
                      onClick={() => setSettings(prev => ({ ...prev, answerMode: 'typed' }))}
                    >
                      Typed
                    </button>
                    <button
                      type="button"
                      aria-pressed={settings.answerMode === 'multiple_choice'}
                      onClick={() => setSettings(prev => ({ ...prev, answerMode: 'multiple_choice' }))}
                    >
                      Multiple choice
                    </button>
                  </div>
                </div>

                <div className="setting">
                  <div className="lab micro">Questions</div>
                  <div className="stepper">
                    <button
                      type="button"
                      onClick={() =>
                        setSettings(prev => ({
                          ...prev,
                          questionCountLimit: Math.max(5, prev.questionCountLimit - 5),
                        }))
                      }
                      aria-label="Decrease question count"
                    >
                      −
                    </button>
                    <span className="val">{settings.questionCountLimit}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings(prev => ({
                          ...prev,
                          questionCountLimit: Math.min(50, prev.questionCountLimit + 5),
                        }))
                      }
                      aria-label="Increase question count"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Group 03: Display */}
          <section className="grp">
            <button
              type="button"
              className="grp-h"
              onClick={() => toggleGroup(3)}
              aria-expanded={openGroups[3]}
            >
              <span className="micro">03</span>
              <span className="t">Display</span>
              <span className="micro muted v">
                {settings.enableHints ? 'Hints allowed' : 'Hints off'} · Key{' '}
                {settings.showKey !== false ? 'shown' : 'hidden'}
              </span>
              <span className="pm" aria-hidden="true">
                {openGroups[3] ? '−' : '+'}
              </span>
            </button>
            {openGroups[3] && (
              <div className="grp-c">
                <div className="setting">
                  <div className="lab micro">Hints</div>
                  <div className="seg" role="group">
                    <button
                      type="button"
                      aria-pressed={settings.enableHints}
                      onClick={() => setSettings(prev => ({ ...prev, enableHints: true }))}
                    >
                      Allowed
                    </button>
                    <button
                      type="button"
                      aria-pressed={!settings.enableHints}
                      onClick={() => setSettings(prev => ({ ...prev, enableHints: false }))}
                    >
                      Off
                    </button>
                  </div>
                </div>

                <div className="setting">
                  <div className="lab micro">Show key in quiz</div>
                  <div className="seg" role="group">
                    <button
                      type="button"
                      aria-pressed={settings.showKey !== false}
                      onClick={() => setSettings(prev => ({ ...prev, showKey: true }))}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      aria-pressed={settings.showKey === false}
                      onClick={() => setSettings(prev => ({ ...prev, showKey: false }))}
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Group 04: Presets */}
          <section className="grp">
            <button
              type="button"
              className="grp-h"
              onClick={() => toggleGroup(4)}
              aria-expanded={openGroups[4]}
            >
              <span className="micro">04</span>
              <span className="t">Presets</span>
              <span className="micro muted v">
                {presets.filter(p => p.mode === 'quiz').length} saved
              </span>
              <span className="pm" aria-hidden="true">
                {openGroups[4] ? '−' : '+'}
              </span>
            </button>
            {openGroups[4] && (
              <div className="grp-c">
                <div className="space-y-4">
                  {presets
                    .filter(p => p.mode === 'quiz')
                    .map(p => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between py-2 border-b border-[var(--line)]"
                      >
                        <div>
                          <b className="text-sm">{p.name}</b>
                          <div className="micro muted">
                            {p.settings.answerMode} · {p.settings.chordType}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSettings(prev => ({ ...prev, ...p.settings }));
                            }}
                            className="btn !min-h-[38px] !px-3 !text-xs"
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await deletePreset(p.id);
                              onRefreshPresets();
                            }}
                            className="btn ghost !min-h-[38px] !px-3 !text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}

                  {showPresetSave ? (
                    <div className="pt-2 flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Preset Name"
                        value={presetNameInput}
                        onChange={e => setPresetNameInput(e.target.value)}
                        className="border border-[var(--ink)] bg-[var(--paper)] px-3 py-2 text-sm flex-1 font-bold"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!presetNameInput.trim()) return;
                          await savePreset({
                            id: `preset_quiz_${Date.now()}`,
                            mode: 'quiz',
                            name: presetNameInput.trim(),
                            createdAt: Date.now(),
                            settings: { ...settings },
                          });
                          setPresetNameInput('');
                          setShowPresetSave(false);
                          onRefreshPresets();
                        }}
                        className="btn !min-h-[40px] !px-4 !text-xs"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPresetSave(false)}
                        className="btn ghost !min-h-[40px] !px-3 !text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowPresetSave(true)}
                      className="btn ghost !min-h-[44px] !px-4 !text-xs mt-2"
                    >
                      + Save Current as Preset
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

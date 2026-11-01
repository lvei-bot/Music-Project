/**
 * Mode B: No-Instrument Quiz Component
 * Setup, active quiz with typed input + musical toolbar or multiple choice,
 * hints, per-question timers, immediate feedback, scoring, full review,
 * and practice-selected follow-up.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  HelpCircle,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  Clock,
  Sparkles,
  Filter,
  CheckSquare,
  Square,
  Save,
  X,
} from 'lucide-react';
import {
  ScaleType,
  ChordTypeFilter,
  TONICS_BY_PITCH_CLASS,
  formatScaleName,
} from '../theory/musicEngine';
import {
  QuizQuestion,
  QuestionDirection,
  AnswerMode,
  createQuizQuestion,
  gradeQuizAnswer,
  QuizGradingResult,
} from '../engine/quizEngine';
import { MusicalToolbar } from './MusicalToolbar';
import {
  QuizAttemptRecord,
  CompletedSessionRecord,
  saveCompletedSession,
  saveActiveRecovery,
  SettingsPreset,
  savePreset,
  deletePreset,
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
  questionCountLimit: number; // 10, 20, 50, etc.
  sessionTimeMinutes: number; // e.g. 3, 5, 10
  perQuestionTimerSeconds: number; // 0 = off, 5, 10, 15, 30
  feedbackTiming: 'immediate' | 'results_only';
  feedbackStyle: 'compact' | 'expanded';
  autoAdvanceDelaySeconds: number; // 0 = manual Next
  enableHints: boolean;
  reintroduceMistakes: boolean;
  focusedReviewPool?: 'all' | 'needs_review' | 'due' | 'both';
}

export const DEFAULT_QUIZ_SETTINGS: QuizSettings = {
  direction: 'degree_to_chord',
  answerMode: 'typed',
  mcOptionCount: 4,
  enabledPitchClasses: [0], // C
  enabledScales: ['major'],
  enabledDegrees: [1, 2, 3, 4, 5, 6, 7],
  chordType: 'triads',
  ordering: 'shuffled_cycle',
  endingMode: 'question_count',
  questionCountLimit: 10,
  sessionTimeMinutes: 5,
  perQuestionTimerSeconds: 0, // off by default
  feedbackTiming: 'immediate',
  feedbackStyle: 'compact',
  autoAdvanceDelaySeconds: 0, // manual Next
  enableHints: true,
  reintroduceMistakes: false,
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
  onSessionComplete: (session: CompletedSessionRecord, attempts: QuizAttemptRecord[]) => void;
  conceptStates: Map<string, ConceptMasteryState>;
  presets: SettingsPreset[];
  onRefreshPresets: () => void;
  initialSettings?: Partial<QuizSettings>;
  overrideQuestions?: QuizQuestion[]; // For "Practice Selected"
}

export const QuizView: React.FC<QuizViewProps> = ({
  onSessionComplete,
  conceptStates,
  presets,
  onRefreshPresets,
  initialSettings,
  overrideQuestions,
}) => {
  const [settings, setSettings] = useState<QuizSettings>({
    ...DEFAULT_QUIZ_SETTINGS,
    ...initialSettings,
  });

  const [quizState, setQuizState] = useState<'setup' | 'active' | 'results'>('setup');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [typedAnswer, setTypedAnswer] = useState<string>('');
  const [selectedMCOption, setSelectedMCOption] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<QuizGradingResult | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [usedHintThisQuestion, setUsedHintThisQuestion] = useState<boolean>(false);
  const [showHintText, setShowHintText] = useState<boolean>(false);

  // Per-question timer
  const [questionTimeRemaining, setQuestionTimeRemaining] = useState<number>(0);

  // Results & Tracking
  const [attempts, setAttempts] = useState<QuizAttemptRecord[]>([]);
  const [summaryItems, setSummaryItems] = useState<QuestionAttemptSummary[]>([]);
  const [resultsFilter, setResultsFilter] = useState<'all' | 'correct' | 'wrong' | 'hinted'>('all');
  const [selectedQuestionsForPractice, setSelectedQuestionsForPractice] = useState<Set<number>>(new Set());

  // Session time
  const sessionStartRef = useRef<number>(0);
  const typedInputRef = useRef<HTMLInputElement>(null);

  // Preset modal
  const [newPresetName, setNewPresetName] = useState('');
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);

  const currentQuestion: QuizQuestion | null = questions[currentIndex] || null;

  // ---------------- QUESTION GENERATION ----------------

  const generateQuestionList = (): QuizQuestion[] => {
    if (overrideQuestions && overrideQuestions.length > 0) {
      return [...overrideQuestions];
    }

    const list: QuizQuestion[] = [];
    const count = settings.endingMode === 'question_count' ? settings.questionCountLimit : 20;

    const availableTonics = settings.enabledPitchClasses.map(pc => TONICS_BY_PITCH_CLASS[pc]?.major || 'C');
    const availableScales = settings.enabledScales;
    const availableDegrees = settings.enabledDegrees;

    for (let i = 0; i < count; i++) {
      const tonic = availableTonics[Math.floor(Math.random() * availableTonics.length)];
      const scale = availableScales[Math.floor(Math.random() * availableScales.length)];
      const degree = availableDegrees[Math.floor(Math.random() * availableDegrees.length)];
      const chordType = settings.chordType === 'both' ? (Math.random() > 0.5 ? 'triad' : 'seventh') : settings.chordType === 'sevenths' ? 'seventh' : 'triad';

      let dir: QuestionDirection = 'degree_to_chord';
      if (settings.direction === 'mixed') {
        dir = Math.random() > 0.5 ? 'degree_to_chord' : 'chord_to_degree';
      } else {
        dir = settings.direction;
      }

      const q = createQuizQuestion(tonic, scale, degree, chordType, dir, settings.answerMode, settings.mcOptionCount);
      list.push(q);
    }

    return list;
  };

  // ---------------- START QUIZ ----------------

  const handleStartQuiz = () => {
    const list = generateQuestionList();
    if (list.length === 0) {
      alert('No questions could be generated with current settings.');
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
    setAttempts([]);
    setSummaryItems([]);
    sessionStartRef.current = Date.now();

    if (settings.perQuestionTimerSeconds > 0) {
      setQuestionTimeRemaining(settings.perQuestionTimerSeconds);
    }

    setQuizState('active');
    setTimeout(() => typedInputRef.current?.focus(), 100);
  };

  // ---------------- SUBMIT ANSWER ----------------

  const handleSubmitAnswer = (answerToGrade?: string) => {
    if (isLocked || !currentQuestion) return;

    const answer = answerToGrade ?? (settings.answerMode === 'multiple_choice' ? selectedMCOption : typedAnswer) ?? '';
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
        explanation: settings.feedbackStyle === 'expanded' ? currentQuestion.expandedExplanation : currentQuestion.compactExplanation,
      },
    ]);

    // Reintroduce mistakes if option is on
    if (!result.isCorrect && settings.reintroduceMistakes) {
      setQuestions(prev => [...prev, currentQuestion]);
    }

    // Auto advance if configured
    if (settings.autoAdvanceDelaySeconds > 0) {
      setTimeout(() => {
        handleAdvanceToNext();
      }, settings.autoAdvanceDelaySeconds * 1000);
    }
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

    handleAdvanceToNext();
  };

  const handleTimeout = () => {
    if (isLocked || !currentQuestion) return;

    const attempt: QuizAttemptRecord = {
      id: `attempt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sessionId: `session_quiz_${sessionStartRef.current}`,
      conceptId: currentQuestion.conceptId,
      keyConceptId: currentQuestion.keyConceptId,
      timestamp: Date.now(),
      isCorrect: false,
      usedHint: usedHintThisQuestion,
      isSkipped: false,
      isTimeout: true,
      userAnswer: '[Timed Out]',
    };

    setAttempts(prev => [...prev, attempt]);
    setSummaryItems(prev => [
      ...prev,
      {
        question: currentQuestion,
        userAnswer: '[Timed Out]',
        isCorrect: false,
        usedHint: usedHintThisQuestion,
        isSkipped: false,
        isTimeout: true,
        explanation: currentQuestion.compactExplanation,
      },
    ]);

    handleAdvanceToNext();
  };

  const handleAdvanceToNext = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
      setTypedAnswer('');
      setSelectedMCOption(null);
      setCurrentResult(null);
      setIsLocked(false);
      setUsedHintThisQuestion(false);
      setShowHintText(false);
      if (settings.perQuestionTimerSeconds > 0) {
        setQuestionTimeRemaining(settings.perQuestionTimerSeconds);
      }
      setTimeout(() => typedInputRef.current?.focus(), 80);
    } else {
      handleFinishQuiz();
    }
  };

  const handleFinishQuiz = async () => {
    const now = Date.now();
    const durationSeconds = Math.max(1, Math.floor((now - sessionStartRef.current) / 1000));

    const total = summaryItems.length;
    const correctCount = summaryItems.filter(s => s.isCorrect).length;
    const unhintedCorrect = summaryItems.filter(s => s.isCorrect && !s.usedHint).length;
    const hintedCount = summaryItems.filter(s => s.isCorrect && s.usedHint).length;
    const wrongCount = summaryItems.filter(s => !s.isCorrect && !s.isSkipped && !s.isTimeout).length;
    const skippedCount = summaryItems.filter(s => s.isSkipped).length;
    const timeoutCount = summaryItems.filter(s => s.isTimeout).length;

    const accuracyPercent = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const independentRecallPercent = total > 0 ? Math.round((unhintedCorrect / total) * 100) : 0;

    const record: CompletedSessionRecord = {
      id: `session_quiz_${sessionStartRef.current}`,
      mode: 'quiz',
      startedAt: sessionStartRef.current,
      completedAt: now,
      activeDurationSeconds: durationSeconds,
      pausedDurationSeconds: 0,
      wallClockDurationSeconds: durationSeconds,
      settingsSnapshot: { ...settings },
      summary: {
        totalItems: total,
        correctCount,
        hintedCount,
        wrongCount,
        skippedCount,
        timeoutCount,
        accuracyPercent,
        independentRecallPercent,
      },
      excludedFromAnalytics: false,
    };

    await saveCompletedSession(record, attempts);
    await saveActiveRecovery(null);
    onSessionComplete(record, attempts);
    setQuizState('results');
  };

  // Per-question timer tick
  useEffect(() => {
    if (quizState !== 'active' || isLocked || settings.perQuestionTimerSeconds <= 0) return;

    const timer = setInterval(() => {
      setQuestionTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [quizState, isLocked, currentIndex, settings.perQuestionTimerSeconds]);

  // Keyboard shortcut listener
  useEffect(() => {
    if (quizState !== 'active') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (isLocked) {
          handleAdvanceToNext();
        } else {
          handleSubmitAnswer();
        }
      }
      // Number keys for Multiple Choice (1..6)
      if (settings.answerMode === 'multiple_choice' && !isLocked && currentQuestion?.options) {
        const num = Number(e.key);
        if (num >= 1 && num <= currentQuestion.options.length) {
          e.preventDefault();
          const option = currentQuestion.options[num - 1];
          setSelectedMCOption(option);
          handleSubmitAnswer(option);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quizState, isLocked, typedAnswer, selectedMCOption, currentIndex, questions]);

  // ---------------- SETUP VIEW ----------------
  if (quizState === 'setup') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-200">
        <div className="border-b border-[#29251F]/15 dark:border-[#EDE8E1]/15 pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#A68A55] dark:text-[#CBB07E]">
              <span>Mode B</span>
              <span>•</span>
              <span>Theory & Degree Identification</span>
            </div>
            <h1 className="font-editorial text-3xl font-bold text-[#29251F] dark:text-[#EDE8E1] mt-1">
              No-Instrument Quiz Setup
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSavePresetModal(true)}
              type="button"
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[#29251F]/20 dark:border-[#EDE8E1]/20 text-[#29251F] dark:text-[#EDE8E1] hover:bg-[#EAE5DC] dark:hover:bg-[#221F1C] flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Preset</span>
            </button>
            <button
              onClick={handleStartQuiz}
              type="button"
              className="px-5 py-2 text-xs font-bold rounded-lg bg-[#A68A55] text-white hover:bg-[#8e7443] flex items-center gap-2 shadow-xs"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Quiz</span>
            </button>
          </div>
        </div>

        {/* Presets List */}
        {presets.filter(p => p.mode === 'quiz').length > 0 && (
          <div className="p-4 rounded-xl bg-[#EAE5DC]/30 dark:bg-[#221F1C]/30 border border-[#29251F]/10 dark:border-[#EDE8E1]/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A68A55] dark:text-[#CBB07E] block mb-2">
              Saved Presets
            </span>
            <div className="flex flex-wrap gap-2">
              {presets.filter(p => p.mode === 'quiz').map(p => (
                <div key={p.id} className="inline-flex items-center gap-1 bg-[#F8F6F1] dark:bg-[#181614] border border-[#29251F]/15 dark:border-[#EDE8E1]/15 rounded-lg px-2.5 py-1 text-xs">
                  <button
                    onClick={() => setSettings({ ...DEFAULT_QUIZ_SETTINGS, ...p.settings })}
                    type="button"
                    className="font-semibold text-[#29251F] dark:text-[#EDE8E1] hover:text-[#A68A55]"
                  >
                    {p.name}
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`Delete preset "${p.name}"?`)) {
                        await deletePreset(p.id);
                        onRefreshPresets();
                      }
                    }}
                    type="button"
                    className="text-[#29251F]/40 hover:text-red-500 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Setup Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl bg-[#EAE5DC]/20 dark:bg-[#221F1C]/20 border border-[#29251F]/10 dark:border-[#EDE8E1]/10 space-y-4">
            <h3 className="font-editorial font-bold text-base text-[#29251F] dark:text-[#EDE8E1]">
              1. Question Format
            </h3>

            <div>
              <label className="text-xs font-semibold text-[#29251F]/70 dark:text-[#EDE8E1]/70 block mb-1.5">
                Question Direction
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'degree_to_chord', label: 'Degree → Chord' },
                  { id: 'chord_to_degree', label: 'Chord → Degree' },
                  { id: 'mixed', label: 'Mixed' },
                ].map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, direction: d.id as any }))}
                    className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition-all ${
                      settings.direction === d.id
                        ? 'bg-[#A68A55] text-white border-[#A68A55]'
                        : 'border-[#29251F]/15 dark:border-[#EDE8E1]/15 text-[#29251F]/70 dark:text-[#EDE8E1]/70'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#29251F]/70 dark:text-[#EDE8E1]/70 block mb-1.5">
                Answer Input Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, answerMode: 'typed' }))}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                    settings.answerMode === 'typed'
                      ? 'bg-[#29251F] dark:bg-[#EDE8E1] text-[#F8F6F1] dark:text-[#181614] border-transparent'
                      : 'border-[#29251F]/15 dark:border-[#EDE8E1]/15 text-[#29251F]/70 dark:text-[#EDE8E1]/70'
                  }`}
                >
                  Typed (with Notation Toolbar)
                </button>
                <button
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, answerMode: 'multiple_choice' }))}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                    settings.answerMode === 'multiple_choice'
                      ? 'bg-[#29251F] dark:bg-[#EDE8E1] text-[#F8F6F1] dark:text-[#181614] border-transparent'
                      : 'border-[#29251F]/15 dark:border-[#EDE8E1]/15 text-[#29251F]/70 dark:text-[#EDE8E1]/70'
                  }`}
                >
                  Multiple Choice
                </button>
              </div>
            </div>

            {settings.answerMode === 'multiple_choice' && (
              <div>
                <label className="text-xs font-semibold text-[#29251F]/70 dark:text-[#EDE8E1]/70 block mb-1">
                  Multiple Choice Options Count
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[2, 3, 4, 6].map(count => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setSettings(s => ({ ...s, mcOptionCount: count as any }))}
                      className={`py-1 text-xs font-bold rounded-lg border ${
                        settings.mcOptionCount === count
                          ? 'bg-[#A68A55] text-white border-[#A68A55]'
                          : 'border-[#29251F]/15 text-[#29251F]/70 dark:text-[#EDE8E1]/70'
                      }`}
                    >
                      {count} Choices
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-5 rounded-2xl bg-[#EAE5DC]/20 dark:bg-[#221F1C]/20 border border-[#29251F]/10 dark:border-[#EDE8E1]/10 space-y-4">
            <h3 className="font-editorial font-bold text-base text-[#29251F] dark:text-[#EDE8E1]">
              2. Session Scope & Ending
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Ending Mode</label>
                <select
                  value={settings.endingMode}
                  onChange={e => setSettings(s => ({ ...s, endingMode: e.target.value as any }))}
                  className="w-full text-xs font-semibold p-2 rounded-lg bg-[#F8F6F1] dark:bg-[#181614] border border-[#29251F]/15"
                >
                  <option value="question_count">Question Count Limit</option>
                  <option value="unlimited">Unlimited / Manual</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Question Count</label>
                <select
                  disabled={settings.endingMode !== 'question_count'}
                  value={settings.questionCountLimit}
                  onChange={e => setSettings(s => ({ ...s, questionCountLimit: Number(e.target.value) }))}
                  className="w-full text-xs font-semibold p-2 rounded-lg bg-[#F8F6F1] dark:bg-[#181614] border border-[#29251F]/15 disabled:opacity-40"
                >
                  <option value={10}>10 Questions</option>
                  <option value={20}>20 Questions</option>
                  <option value={50}>50 Questions</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Per-Question Timer</label>
                <select
                  value={settings.perQuestionTimerSeconds}
                  onChange={e => setSettings(s => ({ ...s, perQuestionTimerSeconds: Number(e.target.value) }))}
                  className="w-full text-xs font-semibold p-2 rounded-lg bg-[#F8F6F1] dark:bg-[#181614] border border-[#29251F]/15"
                >
                  <option value={0}>Off (Untimed)</option>
                  <option value={5}>5 seconds</option>
                  <option value={10}>10 seconds</option>
                  <option value={15}>15 seconds</option>
                  <option value={30}>30 seconds</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Feedback Style</label>
                <select
                  value={settings.feedbackStyle}
                  onChange={e => setSettings(s => ({ ...s, feedbackStyle: e.target.value as any }))}
                  className="w-full text-xs font-semibold p-2 rounded-lg bg-[#F8F6F1] dark:bg-[#181614] border border-[#29251F]/15"
                >
                  <option value="compact">Compact (Chord + Notes)</option>
                  <option value="expanded">Expanded (Full Derivation)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#29251F]/80 dark:text-[#EDE8E1]/80">
                <input
                  type="checkbox"
                  checked={settings.enableHints}
                  onChange={e => setSettings(s => ({ ...s, enableHints: e.target.checked }))}
                  className="rounded border-[#29251F]/20 text-[#A68A55]"
                />
                <span>Enable Hints (Record hint usage without giving away answers)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#29251F]/80 dark:text-[#EDE8E1]/80">
                <input
                  type="checkbox"
                  checked={settings.reintroduceMistakes}
                  onChange={e => setSettings(s => ({ ...s, reintroduceMistakes: e.target.checked }))}
                  className="rounded border-[#29251F]/20 text-[#A68A55]"
                />
                <span>Reintroduce Mistakes at end of quiz</span>
              </label>
            </div>
          </div>
        </div>

        {/* Save Preset Modal */}
        {showSavePresetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-xl bg-[#F8F6F1] dark:bg-[#181614] border border-[#29251F]/20 dark:border-[#EDE8E1]/20 p-5 shadow-2xl space-y-4">
              <h3 className="font-editorial font-bold text-base text-[#29251F] dark:text-[#EDE8E1]">
                Save Current Quiz Settings
              </h3>
              <input
                type="text"
                placeholder="e.g. 10 Q Typed Triads"
                value={newPresetName}
                onChange={e => setNewPresetName(e.target.value)}
                className="w-full text-xs font-semibold p-2 rounded-lg bg-[#EAE5DC]/50 dark:bg-[#221F1C]/50 border border-[#29251F]/20 outline-hidden"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSavePresetModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md border border-[#29251F]/20"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!newPresetName.trim()) return;
                    await savePreset({
                      id: `preset_quiz_${Date.now()}`,
                      mode: 'quiz',
                      name: newPresetName.trim(),
                      settings: { ...settings },
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                    });
                    onRefreshPresets();
                    setShowSavePresetModal(false);
                    setNewPresetName('');
                  }}
                  className="px-4 py-1.5 text-xs font-bold rounded-md bg-[#A68A55] text-white"
                >
                  Save Preset
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------- ACTIVE QUIZ VIEW ----------------
  if (quizState === 'active' && currentQuestion) {
    const questionNum = currentIndex + 1;
    const totalQuestions = questions.length;

    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-150">
        {/* Top Progress & Stats Strip */}
        <div className="flex items-center justify-between text-xs font-semibold text-[#29251F]/70 dark:text-[#EDE8E1]/70 border-b border-[#29251F]/10 dark:border-[#EDE8E1]/10 pb-3">
          <span>
            Question {questionNum} of {totalQuestions}
          </span>
          <div className="flex items-center gap-3">
            {settings.perQuestionTimerSeconds > 0 && (
              <span className={`font-mono flex items-center gap-1 ${questionTimeRemaining <= 3 ? 'text-red-500 font-bold animate-pulse' : ''}`}>
                <Clock className="w-3.5 h-3.5" />
                {questionTimeRemaining}s
              </span>
            )}
            <button
              onClick={handleSkip}
              type="button"
              className="hover:text-[#A68A55] transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleFinishQuiz}
              type="button"
              className="text-red-500 hover:underline"
            >
              End Quiz
            </button>
          </div>
        </div>

        {/* Question Card */}
        <div className="p-6 sm:p-10 rounded-2xl bg-[#EAE5DC]/30 dark:bg-[#221F1C]/30 border border-[#29251F]/15 dark:border-[#EDE8E1]/15 text-center space-y-4">
          <span className="text-xs uppercase font-bold tracking-widest text-[#A68A55] dark:text-[#CBB07E]">
            {currentQuestion.prompt.title}
          </span>

          <div className="space-y-1">
            <h2 className="font-editorial text-4xl sm:text-6xl font-bold tracking-tight text-[#29251F] dark:text-[#EDE8E1]">
              {currentQuestion.prompt.primaryText}
            </h2>
            <p className="text-sm font-semibold text-[#29251F]/60 dark:text-[#EDE8E1]/60">
              {currentQuestion.prompt.subText}
            </p>
          </div>

          {/* Hint Section */}
          {settings.enableHints && (
            <div className="pt-2">
              {!showHintText ? (
                <button
                  onClick={() => {
                    setShowHintText(true);
                    setUsedHintThisQuestion(true);
                  }}
                  type="button"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A68A55] hover:underline"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>Show Reasoning Hint</span>
                </button>
              ) : (
                <p className="text-xs p-2.5 rounded-lg bg-[#A68A55]/10 text-[#A68A55] dark:text-[#CBB07E] font-medium max-w-md mx-auto animate-in fade-in">
                  💡 Hint: {currentQuestion.hint}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="space-y-3">
          {settings.answerMode === 'typed' ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  ref={typedInputRef}
                  type="text"
                  disabled={isLocked}
                  placeholder={currentQuestion.direction === 'degree_to_chord' ? 'e.g. Cmaj, Dm, Bdim' : 'e.g. 1, 2, IV'}
                  value={typedAnswer}
                  onChange={e => setTypedAnswer(e.target.value)}
                  className="flex-1 text-base font-semibold p-3 rounded-xl bg-[#F8F6F1] dark:bg-[#181614] border border-[#29251F]/20 dark:border-[#EDE8E1]/20 text-[#29251F] dark:text-[#EDE8E1] outline-hidden focus:border-[#A68A55] shadow-xs"
                />
                {!isLocked ? (
                  <button
                    onClick={() => handleSubmitAnswer()}
                    type="button"
                    className="px-6 text-xs font-bold rounded-xl bg-[#29251F] dark:bg-[#EDE8E1] text-[#F8F6F1] dark:text-[#181614] hover:bg-black dark:hover:bg-white transition-colors"
                  >
                    Submit
                  </button>
                ) : (
                  <button
                    onClick={handleAdvanceToNext}
                    type="button"
                    className="px-6 text-xs font-bold rounded-xl bg-[#A68A55] text-white hover:bg-[#8e7443] transition-colors flex items-center gap-1"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* On-screen musical notation toolbar */}
              <MusicalToolbar
                inputRef={typedInputRef}
                mode={currentQuestion.direction === 'degree_to_chord' ? 'chord' : 'degree'}
                value={typedAnswer}
                onChange={setTypedAnswer}
                disabled={isLocked}
              />
            </div>
          ) : (
            // Multiple Choice Grid
            <div className="grid grid-cols-2 gap-3">
              {currentQuestion.options?.map((opt, idx) => {
                const isSelected = selectedMCOption === opt;
                let btnStyle = 'bg-[#F8F6F1] dark:bg-[#181614] border-[#29251F]/20 dark:border-[#EDE8E1]/20 text-[#29251F] dark:text-[#EDE8E1]';
                if (isLocked) {
                  if (opt === currentQuestion.correctAnswerText) {
                    btnStyle = 'bg-[#2D7A4D] text-white border-[#2D7A4D]';
                  } else if (isSelected && !currentResult?.isCorrect) {
                    btnStyle = 'bg-red-600 text-white border-red-600';
                  }
                } else if (isSelected) {
                  btnStyle = 'border-[#A68A55] ring-2 ring-[#A68A55]';
                }

                return (
                  <button
                    key={opt}
                    disabled={isLocked}
                    type="button"
                    onClick={() => {
                      setSelectedMCOption(opt);
                      handleSubmitAnswer(opt);
                    }}
                    className={`p-4 rounded-xl border text-sm sm:text-base font-bold text-center transition-all ${btnStyle}`}
                  >
                    <span className="text-[10px] text-[#29251F]/40 dark:text-[#EDE8E1]/40 mr-1.5 font-normal">
                      [{idx + 1}]
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {/* Locked Result Feedback */}
          {isLocked && currentResult && (
            <div
              className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200 ${
                currentResult.isCorrect
                  ? 'bg-[#2D7A4D]/10 dark:bg-[#48A66C]/10 border-[#2D7A4D]/30 dark:border-[#48A66C]/30 text-[#2D7A4D] dark:text-[#48A66C]'
                  : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
              }`}
            >
              <div className="flex items-start gap-3">
                {currentResult.isCorrect ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="font-bold text-sm">{currentResult.feedbackMessage}</h4>
                  <p className="text-xs text-[#29251F]/70 dark:text-[#EDE8E1]/70 mt-1">
                    {settings.feedbackStyle === 'expanded'
                      ? currentQuestion.expandedExplanation
                      : currentQuestion.compactExplanation}
                  </p>
                </div>
              </div>

              {settings.answerMode === 'multiple_choice' && (
                <button
                  onClick={handleAdvanceToNext}
                  type="button"
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-[#29251F] dark:bg-[#EDE8E1] text-[#F8F6F1] dark:text-[#181614] self-end sm:self-auto shrink-0 flex items-center gap-1.5"
                >
                  <span>Next Question</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------- RESULTS VIEW ----------------
  const total = summaryItems.length;
  const correctCount = summaryItems.filter(s => s.isCorrect).length;
  const unhintedCorrect = summaryItems.filter(s => s.isCorrect && !s.usedHint).length;
  const hintedCount = summaryItems.filter(s => s.isCorrect && s.usedHint).length;
  const wrongCount = summaryItems.filter(s => !s.isCorrect && !s.isSkipped && !s.isTimeout).length;
  const skippedCount = summaryItems.filter(s => s.isSkipped).length;
  const timeoutCount = summaryItems.filter(s => s.isTimeout).length;
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const recall = total > 0 ? Math.round((unhintedCorrect / total) * 100) : 0;

  const filteredItems = summaryItems.filter(item => {
    if (resultsFilter === 'correct') return item.isCorrect;
    if (resultsFilter === 'wrong') return !item.isCorrect;
    if (resultsFilter === 'hinted') return item.usedHint;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-200">
      <div className="text-center space-y-2 border-b border-[#29251F]/15 dark:border-[#EDE8E1]/15 pb-6">
        <span className="text-xs uppercase font-bold tracking-widest text-[#A68A55] dark:text-[#CBB07E]">
          Quiz Session Complete
        </span>
        <h1 className="font-editorial text-4xl font-bold text-[#29251F] dark:text-[#EDE8E1]">
          Results & Performance
        </h1>
        <p className="text-xs sm:text-sm text-[#29251F]/70 dark:text-[#EDE8E1]/70">
          Diatonic identification summary. Weak concepts have been recorded for spaced review.
        </p>
      </div>

      {/* Main Score Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#EAE5DC]/30 dark:bg-[#221F1C]/30 border border-[#29251F]/10 dark:border-[#EDE8E1]/10 text-center">
          <span className="text-[10px] font-bold uppercase text-[#29251F]/60 dark:text-[#EDE8E1]/60 block mb-1">
            Overall Accuracy
          </span>
          <span className="font-editorial text-3xl font-bold text-[#29251F] dark:text-[#EDE8E1]">
            {accuracy}%
          </span>
          <span className="text-[10px] text-[#29251F]/50 block mt-1">
            {correctCount} / {total} Total
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#EAE5DC]/30 dark:bg-[#221F1C]/30 border border-[#29251F]/10 dark:border-[#EDE8E1]/10 text-center">
          <span className="text-[10px] font-bold uppercase text-[#A68A55] dark:text-[#CBB07E] block mb-1">
            Independent Recall
          </span>
          <span className="font-editorial text-3xl font-bold text-[#A68A55] dark:text-[#CBB07E]">
            {recall}%
          </span>
          <span className="text-[10px] text-[#29251F]/50 block mt-1">
            {unhintedCorrect} Unhinted
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#EAE5DC]/30 dark:bg-[#221F1C]/30 border border-[#29251F]/10 dark:border-[#EDE8E1]/10 text-center">
          <span className="text-[10px] font-bold uppercase text-[#B85D19] dark:text-[#D47732] block mb-1">
            Incorrect / Missed
          </span>
          <span className="font-editorial text-3xl font-bold text-[#B85D19] dark:text-[#D47732]">
            {wrongCount}
          </span>
          <span className="text-[10px] text-[#29251F]/50 block mt-1">
            {skippedCount} Skipped • {timeoutCount} Timeout
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#EAE5DC]/30 dark:bg-[#221F1C]/30 border border-[#29251F]/10 dark:border-[#EDE8E1]/10 text-center">
          <span className="text-[10px] font-bold uppercase text-[#29251F]/60 dark:text-[#EDE8E1]/60 block mb-1">
            Hint Assisted
          </span>
          <span className="font-editorial text-3xl font-bold text-[#29251F] dark:text-[#EDE8E1]">
            {hintedCount}
          </span>
          <span className="text-[10px] text-[#29251F]/50 block mt-1">
            Counts toward accuracy
          </span>
        </div>
      </div>

      {/* Review & Practice Selected Controls */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#A68A55]" />
            <span className="text-xs font-bold text-[#29251F] dark:text-[#EDE8E1]">Filter Questions:</span>
            {(['all', 'correct', 'wrong', 'hinted'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setResultsFilter(f)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${
                  resultsFilter === f
                    ? 'bg-[#29251F] dark:bg-[#EDE8E1] text-[#F8F6F1] dark:text-[#181614] border-transparent'
                    : 'border-[#29251F]/15 text-[#29251F]/70 dark:text-[#EDE8E1]/70'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // Select all wrong questions
                const wrongIndices = new Set(
                  summaryItems.map((item, idx) => (!item.isCorrect ? idx : -1)).filter(idx => idx !== -1)
                );
                setSelectedQuestionsForPractice(wrongIndices);
              }}
              type="button"
              className="text-xs font-bold text-[#A68A55] hover:underline"
            >
              Select All Mistakes
            </button>
            <button
              onClick={() => {
                if (selectedQuestionsForPractice.size === 0) {
                  alert('Please select at least one question to practice.');
                  return;
                }
                const practiceSet = Array.from(selectedQuestionsForPractice).map(idx => summaryItems[idx].question);
                setQuestions(practiceSet);
                setCurrentIndex(0);
                setAttempts([]);
                setSummaryItems([]);
                setQuizState('active');
              }}
              type="button"
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#A68A55] text-white hover:bg-[#8e7443]"
            >
              Practice Selected ({selectedQuestionsForPractice.size})
            </button>
          </div>
        </div>

        {/* Question Review List */}
        <div className="space-y-2">
          {filteredItems.map((item, idx) => {
            const isSelected = selectedQuestionsForPractice.has(idx);
            return (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border transition-all ${
                  item.isCorrect
                    ? 'bg-[#2D7A4D]/5 border-[#2D7A4D]/20'
                    : 'bg-red-500/5 border-red-500/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedQuestionsForPractice(prev => {
                          const next = new Set(prev);
                          if (next.has(idx)) next.delete(idx);
                          else next.add(idx);
                          return next;
                        });
                      }}
                      className="mt-0.5 text-[#29251F]/40 dark:text-[#EDE8E1]/40 hover:text-[#A68A55]"
                      aria-label="Select question for practice"
                    >
                      {isSelected ? <CheckSquare className="w-4 h-4 text-[#A68A55]" /> : <Square className="w-4 h-4" />}
                    </button>
                    <div>
                      <div className="text-xs font-bold text-[#29251F] dark:text-[#EDE8E1]">
                        {item.question.prompt.primaryText} ({item.question.prompt.subText})
                      </div>
                      <div className="text-xs text-[#29251F]/70 dark:text-[#EDE8E1]/70 mt-1">
                        Given: <strong className={item.isCorrect ? 'text-[#2D7A4D]' : 'text-red-500'}>{item.userAnswer}</strong> • Correct: <strong>{item.question.correctAnswerText}</strong>
                        {item.usedHint && <span className="ml-2 text-[10px] text-[#A68A55] font-semibold">(Hint Used)</span>}
                      </div>
                      <p className="text-[11px] text-[#29251F]/60 dark:text-[#EDE8E1]/60 mt-1 leading-relaxed">
                        {item.explanation}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-4 flex justify-center">
        <button
          onClick={() => setQuizState('setup')}
          type="button"
          className="px-6 py-2.5 text-xs font-bold rounded-lg bg-[#29251F] dark:bg-[#EDE8E1] text-[#F8F6F1] dark:text-[#181614] hover:bg-black dark:hover:bg-white transition-colors"
        >
          New Quiz Session
        </button>
      </div>
    </div>
  );
};

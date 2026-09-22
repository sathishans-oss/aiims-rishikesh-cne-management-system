import React, { useState, useEffect } from 'react';
import {
  Award,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { Cne } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import { api } from '../../services/api';

export interface PostTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  cne: Cne | null;
  onTestSubmitted: () => void;
  onShowToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const PostTestModal: React.FC<PostTestModalProps> = ({
  isOpen,
  onClose,
  cne,
  onTestSubmitted,
  onShowToast
}) => {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [existingAttempt, setExistingAttempt] = useState<any | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  useEffect(() => {
    if (!isOpen || !cne) return;
    loadTest();
  }, [isOpen, cne?.id]);

  const loadTest = async () => {
    if (!cne) return;
    setLoading(true);
    setTestResult(null);
    setAnswers({});
    setCurrentIndex(0);
    try {
      const data = await api.getPostTest(cne.id);
      setQuestions(data.questions || []);
      if (data.attempt) {
        setExistingAttempt(data.attempt);
        setTestResult(data.attempt);
      } else {
        setExistingAttempt(null);
      }
    } catch (err: any) {
      onShowToast('error', err.message || 'Failed to load post-test');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (questionId: string, opt: string) => {
    if (testResult) return; // Locked if submitted
    setAnswers((prev) => ({ ...prev, [questionId]: opt }));
  };

  const handleSubmit = async () => {
    if (!cne) return;
    const answeredCount = Object.keys(answers).length;
    if (answeredCount < questions.length) {
      if (!confirm(`You have answered ${answeredCount} of ${questions.length} questions. Do you want to submit now?`)) {
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await api.submitPostTest(cne.id, answers);
      setTestResult(res);
      onShowToast('success', `Post-test evaluated: ${res.percentage}% (${res.passed ? 'PASSED' : 'RETEST REQUIRED'})`);
      onTestSubmitted();
    } catch (err: any) {
      onShowToast('error', err.message || 'Failed to submit test');
    } finally {
      setSubmitting(false);
    }
  };

  if (!cne) return null;

  const currentQ = questions[currentIndex];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title={
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-emerald-700" />
          <span>Post-Test Evaluation: {cne.title}</span>
        </div>
      }
      subtitle={`Session ID: ${cne.cne_id} • Passing Standard: 60%`}
    >
      {loading ? (
        <div className="py-12 text-center text-slate-500 text-sm">
          Loading evaluation questions...
        </div>
      ) : questions.length === 0 ? (
        <EmptyState
          title="No post-test questions configured"
          description="The faculty or incharge has not yet configured or generated post-test questions for this CNE."
        />
      ) : testResult ? (
        /* ==================== TEST RESULT SUMMARY ==================== */
        <div className="space-y-6 py-2">
          <div
            className={`p-6 rounded-2xl border text-center ${
              testResult.passed
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-rose-50 border-rose-200 text-rose-950'
            }`}
          >
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-3 bg-white shadow-xs">
              {testResult.passed ? (
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              ) : (
                <XCircle className="w-10 h-10 text-rose-600" />
              )}
            </div>
            <h3 className="text-xl font-extrabold tracking-tight">
              {testResult.passed ? 'Congratulations! You Passed' : 'Retest Required'}
            </h3>
            <p className="text-xs mt-1 text-slate-600">
              Institutional CNE Competency Standard: Minimum 60%
            </p>

            <div className="mt-4 flex items-center justify-center gap-6 text-sm font-semibold">
              <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs text-slate-400 block font-normal">Score</span>
                <span className="text-lg text-slate-900">{testResult.score} / {testResult.max_score}</span>
              </div>
              <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs text-slate-400 block font-normal">Percentage</span>
                <span className="text-lg text-slate-900">{testResult.percentage}%</span>
              </div>
              <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs text-slate-400 block font-normal">Status</span>
                <span className={`text-lg ${testResult.passed ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {testResult.passed ? 'PASSED' : 'FAILED'}
                </span>
              </div>
            </div>
          </div>

          {/* Question Breakdown with Rationales if available */}
          {testResult.review && testResult.review.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                Question Review & Clinical Rationales
              </h4>
              <div className="space-y-3">
                {testResult.review.map((item: any, idx: number) => (
                  <div
                    key={item.question_id}
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                      item.is_correct ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50/40 border-rose-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-slate-900">
                        Q{idx + 1}. {item.question_text}
                      </span>
                      {item.is_correct ? (
                        <span className="text-emerald-700 font-bold shrink-0">Correct</span>
                      ) : (
                        <span className="text-rose-700 font-bold shrink-0">Incorrect</span>
                      )}
                    </div>
                    <div className="text-slate-600">
                      Your answer: <strong>Option {item.submitted_option || 'None'}</strong> • Correct answer: <strong className="text-emerald-800">Option {item.correct_option}</strong>
                    </div>
                    {item.explanation && (
                      <div className="text-[11px] text-slate-500 bg-white/80 p-2 rounded border border-slate-200/60">
                        <strong>Clinical Rationale:</strong> {item.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="primary" size="md" onClick={onClose}>
              Close Evaluation
            </Button>
          </div>
        </div>
      ) : (
        /* ==================== ACTIVE POST-TEST EXAMINATION ==================== */
        <div className="space-y-5">
          {/* Progress Tracker */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-xs text-slate-500">
            <span>
              Question <strong className="text-slate-900">{currentIndex + 1}</strong> of <strong className="text-slate-900">{questions.length}</strong>
            </span>
            <div className="flex items-center gap-1.5">
              <span>Answered: {Object.keys(answers).length} / {questions.length}</span>
            </div>
          </div>

          {/* Current Question */}
          {currentQ && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 leading-snug">
                {currentIndex + 1}. {currentQ.question_text}
              </h3>

              <div className="space-y-2">
                {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                  const optText = currentQ[`option_${optKey.toLowerCase()}`];
                  const isSelected = answers[currentQ.id] === optKey;

                  return (
                    <div
                      key={optKey}
                      onClick={() => handleSelectOption(currentQ.id, optKey)}
                      className={`p-3 rounded-xl border text-xs flex items-center gap-3 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-950 font-semibold shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center font-mono text-[11px] shrink-0 ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-300 text-slate-500'
                        }`}
                      >
                        {optKey}
                      </div>
                      <span className="flex-1">{optText}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation and Submit Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex(currentIndex - 1)}
              icon={<ArrowLeft className="w-3.5 h-3.5" />}
            >
              Previous
            </Button>

            <div className="flex items-center gap-2">
              {currentIndex < questions.length - 1 ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setCurrentIndex(currentIndex + 1)}
                  icon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  Next Question
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  loading={submitting}
                  onClick={handleSubmit}
                  className="bg-emerald-800 hover:bg-emerald-900 font-semibold"
                >
                  Submit Examination
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

import { AuthenticatedUser } from '../types';
import { generateRandomToken } from '../utils/crypto';
import { logAuditAction } from './auditService';
import { enqueueBackup } from './backupService';

async function requirePostTestEligibility(db: D1Database, user: AuthenticatedUser, cneId: string): Promise<any> {
  const cne = await db.prepare(`SELECT id, cne_id, title, status FROM cnes WHERE id = ? OR cne_id = ?`)
    .bind(cneId, cneId).first<any>();
  if (!cne) throw new Error('CNE not found.');
  if (cne.status === 'Canceled') throw new Error('Post-test is unavailable because this CNE has been canceled.');

  if (!user.roles.includes('ADMIN') && !user.roles.includes('AREA_INCHARGE')) {
    const attendance = await db.prepare(`SELECT id FROM cne_attendance WHERE cne_id = ? AND employee_id = ?`)
      .bind(cne.id, user.employee_id).first<any>();
    if (!attendance) throw new Error('Attendance required: verified attendance is required before accessing the post-test.');
  }
  return cne;
}

export async function getPostTestForEmployee(db: D1Database, user: AuthenticatedUser, cneId: string): Promise<any> {
  const cne = await requirePostTestEligibility(db, user, cneId);
  const attempt = await db.prepare(`SELECT * FROM post_test_attempts WHERE cne_id = ? AND employee_id = ?`)
    .bind(cne.id, user.employee_id).first<any>();

  if (attempt) {
    const fullQuestions = await db.prepare(`
      SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, order_num
      FROM cne_questions WHERE cne_id = ? ORDER BY order_num ASC, created_at ASC
    `).bind(cne.id).all<any>();
    const userAnswers = await db.prepare(`SELECT question_id, selected_option, is_correct FROM post_test_answers WHERE attempt_id = ?`)
      .bind(attempt.id).all<any>();
    const answerMap = new Map((userAnswers.results || []).map((a: any) => [a.question_id, a]));
    const review = (fullQuestions.results || []).map((q: any) => {
      const a: any = answerMap.get(q.id);
      return {
        question_id: q.id,
        question_text: q.question_text,
        submitted_option: a?.selected_option || '',
        selected_option: a?.selected_option || '',
        is_correct: Boolean(a?.is_correct),
        correct_option: q.correct_option,
        explanation: q.explanation
      };
    });
    const normalizedAttempt = { ...attempt, passed: Boolean(attempt.passed), review, answers: userAnswers.results || [] };
    return {
      cne,
      questions: fullQuestions.results || [],
      already_attempted: true,
      attempt: normalizedAttempt,
      previous_attempt: normalizedAttempt,
      review
    };
  }

  // Never expose answer keys before submission.
  const safeQuestions = await db.prepare(`
    SELECT id, question_text, option_a, option_b, option_c, option_d, order_num
    FROM cne_questions WHERE cne_id = ? ORDER BY order_num ASC, created_at ASC
  `).bind(cne.id).all<any>();

  return { cne, questions: safeQuestions.results || [], already_attempted: false, attempt: null };
}

export async function submitPostTest(
  db: D1Database,
  user: AuthenticatedUser,
  cneId: string,
  answers: Record<string, string>
): Promise<any> {
  const cne = await requirePostTestEligibility(db, user, cneId);

  const existingAttempt = await db.prepare(`SELECT id FROM post_test_attempts WHERE cne_id = ? AND employee_id = ?`)
    .bind(cne.id, user.employee_id).first<any>();
  if (existingAttempt) throw new Error('You have already completed the post-test for this CNE.');

  const questions = await db.prepare(`
    SELECT id, correct_option, explanation, question_text
    FROM cne_questions WHERE cne_id = ? ORDER BY order_num ASC, created_at ASC
  `).bind(cne.id).all<any>();
  const qList = questions.results || [];
  if (!qList.length) throw new Error('No post-test questions are configured for this CNE.');

  let correctCount = 0;
  const review: any[] = [];
  for (const q of qList) {
    const selected = String(answers[q.id] || '').trim().toUpperCase();
    if (selected && !['A', 'B', 'C', 'D'].includes(selected)) throw new Error('One or more submitted answers are invalid.');
    const isCorrect = selected === q.correct_option;
    if (isCorrect) correctCount += 1;
    review.push({
      question_id: q.id,
      question_text: q.question_text,
      submitted_option: selected,
      selected_option: selected,
      is_correct: isCorrect,
      correct_option: q.correct_option,
      explanation: q.explanation || 'Refer to the approved CNE learning material.'
    });
  }

  const maxScore = qList.length;
  const percentage = Math.round((correctCount / maxScore) * 1000) / 10;
  const passed = percentage >= 60;
  const attemptId = 'ATTMPT_' + generateRandomToken(10);

  const statements: D1PreparedStatement[] = [
    db.prepare(`
      INSERT INTO post_test_attempts (id, cne_id, employee_id, score, max_score, percentage, passed, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(attemptId, cne.id, user.employee_id, correctCount, maxScore, percentage, passed ? 1 : 0)
  ];
  for (const item of review) {
    statements.push(db.prepare(`
      INSERT INTO post_test_answers (id, attempt_id, question_id, selected_option, is_correct)
      VALUES (?, ?, ?, ?, ?)
    `).bind('ANS_' + generateRandomToken(10), attemptId, item.question_id, item.submitted_option, item.is_correct ? 1 : 0));
  }

  // D1 batch executes atomically; partial attempts cannot remain if one answer insert fails.
  await db.batch(statements);

  await logAuditAction(db, user.employee_id, 'POST_TEST_SUBMITTED', 'POST_TEST', attemptId, {
    cneId: cne.cne_id, score: correctCount, maxScore, percentage, passed
  });
  await enqueueBackup(db, 'post_test_attempts', attemptId, 'INSERT', {
    id: attemptId, cne_id: cne.id, employee_id: user.employee_id, score: correctCount,
    max_score: maxScore, percentage, passed: passed ? 1 : 0
  });

  return {
    id: attemptId,
    attempt_id: attemptId,
    cne_id: cne.id,
    employee_id: user.employee_id,
    score: correctCount,
    max_score: maxScore,
    percentage,
    passed,
    submitted_at: new Date().toISOString(),
    review,
    results: review,
    message: passed
      ? 'Congratulations! You have passed the post-test competency benchmark.'
      : 'Post-test submitted. The benchmark pass percentage is 60%.'
  };
}

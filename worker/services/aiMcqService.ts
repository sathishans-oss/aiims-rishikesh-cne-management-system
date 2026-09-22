import { Env } from '../types';
import { generateRandomToken } from '../utils/crypto';
import { logAuditAction } from './auditService';
import { enqueueBackup } from './backupService';

export const APPROVED_MODELS = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash'];
export const DEFAULT_MODEL = 'gemini-3.8-flash';

export function getApprovedModel(env: Env): string {
  const configured = (env.GEMINI_MODEL || DEFAULT_MODEL).trim();
  if (!APPROVED_MODELS.includes(configured)) {
    throw new Error(`GEMINI_MODEL '${configured}' is not in the approved model allowlist.`);
  }
  return configured;
}

export interface GeneratedMcq {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  source_reference?: string;
}

export async function pingGemini(env: Env): Promise<{ status: string; model: string; response: string }> {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }

  const model = getApprovedModel(env);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: 'Respond with exactly: "AIIMS Rishikesh CNE AI service online."' }]
      }]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API returned HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
  }

  const data: any = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'No response text';

  return {
    status: 'connected',
    model,
    response: text
  };
}

export async function generateAiMcqsForCne(
  db: D1Database,
  env: Env,
  cneId: string,
  adminEmployeeId: string
): Promise<{ success: boolean; questionsCount: number; model: string }> {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const model = getApprovedModel(env);

  // 1. Verify CNE exists
  const cne = await db.prepare(`
    SELECT c.*, a.name as area_name
    FROM cnes c
    JOIN areas a ON c.area_id = a.id
    WHERE c.id = ? OR c.cne_id = ?
  `).bind(cneId, cneId).first<any>();

  if (!cne) {
    throw new Error('CNE record not found.');
  }

  // 2. Atomic generation state transition in D1: strictly lock to IN_PROGRESS
  // Ensure base state row exists
  await db.prepare(`
    INSERT OR IGNORE INTO ai_generation_state (cne_id, status, model_used, updated_at)
    VALUES (?, 'NOT_USED', ?, datetime('now'))
  `).bind(cne.id, model).run();

  // Atomically claim lock: only transitions if status is NOT_USED or FAILED
  const claimResult = await db.prepare(`
    UPDATE ai_generation_state
    SET status = 'IN_PROGRESS',
        model_used = ?,
        updated_at = datetime('now')
    WHERE cne_id = ? AND status IN ('NOT_USED', 'FAILED')
  `).bind(model, cne.id).run();

  const rowsChanged = claimResult.meta?.changes ?? (claimResult as any).changes ?? 0;
  if (rowsChanged === 0) {
    const currentState = await db.prepare(`
      SELECT status FROM ai_generation_state WHERE cne_id = ?
    `).bind(cne.id).first<any>();

    if (currentState?.status === 'GENERATED') {
      throw new Error('AI questions have already been generated for this CNE. The institutional rule permits exactly one AI generation per CNE.');
    }
    if (currentState?.status === 'IN_PROGRESS') {
      throw new Error('AI generation is already in progress for this CNE.');
    }
    throw new Error('AI generation cannot proceed in current state.');
  }

  // 3. Evidence retrieval hierarchy from D1
  let evidenceText = '';
  let evidenceSource = 'NONE';

  // Primary: CNE-specific chunks
  const cneChunks = await db.prepare(`
    SELECT content FROM library_chunks WHERE cne_id = ? ORDER BY chunk_index ASC LIMIT 5
  `).bind(cne.id).all<any>();

  if (cneChunks.results && cneChunks.results.length > 0) {
    evidenceText = cneChunks.results.map((r: any) => r.content).join('\n\n');
    evidenceSource = 'CNE_SPECIFIC';
  } else {
    // Secondary fallback: Library documents matching CNE category/title
    const libChunks = await db.prepare(`
      SELECT lc.content FROM library_chunks lc
      JOIN library_documents ld ON lc.document_id = ld.id
      WHERE ld.active = 1 AND (ld.category = ? OR ld.title LIKE ?)
      ORDER BY lc.chunk_index ASC LIMIT 4
    `).bind(cne.category, `%${cne.category}%`).all<any>();

    if (libChunks.results && libChunks.results.length > 0) {
      evidenceText = libChunks.results.map((r: any) => r.content).join('\n\n');
      evidenceSource = 'LIBRARY_FALLBACK';
    }
  }

  // Hierarchy Step 3: Inadequate material check - must stop and ask for suitable material
  if (!evidenceText || evidenceText.trim().length < 50) {
    // Release the lock back to NOT_USED so user can upload materials and retry
    await db.prepare(`
      UPDATE ai_generation_state
      SET status = 'NOT_USED',
          error_message = 'Inadequate clinical learning material',
          updated_at = datetime('now')
      WHERE cne_id = ?
    `).bind(cne.id).run();

    throw new Error('Inadequate clinical learning material. Please upload session notes, clinical SOPs, or active library documents before generating AI MCQs.');
  }

  // 4. Construct prompt with strict clinical grounding
  const prompt = `You are a clinical nursing education specialist at AIIMS Rishikesh.
Generate exactly 5 high-yield multiple-choice questions (MCQs) strictly grounded in the provided institutional clinical evidence. Do NOT invent facts or use external unverified information.

Title: ${cne.title}
Category: ${cne.category}
Clinical Area: ${cne.area_name}

Institutional Evidence Grounding (Ground truth):
${evidenceText}

Requirements:
1. Generate EXACTLY 5 questions.
2. Each question MUST have exactly 4 options: A, B, C, D.
3. Indicate the single correct option ('A', 'B', 'C', or 'D').
4. Provide a thorough clinical explanation referencing rationale and safety protocols.
5. Return ONLY a valid JSON array of objects conforming to the following structure, with NO surrounding Markdown fences:
[
  {
    "question_text": "...",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct_option": "A",
    "explanation": "...",
    "source_reference": "..."
  }
]`;

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (HTTP ${response.status}): ${errText.slice(0, 300)}`);
    }

    const data: any = await response.json();
    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    // Strip markdown fences if present
    if (rawText.startsWith('```json')) {
      rawText = rawText.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    } else if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```\s*/, '').replace(/```$/, '').trim();
    }

    let parsedQuestions: GeneratedMcq[];
    try {
      parsedQuestions = JSON.parse(rawText);
    } catch {
      throw new Error('Gemini API did not return valid JSON for MCQs.');
    }

    if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
      throw new Error('Generated MCQ payload was empty.');
    }

    // Strict validation: Validate each MCQ structure
    const validQuestions: GeneratedMcq[] = [];
    for (const q of parsedQuestions) {
      if (
        q.question_text &&
        q.option_a &&
        q.option_b &&
        q.option_c &&
        q.option_d &&
        ['A', 'B', 'C', 'D'].includes(q.correct_option?.toUpperCase())
      ) {
        validQuestions.push({
          question_text: q.question_text.trim(),
          option_a: q.option_a.trim(),
          option_b: q.option_b.trim(),
          option_c: q.option_c.trim(),
          option_d: q.option_d.trim(),
          correct_option: q.correct_option.toUpperCase() as 'A' | 'B' | 'C' | 'D',
          explanation: q.explanation?.trim() || 'Standard clinical procedure and safety guideline.',
          source_reference: q.source_reference?.trim() || evidenceSource
        });
      }
    }

    // Require at least 5 valid questions
    if (validQuestions.length < 5) {
      throw new Error(`Expected 5 valid MCQs, but only received ${validQuestions.length} valid items.`);
    }

    // Persist all five questions and the GENERATED state in one D1 batch transaction.
    const questionRows = validQuestions.slice(0, 5).map((q, index) => ({ id: 'Q_' + generateRandomToken(10), q, order: index + 1 }));
    const statements: D1PreparedStatement[] = questionRows.map(({ id, q, order }) => db.prepare(`
      INSERT INTO cne_questions (
        id, cne_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, source_reference, order_num, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AI_GENERATED', datetime('now'), datetime('now'))
    `).bind(id, cne.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.explanation, q.source_reference || null, order));
    statements.push(db.prepare(`
      UPDATE ai_generation_state
      SET status = 'GENERATED', evidence_source = ?, prompt_summary = ?, error_message = NULL, generated_at = datetime('now'), updated_at = datetime('now')
      WHERE cne_id = ? AND status = 'IN_PROGRESS'
    `).bind(evidenceSource, `Generated 5 MCQs for ${cne.title}`, cne.id));
    await db.batch(statements);

    for (const row of questionRows) {
      await enqueueBackup(db, 'cne_questions', row.id, 'INSERT', { id: row.id, cne_id: cne.id, question_text: row.q.question_text });
    }

    await logAuditAction(db, adminEmployeeId, 'AI_MCQ_GENERATION_SUCCESS', 'CNE', cne.id, {
      model,
      evidenceSource,
      count: 5
    });

    return { success: true, questionsCount: 5, model };
  } catch (err: any) {
    console.error('AI generation failed:', err);

    // Fail atomically: set status = FAILED
    await db.prepare(`
      UPDATE ai_generation_state
      SET status = 'FAILED',
          error_message = ?,
          updated_at = datetime('now')
      WHERE cne_id = ?
    `).bind(err.message?.slice(0, 500) || 'Unknown generation error', cne.id).run();

    await logAuditAction(db, adminEmployeeId, 'AI_MCQ_GENERATION_FAILED', 'CNE', cne.id, { error: err.message });
    throw err;
  }
}

export async function listQuestions(db: D1Database, cneId: string): Promise<any[]> {
  const rows = await db.prepare(`
    SELECT * FROM cne_questions WHERE cne_id = ? ORDER BY order_num ASC, created_at ASC
  `).bind(cneId).all<any>();

  return rows.results || [];
}

export async function createManualQuestion(
  db: D1Database,
  cneId: string,
  user: { employee_id: string },
  data: {
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: string;
    explanation?: string;
    source_reference?: string;
  }
): Promise<any> {
  const cleanCorrect = data.correct_option?.trim().toUpperCase();
  if (!['A', 'B', 'C', 'D'].includes(cleanCorrect)) {
    throw new Error('Correct option must be A, B, C, or D.');
  }

  const id = 'Q_' + generateRandomToken(8);
  const count = await db.prepare('SELECT COUNT(*) as count FROM cne_questions WHERE cne_id = ?').bind(cneId).first<any>();
  const orderNum = (count?.count || 0) + 1;

  await db.prepare(`
    INSERT INTO cne_questions (
      id, cne_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, source_reference, order_num, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL_ADMIN', datetime('now'), datetime('now'))
  `).bind(
    id,
    cneId,
    data.question_text.trim(),
    data.option_a.trim(),
    data.option_b.trim(),
    data.option_c.trim(),
    data.option_d.trim(),
    cleanCorrect,
    data.explanation?.trim() || null,
    data.source_reference?.trim() || null,
    orderNum
  ).run();

  await logAuditAction(db, user.employee_id, 'MANUAL_QUESTION_CREATED', 'QUESTION', id, { cneId });
  await enqueueBackup(db, 'cne_questions', id, 'INSERT', { id, cne_id: cneId, question: data.question_text });

  return db.prepare('SELECT * FROM cne_questions WHERE id = ?').bind(id).first<any>();
}

export async function updateQuestion(
  db: D1Database,
  id: string,
  user: { employee_id: string },
  data: any
): Promise<any> {
  const existing = await db.prepare('SELECT * FROM cne_questions WHERE id = ?').bind(id).first<any>();
  if (!existing) {
    throw new Error('Question not found.');
  }

  const cleanCorrect = data.correct_option ? data.correct_option.trim().toUpperCase() : existing.correct_option;

  await db.prepare(`
    UPDATE cne_questions
    SET 
      question_text = COALESCE(?, question_text),
      option_a = COALESCE(?, option_a),
      option_b = COALESCE(?, option_b),
      option_c = COALESCE(?, option_c),
      option_d = COALESCE(?, option_d),
      correct_option = COALESCE(?, correct_option),
      explanation = COALESCE(?, explanation),
      source_reference = COALESCE(?, source_reference),
      updated_at = datetime('now')
    WHERE id = ?
  `).bind(
    data.question_text?.trim() || null,
    data.option_a?.trim() || null,
    data.option_b?.trim() || null,
    data.option_c?.trim() || null,
    data.option_d?.trim() || null,
    cleanCorrect,
    data.explanation?.trim() || null,
    data.source_reference?.trim() || null,
    id
  ).run();

  await logAuditAction(db, user.employee_id, 'QUESTION_UPDATED', 'QUESTION', id, data);
  await enqueueBackup(db, 'cne_questions', id, 'UPDATE', { id, ...data });

  return db.prepare('SELECT * FROM cne_questions WHERE id = ?').bind(id).first<any>();
}

export async function deleteQuestion(
  db: D1Database,
  id: string,
  user: { employee_id: string }
): Promise<void> {
  await db.prepare('DELETE FROM cne_questions WHERE id = ?').bind(id).run();
  await logAuditAction(db, user.employee_id, 'QUESTION_DELETED', 'QUESTION', id);
  await enqueueBackup(db, 'cne_questions', id, 'DELETE', { id });
}

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  FileText,
  Sparkles,
  QrCode,
  Upload,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  HelpCircle,
  Award,
  BookOpen,
  ClipboardCheck,
  ShieldCheck
} from 'lucide-react';
import {
  Cne,
  User,
  CneApplication,
  CneParticipant,
  CneAttendance,
  CneResource,
  CneQuestion
} from '../../types';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import { api } from '../../services/api';

export interface CneDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cne: Cne | null;
  currentUser: User | null;
  onApply?: (cne: Cne) => void;
  onEditCne?: (cne: Cne) => void;
  onCancelCne?: (cne: Cne) => void;
  onCompleteCne?: (cne: Cne) => void;
  onOpenQr?: (cne: Cne) => void;
  onTakePostTest?: (cne: Cne) => void;
  onCneUpdated?: () => void;
  onShowToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

type TabKey =
  | 'overview'
  | 'applications'
  | 'participants'
  | 'attendance'
  | 'materials'
  | 'questions'
  | 'enrollment'
  | 'post_test';

export const CneDetailsModal: React.FC<CneDetailsModalProps> = ({
  isOpen,
  onClose,
  cne,
  currentUser,
  onApply,
  onEditCne,
  onCancelCne,
  onCompleteCne,
  onOpenQr,
  onTakePostTest,
  onCneUpdated,
  onShowToast
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loadingTab, setLoadingTab] = useState(false);

  // Sub-entity states
  const [applications, setApplications] = useState<CneApplication[]>([]);
  const [participants, setParticipants] = useState<CneParticipant[]>([]);
  const [attendance, setAttendance] = useState<CneAttendance[]>([]);
  const [resources, setResources] = useState<CneResource[]>([]);
  const [questions, setQuestions] = useState<CneQuestion[]>([]);

  // Employee-specific view states
  const [myApplication, setMyApplication] = useState<CneApplication | null>(null);
  const [myRecord, setMyRecord] = useState<any | null>(null);
  const [myPostTest, setMyPostTest] = useState<any | null>(null);

  // Action states
  const [reviewNotes, setReviewNotes] = useState('');
  const [newParticipantEmpId, setNewParticipantEmpId] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  // Manual Question modal
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctOpt, setCorrectOpt] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [explanation, setExplanation] = useState('');
  const [sourceRef, setSourceRef] = useState('');

  const isAdmin = currentUser?.isAdmin || false;
  const isAreaIncharge = currentUser?.isAreaIncharge || false;
  const canManage = isAdmin || isAreaIncharge;

  useEffect(() => {
    if (!isOpen || !cne) return;
    if (!currentUser) {
      setActiveTab('overview');
      return;
    }
    loadTabData(activeTab);
  }, [isOpen, cne?.id, activeTab, currentUser]);

  const loadTabData = async (tab: TabKey) => {
    if (!cne || !currentUser) return;
    if (tab === 'overview') return;
    setLoadingTab(true);
    try {
      if (tab === 'applications' && canManage) {
        const res = await api.listApplications({ cne_id: cne.id });
        setApplications(res.items);
      } else if (tab === 'participants' && canManage) {
        const res = await api.listParticipants(cne.id);
        setParticipants(res);
      } else if (tab === 'attendance' && canManage) {
        const res = await api.listAttendance(cne.id);
        setAttendance(res);
      } else if (tab === 'materials') {
        const res = await api.listCneResources(cne.id);
        setResources(res);
      } else if (tab === 'questions' && canManage) {
        const res = await api.listQuestions(cne.id);
        setQuestions(res);
      } else if (tab === 'enrollment' && !canManage) {
        const apps = await api.getMyApplications();
        const found = apps.items.find((a: any) => a.cne_id === cne.id);
        setMyApplication(found || null);
        const myRecords = await api.getMyCneRecords();
        const foundRec = myRecords.find((r: any) => r.cne_id === cne.id);
        setMyRecord(foundRec || null);
      } else if (tab === 'post_test' && !canManage) {
        try {
          const test = await api.getPostTest(cne.id);
          setMyPostTest(test);
        } catch (e: any) {
          setMyPostTest({ error: e.message || 'Post-test currently unavailable.' });
        }
        const myRecords = await api.getMyCneRecords();
        const foundRec = myRecords.find((r: any) => r.cne_id === cne.id);
        setMyRecord(foundRec || null);
      }
    } catch (err: any) {
      onShowToast('error', err.message || 'Failed to load data');
    } finally {
      setLoadingTab(false);
    }
  };

  if (!cne) return null;

  const handleReviewApp = async (appId: string, decision: 'Approved' | 'Rejected') => {
    try {
      await api.reviewApplication(appId, decision, reviewNotes);
      onShowToast('success', `Application ${decision.toLowerCase()} successfully.`);
      loadTabData('applications');
      if (onCneUpdated) onCneUpdated();
    } catch (err: any) {
      onShowToast('error', err.message || 'Review action failed.');
    }
  };

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParticipantEmpId.trim()) return;
    try {
      await api.addParticipant(cne.id, newParticipantEmpId.trim().toUpperCase());
      onShowToast('success', `Participant ${newParticipantEmpId} added.`);
      setNewParticipantEmpId('');
      loadTabData('participants');
      if (onCneUpdated) onCneUpdated();
    } catch (err: any) {
      onShowToast('error', err.message);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '');
      resolve(raw.includes(',') ? raw.split(',')[1] : raw);
    };
    reader.onerror = () => reject(new Error('Unable to read the selected file.'));
    reader.readAsDataURL(file);
  });

  const handleUploadResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      onShowToast('error', 'Select a learning-material file to upload.');
      return;
    }
    if (uploadFile.size > 8 * 1024 * 1024) {
      onShowToast('error', 'File size must not exceed 8 MB.');
      return;
    }
    setUploading(true);
    try {
      const fileBase64 = await fileToBase64(uploadFile);
      await api.uploadCneResource(cne.id, {
        filename: uploadFile.name,
        mime_type: uploadFile.type || 'application/octet-stream',
        file_size: uploadFile.size,
        file_base64: fileBase64
      });
      onShowToast('success', 'File uploaded to Google Drive and registered as CNE learning material.');
      setUploadFile(null);
      loadTabData('materials');
    } catch (err: any) {
      onShowToast('error', err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!confirm('Execute AI MCQ generation? This enforces a single attempt per CNE using strict uploaded materials.')) return;
    setAiGenerating(true);
    try {
      const res = await api.generateAiMcqs(cne.id);
      onShowToast('success', `Generated ${res.questions?.length || 0} MCQs using ${res.evidence_source}.`);
      loadTabData('questions');
    } catch (err: any) {
      onShowToast('error', err.message || 'AI MCQ generation failed.');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createManualQuestion(cne.id, {
        question_text: questionText,
        option_a: optA,
        option_b: optB,
        option_c: optC,
        option_d: optD,
        correct_option: correctOpt,
        explanation,
        source_reference: sourceRef
      });
      onShowToast('success', 'Question created successfully.');
      setShowQuestionForm(false);
      setQuestionText('');
      setOptA('');
      setOptB('');
      setOptC('');
      setOptD('');
      setExplanation('');
      setSourceRef('');
      loadTabData('questions');
    } catch (err: any) {
      onShowToast('error', err.message);
    }
  };

  const handleDeleteQuestion = async (qid: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      await api.deleteQuestion(qid);
      onShowToast('success', 'Question deleted.');
      loadTabData('questions');
    } catch (err: any) {
      onShowToast('error', err.message);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="4xl"
      title={
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            {cne.cne_id}
          </span>
          <span className="line-clamp-1">{cne.title}</span>
        </div>
      }
      subtitle={
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
          <Badge status={cne.status} size="sm" />
          <span>Category: <strong className="text-slate-700">{cne.category}</strong></span>
          <span>Date: <strong className="text-slate-700">{cne.cne_date}</strong></span>
          <span>Time: <strong className="text-slate-700">{cne.start_time} - {cne.end_time}</strong></span>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {canManage && onOpenQr && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenQr(cne)}
                icon={<QrCode className="w-4 h-4 text-emerald-700" />}
                className="font-semibold"
              >
                Launch QR Attendance
              </Button>
            )}
            {canManage && onEditCne && (cne.status === 'Scheduled' || cne.status === 'Modified & Scheduled') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditCne(cne)}
                icon={<Edit2 className="w-3.5 h-3.5" />}
              >
                Edit CNE
              </Button>
            )}
            {canManage && onCancelCne && (cne.status === 'Scheduled' || cne.status === 'Modified & Scheduled') && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onCancelCne(cne)}
              >
                Cancel Session
              </Button>
            )}
            {canManage && onCompleteCne && (cne.status === 'Scheduled' || cne.status === 'Modified & Scheduled') && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onCompleteCne(cne)}
              >
                Mark Completed
              </Button>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {/* Tabs Header */}
      <div className="flex items-center gap-1 border-b border-slate-200 -mx-6 px-6 mb-5 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3.5 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
            activeTab === 'overview'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Overview & Objectives
        </button>

        {/* Employee View: Focus cleanly on Enrollment status and Post-Test/Certification */}
        {currentUser && !canManage && (
          <>
            <button
              onClick={() => setActiveTab('enrollment')}
              className={`px-3.5 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                activeTab === 'enrollment'
                  ? 'border-emerald-700 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Enrollment & Status
            </button>

            <button
              onClick={() => setActiveTab('materials')}
              className={`px-3.5 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                activeTab === 'materials'
                  ? 'border-emerald-700 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Learning Materials
            </button>

            <button
              onClick={() => setActiveTab('post_test')}
              className={`px-3.5 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                activeTab === 'post_test'
                  ? 'border-emerald-700 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Post-Test & Certification
            </button>
          </>
        )}

        {/* Manager/Admin View: Operations, Attendance, Materials, and AI MCQs */}
        {currentUser && canManage && (
          <>
            <button
              onClick={() => setActiveTab('applications')}
              className={`px-3.5 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                activeTab === 'applications'
                  ? 'border-emerald-700 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Applications ({cne.applications_count || 0})
            </button>

            <button
              onClick={() => setActiveTab('participants')}
              className={`px-3.5 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                activeTab === 'participants'
                  ? 'border-emerald-700 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Participants ({cne.participants_count || 0}/{cne.capacity})
            </button>

            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-3.5 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                activeTab === 'attendance'
                  ? 'border-emerald-700 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Attendance ({cne.attendance_count || 0})
            </button>

            <button
              onClick={() => setActiveTab('materials')}
              className={`px-3.5 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                activeTab === 'materials'
                  ? 'border-emerald-700 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Materials & Evidence
            </button>

            <button
              onClick={() => setActiveTab('questions')}
              className={`px-3.5 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                activeTab === 'questions'
                  ? 'border-emerald-700 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Questions & AI ({cne.questions_count || 0})
            </button>
          </>
        )}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: OVERVIEW */}
      {/* ===================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {!currentUser && (
            <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Institutional Login Required for Participation & Materials</p>
                <p className="text-emerald-800/90 mt-0.5">
                  Sign in with your AIIMS Rishikesh Employee ID using the Institutional Login button in the top navigation to register for this session, access training resources, and take post-tests.
                </p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Topic:</span>
                <p className="font-semibold text-slate-900 text-sm mt-0.5">{cne.title}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Category:</span>
                <p className="font-semibold text-slate-800">{cne.category}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Clinical Area / Ward:</span>
                <p className="font-semibold text-slate-800">{cne.area_name || 'General'}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Venue:</span>
                <p className="font-semibold text-slate-800">{cne.venue}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Date & Timings:</span>
                <p className="font-semibold text-slate-800">{cne.cne_date} ({cne.start_time} - {cne.end_time})</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Capacity & Status:</span>
                <p className="font-semibold text-slate-800">{cne.capacity} Participants • <Badge status={cne.status} size="sm" /></p>
              </div>
            </div>
          </div>

          {cne.cancel_reason && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
              <strong>Cancellation Reason:</strong> {cne.cancel_reason}
            </div>
          )}

          {/* Faculty / Resource Persons */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-700" />
              Faculty & Resource Persons
            </h4>
            {cne.resource_persons && cne.resource_persons.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cne.resource_persons.map((rp) => (
                  <div key={rp.id} className="p-3 bg-white border border-slate-200 rounded-lg text-xs">
                    <div className="font-bold text-slate-900">{rp.name || rp.employee_id}</div>
                    <div className="text-slate-500">{rp.designation || 'Nursing Officer'} • {rp.department || 'Nursing Service'}</div>
                    <div className="text-emerald-700 font-medium mt-1">{rp.role_title}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No faculty records mapped yet.</p>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: APPLICATIONS (ADMIN / AREA INCHARGE ONLY) */}
      {/* ===================================================================== */}
      {activeTab === 'applications' && canManage && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Pending & Reviewed Enrollment Applications</span>
            <span>Capacity: {cne.participants_count || 0} / {cne.capacity}</span>
          </div>

          {applications.length === 0 ? (
            <EmptyState title="No applications submitted yet" description="Applications submitted by nursing officers will appear here for review." />
          ) : (
            <div className="space-y-2.5">
              {applications.map((app) => (
                <div key={app.id} className="p-3.5 bg-white border border-slate-200 rounded-lg text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{app.employee_name || app.employee_id}</span>
                      <span className="font-mono text-[11px] text-slate-500">({app.employee_id})</span>
                      <Badge status={app.status} size="sm" />
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      {app.designation} • {app.department} • Applied: {app.applied_at.substring(0, 16)}
                    </div>
                    {app.review_notes && (
                      <div className="text-[11px] text-slate-600 mt-1 italic bg-slate-50 p-1.5 rounded">
                        Note: {app.review_notes}
                      </div>
                    )}
                  </div>

                  {app.status === 'Pending' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleReviewApp(app.id, 'Approved')}
                        icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                        className="bg-emerald-700 hover:bg-emerald-800"
                      >
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleReviewApp(app.id, 'Rejected')}
                        icon={<XCircle className="w-3.5 h-3.5" />}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: PARTICIPANTS (MANAGEMENT ONLY) */}
      {/* ===================================================================== */}
      {activeTab === 'participants' && canManage && (
        <div className="space-y-4">
          <form onSubmit={handleAddParticipant} className="flex gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <input
              type="text"
              value={newParticipantEmpId}
              onChange={(e) => setNewParticipantEmpId(e.target.value)}
              placeholder="Directly enroll Employee ID (e.g. EMP003)..."
              className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs uppercase font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
            <Button type="submit" variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
              Enroll Officer
            </Button>
          </form>

          {participants.length === 0 ? (
            <EmptyState title="No enrolled participants" description="Participants will be listed once applications are approved or directly enrolled." />
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="p-2.5">Officer Name / ID</th>
                    <th className="p-2.5">Designation</th>
                    <th className="p-2.5">Enrolled Via</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Post-Test Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {participants.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="p-2.5">
                        <div className="font-semibold text-slate-900">{p.employee_name || p.employee_id}</div>
                        <div className="font-mono text-[10px] text-slate-400">{p.employee_id}</div>
                      </td>
                      <td className="p-2.5 text-slate-600">{p.designation || 'Nursing Officer'}</td>
                      <td className="p-2.5 text-slate-500">{p.source}</td>
                      <td className="p-2.5">
                        <Badge status={p.status} size="sm" />
                      </td>
                      <td className="p-2.5">
                        {p.test_score !== null && p.test_score !== undefined ? (
                          <span className={`font-semibold ${p.test_passed ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {p.test_score} pts ({p.test_passed ? 'PASSED' : 'FAILED'})
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not taken</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: ATTENDANCE (MANAGEMENT ONLY) */}
      {/* ===================================================================== */}
      {activeTab === 'attendance' && canManage && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Total Verified Attendance: <strong>{attendance.length}</strong>
            </span>
            {canManage && onOpenQr && (
              <Button variant="primary" size="sm" onClick={() => onOpenQr(cne)} icon={<QrCode className="w-3.5 h-3.5" />}>
                Show Session QR Code
              </Button>
            )}
          </div>

          {attendance.length === 0 ? (
            <EmptyState
              title="No attendance records"
              description="Attendance marked via QR scan or session incharge verification will appear here."
              icon={<QrCode className="w-10 h-10 text-slate-300" />}
            />
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="p-2.5">Officer Name</th>
                    <th className="p-2.5">Employee ID</th>
                    <th className="p-2.5">Time Marked</th>
                    <th className="p-2.5">Method</th>
                    <th className="p-2.5">Verified By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendance.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50/50">
                      <td className="p-2.5 font-semibold text-slate-900">{att.employee_name || att.employee_id}</td>
                      <td className="p-2.5 font-mono text-slate-500">{att.employee_id}</td>
                      <td className="p-2.5 text-slate-600">{att.marked_at}</td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {att.method}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-500">{att.verifier_name || att.verified_by || 'System Verified'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: MATERIALS & EVIDENCE */}
      {/* ===================================================================== */}
      {activeTab === 'materials' && currentUser && (
        <div className="space-y-5">
          {canManage && (
            <form onSubmit={handleUploadResource} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-emerald-700" /> Upload Learning Material / Evidence
                </span>
                <span className="text-[10px] text-slate-400">PDF, PPTX, Guidelines</span>
              </div>
              <input
                type="file"
                required
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-600"
              />
              <p className="text-[11px] text-slate-500">Text extraction and D1 indexing run automatically after Drive upload. Failed extraction can be retried by an authorized manager.</p>
              <div className="flex justify-end">
                <Button type="submit" variant="primary" size="sm" loading={uploading}>
                  Upload & Index
                </Button>
              </div>
            </form>
          )}

          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Uploaded Materials</h4>
            {resources.length === 0 ? (
              <EmptyState title="No learning materials uploaded yet" description="Upload slides or protocols to provide evidence for candidate learning and AI MCQ generation." />
            ) : (
              <div className="space-y-2">
                {resources.map((res) => (
                  <div key={res.id} className="p-3 bg-white border border-slate-200 rounded-lg text-xs flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900">{res.filename}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Evidence status: <span className={`font-bold ${res.extraction_status === 'INDEXED' ? 'text-emerald-700' : res.extraction_status === 'FAILED' ? 'text-rose-700' : 'text-amber-700'}`}>{res.extraction_status}</span>
                          {res.extraction_error ? <span className="ml-1 text-rose-600">• {res.extraction_error}</span> : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {res.file_url && (
                        <a href={res.file_url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900">Open file</a>
                      )}
                      {canManage && res.extraction_status !== 'INDEXED' && (
                        <button type="button" onClick={async () => { try { await api.retryCneResourceExtraction(res.id); onShowToast('success','Extraction retry completed.'); loadTabData('materials'); } catch (e:any) { onShowToast('error', e.message); } }} className="text-[11px] font-semibold text-amber-700 hover:text-amber-900">Retry extraction</button>
                      )}
                      <span className="text-[11px] font-mono text-slate-400">{(res.file_size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 6: QUESTIONS & AI MCQ GENERATOR */}
      {/* ===================================================================== */}
      {activeTab === 'questions' && canManage && (
        <div className="space-y-5">
          {/* AI Generation Control Banner */}
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-700" />
                <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                  AI-Assisted MCQ Generation (Gemini 3.8 Flash)
                </h4>
              </div>
              <p className="text-xs text-emerald-800 mt-1">
                Strict evidence hierarchy: Checks CNE materials first, then institutional library. Strictly locked to 1 generation per CNE.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="primary"
                size="sm"
                loading={aiGenerating}
                onClick={handleAiGenerate}
                icon={<Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                className="bg-emerald-800 hover:bg-emerald-900 font-semibold"
              >
                {aiGenerating ? 'Extracting Evidence...' : 'Generate AI MCQs'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQuestionForm(!showQuestionForm)}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Manual Question
              </Button>
            </div>
          </div>

          {/* Manual Question Creator Form */}
          {showQuestionForm && (
            <form onSubmit={handleCreateQuestion} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Create Question Manually</h4>
              <textarea
                required
                rows={2}
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Question text (e.g. What is the first-line vasopressor in septic shock?)..."
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={optA}
                  onChange={(e) => setOptA(e.target.value)}
                  placeholder="Option A..."
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs"
                />
                <input
                  type="text"
                  required
                  value={optB}
                  onChange={(e) => setOptB(e.target.value)}
                  placeholder="Option B..."
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs"
                />
                <input
                  type="text"
                  required
                  value={optC}
                  onChange={(e) => setOptC(e.target.value)}
                  placeholder="Option C..."
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs"
                />
                <input
                  type="text"
                  required
                  value={optD}
                  onChange={(e) => setOptD(e.target.value)}
                  placeholder="Option D..."
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Correct Option</label>
                  <select
                    value={correctOpt}
                    onChange={(e) => setCorrectOpt(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs"
                  >
                    <option value="A">Option A</option>
                    <option value="B">Option B</option>
                    <option value="C">Option C</option>
                    <option value="D">Option D</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Source Reference</label>
                  <input
                    type="text"
                    value={sourceRef}
                    onChange={(e) => setSourceRef(e.target.value)}
                    placeholder="e.g. Surviving Sepsis Campaign 2021"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>
              <div>
                <input
                  type="text"
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Clinical rational / explanation..."
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowQuestionForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Save Question
                </Button>
              </div>
            </form>
          )}

          {/* List of Questions */}
          {questions.length === 0 ? (
            <EmptyState title="No questions configured" description="Click 'Generate AI MCQs' to extract questions from uploaded materials, or add questions manually." />
          ) : (
            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div key={q.id} className="p-4 bg-white border border-slate-200 rounded-xl text-xs space-y-2 shadow-2xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-slate-900 text-sm">
                      <span className="text-emerald-700 mr-1.5">Q{idx + 1}.</span> {q.question_text}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-100 text-slate-600">
                        {q.created_by}
                      </span>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-700 pl-4 border-l-2 border-slate-200">
                    <div className={q.correct_option === 'A' ? 'font-bold text-emerald-800' : ''}>A. {q.option_a}</div>
                    <div className={q.correct_option === 'B' ? 'font-bold text-emerald-800' : ''}>B. {q.option_b}</div>
                    <div className={q.correct_option === 'C' ? 'font-bold text-emerald-800' : ''}>C. {q.option_c}</div>
                    <div className={q.correct_option === 'D' ? 'font-bold text-emerald-800' : ''}>D. {q.option_d}</div>
                  </div>

                  <div className="text-[11px] text-slate-500 pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                    <span>
                      Correct Answer: <strong className="text-emerald-700">Option {q.correct_option}</strong>
                    </span>
                    {q.source_reference && (
                      <span className="italic text-slate-400">Ref: {q.source_reference}</span>
                    )}
                  </div>
                  {q.explanation && (
                    <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded">
                      <strong>Rational:</strong> {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB: ENROLLMENT & STATUS (EMPLOYEE ONLY) */}
      {/* ===================================================================== */}
      {activeTab === 'enrollment' && !canManage && (
        <div className="space-y-5">
          {/* Current Status Header Card */}
          <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Enrollment Status</span>
                <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                  {myRecord?.attended_at
                    ? 'Attendance Verified'
                    : myApplication?.status === 'Approved'
                    ? 'Enrolled & Seat Confirmed'
                    : myApplication?.status === 'Pending'
                    ? 'Application Under Supervisor Review'
                    : myApplication?.status === 'Rejected'
                    ? 'Application Not Approved'
                    : 'Not Yet Registered'}
                </h4>
              </div>
              <div>
                {myRecord?.attended_at ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Attended
                  </span>
                ) : myApplication?.status === 'Approved' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Approved
                  </span>
                ) : myApplication?.status === 'Pending' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Review
                  </span>
                ) : myApplication?.status === 'Rejected' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                    <XCircle className="w-3.5 h-3.5 text-rose-600" /> Rejected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                    Open for Enrollment
                  </span>
                )}
              </div>
            </div>

            {/* Status explanation */}
            {myRecord?.attended_at ? (
              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-lg p-3 text-xs text-emerald-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" /> Session Presence Confirmed
                </p>
                <p className="text-slate-600">
                  Attendance recorded at <strong>{myRecord.attended_at}</strong> via <strong>{myRecord.attendance_method}</strong>.
                  Head over to the <strong>Post-Test & Certification</strong> tab to complete your competency assessment.
                </p>
              </div>
            ) : myApplication?.status === 'Approved' ? (
              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-lg p-3 text-xs text-emerald-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" /> Seat Reserved
                </p>
                <p className="text-slate-600">
                  Your registration is confirmed. Please report to <strong>{cne.venue}</strong> on <strong>{cne.cne_date}</strong> at <strong>{cne.start_time}</strong>.
                  Remember to scan the session QR code at the venue or present your Employee ID to the in-charge to mark your attendance.
                </p>
              </div>
            ) : myApplication?.status === 'Pending' ? (
              <div className="bg-amber-50/60 border border-amber-200/80 rounded-lg p-3 text-xs text-amber-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-700" /> Awaiting Area Supervisor Verification
                </p>
                <p className="text-slate-600">
                  Applied on {new Date(myApplication.applied_at).toLocaleDateString()}. Your Area In-Charge will review roster scheduling and confirm capacity.
                </p>
              </div>
            ) : myApplication?.status === 'Rejected' ? (
              <div className="bg-rose-50/60 border border-rose-200/80 rounded-lg p-3 text-xs text-rose-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-700" /> Application Notice
                </p>
                <p className="text-slate-600">
                  {myApplication.review_notes || 'Application was not approved due to shift roster constraints or capacity limitations.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <p className="text-xs text-slate-600 leading-relaxed">
                  You are not currently enrolled in this clinical module. Clinical nursing officers may self-enroll subject to seat capacity and supervisor approval.
                </p>
                {onApply && (cne.status === 'Scheduled' || cne.status === 'Modified & Scheduled') && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onApply(cne)}
                    disabled={(cne.participants_count || 0) >= cne.capacity}
                  >
                    {(cne.participants_count || 0) >= cne.capacity ? 'Class Capacity Reached' : 'Submit Enrollment Request'}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Module Information Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Schedule & Duration</span>
              <p className="font-semibold text-slate-800">{cne.cne_date}</p>
              <p className="text-slate-500">{cne.start_time} - {cne.end_time}</p>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Venue & Location</span>
              <p className="font-semibold text-slate-800">{cne.venue}</p>
              <p className="text-slate-500">{cne.area_name || 'Designated Clinical Wing'}</p>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB: POST-TEST & CERTIFICATION (EMPLOYEE ONLY) */}
      {/* ===================================================================== */}
      {activeTab === 'post_test' && !canManage && (
        <div className="space-y-5">
          {myRecord?.score !== null && myRecord?.score !== undefined ? (
            /* Completed Post-Test Result */
            <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-700" />
                  <h4 className="text-sm font-bold text-slate-900">Competency Post-Test Result</h4>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  myRecord.passed ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {myRecord.passed ? 'PASSED & CERTIFIED' : 'NEEDS RE-EVALUATION'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Score</span>
                  <span className="text-lg font-extrabold text-slate-900">{myRecord.score} / {myRecord.max_score}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Percentage</span>
                  <span className="text-lg font-extrabold text-emerald-800">{myRecord.percentage}%</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Credit Status</span>
                  <span className="text-xs font-bold text-slate-700 mt-1 block">
                    {myRecord.passed ? '1.0 CNE Credit Awarded' : '0.0 Credit'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Submitted on {myRecord.test_submitted_at ? new Date(myRecord.test_submitted_at).toLocaleString() : 'N/A'}.
                Record registered in institutional nursing training dossier.
              </p>
            </div>
          ) : myRecord?.attended_at ? (
            /* Attended: Eligible to take post-test */
            <div className="p-5 rounded-xl border border-emerald-200/80 bg-emerald-50/40 shadow-2xs space-y-4">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-emerald-700" />
                <h4 className="text-sm font-bold text-emerald-950">Post-Test Assessment Eligible</h4>
              </div>
              <p className="text-xs text-emerald-900 leading-relaxed">
                Your attendance has been verified for this clinical module. You are eligible to complete the post-test competency assessment to earn certified CNE credits.
              </p>
              {cne.status === 'Completed' ? (
                <div>
                  {onTakePostTest && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onTakePostTest(cne)}
                      icon={<ShieldCheck className="w-4 h-4 text-emerald-200" />}
                      className="bg-emerald-800 hover:bg-emerald-900 font-semibold"
                    >
                      Begin Post-Test Evaluation
                    </Button>
                  )}
                </div>
              ) : (
                <div className="bg-white/80 p-3 rounded-lg border border-emerald-200 text-xs text-slate-600">
                  <p className="font-semibold text-slate-800">Session in progress</p>
                  <p className="mt-0.5">The post-test evaluation opens once the session is formally marked completed by the coordinator.</p>
                </div>
              )}
            </div>
          ) : (
            /* Not attended yet */
            <div className="p-6 rounded-xl border border-slate-200 bg-slate-50 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-200/80 flex items-center justify-center mx-auto text-slate-500">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Post-Test Locked</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Attendance verification at the clinical training venue is mandatory prior to taking the competency post-test.
                Ensure you check in using the session QR code or through the area supervisor at the venue.
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

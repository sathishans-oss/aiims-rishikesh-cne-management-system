import React, { useState, useEffect } from 'react';
import {
  User,
  Cne,
  Area,
  NavigationTab,
  PublicHomeData
} from './types';
import { Header } from './components/common/Header';
import { TopNavigation } from './components/common/TopNavigation';
import { Toast } from './components/common/Toast';
import { PublicHome } from './components/public/PublicHome';
import { LoginModal } from './components/auth/LoginModal';
import { ForgotPasswordModal } from './components/auth/ForgotPasswordModal';
import { CneSchedule } from './components/cne/CneSchedule';
import { CneCalendar } from './components/cne/CneCalendar';
import { CneDetailsModal } from './components/cne/CneDetailsModal';
import { CneFormModal } from './components/cne/CneFormModal';
import { QrAttendanceModal } from './components/cne/QrAttendanceModal';
import { PostTestModal } from './components/cne/PostTestModal';
import { Dashboard } from './components/user/Dashboard';
import { MyCneRecords } from './components/user/MyCneRecords';
import { MyApplications } from './components/user/MyApplications';
import { LearningResourcesView } from './components/user/LearningResourcesView';
import { ApplicationManagement } from './components/admin/ApplicationManagement';
import { AreaMaster } from './components/admin/AreaMaster';
import { RoleMaster } from './components/admin/RoleMaster';
import { AdminContent } from './components/admin/AdminContent';
import { ReportsView } from './components/admin/ReportsView';
import { AdminDiagnostics } from './components/admin/AdminDiagnostics';
import { api } from './services/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTab, setCurrentTab] = useState<NavigationTab>('home');
  const [publicData, setPublicData] = useState<PublicHomeData | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [cnes, setCnes] = useState<Cne[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Modals state
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [forgotPasswordModalOpen, setForgotPasswordModalOpen] = useState(false);
  const [selectedCne, setSelectedCne] = useState<Cne | null>(null);
  const [cneFormModalOpen, setCneFormModalOpen] = useState(false);
  const [cneToEdit, setCneToEdit] = useState<Cne | null>(null);
  const [qrModalCne, setQrModalCne] = useState<Cne | null>(null);
  const [postTestCne, setPostTestCne] = useState<Cne | null>(null);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
  };

  useEffect(() => {
    initializeApp();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('attendance_token');
    if (!token) return;
    void (async () => {
      try {
        await api.scanQrAttendance(token);
        showToast('success', 'Attendance verified successfully.');
      } catch (err: any) {
        showToast('error', err.message || 'Attendance verification failed.');
      } finally {
        params.delete('attendance_token');
        const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', next);
      }
    })();
  }, [currentUser?.employee_id]);

  const initializeApp = async () => {
    setLoadingInitial(true);
    try {
      // 1. Authenticated user session check
      try {
        const user = await api.getCurrentUser();
        setCurrentUser(user);
        if (user) {
          setCurrentTab('dashboard');
        }
      } catch {
        setCurrentUser(null);
      }

      // 2. Fetch public data
      try {
        const pData = await api.getPublicHome();
        setPublicData(pData);
      } catch (e) {
        console.error('Failed to load public home data', e);
      }

      // 3. Fetch areas
      try {
        const areaList = await api.listAreas();
        setAreas(areaList);
      } catch (e) {
        console.error('Failed to load areas', e);
      }

      // 4. Fetch scheduled CNEs
      try {
        const res = await api.listCnes();
        setCnes(res.items || []);
      } catch (e) {
        console.error('Failed to load cnes', e);
      }
    } finally {
      setLoadingInitial(false);
    }
  };

  const refreshCnes = async () => {
    try {
      const res = await api.listCnes();
      setCnes(res.items || []);
      const areaList = await api.listAreas();
      setAreas(areaList);
      const pData = await api.getPublicHome();
      setPublicData(pData);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setLoginModalOpen(false);
    showToast('success', `Welcome back, ${user.name}!`);
    setCurrentTab('dashboard');
    refreshCnes();
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (e) {
      console.error(e);
    }
    setCurrentUser(null);
    setCurrentTab('home');
    showToast('info', 'You have been signed out successfully.');
    refreshCnes();
  };

  const handleOpenCreateCne = () => {
    setCneToEdit(null);
    setCneFormModalOpen(true);
  };

  const handleOpenEditCne = (cne: Cne) => {
    setCneToEdit(cne);
    setCneFormModalOpen(true);
  };

  const handleApplyCne = async (cne: Cne) => {
    if (!currentUser) {
      setLoginModalOpen(true);
      return;
    }
    try {
      await api.applyForCne(cne.id);
      showToast('success', `Application for "${cne.title}" submitted successfully.`);
      refreshCnes();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to apply');
    }
  };

  const handleSelectCne = async (cne: Cne) => {
    try {
      const detail = await api.getCne(cne.id);
      setSelectedCne(detail);
    } catch (err: any) {
      showToast('error', err.message || 'Unable to load CNE details.');
    }
  };

  const handleCancelCne = async (cne: Cne) => {
    const reason = window.prompt('Reason for cancellation:', 'Administrative exigency');
    if (reason === null) return;
    if (!reason.trim()) { showToast('error', 'Cancellation reason is required.'); return; }
    try {
      await api.cancelCne(cne.id, reason.trim());
      showToast('success', 'CNE session canceled.');
      setSelectedCne(null);
      await refreshCnes();
    } catch (err: any) { showToast('error', err.message || 'Unable to cancel CNE.'); }
  };

  const handleCompleteCne = async (cne: Cne) => {
    if (!window.confirm('Mark this CNE as Completed? This finalizes the scheduled session.')) return;
    try {
      await api.completeCne(cne.id);
      showToast('success', 'CNE session marked Completed.');
      setSelectedCne(null);
      await refreshCnes();
    } catch (err: any) { showToast('error', err.message || 'Unable to complete CNE.'); }
  };

  const handleNavigate = (tab: NavigationTab) => {
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800 antialiased font-sans">
      {/* Toast Notification */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Institutional Top Bar & Header */}
      <Header
        currentUser={currentUser}
        onOpenLogin={() => setLoginModalOpen(true)}
        onLogout={handleLogout}
        onNavigateHome={() => handleNavigate('home')}
      />

      {/* Role-Aware Navigation Bar */}
      <TopNavigation
        currentTab={currentTab}
        onSelectTab={handleNavigate}
        roles={currentUser?.roles || []}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* PUBLIC PORTAL */}
        {currentTab === 'home' && (
          <PublicHome
            data={publicData}
            onSelectCne={handleSelectCne}
            onOpenLogin={() => setLoginModalOpen(true)}
            onViewAllClasses={() => handleNavigate('upcoming_classes')}
          />
        )}

        {/* CNE UPCOMING CLASSES (SCHEDULE) */}
        {(currentTab === 'upcoming_classes' || currentTab === 'admin_cne') && (
          <CneSchedule
            cnes={cnes}
            areas={areas}
            currentUser={currentUser}
            onSelectCne={handleSelectCne}
            onCreateCne={
              currentUser?.isAdmin || currentUser?.isAreaIncharge
                ? handleOpenCreateCne
                : undefined
            }
            onApplyCne={handleApplyCne}
            onTakePostTest={(cne) => setPostTestCne(cne)}
            isLoading={loadingInitial}
          />
        )}

        {/* MONTHLY CALENDAR VIEW */}
        {currentTab === 'calendar' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Institutional CNE Academic Calendar
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Monthly visual distribution of accredited continuing clinical nursing education workshops
                </p>
              </div>
              {(currentUser?.isAdmin || currentUser?.isAreaIncharge) && (
                <button
                  onClick={handleOpenCreateCne}
                  className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Schedule Session
                </button>
              )}
            </div>
            <CneCalendar cnes={cnes} onSelectCne={handleSelectCne} />
          </div>
        )}

        {/* USER DASHBOARD */}
        {currentTab === 'dashboard' && currentUser && (
          <Dashboard
            currentUser={currentUser}
            onNavigate={handleNavigate}
            onSelectCne={handleSelectCne}
            onShowToast={showToast}
          />
        )}

        {/* USER: MY ATTENDANCE & TRANSCRIPT RECORDS */}
        {currentTab === 'my_records' && (
          <MyCneRecords onShowToast={showToast} />
        )}

        {/* USER: MY ENROLLMENT APPLICATIONS */}
        {currentTab === 'my_applications' && (
          <MyApplications onShowToast={showToast} />
        )}

        {/* CENTRAL INSTITUTIONAL LIBRARY & GUIDELINES */}
        {currentTab === 'resources' && (
          <LearningResourcesView
            currentUser={currentUser}
            onShowToast={showToast}
          />
        )}

        {/* ADMIN / INCHARGE: APPLICATIONS MANAGEMENT */}
        {currentTab === 'admin_applications' && (
          <ApplicationManagement
            areas={areas}
            onShowToast={showToast}
          />
        )}

        {/* ADMIN: AREA & WARD MASTER */}
        {currentTab === 'admin_areas' && (
          <AreaMaster onShowToast={showToast} />
        )}

        {/* ADMIN: OFFICERS & ROLE GOVERNANCE */}
        {currentTab === 'admin_roles' && (
          <RoleMaster onShowToast={showToast} />
        )}

        {/* ADMIN: PORTAL CMS CONTENT */}
        {currentTab === 'admin_content' && (
          <AdminContent onShowToast={showToast} />
        )}

        {/* ADMIN: INSTITUTIONAL REPORTS */}
        {currentTab === 'admin_reports' && (
          <ReportsView onShowToast={showToast} />
        )}

        {/* ADMIN: SYSTEM DIAGNOSTICS */}
        {currentTab === 'admin_diagnostics' && (
          <AdminDiagnostics onShowToast={showToast} />
        )}
      </main>

      {/* Global Institutional Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs border-t border-slate-800 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white tracking-wide uppercase text-sm">
                  Clinical Nursing Education (CNE) Management Portal
                </span>
                <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 font-mono text-[10px] rounded border border-emerald-800/80">
                  AIIMS Rishikesh
                </span>
              </div>
              <p className="text-slate-400 text-[11px] mt-1">
                College of Nursing & Nursing Services Administration • Virbhadra Road, Rishikesh, Uttarakhand 249203
              </p>
            </div>

            <div className="flex items-center gap-4 text-[11px]">
              <a
                href="mailto:ns.his@aiimsrishikesh.edu.in"
                className="hover:text-emerald-400 transition-colors"
              >
                Helpdesk: ns.his@aiimsrishikesh.edu.in
              </a>
              <span>•</span>
              <button
                onClick={() => handleNavigate('home')}
                className="hover:text-emerald-400 transition-colors cursor-pointer"
              >
                Public Portal
              </button>
              <span>•</span>
              <button
                onClick={() => handleNavigate('upcoming_classes')}
                className="hover:text-emerald-400 transition-colors cursor-pointer"
              >
                Academic Calendar
              </button>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
            <span>
              All Rights Reserved © {new Date().getFullYear()} All India Institute of Medical Sciences, Rishikesh.
            </span>
            <span>Accreditation & Quality Assurance Standard • AI-assisted assessment</span>
          </div>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* MODALS & OVERLAYS                                                         */}
      {/* ========================================================================= */}

      {/* Auth Modals */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        onOpenForgotPassword={() => {
          setLoginModalOpen(false);
          setForgotPasswordModalOpen(true);
        }}
      />

      <ForgotPasswordModal
        isOpen={forgotPasswordModalOpen}
        onClose={() => setForgotPasswordModalOpen(false)}
        onBackToLogin={() => {
          setForgotPasswordModalOpen(false);
          setLoginModalOpen(true);
        }}
      />

      {/* CNE Details Modal (Multi-tab: Applications, Participants, Attendance, Materials, Questions, AI MCQ Generator) */}
      {selectedCne && (
        <CneDetailsModal
          cne={selectedCne}
          currentUser={currentUser}
          isOpen={true}
          onClose={() => setSelectedCne(null)}
          onApply={handleApplyCne}
          onEditCne={(cne) => { setSelectedCne(null); handleOpenEditCne(cne); }}
          onCancelCne={handleCancelCne}
          onCompleteCne={handleCompleteCne}
          onOpenQr={(cne) => { setSelectedCne(null); setQrModalCne(cne); }}
          onTakePostTest={(cne) => { setSelectedCne(null); setPostTestCne(cne); }}
          onCneUpdated={refreshCnes}
          onShowToast={showToast}
        />
      )}

      {/* CNE Create / Edit Form Modal */}
      {cneFormModalOpen && (
        <CneFormModal
          isOpen={true}
          onClose={() => {
            setCneFormModalOpen(false);
            setCneToEdit(null);
          }}
          cneToEdit={cneToEdit}
          areas={areas}
          onSaved={refreshCnes}
          onShowToast={showToast}
        />
      )}

      {/* Live QR Attendance Token Modal */}
      {qrModalCne && (
        <QrAttendanceModal
          isOpen={true}
          onClose={() => setQrModalCne(null)}
          cne={qrModalCne}
          currentUser={currentUser}
          onAttendanceMarked={refreshCnes}
          onShowToast={showToast}
        />
      )}

      {/* Candidate Post-Test Evaluation Modal */}
      {postTestCne && (
        <PostTestModal
          isOpen={true}
          onClose={() => setPostTestCne(null)}
          cne={postTestCne}
          onTestSubmitted={refreshCnes}
          onShowToast={showToast}
        />
      )}
    </div>
  );
}

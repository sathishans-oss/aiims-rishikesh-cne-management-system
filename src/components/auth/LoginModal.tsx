import React, { useState, useEffect } from 'react';
import { LogIn, KeyRound, AlertCircle, ShieldAlert, CheckCircle2, ArrowLeft, ShieldCheck } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { api } from '../../services/api';
import { User } from '../../types';

export interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
  onOpenForgotPassword: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onOpenForgotPassword
}) => {
  const [mode, setMode] = useState<'login' | 'bootstrap'>('login');
  const [canBootstrap, setCanBootstrap] = useState(false);

  // Login form state
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Bootstrap form state
  const [bEmpId, setBEmpId] = useState('');
  const [bName, setBName] = useState('');
  const [bDesignation, setBDesignation] = useState('');
  const [bDepartment, setBDepartment] = useState('');
  const [bEmail, setBEmail] = useState('');
  const [bPhone, setBPhone] = useState('');
  const [bDateOfJoining, setBDateOfJoining] = useState('');
  const [bPassword, setBPassword] = useState('');
  const [bConfirmPassword, setBConfirmPassword] = useState('');
  const [bSetupToken, setBSetupToken] = useState('');
  const [bLoading, setBLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      // Query bootstrap status silently
      api.getBootstrapStatus()
        .then((status) => {
          setCanBootstrap(Boolean(status?.can_bootstrap));
        })
        .catch(() => {
          setCanBootstrap(false);
        });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId.trim() || !password.trim()) {
      setErrorMessage('Please enter both Employee ID and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.login(employeeId.trim().toUpperCase(), password);
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid Employee ID or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleBootstrapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bEmpId.trim() || !bName.trim() || !bDateOfJoining || !bPassword.trim()) {
      setErrorMessage('Employee ID, Full Name, Date of Joining, and Password are required.');
      return;
    }
    if (bPassword !== bConfirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    if (bPassword.length < 10) {
      setErrorMessage('Password must be at least 10 characters in length.');
      return;
    }

    setBLoading(true);
    setErrorMessage(null);

    try {
      const result = await api.bootstrapInitialAdmin({
        employee_id: bEmpId.trim().toUpperCase(),
        name: bName.trim(),
        designation: bDesignation.trim() || undefined,
        department: bDepartment.trim() || undefined,
        email: bEmail.trim() || undefined,
        phone: bPhone.trim() || undefined,
        date_of_joining: bDateOfJoining,
        password: bPassword,
        setup_token: bSetupToken.trim() || undefined
      });

      setSuccessMessage(result.message || 'Administrator account initialized successfully! Please sign in.');
      setEmployeeId(bEmpId.trim().toUpperCase());
      setPassword('');
      setCanBootstrap(false);
      setMode('login');
    } catch (err: any) {
      setErrorMessage(err.message || 'Bootstrap initialization failed.');
    } finally {
      setBLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'bootstrap' ? 'System Initialization — First Administrator' : 'Employee Portal Sign In'}
      subtitle={
        mode === 'bootstrap'
          ? 'Configure the primary institutional administrator for this deployment'
          : 'Enter your institutional credentials to access CNE services'
      }
      maxWidth={mode === 'bootstrap' ? 'lg' : 'md'}
    >
      {mode === 'login' ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {canBootstrap && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-3 text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                <span>No admin account configured. Ready for first-time bootstrap.</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  setMode('bootstrap');
                }}
                className="px-2.5 py-1 bg-amber-800 text-white rounded text-[11px] font-semibold hover:bg-amber-900 shrink-0 cursor-pointer"
              >
                Initialize Admin
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Institutional Employee ID
            </label>
            <input
              type="text"
              required
              autoFocus
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
              placeholder="e.g. EMP001"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-mono uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 shadow-xs"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">Password</label>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenForgotPassword();
                }}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-medium cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 shadow-xs"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              icon={<LogIn className="w-4 h-4" />}
              className="w-full font-semibold justify-center py-2.5"
            >
              {loading ? 'Signing in...' : 'Sign In to Portal'}
            </Button>
          </div>
        </form>
      ) : (
        /* Bootstrap Initial Administrator Form */
        <form onSubmit={handleBootstrapSubmit} className="space-y-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-700 mt-0.5" />
            <span>
              This one-time bootstrap grants permanent <strong>ADMIN</strong> privileges to this account. Once created, the bootstrap endpoint automatically locks permanently.
            </span>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admin Employee ID <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={bEmpId}
                onChange={(e) => setBEmpId(e.target.value.toUpperCase())}
                placeholder="e.g. EMP001"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={bName}
                onChange={(e) => setBName(e.target.value)}
                placeholder="e.g. Prof. / Dr. Officer Name"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Designation
              </label>
              <input
                type="text"
                value={bDesignation}
                onChange={(e) => setBDesignation(e.target.value)}
                placeholder="e.g. Principal Coordinator"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Department
              </label>
              <input
                type="text"
                value={bDepartment}
                onChange={(e) => setBDepartment(e.target.value)}
                placeholder="e.g. College of Nursing"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Institutional Email
              </label>
              <input
                type="email"
                value={bEmail}
                onChange={(e) => setBEmail(e.target.value)}
                placeholder="admin@aiimsrishikesh.edu.in"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={bPhone}
                onChange={(e) => setBPhone(e.target.value)}
                placeholder="+91 XXXXXXXXXX"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date of Joining <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                required
                value={bDateOfJoining}
                onChange={(e) => setBDateOfJoining(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password <span className="text-rose-600">*</span>
              </label>
              <input
                type="password"
                required
                value={bPassword}
                onChange={(e) => setBPassword(e.target.value)}
                placeholder="Min 10 characters"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm Password <span className="text-rose-600">*</span>
              </label>
              <input
                type="password"
                required
                value={bConfirmPassword}
                onChange={(e) => setBConfirmPassword(e.target.value)}
                placeholder="Re-type password"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Setup Token / Environment Secret <span className="text-rose-600">*</span>
            </label>
            <input
              type="password"
              value={bSetupToken}
              onChange={(e) => setBSetupToken(e.target.value)}
              placeholder="Enter the BOOTSTRAP_TOKEN configured in Cloudflare"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setErrorMessage(null);
                setMode('login');
              }}
              icon={<ArrowLeft className="w-3.5 h-3.5" />}
            >
              Back to Sign In
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={bLoading}
              icon={<ShieldCheck className="w-3.5 h-3.5" />}
            >
              {bLoading ? 'Initializing...' : 'Initialize Administrator'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};


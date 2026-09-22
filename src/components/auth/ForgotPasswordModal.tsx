import React, { useState } from 'react';
import { KeyRound, Calendar, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { api } from '../../services/api';

export interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackToLogin: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  onBackToLogin
}) => {
  const [step, setStep] = useState<'VERIFY' | 'RESET' | 'DONE'>('VERIFY');
  const [employeeId, setEmployeeId] = useState('');
  const [doj, setDoj] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleVerifyDoj = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !doj) {
      setErrorMessage('Employee ID and Date of Joining are required.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.forgotPassword(employeeId.trim().toUpperCase(), doj);
      setResetToken(res.resetToken);
      setStep('RESET');
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed. Please check your Employee ID and Date of Joining.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await api.resetPassword(resetToken, newPassword);
      setStep('DONE');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setStep('VERIFY');
    setEmployeeId('');
    setDoj('');
    setResetToken('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetModal}
      title="Reset Portal Password"
      subtitle={
        step === 'VERIFY'
          ? 'Verify your identity using your official institutional Date of Joining'
          : step === 'RESET'
          ? 'Create a secure new password for your account'
          : 'Password Reset Successful'
      }
      maxWidth="md"
    >
      {errorMessage && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {step === 'VERIFY' && (
        <form onSubmit={handleVerifyDoj} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Institutional Employee ID
            </label>
            <input
              type="text"
              required
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
              placeholder="e.g. EMP001"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-mono uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Date of Joining (DOJ)
            </label>
            <input
              type="date"
              required
              value={doj}
              onChange={(e) => setDoj(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 shadow-xs"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Your official appointment date registered in the institutional master (e.g. 2015-08-10 for EMP001).
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                resetModal();
                onBackToLogin();
              }}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
            </button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              className="font-semibold"
            >
              Verify Identity
            </Button>
          </div>
        </form>
      )}

      {step === 'RESET' && (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 shadow-xs"
            />
          </div>

          <div className="pt-2 flex items-center justify-end">
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              className="font-semibold"
            >
              Save New Password
            </Button>
          </div>
        </form>
      )}

      {step === 'DONE' && (
        <div className="text-center py-4 space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-slate-900">Password Updated Successfully</h4>
          <p className="text-xs text-slate-600 max-w-sm mx-auto">
            Your password has been changed. You may now sign in to the portal with your new credentials.
          </p>
          <div className="pt-3">
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                resetModal();
                onBackToLogin();
              }}
              className="font-semibold"
            >
              Go to Sign In
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

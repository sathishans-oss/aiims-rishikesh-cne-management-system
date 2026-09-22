import React from 'react';
import { Stethoscope, LogIn, LogOut, User as UserIcon, Shield } from 'lucide-react';
import { User } from '../../types';
import { Button } from './Button';
import { Badge } from './Badge';

export interface HeaderProps {
  currentUser: User | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  onNavigateHome: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenLogin,
  onLogout,
  onNavigateHome
}) => {
  const primaryRole = currentUser?.roles?.[0] || 'EMPLOYEE';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
          {/* Institutional Identity */}
          <div
            onClick={onNavigateHome}
            className="flex items-center gap-3.5 cursor-pointer group select-none"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs border border-emerald-800 shrink-0 group-hover:bg-emerald-800 transition-colors">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Institutional Healthcare Cell
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight tracking-tight">
                Clinical Nursing Education Management System
              </h1>
            </div>
          </div>

          {/* User Status / Login Action */}
          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex flex-col text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-sm font-semibold text-slate-800">{currentUser.name}</span>
                    <Badge status={primaryRole} size="sm" />
                  </div>
                  <span className="text-xs text-slate-500 font-mono">ID: {currentUser.employee_id} • {currentUser.department}</span>
                </div>

                <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0">
                  <UserIcon className="w-4 h-4" />
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={onLogout}
                  icon={<LogOut className="w-3.5 h-3.5" />}
                  className="hidden sm:inline-flex"
                >
                  Sign Out
                </Button>
                <button
                  onClick={onLogout}
                  className="sm:hidden text-slate-500 hover:text-slate-800 p-2 rounded-lg hover:bg-slate-100 cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={onOpenLogin}
                icon={<LogIn className="w-4 h-4" />}
                className="font-semibold shadow-sm"
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

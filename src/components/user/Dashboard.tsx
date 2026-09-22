import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  FileCheck,
  ClipboardList,
  Award,
  Calendar,
  Clock,
  MapPin,
  ArrowRight,
  TrendingUp,
  Users,
  BookOpen,
  Sparkles
} from 'lucide-react';
import { User, Cne } from '../../types';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { api } from '../../services/api';

export interface DashboardProps {
  currentUser: User;
  onNavigate: (tab: any) => void;
  onSelectCne: (cne: Cne) => void;
  onShowToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  currentUser,
  onNavigate,
  onSelectCne,
  onShowToast
}) => {
  const [stats, setStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, [currentUser.employee_id]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await api.getUserDashboard();
      setStats(data);
    } catch (err: any) {
      onShowToast('error', err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const primaryRole = currentUser.roles[0] || 'EMPLOYEE';

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Staff Portal
              </span>
              <Badge status={primaryRole} size="sm" />
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1.5 tracking-tight">
              Welcome, {currentUser.name}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Employee ID: <strong className="text-slate-800 font-mono">{currentUser.employee_id}</strong> • {currentUser.designation} • {currentUser.department}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('upcoming_classes')}
              icon={<GraduationCap className="w-4 h-4 text-emerald-700" />}
            >
              Browse Classes
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigate('my_records')}
              icon={<FileCheck className="w-4 h-4" />}
            >
              My Records
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">CNE Sessions Attended</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-0.5">
              {stats?.attended_count ?? 0}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 shrink-0">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Applications Submitted</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-0.5">
              {stats?.applications_count ?? 0}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Post-Tests Passed</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-0.5">
              {stats?.passed_tests_count ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Section: Upcoming Available Sessions + Recent Attended */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available Upcoming Sessions */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-700" />
                Upcoming CNE Classes
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Available for registration and attendance</p>
            </div>
            <button
              onClick={() => onNavigate('upcoming_classes')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
            >
              View All
            </button>
          </div>

          <div className="space-y-3">
            {stats?.upcoming_classes && stats.upcoming_classes.length > 0 ? (
              stats.upcoming_classes.map((cne: Cne) => (
                <div
                  key={cne.id}
                  onClick={() => onSelectCne(cne)}
                  className="p-3.5 rounded-lg border border-slate-200 hover:border-emerald-500 hover:shadow-xs transition-all cursor-pointer bg-slate-50/50 hover:bg-white text-xs group"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {cne.cne_id}
                    </span>
                    <Badge status={cne.status} size="sm" />
                  </div>
                  <h4 className="font-semibold text-slate-900 group-hover:text-emerald-800 line-clamp-1">
                    {cne.title}
                  </h4>
                  <div className="mt-2 flex items-center gap-3 text-slate-500 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" /> {cne.cne_date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" /> {cne.start_time} - {cne.end_time}
                    </span>
                    <span className="truncate">{cne.venue}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 py-4 text-center">No upcoming classes scheduled.</p>
            )}
          </div>
        </div>

        {/* Recently Attended CNEs */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-700" />
                Recent Attended CNEs
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Your continuous education completion records</p>
            </div>
            <button
              onClick={() => onNavigate('my_records')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
            >
              All Records
            </button>
          </div>

          <div className="space-y-3">
            {stats?.recent_attended && stats.recent_attended.length > 0 ? (
              stats.recent_attended.map((item: any) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 text-xs space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-900 line-clamp-1">{item.title}</span>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">{item.cne_id}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Attended: {item.cne_date}</span>
                    {item.percentage !== null && item.percentage !== undefined ? (
                      <span className={`font-semibold ${item.passed ? 'text-emerald-700' : 'text-rose-700'}`}>
                        Score: {item.percentage}% ({item.passed ? 'PASSED' : 'FAILED'})
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">No post-test</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 py-4 text-center">No attendance history found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

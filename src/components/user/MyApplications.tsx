import React, { useState, useEffect } from 'react';
import { ClipboardList, Calendar, Clock, MapPin, AlertCircle } from 'lucide-react';
import { CneApplication } from '../../types';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import { api } from '../../services/api';

export interface MyApplicationsProps {
  onShowToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const MyApplications: React.FC<MyApplicationsProps> = ({ onShowToast }) => {
  const [applications, setApplications] = useState<CneApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMyApplications();
  }, []);

  const loadMyApplications = async () => {
    setLoading(true);
    try {
      const res = await api.getMyApplications();
      setApplications(res.items || []);
    } catch (err: any) {
      onShowToast('error', err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-emerald-700" />
          My CNE Enrollment Applications
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Review the status of your enrollment submissions for upcoming nursing education modules
        </p>
      </div>

      {applications.length === 0 ? (
        <EmptyState
          title="No applications submitted"
          description="Browse upcoming CNE classes in the schedule and click 'Apply' to submit an enrollment request."
          icon={<ClipboardList className="w-10 h-10 text-slate-300" />}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {applications.map((app) => (
            <div
              key={app.id}
              className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <Badge status={app.status} size="sm" />
                <span className="text-[11px] text-slate-400">
                  Applied: {app.applied_at ? app.applied_at.substring(0, 10) : ''}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-sm leading-snug">
                  {app.cne_title || 'CNE Session'}
                </h3>
                {app.area_name && (
                  <span className="text-[11px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded mt-1 inline-block">
                    {app.area_name}
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-500 space-y-1 pt-1 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{app.cne_date} ({app.start_time} - {app.end_time})</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{app.venue}</span>
                </div>
              </div>

              {app.review_notes && (
                <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                  <strong>Reviewer Notes:</strong> {app.review_notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

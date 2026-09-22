import React, { useState, useEffect } from 'react';
import { FileCheck, Search, Award, Calendar, CheckCircle2, XCircle, Clock, MapPin } from 'lucide-react';
import { SearchInput } from '../common/SearchInput';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import { Button } from '../common/Button';
import { api } from '../../services/api';

export interface MyCneRecordsProps {
  onShowToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const MyCneRecords: React.FC<MyCneRecordsProps> = ({ onShowToast }) => {
  const [records, setRecords] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecords();
  }, [search]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const data = await api.getMyCneRecords(search);
      setRecords(data);
    } catch (err: any) {
      onShowToast('error', err.message || 'Failed to load personal records');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-emerald-700" />
            My CNE Attendance & Training Records
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Official institutional transcript of completed continuous nursing education modules and post-tests
          </p>
        </div>

        <div className="w-full sm:w-72">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Filter records by topic or ID..."
          />
        </div>
      </div>

      {records.length === 0 ? (
        <EmptyState
          title="No completed CNE records found"
          description="Once you attend scheduled CNE sessions and mark attendance, your verified records will appear here."
          icon={<FileCheck className="w-10 h-10 text-slate-300" />}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5">CNE ID & Title</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Date & Time</th>
                  <th className="p-3.5">Attendance</th>
                  <th className="p-3.5">Post-Test Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5">
                      <div className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mb-1">
                        {r.cne_id}
                      </div>
                      <div className="font-bold text-slate-900 text-sm">{r.title}</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">{r.venue}</div>
                    </td>

                    <td className="p-3.5">
                      <span className="px-2.5 py-1 rounded bg-slate-100 font-medium text-slate-700 text-[11px]">
                        {r.category}
                      </span>
                    </td>

                    <td className="p-3.5 text-slate-600">
                      <div className="font-medium text-slate-800">{r.cne_date}</div>
                      <div className="text-[11px] text-slate-400">{r.start_time} - {r.end_time}</div>
                    </td>

                    <td className="p-3.5">
                      <div className="flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verified</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                        {r.attendance_method}
                      </div>
                    </td>

                    <td className="p-3.5">
                      {r.percentage !== null && r.percentage !== undefined ? (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-bold ${
                                r.passed ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {r.score}/{r.max_score} ({r.percentage}%)
                            </span>
                            <Badge status={r.passed ? 'PASSED' : 'FAILED'} size="sm" />
                          </div>
                          {r.test_submitted_at && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Submitted: {r.test_submitted_at.substring(0, 10)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No attempt recorded</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

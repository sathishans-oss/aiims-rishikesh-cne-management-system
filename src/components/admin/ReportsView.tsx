import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Users, Printer, Filter } from 'lucide-react';
import { Button } from '../common/Button';
import { api } from '../../services/api';
import { Area } from '../../types';

export interface ReportsViewProps {
  onShowToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ onShowToast }) => {
  const [data, setData] = useState<any | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ area: '', category: '', status: '', date_from: '', date_to: '', employee: '' });

  useEffect(() => { api.listAreas().then(setAreas).catch(() => setAreas([])); loadReports(); }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      setData(await api.getReports(params));
    } catch (err: any) { onShowToast('error', err.message || 'Failed to load analytics'); }
    finally { setLoading(false); }
  };

  const summary = data?.summary || {};
  const categories = data?.category_breakdown || [];
  const areaBreakdown = data?.area_breakdown || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2"><BarChart3 className="w-5 h-5 text-emerald-700" />Institutional CNE Analytics & Compliance Reports</h2>
          <p className="text-xs text-slate-500 mt-1">D1-backed attendance, session and competency metrics. All active filters are applied server-side.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()} icon={<Printer className="w-4 h-4" />}>Print Report</Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-3"><Filter className="w-4 h-4 text-emerald-700" />Report Filters</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <select value={filters.area} onChange={e=>setFilters({...filters,area:e.target.value})} className="border rounded-lg px-3 py-2"><option value="">All Areas</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <input value={filters.category} onChange={e=>setFilters({...filters,category:e.target.value})} placeholder="Category (exact)" className="border rounded-lg px-3 py-2" />
          <select value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})} className="border rounded-lg px-3 py-2"><option value="">All statuses</option><option>Scheduled</option><option>Modified & Scheduled</option><option>Completed</option><option>Canceled</option></select>
          <input type="date" value={filters.date_from} onChange={e=>setFilters({...filters,date_from:e.target.value})} className="border rounded-lg px-3 py-2" />
          <input type="date" value={filters.date_to} onChange={e=>setFilters({...filters,date_to:e.target.value})} className="border rounded-lg px-3 py-2" />
          <input value={filters.employee} onChange={e=>setFilters({...filters,employee:e.target.value})} placeholder="Employee ID / name" className="border rounded-lg px-3 py-2" />
        </div>
        <div className="flex justify-end mt-3 gap-2"><Button variant="ghost" size="sm" onClick={()=>setFilters({area:'',category:'',status:'',date_from:'',date_to:'',employee:''})}>Reset</Button><Button variant="primary" size="sm" onClick={loadReports} loading={loading}>Apply Filters</Button></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ['Total CNE Workshops', summary.total_cnes ?? 0],
          ['Verified Attendances', summary.total_attendance_records ?? 0],
          ['Competency Pass Rate', `${summary.overall_pass_rate ?? 0}%`],
          ['Average Test Score', summary.post_test_attempts ? `${summary.average_percentage ?? 0}%` : 'No attempts']
        ].map(([label,value])=><div key={String(label)} className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs"><span className="text-xs text-slate-500 font-medium">{label}</span><div className="text-2xl font-extrabold text-slate-900 mt-1">{value}</div></div>)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-700" />Sessions by Clinical Category</h3>
          {categories.length ? categories.map((item:any)=><div key={item.category} className="flex justify-between text-xs border-b border-slate-100 py-2"><span>{item.category}</span><strong>{item.cne_count} sessions</strong></div>) : <p className="text-xs text-slate-400">No matching category data.</p>}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Users className="w-4 h-4 text-emerald-700" />Participation by Clinical Area</h3>
          {areaBreakdown.length ? areaBreakdown.map((item:any)=><div key={item.area_id} className="flex justify-between text-xs border-b border-slate-100 py-2"><span>{item.area_name}</span><strong>{item.attendance_count} attendances • {item.cne_count} CNEs</strong></div>) : <p className="text-xs text-slate-400">No matching Area data.</p>}
        </div>
      </div>
    </div>
  );
};

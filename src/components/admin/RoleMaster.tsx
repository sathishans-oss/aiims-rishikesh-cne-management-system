import React, { useEffect, useState } from 'react';
import { Users, RefreshCw, CheckCircle2 } from 'lucide-react';
import { UserRole, Area } from '../../types';
import { SearchInput } from '../common/SearchInput';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { api } from '../../services/api';

export interface RoleMasterProps {
  onShowToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const RoleMaster: React.FC<RoleMasterProps> = ({ onShowToast }) => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any | null>(null);
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('EMPLOYEE');
  const [selectedArea, setSelectedArea] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => { loadReferenceData(); }, []);
  useEffect(() => { loadEmployees(); }, [search]);

  const loadReferenceData = async () => {
    try {
      const [areaRows, assignmentRows] = await Promise.all([api.listAreas(true), api.listAreaIncharges()]);
      setAreas(areaRows.filter(a => a.active !== false));
      setAssignments(assignmentRows);
    } catch (err: any) {
      onShowToast('error', err.message || 'Failed to load role reference data');
    }
  };

  const loadEmployees = async () => {
    setLoading(true);
    try { setEmployees(await api.listEmployees(search)); }
    catch (err: any) { onShowToast('error', err.message || 'Failed to load employees'); }
    finally { setLoading(false); }
  };

  const handleSyncOfficers = async () => {
    setSyncing(true); setSyncResult(null);
    try {
      const res = await api.syncOfficers();
      setSyncResult(res);
      onShowToast('success', res.message || `Synchronized ${res.syncedCount || 0} officers.`);
      await loadEmployees();
    } catch (err: any) { onShowToast('error', err.message || 'Officers sync failed'); }
    finally { setSyncing(false); }
  };

  const handleOpenAssign = (emp: any) => {
    setSelectedEmp(emp);
    const firstPrivileged = (emp.roles || []).find((r: string) => r === 'ADMIN' || r === 'AREA_INCHARGE');
    setSelectedRole((firstPrivileged || 'EMPLOYEE') as UserRole);
    const currentAssignment = assignments.find(a => a.employee_id === emp.employee_id && Number(a.active) === 1);
    setSelectedArea(currentAssignment?.area_id || '');
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;
    if (selectedRole === 'AREA_INCHARGE' && !selectedArea) {
      onShowToast('error', 'Select the clinical Area for the Area In-Charge.');
      return;
    }
    setAssigning(true);
    try {
      await api.assignRole(selectedEmp.employee_id, selectedRole);
      const existing = assignments.filter(a => a.employee_id === selectedEmp.employee_id && Number(a.active) === 1);
      if (selectedRole === 'AREA_INCHARGE') {
        for (const row of existing) {
          if (row.area_id !== selectedArea) await api.removeAreaIncharge(selectedEmp.employee_id, row.area_id);
        }
        await api.assignAreaIncharge(selectedEmp.employee_id, selectedArea);
      } else {
        for (const row of existing) await api.removeAreaIncharge(selectedEmp.employee_id, row.area_id);
      }
      onShowToast('success', selectedRole === 'AREA_INCHARGE' ? 'Role and clinical Area assigned.' : `Role ${selectedRole} assigned.`);
      setSelectedEmp(null);
      await Promise.all([loadEmployees(), loadReferenceData()]);
    } catch (err: any) { onShowToast('error', err.message || 'Role assignment failed'); }
    finally { setAssigning(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2"><Users className="w-5 h-5 text-emerald-700" />Institutional Officers & Role Governance</h2>
          <p className="text-xs text-slate-500 mt-1">Manage application roles, Area In-Charge scope, and the synchronized institutional Officers master.</p>
        </div>
        <Button variant="primary" size="md" loading={syncing} onClick={handleSyncOfficers} icon={<RefreshCw className="w-4 h-4" />}>{syncing ? 'Synchronizing Master...' : 'Sync Officers Sheet'}</Button>
      </div>

      {syncResult && <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{syncResult.message || 'Authoritative Officers Master synchronized.'}</div>}

      <div className="bg-white p-4 rounded-xl border border-slate-200"><div className="w-full sm:w-80"><SearchInput value={search} onChange={setSearch} placeholder="Search by officer name, ID, or designation..." /></div></div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]"><tr><th className="p-3.5">Employee ID</th><th className="p-3.5">Officer</th><th className="p-3.5">Designation & Department</th><th className="p-3.5">Roles</th><th className="p-3.5">Area In-Charge Scope</th><th className="p-3.5 text-right">Action</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && employees.map(emp => {
              const scoped = assignments.filter(a => a.employee_id === emp.employee_id && Number(a.active) === 1);
              return <tr key={emp.employee_id} className="hover:bg-slate-50/60"><td className="p-3.5 font-mono font-bold">{emp.employee_id}</td><td className="p-3.5 font-bold">{emp.name}</td><td className="p-3.5 text-slate-600"><div>{emp.designation}</div><div className="text-[11px] text-slate-400">{emp.department}</div></td><td className="p-3.5"><div className="flex flex-wrap gap-1">{(emp.roles?.length ? emp.roles : ['EMPLOYEE']).map((r: string) => <Badge key={r} status={r} size="sm" />)}</div></td><td className="p-3.5 text-slate-600">{scoped.length ? scoped.map(a => a.area_name || a.area_id).join(', ') : '—'}</td><td className="p-3.5 text-right"><button onClick={() => handleOpenAssign(emp)} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">Assign Role</button></td></tr>;
            })}
          </tbody>
        </table></div>
      </div>

      {selectedEmp && <Modal isOpen={true} onClose={() => setSelectedEmp(null)} maxWidth="md" title={`Assign Role: ${selectedEmp.name}`} subtitle={`Employee ID: ${selectedEmp.employee_id}`}>
        <form onSubmit={handleSaveRole} className="space-y-4">
          <div><label className="block text-xs font-semibold text-slate-700 mb-1">System Role</label><select value={selectedRole} onChange={e => setSelectedRole(e.target.value as UserRole)} className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"><option value="EMPLOYEE">EMPLOYEE</option><option value="AREA_INCHARGE">AREA_INCHARGE</option><option value="ADMIN">ADMIN</option></select></div>
          {selectedRole === 'AREA_INCHARGE' && <div><label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Clinical Area *</label><select required value={selectedArea} onChange={e => setSelectedArea(e.target.value)} className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"><option value="">Select Area</option>{areas.map(a => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}</select><p className="text-[11px] text-slate-500 mt-1">Area In-Charge administrative actions are enforced server-side for this Area.</p></div>}
          <div className="pt-2 flex justify-end gap-2"><Button type="button" variant="ghost" size="md" onClick={() => setSelectedEmp(null)}>Cancel</Button><Button type="submit" variant="primary" size="md" loading={assigning}>Confirm Assignment</Button></div>
        </form>
      </Modal>}
    </div>
  );
};

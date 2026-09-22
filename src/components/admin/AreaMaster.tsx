import React, { useState, useEffect } from 'react';
import { FolderTree, Plus, Edit2, CheckCircle2, XCircle } from 'lucide-react';
import { Area } from '../../types';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { api } from '../../services/api';

export interface AreaMasterProps {
  onShowToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const AreaMaster: React.FC<AreaMasterProps> = ({ onShowToast }) => {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAreas();
  }, []);

  const loadAreas = async () => {
    setLoading(true);
    try {
      const data = await api.listAreas(true);
      setAreas(data);
    } catch (err: any) {
      onShowToast('error', err.message || 'Failed to load areas');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingArea(null);
    setName('');
    setCode('');
    setDescription('');
    setShowModal(true);
  };

  const handleOpenEdit = (a: Area) => {
    setEditingArea(a);
    setName(a.name);
    setCode(a.code);
    setDescription(a.description || '');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      onShowToast('error', 'Area name and code are required.');
      return;
    }

    setSaving(true);
    try {
      if (editingArea) {
        await api.updateArea(editingArea.id, {
          name: name.trim(),
          description: description.trim(),
          active: Boolean(editingArea.active)
        });
        onShowToast('success', 'Area updated successfully.');
      } else {
        await api.createArea({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim()
        });
        onShowToast('success', 'New area created.');
      }
      setShowModal(false);
      loadAreas();
    } catch (err: any) {
      onShowToast('error', err.message || 'Failed to save area');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (a: Area) => {
    try {
      await api.updateArea(a.id, {
        active: !a.active
      });
      onShowToast('success', `Area ${a.name} ${!a.active ? 'activated' : 'deactivated'}.`);
      loadAreas();
    } catch (err: any) {
      onShowToast('error', err.message || 'Failed to update area status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-emerald-700" />
            Hospital Clinical Areas & Wards Master
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure institutional clinical departments, intensive care units, and wards hosting CNE modules
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={handleOpenCreate}
          icon={<Plus className="w-4 h-4" />}
          className="font-semibold shadow-xs shrink-0"
        >
          Add Clinical Area
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="p-3.5">Code</th>
              <th className="p-3.5">Area / Ward Name</th>
              <th className="p-3.5">Description</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {areas.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="p-3.5 font-mono font-bold text-emerald-800">
                  {a.code}
                </td>
                <td className="p-3.5 font-bold text-slate-900">
                  {a.name}
                </td>
                <td className="p-3.5 text-slate-500 max-w-sm">
                  {a.description || '—'}
                </td>
                <td className="p-3.5">
                  <Badge status={a.active ? 'ACTIVE' : 'INACTIVE'} size="sm" />
                </td>
                <td className="p-3.5 text-right space-x-2">
                  <button
                    onClick={() => handleToggleActive(a)}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                  >
                    {a.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleOpenEdit(a)}
                    className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        maxWidth="md"
        title={editingArea ? 'Edit Clinical Area' : 'Add New Clinical Area'}
        subtitle="Clinical areas categorize CNE sessions and host specialized competencies"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Area Code * (e.g. ICU, ER, PED)
            </label>
            <input
              type="text"
              required
              disabled={!!editingArea}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. ICU"
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-mono uppercase focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Clinical Area / Ward Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Intensive Care & High Dependency Unit"
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope of clinical nursing education conducted here..."
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="md" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" loading={saving}>
              {editingArea ? 'Save Area' : 'Create Area'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

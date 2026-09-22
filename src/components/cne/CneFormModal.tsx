import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Clock, MapPin, Users, Award } from 'lucide-react';
import { Cne, Area } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Select } from '../common/Select';
import { api } from '../../services/api';

export interface CneFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  cneToEdit?: Cne | null;
  areas: Area[];
  onSaved: () => void;
  onShowToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const CneFormModal: React.FC<CneFormModalProps> = ({
  isOpen,
  onClose,
  cneToEdit,
  areas,
  onSaved,
  onShowToast
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Critical Care & Sepsis');
  const [areaId, setAreaId] = useState('');
  const [venue, setVenue] = useState('Auditorium Hall 2, AIIMS Rishikesh');
  const [cneDate, setCneDate] = useState('');
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('16:00');
  const [capacity, setCapacity] = useState(30);

  // Resource Persons
  const [resourcePersons, setResourcePersons] = useState<
    Array<{ employee_id: string; role_title: string; name?: string }>
>([{ employee_id: '', role_title: 'Primary Speaker' }]);

  const [resourceDirectory, setResourceDirectory] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    api.searchResourcePersons('').then(setResourceDirectory).catch(() => setResourceDirectory([]));
    if (cneToEdit) {
      setTitle(cneToEdit.title);
      setCategory(cneToEdit.category);
      setAreaId(cneToEdit.area_id);
      setVenue(cneToEdit.venue);
      setCneDate(cneToEdit.cne_date);
      setStartTime(cneToEdit.start_time);
      setEndTime(cneToEdit.end_time);
      setCapacity(cneToEdit.capacity);
      if (cneToEdit.resource_persons && cneToEdit.resource_persons.length > 0) {
        setResourcePersons(
          cneToEdit.resource_persons.map((rp) => ({
            employee_id: rp.employee_id,
            role_title: rp.role_title,
            name: rp.name
          }))
        );
      }
    } else {
      // Default to next week
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      setTitle('');
      setCategory('Critical Care & Sepsis');
      setAreaId(areas[0]?.id || '');
      setVenue('Auditorium Hall 2, AIIMS Rishikesh');
      setCneDate(nextWeek.toISOString().split('T')[0]);
      setStartTime('14:00');
      setEndTime('16:00');
      setCapacity(30);
      setResourcePersons([{ employee_id: '', role_title: 'Primary Speaker' }]);
    }
  }, [isOpen, cneToEdit, areas]);

  const handleAddResourcePerson = () => {
    setResourcePersons([
      ...resourcePersons,
      { employee_id: '', role_title: 'Co-Speaker / Demonstrator' }
    ]);
  };

  const handleRemoveResourcePerson = (index: number) => {
    setResourcePersons(resourcePersons.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !areaId || !cneDate) {
      onShowToast('error', 'Title, Area, and Date are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        category,
        area_id: areaId,
        venue: venue.trim(),
        cne_date: cneDate,
        start_time: startTime,
        end_time: endTime,
        capacity: Number(capacity),
        resource_persons: resourcePersons
      };

      if (cneToEdit) {
        await api.modifyCne(cneToEdit.id, payload);
        onShowToast('success', 'CNE session updated successfully.');
      } else {
        await api.createCne(payload);
        onShowToast('success', 'New CNE session scheduled successfully.');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      onShowToast('error', err.message || 'Failed to save CNE');
    } finally {
      setSaving(false);
    }
  };

  const CATEGORIES = [
    'Critical Care & Sepsis',
    'Emergency & Trauma Nursing',
    'Infection Control & Antimicrobial Stewardship',
    'Pediatric & Neonatal Resuscitation',
    'Oncology Nursing & Chemotherapy Safety',
    'Cardiopulmonary Resuscitation (BLS/ACLS)',
    'Hemodialysis & Renal Care',
    'Operating Room Protocols & Patient Safety'
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title={cneToEdit ? 'Modify Scheduled CNE' : 'Schedule New CNE Session'}
      subtitle="Configure clinical nursing education workshop parameters, timings, and faculty"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Session Title / Module Name *
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Advanced Mechanical Ventilation & Tracheostomy Care Protocols"
            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 shadow-xs"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Clinical Category *"
            options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />

          <Select
            label="Host Area / Ward *"
            options={areas.map((a) => ({ value: a.id, label: `${a.name} (${a.code})` }))}
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Venue *</label>
          <input
            type="text"
            required
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="e.g. Skills Lab 2 / Simulation Center"
            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 shadow-xs"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">CNE Date *</label>
            <input
              type="date"
              required
              value={cneDate}
              onChange={(e) => setCneDate(e.target.value)}
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time</label>
            <input
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">End Time</label>
            <input
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 shadow-xs"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Participant Capacity</label>
          <input
            type="number"
            min={5}
            max={200}
            required
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="w-32 px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 shadow-xs"
          />
        </div>

        {/* Resource Persons Faculty Mapping */}
        <div className="pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-emerald-700" />
              Faculty & Resource Persons
            </label>
            <button
              type="button"
              onClick={handleAddResourcePerson}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Faculty
            </button>
          </div>

          <datalist id="resource-person-directory">
            {resourceDirectory.map((person: any) => (
              <option key={person.employee_id} value={person.employee_id}>
                {person.name} — {person.designation} — {person.department}
              </option>
            ))}
          </datalist>
          <p className="text-[11px] text-slate-500 mb-2">Type an Employee ID or choose from the synchronized Officers directory. The server verifies every selected resource person.</p>
          <div className="space-y-2">
            {resourcePersons.map((rp, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <input
                  type="text"
                  required
                  value={rp.employee_id}
                  onChange={(e) => {
                    const updated = [...resourcePersons];
                    updated[idx].employee_id = e.target.value.toUpperCase();
                    setResourcePersons(updated);
                  }}
                  placeholder="Search/select Employee ID"
                  list="resource-person-directory"
                  className="w-48 px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs uppercase font-mono tracking-wider"
                />
                <input
                  type="text"
                  required
                  value={rp.role_title}
                  onChange={(e) => {
                    const updated = [...resourcePersons];
                    updated[idx].role_title = e.target.value;
                    setResourcePersons(updated);
                  }}
                  placeholder="Faculty Role (e.g. Lead Instructor)"
                  className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                />
                {resourcePersons.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveResourcePerson(idx)}
                    className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" loading={saving}>
            {cneToEdit ? 'Save Changes' : 'Schedule CNE'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

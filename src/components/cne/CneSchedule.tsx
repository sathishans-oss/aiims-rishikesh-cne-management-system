import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Search,
  Filter,
  Plus,
  ArrowRight,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Cne, Area, User } from '../../types';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { SearchInput } from '../common/SearchInput';
import { Select } from '../common/Select';
import { EmptyState } from '../common/EmptyState';

export interface CneScheduleProps {
  cnes: Cne[];
  areas: Area[];
  currentUser: User | null;
  onSelectCne: (cne: Cne) => void;
  onCreateCne?: () => void;
  onApplyCne?: (cne: Cne) => void;
  onTakePostTest?: (cne: Cne) => void;
  isLoading?: boolean;
}

export const CneSchedule: React.FC<CneScheduleProps> = ({
  cnes,
  areas,
  currentUser,
  onSelectCne,
  onCreateCne,
  onApplyCne,
  onTakePostTest,
  isLoading
}) => {
  const [search, setSearch] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  const isAdmin = currentUser?.isAdmin || false;
  const isAreaIncharge = currentUser?.isAreaIncharge || false;
  const canManage = isAdmin || isAreaIncharge;

  // Derive unique categories from existing cnes
  const categories = Array.from(new Set(cnes.map((c) => c.category).filter(Boolean)));

  const filteredCnes = cnes.filter((c) => {
    if (search) {
      const q = search.toLowerCase();
      const match =
        c.title.toLowerCase().includes(q) ||
        c.cne_id.toLowerCase().includes(q) ||
        c.venue.toLowerCase().includes(q) ||
        (c.area_name && c.area_name.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (selectedArea && c.area_id !== selectedArea) return false;
    if (selectedCategory && c.category !== selectedCategory) return false;
    if (selectedStatus && c.status !== selectedStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-emerald-700" />
            CNE Academic Sessions & Schedule
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Browse upcoming workshops, verify capacity, and submit enrollment applications
          </p>
        </div>
        {canManage && onCreateCne && (
          <Button
            variant="primary"
            size="md"
            onClick={onCreateCne}
            icon={<Plus className="w-4 h-4" />}
            className="font-semibold shadow-xs shrink-0"
          >
            Create New CNE
          </Button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by topic, CNE ID, venue..."
          />

          <Select
            options={areas.map((a) => ({ value: a.id, label: `${a.name} (${a.code})` }))}
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            placeholder="All Clinical Areas"
          />

          <Select
            options={categories.map((cat) => ({ value: cat, label: cat }))}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            placeholder="All Categories"
          />

          <Select
            options={[
              { value: 'Scheduled', label: 'Scheduled' },
              { value: 'Modified & Scheduled', label: 'Modified & Scheduled' },
              { value: 'Completed', label: 'Completed' },
              { value: 'Canceled', label: 'Canceled' }
            ]}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            placeholder="All Statuses"
          />
        </div>

        {(search || selectedArea || selectedCategory || selectedStatus) && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span>
              Showing <strong>{filteredCnes.length}</strong> of <strong>{cnes.length}</strong> sessions
            </span>
            <button
              onClick={() => {
                setSearch('');
                setSelectedArea('');
                setSelectedCategory('');
                setSelectedStatus('');
              }}
              className="text-emerald-700 hover:text-emerald-800 font-medium cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* CNE Grid Cards */}
      {filteredCnes.length === 0 ? (
        <EmptyState
          title="No CNE sessions found"
          description="Try adjusting your search terms or filter selections to view available classes."
          icon={<GraduationCap className="w-10 h-10 text-slate-300" />}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCnes.map((cne) => {
            const isFull = (cne.participants_count || 0) >= cne.capacity;
            const canApply =
              currentUser &&
              (cne.status === 'Scheduled' || cne.status === 'Modified & Scheduled') &&
              !cne.my_application_status &&
              !isFull;

            return (
              <div
                key={cne.id}
                className="bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-emerald-500/80 transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                      {cne.cne_id}
                    </span>
                    <Badge status={cne.status} size="sm" />
                  </div>

                  <h3
                    onClick={() => onSelectCne(cne)}
                    className="font-bold text-slate-900 text-base leading-snug group-hover:text-emerald-800 transition-colors cursor-pointer line-clamp-2"
                  >
                    {cne.title}
                  </h3>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {cne.category}
                    </span>
                    {cne.area_name && (
                      <span className="text-[11px] font-medium text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                        {cne.area_name}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600 space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{cne.cne_date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{cne.start_time} - {cne.end_time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{cne.venue}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        Capacity: {cne.participants_count || 0} / {cne.capacity}
                      </span>
                      {isFull && <span className="font-semibold text-rose-600">Full</span>}
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onSelectCne(cne)}
                    className="text-xs font-semibold text-slate-700 hover:text-emerald-800 cursor-pointer inline-flex items-center gap-1"
                  >
                    View Details
                  </button>

                  <div className="flex items-center gap-2">
                    {cne.my_application_status ? (
                      <span className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                        Applied: <Badge status={cne.my_application_status} size="sm" />
                      </span>
                    ) : canApply && onApplyCne ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onApplyCne(cne)}
                        className="font-semibold"
                      >
                        Apply
                      </Button>
                    ) : null}

                    {cne.attended && onTakePostTest && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onTakePostTest(cne)}
                        className="font-semibold text-emerald-800 border-emerald-300 hover:bg-emerald-50"
                      >
                        Post-Test
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

import React from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  FileText,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Award,
  Users,
  Activity,
  ArrowRight,
  BookOpen
} from 'lucide-react';
import { PublicHomeData, Cne } from '../../types';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';

export interface PublicHomeProps {
  data: PublicHomeData | null;
  onSelectCne: (cne: Cne) => void;
  onOpenLogin: () => void;
  onViewAllClasses: () => void;
}

export const PublicHome: React.FC<PublicHomeProps> = ({
  data,
  onSelectCne,
  onOpenLogin,
  onViewAllClasses
}) => {
  if (!data) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 rounded-2xl text-white p-6 sm:p-8 mb-8 shadow-sm border border-emerald-950">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-emerald-800/80 rounded-md text-emerald-200 text-xs font-semibold mb-3 border border-emerald-700/60">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Institutional Academic Portal
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Clinical Nursing Education & Continuous Competency Development
          </h2>
          <p className="mt-2.5 text-sm sm:text-base text-emerald-100 leading-relaxed">
            Empowering nursing professionals through standardized, evidence-based clinical training modules, hands-on workshops, and continuous skill assessments at AIIMS Rishikesh.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={onViewAllClasses}
              icon={<Calendar className="w-4 h-4 text-emerald-800" />}
              className="font-semibold"
            >
              Browse CNE Calendar
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={onOpenLogin}
              className="bg-emerald-900/60 text-white hover:bg-emerald-800/80 border-emerald-700 font-semibold"
            >
              Employee Portal Sign In
            </Button>
          </div>
        </div>
      </div>

      {/* Grid: 2/3 Main Content + 1/3 Right Info Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: 2/3 Main Content */}
        {/* ========================================================================= */}
        <div className="lg:col-span-2 space-y-8">
          {/* Chairperson Vision Statement */}
          {data.chairperson && (
            <div className="bg-white rounded-xl border border-slate-200/90 p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start gap-6">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-emerald-50 border border-emerald-200 overflow-hidden shrink-0 shadow-xs flex items-center justify-center">
                  {data.chairperson.photo_url ? (
                    <img
                      src={data.chairperson.photo_url}
                      alt={data.chairperson.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Award className="w-12 h-12 text-emerald-800" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-2">
                    <Award className="w-3.5 h-3.5 text-emerald-700" />
                    Leadership Message
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{data.chairperson.name}</h3>
                  <p className="text-xs font-medium text-slate-500">{data.chairperson.designation}</p>
                  <p className="mt-3 text-sm text-slate-700 leading-relaxed whitespace-pre-line italic border-l-2 border-emerald-600 pl-4 my-3 bg-emerald-50/30 py-2 rounded-r-lg">
                    "{data.chairperson.message}"
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Upcoming CNE Highlights */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-700" />
                  Upcoming CNE Sessions & Workshops
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Scheduled clinical training modules open for enrollment</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onViewAllClasses}
                className="text-emerald-700 hover:text-emerald-800 font-semibold"
              >
                View All <ChevronRight className="w-4 h-4 ml-0.5" />
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.upcoming_highlights && data.upcoming_highlights.length > 0 ? (
                data.upcoming_highlights.map((cne) => (
                  <div
                    key={cne.cne_id}
                    onClick={() => onSelectCne(cne)}
                    className="p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer bg-slate-50/40 hover:bg-white flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {cne.cne_id}
                        </span>
                        <Badge status={cne.status} size="sm" />
                      </div>
                      <h4 className="font-semibold text-slate-900 text-sm group-hover:text-emerald-800 line-clamp-2 leading-snug">
                        {cne.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 font-medium">{cne.category}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1.5">
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
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-center py-8 text-slate-500 text-sm">
                  No upcoming CNE highlights found at this time.
                </div>
              )}
            </div>
          </div>

          {/* Institutional Gallery Showcase */}
          {data.gallery && data.gallery.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-700" />
                Training & Simulation Activities
              </h3>
              <p className="text-xs text-slate-500 mb-4">Glimpses of clinical education, bedside workshops, and simulation drills</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {data.gallery.map((item) => (
                  <div
                    key={item.id}
                    className="group relative rounded-lg overflow-hidden bg-slate-100 aspect-4/3 border border-slate-200 shadow-2xs"
                  >
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent opacity-90 p-2.5 flex flex-col justify-end text-white">
                      <p className="text-xs font-semibold leading-tight line-clamp-1">{item.title}</p>
                      {item.caption && (
                        <p className="text-[10px] text-slate-200 line-clamp-1 mt-0.5">{item.caption}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: 1/3 Info Panel */}
        {/* ========================================================================= */}
        <div className="space-y-6">
          {/* Key Institutional Impact Data Cards */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-700" />
              Institutional Impact
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {data.institutional && data.institutional.map((m) => (
                <div
                  key={m.key}
                  className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 flex flex-col"
                >
                  <span className="text-xs text-slate-500 font-medium line-clamp-1">{m.label}</span>
                  <span className="text-xl font-extrabold text-emerald-800 mt-1">{m.value}</span>
                  {m.description && (
                    <span className="text-[10px] text-slate-400 mt-1 line-clamp-1">{m.description}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Coordinator's Desk */}
          {data.coordinator && (
            <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
              <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
                <BookOpen className="w-4 h-4 text-emerald-700" />
                Coordinator's Desk
              </div>
              <h4 className="text-sm font-bold text-slate-900">{data.coordinator.name}</h4>
              <p className="text-xs text-slate-500 font-medium">{data.coordinator.title}</p>
              <p className="mt-2.5 text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                {data.coordinator.message}
              </p>
            </div>
          )}

          {/* News & Circulars */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-700" />
                News & Circulars
              </h3>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                Official
              </span>
            </div>
            <div className="space-y-3">
              {data.news && data.news.length > 0 ? (
                data.news.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-slate-100 hover:border-slate-200 bg-slate-50/40 text-xs transition-colors"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span>{item.publication_date}</span>
                    </div>
                    <h5 className="font-semibold text-slate-800 leading-snug">{item.title}</h5>
                    <p className="text-slate-600 mt-1 line-clamp-2 leading-normal">{item.content}</p>
                    {item.file_url && (
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 mt-2"
                      >
                        Download Circular <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500">No active circulars at this moment.</p>
              )}
            </div>
          </div>

          {/* Quick Links */}
          {data.quick_links && data.quick_links.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-emerald-700" />
                Quick Links
              </h3>
              <div className="space-y-1.5">
                {data.quick_links.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 text-xs font-medium text-slate-700 hover:text-emerald-800 transition-colors group"
                  >
                    <span>{link.title}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

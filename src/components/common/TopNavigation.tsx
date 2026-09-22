import React, { useState } from 'react';
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  ClipboardList,
  FileCheck,
  GraduationCap,
  Settings,
  FolderTree,
  Users,
  BarChart3,
  Globe,
  Activity,
  Menu,
  X,
  ChevronDown
} from 'lucide-react';
import { UserRole } from '../../types';

export type NavTab =
  | 'home'
  | 'dashboard'
  | 'upcoming_classes'
  | 'calendar'
  | 'my_records'
  | 'my_applications'
  | 'resources'
  | 'admin_cne'
  | 'admin_applications'
  | 'admin_areas'
  | 'admin_roles'
  | 'admin_content'
  | 'admin_reports'
  | 'admin_diagnostics';

export interface TopNavigationProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  roles: UserRole[];
}

export const TopNavigation: React.FC<TopNavigationProps> = ({
  currentTab,
  onSelectTab,
  roles
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);

  const isAdmin = roles.includes('ADMIN');
  const isAreaIncharge = roles.includes('AREA_INCHARGE');

  const navItemClass = (tab: NavTab) => {
    const isActive = currentTab === tab;
    return `inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer select-none whitespace-nowrap ${
      isActive
        ? 'bg-emerald-800 text-white shadow-xs'
        : 'text-slate-200 hover:text-white hover:bg-emerald-950/60'
    }`;
  };

  const isAdminTabActive = [
    'admin_cne',
    'admin_applications',
    'admin_areas',
    'admin_roles',
    'admin_content',
    'admin_reports',
    'admin_diagnostics'
  ].includes(currentTab);

  return (
    <nav className="bg-emerald-900 border-b border-emerald-950 text-white sticky top-16 sm:top-20 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12">
          {/* Desktop Navigation Items */}
          <div className="hidden lg:flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
            <button
              onClick={() => onSelectTab('dashboard')}
              className={navItemClass('dashboard')}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => onSelectTab('upcoming_classes')}
              className={navItemClass('upcoming_classes')}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Upcoming Classes</span>
            </button>

            <button
              onClick={() => onSelectTab('calendar')}
              className={navItemClass('calendar')}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Calendar</span>
            </button>

            <button
              onClick={() => onSelectTab('my_records')}
              className={navItemClass('my_records')}
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>My CNE Records</span>
            </button>

            <button
              onClick={() => onSelectTab('my_applications')}
              className={navItemClass('my_applications')}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>My Applications</span>
            </button>

            <button
              onClick={() => onSelectTab('resources')}
              className={navItemClass('resources')}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Learning Resources</span>
            </button>

            {/* Incharge / Admin shared tab */}
            {(isAdmin || isAreaIncharge) && (
              <button
                onClick={() => onSelectTab('admin_applications')}
                className={navItemClass('admin_applications')}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Applications Review</span>
              </button>
            )}

            {/* Admin Modules Dropdown */}
            {isAdmin && (
              <div className="relative">
                <button
                  onClick={() => setAdminDropdownOpen(!adminDropdownOpen)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer select-none ${
                    isAdminTabActive
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'text-slate-200 hover:text-white hover:bg-emerald-950/60'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Admin Control</span>
                  <ChevronDown className="w-3 h-3 ml-0.5" />
                </button>

                {adminDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setAdminDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-30 text-slate-800 animate-in fade-in-50 duration-100">
                      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        CNE Operations
                      </div>
                      <button
                        onClick={() => {
                          onSelectTab('admin_cne');
                          setAdminDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 hover:bg-slate-50 cursor-pointer ${
                          currentTab === 'admin_cne' ? 'text-emerald-700 font-semibold bg-emerald-50/50' : 'text-slate-700'
                        }`}
                      >
                        <GraduationCap className="w-4 h-4 text-slate-400" />
                        <span>CNE Management</span>
                      </button>

                      <button
                        onClick={() => {
                          onSelectTab('admin_reports');
                          setAdminDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 hover:bg-slate-50 cursor-pointer ${
                          currentTab === 'admin_reports' ? 'text-emerald-700 font-semibold bg-emerald-50/50' : 'text-slate-700'
                        }`}
                      >
                        <BarChart3 className="w-4 h-4 text-slate-400" />
                        <span>Reports & Statistics</span>
                      </button>

                      <div className="my-1 border-t border-slate-100" />
                      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Institutional Masters
                      </div>

                      <button
                        onClick={() => {
                          onSelectTab('admin_areas');
                          setAdminDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 hover:bg-slate-50 cursor-pointer ${
                          currentTab === 'admin_areas' ? 'text-emerald-700 font-semibold bg-emerald-50/50' : 'text-slate-700'
                        }`}
                      >
                        <FolderTree className="w-4 h-4 text-slate-400" />
                        <span>Area Master</span>
                      </button>

                      <button
                        onClick={() => {
                          onSelectTab('admin_roles');
                          setAdminDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 hover:bg-slate-50 cursor-pointer ${
                          currentTab === 'admin_roles' ? 'text-emerald-700 font-semibold bg-emerald-50/50' : 'text-slate-700'
                        }`}
                      >
                        <Users className="w-4 h-4 text-slate-400" />
                        <span>Role Master & Sync</span>
                      </button>

                      <button
                        onClick={() => {
                          onSelectTab('admin_content');
                          setAdminDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 hover:bg-slate-50 cursor-pointer ${
                          currentTab === 'admin_content' ? 'text-emerald-700 font-semibold bg-emerald-50/50' : 'text-slate-700'
                        }`}
                      >
                        <Globe className="w-4 h-4 text-slate-400" />
                        <span>Admin Content (CMS)</span>
                      </button>

                      <button
                        onClick={() => {
                          onSelectTab('admin_diagnostics');
                          setAdminDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 hover:bg-slate-50 cursor-pointer ${
                          currentTab === 'admin_diagnostics' ? 'text-emerald-700 font-semibold bg-emerald-50/50' : 'text-slate-700'
                        }`}
                      >
                        <Activity className="w-4 h-4 text-slate-400" />
                        <span>System Diagnostics</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Public Home button */}
          <div className="hidden lg:flex items-center">
            <button
              onClick={() => onSelectTab('home')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                currentTab === 'home'
                  ? 'bg-emerald-800 text-white'
                  : 'text-slate-200 hover:text-white hover:bg-emerald-950/60'
              }`}
            >
              Public Home
            </button>
          </div>

          {/* Mobile menu trigger */}
          <div className="lg:hidden flex items-center justify-between w-full">
            <span className="text-xs font-semibold tracking-wide text-emerald-100 uppercase">
              {currentTab.replace('_', ' ')}
            </span>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-slate-200 hover:text-white p-1 rounded-md cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-3 border-t border-emerald-800 space-y-1">
            <button
              onClick={() => {
                onSelectTab('home');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-800 rounded-lg flex items-center gap-2 cursor-pointer"
            >
              <Globe className="w-4 h-4" /> Public Home
            </button>
            <button
              onClick={() => {
                onSelectTab('dashboard');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-800 rounded-lg flex items-center gap-2 cursor-pointer"
            >
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>
            <button
              onClick={() => {
                onSelectTab('upcoming_classes');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-800 rounded-lg flex items-center gap-2 cursor-pointer"
            >
              <GraduationCap className="w-4 h-4" /> Upcoming Classes
            </button>
            <button
              onClick={() => {
                onSelectTab('calendar');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-800 rounded-lg flex items-center gap-2 cursor-pointer"
            >
              <Calendar className="w-4 h-4" /> Calendar
            </button>
            <button
              onClick={() => {
                onSelectTab('my_records');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-800 rounded-lg flex items-center gap-2 cursor-pointer"
            >
              <FileCheck className="w-4 h-4" /> My CNE Records
            </button>
            <button
              onClick={() => {
                onSelectTab('my_applications');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-800 rounded-lg flex items-center gap-2 cursor-pointer"
            >
              <ClipboardList className="w-4 h-4" /> My Applications
            </button>
            <button
              onClick={() => {
                onSelectTab('resources');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-800 rounded-lg flex items-center gap-2 cursor-pointer"
            >
              <BookOpen className="w-4 h-4" /> Learning Resources
            </button>

            {(isAdmin || isAreaIncharge) && (
              <button
                onClick={() => {
                  onSelectTab('admin_applications');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-800 rounded-lg flex items-center gap-2 cursor-pointer"
              >
                <ClipboardList className="w-4 h-4" /> Applications Review
              </button>
            )}

            {isAdmin && (
              <div className="pt-2 border-t border-emerald-800/60">
                <div className="px-3 py-1 text-[10px] font-bold text-emerald-300 uppercase">Admin Modules</div>
                <button
                  onClick={() => {
                    onSelectTab('admin_cne');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-800 rounded-lg flex items-center gap-2 cursor-pointer"
                >
                  <GraduationCap className="w-4 h-4" /> CNE Management
                </button>
                <button
                  onClick={() => {
                    onSelectTab('admin_areas');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-800 rounded-lg flex items-center gap-2 cursor-pointer"
                >
                  <FolderTree className="w-4 h-4" /> Area Master
                </button>
                <button
                  onClick={() => {
                    onSelectTab('admin_roles');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-800 rounded-lg flex items-center gap-2 cursor-pointer"
                >
                  <Users className="w-4 h-4" /> Role Master
                </button>
                <button
                  onClick={() => {
                    onSelectTab('admin_content');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-800 rounded-lg flex items-center gap-2 cursor-pointer"
                >
                  <Globe className="w-4 h-4" /> Admin Content (CMS)
                </button>
                <button
                  onClick={() => {
                    onSelectTab('admin_reports');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-800 rounded-lg flex items-center gap-2 cursor-pointer"
                >
                  <BarChart3 className="w-4 h-4" /> Reports & Statistics
                </button>
                <button
                  onClick={() => {
                    onSelectTab('admin_diagnostics');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-800 rounded-lg flex items-center gap-2 cursor-pointer"
                >
                  <Activity className="w-4 h-4" /> Diagnostics
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

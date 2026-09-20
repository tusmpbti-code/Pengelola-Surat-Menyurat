import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { usePermissions } from '../hooks/useAuth';
import {
  LayoutDashboard,
  Inbox,
  Send,
  Archive,
  Search,
  FileSpreadsheet,
  Layers,
  Users,
  ScrollText,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  Building2,
  Database,
  CheckCircle2,
  AlertCircle,
  FileText
} from 'lucide-react';
import { SupabaseConfigModal } from '../components/SupabaseConfigModal';

export type NavigationPage =
  | 'dashboard'
  | 'surat-masuk'
  | 'surat-keluar'
  | 'semua-arsip'
  | 'pencarian'
  | 'laporan'
  | 'jurnal-surat-masuk'
  | 'jurnal-surat-keluar'
  | 'master-data'
  | 'pengguna'
  | 'audit-log'
  | 'pengaturan'
  | 'detail-surat';

interface AppLayoutProps {
  currentPage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentPage,
  onNavigate,
  children,
}) => {
  const { profile, user, signOut, isConfigured } = useAuth();
  const { settings } = useSettings();
  const { isSuperAdmin, isAdmin } = usePermissions();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const getRoleBadge = () => {
    const role = profile?.role;
    if (role === 'SUPER_ADMIN') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
          <Shield className="w-3 h-3 text-purple-600" />
          SUPER_ADMIN
        </span>
      );
    }
    if (role === 'ADMIN') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
          <Shield className="w-3 h-3 text-blue-600" />
          ADMIN
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
        <Shield className="w-3 h-3 text-slate-500" />
        VIEWER
      </span>
    );
  };

  const navItems = [
    { id: 'dashboard' as NavigationPage, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'surat-masuk' as NavigationPage, label: 'Surat Masuk', icon: Inbox },
    { id: 'surat-keluar' as NavigationPage, label: 'Surat Keluar', icon: Send },
    { id: 'semua-arsip' as NavigationPage, label: 'Semua Arsip', icon: Archive },
    { id: 'pencarian' as NavigationPage, label: 'Pencarian', icon: Search },
    { id: 'laporan' as NavigationPage, label: 'Pusat Laporan', icon: FileSpreadsheet },
    { id: 'jurnal-surat-masuk' as NavigationPage, label: 'Jurnal Surat Masuk', icon: FileText, indent: true },
    { id: 'jurnal-surat-keluar' as NavigationPage, label: 'Jurnal Surat Keluar', icon: FileText, indent: true },
    ...(isAdmin || isSuperAdmin
      ? [{ id: 'master-data' as NavigationPage, label: 'Master Data', icon: Layers }]
      : []),
    ...(isSuperAdmin
      ? [
          { id: 'pengguna' as NavigationPage, label: 'Pengguna', icon: Users },
          { id: 'audit-log' as NavigationPage, label: 'Audit Log', icon: ScrollText },
        ]
      : []),
    ...(isSuperAdmin
      ? [{ id: 'pengaturan' as NavigationPage, label: 'Pengaturan', icon: Settings }]
      : []),
  ];

  const handleNavClick = (page: NavigationPage) => {
    onNavigate(page);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand & Mobile toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('dashboard')}>
              {settings?.school_logo ? (
                <div className="w-10 h-10 rounded-xl bg-white p-1 border border-slate-200 shadow-xs flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src={settings.school_logo}
                    alt="Logo Sekolah"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold tracking-wider shadow-sm shrink-0">
                  <Building2 className="w-5 h-5 text-emerald-400" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold tracking-tight text-slate-900">SIPAS BTI</h1>
                  <span className="hidden sm:inline-block text-[10px] uppercase font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                    Tahap 5
                  </span>
                </div>
                <p className="text-xs text-slate-500 hidden sm:block">
                  {settings?.school_name ? `Sistem Pengarsipan Surat ${settings.school_name}` : 'Sistem Pengarsipan Surat SMP Bhinneka Tunggal Ika'}
                </p>
              </div>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            {/* Supabase connection indicator button */}
            <button
              onClick={() => setShowConfigModal(true)}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                isConfigured
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
              }`}
              title="Status Supabase & Migrasi SQL"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{isConfigured ? 'Supabase Terhubung' : 'Setup Supabase'}</span>
              {isConfigured ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              )}
            </button>

            {/* Profile Info */}
            <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-slate-900 leading-tight">
                  {profile?.full_name || user?.email || 'Tata Usaha'}
                </p>
                <div className="mt-0.5">{getRoleBadge()}</div>
              </div>

              {/* Logout button */}
              <button
                onClick={signOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors"
                title="Keluar dari sesi SIPAS BTI"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main App Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-6">
        {/* Desktop Sidebar */}
        <aside className="hidden md:block w-64 shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs sticky top-22">
            <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Menu Navigasi
            </div>
            <nav className="space-y-1 mt-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                const isIndented = (item as any).indent;
                return (
                  <button
                    key={item.id}
                    id={`nav-${item.id}`}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-3 rounded-xl transition-all ${
                      isIndented
                        ? 'pl-7 pr-3 py-2 text-xs font-medium'
                        : 'px-3 py-2.5 text-sm font-medium'
                    } ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`shrink-0 ${isIndented ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* School TU identity badge */}
            <div className="mt-6 pt-4 border-t border-slate-100 px-3 pb-1">
              <div className="flex items-center gap-2 text-slate-600">
                {settings?.school_logo ? (
                  <div className="w-4 h-4 shrink-0 flex items-center justify-center overflow-hidden">
                    <img
                      src={settings.school_logo}
                      alt="Logo"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : (
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <span className="text-xs font-medium">Tata Usaha Sekolah</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                {settings?.school_name || 'SMP Bhinneka Tunggal Ika'}
              </p>
            </div>
          </div>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs md:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <div
              className="w-72 bg-white h-full p-4 shadow-xl flex flex-col justify-between"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    {settings?.school_logo ? (
                      <div className="w-8 h-8 rounded-lg bg-white p-0.5 border border-slate-200 flex items-center justify-center overflow-hidden">
                        <img
                          src={settings.school_logo}
                          alt="Logo Sekolah"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-slate-900 text-emerald-400 flex items-center justify-center font-bold">
                        <Building2 className="w-4 h-4" />
                      </div>
                    )}
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">SIPAS BTI</h2>
                      <p className="text-[10px] text-slate-500">{settings?.school_name || 'SMP Bhinneka Tunggal Ika'}</p>
                    </div>
                  </div>
                  <button onClick={() => setMobileOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="space-y-1 mt-4">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPage === item.id;
                    const isIndented = (item as any).indent;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`w-full flex items-center gap-3 rounded-xl transition-all ${
                          isIndented
                            ? 'pl-7 pr-3 py-2 text-xs font-medium'
                            : 'px-3 py-2.5 text-sm font-medium'
                        } ${
                          isActive
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className={`shrink-0 ${isIndented ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-3">
                <button
                  onClick={() => {
                    setShowConfigModal(true);
                    setMobileOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg"
                >
                  <Database className="w-3.5 h-3.5" />
                  Status Supabase
                </button>
                <button
                  onClick={signOut}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Keluar dari Akun
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content View */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>

      {/* Supabase Config / Migration Modal */}
      <SupabaseConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
      />
    </div>
  );
};

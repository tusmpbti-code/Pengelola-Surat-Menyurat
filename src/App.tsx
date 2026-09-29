import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { SettingsProvider } from './context/SettingsContext';
import { AppLayout, NavigationPage } from './layouts/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { LettersPage } from './pages/LettersPage';
import { LetterDetailPage } from './pages/LetterDetailPage';
import { SearchPage } from './pages/SearchPage';
import { ReportsPage } from './pages/ReportsPage';
import { JournalReportView } from './components/JournalReportView';
import { MasterDataPage } from './pages/MasterDataPage';
import { UsersPage } from './pages/UsersPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { InitialAdminSetupPage } from './pages/InitialAdminSetupPage';
import { CreateLetterModal } from './components/CreateLetterModal';
import { AIVerificationModal } from './components/AIVerificationModal';
import { LetterType, Letter } from './types';
import { Building2, Loader2 } from 'lucide-react';

function MainApp() {
  const { user, profile, isLoading, isSetupRequired } = useAuth();
  const [currentPage, setCurrentPage] = useState<NavigationPage>('dashboard');
  const [selectedLetterId, setSelectedLetterId] = useState<string | null>(null);
  const [previousPage, setPreviousPage] = useState<NavigationPage>('dashboard');
  const [isSetupView, setIsSetupView] = useState<boolean>(false);

  // Modal create letter & AI extraction modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [createLetterType, setCreateLetterType] = useState<LetterType>('INCOMING');
  const [refreshKey, setRefreshKey] = useState(0);

  // Sync hash routing supporting #surat/:id and standard pages
  useEffect(() => {
    const handleHash = () => {
      const rawHash = window.location.hash.replace('#', '').trim();

      if (!rawHash) {
        setCurrentPage('dashboard');
        setSelectedLetterId(null);
        return;
      }

      // Check for /surat/:id or surat/:id or surat-detail/:id
      if (rawHash.startsWith('surat/') || rawHash.startsWith('/surat/')) {
        const parts = rawHash.split('/');
        const id = parts[parts.length - 1];
        if (id) {
          setSelectedLetterId(id);
          setCurrentPage('detail-surat');
          return;
        }
      }

      // Check for specific sub-routes
      if (rawHash === 'laporan/jurnal-surat-masuk' || rawHash === 'jurnal-surat-masuk') {
        setCurrentPage('jurnal-surat-masuk');
        setSelectedLetterId(null);
        return;
      }

      if (rawHash === 'laporan/jurnal-surat-keluar' || rawHash === 'jurnal-surat-keluar') {
        setCurrentPage('jurnal-surat-keluar');
        setSelectedLetterId(null);
        return;
      }

      const validPages: NavigationPage[] = [
        'dashboard',
        'surat-masuk',
        'surat-keluar',
        'semua-arsip',
        'pencarian',
        'laporan',
        'jurnal-surat-masuk',
        'jurnal-surat-keluar',
        'master-data',
        'pengguna',
        'audit-log',
        'pengaturan',
      ];

      if (validPages.includes(rawHash as NavigationPage)) {
        setCurrentPage(rawHash as NavigationPage);
        setSelectedLetterId(null);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const navigateTo = (page: NavigationPage) => {
    if (page !== 'detail-surat') {
      setSelectedLetterId(null);
    }
    setCurrentPage(page);
    if (page === 'jurnal-surat-masuk') {
      window.location.hash = 'laporan/jurnal-surat-masuk';
    } else if (page === 'jurnal-surat-keluar') {
      window.location.hash = 'laporan/jurnal-surat-keluar';
    } else {
      window.location.hash = page;
    }
  };

  const navigateToLetterDetail = (letterId: string) => {
    setPreviousPage(currentPage === 'detail-surat' ? 'dashboard' : currentPage);
    setSelectedLetterId(letterId);
    setCurrentPage('detail-surat');
    window.location.hash = `surat/${letterId}`;
  };

  const handleOpenCreateLetter = (type: LetterType) => {
    setCreateLetterType(type);
    setShowCreateModal(true);
  };

  // Loading Screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-16 h-16 rounded-2xl bg-slate-800 text-emerald-400 flex items-center justify-center shadow-xl border border-slate-700 mb-4 animate-pulse">
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="text-lg font-bold tracking-tight">SIPAS BTI</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Sistem Pengarsipan Surat SMP Bhinneka Tunggal Ika
        </p>
        <div className="flex items-center gap-2 mt-6 text-xs text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          <span>Memeriksa sesi dan keamanan pangkalan data...</span>
        </div>
      </div>
    );
  }

  // Not authenticated: Render Login or Initial Admin Setup
  if (!user) {
    if (isSetupRequired || isSetupView) {
      return (
        <InitialAdminSetupPage
          onSuccess={() => {
            setIsSetupView(false);
            navigateTo('dashboard');
          }}
          onGoToLogin={() => setIsSetupView(false)}
        />
      );
    }

    return (
      <LoginPage
        onGoToSetup={() => setIsSetupView(true)}
        onSuccess={() => navigateTo('dashboard')}
      />
    );
  }

  // Authenticated: Protected layout & routes
  const renderCurrentPage = () => {
    if (currentPage === 'detail-surat' && selectedLetterId) {
      return (
        <LetterDetailPage
          key={selectedLetterId}
          letterId={selectedLetterId}
          onBack={() => navigateTo(previousPage)}
          onNavigateToLetter={(id) => navigateToLetterDetail(id)}
        />
      );
    }

    switch (currentPage) {
      case 'dashboard':
        return (
          <DashboardPage
            key={refreshKey}
            onNavigate={navigateTo}
            onOpenCreateLetter={handleOpenCreateLetter}
            onOpenAIModal={() => setShowAIModal(true)}
          />
        );
      case 'surat-masuk':
        return (
          <LettersPage
            key={`in-${refreshKey}`}
            pageType="INCOMING"
            onOpenCreate={handleOpenCreateLetter}
            onNavigateToDetail={navigateToLetterDetail}
          />
        );
      case 'surat-keluar':
        return (
          <LettersPage
            key={`out-${refreshKey}`}
            pageType="OUTGOING"
            onOpenCreate={handleOpenCreateLetter}
            onNavigateToDetail={navigateToLetterDetail}
          />
        );
      case 'semua-arsip':
        return (
          <LettersPage
            key={`all-${refreshKey}`}
            pageType="ALL"
            onOpenCreate={handleOpenCreateLetter}
            onNavigateToDetail={navigateToLetterDetail}
          />
        );
      case 'pencarian':
        return <SearchPage onNavigateToDetail={navigateToLetterDetail} />;
      case 'jurnal-surat-masuk':
        return (
          <JournalReportView
            letterType="INCOMING"
            onNavigateToDetail={navigateToLetterDetail}
          />
        );
      case 'jurnal-surat-keluar':
        return (
          <JournalReportView
            letterType="OUTGOING"
            onNavigateToDetail={navigateToLetterDetail}
          />
        );
      case 'laporan':
        return (
          <ReportsPage
            onNavigateToTab={(tab) => {
              if (tab === 'laporan/jurnal-surat-masuk' || tab === 'jurnal-surat-masuk') {
                navigateTo('jurnal-surat-masuk');
              } else if (tab === 'laporan/jurnal-surat-keluar' || tab === 'jurnal-surat-keluar') {
                navigateTo('jurnal-surat-keluar');
              } else {
                navigateTo(tab as any);
              }
            }}
          />
        );
      case 'master-data':
        return <MasterDataPage />;
      case 'pengguna':
        return <UsersPage />;
      case 'audit-log':
        return <AuditLogPage onNavigateToDetail={navigateToLetterDetail} />;
      case 'pengaturan':
        return <SettingsPage />;
      default:
        return (
          <DashboardPage
            onNavigate={navigateTo}
            onOpenCreateLetter={handleOpenCreateLetter}
          />
        );
    }
  };

  return (
    <AppLayout
      currentPage={currentPage}
      onNavigate={navigateTo}
      onOpenScanAI={() => setShowAIModal(true)}
    >
      {renderCurrentPage()}

      {/* Modal Catat Surat */}
      <CreateLetterModal
        isOpen={showCreateModal}
        initialType={createLetterType}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setRefreshKey((prev) => prev + 1);
        }}
        onViewExisting={(exLetter: Letter) => {
          navigateToLetterDetail(exLetter.id);
        }}
      />

      {/* Modal Ekstraksi & Verifikasi AI (Mode Baca AI) */}
      {showAIModal && (
        <AIVerificationModal
          isOpen={showAIModal}
          initialType="INCOMING"
          onClose={() => setShowAIModal(false)}
          onSuccess={(saved) => {
            setShowAIModal(false);
            setRefreshKey((prev) => prev + 1);
            navigateToLetterDetail(saved.id);
          }}
          onSwitchToManual={(_file) => {
            setShowAIModal(false);
            handleOpenCreateLetter('INCOMING');
          }}
          onViewExisting={(ex) => {
            setShowAIModal(false);
            navigateToLetterDetail(ex.id);
          }}
        />
      )}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ToastProvider>
          <MainApp />
        </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

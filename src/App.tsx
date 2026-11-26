import {
  Bell,
  BookMarked,
  BookOpen,
  FileBarChart2,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Radio,
  Repeat,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AuthModal } from './components/AuthModal.tsx';
import { CatalogView } from './components/CatalogView.tsx';
import { CirculationView } from './components/CirculationView.tsx';
import { CollectionManagerView } from './components/CollectionManagerView.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { NotificationsView } from './components/NotificationsView.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import { apiRequest } from './lib/api.ts';
import type {
  AutomatedReport,
  Book,
  DashboardResponse,
  EmailNotificationLog,
  LibrarySettings,
  LoanTransaction,
  PublicOverviewResponse,
  UserProfile,
} from './types.ts';

type NavTab = 'dashboard' | 'catalog' | 'circulation' | 'notifications' | 'collection' | 'reports';

const NAV_ITEMS: { id: NavTab; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard Real-Time', icon: LayoutDashboard },
  { id: 'catalog', label: 'Katalog & Pinjam Online', icon: BookOpen },
  { id: 'circulation', label: 'Sirkulasi Peminjaman', icon: Repeat },
  { id: 'notifications', label: 'Notifikasi Email', icon: Bell },
  { id: 'collection', label: 'Manajemen Koleksi', icon: FolderKanban, adminOnly: true },
  { id: 'reports', label: 'Laporan Otomatis', icon: FileBarChart2, adminOnly: true },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // In-memory session state (never persisted in localStorage/sessionStorage)
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  const [overview, setOverview] = useState<PublicOverviewResponse | null>(null);
  const [loans, setLoans] = useState<LoanTransaction[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailNotificationLog[]>([]);
  const [reports, setReports] = useState<AutomatedReport[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [liveToast, setLiveToast] = useState<string | null>(null);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'member_login' | 'member_register' | 'admin'>(
    'member_login'
  );

  const fetchSnapshot = useCallback(async () => {
    try {
      if (token) {
        const data = await apiRequest<DashboardResponse>('/api/dashboard', {}, token);
        setOverview({
          books: data.books,
          stats: data.stats,
          dailyTrend: data.dailyTrend,
          categoryStats: data.categoryStats,
          recentActivities: data.recentActivities,
          settings: data.settings,
        });
        setUser(data.user);
        setLoans(data.loans);
        setEmailLogs(data.emailLogs);
        setReports(data.reports);
        setMembers(data.members);
      } else {
        const data = await apiRequest<PublicOverviewResponse>('/api/overview');
        setOverview(data);
        setLoans([]);
        setEmailLogs([]);
        setReports([]);
        setMembers([]);
      }
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal memuat data perpustakaan.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  // Real-time SSE listener with serverless polling fallback (e.g. Vercel)
  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const source = new EventSource('/api/events');

    source.addEventListener('connected', (event) => {
      setSseConnected(true);
      try {
        const info = JSON.parse((event as MessageEvent).data) as { mode?: string };
        if (info.mode === 'polling') {
          source.close();
          if (!pollTimer) {
            pollTimer = setInterval(() => {
              fetchSnapshot();
            }, 8000);
          }
        }
      } catch {
        // Default to SSE mode
      }
    });

    source.addEventListener('snapshot_updated', () => {
      fetchSnapshot();
    });

    source.addEventListener('email_dispatched', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as {
          log?: EmailNotificationLog;
        };
        if (payload.log) {
          setLiveToast(
            `Notifikasi email dikirim ke ${payload.log.recipientName} (${payload.log.bookTitle})`
          );
        }
      } catch {
        // Ignore parse failures on non-JSON frames
      }
      fetchSnapshot();
    });

    source.addEventListener('report_generated', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as {
          report?: AutomatedReport;
        };
        if (payload.report) {
          setLiveToast(`Laporan baru dibuat: ${payload.report.title}`);
        }
      } catch {
        // Ignore parse failures
      }
      fetchSnapshot();
    });

    source.onerror = () => {
      if (!pollTimer) {
        setSseConnected(false);
      }
    };

    return () => {
      source.close();
      if (pollTimer) {
        clearInterval(pollTimer);
      }
      setSseConnected(false);
    };
  }, [fetchSnapshot]);

  useEffect(() => {
    if (!liveToast) return;
    const timer = setTimeout(() => setLiveToast(null), 5000);
    return () => clearTimeout(timer);
  }, [liveToast]);

  function openAuth(mode: 'member_login' | 'member_register' | 'admin' = 'member_login') {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  }

  async function handleLogout() {
    if (token) {
      await apiRequest('/api/auth/logout', { method: 'POST' }, token).catch(() => {});
    }
    setToken(null);
    setUser(null);
    setLoans([]);
    setEmailLogs([]);
    setReports([]);
    setMembers([]);
  }

  async function handleBorrowBook(bookId: string, durationDays: number, memberId?: string) {
    await apiRequest(
      '/api/loans',
      {
        method: 'POST',
        body: JSON.stringify({ bookId, durationDays, memberId }),
      },
      token
    );
    await fetchSnapshot();
  }

  async function handleRenewLoan(loanId: string) {
    await apiRequest(`/api/loans/${loanId}/renew`, { method: 'POST' }, token);
    await fetchSnapshot();
  }

  async function handleReturnLoan(loanId: string) {
    await apiRequest(`/api/loans/${loanId}/return`, { method: 'POST' }, token);
    await fetchSnapshot();
  }

  async function handleDispatchReminder(loanId?: string): Promise<number> {
    const res = await apiRequest<{ dispatchedCount: number }>(
      '/api/admin/reminders/dispatch',
      {
        method: 'POST',
        body: JSON.stringify(loanId ? { loanId } : {}),
      },
      token
    );
    await fetchSnapshot();
    return res.dispatchedCount;
  }

  async function handleSimulateDue(loanId: string, mode: 'approaching' | 'overdue') {
    await apiRequest(
      `/api/admin/loans/${loanId}/simulate-due`,
      {
        method: 'POST',
        body: JSON.stringify({ mode }),
      },
      token
    );
    await fetchSnapshot();
  }

  async function handleCreateBook(
    payload: Omit<Book, 'id' | 'availableCopies' | 'borrowCount' | 'addedAt'>
  ) {
    await apiRequest(
      '/api/admin/books',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token
    );
    await fetchSnapshot();
  }

  async function handleUpdateBook(
    bookId: string,
    payload: Partial<Omit<Book, 'id' | 'availableCopies' | 'borrowCount' | 'addedAt'>>
  ) {
    await apiRequest(
      `/api/admin/books/${bookId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      token
    );
    await fetchSnapshot();
  }

  async function handleDeleteBook(bookId: string) {
    await apiRequest(`/api/admin/books/${bookId}`, { method: 'DELETE' }, token);
    await fetchSnapshot();
  }

  async function handleGenerateReport(periodType: 'harian' | 'mingguan' | 'bulanan') {
    const res = await apiRequest<{ report: AutomatedReport }>(
      '/api/admin/reports/generate',
      {
        method: 'POST',
        body: JSON.stringify({ periodType }),
      },
      token
    );
    await fetchSnapshot();
    return res.report;
  }

  async function handleUpdateSettings(patch: Partial<LibrarySettings>) {
    await apiRequest(
      '/api/admin/settings',
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
      token
    );
    await fetchSnapshot();
  }

  const activeNavLabel = NAV_ITEMS.find((item) => item.id === activeTab)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Mobile Sidebar Backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Left Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0"
          >
            <BookMarked className="h-5 w-5 text-teal-700" aria-hidden="true" />
            <span className="font-display text-lg font-bold tracking-tight text-slate-900">
              Lentera Pustaka
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Tutup navigasi"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3 overflow-y-auto" aria-label="Menu utama">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isLocked = item.adminOnly && user?.role !== 'admin';

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileNavOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-teal-50 text-teal-900'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${isActive ? 'text-teal-700' : 'text-slate-400'}`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {isLocked && (
                  <span className="text-[10px] font-normal text-slate-400 shrink-0">Admin</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Account Panel */}
        <div className="border-t border-slate-200 p-4">
          {user ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-900 truncate">{user.name}</p>
                <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                  {user.role === 'admin' ? 'Admin Pustakawan' : 'Anggota'} ·{' '}
                  <span className="font-mono">{user.memberCode}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Keluar Akun</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500">
                Masuk untuk meminjam buku atau mengelola koleksi.
              </p>
              <button
                type="button"
                onClick={() => openAuth('member_login')}
                className="w-full rounded-lg bg-teal-700 px-3 py-2 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap"
              >
                Masuk / Daftar
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Workspace */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xs sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Buka navigasi"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
              <span className="hidden sm:inline font-medium text-slate-700">Lentera Pustaka</span>
              <span className="hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-slate-900 truncate">{activeNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div
              className="hidden md:flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap"
              title="Status koneksi EventSource real-time ke server"
            >
              <Radio
                className={`h-3.5 w-3.5 ${sseConnected ? 'text-emerald-600' : 'text-amber-600'}`}
                aria-hidden="true"
              />
              <span>{sseConnected ? 'Sinkronisasi Real-Time' : 'Menyambung...'}</span>
            </div>

            {user ? (
              <button
                type="button"
                onClick={() =>
                  setActiveTab(user.role === 'admin' ? 'collection' : 'catalog')
                }
                className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
              >
                {user.role === 'admin' ? 'Kelola Koleksi' : 'Pinjam Buku'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openAuth('member_login')}
                className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
              >
                Masuk Akun
              </button>
            )}
          </div>
        </header>

        {/* Live SSE Notification Toast */}
        {liveToast && (
          <div className="no-print mx-4 mt-4 flex items-center justify-between gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-xs text-teal-900 sm:mx-6">
            <span>{liveToast}</span>
            <button
              type="button"
              onClick={() => setLiveToast(null)}
              aria-label="Tutup pemberitahuan"
              className="text-teal-700 hover:text-teal-900"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Viewport Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {loading ? (
            <div className="space-y-4">
              <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white"
                  />
                ))}
              </div>
            </div>
          ) : loadError || !overview ? (
            <div className="rounded-xl border border-red-200 bg-white p-6 text-center">
              <p className="text-sm font-medium text-red-700">
                {loadError || 'Gagal memuat data perpustakaan.'}
              </p>
              <button
                type="button"
                onClick={fetchSnapshot}
                className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white"
              >
                Muat Ulang
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  user={user}
                  overview={overview}
                  loans={loans}
                  emailLogs={emailLogs}
                  dailyTrend={overview.dailyTrend}
                  onRenewLoan={handleRenewLoan}
                  onReturnLoan={handleReturnLoan}
                  onDispatchReminder={async (loanId) => {
                    await handleDispatchReminder(loanId);
                  }}
                  onSimulateDue={handleSimulateDue}
                  onNavigate={(tab) => setActiveTab(tab)}
                  onOpenAuth={(mode) => openAuth(mode || 'member_login')}
                />
              )}

              {activeTab === 'catalog' && (
                <CatalogView
                  books={overview.books}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  user={user}
                  members={members}
                  onBorrowBook={handleBorrowBook}
                  onOpenAuth={() => openAuth('member_login')}
                />
              )}

              {activeTab === 'circulation' && (
                <CirculationView
                  user={user}
                  loans={loans}
                  onRenewLoan={handleRenewLoan}
                  onReturnLoan={handleReturnLoan}
                  onDispatchReminder={async (loanId) => {
                    await handleDispatchReminder(loanId);
                  }}
                  onSimulateDue={handleSimulateDue}
                  onOpenAuth={() => openAuth('member_login')}
                />
              )}

              {activeTab === 'notifications' && (
                <NotificationsView
                  user={user}
                  emailLogs={emailLogs}
                  settings={overview.settings}
                  onDispatchAll={() => handleDispatchReminder()}
                  onUpdateSettings={handleUpdateSettings}
                  onOpenAuth={() => openAuth('member_login')}
                />
              )}

              {activeTab === 'collection' && (
                <CollectionManagerView
                  user={user}
                  books={overview.books}
                  onCreateBook={handleCreateBook}
                  onUpdateBook={handleUpdateBook}
                  onDeleteBook={handleDeleteBook}
                  onOpenAdminAuth={() => openAuth('admin')}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsView
                  user={user}
                  reports={reports}
                  settings={overview.settings}
                  onGenerateReport={handleGenerateReport}
                  onUpdateSettings={handleUpdateSettings}
                  onOpenAdminAuth={() => openAuth('admin')}
                />
              )}
            </>
          )}
        </main>
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        onSuccess={(newToken, loggedInUser) => {
          setToken(newToken);
          setUser(loggedInUser);
        }}
      />
    </div>
  );
}

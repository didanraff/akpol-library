import {
  AlertTriangle,
  ArrowUpRight,
  BookCheck,
  Clock,
  Mail,
  RefreshCw,
  Send,
  UserCheck,
} from 'lucide-react';
import { useState } from 'react';
import {
  formatCurrencyId,
  formatDateId,
  formatDateTimeId,
  getDueCountdownLabel,
} from '../lib/api.ts';
import type {
  ActivityEvent,
  DailyBorrowPoint,
  EmailNotificationLog,
  LoanTransaction,
  PublicOverviewResponse,
  UserProfile,
} from '../types.ts';
import { CirculationCharts } from './CirculationCharts.tsx';

interface DashboardViewProps {
  user: UserProfile | null;
  overview: PublicOverviewResponse;
  loans: LoanTransaction[];
  emailLogs: EmailNotificationLog[];
  dailyTrend: DailyBorrowPoint[];
  onRenewLoan: (loanId: string) => Promise<void>;
  onReturnLoan: (loanId: string) => Promise<void>;
  onDispatchReminder: (loanId?: string) => Promise<void>;
  onSimulateDue: (loanId: string, mode: 'approaching' | 'overdue') => Promise<void>;
  onNavigate: (tab: 'catalog' | 'circulation' | 'notifications' | 'reports') => void;
  onOpenAuth: (mode?: 'member_login' | 'member_register' | 'admin') => void;
}

const ACTIVITY_LABELS: Record<ActivityEvent['type'], string> = {
  pinjam: 'Peminjaman',
  kembali: 'Pengembalian',
  perpanjang: 'Perpanjangan',
  koleksi_baru: 'Koleksi Baru',
  koleksi_ubah: 'Perubahan Stok',
  koleksi_hapus: 'Hapus Koleksi',
  email_terkirim: 'Email Pengingat',
  laporan_otomatis: 'Laporan Otomatis',
  member_baru: 'Anggota Baru',
};

export function DashboardView({
  user,
  overview,
  loans,
  emailLogs,
  dailyTrend,
  onRenewLoan,
  onReturnLoan,
  onDispatchReminder,
  onSimulateDue,
  onNavigate,
  onOpenAuth,
}: DashboardViewProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';
  const activeLoans = loans.filter((l) => l.status !== 'dikembalikan');
  const priorityLoans = activeLoans.filter(
    (l) => l.status === 'terlambat' || l.status === 'mendekati_jatuh_tempo'
  );
  const totalUserFines = activeLoans.reduce((sum, l) => sum + l.fineAmount, 0);

  async function runAction(id: string, fn: () => Promise<void>, successText: string) {
    setBusyId(id);
    setActionMsg(null);
    try {
      await fn();
      setActionMsg(successText);
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Gagal menjalankan aksi.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-teal-800">
            {isAdmin
              ? 'Dashboard Operasional Admin'
              : user
                ? `Dashboard Anggota · ${user.memberCode}`
                : 'Ringkasan Sirkulasi Perpustakaan'}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900">
            {user ? `Selamat datang, ${user.name}` : 'Pemantauan Sirkulasi Real-Time'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {isAdmin
              ? 'Pantau peminjaman aktif, antrean jatuh tempo, log notifikasi email real-time, dan statistik koleksi.'
              : user
                ? 'Kelola buku yang sedang Anda pinjam, perpanjang tenggat waktu, dan pantau pengingat email jatuh tempo.'
                : 'Masuk sebagai Member untuk meminjam buku & memantau jatuh tempo, atau masuk sebagai Admin untuk mengelola perpustakaan.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!user ? (
            <>
              <button
                type="button"
                onClick={() => onOpenAuth('member_register')}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                Daftar Member
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('admin')}
                className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap"
              >
                Masuk Portal Admin
              </button>
            </>
          ) : isAdmin ? (
            <>
              <button
                type="button"
                disabled={busyId === 'scan-all'}
                onClick={() =>
                  runAction(
                    'scan-all',
                    () => onDispatchReminder(),
                    'Pemindaian & pengiriman email pengingat selesai.'
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-60 whitespace-nowrap"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{busyId === 'scan-all' ? 'Memindai...' : 'Kirim Pengingat Jatuh Tempo'}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <span>Buka Laporan</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('catalog')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap"
            >
              <span>Pinjam Buku Baru</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {actionMsg && (
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-xs text-teal-900">
          {actionMsg}
        </div>
      )}

      {/* 4-Column KPI Strip */}
      {isAdmin || !user ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">Total Koleksi & Eksemplar</p>
            <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {overview.stats.totalTitles}{' '}
              <span className="text-sm font-normal text-slate-500">
                judul · {overview.stats.totalCopies} eksemplar
              </span>
            </p>
            <p className="mt-2 text-xs text-emerald-700 tabular-nums">
              {overview.stats.availableCopies} eksemplar siap dipinjam
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">Peminjaman Aktif</p>
            <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {overview.stats.activeLoans}
            </p>
            <p className="mt-2 text-xs text-slate-500 tabular-nums">
              {overview.stats.totalMembers} anggota terdaftar
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">Perlu Perhatian Jatuh Tempo</p>
            <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {overview.stats.approachingDueLoans + overview.stats.overdueLoans}
            </p>
            <p className="mt-2 text-xs text-amber-700 tabular-nums">
              {overview.stats.approachingDueLoans} mendekati ·{' '}
              <span className="text-red-700 font-medium">
                {overview.stats.overdueLoans} terlambat
              </span>
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">Notifikasi Email Hari Ini</p>
            <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {overview.stats.emailsSentToday}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {overview.settings.autoEmailReminderEnabled
                ? `Auto-kirim aktif (H-${overview.settings.reminderLeadDays})`
                : 'Pengingat otomatis nonaktif'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">Pinjaman Aktif Anda</p>
            <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {activeLoans.length}
            </p>
            <p className="mt-2 text-xs text-slate-500 tabular-nums">
              Total riwayat: {loans.length} transaksi
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">Mendekati / Terlambat</p>
            <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {priorityLoans.length}
            </p>
            <p className="mt-2 text-xs text-amber-700">
              {priorityLoans.length > 0
                ? 'Segera perpanjang atau kembalikan'
                : 'Semua pinjaman aman tepat waktu'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">Denda Berjalan</p>
            <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {formatCurrencyId(totalUserFines)}
            </p>
            <p className="mt-2 text-xs text-slate-500 tabular-nums">
              Tarif keterlambatan {formatCurrencyId(overview.settings.dailyFineRate)}/hari
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">Email Pengingat Masuk</p>
            <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {emailLogs.length}
            </p>
            <p className="mt-2 text-xs text-slate-500 truncate">{user.email}</p>
          </div>
        </div>
      )}

      {/* Interactive Circulation Charts */}
      <CirculationCharts dailyTrend={dailyTrend} categoryStats={overview.categoryStats} />

      {/* Lower Split: Role Priority Panel + Real-Time Activity Feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Admin Priority Due Queue OR Member Active Loans */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6">
          {isAdmin ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-display text-base font-semibold text-slate-900">
                    Pemantauan Jatuh Tempo & Keterlambatan
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Transaksi aktif yang mendekati tenggat atau melewati jatuh tempo
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('circulation')}
                  className="text-xs font-medium text-teal-700 hover:underline whitespace-nowrap"
                >
                  Semua Sirkulasi
                </button>
              </div>

              {activeLoans.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  Belum ada peminjaman aktif saat ini.
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500">
                        <th className="pb-2.5 font-medium">Peminjam & Buku</th>
                        <th className="pb-2.5 font-medium">Status Tenggat</th>
                        <th className="pb-2.5 font-medium text-right">Denda</th>
                        <th className="pb-2.5 font-medium text-right">Aksi Cepat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeLoans.slice(0, 6).map((loan) => {
                        const isOverdue = loan.status === 'terlambat';
                        const isApproaching = loan.status === 'mendekati_jatuh_tempo';
                        return (
                          <tr key={loan.id} className="hover:bg-slate-50/70">
                            <td className="py-3 pr-3">
                              <p className="font-medium text-slate-900 line-clamp-1">
                                {loan.bookTitle}
                              </p>
                              <p className="mt-0.5 text-slate-500">
                                {loan.memberName} · <span className="font-mono">{loan.memberEmail}</span>
                              </p>
                            </td>
                            <td className="py-3 pr-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 font-medium ${
                                  isOverdue
                                    ? 'text-red-700'
                                    : isApproaching
                                      ? 'text-amber-700'
                                      : 'text-emerald-700'
                                }`}
                              >
                                {isOverdue ? (
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                ) : isApproaching ? (
                                  <Clock className="h-3.5 w-3.5" />
                                ) : (
                                  <BookCheck className="h-3.5 w-3.5" />
                                )}
                                <span>{getDueCountdownLabel(loan.dueAt, loan.returnedAt)}</span>
                              </span>
                            </td>
                            <td className="py-3 pr-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                              {formatCurrencyId(loan.fineAmount)}
                            </td>
                            <td className="py-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={busyId === loan.id}
                                  onClick={() =>
                                    runAction(
                                      loan.id,
                                      () => onDispatchReminder(loan.id),
                                      `Email pengingat dikirim ke ${loan.memberEmail}.`
                                    )
                                  }
                                  title="Kirim email pengingat sekarang"
                                  className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                                >
                                  Kirim Email
                                </button>
                                {!isOverdue && (
                                  <button
                                    type="button"
                                    disabled={busyId === `sim-${loan.id}`}
                                    onClick={() =>
                                      runAction(
                                        `sim-${loan.id}`,
                                        () => onSimulateDue(loan.id, 'approaching'),
                                        `Simulasi H-1 diaktifkan & email pengingat dipicu untuk ${loan.memberName}.`
                                      )
                                    }
                                    title="Uji pemicu jatuh tempo H-1 secara real-time"
                                    className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                                  >
                                    Uji H-1
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : user ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-display text-base font-semibold text-slate-900">
                    Peminjaman Aktif Anda
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Perpanjang masa pinjam atau selesaikan pengembalian secara online
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('catalog')}
                  className="text-xs font-medium text-teal-700 hover:underline whitespace-nowrap"
                >
                  Cari Buku Lain
                </button>
              </div>

              {activeLoans.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-slate-500">
                    Anda belum memiliki pinjaman buku aktif saat ini.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('catalog')}
                    className="mt-3 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
                  >
                    Jelajahi Katalog Koleksi
                  </button>
                </div>
              ) : (
                <div className="mt-4 divide-y divide-slate-100">
                  {activeLoans.map((loan) => (
                    <div
                      key={loan.id}
                      className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-slate-900 truncate">
                          {loan.bookTitle}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                          Pinjam {formatDateId(loan.borrowedAt)} · Jatuh tempo{' '}
                          <strong className="text-slate-700">{formatDateId(loan.dueAt)}</strong> ·{' '}
                          <span
                            className={
                              loan.status === 'terlambat'
                                ? 'text-red-700 font-medium'
                                : loan.status === 'mendekati_jatuh_tempo'
                                  ? 'text-amber-700 font-medium'
                                  : 'text-emerald-700'
                            }
                          >
                            {getDueCountdownLabel(loan.dueAt, loan.returnedAt)}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={loan.renewCount >= 2 || busyId === `ren-${loan.id}`}
                          onClick={() =>
                            runAction(
                              `ren-${loan.id}`,
                              () => onRenewLoan(loan.id),
                              `Masa pinjam "${loan.bookTitle}" diperpanjang +7 hari.`
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
                        >
                          <RefreshCw className="h-3 w-3" />
                          <span>Perpanjang ({loan.renewCount}/2)</span>
                        </button>
                        <button
                          type="button"
                          disabled={busyId === `ret-${loan.id}`}
                          onClick={() =>
                            runAction(
                              `ret-${loan.id}`,
                              () => onReturnLoan(loan.id),
                              `Buku "${loan.bookTitle}" berhasil dikembalikan.`
                            )
                          }
                          className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap"
                        >
                          Kembalikan
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full flex-col justify-between">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Akses Portal Member & Admin
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Untuk meminjam buku secara online, menerima pengingat email jatuh tempo otomatis, atau mengelola koleksi dan laporan, silakan masuk atau daftarkan akun baru.
                </p>
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <UserCheck className="h-4 w-4 text-teal-700" />
                      <span>Portal Member</span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-600">
                      Pinjam buku online, perpanjang tenggat, dan terima notifikasi H-2 & H-1 langsung ke email Anda.
                    </p>
                    <button
                      type="button"
                      onClick={() => onOpenAuth('member_register')}
                      className="mt-3 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-teal-800"
                    >
                      Daftar / Masuk Member
                    </button>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Mail className="h-4 w-4 text-teal-700" />
                      <span>Portal Admin Pustakawan</span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-600">
                      Kelola stok koleksi, pantau seluruh transaksi real-time, kirim pengingat email, dan unduh laporan otomatis.
                    </p>
                    <button
                      type="button"
                      onClick={() => onOpenAuth('admin')}
                      className="mt-3 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
                    >
                      Buka Portal Admin
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Real-Time Transaction Activity Stream */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Aktivitas Transaksi Real-Time
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Aliran peristiwa sirkulasi dan pengiriman email langsung
              </p>
            </div>
            <span className="font-mono text-[11px] text-teal-700 tabular-nums">
              {overview.recentActivities.length} terbaru
            </span>
          </div>

          <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
            {overview.recentActivities.map((act) => (
              <div
                key={act.id}
                className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="font-medium text-teal-800">
                    {ACTIVITY_LABELS[act.type]}
                  </span>
                  <span className="font-mono tabular-nums shrink-0">
                    {formatDateTimeId(act.timestamp)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-800">
                  <strong className="font-medium">{act.actorName}</strong> — {act.description}
                </p>
                {act.targetTitle && (
                  <p className="mt-0.5 text-xs text-slate-500 truncate">
                    Buku: {act.targetTitle}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

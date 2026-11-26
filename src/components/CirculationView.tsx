import {
  AlertTriangle,
  BookCheck,
  CheckCircle2,
  Clock,
  Mail,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  formatCurrencyId,
  formatDateId,
  getDueCountdownLabel,
} from '../lib/api.ts';
import type { LoanStatus, LoanTransaction, UserProfile } from '../types.ts';

interface CirculationViewProps {
  user: UserProfile | null;
  loans: LoanTransaction[];
  onRenewLoan: (loanId: string) => Promise<void>;
  onReturnLoan: (loanId: string) => Promise<void>;
  onDispatchReminder: (loanId: string) => Promise<void>;
  onSimulateDue: (loanId: string, mode: 'approaching' | 'overdue') => Promise<void>;
  onOpenAuth: () => void;
}

const STATUS_LABELS: Record<LoanStatus, string> = {
  dipinjam: 'Aktif Dipinjam',
  mendekati_jatuh_tempo: 'Mendekati Jatuh Tempo',
  terlambat: 'Terlambat',
  dikembalikan: 'Dikembalikan',
};

export function CirculationView({
  user,
  loans,
  onRenewLoan,
  onReturnLoan,
  onDispatchReminder,
  onSimulateDue,
  onOpenAuth,
}: CirculationViewProps) {
  const [statusFilter, setStatusFilter] = useState<'semua' | LoanStatus>('semua');
  const [query, setQuery] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return loans.filter((l) => {
      if (statusFilter !== 'semua' && l.status !== statusFilter) return false;
      if (!q) return true;
      return (
        l.bookTitle.toLowerCase().includes(q) ||
        l.memberName.toLowerCase().includes(q) ||
        l.memberEmail.toLowerCase().includes(q) ||
        l.memberCode.toLowerCase().includes(q) ||
        l.isbn.toLowerCase().includes(q)
      );
    });
  }, [loans, statusFilter, query]);

  if (!user) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
        <BookCheck className="mx-auto h-9 w-9 text-slate-300" />
        <h2 className="mt-3 font-display text-lg font-semibold text-slate-900">
          Masuk untuk Melihat Sirkulasi Peminjaman
        </h2>
        <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
          Daftar atau masuk dengan akun Member untuk melihat riwayat pinjaman pribadi, atau masuk sebagai Admin untuk memantau seluruh transaksi perpustakaan.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="mt-5 rounded-lg bg-[#0F2942] px-5 py-2.5 text-xs font-medium text-white hover:bg-[#163A5C]"
        >
          Masuk / Daftar Akun
        </button>
      </div>
    );
  }

  async function execute(key: string, fn: () => Promise<void>, successMessage: string) {
    setBusyKey(key);
    setBanner(null);
    try {
      await fn();
      setBanner({ type: 'ok', text: successMessage });
    } catch (err) {
      setBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'Operasi sirkulasi gagal.',
      });
    } finally {
      setBusyKey(null);
    }
  }

  const isAdmin = user.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Sirkulasi & Transaksi Peminjaman
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {isAdmin
                ? 'Pantau seluruh transaksi peminjaman, tenggat jatuh tempo, denda, dan kirim pengingat email secara real-time.'
                : 'Riwayat peminjaman Anda beserta tenggat pengembalian dan opsi perpanjangan masa pinjam.'}
            </p>
          </div>

          <div className="relative min-w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari buku, anggota, atau ISBN..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-[#0F2942] focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit">
          {(
            [
              ['semua', 'Semua'],
              ['dipinjam', 'Aktif'],
              ['mendekati_jatuh_tempo', 'Mendekati Jatuh Tempo'],
              ['terlambat', 'Terlambat'],
              ['dikembalikan', 'Dikembalikan'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                statusFilter === key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {banner && (
        <div
          className={`rounded-lg border px-4 py-2.5 text-xs ${
            banner.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {banner.text}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            Tidak ada transaksi peminjaman pada filter ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-4 py-3 font-medium">Buku</th>
                  {isAdmin && <th className="px-4 py-3 font-medium">Anggota</th>}
                  <th className="px-4 py-3 font-medium">Tanggal Pinjam</th>
                  <th className="px-4 py-3 font-medium">Jatuh Tempo</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Denda</th>
                  <th className="px-4 py-3 font-medium text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((loan) => {
                  const isDone = loan.status === 'dikembalikan';
                  const isLate = loan.status === 'terlambat';
                  const isSoon = loan.status === 'mendekati_jatuh_tempo';

                  return (
                    <tr key={loan.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3.5 max-w-64">
                        <p className="font-medium text-slate-900 truncate">{loan.bookTitle}</p>
                        <p className="mt-0.5 text-slate-500 font-mono tabular-nums">
                          {loan.isbn}
                        </p>
                      </td>

                      {isAdmin && (
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-slate-900">{loan.memberName}</p>
                          <p className="mt-0.5 text-slate-500 font-mono">{loan.memberEmail}</p>
                        </td>
                      )}

                      <td className="px-4 py-3.5 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {formatDateId(loan.borrowedAt)}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="font-mono tabular-nums text-slate-800">
                          {formatDateId(loan.dueAt)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {getDueCountdownLabel(loan.dueAt, loan.returnedAt)}
                        </p>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 font-medium ${
                            isDone
                              ? 'text-slate-600'
                              : isLate
                                ? 'text-red-700'
                                : isSoon
                                  ? 'text-amber-700'
                                  : 'text-emerald-700'
                          }`}
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : isLate ? (
                            <AlertTriangle className="h-3.5 w-3.5" />
                          ) : isSoon ? (
                            <Clock className="h-3.5 w-3.5" />
                          ) : (
                            <BookCheck className="h-3.5 w-3.5" />
                          )}
                          <span>{STATUS_LABELS[loan.status]}</span>
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                        {formatCurrencyId(loan.fineAmount)}
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {!isDone ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={loan.renewCount >= 2 || busyKey === `ren-${loan.id}`}
                              onClick={() =>
                                execute(
                                  `ren-${loan.id}`,
                                  () => onRenewLoan(loan.id),
                                  `Masa pinjam "${loan.bookTitle}" diperpanjang +7 hari.`
                                )
                              }
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                            >
                              <RefreshCw className="h-3 w-3" />
                              <span>Perpanjang</span>
                            </button>

                            <button
                              type="button"
                              disabled={busyKey === `ret-${loan.id}`}
                              onClick={() =>
                                execute(
                                  `ret-${loan.id}`,
                                  () => onReturnLoan(loan.id),
                                  `Pengembalian "${loan.bookTitle}" dicatat.`
                                )
                              }
                              className="rounded-md bg-[#0F2942] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#163A5C] disabled:opacity-50"
                            >
                              Kembalikan
                            </button>

                            {isAdmin && (
                              <>
                                <button
                                  type="button"
                                  disabled={busyKey === `mail-${loan.id}`}
                                  onClick={() =>
                                    execute(
                                      `mail-${loan.id}`,
                                      () => onDispatchReminder(loan.id),
                                      `Email pengingat dikirim ke ${loan.memberEmail}.`
                                    )
                                  }
                                  title="Kirim pengingat email sekarang"
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                                >
                                  <Mail className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={busyKey === `sim-${loan.id}`}
                                  onClick={() =>
                                    execute(
                                      `sim-${loan.id}`,
                                      () => onSimulateDue(loan.id, isSoon ? 'overdue' : 'approaching'),
                                      `Tenggat disimulasikan & notifikasi email dipicu untuk ${loan.memberName}.`
                                    )
                                  }
                                  className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                                >
                                  {isSoon ? 'Uji Terlambat' : 'Uji H-1'}
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="font-mono text-[11px] text-slate-400">
                            Kembali {formatDateId(loan.returnedAt)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

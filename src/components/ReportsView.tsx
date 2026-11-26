import { Download, FileBarChart2, Plus, Printer, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatCurrencyId, formatDateTimeId } from '../lib/api.ts';
import type { AutomatedReport, LibrarySettings, UserProfile } from '../types.ts';

interface ReportsViewProps {
  user: UserProfile | null;
  reports: AutomatedReport[];
  settings: LibrarySettings;
  onGenerateReport: (periodType: 'harian' | 'mingguan' | 'bulanan') => Promise<AutomatedReport>;
  onUpdateSettings: (patch: Partial<LibrarySettings>) => Promise<void>;
  onOpenAdminAuth: () => void;
}

function escapeCsvCell(value: string | number): string {
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function ReportsView({
  user,
  reports,
  settings,
  onGenerateReport,
  onUpdateSettings,
  onOpenAdminAuth,
}: ReportsViewProps) {
  const [selectedId, setSelectedId] = useState<string>('');
  const [periodType, setPeriodType] = useState<'harian' | 'mingguan' | 'bulanan'>('harian');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (reports.length > 0 && !reports.some((r) => r.id === selectedId)) {
      setSelectedId(reports[0].id);
    }
  }, [reports, selectedId]);

  if (user?.role !== 'admin') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
        <ShieldAlert className="mx-auto h-9 w-9 text-amber-600" />
        <h2 className="mt-3 font-display text-lg font-semibold text-slate-900">
          Sistem Pelaporan Otomatis Khusus Admin
        </h2>
        <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
          Masuk sebagai Admin Pustakawan untuk mengonfigurasi jadwal laporan sirkulasi otomatis, mengekspor CSV, dan mencetak laporan resmi.
        </p>
        <button
          type="button"
          onClick={onOpenAdminAuth}
          className="mt-5 rounded-lg bg-teal-700 px-5 py-2.5 text-xs font-medium text-white hover:bg-teal-800"
        >
          Masuk Portal Admin
        </button>
      </div>
    );
  }

  const activeReport = reports.find((r) => r.id === selectedId) || reports[0] || null;

  async function handleGenerate() {
    setGenerating(true);
    try {
      const created = await onGenerateReport(periodType);
      setSelectedId(created.id);
    } finally {
      setGenerating(false);
    }
  }

  function handleDownloadCsv(report: AutomatedReport) {
    const rows: (string | number)[][] = [
      ['Judul Laporan', report.title],
      ['Periode', report.periodType],
      ['Dibuat Pada', formatDateTimeId(report.generatedAt)],
      ['Sumber', report.generatedBy === 'scheduler_otomatis' ? 'Scheduler Otomatis' : 'Admin'],
      [],
      ['Metrik Ringkasan', 'Nilai'],
      ['Total Judul Koleksi', report.summary.totalBooks],
      ['Total Eksemplar', report.summary.totalCopies],
      ['Eksemplar Tersedia', report.summary.availableCopies],
      ['Peminjaman Aktif', report.summary.activeLoans],
      ['Mendekati Jatuh Tempo', report.summary.approachingDueLoans],
      ['Terlambat', report.summary.overdueLoans],
      ['Tingkat Kepatuhan (%)', report.summary.complianceRate],
      ['Total Akumulasi Denda (IDR)', report.summary.totalFines],
      ['Email Pengingat Terkirim', report.summary.emailsDispatched],
      [],
      ['Kategori Terpopuler', 'Jumlah Peminjaman', 'Persentase (%)'],
      ...report.topCategories.map((c) => [c.category, c.count, c.percentage]),
      [],
      ['Rincian Keterlambatan', 'Anggota', 'Email', 'Hari Terlambat', 'Denda (IDR)'],
      ...report.overdueDetails.map((d) => [
        d.bookTitle,
        d.memberName,
        d.memberEmail,
        d.daysOverdue,
        d.fineAmount,
      ]),
    ];

    const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laporan-lentera-pustaka-${report.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="no-print rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Sistem Pelaporan Sirkulasi Otomatis
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Laporan sirkulasi dibuat otomatis oleh scheduler perpustakaan dan dapat diekspor ke CSV atau dicetak sebagai dokumen PDF.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <select
              aria-label="Frekuensi otomatis"
              value={settings.autoReportFrequency}
              onChange={(e) =>
                onUpdateSettings({
                  autoReportFrequency: e.target.value as 'harian' | 'mingguan',
                })
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
            >
              <option value="harian">Jadwal Otomatis: Harian</option>
              <option value="mingguan">Jadwal Otomatis: Mingguan</option>
            </select>

            <select
              aria-label="Jenis periode laporan"
              value={periodType}
              onChange={(e) =>
                setPeriodType(e.target.value as 'harian' | 'mingguan' | 'bulanan')
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
            >
              <option value="harian">Periode Harian</option>
              <option value="mingguan">Periode Mingguan</option>
              <option value="bulanan">Periode Bulanan</option>
            </select>

            <button
              type="button"
              disabled={generating}
              onClick={handleGenerate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-60 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{generating ? 'Menyusun...' : 'Buat Laporan Sekarang'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Report Archive List */}
        <div className="no-print lg:col-span-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-display text-sm font-semibold text-slate-900 px-2 pb-3 border-b border-slate-100">
            Arsip Laporan ({reports.length})
          </h2>
          <div className="mt-3 space-y-1.5 max-h-[32rem] overflow-y-auto">
            {reports.map((rep) => (
              <button
                key={rep.id}
                type="button"
                onClick={() => setSelectedId(rep.id)}
                className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  activeReport?.id === rep.id
                    ? 'border-teal-700 bg-teal-50/70'
                    : 'border-transparent hover:bg-slate-50'
                }`}
              >
                <p className="text-xs font-semibold text-slate-900 line-clamp-1">{rep.title}</p>
                <p className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
                  {formatDateTimeId(rep.generatedAt)} ·{' '}
                  {rep.generatedBy === 'scheduler_otomatis' ? 'Otomatis' : 'Manual'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Active Printable Report Sheet */}
        <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-6">
          {!activeReport ? (
            <div className="py-16 text-center text-sm text-slate-500">
              <FileBarChart2 className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2">Belum ada laporan tersedia.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-medium text-teal-800">
                    Lentera Pustaka · Dokumen Laporan Resmi
                  </p>
                  <h2 className="mt-1 font-display text-xl font-bold text-slate-900">
                    {activeReport.title}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                    Dibuat: {formatDateTimeId(activeReport.generatedAt)} · Sumber:{' '}
                    {activeReport.generatedBy === 'scheduler_otomatis'
                      ? 'Scheduler Otomatis'
                      : 'Admin Pustakawan'}
                  </p>
                </div>

                <div className="no-print flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDownloadCsv(activeReport)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Unduh CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Cetak / PDF</span>
                  </button>
                </div>
              </div>

              {/* Summary Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-slate-200 p-3.5">
                  <p className="text-[11px] text-slate-500">Ketersediaan Stok</p>
                  <p className="mt-1 font-mono text-base font-bold text-slate-900 tabular-nums">
                    {activeReport.summary.availableCopies}/{activeReport.summary.totalCopies}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3.5">
                  <p className="text-[11px] text-slate-500">Pinjaman Aktif</p>
                  <p className="mt-1 font-mono text-base font-bold text-slate-900 tabular-nums">
                    {activeReport.summary.activeLoans}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3.5">
                  <p className="text-[11px] text-slate-500">Tingkat Kepatuhan</p>
                  <p className="mt-1 font-mono text-base font-bold text-emerald-700 tabular-nums">
                    {activeReport.summary.complianceRate}%
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3.5">
                  <p className="text-[11px] text-slate-500">Akumulasi Denda</p>
                  <p className="mt-1 font-mono text-base font-bold text-slate-900 tabular-nums">
                    {formatCurrencyId(activeReport.summary.totalFines)}
                  </p>
                </div>
              </div>

              {/* Top Categories */}
              <div>
                <h3 className="text-xs font-semibold text-slate-900 mb-3">
                  Peringkat Kategori Koleksi Terbanyak Dipinjam
                </h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <th className="px-3 py-2 font-medium">Kategori</th>
                        <th className="px-3 py-2 font-medium text-right">Total Sirkulasi</th>
                        <th className="px-3 py-2 font-medium text-right">Porsi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeReport.topCategories.map((cat) => (
                        <tr key={cat.category}>
                          <td className="px-3 py-2 text-slate-800">{cat.category}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-800">
                            {cat.count}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">
                            {cat.percentage}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Overdue Details */}
              <div>
                <h3 className="text-xs font-semibold text-slate-900 mb-3">
                  Rincian Keterlambatan ({activeReport.overdueDetails.length})
                </h3>
                {activeReport.overdueDetails.length === 0 ? (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                    Tidak terdapat peminjaman yang terlambat pada periode laporan ini.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                          <th className="px-3 py-2 font-medium">Judul Buku</th>
                          <th className="px-3 py-2 font-medium">Anggota</th>
                          <th className="px-3 py-2 font-medium text-right">Terlambat</th>
                          <th className="px-3 py-2 font-medium text-right">Denda</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeReport.overdueDetails.map((item) => (
                          <tr key={item.loanId}>
                            <td className="px-3 py-2 text-slate-900">{item.bookTitle}</td>
                            <td className="px-3 py-2 text-slate-600">
                              {item.memberName} ({item.memberEmail})
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-red-700">
                              {item.daysOverdue} hari
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-900">
                              {formatCurrencyId(item.fineAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

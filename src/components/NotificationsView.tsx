import { CheckCircle2, Mail, Send, Settings2, X } from 'lucide-react';
import { useState } from 'react';
import { formatDateId, formatDateTimeId } from '../lib/api.ts';
import type { EmailNotificationLog, LibrarySettings, UserProfile } from '../types.ts';

interface NotificationsViewProps {
  user: UserProfile | null;
  emailLogs: EmailNotificationLog[];
  settings: LibrarySettings;
  onDispatchAll: () => Promise<number>;
  onUpdateSettings: (patch: Partial<LibrarySettings>) => Promise<void>;
  onOpenAuth: () => void;
}

const STAGE_TEXT: Record<EmailNotificationLog['stage'], string> = {
  h_minus_2: 'Pengingat H-2',
  h_minus_1: 'Pengingat H-1',
  due_today: 'Jatuh Tempo Hari Ini',
  overdue: 'Terlambat',
  manual_test: 'Pengingat Manual',
};

export function NotificationsView({
  user,
  emailLogs,
  settings,
  onDispatchAll,
  onUpdateSettings,
  onOpenAuth,
}: NotificationsViewProps) {
  const [selectedEmail, setSelectedEmail] = useState<EmailNotificationLog | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
        <Mail className="mx-auto h-9 w-9 text-slate-300" />
        <h2 className="mt-3 font-display text-lg font-semibold text-slate-900">
          Pusat Notifikasi Pengingat Jatuh Tempo
        </h2>
        <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
          Masuk untuk melihat riwayat pengingat email jatuh tempo yang dikirim ke akun Anda atau kelola pengiriman real-time sebagai Admin.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="mt-5 rounded-lg bg-[#0F2942] px-5 py-2.5 text-xs font-medium text-white hover:bg-[#163A5C]"
        >
          Masuk Akun
        </button>
      </div>
    );
  }

  const isAdmin = user.role === 'admin';

  async function handleDispatch() {
    setDispatching(true);
    setNotice(null);
    try {
      const count = await onDispatchAll();
      setNotice(
        count > 0
          ? `${count} email pengingat jatuh tempo berhasil diproses dan dikirim.`
          : 'Pemindaian selesai. Tidak ada peminjaman baru yang memerlukan pengingat tambahan.'
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Gagal memindai pengingat.');
    } finally {
      setDispatching(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Notifikasi Pengingat Jatuh Tempo (Email Real-Time)
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {isAdmin
                ? 'Pemindai tenggat otomatis berjalan berkala setiap 30 detik di server untuk mengirim email H-2, H-1, Hari H, dan keterlambatan.'
                : `Menampilkan seluruh pengingat jatuh tempo yang dikirimkan ke alamat email ${user.email}.`}
            </p>
          </div>

          {isAdmin && (
            <button
              type="button"
              disabled={dispatching}
              onClick={handleDispatch}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0F2942] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#163A5C] disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{dispatching ? 'Memindai Tenggat...' : 'Pindai & Kirim Sekarang'}</span>
            </button>
          )}
        </div>

        {/* Transport & Automation Config Strip */}
        <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-500">Mode Pengiriman Email Server</p>
            <p className="mt-1.5 text-sm font-semibold text-slate-900">
              {settings.smtpConfigured ? 'SMTP Live Aktif' : 'Mode Pratinjau Server'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {settings.smtpConfigured
                ? 'Terhubung dengan server SMTP untuk pengiriman langsung ke inbox anggota.'
                : 'Atur SMTP_HOST, SMTP_USER, dan SMTP_PASS di Secrets untuk pengiriman ke inbox eksternal.'}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500">Pengingat Otomatis Real-Time</p>
              <Settings2 className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">
                {settings.autoEmailReminderEnabled ? 'Aktif Otomatis' : 'Dijeda'}
              </span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      autoEmailReminderEnabled: !settings.autoEmailReminderEnabled,
                    })
                  }
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    settings.autoEmailReminderEnabled
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {settings.autoEmailReminderEnabled ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-500">Ambang Pengingat Awal</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                H-{settings.reminderLeadDays} sebelum jatuh tempo
              </span>
              {isAdmin && (
                <select
                  aria-label="Ambang hari pengingat"
                  value={settings.reminderLeadDays}
                  onChange={(e) =>
                    onUpdateSettings({ reminderLeadDays: Number(e.target.value) })
                  }
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700"
                >
                  <option value={1}>H-1</option>
                  <option value={2}>H-2</option>
                  <option value={3}>H-3</option>
                  <option value={5}>H-5</option>
                </select>
              )}
            </div>
          </div>
        </div>
      </div>

      {notice && (
        <div className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2.5 text-xs text-slate-900">
          {notice}
        </div>
      )}

      {/* Email Dispatch Logs Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Riwayat Pengiriman Email ({emailLogs.length})
          </h2>
          <span className="text-xs text-slate-500">Klik baris untuk membaca isi email</span>
        </div>

        {emailLogs.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            Belum ada notifikasi email jatuh tempo yang terkirim.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-4 py-3 font-medium">Waktu Kirim</th>
                  <th className="px-4 py-3 font-medium">Penerima</th>
                  <th className="px-4 py-3 font-medium">Judul Buku</th>
                  <th className="px-4 py-3 font-medium">Tahap Pengingat</th>
                  <th className="px-4 py-3 font-medium">Status Kirim</th>
                  <th className="px-4 py-3 font-medium text-right">Pratinjau</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {emailLogs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedEmail(log)}
                    className="cursor-pointer hover:bg-slate-50/80"
                  >
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {formatDateTimeId(log.sentAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{log.recipientName}</p>
                      <p className="font-mono text-slate-500">{log.recipientEmail}</p>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-slate-900 truncate">{log.bookTitle}</p>
                      <p className="text-slate-500 tabular-nums">
                        Jatuh tempo: {formatDateId(log.dueAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-amber-800">
                      {STAGE_TEXT[log.stage]}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 font-medium ${
                          log.status === 'terkirim' ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>
                          {log.status === 'terkirim'
                            ? log.deliveryMode === 'smtp_live'
                              ? 'Terkirim (SMTP)'
                              : 'Terkirim (Server Log)'
                            : 'Gagal'}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEmail(log);
                        }}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Baca Email
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Email Preview Modal */}
      {selectedEmail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-medium text-[#0F2942]">
                  {STAGE_TEXT[selectedEmail.stage]} · {formatDateTimeId(selectedEmail.sentAt)}
                </p>
                <h3 className="mt-1 font-display text-base font-bold text-slate-900">
                  {selectedEmail.subject}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmail(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2 text-xs text-slate-600 border-b border-slate-100 pb-4">
              <p>
                Kepada: <strong className="text-slate-900">{selectedEmail.recipientName}</strong> (
                <span className="font-mono">{selectedEmail.recipientEmail}</span>)
              </p>
              <p>
                Mode Pengiriman:{' '}
                <strong className="text-slate-900">
                  {selectedEmail.deliveryMode === 'smtp_live'
                    ? 'SMTP Server Langsung'
                    : 'Pratinjau & Antrean Server'}
                </strong>
              </p>
            </div>

            <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 font-sans text-xs leading-relaxed text-slate-800">
              {selectedEmail.bodyText}
            </pre>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEmail(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

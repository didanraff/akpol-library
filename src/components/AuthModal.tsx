import { ShieldCheck, UserPlus, LogIn, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api.ts';
import type { AuthBootstrapStatus, UserProfile } from '../types.ts';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string, user: UserProfile) => void;
  initialMode?: 'member_login' | 'member_register' | 'admin';
}

export function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'member_login',
}: AuthModalProps) {
  const [mode, setMode] = useState<'member_login' | 'member_register' | 'admin'>(initialMode);
  const [bootstrap, setBootstrap] = useState<AuthBootstrapStatus | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Teknik Informatika');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setError(null);
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    apiRequest<AuthBootstrapStatus>('/api/auth/bootstrap-status')
      .then((res) => setBootstrap(res))
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const isFirstRunAdminClaim =
    mode === 'admin' && bootstrap !== null && !bootstrap.adminClaimed && !bootstrap.hasEnvPasscode;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'member_register') {
        const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, department, password }),
        });
        onSuccess(res.token, res.user);
        onClose();
        return;
      }

      if (isFirstRunAdminClaim) {
        const res = await apiRequest<{ token: string; user: UserProfile }>(
          '/api/auth/claim-admin',
          {
            method: 'POST',
            body: JSON.stringify({
              name: name || 'Admin Pustakawan',
              email,
              password,
            }),
          }
        );
        onSuccess(res.token, res.user);
        onClose();
        return;
      }

      const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          role: mode === 'admin' ? 'admin' : 'member',
        }),
      });
      onSuccess(res.token, res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses akun.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 id="auth-modal-title" className="font-display text-lg font-bold text-slate-900">
              {mode === 'member_register'
                ? 'Pendaftaran Anggota Perpustakaan'
                : mode === 'admin'
                  ? isFirstRunAdminClaim
                    ? 'Pengaturan Akun Admin Pertama'
                    : 'Masuk Portal Admin'
                  : 'Masuk Akun Member'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {mode === 'member_register'
                ? 'Alamat email Anda akan digunakan untuk notifikasi pengingat jatuh tempo.'
                : mode === 'admin'
                  ? isFirstRunAdminClaim
                    ? 'Buat kredensial Admin Pustakawan pertama untuk mengelola koleksi dan laporan.'
                    : 'Akses manajemen koleksi, pemantauan transaksi real-time, dan pelaporan otomatis.'
                  : 'Pinjam buku secara online, pantau jatuh tempo, dan kelola riwayat baca.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Role / Mode Segmented Selector */}
        <div className="mt-4 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('member_login');
              setError(null);
            }}
            className={`rounded-md px-2 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
              mode === 'member_login'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Masuk Member
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('member_register');
              setError(null);
            }}
            className={`rounded-md px-2 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
              mode === 'member_register'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Daftar Baru
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('admin');
              setError(null);
            }}
            className={`rounded-md px-2 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
              mode === 'admin'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Portal Admin
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {(mode === 'member_register' || isFirstRunAdminClaim) && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Nama Lengkap
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isFirstRunAdminClaim ? 'Admin Pustakawan' : 'Contoh: Dinda Prameswari'}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>
          )}

          {!(mode === 'admin' && bootstrap?.hasEnvPasscode) && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Alamat Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>
          )}

          {mode === 'member_register' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Program Studi / Unit
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Contoh: Teknik Informatika"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {mode === 'admin' && bootstrap?.hasEnvPasscode ? 'Passcode Admin Server' : 'Kata Sandi'}
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            {mode === 'member_register' ? (
              <>
                <UserPlus className="h-4 w-4" />
                <span>{loading ? 'Mendaftarkan...' : 'Daftar & Masuk'}</span>
              </>
            ) : mode === 'admin' ? (
              <>
                <ShieldCheck className="h-4 w-4" />
                <span>
                  {loading
                    ? 'Memverifikasi...'
                    : isFirstRunAdminClaim
                      ? 'Simpan & Masuk sebagai Admin'
                      : 'Masuk sebagai Admin'}
                </span>
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                <span>{loading ? 'Memproses...' : 'Masuk Member'}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

import { BookOpen, Calendar, CheckCircle2, Mail, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatDateId } from '../lib/api.ts';
import type { Book, UserProfile } from '../types.ts';
import { BookCover } from './BookCover.tsx';

interface CatalogViewProps {
  books: Book[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  user: UserProfile | null;
  members: UserProfile[];
  onBorrowBook: (bookId: string, durationDays: number, memberId?: string) => Promise<void>;
  onOpenAuth: () => void;
}

export function CatalogView({
  books,
  searchQuery,
  onSearchChange,
  user,
  members,
  onBorrowBook,
  onOpenAuth,
}: CatalogViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [availabilityFilter, setAvailabilityFilter] = useState<'semua' | 'tersedia' | 'habis'>(
    'semua'
  );
  const [sortBy, setSortBy] = useState<'populer' | 'terbaru' | 'judul'>('populer');

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [durationDays, setDurationDays] = useState<number>(7);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(books.map((b) => b.category)));
    return ['Semua', ...unique];
  }, [books]);

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return books
      .filter((b) => {
        if (selectedCategory !== 'Semua' && b.category !== selectedCategory) return false;
        if (availabilityFilter === 'tersedia' && b.availableCopies <= 0) return false;
        if (availabilityFilter === 'habis' && b.availableCopies > 0) return false;
        if (!q) return true;
        return (
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          b.isbn.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'populer') return b.borrowCount - a.borrowCount;
        if (sortBy === 'terbaru') return b.year - a.year;
        return a.title.localeCompare(b.title, 'id');
      });
  }, [books, searchQuery, selectedCategory, availabilityFilter, sortBy]);

  const previewDueDate = useMemo(() => {
    const d = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    return formatDateId(d.toISOString());
  }, [durationDays]);

  async function handleConfirmBorrow() {
    if (!selectedBook) return;
    if (!user) {
      setSelectedBook(null);
      onOpenAuth();
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      await onBorrowBook(
        selectedBook.id,
        durationDays,
        user.role === 'admin' && selectedMemberId ? selectedMemberId : undefined
      );
      setFeedback({
        type: 'ok',
        text: `Peminjaman "${selectedBook.title}" berhasil diproses. Jatuh tempo pada ${previewDueDate}.`,
      });
      setTimeout(() => {
        setSelectedBook(null);
        setFeedback(null);
      }, 1100);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal memproses peminjaman.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Katalog Koleksi & Peminjaman Online
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Telusuri {books.length} judul terkurasi, cek ketersediaan eksemplar secara real-time, dan ajukan peminjaman instan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-60 flex-1 sm:flex-initial">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Cari judul, penulis, ISBN..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-[#0F2942] focus:bg-white focus:outline-none"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'populer' | 'terbaru' | 'judul')}
              aria-label="Urutkan buku"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-[#0F2942] focus:outline-none"
            >
              <option value="populer">Terpopuler</option>
              <option value="terbaru">Tahun Terbaru</option>
              <option value="judul">Judul A–Z</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  selectedCategory === cat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 self-start sm:self-auto">
            {(
              [
                ['semua', 'Semua Stok'],
                ['tersedia', 'Tersedia'],
                ['habis', 'Dipinjam Habis'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setAvailabilityFilter(key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  availabilityFilter === key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Book Grid */}
      {filteredBooks.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 font-display text-base font-semibold text-slate-900">
            Tidak ada koleksi yang sesuai
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Coba ubah kata kunci pencarian atau pilih kategori lain.
          </p>
          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              setSelectedCategory('Semua');
              setAvailabilityFilter('semua');
            }}
            className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Atur Ulang Filter
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredBooks.map((book) => {
            const isAvailable = book.availableCopies > 0;
            return (
              <article
                key={book.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors hover:border-slate-300"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-slate-100 bg-slate-100">
                  <BookCover
                    src={book.coverUrl}
                    title={book.title}
                    author={book.author}
                    className="h-full w-full transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>

                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="truncate">{book.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums shrink-0">{book.year}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums shrink-0">Rak {book.shelfCode}</span>
                    </div>

                    <h2 className="mt-1.5 font-display text-base font-semibold leading-snug text-slate-900 line-clamp-2">
                      {book.title}
                    </h2>
                    <p className="mt-1 text-xs text-slate-600 truncate">{book.author}</p>
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between text-xs tabular-nums">
                      <span
                        className={`font-medium ${
                          isAvailable ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {isAvailable
                          ? `Tersedia ${book.availableCopies} dari ${book.totalCopies}`
                          : 'Stok habis sementara'}
                      </span>
                      <span className="font-mono text-slate-400">{book.borrowCount}x dipinjam</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBook(book);
                        setFeedback(null);
                        setDurationDays(7);
                        setSelectedMemberId('');
                      }}
                      className={`mt-3 w-full rounded-lg px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                        isAvailable
                          ? 'bg-[#0F2942] text-white hover:bg-[#163A5C]'
                          : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {isAvailable ? 'Pinjam Buku Online' : 'Lihat Detail Koleksi'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Book Detail & Online Borrow Modal */}
      {selectedBook && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="book-modal-title"
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-12">
              <div className="md:col-span-5 bg-slate-100">
                <BookCover
                  src={selectedBook.coverUrl}
                  title={selectedBook.title}
                  author={selectedBook.author}
                  className="h-64 w-full md:h-full"
                />
              </div>

              <div className="md:col-span-7 p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      {selectedBook.category} <span aria-hidden="true">·</span> Rak{' '}
                      <span className="font-mono">{selectedBook.shelfCode}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedBook(null)}
                      aria-label="Tutup detail buku"
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <h3
                    id="book-modal-title"
                    className="mt-1 font-display text-xl font-bold text-slate-900"
                  >
                    {selectedBook.title}
                  </h3>
                  <p className="mt-0.5 text-sm text-slate-600">{selectedBook.author}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-slate-100 py-2.5 text-xs text-slate-500 tabular-nums">
                    <span>ISBN: <strong className="font-mono text-slate-700">{selectedBook.isbn}</strong></span>
                    <span>Penerbit: {selectedBook.publisher}</span>
                    <span>{selectedBook.pages} halaman</span>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    {selectedBook.synopsis}
                  </p>

                  {selectedBook.availableCopies > 0 && (
                    <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                      {user?.role === 'admin' && members.length > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Pinjamkan untuk Anggota (Opsional)
                          </label>
                          <select
                            value={selectedMemberId}
                            onChange={(e) => setSelectedMemberId(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-[#0F2942] focus:outline-none"
                          >
                            <option value="">Atas nama Admin ({user.name})</option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.memberCode}) — {m.email}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">
                          Pilih Durasi Peminjaman
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[3, 7, 14].map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setDurationDays(d)}
                              className={`rounded-lg border px-3 py-2 text-xs font-medium tabular-nums transition-colors ${
                                durationDays === d
                                  ? 'border-[#0F2942] bg-slate-100 text-[#0F2942]'
                                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {d} Hari
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1 text-xs text-slate-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-[#0F2942] shrink-0" />
                          <span>
                            Batas jatuh tempo:{' '}
                            <strong className="font-mono text-slate-900">{previewDueDate}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-[#0F2942] shrink-0" />
                          <span>
                            Pengingat otomatis dikirim ke email pada H-2 & H-1 jatuh tempo.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 space-y-2.5">
                  {feedback && (
                    <div
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                        feedback.type === 'ok'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-red-200 bg-red-50 text-red-700'
                      }`}
                    >
                      {feedback.type === 'ok' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                      <span>{feedback.text}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedBook(null)}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Tutup
                    </button>
                    {selectedBook.availableCopies > 0 && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={handleConfirmBorrow}
                        className="rounded-lg bg-[#0F2942] px-4 py-2 text-xs font-medium text-white hover:bg-[#163A5C] disabled:opacity-60 whitespace-nowrap"
                      >
                        {!user
                          ? 'Masuk untuk Meminjam'
                          : submitting
                            ? 'Memproses...'
                            : 'Konfirmasi Peminjaman'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

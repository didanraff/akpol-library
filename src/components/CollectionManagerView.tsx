import { Pencil, Plus, Search, ShieldAlert, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { GENERATED_COVER_PRESETS } from '../lib/api.ts';
import type { Book, UserProfile } from '../types.ts';
import { BookCover } from './BookCover.tsx';

interface CollectionManagerViewProps {
  user: UserProfile | null;
  books: Book[];
  onCreateBook: (payload: Omit<Book, 'id' | 'availableCopies' | 'borrowCount' | 'addedAt'>) => Promise<void>;
  onUpdateBook: (
    bookId: string,
    payload: Partial<Omit<Book, 'id' | 'availableCopies' | 'borrowCount' | 'addedAt'>>
  ) => Promise<void>;
  onDeleteBook: (bookId: string) => Promise<void>;
  onOpenAdminAuth: () => void;
}

const CATEGORIES = [
  'Ilmu Komputer',
  'Arsitektur & Desain',
  'Sastra & Sejarah',
  'Ekonomi & Data',
  'Psikologi & Produktivitas',
  'Sains & Teknologi',
];

export function CollectionManagerView({
  user,
  books,
  onCreateBook,
  onUpdateBook,
  onDeleteBook,
  onOpenAdminAuth,
}: CollectionManagerViewProps) {
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [publisher, setPublisher] = useState('Akpol Press');
  const [year, setYear] = useState(2026);
  const [pages, setPages] = useState(280);
  const [shelfCode, setShelfCode] = useState('A-105');
  const [totalCopies, setTotalCopies] = useState(4);
  const [coverUrl, setCoverUrl] = useState(GENERATED_COVER_PRESETS[0].url);
  const [synopsis, setSynopsis] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.shelfCode.toLowerCase().includes(q)
    );
  }, [books, query]);

  if (user?.role !== 'admin') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
        <ShieldAlert className="mx-auto h-9 w-9 text-amber-600" />
        <h2 className="mt-3 font-display text-lg font-semibold text-slate-900">
          Manajemen Koleksi Khusus Admin
        </h2>
        <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
          Penambahan judul baru, pembaruan stok eksemplar, dan penghapusan koleksi hanya dapat dilakukan oleh akun Admin Akpol Library.
        </p>
        <button
          type="button"
          onClick={onOpenAdminAuth}
          className="mt-5 rounded-lg bg-[#0F2942] px-5 py-2.5 text-xs font-medium text-white hover:bg-[#163A5C]"
        >
          Masuk Portal Admin
        </button>
      </div>
    );
  }

  function openCreate() {
    setEditingBook(null);
    setTitle('');
    setAuthor('');
    setIsbn('');
    setCategory(CATEGORIES[0]);
    setPublisher('Akpol Press');
    setYear(2026);
    setPages(280);
    setShelfCode('A-105');
    setTotalCopies(4);
    setCoverUrl(GENERATED_COVER_PRESETS[0].url);
    setSynopsis('');
    setError(null);
    setModalOpen(true);
  }

  function openEdit(book: Book) {
    setEditingBook(book);
    setTitle(book.title);
    setAuthor(book.author);
    setIsbn(book.isbn);
    setCategory(book.category);
    setPublisher(book.publisher);
    setYear(book.year);
    setPages(book.pages);
    setShelfCode(book.shelfCode);
    setTotalCopies(book.totalCopies);
    setCoverUrl(book.coverUrl);
    setSynopsis(book.synopsis);
    setError(null);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title,
        author,
        isbn,
        category,
        publisher,
        year,
        pages,
        shelfCode,
        totalCopies,
        coverUrl,
        synopsis,
      };
      if (editingBook) {
        await onUpdateBook(editingBook.id, payload);
      } else {
        await onCreateBook(payload);
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan koleksi.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(bookId: string) {
    setError(null);
    try {
      await onDeleteBook(bookId);
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus koleksi.');
      setDeleteConfirmId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Manajemen Koleksi Perpustakaan
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Kelola katalog judul buku, kode rak, metadata ISBN, dan jumlah eksemplar yang tersedia.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari koleksi..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-[#0F2942] focus:bg-white focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F2942] px-4 py-2 text-xs font-medium text-white hover:bg-[#163A5C] whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Buku</span>
          </button>
        </div>
      </div>

      {error && !modalOpen && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-4 py-3 font-medium">Koleksi</th>
                <th className="px-4 py-3 font-medium">Kategori</th>
                <th className="px-4 py-3 font-medium">Rak</th>
                <th className="px-4 py-3 font-medium text-right">Tersedia / Total</th>
                <th className="px-4 py-3 font-medium text-right">Dipinjam</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((book) => (
                <tr key={book.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <BookCover
                        src={book.coverUrl}
                        title={book.title}
                        className="h-12 w-9 rounded border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate max-w-xs">{book.title}</p>
                        <p className="mt-0.5 text-slate-500">
                          {book.author} · <span className="font-mono">{book.isbn}</span>
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{book.category}</td>
                  <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                    {book.shelfCode}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                    <span
                      className={
                        book.availableCopies > 0
                          ? 'font-medium text-emerald-700'
                          : 'font-medium text-red-700'
                      }
                    >
                      {book.availableCopies}
                    </span>{' '}
                    / {book.totalCopies}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                    {book.borrowCount}x
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {deleteConfirmId === book.id ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDelete(book.id)}
                          className="rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-700"
                        >
                          Ya, Hapus
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(book)}
                          aria-label={`Ubah ${book.title}`}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Ubah</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(book.id)}
                          aria-label={`Hapus ${book.title}`}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Book Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editingBook ? 'Perbarui Koleksi Buku' : 'Tambah Koleksi Buku Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Judul Buku
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#0F2942] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Penulis</label>
                  <input
                    type="text"
                    required
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#0F2942] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ISBN</label>
                  <input
                    type="text"
                    required
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    placeholder="978-602-481-xxx-x"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:border-[#0F2942] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Kategori</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#0F2942] focus:outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Penerbit</label>
                  <input
                    type="text"
                    value={publisher}
                    onChange={(e) => setPublisher(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#0F2942] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kode Rak
                  </label>
                  <input
                    type="text"
                    value={shelfCode}
                    onChange={(e) => setShelfCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:border-[#0F2942] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Tahun</label>
                    <input
                      type="number"
                      min={1900}
                      max={2030}
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-mono focus:border-[#0F2942] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Hal.</label>
                    <input
                      type="number"
                      min={10}
                      max={3000}
                      value={pages}
                      onChange={(e) => setPages(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-mono focus:border-[#0F2942] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Stok</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={totalCopies}
                      onChange={(e) => setTotalCopies(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-mono focus:border-[#0F2942] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Desain Sampul Koleksi
                  </label>
                  <select
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#0F2942] focus:outline-none"
                  >
                    {GENERATED_COVER_PRESETS.map((preset) => (
                      <option key={preset.url} value={preset.url}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Sinopsis</label>
                  <textarea
                    rows={3}
                    value={synopsis}
                    onChange={(e) => setSynopsis(e.target.value)}
                    placeholder="Ringkasan isi buku..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#0F2942] focus:outline-none"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#0F2942] px-4 py-2 text-xs font-medium text-white hover:bg-[#163A5C] disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : editingBook ? 'Simpan Perubahan' : 'Tambahkan Koleksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

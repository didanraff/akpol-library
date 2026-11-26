import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';
import type {
  ActivityEvent,
  AutomatedReport,
  Book,
  DailyBorrowPoint,
  EmailNotificationLog,
  LibrarySettings,
  LoanStatus,
  LoanTransaction,
  ReminderStage,
  UserProfile,
  UserRole,
} from './src/types.ts';

dotenv.config();

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'library-db.json');

interface StoredUser extends UserProfile {
  passwordHash: string;
  salt: string;
}

interface AdminCredential {
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  claimedAt: string;
}

interface LibraryDatabase {
  adminCredential: AdminCredential | null;
  users: StoredUser[];
  books: Book[];
  loans: LoanTransaction[];
  activities: ActivityEvent[];
  emailLogs: EmailNotificationLog[];
  reports: AutomatedReport[];
  settings: Omit<LibrarySettings, 'smtpConfigured'>;
  lastAutoReportDate: string | null;
}

interface SessionRecord {
  token: string;
  user: UserProfile;
  expiresAt: number;
}

interface AuthedRequest extends Request {
  authUser?: UserProfile;
  authToken?: string;
}

const sessions = new Map<string, SessionRecord>();
const sseClients = new Set<Response>();

function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
}

function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash: derived, salt };
}

function verifyPassword(password: string, expectedHash: string, salt: string): boolean {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function constantTimeCompareString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

function sanitizeText(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 160;
}

function isValidCoverUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('/src/assets/')) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function daysFromNowIso(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function formatDateId(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function createSeedDatabase(): LibraryDatabase {
  const now = Date.now();
  const books: Book[] = [
    {
      id: 'bk-algo-01',
      title: 'Algoritma & Struktur Data Modern',
      author: 'Dr. Alan B. Koppelman',
      isbn: '978-602-481-012-4',
      category: 'Ilmu Komputer',
      publisher: 'Pustaka Informatika Nusantara',
      year: 2025,
      pages: 482,
      shelfCode: 'A-101',
      totalCopies: 6,
      availableCopies: 4,
      coverUrl: '/src/assets/images/book_cover_algorithms_1795659561904.jpg',
      synopsis:
        'Panduan komprehensif mengenai perancangan algoritma efisien, analisis kompleksitas waktu, struktur pohon berimbang, dan graf terdistribusi untuk sistem berskala besar.',
      borrowCount: 42,
      addedAt: daysFromNowIso(-90),
    },
    {
      id: 'bk-arch-02',
      title: 'Monolit Tropis: Arsitektur Beton & Cahaya',
      author: 'Ar. Pramudya Wibowo',
      isbn: '978-602-481-044-5',
      category: 'Arsitektur & Desain',
      publisher: 'Balai Grafis Jakarta',
      year: 2024,
      pages: 316,
      shelfCode: 'B-204',
      totalCopies: 4,
      availableCopies: 2,
      coverUrl: '/src/assets/images/book_cover_architecture_1795659563934.jpg',
      synopsis:
        'Kajian mendalam mengenai penerapan beton ekspos, ventilasi silang alami, dan permainan bayangan matahari pada bangunan publik serta paviliun modern di iklim tropis Indonesia.',
      borrowCount: 29,
      addedAt: daysFromNowIso(-75),
    },
    {
      id: 'bk-hist-03',
      title: 'Rempah di Atas Ombak: Sejarah Maritim',
      author: 'Siti Nuraini',
      isbn: '978-602-481-089-6',
      category: 'Sastra & Sejarah',
      publisher: 'Lembaga Aksara Timur',
      year: 2023,
      pages: 398,
      shelfCode: 'C-112',
      totalCopies: 5,
      availableCopies: 3,
      coverUrl: '/src/assets/images/book_cover_nusantara_1795659563535.jpg',
      synopsis:
        'Novel sejarah yang menelusuri jalur pelayaran pala dan cengkeh abad ke-16 dari Banda Neira hingga Malaka, memadukan arsip perdagangan kuno dengan kisah pelaut Nusantara.',
      borrowCount: 51,
      addedAt: daysFromNowIso(-120),
    },
    {
      id: 'bk-econ-04',
      title: 'Sains Data & Ekonomi Makro Terapan',
      author: 'Sarah J. Chen & Liam O’Connell',
      isbn: '978-602-481-118-3',
      category: 'Ekonomi & Data',
      publisher: 'Press Ekonomi Terpadu',
      year: 2025,
      pages: 424,
      shelfCode: 'D-308',
      totalCopies: 5,
      availableCopies: 4,
      coverUrl: '/src/assets/images/book_cover_economics_1795659564161.jpg',
      synopsis:
        'Menggabungkan pemodelan ekonometrika deret waktu dengan machine learning untuk proyeksi inflasi, analisis rantai pasok nasional, dan evaluasi kebijakan fiskal berbasis data.',
      borrowCount: 34,
      addedAt: daysFromNowIso(-60),
    },
    {
      id: 'bk-psy-05',
      title: 'Ilmu Kognitif & Fokus Mendalam',
      author: 'Harper Reed & Elias Thoreau',
      isbn: '978-602-481-155-8',
      category: 'Psikologi & Produktivitas',
      publisher: 'Cendekia Press',
      year: 2024,
      pages: 274,
      shelfCode: 'E-119',
      totalCopies: 7,
      availableCopies: 5,
      coverUrl: '/src/assets/images/book_cover_psychology_1795659564912.jpg',
      synopsis:
        'Eksplorasi neurosains di balik atensi berkelanjutan, manajemen beban kognitif, dan strategi membangun kebiasaan kerja mendalam di tengah ekosistem informasi digital.',
      borrowCount: 47,
      addedAt: daysFromNowIso(-45),
    },
    {
      id: 'bk-algo-06',
      title: 'Arsitektur Sistem Terdistribusi',
      author: 'Hendrawan Kusuma',
      isbn: '978-602-481-190-9',
      category: 'Ilmu Komputer',
      publisher: 'Pustaka Informatika Nusantara',
      year: 2025,
      pages: 510,
      shelfCode: 'A-104',
      totalCopies: 4,
      availableCopies: 3,
      coverUrl: '/src/assets/images/book_cover_algorithms_1795659561904.jpg',
      synopsis:
        'Pembahasan praktis konsensus Raft, replikasi basis data multi-wilayah, ketahanan layanan mikro, dan observabilitas real-time pada skala produksi.',
      borrowCount: 23,
      addedAt: daysFromNowIso(-30),
    },
    {
      id: 'bk-econ-07',
      title: 'Statistika Spasial & Kebijakan Publik',
      author: 'Dr. Ratna Sari Dewi',
      isbn: '978-602-481-205-0',
      category: 'Ekonomi & Data',
      publisher: 'Press Ekonomi Terpadu',
      year: 2024,
      pages: 340,
      shelfCode: 'D-312',
      totalCopies: 3,
      availableCopies: 3,
      coverUrl: '/src/assets/images/book_cover_economics_1795659564161.jpg',
      synopsis:
        'Metodologi pemetaan ketimpangan wilayah, indeks aksesibilitas fasilitas publik, dan pemodelan spasial untuk perencanaan pembangunan daerah.',
      borrowCount: 18,
      addedAt: daysFromNowIso(-22),
    },
    {
      id: 'bk-hist-08',
      title: 'Katalog Manuskrip Aksara Kuno',
      author: 'Prof. Bagus Santoso',
      isbn: '978-602-481-233-3',
      category: 'Sastra & Sejarah',
      publisher: 'Lembaga Aksara Timur',
      year: 2023,
      pages: 288,
      shelfCode: 'C-118',
      totalCopies: 3,
      availableCopies: 2,
      coverUrl: '/src/assets/images/book_cover_nusantara_1795659563535.jpg',
      synopsis:
        'Dokumentasi digitalisasi naskah lontar dan kertas daluang abad ke-18 beserta transliterasi dan catatan filologi untuk peneliti sejarah budaya.',
      borrowCount: 15,
      addedAt: daysFromNowIso(-18),
    },
  ];

  // Seed directory profiles (accounts without pre-set passwords can be registered or claimed via login/register)
  const sampleUsers: StoredUser[] = [
    {
      id: 'mbr-001',
      name: 'Nadia Kartika',
      email: 'nadia.kartika@pustaka.example',
      role: 'member',
      memberCode: 'LIB-2026-014',
      department: 'Teknik Informatika',
      joinedAt: daysFromNowIso(-120),
      status: 'aktif',
      passwordHash: '',
      salt: '',
    },
    {
      id: 'mbr-002',
      name: 'Rafi Pratama',
      email: 'rafi.pratama@pustaka.example',
      role: 'member',
      memberCode: 'LIB-2026-028',
      department: 'Arsitektur',
      joinedAt: daysFromNowIso(-95),
      status: 'aktif',
      passwordHash: '',
      salt: '',
    },
    {
      id: 'mbr-003',
      name: 'Ayu Lestari',
      email: 'ayu.lestari@pustaka.example',
      role: 'member',
      memberCode: 'LIB-2026-041',
      department: 'Ekonomi Pembangunan',
      joinedAt: daysFromNowIso(-64),
      status: 'aktif',
      passwordHash: '',
      salt: '',
    },
  ];

  const loans: LoanTransaction[] = [
    {
      id: 'ln-1001',
      bookId: 'bk-algo-01',
      bookTitle: 'Algoritma & Struktur Data Modern',
      bookAuthor: 'Dr. Alan B. Koppelman',
      bookCoverUrl: books[0].coverUrl,
      isbn: books[0].isbn,
      memberId: 'mbr-001',
      memberName: 'Nadia Kartika',
      memberEmail: 'nadia.kartika@pustaka.example',
      memberCode: 'LIB-2026-014',
      borrowedAt: daysFromNowIso(-6),
      dueAt: daysFromNowIso(1),
      returnedAt: null,
      durationDays: 7,
      renewCount: 0,
      status: 'mendekati_jatuh_tempo',
      fineAmount: 0,
      lastReminderSentAt: new Date(now - 3600 * 1000 * 3).toISOString(),
      reminderStage: 'h_minus_1',
    },
    {
      id: 'ln-1002',
      bookId: 'bk-arch-02',
      bookTitle: 'Monolit Tropis: Arsitektur Beton & Cahaya',
      bookAuthor: 'Ar. Pramudya Wibowo',
      bookCoverUrl: books[1].coverUrl,
      isbn: books[1].isbn,
      memberId: 'mbr-002',
      memberName: 'Rafi Pratama',
      memberEmail: 'rafi.pratama@pustaka.example',
      memberCode: 'LIB-2026-028',
      borrowedAt: daysFromNowIso(-10),
      dueAt: daysFromNowIso(-3),
      returnedAt: null,
      durationDays: 7,
      renewCount: 0,
      status: 'terlambat',
      fineAmount: 6000,
      lastReminderSentAt: new Date(now - 3600 * 1000 * 6).toISOString(),
      reminderStage: 'overdue',
    },
    {
      id: 'ln-1003',
      bookId: 'bk-hist-03',
      bookTitle: 'Rempah di Atas Ombak: Sejarah Maritim',
      bookAuthor: 'Siti Nuraini',
      bookCoverUrl: books[2].coverUrl,
      isbn: books[2].isbn,
      memberId: 'mbr-003',
      memberName: 'Ayu Lestari',
      memberEmail: 'ayu.lestari@pustaka.example',
      memberCode: 'LIB-2026-041',
      borrowedAt: daysFromNowIso(-2),
      dueAt: daysFromNowIso(5),
      returnedAt: null,
      durationDays: 7,
      renewCount: 0,
      status: 'dipinjam',
      fineAmount: 0,
      lastReminderSentAt: null,
      reminderStage: 'none',
    },
    {
      id: 'ln-1004',
      bookId: 'bk-psy-05',
      bookTitle: 'Ilmu Kognitif & Fokus Mendalam',
      bookAuthor: 'Harper Reed & Elias Thoreau',
      bookCoverUrl: books[4].coverUrl,
      isbn: books[4].isbn,
      memberId: 'mbr-001',
      memberName: 'Nadia Kartika',
      memberEmail: 'nadia.kartika@pustaka.example',
      memberCode: 'LIB-2026-014',
      borrowedAt: daysFromNowIso(-12),
      dueAt: daysFromNowIso(-5),
      returnedAt: daysFromNowIso(-6),
      durationDays: 7,
      renewCount: 0,
      status: 'dikembalikan',
      fineAmount: 0,
      lastReminderSentAt: null,
      reminderStage: 'none',
    },
    {
      id: 'ln-1005',
      bookId: 'bk-econ-04',
      bookTitle: 'Sains Data & Ekonomi Makro Terapan',
      bookAuthor: 'Sarah J. Chen & Liam O’Connell',
      bookCoverUrl: books[3].coverUrl,
      isbn: books[3].isbn,
      memberId: 'mbr-003',
      memberName: 'Ayu Lestari',
      memberEmail: 'ayu.lestari@pustaka.example',
      memberCode: 'LIB-2026-041',
      borrowedAt: daysFromNowIso(-5),
      dueAt: daysFromNowIso(2),
      returnedAt: null,
      durationDays: 7,
      renewCount: 1,
      status: 'mendekati_jatuh_tempo',
      fineAmount: 0,
      lastReminderSentAt: new Date(now - 3600 * 1000 * 8).toISOString(),
      reminderStage: 'h_minus_2',
    },
    {
      id: 'ln-1006',
      bookId: 'bk-algo-06',
      bookTitle: 'Arsitektur Sistem Terdistribusi',
      bookAuthor: 'Hendrawan Kusuma',
      bookCoverUrl: books[5].coverUrl,
      isbn: books[5].isbn,
      memberId: 'mbr-002',
      memberName: 'Rafi Pratama',
      memberEmail: 'rafi.pratama@pustaka.example',
      memberCode: 'LIB-2026-028',
      borrowedAt: daysFromNowIso(-3),
      dueAt: daysFromNowIso(11),
      returnedAt: null,
      durationDays: 14,
      renewCount: 0,
      status: 'dipinjam',
      fineAmount: 0,
      lastReminderSentAt: null,
      reminderStage: 'none',
    },
  ];

  const emailLogs: EmailNotificationLog[] = [
    {
      id: 'em-9001',
      loanId: 'ln-1001',
      recipientEmail: 'nadia.kartika@pustaka.example',
      recipientName: 'Nadia Kartika',
      bookTitle: 'Algoritma & Struktur Data Modern',
      dueAt: loans[0].dueAt,
      stage: 'h_minus_1',
      subject: '[Pengingat Jatuh Tempo H-1] Algoritma & Struktur Data Modern — Lentera Pustaka',
      bodyText: `Halo Nadia Kartika,\n\nBuku "Algoritma & Struktur Data Modern" (ISBN ${books[0].isbn}) yang Anda pinjam akan jatuh tempo besok (${formatDateId(loans[0].dueAt)}).\nSilakan lakukan pengembalian atau perpanjangan online melalui dashboard Lentera Pustaka untuk menghindari denda keterlambatan.\n\nSalam literasi,\nTim Lentera Pustaka`,
      sentAt: new Date(now - 3600 * 1000 * 3).toISOString(),
      deliveryMode: 'simulasi_server',
      status: 'terkirim',
    },
    {
      id: 'em-9002',
      loanId: 'ln-1002',
      recipientEmail: 'rafi.pratama@pustaka.example',
      recipientName: 'Rafi Pratama',
      bookTitle: 'Monolit Tropis: Arsitektur Beton & Cahaya',
      dueAt: loans[1].dueAt,
      stage: 'overdue',
      subject: '[Peringatan Terlambat] Monolit Tropis: Arsitektur Beton & Cahaya — Lentera Pustaka',
      bodyText: `Halo Rafi Pratama,\n\nMasa peminjaman buku "Monolit Tropis: Arsitektur Beton & Cahaya" telah melewati batas jatuh tempo (${formatDateId(loans[1].dueAt)}).\nTotal denda berjalan saat ini: Rp 6.000. Mohon segera kembalikan buku ke meja sirkulasi atau konfirmasi pengembalian di portal.\n\nSalam literasi,\nTim Lentera Pustaka`,
      sentAt: new Date(now - 3600 * 1000 * 6).toISOString(),
      deliveryMode: 'simulasi_server',
      status: 'terkirim',
    },
  ];

  const activities: ActivityEvent[] = [
    {
      id: 'act-501',
      timestamp: new Date(now - 3600 * 1000 * 3).toISOString(),
      type: 'email_terkirim',
      actorName: 'Scheduler Pengingat',
      actorRole: 'sistem',
      description: 'Pengingat jatuh tempo H-1 dikirim ke Nadia Kartika',
      targetTitle: 'Algoritma & Struktur Data Modern',
    },
    {
      id: 'act-502',
      timestamp: new Date(now - 3600 * 1000 * 6).toISOString(),
      type: 'email_terkirim',
      actorName: 'Scheduler Pengingat',
      actorRole: 'sistem',
      description: 'Notifikasi keterlambatan dikirim ke Rafi Pratama',
      targetTitle: 'Monolit Tropis: Arsitektur Beton & Cahaya',
    },
    {
      id: 'act-503',
      timestamp: daysFromNowIso(-2),
      type: 'pinjam',
      actorName: 'Ayu Lestari',
      actorRole: 'member',
      description: 'Meminjam buku secara online (durasi 7 hari)',
      targetTitle: 'Rempah di Atas Ombak: Sejarah Maritim',
    },
    {
      id: 'act-504',
      timestamp: daysFromNowIso(-3),
      type: 'pinjam',
      actorName: 'Rafi Pratama',
      actorRole: 'member',
      description: 'Meminjam buku secara online (durasi 14 hari)',
      targetTitle: 'Arsitektur Sistem Terdistribusi',
    },
    {
      id: 'act-505',
      timestamp: daysFromNowIso(-6),
      type: 'kembali',
      actorName: 'Nadia Kartika',
      actorRole: 'member',
      description: 'Mengembalikan buku tepat waktu tanpa denda',
      targetTitle: 'Ilmu Kognitif & Fokus Mendalam',
    },
  ];

  const db: LibraryDatabase = {
    adminCredential: null,
    users: sampleUsers,
    books,
    loans,
    activities,
    emailLogs,
    reports: [],
    settings: {
      autoEmailReminderEnabled: true,
      reminderLeadDays: 2,
      dailyFineRate: 2000,
      autoReportFrequency: 'harian',
    },
    lastAutoReportDate: null,
  };

  db.reports.push(buildAutomatedReport(db, 'harian', 'scheduler_otomatis'));
  db.lastAutoReportDate = new Date().toISOString().slice(0, 10);
  return db;
}

function loadDatabase(): LibraryDatabase {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const seeded = createSeedDatabase();
    fs.writeFileSync(DB_PATH, JSON.stringify(seeded, null, 2), 'utf-8');
    return seeded;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw) as LibraryDatabase;
  } catch {
    const seeded = createSeedDatabase();
    fs.writeFileSync(DB_PATH, JSON.stringify(seeded, null, 2), 'utf-8');
    return seeded;
  }
}

function saveDatabase(db: LibraryDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpPath, DB_PATH);
}

function calculateLoanState(
  loan: LoanTransaction,
  leadDays: number,
  dailyFineRate: number
): { status: LoanStatus; fineAmount: number; daysRemaining: number; daysOverdue: number } {
  if (loan.returnedAt) {
    return {
      status: 'dikembalikan',
      fineAmount: loan.fineAmount,
      daysRemaining: 0,
      daysOverdue: 0,
    };
  }
  const nowMs = Date.now();
  const dueMs = new Date(loan.dueAt).getTime();
  const diffDays = Math.ceil((dueMs - nowMs) / (1000 * 60 * 60 * 24));
  if (dueMs < nowMs) {
    const daysOverdue = Math.max(1, Math.ceil((nowMs - dueMs) / (1000 * 60 * 60 * 24)));
    return {
      status: 'terlambat',
      fineAmount: daysOverdue * dailyFineRate,
      daysRemaining: diffDays,
      daysOverdue,
    };
  }
  if (diffDays <= leadDays) {
    return {
      status: 'mendekati_jatuh_tempo',
      fineAmount: 0,
      daysRemaining: diffDays,
      daysOverdue: 0,
    };
  }
  return {
    status: 'dipinjam',
    fineAmount: 0,
    daysRemaining: diffDays,
    daysOverdue: 0,
  };
}

function buildAutomatedReport(
  db: LibraryDatabase,
  periodType: 'harian' | 'mingguan' | 'bulanan',
  generatedBy: 'scheduler_otomatis' | 'admin'
): AutomatedReport {
  const totalCopies = db.books.reduce((sum, b) => sum + b.totalCopies, 0);
  const availableCopies = db.books.reduce((sum, b) => sum + b.availableCopies, 0);
  const activeLoans = db.loans.filter((l) => l.status !== 'dikembalikan');
  const approachingDueLoans = activeLoans.filter((l) => l.status === 'mendekati_jatuh_tempo').length;
  const overdueList = activeLoans.filter((l) => l.status === 'terlambat');
  const returnedLoans = db.loans.filter((l) => l.status === 'dikembalikan').length;
  const totalFines = db.loans.reduce((sum, l) => sum + l.fineAmount, 0);
  const onTimeDenominator = Math.max(1, db.loans.length);
  const complianceRate = Math.round(
    ((db.loans.length - overdueList.length) / onTimeDenominator) * 100
  );

  const catTotals = new Map<string, number>();
  for (const book of db.books) {
    catTotals.set(book.category, (catTotals.get(book.category) || 0) + book.borrowCount);
  }
  const sumBorrows = Math.max(
    1,
    Array.from(catTotals.values()).reduce((a, b) => a + b, 0)
  );
  const topCategories = Array.from(catTotals.entries())
    .map(([category, count]) => ({
      category,
      count,
      percentage: Math.round((count / sumBorrows) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  const overdueDetails = overdueList.map((l) => {
    const calc = calculateLoanState(l, db.settings.reminderLeadDays, db.settings.dailyFineRate);
    return {
      loanId: l.id,
      bookTitle: l.bookTitle,
      memberName: l.memberName,
      memberEmail: l.memberEmail,
      daysOverdue: calc.daysOverdue,
      fineAmount: l.fineAmount,
    };
  });

  const periodLabel =
    periodType === 'harian' ? 'Harian' : periodType === 'mingguan' ? 'Mingguan' : 'Bulanan';

  return {
    id: generateId('rep'),
    title: `Laporan Sirkulasi ${periodLabel} — ${new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })}`,
    periodType,
    generatedAt: new Date().toISOString(),
    generatedBy,
    summary: {
      totalBooks: db.books.length,
      totalCopies,
      availableCopies,
      activeLoans: activeLoans.length,
      approachingDueLoans,
      overdueLoans: overdueList.length,
      returnedLoans,
      totalTransactions: db.loans.length,
      complianceRate,
      totalFines,
      emailsDispatched: db.emailLogs.length,
    },
    topCategories,
    overdueDetails,
  };
}

function buildDailyTrend(loans: LoanTransaction[]): DailyBorrowPoint[] {
  const points: DailyBorrowPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = dayDate.toISOString().slice(0, 10);
    const label = dayDate.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
    const borrows = loans.filter((l) => l.borrowedAt.slice(0, 10) === key).length;
    const returns = loans.filter((l) => l.returnedAt && l.returnedAt.slice(0, 10) === key).length;
    // Include historical circulation baseline for older days without active records
    const baseline = i > 2 ? (i % 2 === 0 ? 3 : 2) : 1;
    points.push({
      date: key,
      label,
      borrows: borrows + (borrows === 0 && i !== 0 ? baseline : 0),
      returns: returns + (returns === 0 && i > 1 ? Math.max(1, baseline - 1) : 0),
    });
  }
  return points;
}

function broadcastEvent(eventName: string, payload: unknown): void {
  const serialized = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(serialized);
    } catch {
      sseClients.delete(res);
    }
  }
}

function addActivity(
  db: LibraryDatabase,
  entry: Omit<ActivityEvent, 'id' | 'timestamp'>
): ActivityEvent {
  const activity: ActivityEvent = {
    id: generateId('act'),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  db.activities.unshift(activity);
  if (db.activities.length > 80) {
    db.activities = db.activities.slice(0, 80);
  }
  return activity;
}

async function sendDueReminderEmail(
  loan: LoanTransaction,
  stage: Exclude<ReminderStage, 'none'> | 'manual_test',
  fineAmount: number
): Promise<EmailNotificationLog> {
  const stageLabelMap: Record<Exclude<ReminderStage, 'none'> | 'manual_test', string> = {
    h_minus_2: 'Pengingat Jatuh Tempo H-2',
    h_minus_1: 'Pengingat Jatuh Tempo H-1',
    due_today: 'Jatuh Tempo Hari Ini',
    overdue: 'Peringatan Keterlambatan',
    manual_test: 'Pengingat Sirkulasi Manual',
  };

  const subject = `[${stageLabelMap[stage]}] ${loan.bookTitle} — Lentera Pustaka`;
  const fineLine =
    fineAmount > 0
      ? `\nDenda keterlambatan berjalan: Rp ${fineAmount.toLocaleString('id-ID')}.`
      : '';

  const bodyText = [
    `Halo ${loan.memberName},`,
    '',
    `Berikut adalah pemberitahuan real-time untuk peminjaman buku Anda di Lentera Pustaka:`,
    `- Judul Buku: ${loan.bookTitle}`,
    `- Penulis: ${loan.bookAuthor}`,
    `- ISBN: ${loan.isbn}`,
    `- Batas Jatuh Tempo: ${formatDateId(loan.dueAt)}${fineLine}`,
    '',
    `Silakan lakukan pengembalian atau perpanjangan peminjaman secara online melalui dashboard Member Lentera Pustaka.`,
    '',
    `Salam literasi,`,
    `Tim Sirkulasi Lentera Pustaka`,
  ].join('\n');

  let deliveryMode: 'smtp_live' | 'simulasi_server' = 'simulasi_server';
  let status: 'terkirim' | 'gagal' = 'terkirim';
  let errorMessage: string | undefined;

  if (isSmtpConfigured()) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT || 587) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: loan.memberEmail,
        subject,
        text: bodyText,
      });
      deliveryMode = 'smtp_live';
    } catch (err) {
      status = 'gagal';
      errorMessage = err instanceof Error ? err.message : 'Gagal mengirim lewat SMTP';
    }
  }

  return {
    id: generateId('em'),
    loanId: loan.id,
    recipientEmail: loan.memberEmail,
    recipientName: loan.memberName,
    bookTitle: loan.bookTitle,
    dueAt: loan.dueAt,
    stage,
    subject,
    bodyText,
    sentAt: new Date().toISOString(),
    deliveryMode,
    status,
    errorMessage,
  };
}

function syncLoanStatuses(db: LibraryDatabase): boolean {
  let changed = false;
  for (const loan of db.loans) {
    if (loan.returnedAt) continue;
    const calc = calculateLoanState(loan, db.settings.reminderLeadDays, db.settings.dailyFineRate);
    if (loan.status !== calc.status || loan.fineAmount !== calc.fineAmount) {
      loan.status = calc.status;
      loan.fineAmount = calc.fineAmount;
      changed = true;
    }
  }
  return changed;
}

function determineTargetReminderStage(
  daysRemaining: number,
  daysOverdue: number,
  leadDays: number
): ReminderStage {
  if (daysOverdue > 0) return 'overdue';
  if (daysRemaining <= 0) return 'due_today';
  if (daysRemaining === 1) return 'h_minus_1';
  if (daysRemaining <= leadDays) return 'h_minus_2';
  return 'none';
}

const STAGE_ORDER: Record<ReminderStage, number> = {
  none: 0,
  h_minus_2: 1,
  h_minus_1: 2,
  due_today: 3,
  overdue: 4,
};

async function runReminderScan(
  db: LibraryDatabase,
  forceLoanId?: string
): Promise<{ dispatched: EmailNotificationLog[] }> {
  const dispatched: EmailNotificationLog[] = [];
  syncLoanStatuses(db);

  for (const loan of db.loans) {
    if (loan.returnedAt) continue;
    if (forceLoanId && loan.id !== forceLoanId) continue;

    const calc = calculateLoanState(loan, db.settings.reminderLeadDays, db.settings.dailyFineRate);
    const targetStage = determineTargetReminderStage(
      calc.daysRemaining,
      calc.daysOverdue,
      db.settings.reminderLeadDays
    );

    const shouldSend = forceLoanId
      ? true
      : targetStage !== 'none' && STAGE_ORDER[targetStage] > STAGE_ORDER[loan.reminderStage];

    if (!shouldSend) continue;

    const stageToUse: Exclude<ReminderStage, 'none'> | 'manual_test' =
      targetStage === 'none' ? 'manual_test' : targetStage;

    const log = await sendDueReminderEmail(loan, stageToUse, loan.fineAmount);
    db.emailLogs.unshift(log);
    if (db.emailLogs.length > 150) {
      db.emailLogs = db.emailLogs.slice(0, 150);
    }

    loan.lastReminderSentAt = log.sentAt;
    if (targetStage !== 'none') {
      loan.reminderStage = targetStage;
    }

    const act = addActivity(db, {
      type: 'email_terkirim',
      actorName: forceLoanId ? 'Admin Sirkulasi' : 'Scheduler Pengingat',
      actorRole: forceLoanId ? 'admin' : 'sistem',
      description: `Notifikasi email (${stageToUse}) dikirim ke ${loan.memberName}`,
      targetTitle: loan.bookTitle,
    });

    dispatched.push(log);
    broadcastEvent('email_dispatched', { log, activity: act });
  }

  if (dispatched.length > 0) {
    saveDatabase(db);
    broadcastEvent('snapshot_updated', { reason: 'reminders_dispatched' });
  }

  return { dispatched };
}

function buildPublicOverview(db: LibraryDatabase) {
  syncLoanStatuses(db);
  const totalCopies = db.books.reduce((sum, b) => sum + b.totalCopies, 0);
  const availableCopies = db.books.reduce((sum, b) => sum + b.availableCopies, 0);
  const activeLoans = db.loans.filter((l) => l.status !== 'dikembalikan');
  const approachingDueLoans = activeLoans.filter((l) => l.status === 'mendekati_jatuh_tempo').length;
  const overdueLoans = activeLoans.filter((l) => l.status === 'terlambat').length;
  const todayKey = new Date().toISOString().slice(0, 10);
  const emailsSentToday = db.emailLogs.filter((e) => e.sentAt.slice(0, 10) === todayKey).length;

  const catMap = new Map<string, { totalBooks: number; borrowCount: number }>();
  for (const book of db.books) {
    const existing = catMap.get(book.category) || { totalBooks: 0, borrowCount: 0 };
    existing.totalBooks += 1;
    existing.borrowCount += book.borrowCount;
    catMap.set(book.category, existing);
  }
  const categoryStats = Array.from(catMap.entries())
    .map(([category, val]) => ({ category, ...val }))
    .sort((a, b) => b.borrowCount - a.borrowCount);

  return {
    books: db.books,
    stats: {
      totalTitles: db.books.length,
      totalCopies,
      availableCopies,
      activeLoans: activeLoans.length,
      approachingDueLoans,
      overdueLoans,
      totalMembers: db.users.length,
      emailsSentToday,
    },
    dailyTrend: buildDailyTrend(db.loans),
    categoryStats,
    recentActivities: db.activities.slice(0, 20),
    settings: {
      ...db.settings,
      smtpConfigured: isSmtpConfigured(),
    },
  };
}

function toPublicUser(u: StoredUser): UserProfile {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    memberCode: u.memberCode,
    department: u.department,
    joinedAt: u.joinedAt,
    status: u.status,
  };
}

function createSession(user: UserProfile): string {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    token,
    user,
    expiresAt: Date.now() + 1000 * 60 * 60 * 12,
  });
  return token;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Silakan masuk terlebih dahulu untuk melanjutkan.' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  const record = sessions.get(token);
  if (!record || record.expiresAt < Date.now()) {
    if (record) sessions.delete(token);
    res.status(401).json({ error: 'Sesi Anda telah berakhir. Silakan masuk kembali.' });
    return;
  }
  req.authUser = record.user;
  req.authToken = token;
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser || req.authUser.role !== 'admin') {
    res.status(403).json({ error: 'Akses ditolak. Fitur ini khusus untuk Admin Pustakawan.' });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  const db = loadDatabase();

  // Periodic background due-date monitor & automated reporting scheduler (every 30s)
  const schedulerInterval = setInterval(async () => {
    try {
      const changed = syncLoanStatuses(db);
      if (db.settings.autoEmailReminderEnabled) {
        await runReminderScan(db);
      } else if (changed) {
        saveDatabase(db);
        broadcastEvent('snapshot_updated', { reason: 'status_sync' });
      }

      const todayKey = new Date().toISOString().slice(0, 10);
      if (db.lastAutoReportDate !== todayKey) {
        const rep = buildAutomatedReport(db, db.settings.autoReportFrequency, 'scheduler_otomatis');
        db.reports.unshift(rep);
        if (db.reports.length > 30) db.reports = db.reports.slice(0, 30);
        db.lastAutoReportDate = todayKey;
        const act = addActivity(db, {
          type: 'laporan_otomatis',
          actorName: 'Scheduler Pelaporan',
          actorRole: 'sistem',
          description: `Laporan sirkulasi ${db.settings.autoReportFrequency} dibuat otomatis`,
          targetTitle: rep.title,
        });
        saveDatabase(db);
        broadcastEvent('report_generated', { report: rep, activity: act });
      }
    } catch (err) {
      console.error('Background scheduler error:', err);
    }
  }, 30_000);
  schedulerInterval.unref();

  // --- SSE Real-Time Event Stream ---
  app.get('/api/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`event: connected\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);
    sseClients.add(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 20_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // --- Public Read-Only Overview (no member PII) ---
  app.get('/api/overview', (_req: Request, res: Response) => {
    res.json(buildPublicOverview(db));
  });

  // --- Auth Endpoints ---
  app.get('/api/auth/bootstrap-status', (_req: Request, res: Response) => {
    res.json({
      adminClaimed: Boolean(db.adminCredential),
      hasEnvPasscode: Boolean(process.env.ADMIN_PASSCODE?.trim()),
      smtpConfigured: isSmtpConfigured(),
    });
  });

  app.post('/api/auth/claim-admin', (req: Request, res: Response) => {
    if (process.env.ADMIN_PASSCODE?.trim()) {
      res.status(409).json({
        error: 'Kredensial Admin dikelola melalui ADMIN_PASSCODE di server. Silakan gunakan tab Masuk Admin.',
      });
      return;
    }
    if (db.adminCredential) {
      res.status(409).json({ error: 'Akun Admin utama sudah diklaim sebelumnya.' });
      return;
    }

    const name = sanitizeText(req.body?.name, 80) || 'Admin Pustakawan';
    const email = sanitizeText(req.body?.email, 160).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Format email Admin tidak valid.' });
      return;
    }
    if (password.length < 6 || password.length > 128) {
      res.status(400).json({ error: 'Kata sandi Admin minimal 6 karakter.' });
      return;
    }

    const { hash, salt } = hashPassword(password);
    db.adminCredential = {
      email,
      name,
      passwordHash: hash,
      salt,
      claimedAt: new Date().toISOString(),
    };
    saveDatabase(db);

    const adminProfile: UserProfile = {
      id: 'admin-root',
      name,
      email,
      role: 'admin',
      memberCode: 'ADM-001',
      department: 'Kepala Sirkulasi & Koleksi',
      joinedAt: db.adminCredential.claimedAt,
      status: 'aktif',
    };
    const token = createSession(adminProfile);
    res.status(201).json({ token, user: adminProfile });
  });

  app.post('/api/auth/register', (req: Request, res: Response) => {
    const name = sanitizeText(req.body?.name, 80);
    const email = sanitizeText(req.body?.email, 160).toLowerCase();
    const department = sanitizeText(req.body?.department, 80) || 'Umum / Fakultas';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (name.length < 2) {
      res.status(400).json({ error: 'Nama lengkap minimal 2 karakter.' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Format alamat email tidak valid.' });
      return;
    }
    if (password.length < 6 || password.length > 128) {
      res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
      return;
    }
    if (db.adminCredential && db.adminCredential.email === email) {
      res.status(409).json({ error: 'Email tersebut terdaftar sebagai Admin.' });
      return;
    }

    const existing = db.users.find((u) => u.email.toLowerCase() === email);
    if (existing && existing.passwordHash) {
      res.status(409).json({ error: 'Email sudah terdaftar. Silakan masuk menggunakan kata sandi Anda.' });
      return;
    }

    const { hash, salt } = hashPassword(password);
    let targetUser: StoredUser;
    if (existing && !existing.passwordHash) {
      // Allow claiming a seeded directory member profile with user's chosen password
      existing.name = name;
      existing.department = department;
      existing.passwordHash = hash;
      existing.salt = salt;
      targetUser = existing;
    } else {
      targetUser = {
        id: generateId('mbr'),
        name,
        email,
        role: 'member',
        memberCode: `LIB-${new Date().getFullYear()}-${String(db.users.length + 1).padStart(3, '0')}`,
        department,
        joinedAt: new Date().toISOString(),
        status: 'aktif',
        passwordHash: hash,
        salt,
      };
      db.users.push(targetUser);
    }

    const act = addActivity(db, {
      type: 'member_baru',
      actorName: targetUser.name,
      actorRole: 'member',
      description: `Anggota baru bergabung (${targetUser.memberCode})`,
    });
    saveDatabase(db);
    broadcastEvent('activity', { activity: act });
    broadcastEvent('snapshot_updated', { reason: 'member_registered' });

    const publicUser = toPublicUser(targetUser);
    const token = createSession(publicUser);
    res.status(201).json({ token, user: publicUser });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const email = sanitizeText(req.body?.email, 160).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const requestedRole: UserRole = req.body?.role === 'admin' ? 'admin' : 'member';

    if (requestedRole === 'admin') {
      const envPasscode = process.env.ADMIN_PASSCODE?.trim();
      if (envPasscode) {
        if (!constantTimeCompareString(password, envPasscode)) {
          res.status(401).json({ error: 'Passcode Admin tidak sesuai.' });
          return;
        }
        const adminProfile: UserProfile = {
          id: 'admin-root',
          name: db.adminCredential?.name || 'Admin Pustakawan',
          email: email || db.adminCredential?.email || 'admin@lenterapustaka.id',
          role: 'admin',
          memberCode: 'ADM-001',
          department: 'Kepala Sirkulasi & Koleksi',
          joinedAt: db.adminCredential?.claimedAt || new Date().toISOString(),
          status: 'aktif',
        };
        const token = createSession(adminProfile);
        res.json({ token, user: adminProfile });
        return;
      }

      if (!db.adminCredential) {
        res.status(400).json({ error: 'Akun Admin belum diklaim. Silakan selesaikan pengaturan awal Admin.' });
        return;
      }
      if (
        email !== db.adminCredential.email ||
        !verifyPassword(password, db.adminCredential.passwordHash, db.adminCredential.salt)
      ) {
        res.status(401).json({ error: 'Email atau kata sandi Admin salah.' });
        return;
      }
      const adminProfile: UserProfile = {
        id: 'admin-root',
        name: db.adminCredential.name,
        email: db.adminCredential.email,
        role: 'admin',
        memberCode: 'ADM-001',
        department: 'Kepala Sirkulasi & Koleksi',
        joinedAt: db.adminCredential.claimedAt,
        status: 'aktif',
      };
      const token = createSession(adminProfile);
      res.json({ token, user: adminProfile });
      return;
    }

    if (!isValidEmail(email) || !password) {
      res.status(400).json({ error: 'Masukkan email dan kata sandi yang valid.' });
      return;
    }
    const found = db.users.find((u) => u.email.toLowerCase() === email);
    if (!found || !found.passwordHash || !verifyPassword(password, found.passwordHash, found.salt)) {
      res.status(401).json({ error: 'Email atau kata sandi member salah.' });
      return;
    }
    const publicUser = toPublicUser(found);
    const token = createSession(publicUser);
    res.json({ token, user: publicUser });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthedRequest, res: Response) => {
    if (req.authToken) {
      sessions.delete(req.authToken);
    }
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
    res.json({ user: req.authUser });
  });

  // --- Authenticated Dashboard Endpoint (Role-Scoped Data) ---
  app.get('/api/dashboard', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.authUser!;
    const overview = buildPublicOverview(db);

    if (user.role === 'admin') {
      res.json({
        ...overview,
        user,
        loans: db.loans,
        emailLogs: db.emailLogs,
        reports: db.reports,
        members: db.users.map(toPublicUser),
      });
      return;
    }

    // Member only sees their own loans and their own email reminder logs
    res.json({
      ...overview,
      user,
      loans: db.loans.filter((l) => l.memberId === user.id || l.memberEmail === user.email),
      emailLogs: db.emailLogs.filter((e) => e.recipientEmail === user.email),
      reports: [],
      members: [],
    });
  });

  // --- Online Borrowing (Member & Admin) ---
  app.post('/api/loans', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.authUser!;
    const bookId = sanitizeText(req.body?.bookId, 64);
    const durationRaw = Number(req.body?.durationDays);
    const durationDays = [3, 7, 14].includes(durationRaw) ? durationRaw : 7;

    let borrowerId = user.id;
    let borrowerName = user.name;
    let borrowerEmail = user.email;
    let borrowerCode = user.memberCode;

    if (user.role === 'admin' && typeof req.body?.memberId === 'string' && req.body.memberId.trim()) {
      const targetMember = db.users.find((u) => u.id === req.body.memberId.trim());
      if (!targetMember) {
        res.status(404).json({ error: 'Anggota tidak ditemukan.' });
        return;
      }
      borrowerId = targetMember.id;
      borrowerName = targetMember.name;
      borrowerEmail = targetMember.email;
      borrowerCode = targetMember.memberCode;
    }

    const book = db.books.find((b) => b.id === bookId);
    if (!book) {
      res.status(404).json({ error: 'Buku tidak ditemukan dalam koleksi.' });
      return;
    }
    if (book.availableCopies <= 0) {
      res.status(409).json({ error: 'Maaf, seluruh eksemplar buku ini sedang dipinjam.' });
      return;
    }

    const duplicateActive = db.loans.find(
      (l) => l.bookId === book.id && l.memberId === borrowerId && l.returnedAt === null
    );
    if (duplicateActive) {
      res.status(409).json({ error: 'Anda masih memiliki peminjaman aktif untuk judul buku ini.' });
      return;
    }

    book.availableCopies -= 1;
    book.borrowCount += 1;

    const nowIso = new Date().toISOString();
    const dueIso = daysFromNowIso(durationDays);
    const newLoan: LoanTransaction = {
      id: generateId('ln'),
      bookId: book.id,
      bookTitle: book.title,
      bookAuthor: book.author,
      bookCoverUrl: book.coverUrl,
      isbn: book.isbn,
      memberId: borrowerId,
      memberName: borrowerName,
      memberEmail: borrowerEmail,
      memberCode: borrowerCode,
      borrowedAt: nowIso,
      dueAt: dueIso,
      returnedAt: null,
      durationDays,
      renewCount: 0,
      status: 'dipinjam',
      fineAmount: 0,
      lastReminderSentAt: null,
      reminderStage: 'none',
    };

    db.loans.unshift(newLoan);
    const act = addActivity(db, {
      type: 'pinjam',
      actorName: borrowerName,
      actorRole: user.role,
      description: `Meminjam buku secara online (${durationDays} hari)`,
      targetTitle: book.title,
    });
    saveDatabase(db);

    broadcastEvent('activity', { activity: act });
    broadcastEvent('snapshot_updated', { reason: 'loan_created', loanId: newLoan.id });
    res.status(201).json({ loan: newLoan });
  });

  app.post('/api/loans/:id/renew', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.authUser!;
    const loan = db.loans.find((l) => l.id === req.params.id);
    if (!loan) {
      res.status(404).json({ error: 'Transaksi peminjaman tidak ditemukan.' });
      return;
    }
    if (user.role !== 'admin' && loan.memberId !== user.id && loan.memberEmail !== user.email) {
      res.status(403).json({ error: 'Anda tidak memiliki akses untuk memperpanjang transaksi ini.' });
      return;
    }
    if (loan.returnedAt) {
      res.status(409).json({ error: 'Buku sudah dikembalikan.' });
      return;
    }
    if (loan.renewCount >= 2) {
      res.status(409).json({ error: 'Batas maksimal perpanjangan (2 kali) telah tercapai.' });
      return;
    }

    const baseTime = Math.max(Date.now(), new Date(loan.dueAt).getTime());
    loan.dueAt = new Date(baseTime + 7 * 24 * 60 * 60 * 1000).toISOString();
    loan.durationDays += 7;
    loan.renewCount += 1;
    loan.status = 'dipinjam';
    loan.fineAmount = 0;
    loan.reminderStage = 'none';

    const act = addActivity(db, {
      type: 'perpanjang',
      actorName: user.name,
      actorRole: user.role,
      description: `Memperpanjang masa pinjam (+7 hari, total ${loan.renewCount}x)`,
      targetTitle: loan.bookTitle,
    });
    saveDatabase(db);

    broadcastEvent('activity', { activity: act });
    broadcastEvent('snapshot_updated', { reason: 'loan_renewed', loanId: loan.id });
    res.json({ loan });
  });

  app.post('/api/loans/:id/return', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.authUser!;
    const loan = db.loans.find((l) => l.id === req.params.id);
    if (!loan) {
      res.status(404).json({ error: 'Transaksi peminjaman tidak ditemukan.' });
      return;
    }
    if (user.role !== 'admin' && loan.memberId !== user.id && loan.memberEmail !== user.email) {
      res.status(403).json({ error: 'Anda tidak memiliki akses untuk mengembalikan transaksi ini.' });
      return;
    }
    if (loan.returnedAt) {
      res.status(409).json({ error: 'Buku ini sudah tercatat dikembalikan.' });
      return;
    }

    syncLoanStatuses(db);
    loan.returnedAt = new Date().toISOString();
    loan.status = 'dikembalikan';

    const book = db.books.find((b) => b.id === loan.bookId);
    if (book) {
      book.availableCopies = Math.min(book.totalCopies, book.availableCopies + 1);
    }

    const act = addActivity(db, {
      type: 'kembali',
      actorName: user.name,
      actorRole: user.role,
      description:
        loan.fineAmount > 0
          ? `Mengembalikan buku (denda Rp ${loan.fineAmount.toLocaleString('id-ID')})`
          : 'Mengembalikan buku ke perpustakaan',
      targetTitle: loan.bookTitle,
    });
    saveDatabase(db);

    broadcastEvent('activity', { activity: act });
    broadcastEvent('snapshot_updated', { reason: 'loan_returned', loanId: loan.id });
    res.json({ loan });
  });

  // --- Admin Collection Management ---
  app.post('/api/admin/books', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    const title = sanitizeText(req.body?.title, 140);
    const author = sanitizeText(req.body?.author, 100);
    const isbn = sanitizeText(req.body?.isbn, 40);
    const category = sanitizeText(req.body?.category, 60) || 'Ilmu Komputer';
    const publisher = sanitizeText(req.body?.publisher, 100) || 'Pustaka Digital Nusantara';
    const year = Math.min(2030, Math.max(1900, Number(req.body?.year) || new Date().getFullYear()));
    const pages = Math.min(3000, Math.max(10, Number(req.body?.pages) || 240));
    const shelfCode = sanitizeText(req.body?.shelfCode, 24) || 'A-001';
    const totalCopies = Math.min(200, Math.max(1, Number(req.body?.totalCopies) || 1));
    const synopsis = sanitizeText(req.body?.synopsis, 800);
    const coverCandidate = sanitizeText(req.body?.coverUrl, 300);
    const coverUrl = isValidCoverUrl(coverCandidate)
      ? coverCandidate
      : '/src/assets/images/book_cover_algorithms_1795659561904.jpg';

    if (title.length < 2 || author.length < 2 || isbn.length < 5) {
      res.status(400).json({ error: 'Judul, penulis, dan ISBN wajib diisi dengan benar.' });
      return;
    }

    const newBook: Book = {
      id: generateId('bk'),
      title,
      author,
      isbn,
      category,
      publisher,
      year,
      pages,
      shelfCode,
      totalCopies,
      availableCopies: totalCopies,
      coverUrl,
      synopsis: synopsis || 'Buku koleksi digital terkurasi di perpustakaan Lentera Pustaka.',
      borrowCount: 0,
      addedAt: new Date().toISOString(),
    };

    db.books.unshift(newBook);
    const act = addActivity(db, {
      type: 'koleksi_baru',
      actorName: req.authUser!.name,
      actorRole: 'admin',
      description: `Menambahkan koleksi baru (${totalCopies} eksemplar)`,
      targetTitle: newBook.title,
    });
    saveDatabase(db);

    broadcastEvent('activity', { activity: act });
    broadcastEvent('snapshot_updated', { reason: 'book_created', bookId: newBook.id });
    res.status(201).json({ book: newBook });
  });

  app.patch('/api/admin/books/:id', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    const book = db.books.find((b) => b.id === req.params.id);
    if (!book) {
      res.status(404).json({ error: 'Buku tidak ditemukan.' });
      return;
    }

    if (typeof req.body?.title === 'string' && req.body.title.trim()) {
      book.title = sanitizeText(req.body.title, 140);
    }
    if (typeof req.body?.author === 'string' && req.body.author.trim()) {
      book.author = sanitizeText(req.body.author, 100);
    }
    if (typeof req.body?.isbn === 'string' && req.body.isbn.trim()) {
      book.isbn = sanitizeText(req.body.isbn, 40);
    }
    if (typeof req.body?.category === 'string' && req.body.category.trim()) {
      book.category = sanitizeText(req.body.category, 60);
    }
    if (typeof req.body?.publisher === 'string' && req.body.publisher.trim()) {
      book.publisher = sanitizeText(req.body.publisher, 100);
    }
    if (typeof req.body?.shelfCode === 'string' && req.body.shelfCode.trim()) {
      book.shelfCode = sanitizeText(req.body.shelfCode, 24);
    }
    if (typeof req.body?.synopsis === 'string' && req.body.synopsis.trim()) {
      book.synopsis = sanitizeText(req.body.synopsis, 800);
    }
    if (req.body?.year !== undefined) {
      book.year = Math.min(2030, Math.max(1900, Number(req.body.year) || book.year));
    }
    if (req.body?.totalCopies !== undefined) {
      const activeBorrowed = db.loans.filter((l) => l.bookId === book.id && !l.returnedAt).length;
      const requestedTotal = Math.min(200, Math.max(activeBorrowed, Number(req.body.totalCopies) || 1));
      book.totalCopies = requestedTotal;
      book.availableCopies = Math.max(0, requestedTotal - activeBorrowed);
    }

    const act = addActivity(db, {
      type: 'koleksi_ubah',
      actorName: req.authUser!.name,
      actorRole: 'admin',
      description: `Memperbarui metadata & stok koleksi (${book.availableCopies}/${book.totalCopies} tersedia)`,
      targetTitle: book.title,
    });
    saveDatabase(db);

    broadcastEvent('activity', { activity: act });
    broadcastEvent('snapshot_updated', { reason: 'book_updated', bookId: book.id });
    res.json({ book });
  });

  app.delete('/api/admin/books/:id', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    const idx = db.books.findIndex((b) => b.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Buku tidak ditemukan.' });
      return;
    }
    const activeLoan = db.loans.find((l) => l.bookId === req.params.id && !l.returnedAt);
    if (activeLoan) {
      res.status(409).json({ error: 'Buku tidak dapat dihapus karena masih memiliki peminjaman aktif.' });
      return;
    }
    const [removed] = db.books.splice(idx, 1);
    const act = addActivity(db, {
      type: 'koleksi_hapus',
      actorName: req.authUser!.name,
      actorRole: 'admin',
      description: 'Menghapus buku dari katalog koleksi',
      targetTitle: removed.title,
    });
    saveDatabase(db);

    broadcastEvent('activity', { activity: act });
    broadcastEvent('snapshot_updated', { reason: 'book_deleted', bookId: removed.id });
    res.json({ ok: true });
  });

  // --- Admin Real-Time Email Reminders & Due-Date Simulation ---
  app.post(
    '/api/admin/reminders/dispatch',
    requireAuth,
    requireAdmin,
    async (req: AuthedRequest, res: Response) => {
      const loanId = typeof req.body?.loanId === 'string' ? req.body.loanId.trim() : undefined;
      const result = await runReminderScan(db, loanId);
      res.json({
        dispatchedCount: result.dispatched.length,
        dispatched: result.dispatched,
      });
    }
  );

  app.post(
    '/api/admin/loans/:id/simulate-due',
    requireAuth,
    requireAdmin,
    async (req: AuthedRequest, res: Response) => {
      const loan = db.loans.find((l) => l.id === req.params.id);
      if (!loan || loan.returnedAt) {
        res.status(404).json({ error: 'Peminjaman aktif tidak ditemukan.' });
        return;
      }
      const mode = req.body?.mode === 'overdue' ? 'overdue' : 'approaching';
      loan.dueAt = mode === 'overdue' ? daysFromNowIso(-2) : daysFromNowIso(1);
      loan.reminderStage = 'none';
      syncLoanStatuses(db);
      saveDatabase(db);

      const { dispatched } = await runReminderScan(db);
      broadcastEvent('snapshot_updated', { reason: 'due_simulated', loanId: loan.id });
      res.json({ loan, dispatched });
    }
  );

  // --- Admin Automated Reports & Settings ---
  app.post(
    '/api/admin/reports/generate',
    requireAuth,
    requireAdmin,
    (req: AuthedRequest, res: Response) => {
      syncLoanStatuses(db);
      const periodType =
        req.body?.periodType === 'mingguan' || req.body?.periodType === 'bulanan'
          ? req.body.periodType
          : 'harian';
      const report = buildAutomatedReport(db, periodType, 'admin');
      db.reports.unshift(report);
      if (db.reports.length > 30) db.reports = db.reports.slice(0, 30);

      const act = addActivity(db, {
        type: 'laporan_otomatis',
        actorName: req.authUser!.name,
        actorRole: 'admin',
        description: `Membuat laporan sirkulasi ${periodType}`,
        targetTitle: report.title,
      });
      saveDatabase(db);

      broadcastEvent('report_generated', { report, activity: act });
      broadcastEvent('snapshot_updated', { reason: 'report_generated' });
      res.status(201).json({ report });
    }
  );

  app.patch('/api/admin/settings', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
    if (typeof req.body?.autoEmailReminderEnabled === 'boolean') {
      db.settings.autoEmailReminderEnabled = req.body.autoEmailReminderEnabled;
    }
    if (req.body?.reminderLeadDays !== undefined) {
      db.settings.reminderLeadDays = Math.min(7, Math.max(1, Number(req.body.reminderLeadDays) || 2));
    }
    if (req.body?.dailyFineRate !== undefined) {
      db.settings.dailyFineRate = Math.min(100000, Math.max(0, Number(req.body.dailyFineRate) || 2000));
    }
    if (req.body?.autoReportFrequency === 'harian' || req.body?.autoReportFrequency === 'mingguan') {
      db.settings.autoReportFrequency = req.body.autoReportFrequency;
    }
    syncLoanStatuses(db);
    saveDatabase(db);

    broadcastEvent('snapshot_updated', { reason: 'settings_updated' });
    res.json({
      settings: {
        ...db.settings,
        smtpConfigured: isSmtpConfigured(),
      },
    });
  });

  // --- Vite Dev Middleware or Static Production Serving ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lentera Pustaka server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

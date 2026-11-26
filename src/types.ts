export type UserRole = 'admin' | 'member';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  memberCode: string;
  department: string;
  joinedAt: string;
  status: 'aktif' | 'ditangguhkan';
}

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  publisher: string;
  year: number;
  pages: number;
  shelfCode: string;
  totalCopies: number;
  availableCopies: number;
  coverUrl: string;
  synopsis: string;
  borrowCount: number;
  addedAt: string;
}

export type LoanStatus = 'dipinjam' | 'mendekati_jatuh_tempo' | 'terlambat' | 'dikembalikan';

export type ReminderStage = 'none' | 'h_minus_2' | 'h_minus_1' | 'due_today' | 'overdue';

export interface LoanTransaction {
  id: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  bookCoverUrl: string;
  isbn: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  memberCode: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  durationDays: number;
  renewCount: number;
  status: LoanStatus;
  fineAmount: number;
  lastReminderSentAt: string | null;
  reminderStage: ReminderStage;
}

export type ActivityType =
  | 'pinjam'
  | 'kembali'
  | 'perpanjang'
  | 'koleksi_baru'
  | 'koleksi_ubah'
  | 'koleksi_hapus'
  | 'email_terkirim'
  | 'laporan_otomatis'
  | 'member_baru';

export interface ActivityEvent {
  id: string;
  timestamp: string;
  type: ActivityType;
  actorName: string;
  actorRole: UserRole | 'sistem';
  description: string;
  targetTitle?: string;
}

export interface EmailNotificationLog {
  id: string;
  loanId: string;
  recipientEmail: string;
  recipientName: string;
  bookTitle: string;
  dueAt: string;
  stage: Exclude<ReminderStage, 'none'> | 'manual_test';
  subject: string;
  bodyText: string;
  sentAt: string;
  deliveryMode: 'smtp_live' | 'simulasi_server';
  status: 'terkirim' | 'gagal';
  errorMessage?: string;
}

export interface AutomatedReport {
  id: string;
  title: string;
  periodType: 'harian' | 'mingguan' | 'bulanan';
  generatedAt: string;
  generatedBy: 'scheduler_otomatis' | 'admin';
  summary: {
    totalBooks: number;
    totalCopies: number;
    availableCopies: number;
    activeLoans: number;
    approachingDueLoans: number;
    overdueLoans: number;
    returnedLoans: number;
    totalTransactions: number;
    complianceRate: number;
    totalFines: number;
    emailsDispatched: number;
  };
  topCategories: { category: string; count: number; percentage: number }[];
  overdueDetails: {
    loanId: string;
    bookTitle: string;
    memberName: string;
    memberEmail: string;
    daysOverdue: number;
    fineAmount: number;
  }[];
}

export interface LibrarySettings {
  autoEmailReminderEnabled: boolean;
  reminderLeadDays: number;
  dailyFineRate: number;
  autoReportFrequency: 'harian' | 'mingguan';
  smtpConfigured: boolean;
}

export interface DailyBorrowPoint {
  date: string;
  label: string;
  borrows: number;
  returns: number;
}

export interface PublicOverviewResponse {
  books: Book[];
  stats: {
    totalTitles: number;
    totalCopies: number;
    availableCopies: number;
    activeLoans: number;
    approachingDueLoans: number;
    overdueLoans: number;
    totalMembers: number;
    emailsSentToday: number;
  };
  dailyTrend: DailyBorrowPoint[];
  categoryStats: { category: string; totalBooks: number; borrowCount: number }[];
  recentActivities: ActivityEvent[];
  settings: LibrarySettings;
}

export interface DashboardResponse extends PublicOverviewResponse {
  user: UserProfile;
  loans: LoanTransaction[];
  emailLogs: EmailNotificationLog[];
  reports: AutomatedReport[];
  members: UserProfile[];
}

export interface AuthBootstrapStatus {
  adminClaimed: boolean;
  hasEnvPasscode: boolean;
  smtpConfigured: boolean;
}

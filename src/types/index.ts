// Types for SIPAS BTI (Sistem Pengarsipan Surat SMP Bhinneka Tunggal Ika)

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER';

export type LetterType = 'INCOMING' | 'OUTGOING';

export type LetterStatus =
  | 'DRAFT'
  | 'AI_PROCESSING'
  | 'NEED_REVIEW'
  | 'VERIFIED'
  | 'ARCHIVED'
  | 'TRASH';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Letter {
  id: string;
  letter_type: LetterType;
  agenda_number: string | null;
  letter_number: string;
  letter_date: string;
  received_date: string | null;
  sender: string;
  recipient: string;
  subject: string;
  letter_nature: string | null; // e.g. Biasa, Penting, Rahasia
  attachment: string | null;
  signatory_name: string | null;
  signatory_position: string | null;
  summary: string | null;
  category_id: string | null;
  activity_date: string | null;
  activity_location: string | null;
  notes: string | null;
  status: LetterStatus;
  created_by: string | null;
  verified_by: string | null;
  created_at: string;
  updated_at: string;
  verified_at: string | null;
  deleted_at: string | null;
  // Joined relation fields
  category?: LetterCategory | null;
  files?: LetterFile[];
  creator?: Profile | null;
  verifier?: Profile | null;
}

export interface LetterFile {
  id: string;
  letter_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  storage_bucket: string;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface LetterAiResult {
  id: string;
  letter_id: string;
  model_name: string;
  prompt_version: string;
  raw_response: string | null;
  structured_response: Record<string, unknown> | null;
  processing_time: number | null;
  created_at: string;
}

export interface LetterCategory {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LetterTag {
  id: string;
  letter_id: string;
  name: string;
  created_at: string;
}

export interface LetterLog {
  id: string;
  letter_id: string | null;
  user_id: string | null;
  action: string;
  description: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  // Joined profile
  user?: Profile | null;
}

export interface SystemSettings {
  id: string;
  school_name: string | null;
  school_address: string | null;
  school_phone: string | null;
  school_email: string | null;
  school_website: string | null;
  school_logo: string | null;
  head_of_tu_name: string | null;
  head_of_tu_position: string | null;
  created_at: string;
  updated_at: string;
}

export interface LetterAIExtraction {
  jenis_surat: 'INCOMING' | 'OUTGOING' | null;
  nomor_surat: string | null;
  tanggal_surat: string | null;
  tanggal_diterima: string | null;
  asal_surat: string | null;
  tujuan_surat: string | null;
  perihal: string | null;
  sifat_surat: string | null;
  lampiran: string | null;
  penandatangan: string | null;
  jabatan_penandatangan: string | null;
  ringkasan: string | null;
  kata_kunci: string[];
  klasifikasi: string | null;
  tanggal_kegiatan: string | null;
  tempat_kegiatan: string | null;
}

export interface LetterAIResult {
  id: string;
  letter_id: string;
  model_name: string;
  prompt_version: string;
  raw_response: string | null;
  structured_response: LetterAIExtraction | null;
  processing_time: number | null;
  created_at: string;
}

export interface DashboardStats {
  total_incoming: number;
  total_outgoing: number;
  total_this_month: number;
  need_review: number;
}

export interface ReportArchive {
  id: string;
  report_type: 'JURNAL_SURAT_MASUK' | 'JURNAL_SURAT_KELUAR' | 'REKAP_TAHUNAN';
  title: string;
  period_start: string;
  period_end: string;
  file_name: string;
  file_path: string;
  file_size: number;
  storage_bucket: string;
  total_records: number;
  created_by: string | null;
  created_at: string;
  creator?: Profile | null;
}

export interface JournalFilterParams {
  letter_type: LetterType;
  period_start?: string;
  period_end?: string;
  year?: number;
  category_id?: string;
  nature?: string;
}

export interface JournalColumnConfig {
  no: boolean;
  agenda_number: boolean;
  received_date?: boolean; // For INCOMING
  letter_date: boolean;
  letter_number: boolean;
  sender_or_recipient: boolean; // Asal Surat (IN) or Tujuan Surat (OUT)
  subject: boolean;
  attachment: boolean;
  notes: boolean;
}

export interface CategoryStat {
  category_id: string;
  category_name: string;
  count: number;
}

export interface NatureStat {
  nature: string;
  count: number;
}

export interface MonthlyTrend {
  month: number;
  month_name: string;
  incoming: number;
  outgoing: number;
}

export interface ComprehensiveReportStats {
  total_incoming: number;
  total_outgoing: number;
  total_all: number;
  total_this_year: number;
  total_this_month: number;
  total_verified: number;
  total_need_review: number;
  total_draft: number;
  total_archived: number;
  categories_breakdown: CategoryStat[];
  natures_breakdown: NatureStat[];
  monthly_trends: MonthlyTrend[];
}

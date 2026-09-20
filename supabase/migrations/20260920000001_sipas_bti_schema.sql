-- ==============================================================================
-- SIPAS BTI - Sistem Pengarsipan Surat SMP Bhinneka Tunggal Ika
-- Tahap 1: Skema Database, Keamanan RLS, & Konfigurasi Supabase
-- ==============================================================================
-- CATATAN: Skema ini tidak memuat data dummy / data contoh apapun.
-- Database production dimulai dalam kondisi 100% kosong.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CUSTOM TYPES
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'VIEWER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE letter_type AS ENUM ('INCOMING', 'OUTGOING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE letter_status AS ENUM (
        'DRAFT',
        'AI_PROCESSING',
        'NEED_REVIEW',
        'VERIFIED',
        'ARCHIVED',
        'TRASH'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. PROFILES TABLE (relasi dengan auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'VIEWER',
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. MASTER KATEGORI (letter_categories)
CREATE TABLE IF NOT EXISTS public.letter_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. LETTERS TABLE (surat masuk dan keluar)
CREATE TABLE IF NOT EXISTS public.letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    letter_type letter_type NOT NULL,
    agenda_number TEXT,
    letter_number TEXT NOT NULL,
    letter_date DATE NOT NULL,
    received_date DATE,
    sender TEXT NOT NULL,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    letter_nature TEXT,
    attachment TEXT,
    signatory_name TEXT,
    signatory_position TEXT,
    summary TEXT,
    category_id UUID REFERENCES public.letter_categories(id) ON DELETE SET NULL,
    activity_date DATE,
    activity_location TEXT,
    notes TEXT,
    status letter_status NOT NULL DEFAULT 'DRAFT',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- 6. LETTER FILES (penyimpanan metadata file fisik)
CREATE TABLE IF NOT EXISTS public.letter_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    letter_id UUID NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    storage_bucket TEXT NOT NULL DEFAULT 'letter-files',
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. LETTER AI RESULTS (hasil ekstraksi OCR/AI pada tahap selanjutnya)
CREATE TABLE IF NOT EXISTS public.letter_ai_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    letter_id UUID NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
    model_name TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    raw_response TEXT,
    structured_response JSONB,
    processing_time NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. LETTER TAGS (label / tag arsip)
CREATE TABLE IF NOT EXISTS public.letter_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    letter_id UUID NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. LETTER LOGS (audit log aktivitas surat)
CREATE TABLE IF NOT EXISTS public.letter_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    letter_id UUID REFERENCES public.letters(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. SYSTEM SETTINGS (pengaturan identitas sekolah)
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_name TEXT,
    school_address TEXT,
    school_phone TEXT,
    school_email TEXT,
    school_website TEXT,
    school_logo TEXT,
    head_of_tu_name TEXT,
    head_of_tu_position TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 11. TRIGGER UPDATED_AT OTOMATIS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_letter_categories_updated_at ON public.letter_categories;
CREATE TRIGGER trg_letter_categories_updated_at
    BEFORE UPDATE ON public.letter_categories
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_letters_updated_at ON public.letters;
CREATE TRIGGER trg_letters_updated_at
    BEFORE UPDATE ON public.letters
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER trg_system_settings_updated_at
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 12. INITIAL ADMIN SETUP TRIGGER
-- Saat user pertama mendaftar dan tabel profiles masih kosong,
-- user pertama otomatis diberikan role 'SUPER_ADMIN'.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    is_first_user BOOLEAN;
    user_full_name TEXT;
BEGIN
    -- Periksa apakah ini user pertama yang terdaftar
    SELECT COUNT(*) = 0 INTO is_first_user FROM public.profiles;

    user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);

    IF is_first_user THEN
        INSERT INTO public.profiles (id, full_name, email, role, is_active)
        VALUES (NEW.id, user_full_name, NEW.email, 'SUPER_ADMIN', TRUE);
    ELSE
        INSERT INTO public.profiles (id, full_name, email, role, is_active)
        VALUES (NEW.id, user_full_name, NEW.email, 'VIEWER', TRUE);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 13. STORAGE BUCKET: letter-files (Private)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'letter-files',
    'letter-files',
    FALSE,
    52428800, -- 50MB
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
    public = FALSE,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

-- ==============================================================================
-- 14. HELPER FUNCTIONS UNTUK ROW LEVEL SECURITY (RLS)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'SUPER_ADMIN' AND is_active = TRUE
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin_or_super()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN') AND is_active = TRUE
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_active = TRUE
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ==============================================================================
-- 15. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Aktifkan RLS di seluruh tabel
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letter_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letter_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letter_ai_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letter_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letter_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- --- PROFILES POLICIES ---
-- Super Admin bisa melihat & mengelola semua profil
CREATE POLICY "Super Admin can view all profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (public.is_super_admin() OR id = auth.uid());

CREATE POLICY "Super Admin can update profiles"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (public.is_super_admin() OR id = auth.uid())
    WITH CHECK (
        public.is_super_admin() OR
        (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()))
    );

CREATE POLICY "Super Admin can delete profiles"
    ON public.profiles FOR DELETE
    TO authenticated
    USING (public.is_super_admin() AND id <> auth.uid());

-- Allow initial check if profiles is empty (for setup route detection)
CREATE POLICY "Public can check if setup needed"
    ON public.profiles FOR SELECT
    TO anon
    USING (TRUE);

-- --- SYSTEM SETTINGS POLICIES ---
CREATE POLICY "Active users can view system settings"
    ON public.system_settings FOR SELECT
    TO authenticated
    USING (public.is_active_user());

CREATE POLICY "Public can view basic system settings"
    ON public.system_settings FOR SELECT
    TO anon
    USING (TRUE);

CREATE POLICY "Super Admin can insert or update system settings"
    ON public.system_settings FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- --- LETTER CATEGORIES POLICIES ---
CREATE POLICY "Active users can view letter categories"
    ON public.letter_categories FOR SELECT
    TO authenticated
    USING (public.is_active_user());

CREATE POLICY "Super Admin & Admin can manage categories"
    ON public.letter_categories FOR ALL
    TO authenticated
    USING (public.is_admin_or_super())
    WITH CHECK (public.is_admin_or_super());

-- --- LETTERS POLICIES ---
-- SUPER_ADMIN: seluruh akses
-- ADMIN: akses operasional (read, insert, update)
-- VIEWER: melihat arsip sesuai status yang sudah VERIFIED atau ARCHIVED
CREATE POLICY "Super Admin full access on letters"
    ON public.letters FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY "Admin can view letters"
    ON public.letters FOR SELECT
    TO authenticated
    USING (public.is_admin_or_super());

CREATE POLICY "Admin can insert letters"
    ON public.letters FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin_or_super());

CREATE POLICY "Admin can update letters"
    ON public.letters FOR UPDATE
    TO authenticated
    USING (public.is_admin_or_super())
    WITH CHECK (public.is_admin_or_super());

CREATE POLICY "Viewer can view published letters"
    ON public.letters FOR SELECT
    TO authenticated
    USING (
        public.is_active_user() AND
        status IN ('VERIFIED', 'ARCHIVED') AND
        deleted_at IS NULL
    );

-- --- LETTER FILES POLICIES ---
CREATE POLICY "Super Admin full access on letter files"
    ON public.letter_files FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY "Admin can view and insert files"
    ON public.letter_files FOR SELECT
    TO authenticated
    USING (public.is_admin_or_super());

CREATE POLICY "Admin can insert letter files"
    ON public.letter_files FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin_or_super());

CREATE POLICY "Admin can update letter files"
    ON public.letter_files FOR UPDATE
    TO authenticated
    USING (public.is_admin_or_super())
    WITH CHECK (public.is_admin_or_super());

CREATE POLICY "Viewer can view files of published letters"
    ON public.letter_files FOR SELECT
    TO authenticated
    USING (
        public.is_active_user() AND
        EXISTS (
            SELECT 1 FROM public.letters l
            WHERE l.id = letter_files.letter_id
            AND l.status IN ('VERIFIED', 'ARCHIVED')
            AND l.deleted_at IS NULL
        )
    );

-- --- LETTER AI RESULTS POLICIES ---
CREATE POLICY "Admin & Super Admin view AI results"
    ON public.letter_ai_results FOR SELECT
    TO authenticated
    USING (public.is_admin_or_super());

CREATE POLICY "Admin & Super Admin manage AI results"
    ON public.letter_ai_results FOR ALL
    TO authenticated
    USING (public.is_admin_or_super())
    WITH CHECK (public.is_admin_or_super());

-- --- LETTER TAGS POLICIES ---
CREATE POLICY "Active users view tags"
    ON public.letter_tags FOR SELECT
    TO authenticated
    USING (public.is_active_user());

CREATE POLICY "Admin & Super Admin manage tags"
    ON public.letter_tags FOR ALL
    TO authenticated
    USING (public.is_admin_or_super())
    WITH CHECK (public.is_admin_or_super());

-- --- LETTER LOGS (AUDIT) POLICIES ---
-- Hanya SUPER_ADMIN yang dapat membaca seluruh audit log
CREATE POLICY "Super Admin can view audit logs"
    ON public.letter_logs FOR SELECT
    TO authenticated
    USING (public.is_super_admin());

-- Pengguna aktif dapat menambahkan log saat berinteraksi
CREATE POLICY "Active users can insert audit logs"
    ON public.letter_logs FOR INSERT
    TO authenticated
    WITH CHECK (public.is_active_user());

-- --- STORAGE OBJECT POLICIES (bucket: letter-files) ---
CREATE POLICY "Authenticated users view signed files if permitted"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'letter-files' AND public.is_active_user());

CREATE POLICY "Admin & Super Admin can upload letter files"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'letter-files' AND public.is_admin_or_super());

CREATE POLICY "Super Admin can delete letter files"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'letter-files' AND public.is_super_admin());

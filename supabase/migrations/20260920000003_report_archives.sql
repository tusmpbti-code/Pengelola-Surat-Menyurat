-- Migration: 20260920000003_report_archives.sql
-- Tabel penyimpan arsip berkas laporan PDF Jurnal SIPAS BTI

CREATE TABLE IF NOT EXISTS public.report_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type TEXT NOT NULL, -- 'JURNAL_SURAT_MASUK', 'JURNAL_SURAT_KELUAR', 'REKAP_TAHUNAN'
    title TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size NUMERIC DEFAULT 0,
    storage_bucket TEXT NOT NULL DEFAULT 'letter-files',
    total_records INTEGER DEFAULT 0,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.report_archives ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can read report archives"
    ON public.report_archives
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert report archives"
    ON public.report_archives
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Admins can delete report archives"
    ON public.report_archives
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('SUPER_ADMIN', 'ADMIN')
        )
    );

-- ==============================================================================
-- SIPAS BTI - Sistem Pengarsipan Surat SMP Bhinneka Tunggal Ika
-- Tahap 2: Atomic Agenda Counter, Indexing, & Mekanisme Pengarsipan
-- ==============================================================================
-- CATATAN: Skema ini memastikan nomor agenda bersifat atomic, tersimpan permanen
-- di database, dimulai dari 001 setiap tahun kalender, tanpa menghitung COUNT baris
-- atau nomor tampilan tabel, serta bebas race-condition.
-- ==============================================================================

-- 1. TABEL PENGHITUNG NOMOR AGENDA ATOMIK (agenda_counters)
CREATE TABLE IF NOT EXISTS public.agenda_counters (
    year INT NOT NULL,
    letter_type letter_type NOT NULL,
    last_number INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (year, letter_type)
);

-- Indexing performa pencarian surat
CREATE INDEX IF NOT EXISTS idx_letters_type_status ON public.letters (letter_type, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_letters_letter_number ON public.letters (letter_number);
CREATE INDEX IF NOT EXISTS idx_letters_agenda_number ON public.letters (agenda_number);
CREATE INDEX IF NOT EXISTS idx_letters_letter_date ON public.letters (letter_date);
CREATE INDEX IF NOT EXISTS idx_letters_received_date ON public.letters (received_date);

-- RLS untuk agenda_counters
ALTER TABLE public.agenda_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select agenda_counters"
    ON public.agenda_counters FOR SELECT
    TO authenticated
    USING (public.is_active_user());

CREATE POLICY "Admin & Super Admin can manage agenda_counters"
    ON public.agenda_counters FOR ALL
    TO authenticated
    USING (public.is_admin_or_super())
    WITH CHECK (public.is_admin_or_super());

-- 2. FUNGSI ATOMIK UNTUK MENGAMBIL DAN MENINGKATKAN NOMOR AGENDA
-- Dimulai dari 001 untuk setiap tahun kalender dan jenis surat.
-- Menggunakan INSERT ... ON CONFLICT DO UPDATE untuk mencegah race condition.
CREATE OR REPLACE FUNCTION public.get_next_agenda_number(
    p_letter_type letter_type,
    p_year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT
)
RETURNS TEXT AS $$
DECLARE
    next_num INT;
    formatted_num TEXT;
BEGIN
    -- Atomic upsert increment
    INSERT INTO public.agenda_counters (year, letter_type, last_number, updated_at)
    VALUES (p_year, p_letter_type, 1, NOW())
    ON CONFLICT (year, letter_type)
    DO UPDATE SET 
        last_number = public.agenda_counters.last_number + 1,
        updated_at = NOW()
    RETURNING last_number INTO next_num;

    -- Format menjadi 3 digit (atau lebih jika > 999), contoh: '001', '002', '010', '100'
    formatted_num := LPAD(next_num::TEXT, 3, '0');
    RETURN formatted_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_next_agenda_number TO authenticated;
GRANT ALL ON public.agenda_counters TO authenticated;

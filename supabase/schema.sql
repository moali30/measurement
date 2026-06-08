-- Supabase Schema for AEMS Migration

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Forms Table
CREATE TABLE public.forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active',
    slug TEXT UNIQUE NOT NULL,
    responses_count INTEGER DEFAULT 0,
    allow_anonymous BOOLEAN DEFAULT true,
    prevent_duplicate BOOLEAN DEFAULT false,
    require_login BOOLEAN DEFAULT false,
    confirmation_msg TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Questions Table
CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID REFERENCES public.forms(id) ON DELETE CASCADE NOT NULL,
    text TEXT NOT NULL,
    type TEXT NOT NULL,
    options JSONB,
    required BOOLEAN DEFAULT false,
    order_index INTEGER DEFAULT 0,
    min_value INTEGER,
    max_value INTEGER,
    min_label TEXT,
    max_label TEXT
);

-- 3. Responses Table
CREATE TABLE public.responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID REFERENCES public.forms(id) ON DELETE CASCADE NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Response Answers Table
CREATE TABLE public.response_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID REFERENCES public.forms(id) ON DELETE CASCADE NOT NULL,
    response_id UUID REFERENCES public.responses(id) ON DELETE CASCADE NOT NULL,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
    text_value TEXT,
    number_value NUMERIC
);

-- Storage Buckets setup
INSERT INTO storage.buckets (id, name, public) VALUES 
('excel_imports', 'excel_imports', true),
('qr_codes', 'qr_codes', true),
('pdf_reports', 'pdf_reports', true),
('university_logos', 'university_logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies (Allow public read, authenticated insert)
CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT USING (bucket_id IN ('excel_imports', 'qr_codes', 'pdf_reports', 'university_logos'));
CREATE POLICY "Auth Insert Access" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('excel_imports', 'qr_codes', 'pdf_reports', 'university_logos'));

-- RLS (Row Level Security)
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_answers ENABLE ROW LEVEL SECURITY;

-- Basic Policies (can be refined later based on requirements)
-- Allow anyone to read active forms and questions (for public filling)
CREATE POLICY "Public can read active forms" ON public.forms FOR SELECT USING (status = 'active');
CREATE POLICY "Public can read questions" ON public.questions FOR SELECT USING (true);

-- Allow anyone to submit responses if form allows anonymous
CREATE POLICY "Public can submit responses" ON public.responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can submit answers" ON public.response_answers FOR INSERT WITH CHECK (true);

-- Allow admins (users) to read and manage all data
CREATE POLICY "Admins full access forms" ON public.forms FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access questions" ON public.questions FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access responses" ON public.responses FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins full access response_answers" ON public.response_answers FOR ALL TO authenticated USING (true);

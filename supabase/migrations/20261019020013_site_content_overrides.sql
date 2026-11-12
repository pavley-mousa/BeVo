CREATE TABLE IF NOT EXISTS public.site_content_overrides (
  content_key text PRIMARY KEY,
  original_text text NOT NULL,
  edited_text text NOT NULL,
  updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_content_overrides_key_length CHECK (char_length(content_key) BETWEEN 1 AND 2000),
  CONSTRAINT site_content_overrides_original_length CHECK (char_length(original_text) <= 5000),
  CONSTRAINT site_content_overrides_edited_length CHECK (char_length(edited_text) <= 5000)
);

ALTER TABLE public.site_content_overrides ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.site_content_overrides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_content_overrides TO authenticated;

DROP POLICY IF EXISTS "public can read site text overrides" ON public.site_content_overrides;
CREATE POLICY "public can read site text overrides"
  ON public.site_content_overrides FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "super admins insert site text overrides" ON public.site_content_overrides;
CREATE POLICY "super admins insert site text overrides"
  ON public.site_content_overrides FOR INSERT TO authenticated
  WITH CHECK (
    private.is_super_admin()
    AND updated_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "super admins update site text overrides" ON public.site_content_overrides;
CREATE POLICY "super admins update site text overrides"
  ON public.site_content_overrides FOR UPDATE TO authenticated
  USING (private.is_super_admin())
  WITH CHECK (
    private.is_super_admin()
    AND updated_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "super admins delete site text overrides" ON public.site_content_overrides;
CREATE POLICY "super admins delete site text overrides"
  ON public.site_content_overrides FOR DELETE TO authenticated
  USING (private.is_super_admin());

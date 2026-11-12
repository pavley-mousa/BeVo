-- Incremental correction for an already-provisioned BeVo database.
-- Applied migration: 20261019015117_create_academic_year_atomically
CREATE UNIQUE INDEX IF NOT EXISTS academic_years_one_current_active_per_college
ON public.academic_years (college_id)
WHERE is_current AND is_active;

CREATE OR REPLACE FUNCTION public.create_academic_year_atomic(p_college_id uuid, p_label text, p_starts_on date DEFAULT NULL::date, p_ends_on date DEFAULT NULL::date, p_is_current boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF NOT private.can_manage_college(p_college_id) THEN
    RAISE EXCEPTION 'Not authorized to manage this college' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(COALESCE(p_label, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Academic year label is required' USING ERRCODE = '23514';
  END IF;
  IF p_starts_on IS NOT NULL AND p_ends_on IS NOT NULL AND p_ends_on < p_starts_on THEN
    RAISE EXCEPTION 'Academic year end date must be on or after the start date' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.colleges c
    WHERE c.id = p_college_id AND c.is_active
  ) THEN
    RAISE EXCEPTION 'College not found or inactive' USING ERRCODE = '23503';
  END IF;

  IF COALESCE(p_is_current, false) THEN
    UPDATE public.academic_years
    SET is_current = false
    WHERE college_id = p_college_id AND is_current;
  END IF;

  INSERT INTO public.academic_years
    (college_id, label, starts_on, ends_on, is_current, is_active)
  VALUES
    (p_college_id, btrim(p_label), p_starts_on, p_ends_on, COALESCE(p_is_current, false), true)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$


REVOKE ALL ON FUNCTION public.create_academic_year_atomic(uuid, text, date, date, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_academic_year_atomic(uuid, text, date, date, boolean) TO authenticated;

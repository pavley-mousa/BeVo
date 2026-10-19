-- Incremental correction for an already-provisioned BeVo database.
-- Applied migration: 20261019014516_year_admin_scoped_offering_creation
CREATE OR REPLACE FUNCTION public.year_admin_create_offering(p_course_id uuid, p_academic_year_id uuid, p_study_level_id uuid, p_term_id uuid, p_requires_section boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_offering_id uuid;
  v_college_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT c.college_id INTO v_college_id
  FROM public.courses c
  WHERE c.id = p_course_id AND c.is_active;

  IF v_college_id IS NULL THEN
    RAISE EXCEPTION 'Active course not found' USING ERRCODE = '23503';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.role_assignments ra
    WHERE ra.user_id = (SELECT auth.uid())
      AND ra.role = 'year_admin'
      AND ra.is_active
      AND ra.college_id = v_college_id
      AND ra.academic_year_id = p_academic_year_id
      AND ra.study_level_id = p_study_level_id
  ) THEN
    RAISE EXCEPTION 'Not authorized for this college, academic year, and study level' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.academic_years ay
    WHERE ay.id = p_academic_year_id
      AND ay.college_id = v_college_id
      AND ay.is_active
  ) THEN
    RAISE EXCEPTION 'Academic year does not belong to the selected college or is inactive' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.study_levels l
    WHERE l.id = p_study_level_id
      AND l.college_id = v_college_id
      AND l.is_active
  ) THEN
    RAISE EXCEPTION 'Study level does not belong to the selected college or is inactive' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.terms t
    WHERE t.id = p_term_id
      AND t.academic_year_id = p_academic_year_id
      AND t.is_active
  ) THEN
    RAISE EXCEPTION 'Term does not belong to the selected academic year or is inactive' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.course_offerings
    (course_id, college_id, academic_year_id, study_level_id, term_id, requires_section, is_active)
  VALUES
    (p_course_id, v_college_id, p_academic_year_id, p_study_level_id, p_term_id, COALESCE(p_requires_section, true), true)
  ON CONFLICT (course_id, academic_year_id, study_level_id, term_id)
  DO UPDATE SET
    requires_section = EXCLUDED.requires_section,
    is_active = true
  RETURNING id INTO v_offering_id;

  RETURN v_offering_id;
END;
$function$


REVOKE ALL ON FUNCTION public.year_admin_create_offering(uuid, uuid, uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.year_admin_create_offering(uuid, uuid, uuid, uuid, boolean) TO authenticated;

-- Run catalog soft-hide cascades atomically inside one PostgreSQL transaction.
-- The client never computes dependency IDs or sends a sequence of table updates.
-- This migration is staged in Git only; verify the live BeVo schema before applying.

CREATE OR REPLACE FUNCTION public.super_admin_toggle_catalog_active(
  p_kind text,
  p_record_id uuid,
  p_is_active boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_offering_ids uuid[] := ARRAY[]::uuid[];
  v_parent_id uuid;
  v_rows integer := 0;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF NOT private.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized to manage catalog records' USING ERRCODE = '42501';
  END IF;

  IF p_record_id IS NULL OR p_kind IS NULL OR p_kind NOT IN (
    'colleges', 'years', 'levels', 'terms', 'courses', 'offerings', 'lectures'
  ) OR p_is_active IS NULL THEN
    RAISE EXCEPTION 'Invalid catalog target' USING ERRCODE = '22023';
  END IF;

  -- Restore only the selected parent. Descendants intentionally remain hidden,
  -- matching the existing UI contract and avoiding accidental mass reactivation.
  IF p_is_active THEN
    CASE p_kind
      WHEN 'colleges' THEN
        UPDATE public.colleges SET is_active = true WHERE id = p_record_id;
      WHEN 'years' THEN
        UPDATE public.academic_years SET is_active = true WHERE id = p_record_id;
      WHEN 'levels' THEN
        UPDATE public.study_levels SET is_active = true WHERE id = p_record_id;
      WHEN 'terms' THEN
        UPDATE public.terms SET is_active = true WHERE id = p_record_id;
      WHEN 'courses' THEN
        UPDATE public.courses SET is_active = true WHERE id = p_record_id;
      WHEN 'offerings' THEN
        UPDATE public.course_offerings SET is_active = true WHERE id = p_record_id;
      WHEN 'lectures' THEN
        UPDATE public.lecture_options SET is_active = true WHERE id = p_record_id;
    END CASE;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      RAISE EXCEPTION 'Catalog record not found' USING ERRCODE = 'P0002';
    END IF;

    RETURN true;
  END IF;

  -- Hide descendants first and parent last. Any error rolls back every update.
  CASE p_kind
    WHEN 'colleges' THEN
      SELECT c.id INTO v_parent_id
      FROM public.colleges c
      WHERE c.id = p_record_id
      FOR UPDATE;

      IF v_parent_id IS NULL THEN
        RAISE EXCEPTION 'College not found' USING ERRCODE = 'P0002';
      END IF;

      SELECT COALESCE(array_agg(o.id), ARRAY[]::uuid[])
      INTO v_offering_ids
      FROM public.course_offerings o
      WHERE o.college_id = p_record_id
         OR o.academic_year_id IN (
           SELECT ay.id FROM public.academic_years ay WHERE ay.college_id = p_record_id
         )
         OR o.study_level_id IN (
           SELECT sl.id FROM public.study_levels sl WHERE sl.college_id = p_record_id
         )
         OR o.course_id IN (
           SELECT c.id FROM public.courses c WHERE c.college_id = p_record_id
         )
         OR o.term_id IN (
           SELECT t.id
           FROM public.terms t
           JOIN public.academic_years ay ON ay.id = t.academic_year_id
           WHERE ay.college_id = p_record_id
         );

      UPDATE public.lecture_options
      SET is_active = false
      WHERE offering_id = ANY(v_offering_ids);

      UPDATE public.course_groups
      SET is_active = false
      WHERE offering_id = ANY(v_offering_ids);

      UPDATE public.course_offerings
      SET is_active = false
      WHERE id = ANY(v_offering_ids);

      UPDATE public.terms
      SET is_active = false
      WHERE academic_year_id IN (
        SELECT ay.id FROM public.academic_years ay WHERE ay.college_id = p_record_id
      );

      UPDATE public.courses SET is_active = false WHERE college_id = p_record_id;
      UPDATE public.study_levels SET is_active = false WHERE college_id = p_record_id;
      UPDATE public.academic_years SET is_active = false WHERE college_id = p_record_id;
      UPDATE public.colleges SET is_active = false WHERE id = p_record_id;

    WHEN 'years' THEN
      SELECT ay.id INTO v_parent_id
      FROM public.academic_years ay
      WHERE ay.id = p_record_id
      FOR UPDATE;

      IF v_parent_id IS NULL THEN
        RAISE EXCEPTION 'Academic year not found' USING ERRCODE = 'P0002';
      END IF;

      SELECT COALESCE(array_agg(o.id), ARRAY[]::uuid[])
      INTO v_offering_ids
      FROM public.course_offerings o
      WHERE o.academic_year_id = p_record_id
         OR o.term_id IN (
           SELECT t.id FROM public.terms t WHERE t.academic_year_id = p_record_id
         );

      UPDATE public.lecture_options SET is_active = false WHERE offering_id = ANY(v_offering_ids);
      UPDATE public.course_groups SET is_active = false WHERE offering_id = ANY(v_offering_ids);
      UPDATE public.course_offerings SET is_active = false WHERE id = ANY(v_offering_ids);
      UPDATE public.terms SET is_active = false WHERE academic_year_id = p_record_id;
      UPDATE public.academic_years SET is_active = false WHERE id = p_record_id;

    WHEN 'levels' THEN
      SELECT sl.id INTO v_parent_id
      FROM public.study_levels sl
      WHERE sl.id = p_record_id
      FOR UPDATE;

      IF v_parent_id IS NULL THEN
        RAISE EXCEPTION 'Study level not found' USING ERRCODE = 'P0002';
      END IF;

      SELECT COALESCE(array_agg(o.id), ARRAY[]::uuid[])
      INTO v_offering_ids
      FROM public.course_offerings o
      WHERE o.study_level_id = p_record_id;

      UPDATE public.lecture_options SET is_active = false WHERE offering_id = ANY(v_offering_ids);
      UPDATE public.course_groups SET is_active = false WHERE offering_id = ANY(v_offering_ids);
      UPDATE public.course_offerings SET is_active = false WHERE id = ANY(v_offering_ids);
      UPDATE public.study_levels SET is_active = false WHERE id = p_record_id;

    WHEN 'terms' THEN
      SELECT t.id INTO v_parent_id
      FROM public.terms t
      WHERE t.id = p_record_id
      FOR UPDATE;

      IF v_parent_id IS NULL THEN
        RAISE EXCEPTION 'Term not found' USING ERRCODE = 'P0002';
      END IF;

      SELECT COALESCE(array_agg(o.id), ARRAY[]::uuid[])
      INTO v_offering_ids
      FROM public.course_offerings o
      WHERE o.term_id = p_record_id;

      UPDATE public.lecture_options SET is_active = false WHERE offering_id = ANY(v_offering_ids);
      UPDATE public.course_groups SET is_active = false WHERE offering_id = ANY(v_offering_ids);
      UPDATE public.course_offerings SET is_active = false WHERE id = ANY(v_offering_ids);
      UPDATE public.terms SET is_active = false WHERE id = p_record_id;

    WHEN 'courses' THEN
      SELECT c.id INTO v_parent_id
      FROM public.courses c
      WHERE c.id = p_record_id
      FOR UPDATE;

      IF v_parent_id IS NULL THEN
        RAISE EXCEPTION 'Course not found' USING ERRCODE = 'P0002';
      END IF;

      SELECT COALESCE(array_agg(o.id), ARRAY[]::uuid[])
      INTO v_offering_ids
      FROM public.course_offerings o
      WHERE o.course_id = p_record_id;

      UPDATE public.lecture_options SET is_active = false WHERE offering_id = ANY(v_offering_ids);
      UPDATE public.course_groups SET is_active = false WHERE offering_id = ANY(v_offering_ids);
      UPDATE public.course_offerings SET is_active = false WHERE id = ANY(v_offering_ids);
      UPDATE public.courses SET is_active = false WHERE id = p_record_id;

    WHEN 'offerings' THEN
      SELECT o.id INTO v_parent_id
      FROM public.course_offerings o
      WHERE o.id = p_record_id
      FOR UPDATE;

      IF v_parent_id IS NULL THEN
        RAISE EXCEPTION 'Course offering not found' USING ERRCODE = 'P0002';
      END IF;

      v_offering_ids := ARRAY[p_record_id];
      UPDATE public.lecture_options SET is_active = false WHERE offering_id = p_record_id;
      UPDATE public.course_groups SET is_active = false WHERE offering_id = p_record_id;
      UPDATE public.course_offerings SET is_active = false WHERE id = p_record_id;

    WHEN 'lectures' THEN
      SELECT l.id INTO v_parent_id
      FROM public.lecture_options l
      WHERE l.id = p_record_id
      FOR UPDATE;

      IF v_parent_id IS NULL THEN
        RAISE EXCEPTION 'Lecture option not found' USING ERRCODE = 'P0002';
      END IF;

      UPDATE public.lecture_options SET is_active = false WHERE id = p_record_id;
  END CASE;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.super_admin_toggle_catalog_active(text, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_toggle_catalog_active(text, uuid, boolean) TO authenticated;

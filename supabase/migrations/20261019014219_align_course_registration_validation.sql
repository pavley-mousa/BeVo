-- Incremental correction for an already-provisioned BeVo database.
-- Applied migration: 20261019014219_align_course_registration_validation
CREATE OR REPLACE FUNCTION public.save_initial_course_selections(p_choices jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_choice jsonb;
  v_offering_id uuid;
  v_lecture_id uuid;
  v_group_id uuid;
  v_count integer := 0;
  v_profile public.profiles%rowtype;
  v_offering public.course_offerings%rowtype;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF jsonb_typeof(p_choices) <> 'array' OR jsonb_array_length(p_choices) = 0 THEN
    RAISE EXCEPTION 'Choose at least one course';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_choices) choice
    GROUP BY choice->>'offering_id'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Choose only one lecture per course';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_uid;

  IF v_profile.id IS NULL OR v_profile.college_id IS NULL OR v_profile.study_level_id IS NULL THEN
    RAISE EXCEPTION 'Complete your academic profile first';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.student_course_selections s
    WHERE s.student_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Registration already saved; submit a change request';
  END IF;

  FOR v_choice IN SELECT value FROM jsonb_array_elements(p_choices)
  LOOP
    v_offering_id := (v_choice->>'offering_id')::uuid;
    v_lecture_id := (v_choice->>'lecture_option_id')::uuid;
    v_group_id := NULLIF(v_choice->>'course_group_id', '')::uuid;

    SELECT o.* INTO v_offering
    FROM public.course_offerings o
    JOIN public.academic_years ay
      ON ay.id = o.academic_year_id
     AND ay.is_current
     AND ay.is_active
    JOIN public.terms t
      ON t.id = o.term_id
     AND t.academic_year_id = o.academic_year_id
     AND t.is_active
    WHERE o.id = v_offering_id
      AND o.is_active
      AND o.college_id = v_profile.college_id
      AND o.study_level_id = v_profile.study_level_id;

    IF v_offering.id IS NULL THEN
      RAISE EXCEPTION 'Course is unavailable for this college, study level, current academic year, or active term';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.lecture_options l
      WHERE l.id = v_lecture_id
        AND l.offering_id = v_offering_id
        AND l.is_active
    ) THEN
      RAISE EXCEPTION 'Select a valid lecture option';
    END IF;

    IF v_offering.requires_section THEN
      IF v_group_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.course_groups g
        WHERE g.id = v_group_id
          AND g.offering_id = v_offering_id
          AND g.is_active
      ) THEN
        RAISE EXCEPTION 'Select a valid section';
      END IF;
    ELSIF v_group_id IS NOT NULL THEN
      RAISE EXCEPTION 'This course does not use sections';
    END IF;

    INSERT INTO public.student_course_selections
      (student_id, offering_id, lecture_option_id, course_group_id)
    VALUES
      (v_uid, v_offering_id, v_lecture_id, v_group_id);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$


CREATE OR REPLACE FUNCTION public.review_course_change_request(p_request_id uuid, p_approved boolean, p_admin_note text DEFAULT ''::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_req public.course_change_requests%rowtype;
  v_profile public.profiles%rowtype;
  v_choice jsonb;
  v_offering_id uuid;
  v_lecture_id uuid;
  v_group_id uuid;
  v_offering public.course_offerings%rowtype;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_req
  FROM public.course_change_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request already reviewed';
  END IF;
  IF NOT private.can_manage_student(v_req.student_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_req.student_id;

  IF p_approved THEN
    IF jsonb_typeof(v_req.requested_choices) <> 'array' OR jsonb_array_length(v_req.requested_choices) = 0 THEN
      RAISE EXCEPTION 'Requested choices are invalid';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_req.requested_choices) choice
      GROUP BY choice->>'offering_id'
      HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'Choose only one lecture per course';
    END IF;

    DELETE FROM public.student_course_selections
    WHERE student_id = v_req.student_id;

    FOR v_choice IN SELECT value FROM jsonb_array_elements(v_req.requested_choices)
    LOOP
      v_offering_id := (v_choice->>'offering_id')::uuid;
      v_lecture_id := (v_choice->>'lecture_option_id')::uuid;
      v_group_id := NULLIF(v_choice->>'course_group_id', '')::uuid;

      SELECT o.* INTO v_offering
      FROM public.course_offerings o
      JOIN public.academic_years ay
        ON ay.id = o.academic_year_id
       AND ay.is_current
       AND ay.is_active
      JOIN public.terms t
        ON t.id = o.term_id
       AND t.academic_year_id = o.academic_year_id
       AND t.is_active
      WHERE o.id = v_offering_id
        AND o.is_active
        AND o.college_id = v_profile.college_id
        AND o.study_level_id = v_profile.study_level_id;

      IF v_offering.id IS NULL THEN
        RAISE EXCEPTION 'Requested course is unavailable for this college, study level, current academic year, or active term';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM public.lecture_options l
        WHERE l.id = v_lecture_id
          AND l.offering_id = v_offering_id
          AND l.is_active
      ) THEN
        RAISE EXCEPTION 'Invalid lecture option';
      END IF;

      IF v_offering.requires_section AND (
        v_group_id IS NULL OR NOT EXISTS (
          SELECT 1
          FROM public.course_groups g
          WHERE g.id = v_group_id
            AND g.offering_id = v_offering_id
            AND g.is_active
        )
      ) THEN
        RAISE EXCEPTION 'Valid section required';
      END IF;

      IF NOT v_offering.requires_section AND v_group_id IS NOT NULL THEN
        RAISE EXCEPTION 'Section not allowed';
      END IF;

      INSERT INTO public.student_course_selections
        (student_id, offering_id, lecture_option_id, course_group_id)
      VALUES
        (v_req.student_id, v_offering_id, v_lecture_id, v_group_id);
    END LOOP;
  END IF;

  UPDATE public.course_change_requests
  SET status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
      admin_note = NULLIF(trim(COALESCE(p_admin_note, '')), ''),
      reviewed_by = (SELECT auth.uid()),
      reviewed_at = now()
  WHERE id = p_request_id;

  RETURN true;
END;
$function$


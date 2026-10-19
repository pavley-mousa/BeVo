"use client";

import {
  Activity, ArrowLeft, Bell, BookOpen, CalendarDays, Check, CheckCircle2,
  ChevronDown, CircleHelp, ClipboardList, Clock3, ExternalLink, Eye, EyeOff,
  FileText, GraduationCap, Home, Layers, LogOut, MapPin, Menu, Plus, RefreshCw,
  Search, Settings, ShieldCheck, UserRound, Users, X, Sparkles, Save, Pencil,
  AlertCircle, BadgeCheck, BookMarked, UserCog, Send, Link2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Row = Record<string, any>;
type Section = "overview" | "courses" | "admin" | "scope" | "tasks" | "resources" | "requests" | "notifications" | "users" | "profile";
type AuthScreen = "login" | "signup" | "verify" | "forgot";

type WorkspaceData = {
  colleges: Row[];
  years: Row[];
  levels: Row[];
  terms: Row[];
  courses: Row[];
  offerings: Row[];
  lectures: Row[];
  groups: Row[];
  roles: Row[];
  defaults: Row[];
  profiles: Row[];
  selections: Row[];
  requests: Row[];
  tasks: Row[];
  resources: Row[];
  notifications: Row[];
  scopedGroups: Row[];
};

const EMPTY_DATA: WorkspaceData = {
  colleges: [], years: [], levels: [], terms: [], courses: [], offerings: [], lectures: [],
  groups: [], roles: [], defaults: [], profiles: [], selections: [], requests: [], tasks: [],
  resources: [], notifications: [], scopedGroups: [],
};
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const ROLE_LABELS: Record<string, string> = {
  super_admin: "مدير المنصة",
  college_admin: "أدمن الكلية",
  year_admin: "أدمن السنة",
  section_admin: "أدمن السكشن",
  group_admin: "أدمن الجروب",
  instructor: "دكتور / معيد",
};

function messageOf(error: unknown) {
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return String(error || "حصل خطأ غير متوقع.");
}
function byId(rows: Row[], id: string | null | undefined) {
  return rows.find((row) => row.id === id);
}
function fullName(profile: Row | null | undefined) {
  return [profile?.first_name, profile?.middle_name, profile?.third_name].filter(Boolean).join(" ") || "مستخدم BeVo";
}
function timeLabel(time: string | null | undefined) {
  if (!time) return "غير محدد";
  return String(time).slice(0, 5);
}
function roleForCode(code: string) {
  return /^[A-D]$/i.test(code) ? "group_admin" : /^[a-d][1-6]$/i.test(code) ? "section_admin" : "group_admin";
}
function isGroupCode(code: string) {
  return /^[A-D]$/i.test(code);
}
function InputField({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}
function Panel({ title, subtitle, icon, children, action }: { title: string; subtitle?: string; icon?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return <section className="panel"><div className="panel-heading"><div className="panel-title-wrap"><span className="panel-icon">{icon || <Layers size={18} />}</span><div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div></div>{action}</div><div className="panel-content">{children}</div></section>;
}
function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return <div className="empty-state"><span><BookOpen size={22} /></span><strong>{title}</strong>{detail ? <p>{detail}</p> : null}</div>;
}

export default function BeVoApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [authScreen, setAuthScreen] = useState<AuthScreen>("login");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [searchText, setSearchText] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<WorkspaceData>(EMPTY_DATA);
  const [profile, setProfile] = useState<Row | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [signupDraft, setSignupDraft] = useState({
    first: "", middle: "", third: "", studentId: "", collegeId: "", levelId: "", year: "", email: "", password: "", confirm: "",
  });
  const [profileDraft, setProfileDraft] = useState({ first: "", middle: "", third: "", studentId: "", collegeId: "", levelId: "", year: "" });
  const [claimToken, setClaimToken] = useState("");
  const [skipProfileSetup, setSkipProfileSetup] = useState(false);
  const [selectedChoices, setSelectedChoices] = useState<Record<string, { lectureId: string; groupId: string }>>({});
  const [changeReason, setChangeReason] = useState("");

  const [collegeForm, setCollegeForm] = useState({ name: "", code: "" });
  const [yearForm, setYearForm] = useState({ collegeId: "", label: "2026–2027", startsOn: "", endsOn: "", current: true });
  const [levelForm, setLevelForm] = useState({ collegeId: "", name: "الفرقة الأولى", sortOrder: "1" });
  const [termForm, setTermForm] = useState({ yearId: "", name: "الترم الأول", startsOn: "", endsOn: "" });
  const [courseForm, setCourseForm] = useState({ collegeId: "", code: "", name: "", credits: "3" });
  const [offeringForm, setOfferingForm] = useState({ courseId: "", yearId: "", levelId: "", termId: "", requiresSection: true });
  const [lectureForm, setLectureForm] = useState({ offeringId: "", label: "المحاضرة A", day: "0", start: "09:00", end: "10:30", instructorName: "", room: "", capacity: "100" });
  const [defaultForm, setDefaultForm] = useState({ groupId: "", userId: "" });
  const [generalRoleForm, setGeneralRoleForm] = useState({ userId: "", role: "college_admin", collegeId: "", yearId: "", levelId: "" });
  const [taskForm, setTaskForm] = useState({ offeringId: "", groupId: "", type: "task", title: "", description: "", dueAt: "", reminder: "60", published: true });
  const [resourceForm, setResourceForm] = useState({ offeringId: "", groupId: "", title: "", description: "", driveUrl: "", youtubeUrl: "", playlistUrl: "", published: true });
  const [addSubjectForm, setAddSubjectForm] = useState({ defaultId: "", courseId: "", termId: "", groupName: "", day: "0", start: "09:00", end: "10:30", assistantName: "", room: "", capacity: "30" });
  const [groupEdits, setGroupEdits] = useState<Record<string, { day: string; start: string; end: string; assistant: string; room: string; capacity: string }>>({});
  const [requestNotes, setRequestNotes] = useState<Record<string, string>>({});
  const [savingRequest, setSavingRequest] = useState<string | null>(null);

  const notify = useCallback((text: string, tone: "success" | "error" | "info" = "success") => {
    setNotice({ text, tone });
  }, []);
  const refresh = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    let live = true;
    supabase.auth.getSession().then(({ data: result }) => {
      if (!live) return;
      setSession(result.session);
      setUser(result.session?.user ?? null);
    }).catch((error: unknown) => {
      if (live) notify(messageOf(error), "error");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!live) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    });
    return () => {
      live = false;
      listener.subscription.unsubscribe();
    };
  }, [notify]);

  useEffect(() => {
    if (!session?.user?.id) {
      setProfile(null);
      let catalogLive = true;
      const loadPublicCatalog = async () => {
        const [collegesResult, levelsResult, yearsResult, termsResult] = await Promise.all([
          supabase.from("colleges").select("*").eq("is_active", true),
          supabase.from("study_levels").select("*").eq("is_active", true),
          supabase.from("academic_years").select("*").eq("is_active", true),
          supabase.from("terms").select("*").eq("is_active", true),
        ]);
        if (!catalogLive) return;
        setData({
          ...EMPTY_DATA,
          colleges: (collegesResult.data || []) as Row[],
          levels: (levelsResult.data || []) as Row[],
          years: (yearsResult.data || []) as Row[],
          terms: (termsResult.data || []) as Row[],
        });
      };
      void loadPublicCatalog();
      return () => { catalogLive = false; };
    }
    let live = true;
    const load = async () => {
      setBusy(true);
      const fetchRows = async (table: string): Promise<Row[]> => {
        const { data: rows, error } = await supabase.from(table).select("*").limit(400);
        if (error) {
          console.warn("BeVo data read:", table, error.message);
          return [];
        }
        return (rows || []) as Row[];
      };
      try {
        const names = [
          "colleges", "academic_years", "study_levels", "terms", "courses", "course_offerings",
          "lecture_options", "course_groups", "role_assignments", "group_role_defaults", "profiles",
          "student_course_selections", "course_change_requests", "tasks", "course_resources", "notifications",
        ];
        const result = await Promise.all(names.map(fetchRows));
        if (!live) return;
        const next = { ...EMPTY_DATA };
        names.forEach((name, index) => {
          const keyMap: Record<string, keyof WorkspaceData> = {
            colleges: "colleges", academic_years: "years", study_levels: "levels", terms: "terms", courses: "courses",
            course_offerings: "offerings", lecture_options: "lectures", course_groups: "groups", role_assignments: "roles",
            group_role_defaults: "defaults", profiles: "profiles", student_course_selections: "selections",
            course_change_requests: "requests", tasks: "tasks", course_resources: "resources", notifications: "notifications",
          };
          next[keyMap[name]] = result[index];
        });
        const currentProfile = next.profiles.find((row) => row.id === session.user.id) || null;
        setProfile(currentProfile);
        setData(next);
        const activeRoles = next.roles.filter((row) => row.user_id === session.user.id && row.is_active);
        const activeDefaults = next.defaults.filter((row) => row.user_id === session.user.id && row.is_active);
        if (activeRoles.some((row) => ["group_admin", "section_admin"].includes(row.role)) || activeDefaults.length > 0) {
          const { data: scopeRows, error } = await supabase.rpc("section_admin_list_groups");
          if (live && !error) next.scopedGroups = (scopeRows || []) as Row[];
        }
        if (!live) return;
        setData({ ...next });
        if (currentProfile) {
          setProfileDraft({
            first: currentProfile.first_name || "", middle: currentProfile.middle_name || "", third: currentProfile.third_name || "",
            studentId: currentProfile.student_id || "", collegeId: currentProfile.college_id || "", levelId: currentProfile.study_level_id || "",
            year: currentProfile.enrollment_year || "",
          });
        }
        const storedChoices: Record<string, { lectureId: string; groupId: string }> = {};
        next.selections.forEach((selection) => {
          storedChoices[selection.offering_id] = {
            lectureId: selection.lecture_option_id || "",
            groupId: selection.course_group_id || "",
          };
        });
        setSelectedChoices(storedChoices);
      } catch (error) {
        if (live) notify(messageOf(error), "error");
      } finally {
        if (live) setBusy(false);
      }
    };
    void load();
    return () => { live = false; };
  }, [session?.user?.id, reloadKey, notify]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const currentUserId = session?.user?.id || "";
  const activeRoleRows = data.roles.filter((row) => row.user_id === currentUserId && row.is_active);
  const myDefaults = data.defaults.filter((row) => row.user_id === currentUserId && row.is_active);
  const allRoles = [...new Set([...activeRoleRows.map((row) => row.role), ...myDefaults.map((row) => row.role)])];
  const isRoot = allRoles.includes("super_admin");
  const isCollegeAdmin = allRoles.includes("college_admin");
  const isYearAdmin = allRoles.includes("year_admin");
  const isScopeAdmin = allRoles.some((role) => role === "group_admin" || role === "section_admin") || myDefaults.length > 0;
  const isInstructor = allRoles.includes("instructor");
  const isAcademicAdmin = isRoot || isCollegeAdmin || isYearAdmin;
  const isAdmin = isAcademicAdmin || isScopeAdmin || isInstructor;
  const selectedYearIds = data.years.filter((row) => row.is_current && row.is_active).map((row) => row.id);
  const studentOfferings = data.offerings.filter((offering) =>
    offering.is_active &&
    Boolean(profile?.college_id) &&
    offering.college_id === profile?.college_id &&
    Boolean(profile?.study_level_id) &&
    offering.study_level_id === profile?.study_level_id &&
    selectedYearIds.includes(offering.academic_year_id) &&
    Boolean(byId(data.terms, offering.term_id)?.is_active)
  );
  const mySelections = data.selections.filter((selection) => selection.student_id === currentUserId);
  const hasRegistration = mySelections.length > 0;
  const pendingMyRequest = data.requests.some((request) => request.student_id === currentUserId && request.status === "pending");

  const navItems = useMemo(() => {
    const items: { id: Section; label: string; icon: ReactNode; show: boolean }[] = [
      { id: "overview", label: "نظرة عامة", icon: <Home size={18} />, show: true },
      { id: "courses", label: "المواد والمحاضرات", icon: <BookOpen size={18} />, show: true },
      { id: "tasks", label: "المهام والتكليفات", icon: <ClipboardList size={18} />, show: true },
      { id: "resources", label: "المصادر التعليمية", icon: <FileText size={18} />, show: true },
      { id: "requests", label: "طلبات التغيير", icon: <RefreshCw size={18} />, show: true },
      { id: "notifications", label: "الإشعارات", icon: <Bell size={18} />, show: true },
      { id: "scope", label: "إدارة الجروب / السكشن", icon: <Layers size={18} />, show: isScopeAdmin },
      { id: "admin", label: "الإدارة الأكاديمية", icon: <Settings size={18} />, show: isAcademicAdmin },
      { id: "users", label: "المستخدمون والصلاحيات", icon: <Users size={18} />, show: isRoot || isCollegeAdmin },
      { id: "profile", label: "بياناتي", icon: <UserRound size={18} />, show: true },
    ];
    return items.filter((item) => item.show);
  }, [isScopeAdmin, isAcademicAdmin, isRoot, isCollegeAdmin]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
      if (error) throw error;
      notify("أهلًا بعودتك إلى BeVo.", "success");
    } catch (error) {
      notify(messageOf(error), "error");
    } finally { setBusy(false); }
  }

  async function signUp(event: FormEvent) {
    event.preventDefault();
    if ([signupDraft.first, signupDraft.middle, signupDraft.third, signupDraft.studentId, signupDraft.collegeId, signupDraft.levelId].some((value) => !value.trim())) {
      notify("أكمل الاسم الثلاثي والرقم الجامعي والكلية والفرقة.", "error"); return;
    }
    if (signupDraft.password.length < 8) { notify("كلمة المرور يجب ألا تقل عن 8 أحرف.", "error"); return; }
    if (signupDraft.password !== signupDraft.confirm) { notify("كلمتا المرور غير متطابقتين.", "error"); return; }
    setBusy(true);
    try {
      const email = signupDraft.email.trim().toLowerCase();
      const { data: created, error } = await supabase.auth.signUp({
        email, password: signupDraft.password,
        options: {
          data: { first_name: signupDraft.first, middle_name: signupDraft.middle, third_name: signupDraft.third },
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (error) throw error;
      setAuthEmail(email);
      if (created.session) {
        const { error: completeError } = await supabase.rpc("complete_student_profile", {
          p_first_name: signupDraft.first, p_middle_name: signupDraft.middle, p_third_name: signupDraft.third,
          p_student_id: signupDraft.studentId, p_college_id: signupDraft.collegeId, p_study_level_id: signupDraft.levelId,
          p_enrollment_year: signupDraft.year || "",
        });
        if (completeError) throw completeError;
        notify("تم إنشاء الحساب وحفظ بياناتك الأكاديمية.", "success");
        refresh();
      } else {
        setAuthScreen("verify");
        notify("راجع بريدك وأدخل رمز OTP المكوّن من 6 أرقام.", "info");
      }
    } catch (error) {
      notify(messageOf(error), "error");
    } finally { setBusy(false); }
  }

  async function verifyEmail(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) { notify("أدخل رمز OTP من 6 أرقام.", "error"); return; }
    setBusy(true);
    try {
      const { data: result, error } = await supabase.auth.verifyOtp({ email: authEmail.trim().toLowerCase(), token: otp, type: "signup" });
      if (error) throw error;
      if (result.session && signupDraft.collegeId && signupDraft.levelId && signupDraft.studentId) {
        const { error: completeError } = await supabase.rpc("complete_student_profile", {
          p_first_name: signupDraft.first, p_middle_name: signupDraft.middle, p_third_name: signupDraft.third,
          p_student_id: signupDraft.studentId, p_college_id: signupDraft.collegeId, p_study_level_id: signupDraft.levelId,
          p_enrollment_year: signupDraft.year || "",
        });
        if (completeError) throw completeError;
      }
      setSession(result.session);
      setUser(result.user);
      setAuthScreen("login");
      notify("تم تأكيد البريد الإلكتروني.", "success");
      refresh();
    } catch (error) { notify(messageOf(error), "error"); }
    finally { setBusy(false); }
  }

  async function sendPasswordReset(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(authEmail.trim().toLowerCase(), {
        redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      });
      if (error) throw error;
      notify("لو كان البريد مسجلًا، ستصلك رسالة استعادة كلمة المرور.", "success");
      setAuthScreen("login");
    } catch (error) { notify(messageOf(error), "error"); }
    finally { setBusy(false); }
  }

  async function signInGoogle() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
      });
      if (error) throw error;
    } catch (error) { notify(messageOf(error), "error"); setBusy(false); }
  }

  async function signOut() {
    setBusy(true);
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setActiveSection("overview");
    setBusy(false);
    setAuthScreen("login");
  }

  async function finishAcademicProfile(event: FormEvent) {
    event.preventDefault();
    if ([profileDraft.first, profileDraft.middle, profileDraft.third, profileDraft.studentId, profileDraft.collegeId, profileDraft.levelId].some((value) => !value.trim())) {
      notify("أكمل كل البيانات المطلوبة.", "error"); return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("complete_student_profile", {
        p_first_name: profileDraft.first, p_middle_name: profileDraft.middle, p_third_name: profileDraft.third,
        p_student_id: profileDraft.studentId, p_college_id: profileDraft.collegeId, p_study_level_id: profileDraft.levelId,
        p_enrollment_year: profileDraft.year || "",
      });
      if (error) throw error;
      notify("تم حفظ البيانات الأكاديمية.", "success");
      refresh();
    } catch (error) { notify(messageOf(error), "error"); }
    finally { setBusy(false); }
  }

  async function claimFirstAdmin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.rpc("claim_initial_super_admin", { p_token: claimToken });
      if (error) throw error;
      setClaimToken("");
      notify("تم تفعيل مدير المنصة.", "success");
      refresh();
    } catch (error) { notify(messageOf(error), "error"); }
    finally { setBusy(false); }
  }

  async function addCollege(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.from("colleges").insert({ name: collegeForm.name.trim(), code: collegeForm.code.trim().toUpperCase() });
      if (error) throw error;
      setCollegeForm({ name: "", code: "" });
      notify("تمت إضافة الكلية."); refresh();
    } catch (error) { notify(messageOf(error), "error"); }
    finally { setBusy(false); }
  }

  async function addAcademicYear(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (!yearForm.collegeId || !yearForm.label.trim()) throw new Error("اختر كلية واكتب اسم العام الأكاديمي.");
      if (yearForm.current) {
        const { error: clearError } = await supabase.from("academic_years").update({ is_current: false }).eq("college_id", yearForm.collegeId);
        if (clearError) throw clearError;
      }
      const { error } = await supabase.from("academic_years").insert({
        college_id: yearForm.collegeId, label: yearForm.label.trim(),
        starts_on: yearForm.startsOn || null, ends_on: yearForm.endsOn || null,
        is_current: yearForm.current, is_active: true,
      });
      if (error) throw error;
      notify("تمت إضافة العام الأكاديمي."); refresh();
    } catch (error) { notify(messageOf(error), "error"); }
    finally { setBusy(false); }
  }

  async function addLevel(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.from("study_levels").insert({
        college_id: levelForm.collegeId, name: levelForm.name.trim(), sort_order: Number(levelForm.sortOrder) || 1, is_active: true,
      });
      if (error) throw error;
      notify("تمت إضافة الفرقة."); refresh();
    } catch (error) { notify(messageOf(error), "error"); }
    finally { setBusy(false); }
  }

  async function addTerm(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (!termForm.yearId) throw new Error("اختر العام الأكاديمي.");
      const { error } = await supabase.from("terms").insert({
        academic_year_id: termForm.yearId, name: termForm.name.trim(),
        starts_on: termForm.startsOn || null, ends_on: termForm.endsOn || null, is_active: true,
      });
      if (error) throw error;
      notify("تمت إضافة الترم."); refresh();
    } catch (error) { notify(messageOf(error), "error"); }
    finally { setBusy(false); }
  }

  async function addCourse(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.from("courses").insert({
        college_id: courseForm.collegeId, code: courseForm.code.trim().toUpperCase(),
        name: courseForm.name.trim(), credits: Number(courseForm.credits) || 0, is_active: true,
      });
      if (error) throw error;
      setCourseForm({ ...courseForm, code: "", name: "" });
      notify("تمت إضافة المادة."); refresh();
    } catch (error) { notify(messageOf(error), "error"); }
    finally { setBusy(false); }
  }

  async function addOffering(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const course = byId(data.courses, offeringForm.courseId);
      if (!course) throw new Error("اختر المادة.");
      const row = {
        course_id: course.id, college_id: course.college_id, academic_year_id: offeringForm.yearId,
        study_level_id: offeringForm.levelId, term_id: offeringForm.termId,
        requires_section: offeringForm.requiresSection, is_active: true,
      };
      if (isYearAdmin && !isRoot && !isCollegeAdmin) {
        const { error } = await supabase.rpc("year_admin_create_offering", {
          p_course_id: course.id,
          p_academic_year_id: offeringForm.yearId,
          p_study_level_id: offeringForm.levelId,
          p_term_id: offeringForm.termId,
          p_requires_section: offeringForm.requiresSection,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("course_offerings")
          .upsert(row, { onConflict: "course_id,academic_year_id,study_level_id,term_id" });
        if (error) throw error;
      }
      notify("تم ربط المادة بالعام والفرقة والترم."); refresh();
    } catch (error) { notify(messageOf(error), "error"); }
    finally { setBusy(false); }
  }

  async function addLecture(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const existing = data.lectures.filter((lecture) => lecture.offering_id === lectureForm.offeringId);
      if (existing.length >= 4) throw new Error("الحد الأقصى 4 اختيارات محاضرة لكل مادة.");
      if (!lectureForm.offeringId || !lectureForm.label.trim()) throw new Error("اختر المادة واكتب اسم المحاضرة.");
      const { error } = await supabase.from("lecture_options").insert({
        offering_id: lectureForm.offeringId, label: lectureForm.label.trim(), day_of_week: Number(lectureForm.day),
        starts_at: lectureForm.start, ends_at: lectureForm.end,
        instructor_name: lectureForm.instructorName.trim() || null, room: lectureForm.room.trim() || null,
        capacity: lectureForm.capacity ? Number(lectureForm.capacity) : null, is_active: true,
      });
      if (error) throw error;
      notify("تمت إضافة اختيار المحاضرة."); refresh();
    } catch (error) { notify(messageOf(error), "error"); }
    finally { setBusy(false); }
  }

  async function assignDefault(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const group = byId(data.groups, defaultForm.groupId);
      if (!group) throw new Error("اختر الجروب أو السكشن.");
      const role = roleForCode(String(group.code || ""));
      const { error } = await supabase.rpc("set_group_role_default", {
        p_group_id: group.id, p_role: role, p_user_id: defaultForm.userId,
      });
      if (error) throw error;
      notify(`تم تعيين ${ROLE_LABELS[role]} إلى ${group.code}.`);
      refresh();
    } catch (error) { notify(messageOf(error), "error"); }
    finally { setBusy(false); }
  }

  async function assignGeneralRole(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (!generalRoleForm.userId) throw new Error("اختر الحساب.");
      if (generalRoleForm.role === "year_admin") {
        const selectedYear = byId(data.years, generalRoleForm.yearId);
        const selectedLevel = byId(data.levels, generalRoleForm.levelId);
        if (!generalRoleForm.collegeId || !generalRoleForm.yearId || !generalRoleForm.levelId) {
          throw new Error("دور أدمن السنة يحتاج تحديد الكلية والسنة والفرقة.");
        }
        if (selectedYear?.college_id !== generalRoleForm.collegeId || selectedLevel?.college_id !== generalRoleForm.collegeId) {
          throw new Error("السنة والفرقة يجب أن يتبعا الكلية المختارة.");
        }
      }
      const { error } = await supabase.from("role_assignments").insert({
        user_id: generalRoleForm.userId, role: generalRoleForm.role,
        college_id: generalRoleForm.collegeId || null, academic_year_id: generalRoleForm.yearId || null,
        study_level_id: generalRoleForm.levelId || null, assigned_by: currentUserId, is_active: true,
      });
      if (error) throw error;
      notify("تم تعيين الدور."); refresh();
    } catch (error) { notify(messageOf(error), "error"); }
    finally { setBusy(false); }
  }

  async function addTask(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (!taskForm.offeringId || !taskForm.title.trim()) throw new Error("حدد المادة والعنوان.");
      const { error } = await supabase.from("tasks").insert({
        offering_id: taskForm.offeringId, course_group_id: taskForm.groupId || null, created_by: currentUserId,
        task_type: taskForm.type, title: taskForm.title.trim(), description: taskForm.description.trim(),
        due_at: taskForm.dueAt ? new Date(taskForm.dueAt).toISOString() : null,
        reminder_minutes: [Number(taskForm.reminder) || 60], enable_message: true, enable_sound: true,
        is_published: taskForm.published,
      });
      if (error) throw error;
      setTaskForm({ ...taskForm, title: "", description: "", dueAt: "" });
      notify("تم حفظ المهمة وإعدادات التذكير."); refresh();
    } catch (error) { notify(messageOf(error), "error"); }
    finally { setBusy(false); }
  }

  async function addResource(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (!resourceForm.offeringId || !resourceForm.title.trim()) throw new Error("اختر المادة واكتب عنوان المصدر.");
      if ([resourceForm.driveUrl, resourceForm.youtubeUrl, resourceForm.playlistUrl].some((url) => url && !/^https:\/\//i.test(url))) {
        throw new Error("كل روابط المصادر يجب أن تبدأ بـ HTTPS.");
      }
      const { error } = await supabase.from("course_resources").insert({
        offering_id: resourceForm.offeringId, course_group_id: resourceForm.groupId || null,
        title: resourceForm.title.trim(), description: resourceForm.description.trim(), created_by: currentUserId,
        drive_url: resourceForm.driveUrl.trim() || null, youtube_url: resourceForm.youtubeUrl.trim() || null,
        playlist_url: resourceForm.playlistUrl.trim() || null, is_published: resourceForm.published,
      });
      if (error) throw error;
      setResourceForm({ ...resourceForm, title: "", description: "", driveUrl: "", youtubeUrl: "", playlistUrl: "" });
      notify("تم حفظ المصدر التعليمي."); refresh();
    } catch (error) { notify(messageOf(error), "error"); }
    finally { setBusy(false); }
  }

  async function addSubject(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const selectedDefault = myDefaults.find((row) => row.id === addSubjectForm.defaultId);
      const course = byId(data.courses, addSubjectForm.courseId);
      if (!selectedDefault || !course || !addSubjectForm.termId) throw new Error("أكمل اختيار الجروب والمادة والترم.");
      const capacity = addSubjectForm.capacity ? Number(addSubjectForm.capacity) : null;
      const { error } = await supabase.rpc("section_admin_add_subject", {
        p_group_code: selectedDefault.group_code,
        p_college_id: selectedDefault.college_id,
        p_academic_year_id: selectedDefault.academic_year_id,
        p_study_level_id: selectedDefault.study_level_id,
        p_course_id: course.id,
        p_term_id: addSubjectForm.termId,
        p_group_name: addSubjectForm.groupName.trim() || selectedDefault.group_code,
        p_day_of_week: Number(addSubjectForm.day),
        p_starts_at: addSubjectForm.start,
        p_ends_at: addSubjectForm.end,
        p_assistant_name: addSubjectForm.assistantName.trim(),
        p_room: addSubjectForm.room.trim(),
        p_capacity: capacity,
      });
      if (error) throw error;
      notify("تمت إضافة المادة للجروب أو السكشن."); refresh();
    } catch (error) { notify(messageOf(error), "error"); }
    finally { setBusy(false); }
  }

  async function saveGroup(group: Row) {
    const edit = groupEdits[group.id] || {
      day: String(group.day_of_week ?? 0), start: timeLabel(group.starts_at) === "غير محدد" ? "09:00" : timeLabel(group.starts_at),
      end: timeLabel(group.ends_at) === "غير محدد" ? "10:30" : timeLabel(group.ends_at),
      assistant: group.assistant_name || "", room: group.room || "", capacity: group.capacity ? String(group.capacity) : "",
    };
    setBusy(true);
    try {
      const { error } = await supabase.rpc("section_admin_update_group", {
        p_group_id: group.id, p_day_of_week: Number(edit.day), p_starts_at: edit.start, p_ends_at: edit.end,
        p_assistant_name: edit.assistant, p_room: edit.room, p_capacity: edit.capacity ? Number(edit.capacity) : null,
      });
      if (error) throw error;
      notify(`تم حفظ مواعيد ${group.code}.`); refresh();
    } catch (error) { notify(messageOf(error), "error"); }
    finally { setBusy(false); }
  }

  async function saveRegistration() {
    if (hasRegistration && pendingMyRequest) {
      notify("لديك طلب تعديل قيد المراجعة. انتظر القرار قبل إرسال طلب جديد.", "error");
      return;
    }
    if (hasRegistration && changeReason.trim().length < 5) {
      notify("اكتب سببًا للتعديل لا يقل عن 5 أحرف.", "error");
      return;
    }
    const choices = Object.entries(selectedChoices)
      .filter(([, choice]) => choice.lectureId)
      .map(([offeringId, choice]) => ({
        offering_id: offeringId, lecture_option_id: choice.lectureId, course_group_id: choice.groupId || null,
      }));
    if (!choices.length) { notify("اختار مادة ومحاضرتها على الأقل.", "error"); return; }
    setBusy(true);
    try {
      if (hasRegistration) {
        const { error } = await supabase.rpc("submit_course_change_request", {
          p_requested_choices: choices, p_reason: changeReason.trim(),
        });
        if (error) throw error;
        setChangeReason("");
        notify("تم إرسال طلب التعديل للأدمن.");
      } else {
        const { error } = await supabase.rpc("save_initial_course_selections", { p_choices: choices });
        if (error) throw error;
        notify("تم حفظ التسجيل. التغيير بعد الحفظ يحتاج موافقة الأدمن.");
      }
      refresh();
    } catch (error) { notify(messageOf(error), "error"); }
    finally { setBusy(false); }
  }

  async function reviewRequest(requestId: string, approved: boolean) {
    setSavingRequest(requestId);
    try {
      const { error } = await supabase.rpc("review_course_change_request", {
        p_request_id: requestId, p_approved: approved, p_admin_note: requestNotes[requestId] || "",
      });
      if (error) throw error;
      notify(approved ? "تمت الموافقة وتطبيق التسجيل الجديد." : "تم رفض الطلب.");
      refresh();
    } catch (error) { notify(messageOf(error), "error"); }
    finally { setSavingRequest(null); }
  }

  async function markNotificationRead(notificationId: string) {
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId);
    if (error) notify(messageOf(error), "error"); else refresh();
  }

  function currentCourseName(offeringId: string) {
    const offering = byId(data.offerings, offeringId);
    return byId(data.courses, offering?.course_id)?.name || "مادة";
  }
  function currentOfferingMeta(offering: Row) {
    const course = byId(data.courses, offering.course_id);
    const year = byId(data.years, offering.academic_year_id);
    const level = byId(data.levels, offering.study_level_id);
    const term = byId(data.terms, offering.term_id);
    return { course, year, level, term };
  }
  function getGroupsForOffering(offeringId: string) {
    return data.groups.filter((group) => group.offering_id === offeringId && group.is_active);
  }
  function isMemberOfRole(role: string) { return allRoles.includes(role); }
  function jump(section: Section) {
    setActiveSection(section);
    setMobileNav(false);
  }
  const currentSectionLabel = navItems.find((item) => item.id === activeSection)?.label || "نظرة عامة";

  if (!session?.user) {
    return (
      <main className="auth-page" dir="rtl" lang="ar">
        <div className="auth-aside">
          <div className="brand-lockup"><span className="brand-mark">B</span><div><strong>BeVo</strong><small>البوابة الأكاديمية</small></div></div>
          <div className="auth-hero">
            <span className="eyebrow"><Sparkles size={15} /> مساحة واحدة لدراستك</span>
            <h1>كل موادك ومواعيدك ومهامك… <em>في مكان واحد.</em></h1>
            <p>نظام موحّد للكليات والفرق والسكاشن بصلاحيات واضحة وتجربة بسيطة.</p>
            <div className="feature-stack">
              <div><span className="feature-icon"><BookOpen size={18} /></span><div><strong>تسجيل أكاديمي منظم</strong><small>اختار المحاضرة ثم السكشن إذا كانت المادة تتطلبه.</small></div></div>
              <div><span className="feature-icon"><Bell size={18} /></span><div><strong>تذكيرات للمواعيد</strong><small>تابع التاسكات والتكليفات من مكان واحد.</small></div></div>
              <div><span className="feature-icon"><ShieldCheck size={18} /></span><div><strong>صلاحيات واضحة</strong><small>كل أدمن يدير النطاق المخصص له فقط.</small></div></div>
            </div>
          </div>
          <div className="auth-aside-footer"><span>BeVo · Academic Portal</span><span>تعلم بتنظيم، واشتغل بوضوح.</span></div>
        </div>
        <div className="auth-main">
          <div className="auth-main-top"><span className="small-logo"><GraduationCap size={19} /> BeVo</span><span>المصادقة الآمنة عبر Supabase</span></div>
          <div className="auth-card">
            {authScreen === "login" ? (
              <>
                <span className="card-symbol"><UserRound size={22} /></span>
                <h2>أهلًا بك في BeVo</h2><p className="muted">سجّل دخولك لمتابعة موادك الدراسية.</p>
                <form className="form-stack" onSubmit={signIn}>
                  <InputField label="البريد الإلكتروني"><input type="email" required autoComplete="email" placeholder="name@example.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} /></InputField>
                  <InputField label="كلمة مرور الموقع"><div className="password-field"><input type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="أدخل كلمة المرور" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} /><button type="button" className="icon-button" aria-label="إظهار كلمة المرور" onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></InputField>
                  <div className="form-inline end"><button className="text-button" type="button" onClick={() => setAuthScreen("forgot")}>نسيت كلمة المرور؟</button></div>
                  <button className="btn btn-primary btn-wide" type="submit" disabled={busy}>{busy ? "جاري الدخول…" : "تسجيل الدخول"} <ArrowLeft size={17} /></button>
                </form>
                <div className="or-separator"><span /> أو <span /></div>
                <button className="btn btn-google btn-wide" type="button" onClick={signInGoogle} disabled={busy}><span className="google-g">G</span> المتابعة باستخدام Google</button>
                <div className="auth-bottom">ليس لديك حساب؟ <button className="text-button strong" type="button" onClick={() => setAuthScreen("signup")}>إنشاء حساب طالب</button></div>
              </>
            ) : null}
            {authScreen === "signup" ? (
              <>
                <span className="card-symbol"><GraduationCap size={23} /></span><h2>إنشاء حساب طالب</h2><p className="muted">استخدم بياناتك الأكاديمية كما هي في الجامعة.</p>
                <form className="form-stack" onSubmit={signUp}>
                  <div className="grid-two">
                    <InputField label="الاسم الأول"><input required value={signupDraft.first} onChange={(e) => setSignupDraft({ ...signupDraft, first: e.target.value })} /></InputField>
                    <InputField label="الاسم الثاني"><input required value={signupDraft.middle} onChange={(e) => setSignupDraft({ ...signupDraft, middle: e.target.value })} /></InputField>
                  </div>
                  <InputField label="الاسم الثالث"><input required value={signupDraft.third} onChange={(e) => setSignupDraft({ ...signupDraft, third: e.target.value })} /></InputField>
                  <InputField label="الرقم الجامعي"><input required value={signupDraft.studentId} onChange={(e) => setSignupDraft({ ...signupDraft, studentId: e.target.value })} /></InputField>
                  <div className="grid-two">
                    <InputField label="الكلية"><select required value={signupDraft.collegeId} onChange={(e) => setSignupDraft({ ...signupDraft, collegeId: e.target.value, levelId: "" })}><option value="">اختر الكلية</option>{data.colleges.filter((row) => row.is_active).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></InputField>
                    <InputField label="الفرقة"><select required value={signupDraft.levelId} onChange={(e) => setSignupDraft({ ...signupDraft, levelId: e.target.value })}><option value="">اختر الفرقة</option>{data.levels.filter((row) => row.is_active && row.college_id === signupDraft.collegeId).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></InputField>
                  </div>
                  <InputField label="سنة الالتحاق (اختياري)"><input placeholder="مثال: 2025" value={signupDraft.year} onChange={(e) => setSignupDraft({ ...signupDraft, year: e.target.value })} /></InputField>
                  <InputField label="البريد الإلكتروني"><input required type="email" autoComplete="email" value={signupDraft.email} onChange={(e) => setSignupDraft({ ...signupDraft, email: e.target.value })} /></InputField>
                  <InputField label="كلمة المرور" hint="8 أحرف على الأقل، وليست كلمة مرور Google."><input required type="password" autoComplete="new-password" minLength={8} value={signupDraft.password} onChange={(e) => setSignupDraft({ ...signupDraft, password: e.target.value })} /></InputField>
                  <InputField label="تأكيد كلمة المرور"><input required type="password" autoComplete="new-password" value={signupDraft.confirm} onChange={(e) => setSignupDraft({ ...signupDraft, confirm: e.target.value })} /></InputField>
                  <button className="btn btn-primary btn-wide" disabled={busy} type="submit">{busy ? "جاري إنشاء الحساب…" : "إرسال رمز التحقق"} <ArrowLeft size={17} /></button>
                </form>
                <div className="auth-bottom">لديك حساب؟ <button className="text-button strong" type="button" onClick={() => setAuthScreen("login")}>تسجيل الدخول</button></div>
              </>
            ) : null}
            {authScreen === "verify" ? (
              <>
                <span className="card-symbol"><BadgeCheck size={22} /></span><h2>تأكيد البريد الإلكتروني</h2><p className="muted">أرسلنا الرمز إلى <strong>{authEmail}</strong>. أدخل رمز OTP المكوّن من 6 أرقام.</p>
                <form className="form-stack" onSubmit={verifyEmail}><InputField label="رمز OTP (6 أرقام)"><input className="otp-input" inputMode="numeric" maxLength={6} required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" /></InputField><button className="btn btn-primary btn-wide" type="submit" disabled={busy}>{busy ? "جاري التأكيد…" : "تأكيد البريد"} <Check size={17} /></button></form>
                <div className="auth-bottom"><button className="text-button" type="button" onClick={() => setAuthScreen("signup")}>رجوع</button></div>
              </>
            ) : null}
            {authScreen === "forgot" ? (
              <>
                <span className="card-symbol"><ShieldCheck size={22} /></span><h2>استعادة كلمة المرور</h2><p className="muted">هنرسل لك رابط الاستعادة على بريدك إذا كان مسجلًا.</p>
                <form className="form-stack" onSubmit={sendPasswordReset}><InputField label="البريد الإلكتروني"><input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} /></InputField><button className="btn btn-primary btn-wide" disabled={busy} type="submit">{busy ? "جاري الإرسال…" : "إرسال رابط الاستعادة"}</button></form>
                <div className="auth-bottom"><button className="text-button" type="button" onClick={() => setAuthScreen("login")}>رجوع لتسجيل الدخول</button></div>
              </>
            ) : null}
          </div>
          <p className="auth-legal">باستخدام BeVo، استخدم بياناتك الأكاديمية الصحيحة واحفظ بيانات الدخول بأمان.</p>
        </div>
        {notice ? <div className={`toast toast-${notice.tone}`} role="status"><span>{notice.tone === "error" ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}</span>{notice.text}<button onClick={() => setNotice(null)} aria-label="إغلاق"><X size={15} /></button></div> : null}
      </main>
    );
  }

  if (profile && !profile.college_id && !isRoot && !skipProfileSetup) {
    return (
      <main className="profile-setup-page" dir="rtl" lang="ar">
        <div className="brand-lockup dark"><span className="brand-mark">B</span><div><strong>BeVo</strong><small>إكمال البيانات الأكاديمية</small></div></div>
        <form className="profile-setup-card" onSubmit={finishAcademicProfile}>
          <span className="card-symbol"><GraduationCap size={23} /></span><h1>كمّل بياناتك الأكاديمية</h1>
          <p className="muted">اربط حسابك بسجلك الجامعي. نستخدم البيانات دي لتحديد المواد والصلاحيات المتاحة لك.</p>
          <div className="grid-two">
            <InputField label="الاسم الأول"><input required value={profileDraft.first} onChange={(e) => setProfileDraft({ ...profileDraft, first: e.target.value })} /></InputField>
            <InputField label="الاسم الثاني"><input required value={profileDraft.middle} onChange={(e) => setProfileDraft({ ...profileDraft, middle: e.target.value })} /></InputField>
          </div>
          <InputField label="الاسم الثالث"><input required value={profileDraft.third} onChange={(e) => setProfileDraft({ ...profileDraft, third: e.target.value })} /></InputField>
          <InputField label="الرقم الجامعي"><input required value={profileDraft.studentId} onChange={(e) => setProfileDraft({ ...profileDraft, studentId: e.target.value })} /></InputField>
          <div className="grid-two">
            <InputField label="الكلية"><select required value={profileDraft.collegeId} onChange={(e) => setProfileDraft({ ...profileDraft, collegeId: e.target.value, levelId: "" })}><option value="">اختر الكلية</option>{data.colleges.filter((row) => row.is_active).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></InputField>
            <InputField label="الفرقة"><select required value={profileDraft.levelId} onChange={(e) => setProfileDraft({ ...profileDraft, levelId: e.target.value })}><option value="">اختر الفرقة</option>{data.levels.filter((row) => row.is_active && row.college_id === profileDraft.collegeId).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></InputField>
          </div>
          <InputField label="سنة الالتحاق"><input value={profileDraft.year} onChange={(e) => setProfileDraft({ ...profileDraft, year: e.target.value })} /></InputField>
          <button className="btn btn-primary btn-wide" disabled={busy} type="submit">{busy ? "جاري الحفظ…" : "حفظ البيانات"} <Check size={17} /></button>
          <div className="setup-extra-actions">
            <button type="button" className="text-button" onClick={() => setSkipProfileSetup(true)}>أنا مدير المنصة الأول — تفعيل Super Admin</button>
            <button type="button" className="text-button setup-logout" onClick={signOut}>تسجيل الخروج</button>
          </div>
        </form>
        {notice ? <div className={`toast toast-${notice.tone}`} role="status">{notice.text}</div> : null}
      </main>
    );
  }

  return (
    <div className="app-shell" dir="rtl" lang="ar">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand"><span className="brand-mark">B</span><div><strong>BeVo</strong><small>البوابة الأكاديمية</small></div><button className="sidebar-close icon-button" onClick={() => setMobileNav(false)} aria-label="إغلاق القائمة"><X size={17} /></button></div>
        <div className="sidebar-label">القائمة الرئيسية</div>
        <nav className="side-nav">{navItems.map((item) => <button key={item.id} className={`nav-item ${activeSection === item.id ? "nav-item-active" : ""}`} onClick={() => jump(item.id)}>{item.icon}<span>{item.label}</span>{item.id === "notifications" && data.notifications.some((n) => !n.read_at) ? <i className="nav-dot" /> : null}</button>)}</nav>
        <div className="sidebar-spacer" />
        <button className="help-card" onClick={() => { setGuideStep(0); setGuideOpen(true); }}><span><CircleHelp size={19} /></span><div><strong>محتاج مساعدة؟</strong><small>افتح الجولة التعريفية</small></div><ArrowLeft size={15} /></button>
        <div className="sidebar-footer"><span className="online-dot" /> متصل <span className="version-tag">BeVo</span></div>
      </aside>
      {mobileNav ? <button className="nav-backdrop" aria-label="إغلاق القائمة" onClick={() => setMobileNav(false)} /> : null}
      <div className="app-content">
        <header className="topbar">
          <div className="topbar-left"><button className="mobile-menu icon-button" aria-label="فتح القائمة" onClick={() => setMobileNav(true)}><Menu size={20} /></button><div className="breadcrumb"><span>BeVo</span><ChevronDown size={13} /><strong>{currentSectionLabel}</strong></div></div>
          <div className="topbar-actions">
            <button className="top-action help-action" onClick={() => { setGuideStep(0); setGuideOpen(true); }}><CircleHelp size={17} /> مساعد</button>
            <button className="top-action notification-action" onClick={() => jump("notifications")} aria-label="الإشعارات"><Bell size={18} />{data.notifications.some((n) => !n.read_at) ? <i /> : null}</button>
            <div className="top-profile"><span className="avatar">{(profile?.first_name || user?.email || "B").slice(0, 1).toUpperCase()}</span><div><strong>{fullName(profile)}</strong><small>{allRoles.map((r) => ROLE_LABELS[r] || r).join(" · ") || "طالب"}</small></div></div>
            <button className="icon-button logout-button" onClick={signOut} title="تسجيل الخروج" aria-label="تسجيل الخروج"><LogOut size={18} /></button>
          </div>
        </header>
        <main className="page-content">
          {activeSection === "overview" ? (
            <>
              <section className="welcome-banner">
                <div><span className="eyebrow light"><Activity size={14} /> مساحة العمل الأكاديمية</span><h1>أهلًا، {profile?.first_name || user?.email?.split("@")[0] || "بك"} 👋</h1><p>{isAdmin ? "تابع المواد والطلبات والإعدادات ضمن نطاق مسؤوليتك." : "تابع موادك ومحاضراتك وتاسكاتك في مكان واحد."}</p><div className="welcome-actions"><button className="btn btn-white" onClick={() => jump(isAcademicAdmin ? "admin" : isScopeAdmin ? "scope" : "courses")}>{isAcademicAdmin ? "إدارة المنظومة" : isScopeAdmin ? "إدارة الجروب / السكشن" : "موادي الدراسية"} <ArrowLeft size={16} /></button><button className="btn btn-ghost-light" onClick={() => { setGuideStep(0); setGuideOpen(true); }}><CircleHelp size={16} /> جولة تعريفية</button></div></div>
                <div className="banner-art"><span className="art-circle art-circle-one" /><span className="art-circle art-circle-two" /><div className="art-board"><GraduationCap size={42} /><span>BeVo</span><small>Learn · Organize · Achieve</small></div></div>
              </section>
              {!allRoles.length ? <Panel title="تفعيل مدير المنصة" subtitle="إن كنت المسؤول الأول عن المنصة، أدخل رمز التهيئة بعد تأكيد بريدك الإلكتروني." icon={<ShieldCheck size={18} />}><form className="inline-form" onSubmit={claimFirstAdmin}><InputField label="رمز التهيئة"><input value={claimToken} onChange={(e) => setClaimToken(e.target.value)} required type="password" /></InputField><button className="btn btn-primary" disabled={busy} type="submit">تفعيل Super Admin</button></form></Panel> : null}
              <div className="stats-grid">
                <div className="stat-card"><span className="stat-icon stat-blue"><BookOpen size={20} /></span><div><small>{isAdmin ? "المواد المتاحة في نطاقك" : "موادي الدراسية"}</small><strong>{isAdmin ? data.offerings.length : mySelections.length}</strong><span>{isAdmin ? "ربط أكاديمي" : "مادة مسجلة"}</span></div></div>
                <div className="stat-card"><span className="stat-icon stat-violet"><ClipboardList size={20} /></span><div><small>المهام المفتوحة</small><strong>{data.tasks.filter((task) => task.is_published).length}</strong><span>تاسك وتكليف</span></div></div>
                <div className="stat-card"><span className="stat-icon stat-amber"><Bell size={20} /></span><div><small>إشعارات غير مقروءة</small><strong>{data.notifications.filter((notification) => !notification.read_at).length}</strong><span>تحديث جديد</span></div></div>
                <div className="stat-card"><span className="stat-icon stat-green"><Users size={20} /></span><div><small>{isAdmin ? "طلبات معلقة" : "حالة التسجيل"}</small><strong>{isAdmin ? data.requests.filter((request) => request.status === "pending").length : hasRegistration ? "✓" : "—"}</strong><span>{isAdmin ? "تحتاج مراجعة" : hasRegistration ? "تم حفظ المواد" : "لم يتم التسجيل بعد"}</span></div></div>
              </div>
              <div className="content-grid two-col">
                <Panel title="المواعيد والمهام القادمة" subtitle="المهام المنشورة المرتبطة بموادك." icon={<CalendarDays size={18} />} action={<button className="text-button" onClick={() => jump("tasks")}>عرض الكل <ArrowLeft size={14} /></button>}>
                  {data.tasks.filter((task) => task.is_published).slice(0, 4).length ? <div className="compact-list">{data.tasks.filter((task) => task.is_published).slice(0, 4).map((task) => <div className="compact-row" key={task.id}><span className="list-icon"><ClipboardList size={17} /></span><div className="compact-main"><strong>{task.title}</strong><small>{currentCourseName(task.offering_id)} · {task.due_at ? new Date(task.due_at).toLocaleDateString("ar-EG") : "بدون موعد محدد"}</small></div><span className={`status-pill ${task.is_published ? "status-published" : ""}`}>{task.task_type === "quiz" ? "كويز" : task.task_type === "assignment" ? "واجب" : "مهمة"}</span></div>)}</div> : <EmptyState title="لا توجد مواعيد قريبة" detail="المهام المنشورة ستظهر هنا." />}
                </Panel>
                <Panel title="اختصارات سريعة" subtitle="انتقل مباشرة للقسم الذي تحتاجه." icon={<Sparkles size={18} />}>
                  <div className="quick-grid">
                    <button onClick={() => jump("courses")}><span className="quick-icon q-blue"><BookOpen size={19} /></span><strong>المواد والمحاضرات</strong><small>التسجيل والمواعيد</small></button>
                    {isScopeAdmin ? <button onClick={() => jump("scope")}><span className="quick-icon q-violet"><Layers size={19} /></span><strong>الجروبات والسكاشن</strong><small>القاعة واسم المعيد</small></button> : null}
                    {isAcademicAdmin ? <button onClick={() => jump("admin")}><span className="quick-icon q-green"><Settings size={19} /></span><strong>إدارة المنظومة</strong><small>السنوات والمواد</small></button> : null}
                    <button onClick={() => jump("notifications")}><span className="quick-icon q-amber"><Bell size={19} /></span><strong>الإشعارات</strong><small>آخر المستجدات</small></button>
                  </div>
                </Panel>
              </div>
              {isRoot || isCollegeAdmin ? <Panel title="حالة المنظومة" subtitle="ملخص سريع لما تم تسجيله." icon={<ShieldCheck size={18} />}><div className="summary-strip"><div><small>الكليات</small><strong>{data.colleges.length}</strong></div><div><small>الأعوام</small><strong>{data.years.length}</strong></div><div><small>الفرق</small><strong>{data.levels.length}</strong></div><div><small>المواد</small><strong>{data.courses.length}</strong></div><div><small>الجروبات والسكاشن</small><strong>{data.groups.length}</strong></div></div></Panel> : null}
            </>
          ) : null}

          {activeSection === "courses" ? (
            <div className="stack-lg">
              <div className="page-heading"><div><span className="eyebrow"><BookOpen size={14} /> موادك الدراسية</span><h1>المواد والمحاضرات</h1><p>{isAdmin ? "راجع ربط المواد ومواعيد المحاضرات والسكاشن المتاحة في نطاقك." : "اختار المادة والمحاضرة والسكشن إذا كانت المادة تتطلب سكاشن."}</p></div><button className="btn btn-outline" onClick={refresh} disabled={busy}><RefreshCw size={16} /> تحديث</button></div>
              {!profile?.college_id ? <EmptyState title="أكمل بياناتك الأكاديمية أولًا" detail="لازم تربط حسابك بالكلية والفرقة قبل عرض المواد." /> : null}
              {isAdmin ? <AdminCourseCatalog data={data} isRoot={isRoot} isCollegeAdmin={isCollegeAdmin} busy={busy} notify={notify} refresh={refresh} /> : (
                <>
                  <Panel title={hasRegistration ? "تعديل التسجيل عبر طلب" : "تسجيل المواد"} subtitle={hasRegistration ? "التسجيل المحفوظ لا يتغير مباشرة؛ أرسل طلب تعديل وانتظر موافقة الأدمن." : "اختار المحاضرة والسكشن لكل مادة ترغب في تسجيلها."} icon={<BookMarked size={18} />}>
                    {studentOfferings.length ? <div className="course-selection-list">{studentOfferings.map((offering) => {
                      const meta = currentOfferingMeta(offering);
                      const lectures = data.lectures.filter((lecture) => lecture.offering_id === offering.id && lecture.is_active);
                      const groups = getGroupsForOffering(offering.id);
                      const choice = selectedChoices[offering.id] || { lectureId: "", groupId: "" };
                      return <div className="course-select-card" key={offering.id}>
                        <div className="course-card-top"><span className="course-badge">{meta.course?.code || "COURSE"}</span><span className="credits-tag">{meta.course?.credits ?? 0} ساعات</span></div>
                        <h3>{meta.course?.name || "مادة"}</h3><p className="course-meta">{meta.year?.label || "عام أكاديمي"} · {meta.level?.name || "الفرقة"} · {meta.term?.name || "الترم"}</p>
                        <div className="grid-two selection-fields">
                          <InputField label="المحاضرة"><select value={choice.lectureId} onChange={(e) => setSelectedChoices({ ...selectedChoices, [offering.id]: { ...choice, lectureId: e.target.value } })}><option value="">اختر المحاضرة</option>{lectures.map((lecture) => <option key={lecture.id} value={lecture.id}>{lecture.label} · {lecture.instructor_name || "غير محدد"} · {lecture.room || "بدون قاعة"}</option>)}</select></InputField>
                          {offering.requires_section ? <InputField label="السكشن / الجروب"><select value={choice.groupId} onChange={(e) => setSelectedChoices({ ...selectedChoices, [offering.id]: { ...choice, groupId: e.target.value } })}><option value="">اختر السكشن أو الجروب</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.code} · {group.name} · {DAYS[group.day_of_week ?? 0]} {timeLabel(group.starts_at)}</option>)}</select></InputField> : <div className="no-section"><CheckCircle2 size={17} /> هذه المادة لا تتطلب سكشنًا</div>}
                        </div>
                        {lectures.length === 0 ? <p className="helper-warning"><AlertCircle size={15} /> لم تتم إضافة مواعيد للمحاضرات لهذه المادة بعد.</p> : null}
                      </div>;
                    })}</div> : <EmptyState title={selectedYearIds.length === 0 ? "لا يوجد عام أكاديمي حالي ومفعّل" : "لم يتم ربط مواد بالكلية والفرقة بعد"} detail={selectedYearIds.length === 0 ? "التسجيل متاح بعد تفعيل عام أكاديمي حالي للكلية." : "ستظهر المواد هنا بعد أن يربطها الأدمن بالعام الأكاديمي والترم."} />}
                    {studentOfferings.length ? <div className="form-actions"><span className="muted small-text">{Object.values(selectedChoices).filter((choice) => choice.lectureId).length} اختيار محدد</span><button className="btn btn-primary" disabled={busy || (hasRegistration && pendingMyRequest)} onClick={saveRegistration}>{busy ? "جاري الحفظ…" : pendingMyRequest ? "طلبك قيد المراجعة" : hasRegistration ? "إرسال طلب التعديل" : "حفظ التسجيل"} <ArrowLeft size={17} /></button></div> : null}
                    {hasRegistration && selectedChoices && <InputField label="سبب تعديل التسجيل" hint="مطلوب 5 أحرف على الأقل لإرسال طلب التعديل."><textarea rows={2} value={changeReason} onChange={(e) => setChangeReason(e.target.value)} placeholder="اكتب سبب طلب التعديل…" /></InputField>}
                    {pendingMyRequest ? <div className="inline-notice"><Clock3 size={16} /> لديك طلب تعديل قيد المراجعة.</div> : null}
                  </Panel>
                  <Panel title="تسجيلك الحالي" subtitle="اختيارات المحاضرات والسكاشن المحفوظة." icon={<CheckCircle2 size={18} />}>
                    {mySelections.length ? <div className="table-wrap"><table><thead><tr><th>المادة</th><th>المحاضرة</th><th>الجروب / السكشن</th><th>الموعد</th></tr></thead><tbody>{mySelections.map((selection) => {
                      const lecture = byId(data.lectures, selection.lecture_option_id);
                      const group = byId(data.groups, selection.course_group_id);
                      return <tr key={selection.id}><td>{currentCourseName(selection.offering_id)}</td><td>{lecture?.label || "غير محدد"}</td><td>{group?.code || "بدون سكشن"}</td><td>{lecture ? `${DAYS[lecture.day_of_week ?? 0]} ${timeLabel(lecture.starts_at)}` : "غير محدد"}</td></tr>;
                    })}</tbody></table></div> : <EmptyState title="لم تحفظ موادك بعد" detail="اختار المواد والمحاضرات من الأعلى لإتمام التسجيل." />}
                  </Panel>
                </>
              )}
            </div>
          ) : null}

          {activeSection === "admin" ? <AcademicAdmin
            data={data} currentUserId={currentUserId} isRoot={isRoot} isCollegeAdmin={isCollegeAdmin}
            isYearAdmin={isYearAdmin && !isRoot && !isCollegeAdmin}
            busy={busy} collegeForm={collegeForm} setCollegeForm={setCollegeForm} yearForm={yearForm} setYearForm={setYearForm}
            levelForm={levelForm} setLevelForm={setLevelForm} termForm={termForm} setTermForm={setTermForm}
            courseForm={courseForm} setCourseForm={setCourseForm} offeringForm={offeringForm} setOfferingForm={setOfferingForm}
            lectureForm={lectureForm} setLectureForm={setLectureForm} defaultForm={defaultForm} setDefaultForm={setDefaultForm}
            addCollege={addCollege} addAcademicYear={addAcademicYear} addLevel={addLevel} addTerm={addTerm}
            addCourse={addCourse} addOffering={addOffering} addLecture={addLecture} assignDefault={assignDefault} refresh={refresh} notify={notify}
          /> : null}

          {activeSection === "scope" ? (
            <div className="stack-lg">
              <div className="page-heading"><div><span className="eyebrow"><Layers size={14} /> نطاقك فقط</span><h1>إدارة الجروب / السكشن</h1><p>كل مسؤول يرى الجروبات أو السكاشن المعيّنة له فقط، ويقدر يحدّث الوقت والقاعة واسم المعيد.</p></div><button className="btn btn-outline" onClick={refresh}><RefreshCw size={16} /> تحديث</button></div>
              {myDefaults.length ? <Panel title="إضافة مادة لنطاقك" subtitle="المادة الجديدة ترتبط بالكلية والعام والفرقة والسكشن المخصص لك." icon={<Plus size={18} />}>
                <form className="form-grid" onSubmit={addSubject}>
                  <InputField label="الجروب / السكشن"><select required value={addSubjectForm.defaultId} onChange={(e) => setAddSubjectForm({ ...addSubjectForm, defaultId: e.target.value, courseId: "", termId: "" })}><option value="">اختر النطاق</option>{myDefaults.map((row) => <option key={row.id} value={row.id}>{row.group_code} · {ROLE_LABELS[row.role] || row.role} · {byId(data.years, row.academic_year_id)?.label || ""}</option>)}</select></InputField>
                  <InputField label="المادة"><select required value={addSubjectForm.courseId} onChange={(e) => setAddSubjectForm({ ...addSubjectForm, courseId: e.target.value })}><option value="">اختر المادة</option>{data.courses.filter((course) => {const roleDefault = myDefaults.find((row) => row.id === addSubjectForm.defaultId);return course.is_active && (!roleDefault || course.college_id === roleDefault.college_id);}).map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}</select></InputField>
                  <InputField label="الترم"><select required value={addSubjectForm.termId} onChange={(e) => setAddSubjectForm({ ...addSubjectForm, termId: e.target.value })}><option value="">اختر الترم</option>{data.terms.filter((term) => {const roleDefault = myDefaults.find((row) => row.id === addSubjectForm.defaultId);return term.is_active && (!roleDefault || term.academic_year_id === roleDefault.academic_year_id);}).map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select></InputField>
                  <InputField label="اسم الجروب / السكشن"><input value={addSubjectForm.groupName} onChange={(e) => setAddSubjectForm({ ...addSubjectForm, groupName: e.target.value })} placeholder="مثال: A أو a1" /></InputField>
                  <InputField label="اليوم"><select value={addSubjectForm.day} onChange={(e) => setAddSubjectForm({ ...addSubjectForm, day: e.target.value })}>{DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></InputField>
                  <InputField label="من"><input type="time" required value={addSubjectForm.start} onChange={(e) => setAddSubjectForm({ ...addSubjectForm, start: e.target.value })} /></InputField>
                  <InputField label="إلى"><input type="time" required value={addSubjectForm.end} onChange={(e) => setAddSubjectForm({ ...addSubjectForm, end: e.target.value })} /></InputField>
                  <InputField label="اسم المعيد"><input value={addSubjectForm.assistantName} onChange={(e) => setAddSubjectForm({ ...addSubjectForm, assistantName: e.target.value })} /></InputField>
                  <InputField label="القاعة / المعمل"><input value={addSubjectForm.room} onChange={(e) => setAddSubjectForm({ ...addSubjectForm, room: e.target.value })} /></InputField>
                  <InputField label="السعة"><input type="number" min="1" value={addSubjectForm.capacity} onChange={(e) => setAddSubjectForm({ ...addSubjectForm, capacity: e.target.value })} /></InputField>
                  <div className="form-submit"><button className="btn btn-primary" type="submit" disabled={busy}>إضافة المادة للنطاق <Plus size={16} /></button></div>
                </form>
              </Panel> : null}
              <Panel title="الجروبات والسكاشن المعيّنة لك" subtitle="التعديل محصور على السجلات التي يرجعها نظام الصلاحيات من قاعدة البيانات." icon={<Layers size={18} />}>
                {data.scopedGroups.length ? <div className="workspace-groups">{data.scopedGroups.map((group) => {
                  const code = String(group.code || "");
                  const edit = groupEdits[group.id] || {
                    day: String(group.day_of_week ?? 0), start: timeLabel(group.starts_at) === "غير محدد" ? "09:00" : timeLabel(group.starts_at),
                    end: timeLabel(group.ends_at) === "غير محدد" ? "10:30" : timeLabel(group.ends_at),
                    assistant: group.assistant_name || "", room: group.room || "", capacity: group.capacity ? String(group.capacity) : "",
                  };
                  const setEdit = (key: string, value: string) => setGroupEdits((prev) => ({ ...prev, [group.id]: { ...edit, [key]: value } }));
                  return <article key={group.id} className="workspace-card"><div className="workspace-card-title"><div><span className={`group-code ${isGroupCode(code) ? "group-code-main" : "group-code-section"}`}>{code}</span><h3>{group.course_name || currentCourseName(group.offering_id)}</h3><small>{group.course_code || ""} · {byId(data.years, group.academic_year_id)?.label || ""} · {byId(data.levels, group.study_level_id)?.name || ""}</small></div><span className={`status-pill ${group.is_active ? "status-published" : ""}`}>{group.is_active ? "مفعّل" : "غير منشور"}</span></div>
                    <div className="form-grid group-edit-grid">
                      <InputField label="اليوم"><select value={edit.day} onChange={(e) => setEdit("day", e.target.value)}>{DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></InputField>
                      <InputField label="من"><input type="time" value={edit.start} onChange={(e) => setEdit("start", e.target.value)} /></InputField>
                      <InputField label="إلى"><input type="time" value={edit.end} onChange={(e) => setEdit("end", e.target.value)} /></InputField>
                      <InputField label="اسم المعيد"><input value={edit.assistant} onChange={(e) => setEdit("assistant", e.target.value)} /></InputField>
                      <InputField label="القاعة / المعمل"><input value={edit.room} onChange={(e) => setEdit("room", e.target.value)} /></InputField>
                      <InputField label="السعة"><input type="number" min="1" value={edit.capacity} onChange={(e) => setEdit("capacity", e.target.value)} /></InputField>
                    </div>
                    <div className="form-actions end"><button className="btn btn-primary" disabled={busy} onClick={() => saveGroup(group)}><Save size={15} /> حفظ التعديلات</button></div>
                  </article>;
                })}</div> : <EmptyState title="لا توجد جروبات أو سكاشن في نطاقك حاليًا" detail="اطلب من أدمن الكلية تعيينك على الجروب أو السكشن الصحيح. لن تظهر لك بيانات نطاقات الآخرين." />}
              </Panel>
            </div>
          ) : null}

          {activeSection === "tasks" ? (
            <div className="stack-lg"><div className="page-heading"><div><span className="eyebrow"><ClipboardList size={14} /> التكليفات</span><h1>المهام والتكليفات</h1><p>تابع المهام المنشورة، أو أضف مهمة داخل النطاق الذي تديره.</p></div></div>
              {isAdmin ? <Panel title="إضافة مهمة" subtitle="المهام لا تظهر للطلاب إلا بعد نشرها." icon={<Plus size={18} />}><form className="form-grid" onSubmit={addTask}>
                <InputField label="المادة"><select required value={taskForm.offeringId} onChange={(e) => setTaskForm({ ...taskForm, offeringId: e.target.value, groupId: "" })}><option value="">اختر المادة</option>{data.offerings.filter((row) => row.is_active).map((row) => <option key={row.id} value={row.id}>{currentCourseName(row.id)} · {byId(data.years, row.academic_year_id)?.label || ""}</option>)}</select></InputField>
                <InputField label="الجروب / السكشن (اختياري)"><select value={taskForm.groupId} onChange={(e) => setTaskForm({ ...taskForm, groupId: e.target.value })}><option value="">كل طلاب المادة</option>{getGroupsForOffering(taskForm.offeringId).map((group) => <option key={group.id} value={group.id}>{group.code} · {group.name}</option>)}</select></InputField>
                <InputField label="نوع المهمة"><select value={taskForm.type} onChange={(e) => setTaskForm({ ...taskForm, type: e.target.value })}><option value="task">تاسك</option><option value="lecture_task">تاسك محاضرة</option><option value="quiz">كويز</option><option value="assignment">واجب</option><option value="lecture">محاضرة</option></select></InputField>
                <InputField label="العنوان"><input required value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} /></InputField>
                <InputField label="آخر موعد"><input type="datetime-local" value={taskForm.dueAt} onChange={(e) => setTaskForm({ ...taskForm, dueAt: e.target.value })} /></InputField>
                <InputField label="التذكير قبل الموعد (دقيقة)"><select value={taskForm.reminder} onChange={(e) => setTaskForm({ ...taskForm, reminder: e.target.value })}><option value="15">15 دقيقة</option><option value="30">30 دقيقة</option><option value="60">ساعة</option><option value="1440">يوم</option></select></InputField>
                <InputField label="الوصف"><textarea rows={3} value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} /></InputField>
                <div className="form-submit check-submit"><label className="check-line"><input type="checkbox" checked={taskForm.published} onChange={(e) => setTaskForm({ ...taskForm, published: e.target.checked })} /> نشر المهمة للطلاب</label><button className="btn btn-primary" disabled={busy} type="submit">حفظ المهمة <Plus size={16} /></button></div>
              </form></Panel> : null}
              <Panel title="المهام المنشورة" subtitle="المحتوى الذي تسمح به صلاحيات حسابك." icon={<ClipboardList size={18} />}>
                {data.tasks.filter((task) => isAdmin ? true : task.is_published).length ? <div className="task-grid">{data.tasks.filter((task) => isAdmin ? true : task.is_published).sort((a,b) => String(a.due_at || "").localeCompare(String(b.due_at || ""))).map((task) => <article className="task-card" key={task.id}><div className="task-card-top"><span className="task-type">{task.task_type === "quiz" ? "كويز" : task.task_type === "assignment" ? "واجب" : task.task_type === "lecture" ? "محاضرة" : "تاسك"}</span><span className={`status-pill ${task.is_published ? "status-published" : ""}`}>{task.is_published ? "منشورة" : "مسودة"}</span></div><h3>{task.title}</h3><p>{task.description || "لا يوجد وصف إضافي."}</p><div className="task-meta"><span><BookOpen size={14} /> {currentCourseName(task.offering_id)}</span><span><Clock3 size={14} /> {task.due_at ? new Date(task.due_at).toLocaleString("ar-EG") : "بدون موعد"}</span></div></article>)}</div> : <EmptyState title="لا توجد مهام ظاهرة" detail="المهام المنشورة والمرتبطة بموادك ستظهر هنا." />}
              </Panel>
            </div>
          ) : null}

          {activeSection === "resources" ? (
            <div className="stack-lg"><div className="page-heading"><div><span className="eyebrow"><FileText size={14} /> ملفات الشرح</span><h1>المصادر التعليمية</h1><p>روابط Drive وفيديوهات الشرح وقوائم التشغيل المرتبطة بالمواد أو السكاشن.</p></div></div>
              {isAdmin ? <Panel title="إضافة مصدر تعليمي" subtitle="استخدم روابط HTTPS صالحة فقط." icon={<Plus size={18} />}><form className="form-grid" onSubmit={addResource}>
                <InputField label="المادة"><select required value={resourceForm.offeringId} onChange={(e) => setResourceForm({ ...resourceForm, offeringId: e.target.value, groupId: "" })}><option value="">اختر المادة</option>{data.offerings.filter((row) => row.is_active).map((row) => <option key={row.id} value={row.id}>{currentCourseName(row.id)}</option>)}</select></InputField>
                <InputField label="النطاق"><select value={resourceForm.groupId} onChange={(e) => setResourceForm({ ...resourceForm, groupId: e.target.value })}><option value="">كل طلاب المادة</option>{getGroupsForOffering(resourceForm.offeringId).map((group) => <option key={group.id} value={group.id}>{group.code} · {group.name}</option>)}</select></InputField>
                <InputField label="عنوان المصدر"><input required value={resourceForm.title} onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })} /></InputField>
                <InputField label="وصف مختصر"><input value={resourceForm.description} onChange={(e) => setResourceForm({ ...resourceForm, description: e.target.value })} /></InputField>
                <InputField label="رابط ملف Drive"><input type="url" placeholder="https://drive.google.com/…" value={resourceForm.driveUrl} onChange={(e) => setResourceForm({ ...resourceForm, driveUrl: e.target.value })} /></InputField>
                <InputField label="رابط فيديو YouTube"><input type="url" placeholder="https://youtube.com/…" value={resourceForm.youtubeUrl} onChange={(e) => setResourceForm({ ...resourceForm, youtubeUrl: e.target.value })} /></InputField>
                <InputField label="رابط Playlist"><input type="url" placeholder="https://youtube.com/playlist?…" value={resourceForm.playlistUrl} onChange={(e) => setResourceForm({ ...resourceForm, playlistUrl: e.target.value })} /></InputField>
                <div className="form-submit check-submit"><label className="check-line"><input type="checkbox" checked={resourceForm.published} onChange={(e) => setResourceForm({ ...resourceForm, published: e.target.checked })} /> نشر المصدر وإرسال إشعار</label><button className="btn btn-primary" disabled={busy} type="submit">إضافة المصدر <Plus size={16} /></button></div>
              </form></Panel> : null}
              <Panel title="مصادر المواد" subtitle="المصادر المنشورة المسموح لك بمشاهدتها." icon={<FileText size={18} />}>
                {data.resources.filter((resource) => isAdmin ? true : resource.is_published).length ? <div className="resource-grid">{data.resources.filter((resource) => isAdmin ? true : resource.is_published).map((resource) => <article className="resource-card" key={resource.id}><div className="resource-icon"><FileText size={20} /></div><div className="resource-main"><h3>{resource.title}</h3><p>{resource.description || currentCourseName(resource.offering_id)}</p><div className="resource-links">{resource.drive_url ? <a href={resource.drive_url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> ملف Drive</a> : null}{resource.youtube_url ? <a href={resource.youtube_url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> فيديو الشرح</a> : null}{resource.playlist_url ? <a href={resource.playlist_url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> قائمة التشغيل</a> : null}</div></div><span className={`status-pill ${resource.is_published ? "status-published" : ""}`}>{resource.is_published ? "منشور" : "مسودة"}</span></article>)}</div> : <EmptyState title="لا توجد مصادر منشورة لهذه المواد بعد" detail="عند نشر ملف أو فيديو، سيظهر لك هنا وفق صلاحياتك." />}
              </Panel>
            </div>
          ) : null}

          {activeSection === "requests" ? (
            <Panel title="طلبات التغيير" subtitle={isAdmin ? "راجع طلبات التسجيل ضمن نطاق مسؤوليتك." : "تابع حالة طلبات تغيير التسجيل التي أرسلتها."} icon={<RefreshCw size={18} />}>
              {data.requests.filter((request) => isAdmin ? true : request.student_id === currentUserId).length ? <div className="request-list">{data.requests.filter((request) => isAdmin ? true : request.student_id === currentUserId).map((request) => <article className="request-card" key={request.id}><div className="request-top"><div><strong>طلب تعديل التسجيل</strong><small>{new Date(request.created_at).toLocaleString("ar-EG")}</small></div><span className={`status-pill ${request.status === "approved" ? "status-published" : request.status === "rejected" ? "status-rejected" : "status-pending"}`}>{request.status === "approved" ? "تمت الموافقة" : request.status === "rejected" ? "مرفوض" : "قيد المراجعة"}</span></div><p>{request.reason}</p>{Array.isArray(request.requested_choices) ? <div className="request-choice-chips">{request.requested_choices.map((choice: Row, index: number) => <span key={`${request.id}-${index}`}>{currentCourseName(choice.offering_id)}</span>)}</div> : null}{isAdmin && request.status === "pending" ? <div className="request-review"><InputField label="ملاحظة للأدمن / الطالب"><input value={requestNotes[request.id] || ""} onChange={(e) => setRequestNotes({ ...requestNotes, [request.id]: e.target.value })} placeholder="ملاحظة (اختياري)" /></InputField><button className="btn btn-primary" disabled={savingRequest === request.id} onClick={() => reviewRequest(request.id, true)}><Check size={15} /> موافقة</button><button className="btn btn-danger-outline" disabled={savingRequest === request.id} onClick={() => reviewRequest(request.id, false)}><X size={15} /> رفض</button></div> : null}</article>)}</div> : <EmptyState title="لا توجد طلبات" detail="أي طلب تعديل جديد سيظهر هنا." />}
            </Panel>
          ) : null}

          {activeSection === "notifications" ? (
            <Panel title="الإشعارات" subtitle="تظهر الإشعارات الخاصة بحسابك فقط." icon={<Bell size={18} />} action={<button className="btn btn-outline btn-small" onClick={refresh}><RefreshCw size={15} /> تحديث</button>}>
              {data.notifications.length ? <div className="notification-list">{data.notifications.slice().sort((a,b) => String(b.created_at).localeCompare(String(a.created_at))).map((notification) => <article key={notification.id} className={`notification-card ${notification.read_at ? "" : "notification-unread"}`}><span className="notification-icon"><Bell size={17} /></span><div className="notification-body"><strong>{notification.title}</strong><p>{notification.body || ""}</p><small>{new Date(notification.created_at).toLocaleString("ar-EG")}</small></div>{!notification.read_at ? <button className="btn btn-outline btn-small" onClick={() => markNotificationRead(notification.id)}>تعليم كمقروء</button> : <span className="read-label"><Check size={14} /> مقروء</span>}</article>)}</div> : <EmptyState title="لا توجد إشعارات" detail="ستظهر المستجدات التي تخص حسابك هنا." />}
            </Panel>
          ) : null}

          {activeSection === "users" ? (
            <div className="stack-lg">
              <Panel title="المستخدمون والصلاحيات" subtitle="البيانات التي تظهر هنا محكومة بصلاحيات قاعدة البيانات." icon={<Users size={18} />}>
                <div className="search-box"><Search size={17} /><input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="بحث بالاسم أو البريد أو الرقم الجامعي…" /></div>
                {data.profiles.filter((row) => row.id !== currentUserId && [fullName(row), row.email, row.student_id].some((value) => String(value || "").toLowerCase().includes(searchText.toLowerCase()))).length ? <div className="table-wrap"><table><thead><tr><th>الاسم</th><th>البريد</th><th>الرقم الجامعي</th><th>الكلية</th><th>حالة الحساب</th></tr></thead><tbody>{data.profiles.filter((row) => row.id !== currentUserId && [fullName(row), row.email, row.student_id].some((value) => String(value || "").toLowerCase().includes(searchText.toLowerCase()))).map((row) => <tr key={row.id}><td><strong>{fullName(row)}</strong></td><td>{row.email || "—"}</td><td>{row.student_id || "—"}</td><td>{byId(data.colleges, row.college_id)?.name || "—"}</td><td><span className="status-pill status-published">{row.account_status || "active"}</span></td></tr>)}</tbody></table></div> : <EmptyState title="لا يوجد مستخدمون مطابقون" detail="قد يكون الحساب جديدًا أو خارج نطاق صلاحيتك." />}
              </Panel>
              {isRoot ? <Panel title="إسناد دور إداري عام" subtitle="تعيين الأدوار العامة متاح لمدير المنصة فقط؛ الجروبات والسكاشن لها تعيين منفصل." icon={<UserCog size={18} />}><form className="form-grid" onSubmit={assignGeneralRole}>
                <InputField label="المستخدم"><select required value={generalRoleForm.userId} onChange={(e) => setGeneralRoleForm({ ...generalRoleForm, userId: e.target.value })}><option value="">اختر الحساب</option>{data.profiles.map((row) => <option key={row.id} value={row.id}>{fullName(row)} · {row.email || row.student_id || row.id.slice(0, 8)}</option>)}</select></InputField>
                <InputField label="الدور"><select value={generalRoleForm.role} onChange={(e) => setGeneralRoleForm({ ...generalRoleForm, role: e.target.value })}><option value="college_admin">أدمن الكلية</option><option value="year_admin">أدمن السنة</option><option value="instructor">دكتور / معيد</option></select></InputField>
                <InputField label="الكلية"><select required={generalRoleForm.role === "year_admin"} value={generalRoleForm.collegeId} onChange={(e) => setGeneralRoleForm({ ...generalRoleForm, collegeId: e.target.value, yearId: "", levelId: "" })}><option value="">كل الكليات (عند السماح)</option>{data.colleges.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></InputField>
                <InputField label="العام"><select required={generalRoleForm.role === "year_admin"} value={generalRoleForm.yearId} onChange={(e) => setGeneralRoleForm({ ...generalRoleForm, yearId: e.target.value })}><option value="">اختر العام {generalRoleForm.role === "year_admin" ? "(مطلوب)" : "(اختياري)"}</option>{data.years.filter((row) => row.is_active && (!generalRoleForm.collegeId || row.college_id === generalRoleForm.collegeId)).map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></InputField>
                <InputField label="الفرقة"><select required={generalRoleForm.role === "year_admin"} value={generalRoleForm.levelId} onChange={(e) => setGeneralRoleForm({ ...generalRoleForm, levelId: e.target.value })}><option value="">اختر الفرقة {generalRoleForm.role === "year_admin" ? "(مطلوب)" : "(اختياري)"}</option>{data.levels.filter((row) => row.is_active && (!generalRoleForm.collegeId || row.college_id === generalRoleForm.collegeId)).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></InputField>
                <div className="form-submit"><button className="btn btn-primary" disabled={busy} type="submit">إسناد الدور <Plus size={16} /></button></div>
              </form></Panel> : null}
            </div>
          ) : null}

          {activeSection === "profile" ? (
            <div className="stack-lg">
              <Panel title="بياناتي" subtitle="ملخص الحساب الأكاديمي الحالي." icon={<UserRound size={18} />}>
                <div className="profile-summary"><span className="profile-big-avatar">{(profile?.first_name || user?.email || "B").slice(0, 1).toUpperCase()}</span><div><h2>{fullName(profile)}</h2><p>{user?.email}</p><div className="role-pills">{allRoles.length ? allRoles.map((role) => <span key={role} className="role-pill">{ROLE_LABELS[role] || role}</span>) : <span className="role-pill">طالب</span>}</div></div></div>
                <div className="profile-data-grid"><div><small>الرقم الجامعي</small><strong>{profile?.student_id || "غير مسجل"}</strong></div><div><small>الكلية</small><strong>{byId(data.colleges, profile?.college_id)?.name || "غير محددة"}</strong></div><div><small>الفرقة</small><strong>{byId(data.levels, profile?.study_level_id)?.name || "غير محددة"}</strong></div><div><small>سنة الالتحاق</small><strong>{profile?.enrollment_year || "—"}</strong></div><div><small>البريد الإلكتروني</small><strong>{profile?.email || user?.email || "—"}</strong></div><div><small>حالة الحساب</small><strong>{profile?.account_status || "active"}</strong></div></div>
              </Panel>
              <Panel title="الأمان" subtitle="استخدم تسجيل الخروج على الأجهزة المشتركة." icon={<ShieldCheck size={18} />}><button className="btn btn-danger-outline" onClick={signOut}><LogOut size={16} /> تسجيل الخروج</button></Panel>
            </div>
          ) : null}
        </main>
        <footer className="app-footer"><span>BeVo · البوابة الأكاديمية</span><span>البيانات والصلاحيات تُراجع من قاعدة البيانات</span><button className="text-button" onClick={() => { setGuideStep(0); setGuideOpen(true); }}>مساعد <CircleHelp size={14} /></button></footer>
      </div>
      {guideOpen ? <GuideDialog step={guideStep} setStep={setGuideStep} close={() => setGuideOpen(false)} onNavigate={jump} allowedSections={navItems.map((item) => item.id)} /> : null}
      {notice ? <div className={`toast toast-${notice.tone}`} role="status"><span>{notice.tone === "error" ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}</span>{notice.text}<button onClick={() => setNotice(null)} aria-label="إغلاق"><X size={15} /></button></div> : null}
    </div>
  );
}

function AdminCourseCatalog({ data, isRoot, isCollegeAdmin, busy, notify, refresh }: {
  data: WorkspaceData; isRoot: boolean; isCollegeAdmin: boolean; busy: boolean; notify: (text: string, tone?: "success" | "error" | "info") => void; refresh: () => void;
}) {
  const [courseId, setCourseId] = useState("");
  const [yearId, setYearId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [termId, setTermId] = useState("");
  const [requiresSection, setRequiresSection] = useState(true);
  const [lectureDraft, setLectureDraft] = useState({ offeringId: "", label: "المحاضرة A", day: "0", start: "09:00", end: "10:30", instructorName: "", room: "" });
  const [busyLocal, setBusyLocal] = useState(false);
  async function createOffering(event: FormEvent) {
    event.preventDefault(); setBusyLocal(true);
    try {
      const course = byId(data.courses, courseId);
      if (!course || !yearId || !levelId || !termId) throw new Error("اختر المادة والعام والفرقة والترم.");
      const { error } = await supabase.from("course_offerings").upsert({
        course_id: course.id, college_id: course.college_id, academic_year_id: yearId, study_level_id: levelId,
        term_id: termId, requires_section: requiresSection, is_active: true,
      }, { onConflict: "course_id,academic_year_id,study_level_id,term_id" });
      if (error) throw error;
      notify("تم ربط المادة بالعام والفرقة والترم."); refresh();
    } catch (error) { notify(messageOf(error), "error"); }
    finally { setBusyLocal(false); }
  }
  async function createLecture(event: FormEvent) {
    event.preventDefault(); setBusyLocal(true);
    try {
      if (data.lectures.filter((row) => row.offering_id === lectureDraft.offeringId).length >= 4) throw new Error("الحد الأقصى 4 اختيارات محاضرة.");
      const { error } = await supabase.from("lecture_options").insert({
        offering_id: lectureDraft.offeringId, label: lectureDraft.label.trim(), day_of_week: Number(lectureDraft.day),
        starts_at: lectureDraft.start, ends_at: lectureDraft.end, instructor_name: lectureDraft.instructorName.trim() || null,
        room: lectureDraft.room.trim() || null, is_active: true,
      });
      if (error) throw error;
      notify("تمت إضافة المحاضرة."); refresh();
    } catch (error) { notify(messageOf(error), "error"); }
    finally { setBusyLocal(false); }
  }
  return <div className="stack-lg">
    <div className="page-heading"><div><span className="eyebrow"><Settings size={14} /> صلاحيات الإدارة</span><h1>الإدارة الأكاديمية</h1><p>أضف الكليات والأعوام والفرق والمواد، ثم اربط المواد بالترم والمواعيد.</p></div><button className="btn btn-outline" onClick={refresh}><RefreshCw size={16} /> تحديث</button></div>
    {isRoot ? <Panel title="إضافة كلية" subtitle="الكليات النشطة تظهر في تسجيل الحسابات." icon={<Plus size={18} />}><CollegeCreateForm onCreated={refresh} /></Panel> : null}
    <Panel title="ربط مادة بعام وفرقة وترم" subtitle="يحدد الربط أين تظهر المادة للطلاب، واختيار السكشن مطلوب عند تفعيله." icon={<BookOpen size={18} />}>
      <form className="form-grid" onSubmit={createOffering}>
        <InputField label="الكلية / المادة"><select required value={courseId} onChange={(e) => { setCourseId(e.target.value); setYearId(""); setLevelId(""); }}><option value="">اختر المادة</option>{data.courses.filter((row) => row.is_active).map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></InputField>
        <InputField label="العام الأكاديمي"><select required value={yearId} onChange={(e) => setYearId(e.target.value)}><option value="">اختر العام</option>{data.years.filter((row) => row.is_active && (!courseId || row.college_id === byId(data.courses, courseId)?.college_id)).map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></InputField>
        <InputField label="الفرقة"><select required value={levelId} onChange={(e) => setLevelId(e.target.value)}><option value="">اختر الفرقة</option>{data.levels.filter((row) => row.is_active && (!courseId || row.college_id === byId(data.courses, courseId)?.college_id)).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></InputField>
        <InputField label="الترم"><select required value={termId} onChange={(e) => setTermId(e.target.value)}><option value="">اختر الترم</option>{data.terms.filter((row) => row.is_active && (!yearId || row.academic_year_id === yearId)).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></InputField>
        <div className="form-submit check-submit"><label className="check-line"><input type="checkbox" checked={requiresSection} onChange={(e) => setRequiresSection(e.target.checked)} /> المادة تتطلب سكشن</label><button className="btn btn-primary" disabled={busyLocal || busy} type="submit">حفظ الربط <Check size={16} /></button></div>
      </form>
    </Panel>
    <Panel title="مواعيد المحاضرات" subtitle="لكل مادة حتى 4 اختيارات للمحاضرة." icon={<CalendarDays size={18} />}>
      <form className="form-grid" onSubmit={createLecture}>
        <InputField label="المادة / الفرقة"><select required value={lectureDraft.offeringId} onChange={(e) => setLectureDraft({ ...lectureDraft, offeringId: e.target.value })}><option value="">اختر المادة</option>{data.offerings.filter((row) => row.is_active).map((row) => <option key={row.id} value={row.id}>{currentCourseNameFrom(data, row.id)} · {byId(data.years, row.academic_year_id)?.label || ""} · {byId(data.levels, row.study_level_id)?.name || ""}</option>)}</select></InputField>
        <InputField label="اسم المحاضرة"><input required value={lectureDraft.label} onChange={(e) => setLectureDraft({ ...lectureDraft, label: e.target.value })} /></InputField>
        <InputField label="اليوم"><select value={lectureDraft.day} onChange={(e) => setLectureDraft({ ...lectureDraft, day: e.target.value })}>{DAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}</select></InputField>
        <InputField label="من"><input type="time" required value={lectureDraft.start} onChange={(e) => setLectureDraft({ ...lectureDraft, start: e.target.value })} /></InputField>
        <InputField label="إلى"><input type="time" required value={lectureDraft.end} onChange={(e) => setLectureDraft({ ...lectureDraft, end: e.target.value })} /></InputField>
        <InputField label="اسم الدكتور / المعيد"><input value={lectureDraft.instructorName} onChange={(e) => setLectureDraft({ ...lectureDraft, instructorName: e.target.value })} /></InputField>
        <InputField label="القاعة / المعمل"><input value={lectureDraft.room} onChange={(e) => setLectureDraft({ ...lectureDraft, room: e.target.value })} /></InputField>
        <div className="form-submit"><button className="btn btn-primary" disabled={busyLocal || busy} type="submit">إضافة محاضرة <Plus size={16} /></button></div>
      </form>
    </Panel>
    <Panel title="المواد المسجلة" subtitle="ملخص الربط الأكاديمي الحالي." icon={<Layers size={18} />}>
      {data.offerings.length ? <div className="table-wrap"><table><thead><tr><th>المادة</th><th>العام</th><th>الفرقة</th><th>الترم</th><th>سكاشن</th><th>محاضرات</th></tr></thead><tbody>{data.offerings.map((row) => <tr key={row.id}><td><strong>{currentCourseNameFrom(data, row.id)}</strong><small className="table-sub">{byId(data.courses, row.course_id)?.code}</small></td><td>{byId(data.years, row.academic_year_id)?.label || "—"}</td><td>{byId(data.levels, row.study_level_id)?.name || "—"}</td><td>{byId(data.terms, row.term_id)?.name || "—"}</td><td>{row.requires_section ? "بسكاشن" : "بدون"}</td><td>{data.lectures.filter((lecture) => lecture.offering_id === row.id).length} / 4</td></tr>)}</tbody></table></div> : <EmptyState title="لا توجد مواد مربوطة بعد" detail="أضف مادة من قسم إدارة الكليات ثم اربطها هنا." />}
    </Panel>
  </div>;
}

function currentCourseNameFrom(data: WorkspaceData, offeringId: string) {
  const offering = byId(data.offerings, offeringId);
  return byId(data.courses, offering?.course_id)?.name || "مادة";
}

function CollegeCreateForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setMessage("");
    const { error } = await supabase.from("colleges").insert({ name: name.trim(), code: code.trim().toUpperCase(), is_active: true });
    if (error) setMessage(error.message); else { setName(""); setCode(""); setMessage("تمت إضافة الكلية."); onCreated(); }
    setLoading(false);
  }
  return <form className="inline-form" onSubmit={submit}><InputField label="اسم الكلية"><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="كلية الحاسبات والمعلومات" /></InputField><InputField label="كود الكلية"><input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="CS" /></InputField><button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "جاري الحفظ…" : "إضافة الكلية"} <Plus size={16} /></button>{message ? <span className="form-message">{message}</span> : null}</form>;
}

function YearAdminWorkspace({ data, currentUserId, refresh, notify }: {
  data: WorkspaceData; currentUserId: string; refresh: () => void;
  notify: (text: string, tone?: "success" | "error" | "info") => void;
}) {
  const scopes = data.roles.filter((row) =>
    row.user_id === currentUserId && row.role === "year_admin" && row.is_active &&
    row.college_id && row.academic_year_id && row.study_level_id
  );
  const scopeKey = (row: Row) => `${row.college_id}:${row.academic_year_id}:${row.study_level_id}`;
  const scopeOptions = Array.from(new Map(scopes.map((row) => [scopeKey(row), row])).values());
  const [selectedScopeKey, setSelectedScopeKey] = useState("");
  const scope = scopeOptions.find((row) => scopeKey(row) === selectedScopeKey) || scopeOptions[0];
  const [courseId, setCourseId] = useState("");
  const [termId, setTermId] = useState("");
  const [requiresSection, setRequiresSection] = useState(true);
  const [lectureForm, setLectureForm] = useState({
    offeringId: "", label: "المحاضرة A", day: "0", start: "09:00", end: "10:30",
    instructorName: "", room: "", capacity: "100",
  });
  const [busy, setBusy] = useState(false);
  const scopedOfferings = data.offerings.filter((row) =>
    row.is_active && scope &&
    row.college_id === scope.college_id &&
    row.academic_year_id === scope.academic_year_id &&
    row.study_level_id === scope.study_level_id
  );
  async function createOffering(event: FormEvent) {
    event.preventDefault();
    if (!scope || !courseId || !termId) {
      notify("اختر نطاق السنة والفرقة والمادة والترم.", "error");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("year_admin_create_offering", {
        p_course_id: courseId,
        p_academic_year_id: scope.academic_year_id,
        p_study_level_id: scope.study_level_id,
        p_term_id: termId,
        p_requires_section: requiresSection,
      });
      if (error) throw error;
      setCourseId("");
      setTermId("");
      notify("تم ربط المادة بالنطاق الأكاديمي المعيّن لك.");
      refresh();
    } catch (error) {
      notify(messageOf(error), "error");
    } finally {
      setBusy(false);
    }
  }
  async function createLecture(event: FormEvent) {
    event.preventDefault();
    const offering = byId(scopedOfferings, lectureForm.offeringId);
    if (!offering || !lectureForm.label.trim()) {
      notify("اختر مادة داخل نطاقك واكتب اسم المحاضرة.", "error");
      return;
    }
    if (lectureForm.end <= lectureForm.start) {
      notify("وقت النهاية لازم يكون بعد وقت البداية.", "error");
      return;
    }
    if (data.lectures.filter((row) => row.offering_id === offering.id).length >= 4) {
      notify("الحد الأقصى 4 اختيارات محاضرة لكل مادة.", "error");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("lecture_options").insert({
        offering_id: offering.id,
        label: lectureForm.label.trim(),
        day_of_week: Number(lectureForm.day),
        starts_at: lectureForm.start,
        ends_at: lectureForm.end,
        instructor_name: lectureForm.instructorName.trim() || null,
        room: lectureForm.room.trim() || null,
        capacity: lectureForm.capacity ? Number(lectureForm.capacity) : null,
        is_active: true,
      });
      if (error) throw error;
      setLectureForm({ ...lectureForm, label: "", instructorName: "", room: "", capacity: "" });
      notify("تمت إضافة اختيار المحاضرة.");
      refresh();
    } catch (error) {
      notify(messageOf(error), "error");
    } finally {
      setBusy(false);
    }
  }
  if (!scopeOptions.length) {
    return <div className="stack-lg">
      <div className="page-heading"><div><span className="eyebrow"><ShieldCheck size={14} /> صلاحيات أدمن السنة</span><h1>الإدارة الأكاديمية</h1><p>صلاحيتك مرتبطة بكلية وسنة وفرقة محددة.</p></div><button className="btn btn-outline" onClick={refresh}><RefreshCw size={16} /> تحديث</button></div>
      <EmptyState title="لا يوجد نطاق سنة مكتمل للحساب" detail="اطلب من مدير المنصة إعادة تعيين دور أدمن السنة مع تحديد الكلية والسنة والفرقة." />
    </div>;
  }
  return <div className="stack-lg">
    <div className="page-heading"><div><span className="eyebrow"><ShieldCheck size={14} /> صلاحيات أدمن السنة</span><h1>إدارة مواد السنة والفرقة</h1><p>تقدر تربط المواد الموجودة وتضيف اختيارات المحاضرات داخل النطاق المعيّن لك فقط.</p></div><button className="btn btn-outline" onClick={refresh}><RefreshCw size={16} /> تحديث</button></div>
    {scopeOptions.length > 1 ? <Panel title="النطاق الإداري" subtitle="اختر واحدة من السنوات والفرق المسندة إلى حسابك." icon={<Layers size={18} />}>
      <InputField label="الكلية · العام · الفرقة"><select value={scopeKey(scope)} onChange={(e) => setSelectedScopeKey(e.target.value)}>{scopeOptions.map((row) => <option key={scopeKey(row)} value={scopeKey(row)}>{byId(data.colleges,row.college_id)?.name || "كلية"} · {byId(data.years,row.academic_year_id)?.label || "سنة"} · {byId(data.levels,row.study_level_id)?.name || "فرقة"}</option>)}</select></InputField>
    </Panel> : null}
    <Panel title="ربط مادة بالنطاق" subtitle="يمكنك ربط مادة نشطة من كليتك بالسنة والترم المعيّنين لك." icon={<Plus size={18} />}>
      <form className="form-grid" onSubmit={createOffering}>
        <InputField label="المادة"><select required value={courseId} onChange={(e) => setCourseId(e.target.value)}><option value="">اختر المادة</option>{data.courses.filter((row) => row.is_active && row.college_id === scope.college_id).map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></InputField>
        <InputField label="الترم"><select required value={termId} onChange={(e) => setTermId(e.target.value)}><option value="">اختر الترم</option>{data.terms.filter((row) => row.is_active && row.academic_year_id === scope.academic_year_id).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></InputField>
        <label className="check-line"><input type="checkbox" checked={requiresSection} onChange={(e) => setRequiresSection(e.target.checked)} /> المادة تتطلب سكشن / جروب</label>
        <div className="form-submit"><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "جاري الحفظ…" : "حفظ ربط المادة"} <Plus size={16} /></button></div>
      </form>
    </Panel>
    <Panel title="اختيارات المحاضرات" subtitle="أضف مواعيد محاضرات للمواد التي تديرها." icon={<CalendarDays size={18} />}>
      <form className="form-grid" onSubmit={createLecture}>
        <InputField label="المادة"><select required value={lectureForm.offeringId} onChange={(e) => setLectureForm({ ...lectureForm, offeringId: e.target.value })}><option value="">اختر المادة</option>{scopedOfferings.map((row) => <option key={row.id} value={row.id}>{currentCourseNameFrom(data,row.id)} · {byId(data.terms,row.term_id)?.name || "ترم"}</option>)}</select></InputField>
        <InputField label="اسم اختيار المحاضرة"><input required value={lectureForm.label} onChange={(e) => setLectureForm({ ...lectureForm, label: e.target.value })} /></InputField>
        <InputField label="اليوم"><select value={lectureForm.day} onChange={(e) => setLectureForm({ ...lectureForm, day: e.target.value })}>{DAYS.map((day,index) => <option key={day} value={index}>{day}</option>)}</select></InputField>
        <InputField label="من"><input type="time" required value={lectureForm.start} onChange={(e) => setLectureForm({ ...lectureForm, start: e.target.value })} /></InputField>
        <InputField label="إلى"><input type="time" required value={lectureForm.end} onChange={(e) => setLectureForm({ ...lectureForm, end: e.target.value })} /></InputField>
        <InputField label="اسم الدكتور / المعيد"><input value={lectureForm.instructorName} onChange={(e) => setLectureForm({ ...lectureForm, instructorName: e.target.value })} /></InputField>
        <InputField label="القاعة / المعمل"><input value={lectureForm.room} onChange={(e) => setLectureForm({ ...lectureForm, room: e.target.value })} /></InputField>
        <InputField label="السعة"><input type="number" min="1" value={lectureForm.capacity} onChange={(e) => setLectureForm({ ...lectureForm, capacity: e.target.value })} /></InputField>
        <div className="form-submit"><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "جاري الحفظ…" : "إضافة المحاضرة"} <Plus size={16} /></button></div>
      </form>
    </Panel>
    <Panel title="ملخص النطاق" subtitle="عدادات محدودة بالسنة والفرقة المختارتين." icon={<Activity size={18} />}>
      <div className="summary-strip"><div><small>المواد المرتبطة</small><strong>{scopedOfferings.length}</strong></div><div><small>اختيارات المحاضرات</small><strong>{data.lectures.filter((row) => scopedOfferings.some((offering) => offering.id === row.offering_id)).length}</strong></div><div><small>الجروبات والسكاشن</small><strong>{data.groups.filter((row) => scopedOfferings.some((offering) => offering.id === row.offering_id)).length}</strong></div></div>
    </Panel>
  </div>;
}

function AcademicAdmin({ data, currentUserId, isRoot, isCollegeAdmin, isYearAdmin, busy, collegeForm, setCollegeForm, yearForm, setYearForm,
  levelForm, setLevelForm, termForm, setTermForm, courseForm, setCourseForm, offeringForm, setOfferingForm,
  lectureForm, setLectureForm, defaultForm, setDefaultForm, addCollege, addAcademicYear, addLevel, addTerm,
  addCourse, addOffering, addLecture, assignDefault, refresh, notify,
}: {
  data: WorkspaceData; currentUserId: string; isRoot: boolean; isCollegeAdmin: boolean; isYearAdmin: boolean; busy: boolean;
  collegeForm: { name: string; code: string }; setCollegeForm: (value: { name: string; code: string }) => void;
  yearForm: { collegeId: string; label: string; startsOn: string; endsOn: string; current: boolean }; setYearForm: (value: typeof yearForm) => void;
  levelForm: { collegeId: string; name: string; sortOrder: string }; setLevelForm: (value: typeof levelForm) => void;
  termForm: { yearId: string; name: string; startsOn: string; endsOn: string }; setTermForm: (value: typeof termForm) => void;
  courseForm: { collegeId: string; code: string; name: string; credits: string }; setCourseForm: (value: typeof courseForm) => void;
  offeringForm: { courseId: string; yearId: string; levelId: string; termId: string; requiresSection: boolean }; setOfferingForm: (value: typeof offeringForm) => void;
  lectureForm: { offeringId: string; label: string; day: string; start: string; end: string; instructorName: string; room: string; capacity: string }; setLectureForm: (value: typeof lectureForm) => void;
  defaultForm: { groupId: string; userId: string }; setDefaultForm: (value: typeof defaultForm) => void;
  addCollege: (event: FormEvent) => Promise<void>; addAcademicYear: (event: FormEvent) => Promise<void>; addLevel: (event: FormEvent) => Promise<void>;
  addTerm: (event: FormEvent) => Promise<void>; addCourse: (event: FormEvent) => Promise<void>; addOffering: (event: FormEvent) => Promise<void>;
  addLecture: (event: FormEvent) => Promise<void>; assignDefault: (event: FormEvent) => Promise<void>; refresh: () => void;
  notify: (text: string, tone?: "success" | "error" | "info") => void;
}) {
  const [openPanel, setOpenPanel] = useState("structure");
  if (isYearAdmin && !isRoot && !isCollegeAdmin) {
    return <YearAdminWorkspace data={data} currentUserId={currentUserId} refresh={refresh} notify={notify} />;
  }
  return <div className="stack-lg">
    <div className="page-heading"><div><span className="eyebrow"><ShieldCheck size={14} /> إدارة المنظومة الأكاديمية</span><h1>إدارة الكليات والسنوات والمواد</h1><p>الإجراءات المتاحة تعتمد على الدور والنطاق المعيّن لحسابك.</p></div><button className="btn btn-outline" onClick={refresh}><RefreshCw size={16} /> تحديث</button></div>
    {isRoot ? <Panel title="إضافة كلية" subtitle="تبدأ المنظومة بالكلية، ثم العام الأكاديمي والفرق والمواد." icon={<Plus size={18} />}><form className="form-grid" onSubmit={addCollege}><InputField label="اسم الكلية"><input required value={collegeForm.name} onChange={(e) => setCollegeForm({ ...collegeForm, name: e.target.value })} /></InputField><InputField label="كود الكلية"><input required value={collegeForm.code} onChange={(e) => setCollegeForm({ ...collegeForm, code: e.target.value })} /></InputField><div className="form-submit"><button className="btn btn-primary" disabled={busy} type="submit">إضافة الكلية <Plus size={16} /></button></div></form></Panel> : null}
    {(isRoot || isCollegeAdmin) ? <div className="admin-accordion">
      <button className={`accordion-heading ${openPanel === "structure" ? "accordion-active" : ""}`} onClick={() => setOpenPanel(openPanel === "structure" ? "" : "structure")}><span><CalendarDays size={18} /> السنوات والفرق والفصول</span><ChevronDown size={18} /></button>
      {openPanel === "structure" ? <div className="accordion-body">
        <form className="form-grid" onSubmit={addAcademicYear}><div className="form-section-label">إضافة عام أكاديمي</div>
          <InputField label="الكلية"><select required value={yearForm.collegeId} onChange={(e) => setYearForm({ ...yearForm, collegeId: e.target.value })}><option value="">اختر كلية</option>{data.colleges.filter((row) => row.is_active).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></InputField>
          <InputField label="اسم العام"><input required value={yearForm.label} onChange={(e) => setYearForm({ ...yearForm, label: e.target.value })} /></InputField>
          <InputField label="من"><input type="date" value={yearForm.startsOn} onChange={(e) => setYearForm({ ...yearForm, startsOn: e.target.value })} /></InputField>
          <InputField label="إلى"><input type="date" value={yearForm.endsOn} onChange={(e) => setYearForm({ ...yearForm, endsOn: e.target.value })} /></InputField>
          <div className="form-submit check-submit"><label className="check-line"><input type="checkbox" checked={yearForm.current} onChange={(e) => setYearForm({ ...yearForm, current: e.target.checked })} /> العام الحالي</label><button className="btn btn-primary" disabled={busy} type="submit">إضافة العام <Plus size={15} /></button></div>
        </form>
        <div className="form-divider" />
        <form className="form-grid" onSubmit={addLevel}><div className="form-section-label">إضافة فرقة</div>
          <InputField label="الكلية"><select required value={levelForm.collegeId} onChange={(e) => setLevelForm({ ...levelForm, collegeId: e.target.value })}><option value="">اختر كلية</option>{data.colleges.filter((row) => row.is_active).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></InputField>
          <InputField label="اسم الفرقة"><input required value={levelForm.name} onChange={(e) => setLevelForm({ ...levelForm, name: e.target.value })} /></InputField>
          <InputField label="الترتيب"><input type="number" min="1" value={levelForm.sortOrder} onChange={(e) => setLevelForm({ ...levelForm, sortOrder: e.target.value })} /></InputField>
          <div className="form-submit"><button className="btn btn-outline" disabled={busy} type="submit">إضافة الفرقة <Plus size={15} /></button></div>
        </form>
        <div className="form-divider" />
        <form className="form-grid" onSubmit={addTerm}><div className="form-section-label">إضافة ترم</div>
          <InputField label="العام الأكاديمي"><select required value={termForm.yearId} onChange={(e) => setTermForm({ ...termForm, yearId: e.target.value })}><option value="">اختر العام</option>{data.years.filter((row) => row.is_active).map((row) => <option key={row.id} value={row.id}>{byId(data.colleges, row.college_id)?.name} · {row.label}</option>)}</select></InputField>
          <InputField label="اسم الترم"><select value={termForm.name} onChange={(e) => setTermForm({ ...termForm, name: e.target.value })}><option value="الترم الأول">الترم الأول</option><option value="الترم الثاني">الترم الثاني</option><option value="الفصل الصيفي">الفصل الصيفي</option></select></InputField>
          <InputField label="من"><input type="date" value={termForm.startsOn} onChange={(e) => setTermForm({ ...termForm, startsOn: e.target.value })} /></InputField>
          <InputField label="إلى"><input type="date" value={termForm.endsOn} onChange={(e) => setTermForm({ ...termForm, endsOn: e.target.value })} /></InputField>
          <div className="form-submit"><button className="btn btn-outline" disabled={busy} type="submit">إضافة الترم <Plus size={15} /></button></div>
        </form>
        <div className="mini-data-row"><span>الأعوام الحالية</span><strong>{data.years.length}</strong><span>الفرق</span><strong>{data.levels.length}</strong><span>الفصول</span><strong>{data.terms.length}</strong></div>
      </div> : null}
      <button className={`accordion-heading ${openPanel === "courses" ? "accordion-active" : ""}`} onClick={() => setOpenPanel(openPanel === "courses" ? "" : "courses")}><span><BookOpen size={18} /> تعريف المواد وربطها</span><ChevronDown size={18} /></button>
      {openPanel === "courses" ? <div className="accordion-body">
        <form className="form-grid" onSubmit={addCourse}><div className="form-section-label">1. إنشاء مادة</div>
          <InputField label="الكلية"><select required value={courseForm.collegeId} onChange={(e) => setCourseForm({ ...courseForm, collegeId: e.target.value })}><option value="">اختر كلية</option>{data.colleges.filter((row) => row.is_active).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></InputField>
          <InputField label="اسم المادة"><input required value={courseForm.name} onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} placeholder="مبادئ البرمجة" /></InputField>
          <InputField label="كود المادة"><input required value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} placeholder="CS101" /></InputField>
          <InputField label="الساعات المعتمدة"><input type="number" min="0" step="0.5" value={courseForm.credits} onChange={(e) => setCourseForm({ ...courseForm, credits: e.target.value })} /></InputField>
          <div className="form-submit"><button className="btn btn-primary" disabled={busy} type="submit">إنشاء المادة <Plus size={15} /></button></div>
        </form>
        <div className="form-divider" />
        <form className="form-grid" onSubmit={addOffering}><div className="form-section-label">2. ربط المادة بالعام والفرقة والترم</div>
          <InputField label="المادة"><select required value={offeringForm.courseId} onChange={(e) => setOfferingForm({ ...offeringForm, courseId: e.target.value, yearId: "", levelId: "" })}><option value="">اختر المادة</option>{data.courses.filter((row) => row.is_active && (!offeringForm.courseId || row.college_id === byId(data.courses, offeringForm.courseId)?.college_id)).map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></InputField>
          <InputField label="العام الأكاديمي"><select required value={offeringForm.yearId} onChange={(e) => setOfferingForm({ ...offeringForm, yearId: e.target.value, termId: "" })}><option value="">اختر العام</option>{data.years.filter((row) => row.is_active && (!offeringForm.courseId || row.college_id === byId(data.courses, offeringForm.courseId)?.college_id)).map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></InputField>
          <InputField label="الفرقة"><select required value={offeringForm.levelId} onChange={(e) => setOfferingForm({ ...offeringForm, levelId: e.target.value })}><option value="">اختر الفرقة</option>{data.levels.filter((row) => row.is_active && (!offeringForm.courseId || row.college_id === byId(data.courses, offeringForm.courseId)?.college_id)).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></InputField>
          <InputField label="الترم"><select required value={offeringForm.termId} onChange={(e) => setOfferingForm({ ...offeringForm, termId: e.target.value })}><option value="">اختر الترم</option>{data.terms.filter((row) => row.is_active && (!offeringForm.yearId || row.academic_year_id === offeringForm.yearId)).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></InputField>
          <div className="form-submit check-submit"><label className="check-line"><input type="checkbox" checked={offeringForm.requiresSection} onChange={(e) => setOfferingForm({ ...offeringForm, requiresSection: e.target.checked })} /> المادة تتطلب سكشن</label><button className="btn btn-outline" disabled={busy} type="submit">حفظ الربط <Check size={15} /></button></div>
        </form>
      </div> : null}
      <button className={`accordion-heading ${openPanel === "schedule" ? "accordion-active" : ""}`} onClick={() => setOpenPanel(openPanel === "schedule" ? "" : "schedule")}><span><CalendarDays size={18} /> المحاضرات والسكاشن</span><ChevronDown size={18} /></button>
      {openPanel === "schedule" ? <div className="accordion-body"><form className="form-grid" onSubmit={addLecture}><div className="form-section-label">إضافة اختيار محاضرة</div>
        <InputField label="المادة / الفرقة"><select required value={lectureForm.offeringId} onChange={(e) => setLectureForm({ ...lectureForm, offeringId: e.target.value })}><option value="">اختر المادة</option>{data.offerings.filter((row) => row.is_active).map((row) => <option key={row.id} value={row.id}>{currentCourseNameFrom(data, row.id)} · {byId(data.levels, row.study_level_id)?.name}</option>)}</select></InputField>
        <InputField label="اسم المحاضرة"><input required value={lectureForm.label} onChange={(e) => setLectureForm({ ...lectureForm, label: e.target.value })} /></InputField>
        <InputField label="اليوم"><select value={lectureForm.day} onChange={(e) => setLectureForm({ ...lectureForm, day: e.target.value })}>{DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></InputField>
        <InputField label="من"><input type="time" value={lectureForm.start} onChange={(e) => setLectureForm({ ...lectureForm, start: e.target.value })} /></InputField>
        <InputField label="إلى"><input type="time" value={lectureForm.end} onChange={(e) => setLectureForm({ ...lectureForm, end: e.target.value })} /></InputField>
        <InputField label="اسم الدكتور / المعيد"><input value={lectureForm.instructorName} onChange={(e) => setLectureForm({ ...lectureForm, instructorName: e.target.value })} /></InputField>
        <InputField label="القاعة / المعمل"><input value={lectureForm.room} onChange={(e) => setLectureForm({ ...lectureForm, room: e.target.value })} /></InputField>
        <InputField label="السعة"><input type="number" min="1" value={lectureForm.capacity} onChange={(e) => setLectureForm({ ...lectureForm, capacity: e.target.value })} /></InputField>
        <div className="form-submit"><button className="btn btn-primary" disabled={busy} type="submit">إضافة المحاضرة <Plus size={15} /></button></div>
      </form></div> : null}
      <button className={`accordion-heading ${openPanel === "defaults" ? "accordion-active" : ""}`} onClick={() => setOpenPanel(openPanel === "defaults" ? "" : "defaults")}><span><Users size={18} /> الأدمنز والصلاحيات</span><ChevronDown size={18} /></button>
      {openPanel === "defaults" ? <div className="accordion-body"><p className="muted">اختار سجلًا من المادة لتحديد نطاق الجروب أو السكشن. الدور يتحدد تلقائيًا من الكود: A–D للجروبات وa1–d6 للسكاشن.</p>
        <form className="form-grid" onSubmit={assignDefault}>
          <InputField label="الجروب / السكشن"><select required value={defaultForm.groupId} onChange={(e) => setDefaultForm({ ...defaultForm, groupId: e.target.value })}><option value="">اختر الجروب أو السكشن</option>{data.groups.map((group) => <option key={group.id} value={group.id}>{group.code} · {group.name} · {currentCourseNameFrom(data, group.offering_id)}</option>)}</select></InputField>
          <InputField label="حساب الأدمن"><select required value={defaultForm.userId} onChange={(e) => setDefaultForm({ ...defaultForm, userId: e.target.value })}><option value="">اختر الحساب</option>{data.profiles.map((row) => <option key={row.id} value={row.id}>{fullName(row)} · {row.email || row.student_id || ""}</option>)}</select></InputField>
          <div className="form-submit"><button className="btn btn-primary" type="submit" disabled={busy}>تعيين النطاق <ShieldCheck size={15} /></button></div>
        </form>
        <div className="mini-data-row"><span>تعيينات الجروبات والسكاشن الظاهرة لك</span><strong>{data.defaults.length}</strong></div>
      </div> : null}
    </div> : null}
    <Panel title="ملخص البيانات" subtitle="عدادات للبيانات المتاحة في نطاق صلاحياتك." icon={<Activity size={18} />}><div className="summary-strip"><div><small>الكليات</small><strong>{data.colleges.length}</strong></div><div><small>الأعوام</small><strong>{data.years.length}</strong></div><div><small>الفرق</small><strong>{data.levels.length}</strong></div><div><small>المواد</small><strong>{data.courses.length}</strong></div><div><small>الربط الأكاديمي</small><strong>{data.offerings.length}</strong></div></div></Panel>
  </div>;
}

function GuideDialog({ step, setStep, close, onNavigate, allowedSections }: { step: number; setStep: (value: number) => void; close: () => void; onNavigate: (section: Section) => void; allowedSections: Section[] }) {
  const guide = [
    { title: "مرحبًا بك في BeVo", body: "دي جولتك التعريفية. هنستعرض سوا أهم أجزاء المنصة: التنقل، المواد والمحاضرات، مساحة العمل، الإشعارات، والصلاحيات.", target: "overview" as Section, icon: <Home size={25} /> },
    { title: "الصفحة الرئيسية", body: "ابدأ من الرئيسية لمتابعة بياناتك، واستخدم قائمة التنقل الجانبية للانتقال بين الأقسام المتاحة لحسابك.", target: "overview" as Section, icon: <Activity size={25} /> },
    { title: "المواد والمحاضرات", body: "راجع المواد المتاحة واختيارات المحاضرات والسكاشن. المواعيد وأسماء المدرسين أو المعيدين بتظهر وفق نطاق صلاحياتك.", target: "courses" as Section, icon: <BookOpen size={25} /> },
    { title: "مساحة العمل والتكليفات", body: "استخدم مساحة العمل لمراجعة التاسكات والتكليفات والأنشطة المرتبطة بالدراسة، وافتح كل عنصر لمعرفة تفاصيله ومواعيده.", target: "tasks" as Section, icon: <ClipboardList size={25} /> },
    { title: "الإشعارات وطلبات التغيير", body: "الإشعارات تعرض المستجدات المتاحة لحسابك، وطلبات التغيير تتيح متابعة الطلبات والإجراءات من مكان واحد.", target: "notifications" as Section, icon: <Bell size={25} /> },
    { title: "إدارة الجروب / السكشن", body: "لو أنت أدمن جروب أو سكشن، افتح قسم الإدارة لتحديث اسم المعيد والميعاد والقاعة والسعة. التغيير محصور في نطاقك المعتمد.", target: "scope" as Section, icon: <Layers size={25} /> },
  ].filter((item, index) => index === 0 || allowedSections.includes(item.target));
  const safeStep = Math.min(step, guide.length - 1);
  const current = guide[safeStep];
  return <div className="modal-backdrop" role="presentation" onClick={close}><section className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-heading" onClick={(event) => event.stopPropagation()}>
    <div className="guide-modal-top"><div className="brand-lockup dark"><span className="brand-mark">B</span><div><strong>BeVo</strong><small>جولة تعريفية</small></div></div><button className="icon-button" aria-label="إغلاق الجولة" onClick={close}><X size={19} /></button></div>
    <div className="guide-progress"><span style={{ width: `${((step + 1) / guide.length) * 100}%` }} /></div>
    <div className="guide-content"><div className="guide-art">{current.icon}<span className="guide-spark guide-spark-one" /><span className="guide-spark guide-spark-two" /></div><span className="eyebrow">خطوة {safeStep + 1} من {guide.length}</span><h2 id="guide-heading">{current.title}</h2><p>{current.body}</p><button className="text-button" onClick={() => { onNavigate(current.target); }}>{current.target === "scope" ? "اذهب لإدارة الجروب / السكشن" : current.target === "courses" ? "اذهب للمواد" : current.target === "tasks" ? "اذهب للمهام" : current.target === "notifications" ? "افتح الإشعارات" : "اذهب للرئيسية"} <ArrowLeft size={14} /></button></div>
    <div className="guide-footer"><button className="btn btn-outline" onClick={close}>تخطي الجولة</button><div className="guide-dots">{guide.map((item, index) => <button key={item.title} aria-label={`الخطوة ${index + 1}`} className={index === safeStep ? "guide-dot guide-dot-active" : "guide-dot"} onClick={() => setStep(index)} />)}</div><div className="guide-nav">{step > 0 ? <button className="btn btn-outline" onClick={() => setStep(step - 1)}>السابق</button> : null}<button className="btn btn-primary" onClick={() => safeStep === guide.length - 1 ? close() : setStep(safeStep + 1)}>{step === guide.length - 1 ? "إنهاء الجولة" : "التالي"} <ArrowLeft size={15} /></button></div></div>
  </section></div>;
}

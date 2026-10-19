"use client";

import { useState, type ReactNode } from "react";
import { MoreVertical, Pencil, Trash2, RefreshCw, Search, X, Save, Building2, GraduationCap, Layers, BookOpen, CalendarDays, Clock3 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type CatalogRow = Record<string, any>;
type CatalogKind = "colleges" | "years" | "levels" | "terms" | "courses" | "offerings" | "lectures";
type CatalogDraft = Record<string, string | boolean>;
type CatalogData = {
  colleges: CatalogRow[];
  years: CatalogRow[];
  levels: CatalogRow[];
  terms: CatalogRow[];
  courses: CatalogRow[];
  offerings: CatalogRow[];
  lectures: CatalogRow[];
};

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const TABLES: Record<CatalogKind, string> = {
  colleges: "colleges",
  years: "academic_years",
  levels: "study_levels",
  terms: "terms",
  courses: "courses",
  offerings: "course_offerings",
  lectures: "lecture_options",
};
const KIND_TITLES: Record<CatalogKind, string> = {
  colleges: "الكليات",
  years: "الأعوام",
  levels: "الفرق",
  terms: "الترمات",
  courses: "المواد",
  offerings: "ربط المواد",
  lectures: "المواعيد",
};
const KIND_ICONS: Record<CatalogKind, ReactNode> = {
  colleges: <Building2 size={16} />,
  years: <CalendarDays size={16} />,
  levels: <GraduationCap size={16} />,
  terms: <CalendarDays size={16} />,
  courses: <BookOpen size={16} />,
  offerings: <Layers size={16} />,
  lectures: <Clock3 size={16} />,
};

function rowById(rows: CatalogRow[], id: string | null | undefined) {
  return rows.find((row) => row.id === id);
}
function recordTime(value: string | null | undefined) {
  return value ? String(value).slice(0, 5) : "غير محدد";
}
function recordCourseName(data: CatalogData, offeringId: string) {
  const offering = rowById(data.offerings, offeringId);
  return rowById(data.courses, offering?.course_id)?.name || "مادة";
}
function recordTitle(kind: CatalogKind, row: CatalogRow, data: CatalogData) {
  switch (kind) {
    case "colleges": return row.name || "كلية";
    case "years": return row.label || "عام أكاديمي";
    case "levels": return row.name || "فرقة";
    case "terms": return row.name || "ترم";
    case "courses": return row.name || "مادة";
    case "offerings": return recordCourseName(data, row.id);
    case "lectures": return row.label || "موعد محاضرة";
  }
}
function recordDetails(kind: CatalogKind, row: CatalogRow, data: CatalogData) {
  switch (kind) {
    case "colleges":
      return "الكود: " + (row.code || "—");
    case "years":
      return (rowById(data.colleges, row.college_id)?.name || "كلية") + " · " +
        (row.starts_on || row.ends_on ? (row.starts_on || "—") + " ← " + (row.ends_on || "—") : "التواريخ غير محددة");
    case "levels":
      return (rowById(data.colleges, row.college_id)?.name || "كلية") + " · الترتيب " + (row.sort_order ?? "—");
    case "terms": {
      const year = rowById(data.years, row.academic_year_id);
      return (year?.label || "عام أكاديمي") + " · " +
        (row.starts_on || row.ends_on ? (row.starts_on || "—") + " ← " + (row.ends_on || "—") : "التواريخ غير محددة");
    }
    case "courses":
      return (row.code || "—") + " · " + (rowById(data.colleges, row.college_id)?.name || "كلية") + " · " + (row.credits ?? 0) + " ساعات";
    case "offerings":
      return [
        rowById(data.colleges, row.college_id)?.name || "كلية",
        rowById(data.years, row.academic_year_id)?.label || "عام",
        rowById(data.levels, row.study_level_id)?.name || "فرقة",
        rowById(data.terms, row.term_id)?.name || "ترم",
        row.requires_section ? "بسكشن" : "بدون سكشن",
      ].join(" · ");
    case "lectures":
      return recordCourseName(data, row.offering_id) + " · " +
        (DAYS[Number(row.day_of_week)] || "اليوم غير محدد") + " · " +
        recordTime(row.starts_at) + "–" + recordTime(row.ends_at) + " · " + (row.room || "بدون قاعة");
  }
}
function draftFrom(kind: CatalogKind, row: CatalogRow): CatalogDraft {
  switch (kind) {
    case "colleges": return { name: row.name || "", code: row.code || "" };
    case "years": return { label: row.label || "", starts_on: row.starts_on || "", ends_on: row.ends_on || "" };
    case "levels": return { name: row.name || "", sort_order: String(row.sort_order ?? 1) };
    case "terms": return { name: row.name || "", starts_on: row.starts_on || "", ends_on: row.ends_on || "" };
    case "courses": return { name: row.name || "", code: row.code || "", credits: String(row.credits ?? 0) };
    case "offerings": return { requires_section: Boolean(row.requires_section) };
    case "lectures": return {
      label: row.label || "", day_of_week: String(row.day_of_week ?? 0),
      starts_at: recordTime(row.starts_at) === "غير محدد" ? "" : recordTime(row.starts_at),
      ends_at: recordTime(row.ends_at) === "غير محدد" ? "" : recordTime(row.ends_at),
      instructor_name: row.instructor_name || "", room: row.room || "",
      capacity: row.capacity == null ? "" : String(row.capacity),
    };
  }
}

export default function AdminDataManager({
  data, refresh, notify,
}: {
  data: CatalogData;
  refresh: () => void;
  notify: (text: string, tone?: "success" | "error" | "info") => void;
}) {
  const [kind, setKind] = useState<CatalogKind>("courses");
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ kind: CatalogKind; row: CatalogRow } | null>(null);
  const [draft, setDraft] = useState<CatalogDraft>({});
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  const rowsByKind: Record<CatalogKind, CatalogRow[]> = {
    colleges: data.colleges, years: data.years, levels: data.levels, terms: data.terms,
    courses: data.courses, offerings: data.offerings, lectures: data.lectures,
  };
  const currentRows = rowsByKind[kind].filter((row) => {
    const query = filter.trim().toLocaleLowerCase();
    return !query || (recordTitle(kind, row, data) + " " + recordDetails(kind, row, data)).toLocaleLowerCase().includes(query);
  });
  const textValue = (key: string) => String(draft[key] ?? "");
  const setText = (key: string, value: string) => setDraft((old) => ({ ...old, [key]: value }));

  function beginEdit(nextKind: CatalogKind, row: CatalogRow) {
    setActiveMenu(null);
    setEditing({ kind: nextKind, row });
    setDraft(draftFrom(nextKind, row));
  }

  async function saveEdit() {
    if (!editing) return;
    const currentKind = editing.kind;
    const values = draft;
    let patch: CatalogRow = {};
    if (currentKind === "colleges") {
      if (!textValue("name").trim() || !textValue("code").trim()) {
        notify("اكتب اسم الكلية وكودها.", "error"); return;
      }
      patch = { name: textValue("name").trim(), code: textValue("code").trim().toUpperCase() };
    } else if (currentKind === "years") {
      if (!textValue("label").trim()) { notify("اكتب اسم العام الأكاديمي.", "error"); return; }
      if (textValue("starts_on") && textValue("ends_on") && textValue("ends_on") < textValue("starts_on")) {
        notify("تاريخ نهاية العام لازم يكون بعد تاريخ بدايته.", "error"); return;
      }
      patch = { label: textValue("label").trim(), starts_on: textValue("starts_on") || null, ends_on: textValue("ends_on") || null };
    } else if (currentKind === "levels") {
      if (!textValue("name").trim()) { notify("اكتب اسم الفرقة.", "error"); return; }
      patch = { name: textValue("name").trim(), sort_order: Math.max(1, Number(textValue("sort_order")) || 1) };
    } else if (currentKind === "terms") {
      if (!textValue("name").trim()) { notify("اكتب اسم الترم.", "error"); return; }
      if (textValue("starts_on") && textValue("ends_on") && textValue("ends_on") < textValue("starts_on")) {
        notify("تاريخ نهاية الترم لازم يكون بعد تاريخ بدايته.", "error"); return;
      }
      patch = { name: textValue("name").trim(), starts_on: textValue("starts_on") || null, ends_on: textValue("ends_on") || null };
    } else if (currentKind === "courses") {
      if (!textValue("name").trim() || !textValue("code").trim()) {
        notify("اكتب اسم المادة وكودها.", "error"); return;
      }
      const credits = Number(textValue("credits"));
      if (!Number.isFinite(credits) || credits < 0) { notify("الساعات المعتمدة لازم تكون صفر أو أكثر.", "error"); return; }
      patch = { name: textValue("name").trim(), code: textValue("code").trim().toUpperCase(), credits };
    } else if (currentKind === "offerings") {
      patch = { requires_section: Boolean(values.requires_section) };
    } else {
      if (!textValue("label").trim()) { notify("اكتب اسم اختيار المحاضرة.", "error"); return; }
      if (!textValue("starts_at") || !textValue("ends_at") || textValue("ends_at") <= textValue("starts_at")) {
        notify("لازم تحدد البداية والنهاية، ووقت النهاية يكون بعد البداية.", "error"); return;
      }
      const capacityValue = textValue("capacity");
      const capacity = capacityValue ? Number(capacityValue) : null;
      if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
        notify("السعة لازم تكون رقمًا صحيحًا أكبر من صفر.", "error"); return;
      }
      patch = {
        label: textValue("label").trim(),
        day_of_week: Number(textValue("day_of_week")),
        starts_at: textValue("starts_at"), ends_at: textValue("ends_at"),
        instructor_name: textValue("instructor_name").trim() || null,
        room: textValue("room").trim() || null, capacity,
      };
    }

    setBusy(true);
    try {
      const { data: saved, error } = await supabase.from(TABLES[currentKind])
        .update(patch).eq("id", editing.row.id).select("id").maybeSingle();
      if (error) throw error;
      if (!saved) throw new Error("لم يتم حفظ التعديل. راجع صلاحيات الحساب ثم جرّب مرة أخرى.");
      notify("تم حفظ التعديل بنجاح.");
      setEditing(null);
      refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function markInactive(table: string, ids: string[]) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (!uniqueIds.length) return;
    const { error } = await supabase.from(table).update({ is_active: false }).in("id", uniqueIds);
    if (error) throw error;
  }

  async function deactivateDependents(nextKind: CatalogKind, row: CatalogRow) {
    const lectureIdsFor = (offeringIds: string[]) => data.lectures
      .filter((lecture) => offeringIds.includes(lecture.offering_id)).map((lecture) => lecture.id);
    if (nextKind === "colleges") {
      const yearIds = data.years.filter((year) => year.college_id === row.id).map((year) => year.id);
      const levelIds = data.levels.filter((level) => level.college_id === row.id).map((level) => level.id);
      const courseIds = data.courses.filter((course) => course.college_id === row.id).map((course) => course.id);
      const termIds = data.terms.filter((term) => yearIds.includes(term.academic_year_id)).map((term) => term.id);
      const offeringIds = data.offerings.filter((offering) =>
        offering.college_id === row.id || yearIds.includes(offering.academic_year_id) ||
        levelIds.includes(offering.study_level_id) || courseIds.includes(offering.course_id) || termIds.includes(offering.term_id)
      ).map((offering) => offering.id);
      await markInactive("lecture_options", lectureIdsFor(offeringIds));
      await markInactive("course_offerings", offeringIds);
      await markInactive("terms", termIds);
      await markInactive("courses", courseIds);
      await markInactive("study_levels", levelIds);
      await markInactive("academic_years", yearIds);
    } else if (nextKind === "years") {
      const termIds = data.terms.filter((term) => term.academic_year_id === row.id).map((term) => term.id);
      const offeringIds = data.offerings.filter((offering) => offering.academic_year_id === row.id || termIds.includes(offering.term_id)).map((offering) => offering.id);
      await markInactive("lecture_options", lectureIdsFor(offeringIds));
      await markInactive("course_offerings", offeringIds);
      await markInactive("terms", termIds);
    } else if (nextKind === "levels") {
      const offeringIds = data.offerings.filter((offering) => offering.study_level_id === row.id).map((offering) => offering.id);
      await markInactive("lecture_options", lectureIdsFor(offeringIds));
      await markInactive("course_offerings", offeringIds);
    } else if (nextKind === "terms") {
      const offeringIds = data.offerings.filter((offering) => offering.term_id === row.id).map((offering) => offering.id);
      await markInactive("lecture_options", lectureIdsFor(offeringIds));
      await markInactive("course_offerings", offeringIds);
    } else if (nextKind === "courses") {
      const offeringIds = data.offerings.filter((offering) => offering.course_id === row.id).map((offering) => offering.id);
      await markInactive("lecture_options", lectureIdsFor(offeringIds));
      await markInactive("course_offerings", offeringIds);
    } else if (nextKind === "offerings") {
      await markInactive("lecture_options", lectureIdsFor([row.id]));
    }
  }

  async function toggleActive(nextKind: CatalogKind, row: CatalogRow) {
    const restoring = row.is_active === false;
    const title = recordTitle(nextKind, row, data);
    if (!restoring) {
      let message = "هيتم إخفاء «" + title + "» من العناصر النشطة مع الاحتفاظ بالسجلات المرتبطة.";
      if (nextKind === "colleges") message = "هيتم إخفاء الكلية وكل السنوات والفرق والمواد والمواعيد المرتبطة بها. السجلات لن تُمسح نهائيًا. هل تريد المتابعة؟";
      else if (["years", "levels", "terms", "courses", "offerings"].includes(nextKind)) message = "هيتم إخفاء «" + title + "» والروابط/المواعيد التابعة له مع الاحتفاظ بالسجلات. هل تريد المتابعة؟";
      if (!window.confirm(message)) return;
    } else if (nextKind === "years" && row.is_current && data.years.some((year) =>
      year.id !== row.id && year.college_id === row.college_id && year.is_current && year.is_active
    )) {
      notify("لا يمكن استعادة هذا العام كعام حالي لأن للكلية عامًا حاليًا آخر. غيّر العام الحالي أولًا.", "error");
      return;
    }

    setBusy(true);
    try {
      if (!restoring) await deactivateDependents(nextKind, row);
      const { data: saved, error } = await supabase.from(TABLES[nextKind])
        .update({ is_active: restoring }).eq("id", row.id).select("id").maybeSingle();
      if (error) throw error;
      if (!saved) throw new Error("لم يتغير السجل. تأكد أن حسابك لديه صلاحية إدارة البيانات.");
      notify(restoring
        ? "تمت استعادة العنصر. العناصر التابعة التي أُخفيت معه تحتاج استعادة منفصلة من قائمتها."
        : "تم إخفاء العنصر بنجاح، مع الاحتفاظ بسجلاته المرتبطة.");
      setActiveMenu(null);
      refresh();
    } catch (error) {
      notify("لم يكتمل الإجراء: " + (error instanceof Error ? error.message : String(error)), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel catalog-manager-panel">
      <div className="panel-heading">
        <div className="panel-title-wrap">
          <span className="panel-icon"><Layers size={18} /></span>
          <div><h2>إدارة البيانات من نفس الصفحة</h2><p>اضغط على الثلاث نقاط بجانب أي عنصر لعرض التعديل أو الحذف.</p></div>
        </div>
        <button type="button" className="btn btn-outline" onClick={refresh} disabled={busy}><RefreshCw size={15} /> تحديث</button>
      </div>
      <div className="panel-content">
        <div className="catalog-manager-tabs" role="tablist" aria-label="أنواع البيانات">
          {(Object.keys(KIND_TITLES) as CatalogKind[]).map((tab) => (
            <button type="button" role="tab" aria-selected={kind === tab}
              className={"catalog-manager-tab" + (kind === tab ? " catalog-manager-tab-active" : "")}
              key={tab} onClick={() => { setKind(tab); setFilter(""); setActiveMenu(null); }}>
              {KIND_ICONS[tab]}<span>{KIND_TITLES[tab]}</span><b>{rowsByKind[tab].length}</b>
            </button>
          ))}
        </div>
        <label className="catalog-manager-search"><Search size={16} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={"ابحث في " + KIND_TITLES[kind] + "..."} /></label>
        <div className="catalog-entity-list">
          {currentRows.length ? currentRows.map((row) => {
            const key = kind + ":" + row.id;
            return (
              <article className={"catalog-entity-row" + (row.is_active === false ? " catalog-entity-row-inactive" : "")} key={key}>
                <div className="catalog-entity-copy">
                  <strong>{recordTitle(kind, row, data)}</strong>
                  <small>{recordDetails(kind, row, data)}</small>
                </div>
                <div className="catalog-entity-controls">
                  <span className={"catalog-state" + (row.is_active === false ? " catalog-state-off" : "")}>{row.is_active === false ? "مخفي" : "نشط"}</span>
                  <div className="catalog-menu-position">
                    <button type="button" className="icon-button catalog-menu-trigger" aria-label={"خيارات " + recordTitle(kind, row, data)}
                      aria-expanded={activeMenu === key} disabled={busy}
                      onClick={() => setActiveMenu(activeMenu === key ? null : key)}>
                      <MoreVertical size={18} />
                    </button>
                    {activeMenu === key ? (
                      <div className="catalog-entity-menu" role="menu">
                        <button type="button" role="menuitem" onClick={() => beginEdit(kind, row)}><Pencil size={15} /> تعديل</button>
                        <button type="button" role="menuitem" className={row.is_active === false ? "catalog-restore-action" : "catalog-delete-action"}
                          onClick={() => void toggleActive(kind, row)} disabled={busy}>
                          {row.is_active === false ? <RefreshCw size={15} /> : <Trash2 size={15} />}
                          {row.is_active === false ? "استعادة" : "حذف / إخفاء"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          }) : <div className="catalog-manager-empty">لا توجد عناصر مطابقة. جرّب نوع بيانات آخر أو غيّر البحث.</div>}
        </div>
        <p className="catalog-manager-note">الحذف هنا إخفاء آمن بدل المسح النهائي حتى لا تتكسر تسجيلات الطلاب والسجلات القديمة. استعادة العنصر لا تعيد تنشيط العناصر التابعة تلقائيًا.</p>
      </div>

      {editing ? (
        <div className="catalog-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setEditing(null); }}>
          <section className="catalog-editor-modal" role="dialog" aria-modal="true" aria-labelledby="catalog-editor-title">
            <div className="catalog-editor-heading">
              <div><span className="eyebrow">تعديل البيانات</span><h2 id="catalog-editor-title">{KIND_TITLES[editing.kind]} · {recordTitle(editing.kind, editing.row, data)}</h2></div>
              <button className="icon-button" type="button" aria-label="إغلاق" disabled={busy} onClick={() => setEditing(null)}><X size={18} /></button>
            </div>
            <form onSubmit={(event) => { event.preventDefault(); void saveEdit(); }} className="catalog-editor-form">
              {editing.kind === "colleges" ? <>
                <label className="field"><span className="field-label">اسم الكلية</span><input required value={textValue("name")} onChange={(event) => setText("name", event.target.value)} /></label>
                <label className="field"><span className="field-label">كود الكلية</span><input required value={textValue("code")} onChange={(event) => setText("code", event.target.value)} /></label>
              </> : null}
              {editing.kind === "years" ? <>
                <label className="field"><span className="field-label">اسم العام الأكاديمي</span><input required value={textValue("label")} onChange={(event) => setText("label", event.target.value)} /></label>
                <label className="field"><span className="field-label">تاريخ البداية</span><input type="date" value={textValue("starts_on")} onChange={(event) => setText("starts_on", event.target.value)} /></label>
                <label className="field"><span className="field-label">تاريخ النهاية</span><input type="date" value={textValue("ends_on")} onChange={(event) => setText("ends_on", event.target.value)} /></label>
              </> : null}
              {editing.kind === "levels" ? <>
                <label className="field"><span className="field-label">اسم الفرقة</span><input required value={textValue("name")} onChange={(event) => setText("name", event.target.value)} /></label>
                <label className="field"><span className="field-label">ترتيب الفرقة</span><input type="number" min="1" required value={textValue("sort_order")} onChange={(event) => setText("sort_order", event.target.value)} /></label>
              </> : null}
              {editing.kind === "terms" ? <>
                <label className="field"><span className="field-label">اسم الترم</span><input required value={textValue("name")} onChange={(event) => setText("name", event.target.value)} /></label>
                <label className="field"><span className="field-label">تاريخ البداية</span><input type="date" value={textValue("starts_on")} onChange={(event) => setText("starts_on", event.target.value)} /></label>
                <label className="field"><span className="field-label">تاريخ النهاية</span><input type="date" value={textValue("ends_on")} onChange={(event) => setText("ends_on", event.target.value)} /></label>
              </> : null}
              {editing.kind === "courses" ? <>
                <label className="field"><span className="field-label">اسم المادة</span><input required value={textValue("name")} onChange={(event) => setText("name", event.target.value)} /></label>
                <label className="field"><span className="field-label">كود المادة</span><input required value={textValue("code")} onChange={(event) => setText("code", event.target.value)} /></label>
                <label className="field"><span className="field-label">الساعات المعتمدة</span><input type="number" min="0" step="0.5" required value={textValue("credits")} onChange={(event) => setText("credits", event.target.value)} /></label>
              </> : null}
              {editing.kind === "offerings" ? <label className="catalog-editor-check"><input type="checkbox" checked={Boolean(draft.requires_section)} onChange={(event) => setDraft((old) => ({ ...old, requires_section: event.target.checked }))} /><span><strong>المادة تتطلب سكشن / جروب</strong><small>إلغاء الاختيار يجعل المادة بدون سكشن.</small></span></label> : null}
              {editing.kind === "lectures" ? <>
                <label className="field"><span className="field-label">اسم اختيار المحاضرة</span><input required value={textValue("label")} onChange={(event) => setText("label", event.target.value)} /></label>
                <label className="field"><span className="field-label">اليوم</span><select value={textValue("day_of_week")} onChange={(event) => setText("day_of_week", event.target.value)}>{DAYS.map((day, index) => <option value={String(index)} key={day}>{day}</option>)}</select></label>
                <div className="catalog-editor-time-grid">
                  <label className="field"><span className="field-label">من</span><input type="time" required value={textValue("starts_at")} onChange={(event) => setText("starts_at", event.target.value)} /></label>
                  <label className="field"><span className="field-label">إلى</span><input type="time" required value={textValue("ends_at")} onChange={(event) => setText("ends_at", event.target.value)} /></label>
                </div>
                <label className="field"><span className="field-label">اسم الدكتور / المعيد</span><input value={textValue("instructor_name")} onChange={(event) => setText("instructor_name", event.target.value)} /></label>
                <label className="field"><span className="field-label">القاعة / المعمل</span><input value={textValue("room")} onChange={(event) => setText("room", event.target.value)} /></label>
                <label className="field"><span className="field-label">السعة</span><input type="number" min="1" value={textValue("capacity")} onChange={(event) => setText("capacity", event.target.value)} /></label>
              </> : null}
              <div className="catalog-editor-actions"><button type="button" className="btn btn-outline" disabled={busy} onClick={() => setEditing(null)}>إلغاء</button><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "جاري الحفظ…" : "حفظ التعديل"} <Save size={15} /></button></div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}

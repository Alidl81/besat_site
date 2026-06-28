"use client";

import { type FormEvent, useState } from "react";
import { CrudManager, FormActions, type Column } from "@/components/crud/crud-manager";
import { CrudSection, Field, TextInput } from "@/components/crud/crud-ui";
import { ExcelImport } from "@/components/crud/excel-import";
import {
  classesRepository,
  programsRepository,
  staffRepository,
  studentsRepository,
} from "@/lib/data/repositories";
import type {
  ClassRecord,
  ProgramRecord,
  StaffRecord,
  StudentRecord,
  WithoutSystemFields,
} from "@/lib/data/domain-types";


type ScopedProps = { unitId?: string | null };

// ---------- دانش‌آموزان ----------
export function StudentsManager({ unitId = null }: ScopedProps) {
  const [showImport, setShowImport] = useState(false);

  const columns: Column<StudentRecord>[] = [
    { key: "name", header: "نام دانش‌آموز", render: (i) => <span className="font-black">{i.full_name}</span> },
    { key: "class", header: "کلاس", render: (i) => <span>{i.class_title ?? "—"}</span> },
    { key: "code", header: "کد ملی", render: (i) => <span className="text-slate-500">{i.national_code ?? "—"}</span> },
  ];

  async function handleExcelImport(rows: Omit<StudentRecord, "id" | "created_at" | "updated_at">[]) {
    for (const row of rows) {
      await studentsRepository.create({ ...row, unit_id: row.unit_id ?? unitId });
    }
  }

  return (
    <div className="space-y-5">
      <CrudManager<StudentRecord>
        title="مدیریت دانش‌آموزان"
        description="فهرست دانش‌آموزان واحد را مدیریت کنید."
        repository={studentsRepository}
        filter={unitId ? (i) => i.unit_id === unitId : undefined}
        columns={columns}
        emptyText="دانش‌آموزی ثبت نشده است."
        addLabel="دانش‌آموز جدید"
        renderForm={({ initial, onSubmit, onCancel, submitting }) => (
          <StudentForm unitId={unitId} initial={initial} onSubmit={onSubmit} onCancel={onCancel} submitting={submitting} />
        )}
      />

      {/* Excel import */}
      <CrudSection
        title="ورود گروهی از Excel"
        description="برای افزودن تعداد زیادی دانش‌آموز، فایل CSV آپلود کنید."
        action={
          <button
            type="button"
            onClick={() => setShowImport((v) => !v)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-[#062452] transition hover:bg-emerald-50"
          >
            {showImport ? "پنهان کردن" : "نمایش ورود Excel"}
          </button>
        }
      >
        {showImport ? (
          <ExcelImport<StudentRecord>
            columns={[
              { key: "full_name", label: "نام و نام خانوادگی", required: true },
              { key: "national_code", label: "کد ملی" },
              { key: "class_title", label: "کلاس" },
            ]}
            mapRow={(row) => {
              if (!row["نام و نام خانوادگی"]?.trim()) return null;
              return {
                full_name: row["نام و نام خانوادگی"],
                national_code: row["کد ملی"] || null,
                class_title: row["کلاس"] || null,
                unit_id: unitId,
                parent_id: null,
              };
            }}
            onImport={handleExcelImport}
          />
        ) : null}
      </CrudSection>
    </div>
  );
}

function StudentForm({
  unitId,
  initial,
  onSubmit,
  onCancel,
  submitting,
}: ScopedProps & {
  initial: StudentRecord | null;
  onSubmit: (data: WithoutSystemFields<StudentRecord>) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [nationalCode, setNationalCode] = useState(initial?.national_code ?? "");
  const [classTitle, setClassTitle] = useState(initial?.class_title ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      full_name: fullName,
      national_code: nationalCode || null,
      unit_id: initial?.unit_id ?? unitId ?? null,
      class_title: classTitle || null,
      parent_id: initial?.parent_id ?? null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="نام و نام خانوادگی" required>
        <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="کد ملی">
          <TextInput value={nationalCode} onChange={(e) => setNationalCode(e.target.value)} />
        </Field>
        <Field label="کلاس">
          <TextInput value={classTitle} onChange={(e) => setClassTitle(e.target.value)} placeholder="مثال: ۱۰۱" />
        </Field>
      </div>
      <FormActions onCancel={onCancel} submitting={submitting} />
    </form>
  );
}

// ---------- کارکنان ----------
export function StaffManager({ unitId = null }: ScopedProps) {
  const [showImport, setShowImport] = useState(false);

  const columns: Column<StaffRecord>[] = [
    { key: "name", header: "نام", render: (i) => <span className="font-black">{i.full_name}</span> },
    { key: "role", header: "سمت", render: (i) => <span>{i.role_title}</span> },
    { key: "phone", header: "تماس", render: (i) => <span className="text-slate-500">{i.phone ?? "—"}</span> },
  ];

  async function handleExcelImport(rows: Omit<StaffRecord, "id" | "created_at" | "updated_at">[]) {
    for (const row of rows) {
      await staffRepository.create({ ...row, unit_id: row.unit_id ?? unitId });
    }
  }

  return (
    <div className="space-y-5">
      <CrudManager<StaffRecord>
        title="مدیریت کارکنان"
        description="کادر آموزشی و اداری واحد را مدیریت کنید."
        repository={staffRepository}
        filter={unitId ? (i) => i.unit_id === unitId : undefined}
        columns={columns}
        emptyText="کارمندی ثبت نشده است."
        addLabel="کارمند جدید"
        renderForm={({ initial, onSubmit, onCancel, submitting }) => (
          <StaffForm unitId={unitId} initial={initial} onSubmit={onSubmit} onCancel={onCancel} submitting={submitting} />
        )}
      />

      <CrudSection
        title="ورود گروهی از Excel"
        description="برای افزودن تعداد زیادی کارمند، فایل CSV آپلود کنید."
        action={
          <button
            type="button"
            onClick={() => setShowImport((v) => !v)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-[#062452] transition hover:bg-emerald-50"
          >
            {showImport ? "پنهان کردن" : "نمایش ورود Excel"}
          </button>
        }
      >
        {showImport ? (
          <ExcelImport<StaffRecord>
            columns={[
              { key: "full_name", label: "نام و نام خانوادگی", required: true },
              { key: "role_title", label: "سمت", required: true },
              { key: "phone", label: "شماره تماس" },
            ]}
            mapRow={(row) => {
              if (!row["نام و نام خانوادگی"]?.trim() || !row["سمت"]?.trim()) return null;
              return {
                full_name: row["نام و نام خانوادگی"],
                role_title: row["سمت"],
                phone: row["شماره تماس"] || null,
                unit_id: unitId,
              };
            }}
            onImport={handleExcelImport}
          />
        ) : null}
      </CrudSection>
    </div>
  );
}

function StaffForm({
  unitId,
  initial,
  onSubmit,
  onCancel,
  submitting,
}: ScopedProps & {
  initial: StaffRecord | null;
  onSubmit: (data: WithoutSystemFields<StaffRecord>) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [roleTitle, setRoleTitle] = useState(initial?.role_title ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      full_name: fullName,
      role_title: roleTitle,
      unit_id: initial?.unit_id ?? unitId ?? null,
      phone: phone || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="نام و نام خانوادگی" required>
        <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="سمت" required>
          <TextInput value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} required placeholder="مثال: معاون آموزشی" />
        </Field>
        <Field label="شماره تماس">
          <TextInput type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
      </div>
      <FormActions onCancel={onCancel} submitting={submitting} />
    </form>
  );
}

// ---------- کلاس‌ها ----------
export function ClassesManager({ unitId = null }: ScopedProps) {
  const columns: Column<ClassRecord>[] = [
    { key: "title", header: "نام کلاس", render: (i) => <span className="font-black">{i.title}</span> },
    { key: "grade", header: "پایه", render: (i) => <span>{i.grade ?? "—"}</span> },
    { key: "capacity", header: "ظرفیت", render: (i) => <span>{i.capacity ?? "—"}</span> },
  ];

  return (
    <CrudManager<ClassRecord>
      title="مدیریت کلاس‌ها"
      description="کلاس‌های واحد آموزشی را مدیریت کنید."
      repository={classesRepository}
      filter={unitId ? (i) => i.unit_id === unitId : undefined}
      columns={columns}
      emptyText="کلاسی ثبت نشده است."
      addLabel="کلاس جدید"
      renderForm={({ initial, onSubmit, onCancel, submitting }) => (
        <ClassForm unitId={unitId} initial={initial} onSubmit={onSubmit} onCancel={onCancel} submitting={submitting} />
      )}
    />
  );
}

function ClassForm({
  unitId,
  initial,
  onSubmit,
  onCancel,
  submitting,
}: ScopedProps & {
  initial: ClassRecord | null;
  onSubmit: (data: WithoutSystemFields<ClassRecord>) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [grade, setGrade] = useState(initial?.grade ?? "");
  const [capacity, setCapacity] = useState(initial?.capacity ?? 0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      title,
      unit_id: initial?.unit_id ?? unitId ?? null,
      grade: grade || null,
      capacity: Number(capacity) || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="نام کلاس" required>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required />
      </Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="پایه">
          <TextInput value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="مثال: دهم" />
        </Field>
        <Field label="ظرفیت">
          <TextInput type="number" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
        </Field>
      </div>
      <FormActions onCancel={onCancel} submitting={submitting} />
    </form>
  );
}

// ---------- برنامه‌ها ----------
export function ProgramsManager({ unitId = null }: ScopedProps) {
  const columns: Column<ProgramRecord>[] = [
    { key: "title", header: "عنوان برنامه", render: (i) => <span className="font-black">{i.title}</span> },
    {
      key: "desc",
      header: "توضیحات",
      render: (i) => <span className="block max-w-md truncate text-slate-500">{i.description ?? "—"}</span>,
    },
    { key: "date", header: "تاریخ", render: (i) => <span className="text-slate-500">{i.date ?? "—"}</span> },
  ];

  return (
    <CrudManager<ProgramRecord>
      title="مدیریت برنامه‌ها"
      description="برنامه‌های آموزشی و رویدادهای واحد را مدیریت کنید."
      repository={programsRepository}
      filter={unitId ? (i) => i.unit_id === unitId : undefined}
      columns={columns}
      emptyText="برنامه‌ای ثبت نشده است."
      addLabel="برنامه جدید"
      renderForm={({ initial, onSubmit, onCancel, submitting }) => (
        <ProgramForm unitId={unitId} initial={initial} onSubmit={onSubmit} onCancel={onCancel} submitting={submitting} />
      )}
    />
  );
}

function ProgramForm({
  unitId,
  initial,
  onSubmit,
  onCancel,
  submitting,
}: ScopedProps & {
  initial: ProgramRecord | null;
  onSubmit: (data: WithoutSystemFields<ProgramRecord>) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [date, setDate] = useState(initial?.date ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      title,
      description: description || null,
      unit_id: initial?.unit_id ?? unitId ?? null,
      date: date || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="عنوان برنامه" required>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required />
      </Field>
      <Field label="توضیحات">
        <TextInput value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="تاریخ">
        <TextInput value={date} onChange={(e) => setDate(e.target.value)} placeholder="مثال: ۱۴۰۳/۰۸/۱۵" />
      </Field>
      <FormActions onCancel={onCancel} submitting={submitting} />
    </form>
  );
}

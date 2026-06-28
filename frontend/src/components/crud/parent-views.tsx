"use client";

import { useEffect, useState } from "react";
import { CrudSection, EmptyState } from "@/components/crud/crud-ui";
import {
  contentRepository,
  programsRepository,
  studentsRepository,
} from "@/lib/data/repositories";
import { readBesatSession } from "@/lib/auth/auth-session";
import type {
  ContentRecord,
  ProgramRecord,
  StudentRecord,
} from "@/lib/data/domain-types";

// والدین فقط مشاهده می‌کنند (read-only)

export function ParentChildrenView() {
  const [children, setChildren] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = readBesatSession();
    studentsRepository.list().then((all) => {
      // در حالت واقعی، بک براساس parent_id فیلتر می‌کند.
      // اینجا برای تست همه را نشان می‌دهیم اگر parent مشخص نباشد.
      const mine = session
        ? all.filter((s) => s.parent_id === null || s.unit_id === session.unitId)
        : all;
      setChildren(mine);
      setLoading(false);
    });
  }, []);

  return (
    <CrudSection title="فرزندان من" description="اطلاعات فرزندان شما در این بخش نمایش داده می‌شود.">
      {loading ? (
        <div className="flex min-h-32 items-center justify-center">
          <div className="size-9 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
        </div>
      ) : children.length === 0 ? (
        <EmptyState text="اطلاعات فرزندی برای نمایش وجود ندارد." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {children.map((child) => (
            <div key={child.id} className="rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-sm">
              <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-xl">
                👤
              </div>
              <h3 className="text-base font-black text-[#062452]">{child.full_name}</h3>
              <p className="mt-1 text-sm font-bold text-slate-500">کلاس: {child.class_title ?? "—"}</p>
            </div>
          ))}
        </div>
      )}
    </CrudSection>
  );
}

export function ParentProgramsView({ showAnnouncements = false }: { showAnnouncements?: boolean }) {
  const [programs, setPrograms] = useState<ProgramRecord[]>([]);
  const [announcements, setAnnouncements] = useState<ContentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = readBesatSession();
    Promise.all([programsRepository.list(), contentRepository.list()]).then(
      ([progs, content]) => {
        const scopedProgs = session?.unitId
          ? progs.filter((p) => p.unit_id === session.unitId || p.unit_id === null)
          : progs;
        setPrograms(scopedProgs);

        const anns = content.filter(
          (c) =>
            c.kind === "announcement" &&
            c.status === "published" &&
            (c.scope === "school" || c.unit_id === session?.unitId),
        );
        setAnnouncements(anns);
        setLoading(false);
      },
    );
  }, []);

  if (loading) {
    return (
      <CrudSection title={showAnnouncements ? "اطلاعیه‌ها" : "برنامه‌ها"}>
        <div className="flex min-h-32 items-center justify-center">
          <div className="size-9 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
        </div>
      </CrudSection>
    );
  }

  if (showAnnouncements) {
    return (
      <CrudSection title="اطلاعیه‌ها" description="اطلاعیه‌های مربوط به فرزند شما در این بخش نمایش داده می‌شود.">
        {announcements.length === 0 ? (
          <EmptyState text="اطلاعیه‌ای برای نمایش وجود ندارد." />
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-sm">
                <h3 className="text-base font-black text-[#062452]">{a.title}</h3>
                {a.summary ? <p className="mt-2 text-sm font-bold text-slate-500">{a.summary}</p> : null}
              </div>
            ))}
          </div>
        )}
      </CrudSection>
    );
  }

  return (
    <CrudSection title="برنامه‌ها" description="برنامه‌های آموزشی فرزند شما در این بخش نمایش داده می‌شود.">
      {programs.length === 0 ? (
        <EmptyState text="برنامه‌ای برای نمایش وجود ندارد." />
      ) : (
        <div className="space-y-3">
          {programs.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-sm">
              <div>
                <h3 className="text-base font-black text-[#062452]">{p.title}</h3>
                {p.description ? <p className="mt-1 text-sm font-bold text-slate-500">{p.description}</p> : null}
              </div>
              {p.date ? <span className="shrink-0 text-xs font-black text-emerald-700">{p.date}</span> : null}
            </div>
          ))}
        </div>
      )}
    </CrudSection>
  );
}

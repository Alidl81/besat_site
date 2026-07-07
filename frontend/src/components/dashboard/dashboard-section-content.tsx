"use client";

import { useEffect, useState } from "react";
import { readBesatSession } from "@/lib/auth/auth-session";
import { ContentManager } from "@/components/crud/content-manager";
import { UnitsManager } from "@/components/crud/units-manager";
import { UsersManager } from "@/components/crud/users-manager";
import { GalleryManager } from "@/components/crud/gallery-manager";
import { HomeSliderManager } from "@/components/crud/home-slider-manager";
import { RegistrationsManager } from "@/components/crud/registrations-manager";
import { DepartmentsManager } from "@/components/crud/departments-manager";
import { MessagingPanel } from "@/components/crud/messaging-panel";
import { StaticPageEditor } from "@/components/crud/static-page-editor";
import { StudentsManager, StaffManager, ClassesManager, ProgramsManager } from "@/components/crud/simple-managers";
import { PanelProfileContent } from "@/components/dashboard/panel-profile-content";
import { ParentChildrenView, ParentProgramsView } from "@/components/crud/parent-views";

type DashboardSectionContentProps = {
  panel: "admin" | "unitManager" | "media" | "parents";
  sectionKey: string;
  roleTitle: string;
};

export function DashboardSectionContent({
  panel,
  sectionKey,
  roleTitle,
}: DashboardSectionContentProps) {
  const [unitId, setUnitId] = useState<string | null>(null);

  useEffect(() => {
    const session = readBesatSession();
    setUnitId(session?.unitId ?? null);
  }, []);

  const scopedUnitId = panel === "admin" ? null : unitId;
  const canPublish = panel !== "media";

  // ---- پروفایل (مشترک همه پنل‌ها) ----
  if (sectionKey === "profile") {
    return (
      <div className="mt-5">
        <PanelProfileContent roleTitle={roleTitle} />
      </div>
    );
  }

  // ---- پیام‌ها (مشترک همه پنل‌ها) ----
  if (sectionKey === "messages") {
    return <MessagingPanel />;
  }

  // ---- پنل مدیرکل ----
  if (panel === "admin") {
    switch (sectionKey) {
      case "units":
        return <UnitsManager />;
      case "departments":
        return <DepartmentsManager />;
      case "users":
        return <UsersManager />;
      case "content":
        return (
          <div className="space-y-6">
            <ContentManager kind="news" authorRole="general_manager" />
            <ContentManager kind="announcement" authorRole="general_manager" />
          </div>
        );
      case "media":
        return <GalleryManager />;
      case "gallery":
        return <GalleryManager />;
      case "home-slider":
        return <HomeSliderManager />;
      case "registrations":
      case "requests":
        return <RegistrationsManager />;
      case "pages":
        return <StaticPageEditor slug="about" />;
      default:
        return null;
    }
  }

  // ---- پنل مدیر واحد ----
  if (panel === "unitManager") {
    switch (sectionKey) {
      case "classes":
        return <ClassesManager unitId={scopedUnitId} />;
      case "students":
        return <StudentsManager unitId={scopedUnitId} />;
      case "staff":
        return <StaffManager unitId={scopedUnitId} />;
      case "programs":
        return <ProgramsManager unitId={scopedUnitId} />;
      case "attendance":
        return <StudentsManager unitId={scopedUnitId} />;
      case "announcements":
        return <ContentManager kind="announcement" unitId={scopedUnitId} authorRole="unit_manager" />;
      case "content":
        return (
          <div className="space-y-6">
            <ContentManager kind="news" unitId={scopedUnitId} authorRole="unit_manager" />
            <ContentManager kind="announcement" unitId={scopedUnitId} authorRole="unit_manager" />
          </div>
        );
      case "media":
        return <GalleryManager unitId={scopedUnitId} />;
      case "requests":
        return <RegistrationsManager unitId={scopedUnitId} />;
      default:
        return null;
    }
  }

  // ---- پنل همکار رسانه ----
  if (panel === "media") {
    switch (sectionKey) {
      case "news":
        return <ContentManager kind="news" unitId={scopedUnitId} authorRole="unit_media" canPublish={false} />;
      case "announcements":
        return <ContentManager kind="announcement" unitId={scopedUnitId} authorRole="unit_media" canPublish={false} />;
      case "media":
      case "gallery":
      case "albums":
        return <GalleryManager unitId={scopedUnitId} canPublish={false} />;
      case "review":
        return (
          <div className="space-y-6">
            <ContentManager kind="news" unitId={scopedUnitId} authorRole="unit_media" canPublish={false} />
            <ContentManager kind="announcement" unitId={scopedUnitId} authorRole="unit_media" canPublish={false} />
          </div>
        );
      default:
        return null;
    }
  }

  // ---- پنل والدین ----
  if (panel === "parents") {
    switch (sectionKey) {
      case "children":
        return <ParentChildrenView />;
      case "programs":
        return <ParentProgramsView />;
      case "announcements":
        return <ParentProgramsView showAnnouncements />;
      case "registration":
        return <RegistrationsManager />;
      case "gallery":
        return <ParentProgramsView />;
      default:
        return null;
    }
  }

  void canPublish;
  return null;
}

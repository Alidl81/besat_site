"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { readBesatSession } from "@/lib/auth/auth-session";
import { UnitsManager } from "@/components/crud/units-manager";
import { UsersManager } from "@/components/crud/users-manager";
import { GalleryManager } from "@/components/crud/gallery-manager";
import { MessagingPanel } from "@/components/crud/messaging-panel";
import { StaticPageEditor } from "@/components/crud/static-page-editor";
import { StaffManager } from "@/components/crud/simple-managers";
import { ParentProgramsView } from "@/components/crud/parent-views";
import { PanelProfileContent } from "@/components/dashboard/panel-profile-content";
import { EditorialWorkspace } from "@/components/dashboard/editorial-workspace";
import { ManagementStudentsWorkspace } from "@/components/dashboard/management-students-workspace";
import { ParentChildrenWorkspace } from "@/components/dashboard/parent-children-workspace";
import { RegistrationWorkspace } from "@/components/dashboard/registration-workspace";
import {
  EventsWorkspace,
  ManagementReportsWorkspace,
  ParentRegistrationWorkspace,
  ServicesWorkspace,
  SettingsWorkspace,
} from "@/components/dashboard/supplementary-workspaces";

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
  const searchParams = useSearchParams();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setUnitId(readBesatSession()?.unitId ?? null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const scopedUnitId = searchParams.get("unit") ?? (panel === "admin" ? null : unitId);

  if (sectionKey === "profile") return <PanelProfileContent roleTitle={roleTitle} />;
  if (sectionKey === "messages") return <MessagingPanel />;

  if (panel === "admin") {
    switch (sectionKey) {
      case "events":
        return <EventsWorkspace />;
      case "announcements":
        return <EditorialWorkspace unitId={scopedUnitId} authorRole="general_manager" initialKind="announcement" />;
      case "reports":
        return <ManagementReportsWorkspace />;
      case "settings":
        return <SettingsWorkspace />;
      case "units":
        return <UnitsManager />;
      case "students":
        return <ManagementStudentsWorkspace unitId={scopedUnitId} />;
      case "staff":
        return <StaffManager unitId={scopedUnitId} />;
      case "services":
        return <ServicesWorkspace />;
      case "content":
        return <EditorialWorkspace unitId={scopedUnitId} authorRole="general_manager" />;
      case "gallery":
        return <GalleryManager unitId={scopedUnitId} />;
      case "pages":
        return <StaticPageEditor slug="about" />;
      case "registrations":
        return <RegistrationWorkspace />;
      case "users":
        return <UsersManager />;
      default:
        return null;
    }
  }

  if (panel === "unitManager") {
    switch (sectionKey) {
      case "students":
        return <ManagementStudentsWorkspace unitId={scopedUnitId} />;
      case "staff":
        return <StaffManager unitId={scopedUnitId} />;
      case "content":
        return <EditorialWorkspace unitId={scopedUnitId} authorRole="unit_manager" canPublish={false} />;
      case "media":
        return <GalleryManager unitId={scopedUnitId} />;
      default:
        return null;
    }
  }

  if (panel === "media") {
    switch (sectionKey) {
      case "content":
        return <EditorialWorkspace unitId={scopedUnitId} authorRole="unit_media" canPublish={false} />;
      case "news":
        return <EditorialWorkspace unitId={scopedUnitId} authorRole="unit_media" canPublish={false} initialKind="news" />;
      case "announcements":
        return <EditorialWorkspace unitId={scopedUnitId} authorRole="unit_media" canPublish={false} initialKind="announcement" />;
      case "media":
      case "albums":
        return <GalleryManager unitId={scopedUnitId} canPublish={false} />;
      case "review":
        return <EditorialWorkspace unitId={scopedUnitId} authorRole="unit_media" canPublish={false} reviewOnly />;
      case "services":
        return <ServicesWorkspace />;
      default:
        return null;
    }
  }

  if (panel === "parents") {
    switch (sectionKey) {
      case "children":
        return <ParentChildrenWorkspace />;
      case "programs":
        return <ParentProgramsView />;
      case "registration":
        return <ParentRegistrationWorkspace />;
      case "services":
        return <ServicesWorkspace parent />;
      default:
        return null;
    }
  }

  return null;
}

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
  panel: "admin" | "contentManager" | "parents";
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

  const session = readBesatSession();
  const userRole = session?.role;
  const scopedUnitId = searchParams.get("unit") ?? (
    userRole === "unit_manager" || userRole === "unit_media" ? unitId : null
  );
  const canPublishContent = userRole === "general_manager";

  if (sectionKey === "profile") return <PanelProfileContent roleTitle={roleTitle} />;
  if (sectionKey === "messages") return <MessagingPanel />;

  if (panel === "admin") {
    switch (sectionKey) {
      case "events":
        return <EventsWorkspace />;
      case "announcements":
        return <EditorialWorkspace unitId={scopedUnitId} authorRole="general_manager" canPublish={canPublishContent} initialKind="announcement" />;
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
        return <EditorialWorkspace unitId={scopedUnitId} authorRole="general_manager" canPublish={canPublishContent} />;
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

  if (panel === "contentManager") {
    switch (sectionKey) {
      case "content":
        return <EditorialWorkspace unitId={scopedUnitId} authorRole="unit_media" canPublish={canPublishContent} />;
      case "news":
        return <EditorialWorkspace unitId={scopedUnitId} authorRole="unit_media" canPublish={canPublishContent} initialKind="news" />;
      case "announcements":
        return <EditorialWorkspace unitId={scopedUnitId} authorRole="unit_media" canPublish={canPublishContent} initialKind="announcement" />;
      case "calendar":
        return <EventsWorkspace />;
      case "media":
      case "albums":
        return <GalleryManager unitId={scopedUnitId} canPublish={false} />;
      case "review":
        return <EditorialWorkspace unitId={scopedUnitId} authorRole="unit_media" canPublish={canPublishContent} reviewOnly />;
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

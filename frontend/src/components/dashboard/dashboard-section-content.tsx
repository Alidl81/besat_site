"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { readBesatSession } from "@/lib/auth/auth-session";
import { UnitsManager } from "@/components/crud/units-manager";
import { UsersManager } from "@/components/crud/users-manager";
import { GalleryManager } from "@/components/crud/gallery-manager";
import { MessagingPanel } from "@/components/crud/messaging-panel";
import { ParentProgramsView } from "@/components/crud/parent-views";
import { PanelProfileContent } from "@/components/dashboard/panel-profile-content";
import { EditorialWorkspace } from "@/components/dashboard/editorial-workspace";
import { EventsCalendar } from "@/components/dashboard/events-calendar";
import { ParentChildrenWorkspace } from "@/components/dashboard/parent-children-workspace";
import { RegistrationWorkspace } from "@/components/dashboard/registration-workspace";
import { PanelEmpty } from "@/components/dashboard/panel-request-state";
import { ShopCategoriesManager } from "@/components/shop/admin/shop-categories-manager";
import { ShopEnrollmentsManager } from "@/components/shop/admin/shop-enrollments-manager";
import { ShopOrdersManager } from "@/components/shop/admin/shop-orders-manager";
import { ShopProductsManager } from "@/components/shop/admin/shop-products-manager";
import { ShopSettingsManager } from "@/components/shop/admin/shop-settings-manager";
import { ShopShippingManager } from "@/components/shop/admin/shop-shipping-manager";
import type { AccountRole } from "@/lib/data/domain-types";
import {
  ParentRegistrationWorkspace,
  ServicesWorkspace,
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
  const contentAuthorRole: AccountRole =
    userRole === "general_manager"
    || userRole === "unit_manager"
    || userRole === "unit_media"
    || userRole === "parent"
      ? userRole
      : "unit_media";
  const scopedUnitId = searchParams.get("unit") ?? (
    userRole === "unit_manager" || userRole === "unit_media" ? unitId : null
  );
  const canPublishContent = userRole === "general_manager";

  if (sectionKey === "profile") return <PanelProfileContent roleTitle={roleTitle} />;
  if (sectionKey === "messages") return <MessagingPanel />;

  if (panel === "admin") {
    switch (sectionKey) {
      case "events":
        return <EventsCalendar />;
      case "announcements":
        return <EditorialWorkspace unitId={scopedUnitId} authorRole="general_manager" canPublish={canPublishContent} initialKind="announcement" />;
      case "settings":
        return (
          <PanelEmpty title="تنظیمات مدیریتی تا زمان ارائه API نوشتنیِ تأییدشده در دسترس نیست." />
        );
      case "units":
        return <UnitsManager />;
      case "services":
        return <ServicesWorkspace />;
      case "content":
        return <EditorialWorkspace unitId={scopedUnitId} authorRole="general_manager" canPublish={canPublishContent} />;
      case "gallery":
        return <GalleryManager unitId={scopedUnitId} />;
      case "registrations":
        return <RegistrationWorkspace />;
      case "users":
        return <UsersManager />;
      case "shopProducts":
        return <ShopProductsManager mode="admin" />;
      case "shopCategories":
        return <ShopCategoriesManager />;
      case "shopOrders":
        return <ShopOrdersManager />;
      case "shopShipping":
        return <ShopShippingManager />;
      case "shopEnrollments":
        return <ShopEnrollmentsManager />;
      case "shopSettings":
        return <ShopSettingsManager />;
      default:
        return <PanelEmpty title="بخش درخواستی در دسترس نیست." />;
    }
  }

  if (panel === "contentManager") {
    switch (sectionKey) {
      case "content":
        return <EditorialWorkspace unitId={scopedUnitId} authorRole={contentAuthorRole} canPublish={canPublishContent} />;
      case "news":
        return <EditorialWorkspace unitId={scopedUnitId} authorRole={contentAuthorRole} canPublish={canPublishContent} initialKind="news" />;
      case "announcements":
        return <EditorialWorkspace unitId={scopedUnitId} authorRole={contentAuthorRole} canPublish={canPublishContent} initialKind="announcement" />;
      case "calendar":
        return <EventsCalendar />;
      case "media":
      case "albums":
        return <GalleryManager unitId={scopedUnitId} canPublish={false} />;
      case "review":
        return <EditorialWorkspace unitId={scopedUnitId} authorRole={contentAuthorRole} canPublish={canPublishContent} reviewOnly />;
      case "shopProducts":
        return <ShopProductsManager mode="media" />;
      case "services":
        return <ServicesWorkspace />;
      default:
        return <PanelEmpty title="بخش درخواستی در دسترس نیست." />;
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
        return <PanelEmpty title="بخش درخواستی در دسترس نیست." />;
    }
  }

  return <PanelEmpty title="بخش درخواستی در دسترس نیست." />;
}

import "server-only";

import type { MockAccount, MockDatabase, MockRecord } from "@/lib/mock-api/types";
import { namedRecord } from "@/lib/mock-api/helpers";

export function accountUser(account: MockAccount) {
  return {
    id: account.id,
    username: account.username,
    email: account.email,
    full_name: account.full_name,
    phone: account.phone,
    avatar: account.avatar,
    role: account.role,
    role_display: account.role_display,
    unit_id: account.unit_id,
    redirect_path: account.redirect_path,
    is_staff: account.role !== "parent",
    is_superuser: account.role === "general_manager",
  };
}

export function accountProfile(account: MockAccount) {
  return {
    ...accountUser(account),
    description: "حساب موقت برای آزمایش رابط پنل",
    is_active: account.is_active,
    created_at: account.created_at,
    updated_at: account.updated_at,
  };
}

export function accountPermissions(account: MockAccount) {
  const isAdmin = account.role === "general_manager";
  const isManager = account.role === "unit_manager";
  const isMedia = account.role === "unit_media";
  const isParent = account.role === "parent";

  return {
    role: account.role,
    role_display: account.role_display,
    redirect_path: account.redirect_path,
    is_staff: !isParent,
    is_superuser: isAdmin,
    permissions: {
      can_access_general_manager_panel: isAdmin,
      can_access_unit_manager_panel: isManager,
      can_access_media_panel: isMedia,
      can_access_parent_panel: isParent,
      can_manage_all_units: isAdmin,
      can_manage_unit_content: isAdmin || isManager || isMedia,
      can_manage_media: isAdmin || isManager || isMedia,
      can_manage_news: isAdmin || isManager || isMedia,
      can_manage_announcements: isAdmin || isManager || isMedia,
      can_manage_gallery: isAdmin || isManager || isMedia,
      can_review_content: isAdmin || isManager,
      can_publish_content: isAdmin || isManager,
      can_view_dashboard: true,
    },
    django_permissions: [],
  };
}

export function panelContent(record: MockRecord, database: MockDatabase) {
  const author =
    database.users.find(
      (user) => String(user.id) === String(record.author_id ?? ""),
    ) ?? null;

  return {
    ...record,
    cover_image_url: record.cover_image_url ?? record.cover_image ?? null,
    unit: namedRecord(database.units, record.unit_id),
    category: namedRecord(database.content_categories, record.category_id),
    author: author
      ? {
          id: author.id,
          full_name: author.full_name,
          avatar_url: author.avatar_url ?? null,
        }
      : null,
  };
}

export function publicContent(record: MockRecord, database: MockDatabase) {
  const category = namedRecord(database.content_categories, record.category_id);
  const unit = namedRecord(database.units, record.unit_id);
  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    summary: record.summary ?? null,
    content: record.body_html ?? "",
    image: record.cover_image ?? record.cover_image_url ?? null,
    category: category
      ? {
          ...category,
          slug:
            database.content_categories.find(
              (item) => String(item.id) === String(category.id),
            )?.slug ?? String(category.id),
        }
      : null,
    scope: record.scope,
    unit_id: record.unit_id ?? null,
    unit: unit
      ? {
          ...unit,
          slug:
            database.units.find(
              (item) => String(item.id) === String(unit.id),
            )?.slug ?? String(unit.id),
        }
      : null,
    status: record.status,
    is_featured: record.is_featured === true,
    is_important: record.is_important === true,
    priority: Number(record.priority ?? 0),
    is_published: record.status === "published",
    published_at: record.published_at ?? null,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

export function panelStudent(record: MockRecord, database: MockDatabase) {
  const unit = namedRecord(database.units, record.unit_id);

  return {
    ...record,
    unit,
    grade:
      record.grade_id && record.grade_title
        ? { id: record.grade_id, title: record.grade_title }
        : null,
    class_room:
      record.class_id && record.class_title
        ? { id: record.class_id, title: record.class_title }
        : null,
    guardian: record.guardian_full_name
      ? {
          id: record.guardian_id ?? null,
          full_name: record.guardian_full_name,
          phone: record.guardian_phone ?? null,
          email: record.guardian_email ?? null,
        }
      : null,
  };
}

export function panelRegistration(record: MockRecord, database: MockDatabase) {
  return {
    ...record,
    requested_grade:
      record.requested_grade_id && record.requested_grade_title
        ? {
            id: record.requested_grade_id,
            title: record.requested_grade_title,
          }
        : null,
    requested_unit: namedRecord(database.units, record.requested_unit_id),
    parent: {
      full_name: record.parent_full_name ?? "ثبت نشده",
      phone: record.parent_phone ?? null,
      email: record.parent_email ?? null,
    },
    documents: Array.isArray(record.documents) ? record.documents : [],
    timeline: Array.isArray(record.timeline) ? record.timeline : [],
  };
}

export function panelEvent(record: MockRecord, database: MockDatabase) {
  return {
    ...record,
    unit: namedRecord(database.units, record.unit_id),
  };
}

export function panelMessage(record: MockRecord) {
  return {
    id: record.id,
    sender: {
      id: record.sender_id ?? "system",
      full_name: record.sender_name ?? "سامانه موقت",
      role_display: record.sender_role ?? "سامانه",
    },
    recipient: {
      id: record.recipient_id ?? "unknown",
      full_name: record.recipient_name ?? "ثبت نشده",
      role_display: record.recipient_role ?? "ثبت نشده",
    },
    subject: record.subject,
    body: record.body,
    is_read: record.is_read,
    created_at: record.created_at,
  };
}

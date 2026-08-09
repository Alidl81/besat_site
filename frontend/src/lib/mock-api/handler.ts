import "server-only";

import {
  accountFromRequest,
  apiError,
  createRecord,
  csvResponse,
  filterRecords,
  isResponse,
  jsonResponse,
  paginatedResponse,
  requestPayload,
  requireAccount,
} from "@/lib/mock-api/helpers";
import {
  accountPermissions,
  accountProfile,
  accountUser,
  panelContent,
  panelEvent,
  panelMessage,
  panelRegistration,
  panelStudent,
  publicContent,
} from "@/lib/mock-api/serializers";
import {
  readMockDatabase,
  updateMockDatabase,
} from "@/lib/mock-api/store";
import type {
  MockAccount,
  MockDatabase,
  MockRecord,
} from "@/lib/mock-api/types";

type MockMediaAsset = {
  id: string;
  title: string;
  file_name: string;
  media_type: "image" | "video";
  content_type: string;
  size: number;
  alt_text: string;
  caption: string;
  unit: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  bytes: Uint8Array;
};

const mockMediaAssets = new Map<string, MockMediaAsset>();

type CollectionName =
  | "units"
  | "departments"
  | "users"
  | "content"
  | "gallery"
  | "achievements"
  | "home_slides"
  | "registration_requests"
  | "contact_messages"
  | "students"
  | "classes"
  | "staff"
  | "programs"
  | "events"
  | "services"
  | "internal_messages"
  | "static_pages";

const cmsCollections: Record<string, CollectionName> = {
  units: "units",
  departments: "departments",
  users: "users",
  content: "content",
  gallery: "gallery",
  achievements: "achievements",
  "home-slides": "home_slides",
  "registration-requests": "registration_requests",
  messages: "contact_messages",
  students: "students",
  classes: "classes",
  staff: "staff",
  programs: "programs",
  events: "events",
  services: "services",
  "internal-messages": "internal_messages",
  "static-pages": "static_pages",
};

function recordById(records: MockRecord[], id: string) {
  return records.find((record) => String(record.id) === id) ?? null;
}

function unitRecordsForAccount(
  records: MockRecord[],
  account: MockAccount,
  field = "unit_id",
) {
  if (account.role === "general_manager" || account.role === "parent") {
    return records;
  }

  return records.filter(
    (record) =>
      record[field] === null ||
      record[field] === undefined ||
      String(record[field]) === String(account.unit_id),
  );
}

function accountUnits(database: MockDatabase, account: MockAccount) {
  const units =
    account.role === "general_manager"
      ? database.units
      : database.units.filter(
          (unit) => String(unit.id) === String(account.unit_id),
        );

  return units.map((unit) => ({
    id: unit.id,
    title: unit.title,
    slug: unit.slug,
    role: account.role,
  }));
}

function contentSummary(records: MockRecord[]) {
  return {
    drafts: records.filter((record) => record.status === "draft").length,
    waiting_review: records.filter(
      (record) => record.status === "waiting_review",
    ).length,
    scheduled: records.filter((record) => record.status === "scheduled").length,
    published: records.filter((record) => record.status === "published").length,
  };
}

function registrationSummary(records: MockRecord[]) {
  return {
    total: records.length,
    reviewing: records.filter((record) => record.status === "reviewing").length,
    accepted: records.filter((record) => record.status === "accepted").length,
    rejected: records.filter((record) => record.status === "rejected").length,
    needs_documents: records.filter(
      (record) => record.status === "needs_documents",
    ).length,
  };
}

function studentSummary(records: MockRecord[]) {
  return {
    total: records.length,
    completed_profiles: records.filter(
      (record) => record.profile_status === "complete",
    ).length,
    new_this_year: records.filter((record) =>
      String(record.enrolled_at ?? "").startsWith("2026"),
    ).length,
    incomplete_profiles: records.filter(
      (record) => record.profile_status === "incomplete",
    ).length,
  };
}

function dashboardUnits(database: MockDatabase, account: MockAccount) {
  return accountUnits(database, account).map((unit) => ({
    id: unit.id,
    title: unit.title,
    students_count: database.students.filter(
      (student) => String(student.unit_id) === String(unit.id),
    ).length,
    staff_count: database.staff.filter(
      (staff) => String(staff.unit_id) === String(unit.id),
    ).length,
    new_registrations_count: database.registration_requests.filter(
      (registration) =>
        String(registration.requested_unit_id) === String(unit.id),
    ).length,
    published_content_count: database.content.filter(
      (content) =>
        String(content.unit_id) === String(unit.id) &&
        content.status === "published",
    ).length,
    is_active:
      database.units.find((record) => String(record.id) === String(unit.id))
        ?.is_active === true,
  }));
}

function contentFeed(record: MockRecord) {
  return {
    id: record.id,
    title: record.title,
    description: record.summary ?? null,
    timestamp: record.published_at ?? record.updated_at ?? null,
    status: record.status ?? null,
    href:
      record.kind === "announcement"
        ? "/dashboard/admin/announcements"
        : "/dashboard/admin/content",
    avatar_url: null,
  };
}

function eventFeed(record: MockRecord) {
  return {
    id: record.id,
    title: record.title,
    description: record.description ?? null,
    timestamp: record.starts_at ?? null,
    status: record.status ?? null,
    href: "/dashboard/admin/events",
    avatar_url: null,
  };
}

function messageFeed(record: MockRecord) {
  return {
    id: record.id,
    title: record.subject,
    description: record.body,
    timestamp: record.created_at ?? null,
    status: record.is_read ? "خوانده‌شده" : "خوانده‌نشده",
    href: "/dashboard/admin/messages",
    avatar_url: null,
  };
}

function adminDashboard(database: MockDatabase, account: MockAccount) {
  const site = database.site_settings;
  const relevantMessages = database.internal_messages.filter(
    (message) =>
      String(message.recipient_id) === String(account.id) ||
      String(message.sender_id) === String(account.id),
  );

  return {
    current_date: new Date().toISOString(),
    metrics: [
      {
        key: "students",
        title: "دانش‌آموزان مجموعه",
        value: site.students_public_count ?? null,
        detail: "آمار عمومی اعلام‌شده در سایت رسمی",
        trend: null,
        tone: "blue",
        icon: "students",
      },
      {
        key: "staff",
        title: "معلمان و پرسنل",
        value: site.staff_public_count ?? null,
        detail: "آمار عمومی اعلام‌شده در سایت رسمی",
        trend: null,
        tone: "purple",
        icon: "staff",
      },
      {
        key: "titles",
        title: "عناوین کشوری",
        value: site.national_titles_public_count ?? null,
        detail: "آمار عمومی اعلام‌شده در سایت رسمی",
        trend: null,
        tone: "green",
        icon: "chart",
      },
      {
        key: "years",
        title: "سال سابقه",
        value: site.years_public_count ?? null,
        detail: "آمار عمومی اعلام‌شده در سایت رسمی",
        trend: null,
        tone: "amber",
        icon: "calendar",
      },
    ],
    messages: relevantMessages.slice(0, 5).map(messageFeed),
    events: database.events.slice(0, 5).map(eventFeed),
    announcements: database.content
      .filter(
        (content) =>
          content.kind === "announcement" && content.status === "published",
      )
      .slice(0, 5)
      .map(contentFeed),
    units: dashboardUnits(database, account),
  };
}

function mediaDashboard(database: MockDatabase, account: MockAccount) {
  const content = unitRecordsForAccount(database.content, account);
  const summary = contentSummary(content);
  const messages = database.internal_messages.filter(
    (message) =>
      String(message.recipient_id) === String(account.id) ||
      String(message.sender_id) === String(account.id),
  );

  return {
    current_date: new Date().toISOString(),
    metrics: [
      {
        key: "drafts",
        title: "پیش‌نویس",
        value: summary.drafts,
        detail: "بر اساس محتوای ثبت‌شده",
        trend: null,
        tone: "blue",
        icon: "document",
      },
      {
        key: "review",
        title: "در صف بررسی",
        value: summary.waiting_review,
        detail: "بر اساس محتوای ثبت‌شده",
        trend: null,
        tone: "amber",
        icon: "review",
      },
      {
        key: "scheduled",
        title: "زمان‌بندی‌شده",
        value: summary.scheduled,
        detail: "بر اساس محتوای ثبت‌شده",
        trend: null,
        tone: "purple",
        icon: "calendar",
      },
      {
        key: "published",
        title: "منتشرشده",
        value: summary.published,
        detail: "محتوای عمومی برگرفته از منابع رسمی",
        trend: null,
        tone: "green",
        icon: "check",
      },
    ],
    latest_content: content.slice(0, 8).map(contentFeed),
    messages: messages.slice(0, 5).map(messageFeed),
    calendar: content
      .filter((record) => record.scheduled_at)
      .map((record) => ({
        date: String(record.scheduled_at),
        status: record.status,
      })),
    storage: null,
  };
}

function parentDashboard(
  database: MockDatabase,
  account: MockAccount,
  url: URL,
) {
  const children = database.parent_children.filter(
    (child) => String(child.parent_id) === String(account.id),
  );
  const selectedId = url.searchParams.get("child");
  const selected =
    children.find((child) => String(child.id) === selectedId) ??
    children[0] ??
    null;
  const childSummary = selected
    ? {
        id: selected.id,
        full_name: selected.full_name,
        avatar_url: selected.avatar_url ?? null,
        grade_title: selected.grade_title ?? null,
        class_title: selected.class_title ?? null,
        major: selected.major ?? null,
        unit_title: selected.unit_title ?? null,
        is_active: selected.is_active === true,
      }
    : null;
  const attendance =
    selected?.attendance && typeof selected.attendance === "object"
      ? selected.attendance
      : null;
  const exams = Array.isArray(selected?.exams) ? selected.exams : [];
  const assignments = Array.isArray(selected?.assignments)
    ? selected.assignments
    : [];
  const schedule = Array.isArray(selected?.schedule) ? selected.schedule : [];

  return {
    current_date: new Date().toISOString(),
    metrics: [
      {
        key: "average",
        title: "معدل",
        value: selected?.average ?? null,
        detail: selected ? "بر اساس پرونده آموزشی" : "فرزندی انتخاب نشده است",
        trend: null,
        tone: "green",
        icon: "chart",
      },
      {
        key: "attendance",
        title: "حضور",
        value:
          attendance &&
          "attendance_percent" in attendance &&
          typeof attendance.attendance_percent === "number"
            ? `${attendance.attendance_percent}%`
            : null,
        detail: selected ? "بر اساس پرونده آموزشی" : "فرزندی انتخاب نشده است",
        trend: null,
        tone: "blue",
        icon: "calendar",
      },
      {
        key: "exams",
        title: "آزمون پیش رو",
        value: exams.length,
        detail: selected ? "بر اساس برنامه آموزشی" : "فرزندی انتخاب نشده است",
        trend: null,
        tone: "amber",
        icon: "document",
      },
      {
        key: "assignments",
        title: "تکلیف جاری",
        value: assignments.length,
        detail: selected ? "بر اساس برنامه آموزشی" : "فرزندی انتخاب نشده است",
        trend: null,
        tone: "purple",
        icon: "clipboard",
      },
    ],
    selected_child: childSummary,
    today_schedule: schedule,
    next_exam: exams[0] ?? null,
    current_assignment: assignments[0] ?? null,
    attendance,
    events: database.events.map(eventFeed),
    teacher_messages: selected?.counselor_message
      ? [selected.counselor_message]
      : [],
    quick_links: [
      {
        id: "quick-children",
        title: "پرونده فرزند",
        href: "/dashboard/parents/children",
        icon: "children",
      },
      {
        id: "quick-programs",
        title: "برنامه‌ها",
        href: "/dashboard/parents/programs",
        icon: "programs",
      },
      {
        id: "quick-messages",
        title: "پیام‌ها",
        href: "/dashboard/parents/messages",
        icon: "message",
      },
    ],
  };
}

function panelContext(
  database: MockDatabase,
  account: MockAccount,
  url: URL,
) {
  const units = accountUnits(database, account);
  const children = database.parent_children
    .filter((child) => String(child.parent_id) === String(account.id))
    .map((child) => ({
      id: child.id,
      title: child.full_name,
      subtitle: child.grade_title ?? null,
      avatar_url: child.avatar_url ?? null,
    }));
  const academicYears = Array.isArray(database.settings.academic_years)
    ? database.settings.academic_years
    : [];

  return {
    user: {
      id: account.id,
      full_name: account.full_name,
      role_display: account.role_display,
      avatar_url: account.avatar,
    },
    academic_years: academicYears.map((year, index) => ({
      ...(year as Record<string, unknown>),
      is_current:
        String((year as Record<string, unknown>).id) ===
        String(database.settings.current_academic_year_id),
      order: index,
    })),
    selected_academic_year_id:
      url.searchParams.get("academic_year") ??
      database.settings.current_academic_year_id ??
      null,
    units: units.map(({ id, title }) => ({ id, title })),
    selected_unit_id:
      url.searchParams.get("unit") ?? account.unit_id ?? units[0]?.id ?? null,
    children,
    selected_child_id:
      url.searchParams.get("child") ?? children[0]?.id ?? null,
    unread_notifications: database.content.filter(
      (content) => content.status === "waiting_review",
    ).length,
    unread_messages: database.internal_messages.filter(
      (message) =>
        String(message.recipient_id) === String(account.id) &&
        message.is_read === false,
    ).length,
    current_date: new Date().toISOString(),
  };
}

function genericRecordResponse(
  collection: CollectionName,
  record: MockRecord,
  database: MockDatabase,
  panelShape: boolean,
) {
  if (collection === "students" && panelShape) {
    return panelStudent(record, database);
  }
  if (collection === "registration_requests" && panelShape) {
    return panelRegistration(record, database);
  }
  if (collection === "content" && panelShape) {
    return panelContent(record, database);
  }
  if (collection === "events" && panelShape) {
    return panelEvent(record, database);
  }
  if (collection === "internal_messages" && panelShape) {
    return panelMessage(record);
  }
  if (collection === "content") {
    return {
      ...record,
      category: record.category_title ?? null,
      cover_image: record.cover_image ?? record.cover_image_url ?? null,
    };
  }
  return record;
}

async function genericCms(
  request: Request,
  path: string[],
  database: MockDatabase,
  account: MockAccount,
) {
  const collection = cmsCollections[path[1]];
  if (!collection) return apiError("endpoint موقت پیدا نشد.", 404, "not_found");
  const id = path[2];
  const panelShape =
    request.method !== "GET" ||
    new URL(request.url).searchParams.has("page") ||
    Boolean(id);

  if (request.method === "GET") {
    const records = unitRecordsForAccount(
      database[collection] as MockRecord[],
      account,
      collection === "registration_requests"
        ? "requested_unit_id"
        : "unit_id",
    );
    if (id) {
      const record = recordById(records, id);
      return record
        ? jsonResponse(
            genericRecordResponse(collection, record, database, panelShape),
          )
        : apiError("رکورد در دیتابیس موقت پیدا نشد.", 404, "not_found");
    }
    const filtered = filterRecords(records, new URL(request.url));
    return jsonResponse(
      paginatedResponse(filtered, new URL(request.url), (record) =>
        genericRecordResponse(collection, record, database, panelShape),
      ),
    );
  }

  const payload = await requestPayload(request);

  if (request.method === "POST" && !id) {
    return updateMockDatabase((current) => {
      const normalized =
        collection === "content"
          ? {
              status: "draft",
              slug: `content-${Date.now()}`,
              author_id:
                current.users.find(
                  (user) => user.username === account.username,
                )?.id ?? null,
              author_role: account.role,
              cover_image: payload.cover_image_url ?? null,
              ...payload,
            }
          : payload;
      const created = createRecord(collection, normalized);
      (current[collection] as MockRecord[]).unshift(created);
      return jsonResponse(
        genericRecordResponse(collection, created, current, true),
        201,
      );
    });
  }

  if (!id) return apiError("شناسه رکورد ارسال نشده است.", 400, "missing_id");

  if (request.method === "PATCH" || request.method === "PUT") {
    return updateMockDatabase((current) => {
      const records = current[collection] as MockRecord[];
      const index = records.findIndex((record) => String(record.id) === id);
      if (index < 0) {
        return apiError("رکورد در دیتابیس موقت پیدا نشد.", 404, "not_found");
      }
      records[index] = {
        ...records[index],
        ...payload,
        ...(collection === "content" && "cover_image_url" in payload
          ? { cover_image: payload.cover_image_url }
          : {}),
        updated_at: new Date().toISOString(),
      };
      return jsonResponse(
        genericRecordResponse(collection, records[index], current, true),
      );
    });
  }

  if (request.method === "DELETE") {
    return updateMockDatabase((current) => {
      const records = current[collection] as MockRecord[];
      const index = records.findIndex((record) => String(record.id) === id);
      if (index < 0) {
        return apiError("رکورد در دیتابیس موقت پیدا نشد.", 404, "not_found");
      }
      if (collection === "content") {
        current.content_revisions = current.content_revisions.filter(
          (revision) => String(revision.content_id) !== String(records[index].id),
        );
      }
      records.splice(index, 1);
      return new Response(null, { status: 204 });
    });
  }

  return apiError("متد برای این endpoint پشتیبانی نمی‌شود.", 405, "method_not_allowed");
}

async function registrationAction(
  request: Request,
  id: string,
  action: string,
  account: MockAccount,
) {
  const payload = await requestPayload(request);
  const statusMap: Record<string, string> = {
    approve: "accepted",
    reject: "rejected",
    "request-documents": "needs_documents",
  };

  return updateMockDatabase((database) => {
    const record = recordById(database.registration_requests, id);
    if (!record) {
      return apiError("درخواست ثبت‌نام پیدا نشد.", 404, "not_found");
    }
    if (statusMap[action]) record.status = statusMap[action];
    record.updated_at = new Date().toISOString();
    const timeline = Array.isArray(record.timeline) ? record.timeline : [];
    timeline.unshift({
      id: `timeline-${crypto.randomUUID()}`,
      title:
        action === "contact"
          ? "ارتباط با والد ثبت شد"
          : action === "approve"
            ? "درخواست تأیید شد"
            : action === "reject"
              ? "درخواست رد شد"
              : "تکمیل مدارک درخواست شد",
      created_at: record.updated_at,
      actor_name: account.full_name,
      note: payload.note ?? null,
    });
    record.timeline = timeline;
    return jsonResponse(panelRegistration(record, database));
  });
}

async function contentAction(
  request: Request,
  id: string,
  action: string,
  account: MockAccount,
) {
  if (
    account.role === "unit_media" &&
    ["approve", "publish", "schedule"].includes(action)
  ) {
    return apiError(
      "مسئول رسانه در محیط موقت نیز اجازه انتشار مستقیم ندارد.",
      403,
      "permission_denied",
    );
  }

  const payload = await requestPayload(request);
  const statusMap: Record<string, string> = {
    "submit-review": "waiting_review",
    approve: "approved",
    reject: "rejected",
    publish: "published",
    schedule: "scheduled",
  };
  if (!statusMap[action]) {
    return apiError("عملیات محتوا پیدا نشد.", 404, "not_found");
  }

  return updateMockDatabase((database) => {
    const record = recordById(database.content, id);
    if (!record) return apiError("محتوا پیدا نشد.", 404, "not_found");

    record.status = statusMap[action];

    if (action === "schedule") {
      record.scheduled_at = payload.scheduled_at ?? null;
    }
    if (action === "publish") {
      record.published_at = new Date().toISOString();
    }
    record.updated_at = new Date().toISOString();
    return jsonResponse(panelContent(record, database));
  });
}

function mockMediaPayload(asset: MockMediaAsset) {
  return {
    id: asset.id,
    title: asset.title,
    url: `/api/backend/mock-media/${encodeURIComponent(asset.id)}/${encodeURIComponent(asset.file_name)}`,
    media_type: asset.media_type,
    content_type: asset.content_type,
    size: asset.size,
    alt_text: asset.alt_text,
    caption: asset.caption,
    unit: asset.unit,
    uploaded_by: asset.uploaded_by,
    created_at: asset.created_at,
    updated_at: asset.updated_at,
  };
}

function listMockMedia(url: URL) {
  const unit = url.searchParams.get("unit");
  const mediaType = url.searchParams.get("media_type");
  const search = url.searchParams.get("search")?.trim().toLocaleLowerCase();
  const records = [...mockMediaAssets.values()].filter((asset) => {
    if (unit && asset.unit !== unit) return false;
    if (mediaType && asset.media_type !== mediaType) return false;
    if (search && !`${asset.title} ${asset.alt_text} ${asset.caption}`.toLocaleLowerCase().includes(search)) {
      return false;
    }
    return true;
  });

  return jsonResponse(
    paginatedResponse(
      records as unknown as MockRecord[],
      url,
      (record) => mockMediaPayload(record as unknown as MockMediaAsset),
    ),
  );
}

function readMockMedia(id: string) {
  const asset = mockMediaAssets.get(id);
  if (!asset) return apiError("رسانه پیدا نشد.", 404, "not_found");
  const body = asset.bytes.buffer.slice(
    asset.bytes.byteOffset,
    asset.bytes.byteOffset + asset.bytes.byteLength,
  ) as ArrayBuffer;
  return new Response(body, {
    headers: {
      "content-type": asset.content_type,
      "cache-control": "no-store",
    },
  });
}

async function uploadMedia(request: Request, account: MockAccount) {
  const form = await request.formData();
  const file = form.get("file");
  if (
    !file ||
    typeof file === "string" ||
    typeof file.arrayBuffer !== "function" ||
    typeof file.name !== "string"
  ) {
    return apiError("فایل ارسال نشده است.", 400, "missing_file");
  }
  const supportedMediaTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/ogg",
  ]);
  if (!supportedMediaTypes.has(file.type)) {
    return apiError("نوع فایل پشتیبانی نمی شود.", 415, "unsupported_media_type");
  }
  if (file.size > 25 * 1024 * 1024) {
    return apiError(
      "حجم فایل نباید بیشتر از 25 مگابایت باشد.",
      413,
      "file_too_large",
    );
  }
  const now = new Date().toISOString();
  const id = `media-${crypto.randomUUID()}`;
  const title = form.get("title");
  const altText = form.get("alt_text");
  const caption = form.get("caption");
  const unit = form.get("unit");
  const asset: MockMediaAsset = {
    id,
    title: typeof title === "string" && title.trim() ? title.trim() : file.name,
    file_name: file.name,
    media_type: file.type.startsWith("video/") ? "video" : "image",
    content_type: file.type,
    size: file.size,
    alt_text: typeof altText === "string" ? altText : "",
    caption: typeof caption === "string" ? caption : "",
    unit: typeof unit === "string" && unit ? unit : null,
    uploaded_by: account.full_name,
    created_at: now,
    updated_at: now,
    bytes: new Uint8Array(await file.arrayBuffer()),
  };
  mockMediaAssets.set(id, asset);
  return jsonResponse(mockMediaPayload(asset), 201);
}

async function importStudents(request: Request, account: MockAccount) {
  const form = await request.formData();
  const file = form.get("file");
  if (
    !file ||
    typeof file === "string" ||
    typeof file.arrayBuffer !== "function" ||
    typeof file.name !== "string"
  ) {
    return apiError("فایل ارسال نشده است.", 400, "missing_file");
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return apiError(
      "نسخه موقت فقط CSV را می‌خواند؛ بک‌اند اصلی می‌تواند XLSX را پردازش کند.",
      415,
      "mock_csv_only",
    );
  }

  const lines = (await file.text())
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const headers = lines.shift()?.split(",").map((item) => item.trim()) ?? [];
  const createdRecords = lines.map((line, index) => {
    const values = line.split(",").map((item) => item.trim());
    const input = Object.fromEntries(
      headers.map((header, headerIndex) => [header, values[headerIndex] ?? ""]),
    );
    return createRecord("students", {
      full_name: input.full_name || `دانش‌آموز واردشده ردیف ${index + 2}`,
      student_code: input.student_code || `CSV-${Date.now()}-${index + 1}`,
      national_code: input.national_code || null,
      unit_id: form.get("unit_id") || account.unit_id,
      grade_id: input.grade_id || null,
      grade_title: input.grade_title || null,
      class_id: null,
      class_title: null,
      major: input.major || null,
      profile_status: "incomplete",
      education_status: "active",
      guardian_full_name: null,
      enrolled_at: new Date().toISOString(),
    });
  });

  await updateMockDatabase((database) => {
    database.students.unshift(...createdRecords);
  });

  return jsonResponse({
    created: createdRecords.length,
    updated: 0,
    errors: [],
  });
}

function parentRegistration(record: MockRecord, database: MockDatabase) {
  const child = recordById(
    database.parent_children,
    String(record.child_id ?? ""),
  );
  return {
    ...record,
    child: child
      ? {
          id: child.id,
          full_name: child.full_name,
          avatar_url: child.avatar_url ?? null,
          grade_title: child.grade_title ?? null,
          class_title: child.class_title ?? null,
          major: child.major ?? null,
          unit_title: child.unit_title ?? null,
          is_active: child.is_active === true,
        }
      : null,
  };
}

export async function handleMockApiRequest(
  request: Request,
  path: string[],
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { allow: "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS" },
    });
  }

  const route = path.join("/");
  const url = new URL(request.url);
  const database = await readMockDatabase();

  if (path[0] === "mock-media" && path[1] && request.method === "GET") {
    return readMockMedia(path[1]);
  }

  if (route === "mock/status" && request.method === "GET") {
    return jsonResponse({
      mode: "mock",
      database: database._meta,
      counts: {
        units: database.units.length,
        public_content: database.content.filter(
          (content) => content.status === "published",
        ).length,
        demo_students: database.students.length,
      },
    });
  }

  if (route === "auth/login" && request.method === "POST") {
    const payload = await requestPayload(request);
    const account = database.accounts.find(
      (candidate) =>
        candidate.username === payload.username &&
        candidate.password === payload.password &&
        candidate.is_active,
    );
    if (!account) {
      return apiError(
        "نام کاربری یا رمز عبور صحیح نیست.",
        401,
        "invalid_credentials",
      );
    }
    return jsonResponse({
      access: `mock-access:${account.id}`,
      refresh: `mock-refresh:${account.id}`,
      user: accountUser(account),
      redirect_path: account.redirect_path,
    });
  }

  if (route === "auth/refresh" && request.method === "POST") {
    const payload = await requestPayload(request);
    const refresh = String(payload.refresh ?? "");
    const accountId = refresh.startsWith("mock-refresh:")
      ? refresh.slice("mock-refresh:".length)
      : "";
    const account = database.accounts.find(
      (candidate) => String(candidate.id) === accountId && candidate.is_active,
    );
    return account
      ? jsonResponse({
          access: `mock-access:${account.id}`,
          refresh: `mock-refresh:${account.id}`,
        })
      : apiError("refresh token معتبر نیست.", 401, "invalid_token");
  }

  if (route === "auth/logout" && request.method === "POST") {
    return new Response(null, { status: 204 });
  }

  const protectedRoute =
    route === "me" ||
    route.startsWith("me/") ||
    route.startsWith("dashboard/") ||
    route.startsWith("cms/") ||
    route.startsWith("parents/");
  const account = protectedRoute
    ? requireAccount(request, database)
    : accountFromRequest(request, database);
  if (isResponse(account)) return account;

  if (route === "me" && request.method === "GET" && account) {
    return jsonResponse(accountUser(account));
  }
  if (route === "me/profile" && request.method === "GET" && account) {
    return jsonResponse(accountProfile(account));
  }
  if (route === "me/profile" && request.method === "PATCH" && account) {
    const payload = await requestPayload(request);
    return updateMockDatabase((current) => {
      const target = current.accounts.find(
        (candidate) => String(candidate.id) === String(account.id),
      );
      if (!target) return apiError("حساب پیدا نشد.", 404, "not_found");
      Object.assign(target, payload, { updated_at: new Date().toISOString() });
      return jsonResponse(accountProfile(target));
    });
  }
  if (route === "me/profile/avatar" && request.method === "POST" && account) {
    const form = await request.formData();
    const avatar = form.get("avatar");
    if (!(avatar instanceof File)) {
      return apiError("فایل آواتار ارسال نشده است.", 400, "missing_file");
    }
    const dataUrl = `data:${avatar.type || "image/png"};base64,${Buffer.from(
      await avatar.arrayBuffer(),
    ).toString("base64")}`;
    return updateMockDatabase((current) => {
      const target = current.accounts.find(
        (candidate) => String(candidate.id) === String(account.id),
      );
      if (!target) return apiError("حساب پیدا نشد.", 404, "not_found");
      target.avatar = dataUrl;
      target.updated_at = new Date().toISOString();
      return jsonResponse(accountProfile(target));
    });
  }
  if (route === "me/permissions" && request.method === "GET" && account) {
    return jsonResponse(accountPermissions(account));
  }
  if (route === "me/units" && request.method === "GET" && account) {
    return jsonResponse(accountUnits(database, account));
  }
  if (route === "me/change-password" && request.method === "POST" && account) {
    const payload = await requestPayload(request);
    if (payload.current_password !== account.password) {
      return apiError("رمز عبور فعلی صحیح نیست.", 400, "invalid_password");
    }
    if (String(payload.new_password ?? "").length < 8) {
      return apiError(
        "رمز عبور جدید باید حداقل ۸ نویسه باشد.",
        400,
        "invalid_password",
      );
    }
    return updateMockDatabase((current) => {
      const target = current.accounts.find(
        (candidate) => String(candidate.id) === String(account.id),
      );
      if (!target) return apiError("حساب پیدا نشد.", 404, "not_found");
      target.password = String(payload.new_password);
      target.updated_at = new Date().toISOString();
      return jsonResponse({ detail: "رمز عبور با موفقیت تغییر کرد." });
    });
  }

  if (route === "dashboard/context" && request.method === "GET" && account) {
    return jsonResponse(panelContext(database, account, url));
  }
  if (
    ["dashboard/general-manager", "dashboard/unit-manager"].includes(route) &&
    request.method === "GET" &&
    account
  ) {
    return jsonResponse(adminDashboard(database, account));
  }
  if (route === "dashboard/media" && request.method === "GET" && account) {
    return jsonResponse(mediaDashboard(database, account));
  }
  if (route === "dashboard/parents" && request.method === "GET" && account) {
    return jsonResponse(parentDashboard(database, account, url));
  }

  if (route === "cms/students/summary" && request.method === "GET" && account) {
    const records = filterRecords(
      unitRecordsForAccount(database.students, account),
      url,
    );
    return jsonResponse(studentSummary(records));
  }
  if (route === "cms/students/export" && request.method === "GET" && account) {
    return csvResponse(
      filterRecords(unitRecordsForAccount(database.students, account), url),
      "besat-mock-students.csv",
    );
  }
  if (route === "cms/students/bulk-import" && request.method === "POST" && account) {
    return importStudents(request, account);
  }

  if (
    route === "cms/registration-requests/summary" &&
    request.method === "GET" &&
    account
  ) {
    const records = filterRecords(
      unitRecordsForAccount(
        database.registration_requests,
        account,
        "requested_unit_id",
      ),
      url,
    );
    return jsonResponse(registrationSummary(records));
  }
  if (
    path[0] === "cms" &&
    path[1] === "registration-requests" &&
    path[2] &&
    path[3] &&
    request.method === "POST" &&
    account
  ) {
    return registrationAction(request, path[2], path[3], account);
  }

  if (route === "cms/content/summary" && request.method === "GET" && account) {
    return jsonResponse(
      contentSummary(
        filterRecords(unitRecordsForAccount(database.content, account), url),
      ),
    );
  }
  if (route === "cms/content/categories" && request.method === "GET") {
    return jsonResponse(
      database.content_categories.map(({ id, title }) => ({ id, title })),
    );
  }
  if (
    path[0] === "cms" &&
    path[1] === "content" &&
    path[2] &&
    path[3] &&
    request.method === "POST" &&
    account
  ) {
    return contentAction(request, path[2], path[3], account);
  }
  if (route === "cms/media" && request.method === "GET" && account) {
    return listMockMedia(url);
  }
  if (route === "cms/media" && request.method === "POST" && account) {
    return uploadMedia(request, account);
  }

  if (route === "cms/services" && request.method === "GET") {
    const audience = url.searchParams.get("audience");
    return jsonResponse(
      database.services.filter(
        (service) =>
          service.audience === "all" ||
          !audience ||
          service.audience === audience,
      ),
    );
  }
  if (route === "cms/reports/overview" && request.method === "GET" && account) {
    const dashboard = adminDashboard(database, account);
    return jsonResponse({
      metrics: dashboard.metrics,
      units: dashboard.units,
    });
  }
  if (route === "cms/reports/export" && request.method === "GET" && account) {
    return csvResponse(dashboardUnits(database, account), "besat-mock-report.csv");
  }
  if (route === "cms/settings" && request.method === "GET") {
    return jsonResponse({
      ...database.settings,
      units: database.units.map(({ id, title }) => ({ id, title })),
    });
  }
  if (route === "cms/settings" && request.method === "PATCH") {
    const payload = await requestPayload(request);
    return updateMockDatabase((current) => {
      Object.assign(current.settings, payload);
      return jsonResponse({
        ...current.settings,
        units: current.units.map(({ id, title }) => ({ id, title })),
      });
    });
  }

  if (
    route === "cms/internal-messages/recipients" &&
    request.method === "GET"
  ) {
    return jsonResponse(
      database.accounts.map((candidate) => ({
        id: candidate.id,
        full_name: candidate.full_name,
        role_display: candidate.role_display,
      })),
    );
  }
  if (
    path[0] === "cms" &&
    path[1] === "internal-messages" &&
    path[2] &&
    path[3] === "mark-read" &&
    request.method === "POST"
  ) {
    return updateMockDatabase((current) => {
      const message = recordById(current.internal_messages, path[2]);
      if (!message) return apiError("پیام پیدا نشد.", 404, "not_found");
      message.is_read = true;
      message.updated_at = new Date().toISOString();
      return jsonResponse(panelMessage(message));
    });
  }
  if (route === "cms/internal-messages" && request.method === "GET" && account) {
    const folder = url.searchParams.get("folder") ?? "inbox";
    const records = database.internal_messages.filter((message) =>
      folder === "sent"
        ? String(message.sender_id) === String(account.id)
        : String(message.recipient_id) === String(account.id),
    );
    return jsonResponse(
      paginatedResponse(records, url, (record) => panelMessage(record)),
    );
  }
  if (route === "cms/internal-messages" && request.method === "POST" && account) {
    const payload = await requestPayload(request);
    const recipient = database.accounts.find(
      (candidate) => String(candidate.id) === String(payload.recipient_id),
    );
    if (!recipient) {
      return apiError("گیرنده پیدا نشد.", 400, "invalid_recipient");
    }
    return updateMockDatabase((current) => {
      const record = createRecord("internal-messages", {
        sender_id: account.id,
        sender_name: account.full_name,
        sender_role: account.role,
        recipient_id: recipient.id,
        recipient_name: recipient.full_name,
        recipient_role: recipient.role,
        subject: payload.subject ?? "",
        body: payload.body ?? "",
        is_read: false,
        unit_id: account.unit_id,
      });
      current.internal_messages.unshift(record);
      return jsonResponse(panelMessage(record), 201);
    });
  }

  if (route === "parents/children" && request.method === "GET" && account) {
    return jsonResponse(
      database.parent_children
        .filter((child) => String(child.parent_id) === String(account.id))
        .map((child) => ({
          id: child.id,
          full_name: child.full_name,
          avatar_url: child.avatar_url ?? null,
          grade_title: child.grade_title ?? null,
          class_title: child.class_title ?? null,
          major: child.major ?? null,
          unit_title: child.unit_title ?? null,
          is_active: child.is_active === true,
        })),
    );
  }
  if (
    path[0] === "parents" &&
    path[1] === "children" &&
    path[2] &&
    request.method === "GET" &&
    account
  ) {
    const child = database.parent_children.find(
      (candidate) =>
        String(candidate.id) === path[2] &&
        String(candidate.parent_id) === String(account.id),
    );
    return child
      ? jsonResponse(child)
      : apiError("فرزند برای این والد پیدا نشد.", 404, "not_found");
  }
  if (route === "parents/programs" && request.method === "GET") {
    return jsonResponse(
      paginatedResponse(database.events, url, (event) =>
        panelEvent(event, database),
      ),
    );
  }
  if (route === "parents/registrations" && request.method === "GET" && account) {
    return jsonResponse(
      database.parent_registrations
        .filter(
          (registration) =>
            String(registration.parent_id) === String(account.id),
        )
        .map((registration) => parentRegistration(registration, database)),
    );
  }

  if (route === "site-settings" && request.method === "GET") {
    return jsonResponse(database.site_settings);
  }
  if (route === "home" && request.method === "GET") {
    return jsonResponse({
      settings: database.site_settings,
      slides: database.home_slides,
      units: database.units,
      latest_content: database.content
        .filter((content) => content.status === "published")
        .map((content) => publicContent(content, database)),
    });
  }
  if (route === "home/slides" && request.method === "GET") {
    return jsonResponse(
      database.home_slides
        .filter((slide) => slide.is_active !== false)
        .sort((left, right) => Number(left.order ?? 0) - Number(right.order ?? 0)),
    );
  }
  if (route === "about" && request.method === "GET") {
    const page = database.static_pages.find(
      (item) => item.slug === "about" && item.is_published !== false,
    );
    return jsonResponse({
      title: page?.title ?? null,
      description: page?.body_html ?? null,
      image: page?.image ?? null,
      meta_description: page?.meta_description ?? null,
      history: page?.history ?? null,
      founders: page?.founders ?? [],
      key_people: page?.key_people ?? [],
      mission: page?.mission ?? null,
      values: page?.values ?? [],
      goals: page?.goals ?? [],
      images: page?.images ?? [],
      video_url: page?.video_url ?? null,
      video_poster_url: page?.video_poster_url ?? null,
      video_title: page?.video_title ?? null,
      video_description: page?.video_description ?? null,
      video_caption: page?.video_caption ?? null,
    });
  }
  if (route === "contact" && request.method === "GET") {
    return jsonResponse({
      address: database.site_settings.address ?? null,
      phone: database.site_settings.phone ?? null,
      email: database.site_settings.email ?? null,
      title: database.site_settings.school_name ?? "تماس با ما",
      description: null,
      phone_secondary: database.site_settings.phone_secondary ?? null,
      working_hours: database.site_settings.working_hours ?? null,
      map_url: null,
      latitude: null,
      longitude: null,
    });
  }
  if ((route === "contact" || route === "messages") && request.method === "POST") {
    const payload = await requestPayload(request);
    return updateMockDatabase((current) => {
      const record = createRecord("contact-messages", {
        ...payload,
        is_read: false,
      });
      current.contact_messages.unshift(record);
      return jsonResponse(
          { message: "پیام با موفقیت ثبت شد.", id: record.id },
        201,
      );
    });
  }
  if (route === "registration" && request.method === "GET") {
    return jsonResponse({
      title: "پیش‌ثبت‌نام مدارس بعثت",
      description:
        "پیش‌ثبت‌نام در مقاطع اعلام‌شده و به‌صورت محدود انجام می‌شود.",
      is_open: true,
      open_message: null,
      closed_message: null,
      required_documents: [],
      notes: null,
    });
  }
  if (
    (route === "registration" || route === "registration-requests") &&
    request.method === "POST"
  ) {
    const payload = await requestPayload(request);
    const fullName = String(
      payload.student_full_name ?? payload.full_name ?? "",
    ).trim();
    const parentPhone = String(payload.parent_phone ?? "").trim();
    const unitId = payload.requested_unit ?? payload.unit_id ?? null;
    if (!fullName || !parentPhone || !unitId) {
      return apiError(
        "نام دانش‌آموز، شماره تماس ولی و واحد آموزشی الزامی است.",
        400,
        "validation_error",
      );
    }
    const unit = database.units.find(
      (item) => String(item.id) === String(unitId) && item.is_active !== false,
    );
    if (!unit || unit.accepts_registration === false) {
      return apiError(
        "واحد آموزشی انتخاب‌شده پیش‌ثبت‌نام فعال ندارد.",
        400,
        "registration_closed",
      );
    }
    return updateMockDatabase((current) => {
      const record = createRecord("registration-requests", {
        student_full_name: fullName,
        requested_grade_id: payload.requested_grade_id ?? null,
        requested_grade_title:
          payload.requested_grade_title ?? payload.requested_grade ?? null,
        requested_unit_id: unitId,
        parent_full_name: payload.parent_full_name ?? null,
        parent_phone: parentPhone,
        parent_email: payload.parent_email ?? null,
        description: payload.description ?? null,
        status: "new",
        documents: [],
        timeline: [],
      });
      current.registration_requests.unshift(record);
      return jsonResponse(
        { detail: "درخواست در دیتابیس موقت ثبت شد.", id: record.id },
        201,
      );
    });
  }

  if (route === "units" && request.method === "GET") {
    return jsonResponse(
      database.units.filter((unit) => unit.is_active !== false),
    );
  }
  if (path[0] === "units" && path[1] && request.method === "GET") {
    const unit = database.units.find((record) => record.slug === path[1]);
    return unit
      ? jsonResponse(unit)
      : apiError("واحد آموزشی پیدا نشد.", 404, "not_found");
  }
  if (route === "departments" && request.method === "GET") {
    return jsonResponse(paginatedResponse(database.departments, url));
  }
  if (path[0] === "departments" && path[1] && request.method === "GET") {
    const department = database.departments.find(
      (record) => record.slug === path[1],
    );
    return department
      ? jsonResponse(department)
      : apiError("بخش آموزشی پیدا نشد.", 404, "not_found");
  }
  if (route === "news/categories" && request.method === "GET") {
    return jsonResponse(
      paginatedResponse(database.content_categories, url),
    );
  }
  if (route === "news" && request.method === "GET") {
    return jsonResponse(
      paginatedResponse(
        database.content.filter(
          (record) => record.kind === "news" && record.status === "published",
        ),
        url,
        (record) => publicContent(record, database),
      ),
    );
  }
  if (path[0] === "news" && path[1] && request.method === "GET") {
    const content = database.content.find(
      (record) =>
        record.slug === path[1] &&
        record.kind === "news" &&
        record.status === "published",
    );
    return content
      ? jsonResponse(publicContent(content, database))
      : apiError("خبر پیدا نشد.", 404, "not_found");
  }
  if (route === "announcements" && request.method === "GET") {
    return jsonResponse(
      paginatedResponse(
        database.content.filter(
          (record) =>
            record.kind === "announcement" && record.status === "published",
        ),
        url,
        (record) => publicContent(record, database),
      ),
    );
  }
  if (path[0] === "announcements" && path[1] && request.method === "GET") {
    const content = database.content.find(
      (record) =>
        record.slug === path[1] &&
        record.kind === "announcement" &&
        record.status === "published",
    );
    return content
      ? jsonResponse(publicContent(content, database))
      : apiError("اطلاعیه پیدا نشد.", 404, "not_found");
  }
  if (route === "content" && request.method === "GET") {
    const type = url.searchParams.get("type");
    const source = type === "gallery" ? database.gallery : database.content;
    const filterUrl = new URL(url);
    if (type === "gallery") {
      filterUrl.searchParams.delete("type");
    }
    return jsonResponse(
      paginatedResponse(filterRecords(source, filterUrl), url),
    );
  }
  if (route === "gallery" && request.method === "GET") {
    return jsonResponse(
      paginatedResponse(
        filterRecords(
          database.gallery.filter((item) => item.status === "published"),
          url,
        ),
        url,
      ),
    );
  }
  if (route === "achievements" && request.method === "GET") {
    return jsonResponse(
      paginatedResponse(filterRecords(database.achievements, url), url),
    );
  }
  if (route === "events" && request.method === "GET") {
    return jsonResponse(paginatedResponse(database.events, url));
  }
  if (route === "staff" && request.method === "GET") {
    return jsonResponse(paginatedResponse(database.staff, url));
  }

  if (path[0] === "cms" && account) {
    return genericCms(request, path, database, account);
  }

  return apiError(
    `endpoint موقت «${route || "/"}» پیاده‌سازی نشده است.`,
    404,
    "mock_endpoint_not_found",
  );
}

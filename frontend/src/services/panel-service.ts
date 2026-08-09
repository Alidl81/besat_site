import {
  apiDownload,
  apiRequest,
  type ApiRequestOptions,
} from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import {
  actionEndpoint,
  detailEndpoint,
  withQuery,
  type QueryValue,
} from "@/lib/api/query";
import type { ApiId } from "@/types/api";
import type {
  AdminDashboard,
  ContentItem,
  ContentRevision,
  ContentSummary,
  EventItem,
  MediaDashboard,
  InternalMessageItem,
  MediaAsset,
  MessageRecipient,
  NamedOption,
  PanelMetric,
  PanelContext,
  PanelListResponse,
  PanelSettings,
  ParentChildDetail,
  ParentChildSummary,
  ParentDashboard,
  ParentRegistration,
  RegistrationItem,
  RegistrationSummary,
  ReportOverview,
  ServiceItem,
  StudentItem,
  StudentSummary,
} from "@/types/panel-api";

type BackendDashboard = {
  role: string;
  scope: string;
  selected_unit?: { id: ApiId; title: string; slug: string } | null;
  accessible_units?: Array<{ id: ApiId; title: string; slug: string }>;
  cards?: Array<{
    key: string;
    label: string;
    value: number;
    description: string | null;
  }>;
  recent_activity?: Array<{
    id: ApiId;
    type: string;
    title: string;
    status: string;
    updated_at: string | null;
  }>;
  metrics?: PanelMetric[];
};

type MediaUploadOptions = {
  unitId?: ApiId | null;
  title?: string;
  altText?: string;
  caption?: string;
};

function dashboardMetrics(payload: BackendDashboard): PanelMetric[] {
  const tones: PanelMetric["tone"][] = ["blue", "amber", "green", "purple"];
  if (payload.metrics) return payload.metrics;
  return (payload.cards ?? []).map((card, index) => ({
    key: card.key,
    title: card.label,
    value: card.value,
    detail: card.description,
    trend: null,
    tone: tones[index % tones.length],
    icon:
      card.key.includes("unit")
        ? "units"
        : card.key.includes("gallery")
          ? "image"
          : card.key.includes("review")
            ? "review"
            : card.key.includes("publish")
              ? "check"
              : "chart",
  }));
}

function dashboardFeed(payload: BackendDashboard) {
  return (payload.recent_activity ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.status,
    timestamp: item.updated_at,
    status: item.status,
    href: null,
    avatar_url: null,
  }));
}

function authed<T>(endpoint: string, options: ApiRequestOptions = {}) {
  return apiRequest<T>(endpoint, options);
}

function mutate<T>(
  endpoint: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
) {
  return authed<T>(endpoint, {
    method,
    body:
      body instanceof FormData
        ? body
        : body === undefined
          ? undefined
          : JSON.stringify(body),
  });
}

export const panelService = {
  context(params: Record<string, QueryValue> = {}) {
    return authed<PanelContext>(
      withQuery(apiEndpoints.dashboard.context, params),
    );
  },

  async dashboard(
    panel: "admin" | "contentManager" | "parents",
    params: Record<string, QueryValue> = {},
  ) {
    const endpoint =
      panel === "admin"
        ? apiEndpoints.dashboard.generalManager
        : panel === "contentManager"
            ? apiEndpoints.dashboard.media
            : apiEndpoints.dashboard.parents;
    const raw = await authed<BackendDashboard>(
      withQuery(endpoint, {
        unit_id: params.unit,
      }),
    );
    if (raw.metrics) {
      return raw as unknown as
        | AdminDashboard
        | MediaDashboard
        | ParentDashboard;
    }
    const metrics = dashboardMetrics(raw);
    const feed = dashboardFeed(raw);
    if (panel === "contentManager") {
      return {
        current_date: new Date().toISOString(),
        metrics,
        latest_content: feed,
        messages: [],
        calendar: [],
        storage: null,
      } satisfies MediaDashboard;
    }
    if (panel === "parents") {
      return {
        current_date: new Date().toISOString(),
        metrics,
        selected_child: null,
        today_schedule: [],
        next_exam: null,
        current_assignment: null,
        attendance: null,
        events: [],
        teacher_messages: [],
        quick_links: [],
      } satisfies ParentDashboard;
    }
    return {
      current_date: new Date().toISOString(),
      metrics,
      messages: [],
      events: [],
      announcements: [],
      units: [],
    } satisfies AdminDashboard;
  },

  students(params: Record<string, QueryValue>) {
    return Promise.all([
      authed<PanelListResponse<StudentItem>>(
        withQuery(apiEndpoints.cms.students, params),
      ),
      authed<StudentSummary>(
        withQuery(`${apiEndpoints.cms.students}summary/`, params),
      ),
    ]).then(([page, summary]) => ({ page, summary }));
  },
  student(id: string | number) {
    return authed<StudentItem>(detailEndpoint(apiEndpoints.cms.students, id));
  },
  createStudent(payload: Record<string, unknown>) {
    return mutate<StudentItem>(apiEndpoints.cms.students, "POST", payload);
  },
  updateStudent(id: string | number, payload: Record<string, unknown>) {
    return mutate<StudentItem>(
      detailEndpoint(apiEndpoints.cms.students, id),
      "PATCH",
      payload,
    );
  },
  removeStudent(id: string | number) {
    return mutate<void>(detailEndpoint(apiEndpoints.cms.students, id), "DELETE");
  },
  importStudents(file: File, unitId?: string | null) {
    const form = new FormData();
    form.set("file", file);
    if (unitId) form.set("unit_id", unitId);
    return mutate<{
      created: number;
      updated: number;
      errors: Array<{ row: number; message: string }>;
    }>(`${apiEndpoints.cms.students}bulk-import/`, "POST", form);
  },
  exportStudents(params: Record<string, QueryValue>) {
    return apiDownload(
      withQuery(`${apiEndpoints.cms.students}export/`, {
        ...params,
        format: "xlsx",
      }),
      {},
    );
  },

  registrations(params: Record<string, QueryValue>) {
    return Promise.all([
      authed<PanelListResponse<RegistrationItem>>(
        withQuery(apiEndpoints.cms.registrationRequests, params),
      ),
      authed<RegistrationSummary>(
        withQuery(`${apiEndpoints.cms.registrationRequests}summary/`, params),
      ),
    ]).then(([page, summary]) => ({ page, summary }));
  },
  registration(id: string | number) {
    return authed<RegistrationItem>(
      detailEndpoint(apiEndpoints.cms.registrationRequests, id),
    );
  },
  registrationAction(
    id: string | number,
    action: "approve" | "reject" | "request-documents" | "contact",
    payload: Record<string, unknown> = {},
  ) {
    return mutate<RegistrationItem>(
      actionEndpoint(apiEndpoints.cms.registrationRequests, id, action),
      "POST",
      payload,
    );
  },

  async content(params: Record<string, QueryValue>) {
    const records = await authed<ContentItem[]>(apiEndpoints.cms.content);
    const search = String(params.search ?? "").trim().toLocaleLowerCase("fa");
    const kind = String(params.kind ?? "");
    const statusValue = String(params.status ?? "");
    const unit = String(params.unit ?? "");
    const filtered = records.filter((item) => {
      if (search && !`${item.title} ${item.summary ?? ""}`.toLocaleLowerCase("fa").includes(search)) return false;
      if (kind && item.kind !== kind) return false;
      if (statusValue && item.status !== statusValue) return false;
      if (unit && String(item.unit?.id ?? "") !== unit) return false;
      return true;
    });
    const pageNumber = Math.max(1, Number(params.page ?? 1));
    const pageSize = 20;
    const start = (pageNumber - 1) * pageSize;
    const page: PanelListResponse<ContentItem> = {
      count: filtered.length,
      next: start + pageSize < filtered.length ? String(pageNumber + 1) : null,
      previous: pageNumber > 1 ? String(pageNumber - 1) : null,
      results: filtered.slice(start, start + pageSize),
    };
    const summary: ContentSummary = {
      drafts: records.filter((item) => item.status === "draft").length,
      waiting_review: records.filter((item) => item.status === "waiting_review").length,
      scheduled: records.filter((item) => item.status === "scheduled").length,
      published: records.filter((item) => item.status === "published").length,
    };
    return { page, summary };
  },
  createContent(payload: Record<string, unknown>) {
    return mutate<ContentItem>(apiEndpoints.cms.content, "POST", payload);
  },
  updateContent(id: string | number, payload: Record<string, unknown>) {
    return mutate<ContentItem>(
      detailEndpoint(apiEndpoints.cms.content, id),
      "PATCH",
      payload,
    );
  },
  removeContent(id: string | number) {
    return mutate<void>(detailEndpoint(apiEndpoints.cms.content, id), "DELETE");
  },
  contentAction(
    id: string | number,
    action:
      | "submit-review"
      | "approve"
      | "reject"
      | "publish"
      | "schedule",
    payload: Record<string, unknown> = {},
  ) {
    return mutate<ContentItem>(
      actionEndpoint(apiEndpoints.cms.content, id, action),
      "POST",
      payload,
    );
  },
  contentRevisions(id: string | number) {
    return authed<ContentRevision[]>(
      `${detailEndpoint(apiEndpoints.cms.content, id)}revisions/`,
    );
  },
  restoreContentRevision(id: string | number, revisionId: string | number) {
    return mutate<ContentItem>(
      `${detailEndpoint(apiEndpoints.cms.content, id)}revisions/${encodeURIComponent(String(revisionId))}/restore/`,
      "POST",
    );
  },
  async contentCategories() {
    const endpoints = [
      `${apiEndpoints.cms.news}categories/`,
      `${apiEndpoints.cms.announcements}categories/`,
    ];
    const responses = await Promise.all(
      endpoints.map((endpoint) =>
        authed<NamedOption[] | PanelListResponse<NamedOption>>(endpoint),
      ),
    );
    const unique = new Map<string, NamedOption>();
    for (const response of responses) {
      const items = Array.isArray(response) ? response : response.results;
      for (const item of items) unique.set(`${item.id}-${item.title}`, item);
    }
    return [...unique.values()];
  },
  mediaAssets(params: Record<string, QueryValue> = {}) {
    return authed<PanelListResponse<MediaAsset>>(
      withQuery(apiEndpoints.cms.media, params),
    );
  },
  uploadMedia(file: File, options: MediaUploadOptions = {}) {
    const form = new FormData();
    form.set("file", file);
    if (options.unitId !== undefined && options.unitId !== null) {
      form.set("unit", String(options.unitId));
    }
    if (options.title) form.set("title", options.title);
    if (options.altText) form.set("alt_text", options.altText);
    if (options.caption) form.set("caption", options.caption);
    return mutate<MediaAsset>(
      apiEndpoints.cms.media,
      "POST",
      form,
    );
  },

  parentChildren() {
    return authed<ParentChildSummary[]>(apiEndpoints.parents.children);
  },
  parentChild(id: string | number, params: Record<string, QueryValue> = {}) {
    return authed<ParentChildDetail>(
      withQuery(detailEndpoint(apiEndpoints.parents.children, id), params),
    );
  },
  parentPrograms(params: Record<string, QueryValue> = {}) {
    return authed<PanelListResponse<EventItem>>(
      withQuery(apiEndpoints.parents.programs, params),
    );
  },
  parentRegistrations() {
    return authed<ParentRegistration[]>(apiEndpoints.parents.registrations);
  },

  services(parent = false) {
    return authed<ServiceItem[]>(
      withQuery(apiEndpoints.cms.services, {
        audience: parent ? "parent" : "staff",
      }),
    );
  },
  events(params: Record<string, QueryValue> = {}) {
    return authed<PanelListResponse<EventItem>>(
      withQuery(apiEndpoints.cms.events, params),
    );
  },
  createEvent(payload: Record<string, unknown>) {
    return mutate<EventItem>(apiEndpoints.cms.events, "POST", payload);
  },
  reports(params: Record<string, QueryValue> = {}) {
    return authed<ReportOverview>(
      withQuery(`${apiEndpoints.cms.reports}overview/`, params),
    );
  },
  exportReport(params: Record<string, QueryValue> = {}) {
    return apiDownload(
      withQuery(`${apiEndpoints.cms.reports}export/`, {
        ...params,
        format: "xlsx",
      }),
      {},
    );
  },
  settings() {
    return authed<PanelSettings>(apiEndpoints.cms.settings);
  },
  updateSettings(payload: Partial<PanelSettings>) {
    return mutate<PanelSettings>(
      apiEndpoints.cms.settings,
      "PATCH",
      payload,
    );
  },
  messages(folder: "inbox" | "sent") {
    return authed<PanelListResponse<InternalMessageItem>>(
      withQuery(apiEndpoints.cms.internalMessages, { folder }),
    );
  },
  messageRecipients() {
    return authed<MessageRecipient[]>(
      `${apiEndpoints.cms.internalMessages}recipients/`,
    );
  },
  sendMessage(payload: {
    recipient_id: string | number;
    subject: string;
    body: string;
  }) {
    return mutate<InternalMessageItem>(
      apiEndpoints.cms.internalMessages,
      "POST",
      payload,
    );
  },
  markMessageRead(id: string | number) {
    return mutate<InternalMessageItem>(
      actionEndpoint(apiEndpoints.cms.internalMessages, id, "mark-read"),
      "POST",
    );
  },
  removeMessage(id: string | number) {
    return mutate<void>(
      detailEndpoint(apiEndpoints.cms.internalMessages, id),
      "DELETE",
    );
  },
};

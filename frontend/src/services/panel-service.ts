import { readBesatSession } from "@/lib/auth/auth-session";
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
import type {
  AdminDashboard,
  ContentItem,
  ContentRevision,
  ContentSummary,
  DashboardPayload,
  EventItem,
  MediaDashboard,
  InternalMessageItem,
  MessageRecipient,
  NamedOption,
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

function token() {
  return readBesatSession()?.accessToken;
}

function authed<T>(endpoint: string, options: ApiRequestOptions = {}) {
  return apiRequest<T>(endpoint, { ...options, token: token() });
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

  dashboard(
    panel: "admin" | "unitManager" | "media" | "parents",
    params: Record<string, QueryValue> = {},
  ) {
    const endpoint =
      panel === "admin"
        ? apiEndpoints.dashboard.generalManager
        : panel === "unitManager"
          ? apiEndpoints.dashboard.unitManager
          : panel === "media"
            ? apiEndpoints.dashboard.media
            : apiEndpoints.dashboard.parents;
    return authed<DashboardPayload>(withQuery(endpoint, params)) as Promise<
      AdminDashboard | MediaDashboard | ParentDashboard
    >;
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
  exportStudents(params: Record<string, QueryValue>) {
    return apiDownload(
      withQuery(`${apiEndpoints.cms.students}export/`, params),
      { token: token() },
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

  content(params: Record<string, QueryValue>) {
    return Promise.all([
      authed<PanelListResponse<ContentItem>>(
        withQuery(apiEndpoints.cms.content, params),
      ),
      authed<ContentSummary>(
        withQuery(`${apiEndpoints.cms.content}summary/`, params),
      ),
    ]).then(([page, summary]) => ({ page, summary }));
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
      | "autosave"
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
      actionEndpoint(apiEndpoints.cms.content, id, "revisions"),
    );
  },
  restoreContentRevision(id: string | number, revisionId: string | number) {
    return mutate<ContentItem>(
      actionEndpoint(apiEndpoints.cms.content, id, "restore-revision"),
      "POST",
      { revision_id: revisionId },
    );
  },
  contentCategories() {
    return authed<NamedOption[]>(apiEndpoints.cms.contentCategories);
  },
  uploadMedia(file: File) {
    const form = new FormData();
    form.set("file", file);
    return mutate<{ id: string | number; url: string; title: string }>(
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
      { token: token() },
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

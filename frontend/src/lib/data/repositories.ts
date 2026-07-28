// repositoryهای API برای موجودیت‌های پنل و محتوای سایت.

import { createRepository } from "@/lib/data/repository";
import type {
  AchievementRecord,
  ClassRecord,
  ContactMessageRecord,
  ContentRecord,
  DepartmentRecord,
  GalleryItemRecord,
  HomeSlideRecord,
  InternalMessageRecord,
  ProgramRecord,
  RegistrationRequestRecord,
  SchoolUnitRecord,
  StaffRecord,
  StaticPageRecord,
  StudentRecord,
  UserRecord,
} from "@/lib/data/domain-types";

export const unitsRepository = createRepository<SchoolUnitRecord>({
  collection: "units",
  endpoint: "cms/units/",
});

export const departmentsRepository = createRepository<DepartmentRecord>({
  collection: "departments",
  endpoint: "cms/departments/",
});

export const usersRepository = createRepository<UserRecord>({
  collection: "users",
  endpoint: "cms/users/",
});

export const contentRepository = createRepository<ContentRecord>({
  collection: "content",
  endpoint: "cms/content/",
});

export const galleryRepository = createRepository<GalleryItemRecord>({
  collection: "gallery",
  endpoint: "cms/gallery/",
});


export const achievementsRepository = createRepository<AchievementRecord>({
  collection: "achievements",
  endpoint: "cms/achievements/",
});
export const homeSlidesRepository = createRepository<HomeSlideRecord>({
  collection: "home_slides",
  endpoint: "cms/home-slides/",
});

export const registrationsRepository = createRepository<RegistrationRequestRecord>({
  collection: "registrations",
  endpoint: "cms/registration-requests/",
});

export const messagesRepository = createRepository<ContactMessageRecord>({
  collection: "messages",
  endpoint: "cms/messages/",
});

export const studentsRepository = createRepository<StudentRecord>({
  collection: "students",
  endpoint: "cms/students/",
});

export const classesRepository = createRepository<ClassRecord>({
  collection: "classes",
  endpoint: "cms/classes/",
});

export const staffRepository = createRepository<StaffRecord>({
  collection: "staff",
  endpoint: "cms/staff/",
});

export const programsRepository = createRepository<ProgramRecord>({
  collection: "programs",
  endpoint: "cms/programs/",
});

export const internalMessagesRepository = createRepository<InternalMessageRecord>({
  collection: "internal_messages",
  endpoint: "cms/internal-messages/",
});

export const staticPagesRepository = createRepository<StaticPageRecord>({
  collection: "static_pages",
  endpoint: "cms/static-pages/",
});

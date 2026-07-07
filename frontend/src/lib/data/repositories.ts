// تعریف repository های مشخص هر موجودیت.
// هنگام اتصال به بک، فقط endpoint ها مهم‌اند (با NEXT_PUBLIC_DATA_SOURCE=api).

import { createRepository } from "@/lib/data/repository";
import {
  seedDepartments,
  seedHomeSlides,
  seedUnits,
  seedUsers,
} from "@/lib/data/seed-data";
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
  seed: seedUnits,
});

export const departmentsRepository = createRepository<DepartmentRecord>({
  collection: "departments",
  endpoint: "cms/departments/",
  seed: seedDepartments,
});

export const usersRepository = createRepository<UserRecord>({
  collection: "users",
  endpoint: "cms/users/",
  seed: seedUsers,
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
  seed: seedHomeSlides,
});

export const registrationsRepository = createRepository<RegistrationRequestRecord>({
  collection: "registrations",
  endpoint: "cms/registrations/",
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

// صفحه seed "about"
const aboutPageSeed: StaticPageRecord[] = [
  {
    id: "page-about",
    slug: "about",
    title: "درباره مجتمع تربیتی آموزشی بعثت",
    body_html: `<h2>معرفی مجموعه</h2>
<p>مجتمع تربیتی آموزشی بعثت با بیش از ۳۲ سال سابقه، دارای واحدهای پسرانه و دخترانه در مقاطع مختلف تحصیلی می‌باشد. این مجتمع با رویکرد تربیت انقلابی و مذهبی تلاش کرده بالاترین سطح توانمندی‌های آموزشی و اجتماعی را برای مخاطبین خود فراهم نماید.</p>
<p>هم‌اکنون مجتمع بعثت با حضور حدود ۵۰۰ نفر آموزگار، دبیر و کادر اداری-آموزشی و با ظرفیت ده واحد آموزشی، کانون تخصصی زبان، گروه تخصصی رایانه و امکانات تفریحی همچون استخر، به بیش از ۳۰۰۰ دانش‌آموز خدمات ارائه می‌نماید.</p>`,
    meta_description: "مجتمع تربیتی آموزشی بعثت با بیش از ۳۲ سال سابقه",
    is_published: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const staticPagesRepository = createRepository<StaticPageRecord>({
  collection: "static_pages",
  endpoint: "cms/static-pages/",
  seed: aboutPageSeed,
});

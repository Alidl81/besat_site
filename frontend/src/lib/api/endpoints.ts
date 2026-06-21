export const apiEndpoints = {
  me: "/api/me/",
  myPermissions: "/api/me/permissions/",
  myUnits: "/api/me/units/",

  siteSettings: "/api/site-settings/",
  home: "/api/home/",
  about: "/api/about/",

  units: "/api/units/",
  departments: "/api/departments/",
  news: "/api/news/",
  announcements: "/api/announcements/",
  gallery: "/api/gallery/",
  achievements: "/api/achievements/",

  contact: "/api/contact/",
  registration: "/api/registration/",

  dashboard: {
    generalManager: "/api/dashboard/general-manager/",
    unitManager: "/api/dashboard/unit-manager/",
    media: "/api/dashboard/media/",
    parents: "/api/dashboard/parents/",
  },

  content: "/api/content/",
  messages: "/api/messages/",
  registrationRequests: "/api/registration-requests/",
} as const;



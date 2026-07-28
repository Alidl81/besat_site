import type { ReactNode } from "react";
import { AnimatedCounter } from "@/components/shared/animated-counter";
import { HomeVirtualTourSection } from "@/components/home/home-virtual-tour-section";

function StatIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-11 items-center justify-center rounded-full bg-[#fbf3e7] text-[#c98c3d]">
      {children}
    </span>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </svg>
  );
}

function MentorIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="7" r="4" />
      <path d="M5.5 21a6.5 6.5 0 0 1 13 0M19 5l2 2-2 2" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0Z" />
      <path d="M7 6H3v1a4 4 0 0 0 4 4M17 6h4v1a4 4 0 0 1-4 4" />
    </svg>
  );
}

function BadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="m9 12 2 2 4-4M8 20l-1 3 5-2 5 2-1-3" />
    </svg>
  );
}

const stats = [
  { target: 33, after: "سال", label: "سابقه فعالیت آموزشی", icon: <BadgeIcon /> },
  { target: 4000, before: "+", label: "دانش‌آموز", icon: <UsersIcon /> },
  { target: 900, before: "+", label: "معلم و نیروی اجرایی", icon: <MentorIcon /> },
  { target: 200, before: "+", label: "عنوان کشوری", icon: <TrophyIcon /> },
];

export function HomeExperienceSection() {
  return (
    <section dir="rtl" className="bg-[#fbfaf7] pb-16 lg:pb-20">
      <HomeVirtualTourSection />
      <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8">
        <div data-stagger-item style={{ animationDelay: "120ms" }} className="relative z-20 -mt-3 grid overflow-hidden rounded-[1.25rem] border border-[#e2e3e3] bg-white shadow-[0_18px_45px_rgba(8,30,55,0.09)] sm:grid-cols-2 lg:-mt-5 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              data-stagger-item
              style={{ animationDelay: `${220 + index * 90}ms` }}
              className={`flex items-center justify-center gap-4 px-5 py-6 text-center ${
                index > 0 ? "border-t border-[#e8e9ea] sm:border-t-0 sm:border-r lg:border-r" : ""
              }`}
            >
              <StatIcon>{stat.icon}</StatIcon>
              <span className="text-right">
                <strong className="block text-xl font-black text-[#0a2848]">
                  <AnimatedCounter target={stat.target} before={stat.before} after={stat.after} />
                </strong>
                <span className="mt-1 block text-[10px] font-bold text-slate-500">{stat.label}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

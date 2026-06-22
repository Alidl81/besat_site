"use client";

import { useEffect, useState } from "react";

type PanelProfileContentProps = {
  roleTitle: string;
};

export function PanelProfileContent({ roleTitle }: PanelProfileContentProps) {
  const [avatarPreview, setAvatarPreview] = useState<string>("");

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-7">
      <div className="flex flex-col gap-5 border-b border-slate-100 pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-right">
          <h2 className="text-2xl font-black text-[#062452]">پروفایل کاربری</h2>
          <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
            اطلاعات حساب کاربری از این بخش قابل مشاهده و ویرایش است.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-[1.6rem] border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white text-[#062452] shadow-sm">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="تصویر پروفایل"
                className="h-full w-full object-cover"
              />
            ) : (
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="size-9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21a8 8 0 0 0-16 0" />
                <circle cx="12" cy="8" r="4" />
              </svg>
            )}
          </div>

          <label className="cursor-pointer rounded-2xl bg-[#12395b] px-5 py-3 text-center text-sm font-black text-white transition hover:bg-[#0d2f4d]">
            تغییر تصویر پروفایل
            <input
              type="file"
              name="avatar"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (!file) {
                  return;
                }

                if (avatarPreview) {
                  URL.revokeObjectURL(avatarPreview);
                }

                setAvatarPreview(URL.createObjectURL(file));
              }}
            />
          </label>
        </div>
      </div>

      <form className="mt-6 grid gap-5 md:grid-cols-2">
        <label className="block text-right">
          <span className="mb-2 block text-sm font-black text-[#062452]">
            نام و نام خانوادگی
          </span>
          <input
            type="text"
            name="fullName"
            defaultValue=""
            className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-emerald-400 focus:bg-white"
          />
        </label>

        <label className="block text-right">
          <span className="mb-2 block text-sm font-black text-[#062452]">
            شماره تماس
          </span>
          <input
            type="tel"
            name="phone"
            defaultValue=""
            className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-emerald-400 focus:bg-white"
          />
        </label>

        <label className="block text-right">
          <span className="mb-2 block text-sm font-black text-[#062452]">
            نشانی ایمیل
          </span>
          <input
            type="email"
            name="email"
            defaultValue=""
            className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-emerald-400 focus:bg-white"
          />
        </label>

        <label className="block text-right">
          <span className="mb-2 block text-sm font-black text-[#062452]">
            نقش کاربری
          </span>
          <input
            type="text"
            name="role"
            defaultValue={roleTitle}
            readOnly
            className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 text-right text-sm font-black text-slate-500 outline-none"
          />
        </label>

        <label className="block text-right md:col-span-2">
          <span className="mb-2 block text-sm font-black text-[#062452]">
            توضیحات
          </span>
          <textarea
            name="description"
            defaultValue=""
            rows={5}
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-emerald-400 focus:bg-white"
          />
        </label>

        <div className="flex justify-end md:col-span-2">
          <button
            type="button"
            className="besat-navy-button inline-flex h-[3.25rem] items-center justify-center rounded-2xl bg-[#12395b] px-7 text-sm font-black transition hover:bg-[#0d2f4d]"
          >
            ذخیره تغییرات
          </button>
        </div>
      </form>
    </section>
  );
}

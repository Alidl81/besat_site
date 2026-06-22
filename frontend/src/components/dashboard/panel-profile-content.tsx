"use client";

import { type FormEvent, useEffect, useState } from "react";
import { changePassword, updateProfile } from "@/lib/profile/profile-service";

type PanelProfileContentProps = {
  roleTitle: string;
};

export function PanelProfileContent({ roleTitle }: PanelProfileContentProps) {
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [selectedAvatar, setSelectedAvatar] = useState<File | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    setIsSaving(true);

    try {
      await updateProfile({
        fullName: String(formData.get("fullName") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        email: String(formData.get("email") ?? ""),
        description: String(formData.get("description") ?? ""),
        avatar: selectedAvatar,
      });

      setProfileMessage("درخواست ذخیره ثبت شد.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    setIsChangingPassword(true);

    try {
      await changePassword({
        currentPassword: String(formData.get("currentPassword") ?? ""),
        newPassword: String(formData.get("newPassword") ?? ""),
        confirmPassword: String(formData.get("confirmPassword") ?? ""),
      });

      setPasswordMessage("درخواست تغییر رمز ثبت شد.");
    } finally {
      setIsChangingPassword(false);
    }
  }

  return (
    <div className="space-y-6">
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

                  setSelectedAvatar(file);
                  setAvatarPreview(URL.createObjectURL(file));
                }}
              />
            </label>
          </div>
        </div>

        <form onSubmit={handleProfileSubmit} className="mt-6 grid gap-5 md:grid-cols-2">
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

          {profileMessage && (
            <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-right text-sm font-black text-emerald-700 md:col-span-2">
              {profileMessage}
            </p>
          )}

          <div className="flex justify-end md:col-span-2">
            <button
              type="submit"
              disabled={isSaving}
              className="besat-navy-button inline-flex h-[3.25rem] items-center justify-center rounded-2xl bg-[#12395b] px-7 text-sm font-black transition hover:bg-[#0d2f4d] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? "در حال ذخیره" : "ذخیره تغییرات"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-7">
        <div className="text-right">
          <h2 className="text-2xl font-black text-[#062452]">تغییر رمز عبور</h2>
          <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
            برای حفظ امنیت حساب، رمز عبور جدید را با دقت وارد کنید.
          </p>
        </div>

        <form onSubmit={handlePasswordSubmit} className="mt-6 grid gap-5 md:grid-cols-3">
          <label className="block text-right">
            <span className="mb-2 block text-sm font-black text-[#062452]">
              رمز عبور فعلی
            </span>
            <input
              type="password"
              name="currentPassword"
              className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-emerald-400 focus:bg-white"
            />
          </label>

          <label className="block text-right">
            <span className="mb-2 block text-sm font-black text-[#062452]">
              رمز عبور جدید
            </span>
            <input
              type="password"
              name="newPassword"
              className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-emerald-400 focus:bg-white"
            />
          </label>

          <label className="block text-right">
            <span className="mb-2 block text-sm font-black text-[#062452]">
              تکرار رمز عبور جدید
            </span>
            <input
              type="password"
              name="confirmPassword"
              className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-emerald-400 focus:bg-white"
            />
          </label>

          {passwordMessage && (
            <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-right text-sm font-black text-emerald-700 md:col-span-3">
              {passwordMessage}
            </p>
          )}

          <div className="flex justify-end md:col-span-3">
            <button
              type="submit"
              disabled={isChangingPassword}
              className="besat-navy-button inline-flex h-[3.25rem] items-center justify-center rounded-2xl bg-[#12395b] px-7 text-sm font-black transition hover:bg-[#0d2f4d] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isChangingPassword ? "در حال ذخیره" : "به‌روزرسانی رمز عبور"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}


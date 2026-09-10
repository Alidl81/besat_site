"use client";

import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import {
  changePassword,
  loadProfile,
  saveProfile,
} from "@/lib/profile/profile-service";
import type { AccountProfile } from "@/lib/api/account-api";
import { safePublicMediaUrl } from "@/lib/media/safe-url";

type PanelProfileContentProps = {
  roleTitle: string;
};

export function PanelProfileContent({ roleTitle }: PanelProfileContentProps) {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [selectedAvatar, setSelectedAvatar] = useState<File | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  // FE-AUTH-PROFILE-UPDATE-DOUBLE-SUBMIT-001 + AUTH-UI-PASSWORD-CHANGE-DOUBLE-SUBMIT-001:
  // `isSaving`/`isChangingPassword` are state-backed, so two same-tick
  // submits both read them as `false` before either update commits --
  // synchronous ref guards close that race.
  const savingRef = useRef(false);
  const changingPasswordRef = useRef(false);
  const currentPasswordErrorId = useId();
  const newPasswordErrorId = useId();
  const confirmPasswordErrorId = useId();

  useEffect(() => {
    loadProfile().then((data) => {
      if (data) setProfile(data);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    const formData = new FormData(event.currentTarget);
    setIsSaving(true);
    setProfileMessage(null);

    try {
      const result = await saveProfile({
        fullName: String(formData.get("fullName") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        email: String(formData.get("email") ?? ""),
        description: String(formData.get("description") ?? ""),
        avatar: selectedAvatar,
      });

      setProfileMessage({ ok: result.ok, text: result.message });
    } finally {
      setIsSaving(false);
      savingRef.current = false;
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    setPasswordMessage(null);
    setPasswordFieldErrors({});

    const nextFieldErrors: typeof passwordFieldErrors = {};
    if (!currentPassword) nextFieldErrors.currentPassword = "رمز عبور فعلی الزامی است.";
    if (!newPassword) nextFieldErrors.newPassword = "رمز عبور جدید الزامی است.";
    if (!confirmPassword) nextFieldErrors.confirmPassword = "تکرار رمز عبور جدید الزامی است.";

    if (Object.keys(nextFieldErrors).length) {
      setPasswordFieldErrors(nextFieldErrors);
      setPasswordMessage({ ok: false, text: "لطفاً خطاهای مشخص‌شده را اصلاح کنید." });
      const target = (
        nextFieldErrors.currentPassword
          ? currentPasswordRef
          : nextFieldErrors.newPassword
            ? newPasswordRef
            : confirmPasswordRef
      ).current;
      // The dashboard's sticky topbar has a different height than the
      // public site header (besat-focus-scroll-offset's scroll-margin-top
      // is calibrated for the latter), so an explicit scrollIntoView is
      // used here instead -- deterministic regardless of chrome height.
      target?.focus();
      target?.scrollIntoView({ block: "center" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFieldErrors({ confirmPassword: "رمز عبور جدید و تکرار آن یکسان نیستند." });
      setPasswordMessage({ ok: false, text: "رمز عبور جدید و تکرار آن یکسان نیستند." });
      confirmPasswordRef.current?.focus();
      confirmPasswordRef.current?.scrollIntoView({ block: "center" });
      return;
    }

    if (changingPasswordRef.current) return;
    changingPasswordRef.current = true;
    setIsChangingPassword(true);

    try {
      const result = await changePassword({ currentPassword, newPassword, confirmPassword });

      setPasswordMessage({ ok: result.ok, text: result.message });

      if (result.ok) {
        (event.target as HTMLFormElement).reset();
      }
    } finally {
      setIsChangingPassword(false);
      changingPasswordRef.current = false;
    }
  }

  const safeAvatar = safePublicMediaUrl(profile?.avatar);

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
                <img src={avatarPreview} alt="تصویر پروفایل" className="h-full w-full object-cover" />
              ) : safeAvatar ? (
                // FE-PUBLIC-MEDIA-ORIGIN-001 (dashboard sink): profile.avatar
                // is a backend-served media URL (unlike avatarPreview above,
                // a local blob: object URL), subject to the same possibly
                // wrong-host origin this helper already normalizes for every
                // other media sink.
                <img src={safeAvatar} alt="تصویر پروفایل" className="h-full w-full object-cover" />
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
                  if (!file) return;
                  if (avatarPreview) URL.revokeObjectURL(avatarPreview);
                  setSelectedAvatar(file);
                  setAvatarPreview(URL.createObjectURL(file));
                }}
              />
            </label>
          </div>
        </div>

        <form onSubmit={handleProfileSubmit} method="post" className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="block text-right">
            <span className="mb-2 block text-sm font-black text-[#062452]">نام و نام خانوادگی</span>
            <input
              type="text"
              name="fullName"
              defaultValue={profile?.full_name ?? ""}
              key={profile?.full_name}
              className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-blue-400 focus:bg-white"
            />
          </label>

          <label className="block text-right">
            <span className="mb-2 block text-sm font-black text-[#062452]">شماره تماس</span>
            <input
              type="tel"
              name="phone"
              defaultValue={profile?.phone ?? ""}
              key={profile?.phone}
              className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-blue-400 focus:bg-white"
            />
          </label>

          <label className="block text-right">
            <span className="mb-2 block text-sm font-black text-[#062452]">نشانی ایمیل</span>
            <input
              type="email"
              name="email"
              defaultValue={profile?.email ?? ""}
              key={profile?.email}
              className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-blue-400 focus:bg-white"
            />
          </label>

          <label className="block text-right">
            <span className="mb-2 block text-sm font-black text-[#062452]">نقش کاربری</span>
            <input
              type="text"
              name="role"
              value={profile?.role_display ?? roleTitle}
              readOnly
              className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 text-right text-sm font-black text-slate-600 outline-none"
            />
          </label>

          <label className="block text-right md:col-span-2">
            <span className="mb-2 block text-sm font-black text-[#062452]">توضیحات</span>
            <textarea
              name="description"
              defaultValue={profile?.description ?? ""}
              key={profile?.description}
              rows={4}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-blue-400 focus:bg-white"
            />
          </label>

          {profileMessage ? (
            <p
              role={profileMessage.ok ? "status" : "alert"}
              className={`rounded-2xl px-4 py-3 text-right text-sm font-black md:col-span-2 ${
                profileMessage.ok
                  ? "bg-blue-50 text-blue-700"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              {profileMessage.text}
            </p>
          ) : null}

          <div className="flex justify-end md:col-span-2">
            <button
              type="submit"
              disabled={isSaving}
              className="besat-navy-button inline-flex h-[3.25rem] items-center justify-center rounded-2xl bg-[#12395b] px-7 text-sm font-black transition hover:bg-[#0d2f4d] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? "در حال ذخیره..." : "ذخیره تغییرات"}
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

        <form onSubmit={handlePasswordSubmit} method="post" noValidate className="mt-6 grid gap-5 md:grid-cols-3">
          <label className="block text-right">
            <span className="mb-2 block text-sm font-black text-[#062452]">رمز عبور فعلی</span>
            <input
              ref={currentPasswordRef}
              type="password"
              name="currentPassword"
              required
              aria-invalid={Boolean(passwordFieldErrors.currentPassword)}
              aria-describedby={passwordFieldErrors.currentPassword ? currentPasswordErrorId : undefined}
              onChange={() => setPasswordFieldErrors((prev) => ({ ...prev, currentPassword: undefined }))}
              className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-blue-400 focus:bg-white"
            />
            {passwordFieldErrors.currentPassword ? (
              <p id={currentPasswordErrorId} className="mt-1.5 text-xs font-bold text-rose-600">
                {passwordFieldErrors.currentPassword}
              </p>
            ) : null}
          </label>

          <label className="block text-right">
            <span className="mb-2 block text-sm font-black text-[#062452]">رمز عبور جدید</span>
            <input
              ref={newPasswordRef}
              type="password"
              name="newPassword"
              required
              aria-invalid={Boolean(passwordFieldErrors.newPassword)}
              aria-describedby={passwordFieldErrors.newPassword ? newPasswordErrorId : undefined}
              onChange={() => setPasswordFieldErrors((prev) => ({ ...prev, newPassword: undefined }))}
              className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-blue-400 focus:bg-white"
            />
            {passwordFieldErrors.newPassword ? (
              <p id={newPasswordErrorId} className="mt-1.5 text-xs font-bold text-rose-600">
                {passwordFieldErrors.newPassword}
              </p>
            ) : null}
          </label>

          <label className="block text-right">
            <span className="mb-2 block text-sm font-black text-[#062452]">تکرار رمز عبور جدید</span>
            <input
              ref={confirmPasswordRef}
              type="password"
              name="confirmPassword"
              required
              aria-invalid={Boolean(passwordFieldErrors.confirmPassword)}
              aria-describedby={passwordFieldErrors.confirmPassword ? confirmPasswordErrorId : undefined}
              onChange={() => setPasswordFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }))}
              className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition focus:border-blue-400 focus:bg-white"
            />
            {passwordFieldErrors.confirmPassword ? (
              <p id={confirmPasswordErrorId} className="mt-1.5 text-xs font-bold text-rose-600">
                {passwordFieldErrors.confirmPassword}
              </p>
            ) : null}
          </label>

          {passwordMessage ? (
            <p
              role={passwordMessage.ok ? "status" : "alert"}
              className={`rounded-2xl px-4 py-3 text-right text-sm font-black md:col-span-3 ${
                passwordMessage.ok
                  ? "bg-blue-50 text-blue-700"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              {passwordMessage.text}
            </p>
          ) : null}

          <div className="flex justify-end md:col-span-3">
            <button
              type="submit"
              disabled={isChangingPassword}
              className="besat-navy-button inline-flex h-[3.25rem] items-center justify-center rounded-2xl bg-[#12395b] px-7 text-sm font-black transition hover:bg-[#0d2f4d] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isChangingPassword ? "در حال ذخیره..." : "به‌روزرسانی رمز عبور"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

import {
  getAccountProfile,
  updateAccountProfile,
  uploadAccountAvatar,
  type AccountProfile,
} from "@/lib/api/account-api";

export type ProfileFormValues = {
  fullName: string;
  phone: string;
  email: string;
  description: string;
  avatar?: File;
};

export type ChangePasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export async function loadProfile(): Promise<AccountProfile | null> {
  try {
    return await getAccountProfile();
  } catch {
    return null;
  }
}

export async function saveProfile(values: ProfileFormValues): Promise<{ ok: boolean; message: string }> {
  try {
    await updateAccountProfile(undefined, {
      full_name: values.fullName,
      phone: values.phone,
      email: values.email,
      description: values.description,
    });

    if (values.avatar) {
      await uploadAccountAvatar(undefined, values.avatar);
    }

    return { ok: true, message: "اطلاعات پروفایل با موفقیت ذخیره شد." };
  } catch {
    return { ok: false, message: "خطا در ذخیره اطلاعات. لطفاً دوباره تلاش کنید." };
  }
}

export async function changePassword(
  values: ChangePasswordFormValues,
): Promise<{ ok: boolean; message: string }> {
  if (values.newPassword !== values.confirmPassword) {
    return { ok: false, message: "رمز عبور جدید و تکرار آن یکسان نیستند." };
  }

  try {
    // endpoint: me/change-password/ (باید توسط بک‌اند تأیید شود)
    const { apiRequest } = await import("@/lib/api/client");
    await apiRequest("me/change-password/", {
      method: "POST",
      body: JSON.stringify({
        current_password: values.currentPassword,
        new_password: values.newPassword,
        confirm_password: values.confirmPassword,
      }),
    });
    return { ok: true, message: "رمز عبور با موفقیت تغییر یافت." };
  } catch {
    return { ok: false, message: "خطا در تغییر رمز عبور. رمز فعلی را بررسی کنید." };
  }
}

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

export async function updateProfile(values: ProfileFormValues) {
  return {
    ok: true,
  };
}

export async function changePassword(values: ChangePasswordFormValues) {
  return {
    ok: true,
  };
}

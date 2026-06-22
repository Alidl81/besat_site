export type ProfileFormValues = {
  fullName: string;
  phone: string;
  email: string;
  description: string;
  avatar?: File;
};

export type ProfileResponse = {
  fullName: string;
  phone: string;
  email: string;
  description: string;
  avatarUrl: string | null;
};

export async function updateProfile(values: ProfileFormValues) {
  const formData = new FormData();

  formData.append("fullName", values.fullName);
  formData.append("phone", values.phone);
  formData.append("email", values.email);
  formData.append("description", values.description);

  if (values.avatar) {
    formData.append("avatar", values.avatar);
  }

  return {
    ok: true,
  };
}

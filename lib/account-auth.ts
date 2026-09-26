import type { User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  if (!currentPassword || !newPassword) {
    throw new Error("Both current and new passwords are required.");
  }

  const { error } = await supabase.auth.updateUser({
    current_password: currentPassword,
    password: newPassword,
  });

  if (error) throw error;
}

export async function changeEmail(newEmail: string): Promise<User> {
  const email = newEmail.trim().toLowerCase();
  if (!email) throw new Error("An email address is required.");

  const { data, error } = await supabase.auth.updateUser({ email });
  if (error) throw error;

  return data.user;
}

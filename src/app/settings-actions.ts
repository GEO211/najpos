"use server";

import { createClient } from "@/lib/server";
import { requireAuth } from "@/lib/auth";
import { setBeeperEnabled } from "@/lib/store-settings";
import { revalidatePath } from "next/cache";
import {
  getFormString,
  parseEmail,
  parsePassword,
  rejectMalformedForm,
} from "@/lib/validation";

export async function updateAccountEmail(formData: FormData) {
  const profile = await requireAuth();

  const malformed = rejectMalformedForm(formData);
  if (malformed) return { error: malformed };

  const emailResult = parseEmail(getFormString(formData, "email"));
  if (!emailResult.ok) return { error: emailResult.error };

  if (emailResult.value === profile.email.toLowerCase()) {
    return { error: "That is already your email address." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    email: emailResult.value,
  });

  if (error) return { error: error.message };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ email: emailResult.value })
    .eq("id", profile.id);

  if (profileError) return { error: profileError.message };

  revalidatePath("/", "layout");
  revalidatePath("/owner/settings");

  return {
    success: true,
    message:
      "Email update requested. Check your inbox to confirm the new address if Supabase requires verification.",
  };
}

export async function updateAccountPassword(formData: FormData) {
  const profile = await requireAuth();

  const malformed = rejectMalformedForm(formData);
  if (malformed) return { error: malformed };

  const currentResult = parsePassword(
    getFormString(formData, "current_password")
  );
  if (!currentResult.ok) return { error: "Current password is required." };

  const newResult = parsePassword(getFormString(formData, "new_password"));
  if (!newResult.ok) return { error: newResult.error };

  const confirm = getFormString(formData, "confirm_password");
  if (typeof confirm !== "string" || confirm !== newResult.value) {
    return { error: "New passwords do not match." };
  }

  if (currentResult.value === newResult.value) {
    return { error: "New password must be different from the current password." };
  }

  const supabase = await createClient();

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: currentResult.value,
  });

  if (verifyError) {
    return { error: "Current password is incorrect." };
  }

  const { error } = await supabase.auth.updateUser({
    password: newResult.value,
  });

  if (error) return { error: error.message };

  revalidatePath("/owner/settings");

  return { success: true, message: "Password updated successfully." };
}

export async function updateBeeperEnabled(enabled: boolean) {
  await requireAuth();

  try {
    await setBeeperEnabled(enabled);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not update beeper setting.",
    };
  }

  revalidatePath("/owner/settings");
  revalidatePath("/pos");
  return { success: true, beeperEnabled: enabled };
}

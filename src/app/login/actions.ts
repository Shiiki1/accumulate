"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export type AuthState = {
  message: string | null;
};

function credentials(formData: FormData) {
  return {
    email: String(formData.get("email") || "").trim(),
    password: String(formData.get("password") || ""),
  };
}

export async function login(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!hasSupabaseEnv()) {
    return {
      message:
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  const supabase = await createClient();
  const { email, password } = credentials(formData);

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { message: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/app");
}

export async function signup(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!hasSupabaseEnv()) {
    return {
      message:
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  const supabase = await createClient();
  const { email, password } = credentials(formData);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { message: error.message };
  }

  if (!data.session) {
    return { message: "Check your email to finish creating your account." };
  }

  revalidatePath("/", "layout");
  redirect("/app");
}

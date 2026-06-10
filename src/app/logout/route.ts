import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Auth is disabled for the temporary local archive mode.
  }

  redirect("/login");
}

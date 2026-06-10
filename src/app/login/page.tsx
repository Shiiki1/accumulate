import { AuthForm } from "@/components/AuthForm";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <AuthForm supabaseConfigured={hasSupabaseEnv()} />
    </main>
  );
}

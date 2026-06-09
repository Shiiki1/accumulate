"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { login, signup } from "@/app/login/actions";
import { pageReveal } from "@/lib/motion";

type AuthFormProps = {
  supabaseConfigured: boolean;
};

export function AuthForm({ supabaseConfigured }: AuthFormProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginState, loginAction, isLoggingIn] = useActionState(login, {
    message: null,
  });
  const [signupState, signupAction, isSigningUp] = useActionState(signup, {
    message: null,
  });

  const isPending = isLoggingIn || isSigningUp;
  const message = mode === "login" ? loginState.message : signupState.message;

  return (
    <motion.div
      variants={pageReveal}
      initial="hidden"
      animate="visible"
      className="w-full max-w-md"
    >
      <Link
        href="/"
        className="mb-14 inline-block text-sm font-medium tracking-[0.18em] uppercase"
      >
        Accumulate
      </Link>
      <h1 className="font-serif-accent text-6xl leading-none tracking-normal">
        {mode === "login" ? "Welcome back." : "Begin quietly."}
      </h1>
      <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
        A clean place to keep the references you want to return to.
      </p>
      {!supabaseConfigured ? (
        <p className="mt-6 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm leading-6 text-[var(--muted)]">
          Add your Supabase URL and publishable key to `.env.local` before
          signing in.
        </p>
      ) : null}

      <form
        action={mode === "login" ? loginAction : signupAction}
        className="mt-10 space-y-4"
      >
        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            Email
          </span>
          <input
            required
            name="email"
            type="email"
            autoComplete="email"
            className="premium-focus h-12 w-full rounded-md border border-[var(--line)] bg-transparent px-3 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            Password
          </span>
          <input
            required
            minLength={6}
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="premium-focus h-12 w-full rounded-md border border-[var(--line)] bg-transparent px-3 text-sm"
          />
        </label>

        {message ? (
          <p className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isPending || !supabaseConfigured}
          className="h-12 w-full rounded-full bg-[var(--foreground)] px-5 text-sm font-medium text-[var(--background)] transition duration-300 hover:scale-[1.01] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending
            ? "Working..."
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode((value) => (value === "login" ? "signup" : "login"))}
        className="mt-6 text-sm text-[var(--muted)] transition duration-300 hover:text-[var(--foreground)]"
      >
        {mode === "login"
          ? "Need an account? Sign up"
          : "Already have an account? Sign in"}
      </button>
    </motion.div>
  );
}

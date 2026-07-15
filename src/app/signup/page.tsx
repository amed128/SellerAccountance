import Link from "next/link";
import { getDict } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { signup } from "./actions";

export const dynamic = "force-dynamic";

const ERROR_KEYS = {
  taken: "emailTaken",
  weak: "passwordTooShort",
  invalid: "invalidEmail",
} as const;

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ d }, { error }, user] = await Promise.all([getDict(), searchParams, getSession()]);
  if (user) redirect("/");

  const errorKey = error && error in ERROR_KEYS ? ERROR_KEYS[error as keyof typeof ERROR_KEYS] : null;

  return (
    <main className="mx-auto max-w-sm px-6 py-12 w-full">
      <h1 className="text-2xl font-bold">{d.auth.signupTitle}</h1>

      {errorKey && (
        <p className="mt-4 rounded-lg bg-red-50 dark:bg-red-950 px-4 py-2 text-sm text-red-700 dark:text-red-300">
          {d.auth[errorKey]}
        </p>
      )}

      <form action={signup} className="mt-6 space-y-4 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div>
          <label className="text-sm font-medium" htmlFor="name">
            {d.auth.nameOptional}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="email">
            {d.auth.email}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="password">
            {d.auth.password}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {d.auth.signupSubmit}
        </button>
      </form>

      <p className="mt-4 text-sm text-gray-500">
        {d.auth.hasAccount}{" "}
        <Link href="/login" className="text-blue-600 hover:underline">
          {d.auth.loginLink}
        </Link>
      </p>
    </main>
  );
}

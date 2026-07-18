import Link from "next/link";
import { getDict } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const [{ d }, user] = await Promise.all([getDict(), getSession()]);
  if (user) redirect("/");

  return (
    <main className="mx-auto max-w-sm px-6 py-12 w-full">
      <h1 className="text-2xl font-bold">{d.auth.loginTitle}</h1>

      <LoginForm
        labels={{
          email: d.auth.email,
          password: d.auth.password,
          loginSubmit: d.auth.loginSubmit,
          invalidCredentials: d.auth.invalidCredentials,
        }}
      />

      <p className="mt-4 text-sm text-gray-500">
        {d.auth.noAccount}{" "}
        <Link href="/signup" className="text-blue-600 hover:underline">
          {d.auth.signupLink}
        </Link>
      </p>
    </main>
  );
}

import Link from "next/link";
import { getDict } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { logout } from "@/app/logout/actions";

export default async function Nav() {
  const [{ d }, user] = await Promise.all([getDict(), getSession()]);
  return (
    <header>
      <div className="mx-auto max-w-4xl px-6 py-3">
        <Link href="/" className="font-bold">
          SellerAccountance
        </Link>
      </div>
      <nav className="border-t border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-5 gap-y-2 px-6 py-2.5 text-sm">
          {user ? (
            <>
              <Link href="/" className="text-gray-600 dark:text-gray-300 hover:text-blue-600">
                {d.nav.home}
              </Link>
              <Link href="/overview" className="text-gray-600 dark:text-gray-300 hover:text-blue-600">
                {d.nav.overview}
              </Link>
              <Link href="/help" className="text-gray-600 dark:text-gray-300 hover:text-blue-600">
                {d.nav.help}
              </Link>
              <Link
                href="/settings"
                className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-gray-600 dark:text-gray-300 hover:border-blue-500 hover:text-blue-600"
              >
                {d.nav.settings}
              </Link>
              <form action={logout} className="ml-auto">
                <button type="submit" className="text-gray-600 dark:text-gray-300 hover:text-blue-600">
                  {d.nav.logout}
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/help" className="text-gray-600 dark:text-gray-300 hover:text-blue-600">
                {d.nav.help}
              </Link>
              <Link
                href="/login"
                className="ml-auto rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-gray-600 dark:text-gray-300 hover:border-blue-500 hover:text-blue-600"
              >
                {d.nav.login}
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

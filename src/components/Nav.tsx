import Link from "next/link";
import { getDict } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { logout } from "@/app/logout/actions";
import NavMenu from "@/components/NavMenu";

const linkClass = "text-gray-600 dark:text-gray-300 hover:text-blue-600";
const ctaClass =
  "rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-gray-600 dark:text-gray-300 hover:border-blue-500 hover:text-blue-600";

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
        <NavMenu openLabel={d.nav.openMenu} closeLabel={d.nav.closeMenu}>
          {user ? (
            <>
              <Link href="/" className={linkClass}>
                {d.nav.home}
              </Link>
              <Link href="/overview" className={linkClass}>
                {d.nav.overview}
              </Link>
              <Link href="/sourcing" className={linkClass}>
                {d.nav.sourcing}
              </Link>
              <Link href="/help" className={linkClass}>
                {d.nav.help}
              </Link>
              <Link href="/settings" className={linkClass}>
                {d.nav.settings}
              </Link>
              <form action={logout} className="sm:ml-auto">
                <button type="submit" className={linkClass}>
                  {d.nav.logout}
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/help" className={linkClass}>
                {d.nav.help}
              </Link>
              <Link href="/login" className={`sm:ml-auto ${ctaClass}`}>
                {d.nav.login}
              </Link>
            </>
          )}
        </NavMenu>
      </nav>
    </header>
  );
}

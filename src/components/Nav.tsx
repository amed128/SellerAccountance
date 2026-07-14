import Link from "next/link";
import { getDict } from "@/lib/i18n";

export default async function Nav() {
  const { d } = await getDict();
  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
        <Link href="/" className="font-bold">
          SellerAccountance
        </Link>
        <div className="flex items-center gap-5 text-sm">
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
        </div>
      </nav>
    </header>
  );
}

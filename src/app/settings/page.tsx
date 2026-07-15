import { getDict } from "@/lib/i18n";
import { getTheme } from "@/lib/theme";
import { requireUser } from "@/lib/auth";
import { saveSettings } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ locale, d }, theme, { saved }] = await Promise.all([getDict(), getTheme(), searchParams, requireUser()]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">{d.settings.title}</h1>

      {saved && (
        <p className="mt-4 rounded-lg bg-green-50 dark:bg-green-950 px-4 py-2 text-sm text-green-700 dark:text-green-300">
          {d.settings.saved}
        </p>
      )}

      <form action={saveSettings} className="mt-8 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="font-semibold">{d.settings.language}</h2>
        <p className="text-sm text-gray-500">{d.settings.languageSub}</p>
        <div className="mt-4 flex gap-6">
          <label className="flex items-center gap-2">
            <input type="radio" name="locale" value="fr" defaultChecked={locale === "fr"} />
            {d.settings.french}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="locale" value="en" defaultChecked={locale === "en"} />
            {d.settings.english}
          </label>
        </div>
        <hr className="my-6 border-gray-200 dark:border-gray-800" />

        <h2 className="font-semibold">{d.settings.theme}</h2>
        <p className="text-sm text-gray-500">{d.settings.themeSub}</p>
        <div className="mt-4 flex gap-6">
          <label className="flex items-center gap-2">
            <input type="radio" name="theme" value="system" defaultChecked={theme === "system"} />
            {d.settings.themeSystem}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="theme" value="light" defaultChecked={theme === "light"} />
            {d.settings.themeLight}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="theme" value="dark" defaultChecked={theme === "dark"} />
            {d.settings.themeDark}
          </label>
        </div>

        <button
          type="submit"
          className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {d.settings.save}
        </button>
      </form>
    </main>
  );
}

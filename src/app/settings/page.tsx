import { getDict } from "@/lib/i18n";
import { getTheme } from "@/lib/theme";
import { requireOnboardedUser } from "@/lib/auth";
import { EU_COUNTRY_CODES } from "@/lib/vat";
import { saveSettings } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ locale, d }, theme, { saved }, user] = await Promise.all([
    getDict(),
    getTheme(),
    searchParams,
    requireOnboardedUser(),
  ]);

  const countryOptions = [...EU_COUNTRY_CODES].sort((a, b) =>
    (d.countries[a] ?? a).localeCompare(d.countries[b] ?? b, locale)
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">{d.settings.title}</h1>

      {saved && (
        <p className="mt-4 rounded-lg bg-green-50 dark:bg-green-950 px-4 py-2 text-sm text-green-700 dark:text-green-300">
          {d.settings.saved}
        </p>
      )}

      <form action={saveSettings} className="mt-8 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="font-semibold">{d.settings.companyTitle}</h2>

        <p className="mt-4 text-sm font-medium">{d.settings.homeCountry}</p>
        <p className="text-sm text-gray-500">{d.settings.homeCountrySub}</p>
        <select
          name="homeCountry"
          defaultValue={user.homeCountry}
          className="mt-2 w-full max-w-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
        >
          {countryOptions.map((code) => (
            <option key={code} value={code}>
              {d.countries[code] ?? code}
            </option>
          ))}
        </select>

        <p className="mt-6 text-sm font-medium">{d.settings.vatRegime}</p>
        <p className="text-sm text-gray-500">{d.settings.vatRegimeSub}</p>
        <div className="mt-3 space-y-3">
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="vatRegime"
              value="STANDARD"
              defaultChecked={user.vatRegime !== "FRANCHISE"}
              className="mt-1"
            />
            <span>
              <span className="block">{d.settings.vatRegimeStandard}</span>
              <span className="block text-sm text-gray-500">{d.settings.vatRegimeStandardSub}</span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="vatRegime"
              value="FRANCHISE"
              defaultChecked={user.vatRegime === "FRANCHISE"}
              className="mt-1"
            />
            <span>
              <span className="block">{d.settings.vatRegimeFranchise}</span>
              <span className="block text-sm text-gray-500">{d.settings.vatRegimeFranchiseSub}</span>
            </span>
          </label>
        </div>
        <hr className="my-6 border-gray-200 dark:border-gray-800" />

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

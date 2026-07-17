import { redirect } from "next/navigation";
import { getDict } from "@/lib/i18n";
import { requireUser } from "@/lib/auth";
import { EU_COUNTRY_CODES, DEFAULT_HOME_COUNTRY } from "@/lib/vat";
import { completeOnboarding } from "./actions";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const [user, { locale, d }] = await Promise.all([requireUser(), getDict()]);
  if (user.onboarded) redirect("/");

  const countryOptions = [...EU_COUNTRY_CODES].sort((a, b) =>
    (d.countries[a] ?? a).localeCompare(d.countries[b] ?? b, locale)
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">{d.onboarding.title}</h1>
      <p className="mt-2 text-sm text-gray-500">{d.onboarding.subtitle}</p>

      <form action={completeOnboarding} className="mt-8 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="font-semibold">{d.settings.companyTitle}</h2>

        <p className="mt-4 text-sm font-medium">{d.settings.homeCountry}</p>
        <p className="text-sm text-gray-500">{d.settings.homeCountrySub}</p>
        <select
          name="homeCountry"
          defaultValue={DEFAULT_HOME_COUNTRY}
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
            <input type="radio" name="vatRegime" value="STANDARD" defaultChecked className="mt-1" />
            <span>
              <span className="block">{d.settings.vatRegimeStandard}</span>
              <span className="block text-sm text-gray-500">{d.settings.vatRegimeStandardSub}</span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="vatRegime" value="FRANCHISE" className="mt-1" />
            <span>
              <span className="block">{d.settings.vatRegimeFranchise}</span>
              <span className="block text-sm text-gray-500">{d.settings.vatRegimeFranchiseSub}</span>
            </span>
          </label>
        </div>

        <button
          type="submit"
          className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {d.onboarding.start}
        </button>
      </form>
    </main>
  );
}

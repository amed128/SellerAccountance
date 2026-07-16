"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LOCALE_COOKIE } from "@/lib/i18n";
import { THEME_COOKIE } from "@/lib/theme";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EU_COUNTRY_CODES, DEFAULT_HOME_COUNTRY } from "@/lib/vat";

const COOKIE_OPTS = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };

export async function saveSettings(formData: FormData) {
  const user = await requireUser();

  const locale = formData.get("locale") === "en" ? "en" : "fr";
  const themeRaw = formData.get("theme");
  const theme = themeRaw === "light" || themeRaw === "dark" ? themeRaw : "system";

  const homeCountryRaw = String(formData.get("homeCountry") ?? "");
  const homeCountry = EU_COUNTRY_CODES.includes(homeCountryRaw) ? homeCountryRaw : DEFAULT_HOME_COUNTRY;
  const vatRegime = formData.get("vatRegime") === "FRANCHISE" ? "FRANCHISE" : "STANDARD";

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, COOKIE_OPTS);
  store.set(THEME_COOKIE, theme, COOKIE_OPTS);

  await prisma.user.update({ where: { id: user.id }, data: { homeCountry, vatRegime } });

  revalidatePath("/", "layout");
  redirect("/settings?saved=1");
}

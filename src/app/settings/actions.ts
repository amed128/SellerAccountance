"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LOCALE_COOKIE } from "@/lib/i18n";
import { THEME_COOKIE } from "@/lib/theme";

const COOKIE_OPTS = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };

export async function saveSettings(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "fr";
  const themeRaw = formData.get("theme");
  const theme = themeRaw === "light" || themeRaw === "dark" ? themeRaw : "system";
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, COOKIE_OPTS);
  store.set(THEME_COOKIE, theme, COOKIE_OPTS);
  revalidatePath("/", "layout");
  redirect("/settings?saved=1");
}

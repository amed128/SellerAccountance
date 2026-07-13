"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LOCALE_COOKIE } from "@/lib/i18n";

export async function saveSettings(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "fr";
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
  redirect("/settings?saved=1");
}

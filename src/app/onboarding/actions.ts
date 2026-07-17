"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EU_COUNTRY_CODES, DEFAULT_HOME_COUNTRY } from "@/lib/vat";

export async function completeOnboarding(formData: FormData) {
  const user = await requireUser();

  const homeCountryRaw = String(formData.get("homeCountry") ?? "");
  const homeCountry = EU_COUNTRY_CODES.includes(homeCountryRaw) ? homeCountryRaw : DEFAULT_HOME_COUNTRY;
  const vatRegime = formData.get("vatRegime") === "FRANCHISE" ? "FRANCHISE" : "STANDARD";

  await prisma.user.update({ where: { id: user.id }, data: { homeCountry, vatRegime, onboarded: true } });

  redirect("/");
}

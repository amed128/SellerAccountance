"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseAmount } from "@/lib/parsers/types";
import { VAT_TREATMENTS, CURRENCIES } from "./constants";

export async function addSourcingInvoice(formData: FormData) {
  const user = await requireOnboardedUser();

  const supplier = String(formData.get("supplier") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const date = new Date(String(formData.get("date") ?? ""));
  const quantity = Math.max(1, Math.trunc(parseAmount(String(formData.get("quantity") ?? "1"))));
  const amountExclVat = parseAmount(String(formData.get("amountExclVat") ?? ""));
  const vatAmount = parseAmount(String(formData.get("vatAmount") ?? "0"));
  const amountInclVat = parseAmount(String(formData.get("amountInclVat") ?? ""));
  const currencyRaw = String(formData.get("currency") ?? "EUR").trim().toUpperCase();
  const currency = CURRENCIES.includes(currencyRaw) ? currencyRaw : "EUR";
  const vatTreatmentRaw = String(formData.get("vatTreatment") ?? "");
  const vatTreatment = VAT_TREATMENTS.includes(vatTreatmentRaw) ? vatTreatmentRaw : "DOMESTIC";

  if (!supplier || !sku || Number.isNaN(date.getTime()) || amountExclVat <= 0) {
    redirect("/sourcing?error=invalid");
  }

  await prisma.sourcingInvoice.create({
    data: {
      userId: user.id,
      supplier,
      sku,
      date,
      quantity,
      amountExclVat,
      vatAmount,
      amountInclVat,
      currency,
      vatTreatment,
    },
  });

  revalidatePath("/sourcing");
  redirect("/sourcing?saved=1");
}

export async function deleteSourcingInvoice(formData: FormData) {
  const user = await requireOnboardedUser();
  const id = String(formData.get("id") ?? "");

  await prisma.sourcingInvoice.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/sourcing");
}

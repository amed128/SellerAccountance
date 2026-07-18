"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";

export interface LoginState {
  error?: "invalid";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  // Return (instead of redirect) so the page doesn't reload and the form keeps its values
  if (!user || !ok) return { error: "invalid" };

  await createSession(user.id);
  redirect("/");
}

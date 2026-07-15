"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim() || null;

  if (!EMAIL_RE.test(email)) redirect("/signup?error=invalid");
  if (password.length < 8) redirect("/signup?error=weak");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) redirect("/signup?error=taken");

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { email, passwordHash, name } });
  await createSession(user.id);
  redirect("/");
}

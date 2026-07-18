"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Nav CTA vers /login — masqué quand on est déjà sur la page de connexion
export default function LoginLink({ label, className }: { label: string; className?: string }) {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return (
    <Link href="/login" className={className}>
      {label}
    </Link>
  );
}

"use client";

import { useActionState, useState } from "react";
import { login, LoginState } from "@/app/login/actions";

interface Labels {
  email: string;
  password: string;
  loginSubmit: string;
  invalidCredentials: string;
}

export default function LoginForm({ labels }: { labels: Labels }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  // Controlled inputs: on a failed login the values must stay — the user
  // edits or clears them, not us (React resets uncontrolled fields after an action)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <>
      {state.error && (
        <p className="mt-4 rounded-lg bg-red-50 dark:bg-red-950 px-4 py-2 text-sm text-red-700 dark:text-red-300">
          {labels.invalidCredentials}
        </p>
      )}

      <form action={action} className="mt-6 space-y-4 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div>
          <label className="text-sm font-medium" htmlFor="email">
            {labels.email}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="password">
            {labels.password}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
        >
          {labels.loginSubmit}
        </button>
      </form>
    </>
  );
}

import type { Dict } from "@/lib/i18n";

export default function ExportGuide({ d }: { d: Dict }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{d.help.exportTitle}</h2>
      <ul className="mt-3 space-y-3">
        {d.help.guide.map((g) => (
          <li key={g.name} className="rounded-lg bg-gray-50 dark:bg-gray-900 p-3">
            <p className="font-medium">
              {g.name}{" "}
              <span className="ml-1 rounded-full bg-blue-100 dark:bg-blue-900 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-300">
                {g.badge}
              </span>
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{g.path}</p>
            <p className="mt-0.5 text-sm text-gray-500">{g.steps}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

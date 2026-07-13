import { getDict } from "@/lib/i18n";
import ExportGuide from "@/components/ExportGuide";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const { d } = await getDict();
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">{d.help.title}</h1>
      <div className="mt-8">
        <ExportGuide d={d} />
      </div>
    </main>
  );
}

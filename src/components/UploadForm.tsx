"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/i18n";

const MAX_FILES = 10;

interface FileResult {
  fileName: string;
  reportId?: string;
  rowCount?: number;
  error?: string;
}

function fmtSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export default function UploadForm({ d }: { d: Dict["upload"] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<FileResult[] | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function addFiles(list: FileList | File[]) {
    setError(null);
    setResults(null);
    setFiles((prev) => {
      const merged = [...prev];
      for (const f of Array.from(list)) {
        if (merged.some((m) => m.name === f.name && m.size === f.size)) continue;
        merged.push(f);
      }
      if (merged.length > MAX_FILES) {
        setError(d.maxFiles.replaceAll("{n}", String(MAX_FILES)));
        return merged.slice(0, MAX_FILES);
      }
      return merged;
    });
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function generate() {
    if (files.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok && !json.results) {
        setError(json.error ?? d.unknownError);
        return;
      }
      const all: FileResult[] = json.results ?? [];
      const created = all.filter((r) => r.reportId);
      setResults(all);
      setFiles(all.filter((r) => r.error).map((r) => files.find((f) => f.name === r.fileName)!).filter(Boolean));
      if (created.length === 1 && all.length === 1) {
        router.push(`/reports/${created[0].reportId}`);
      }
      router.refresh();
    } catch {
      setError(d.networkError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          dragOver ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-gray-300 dark:border-gray-700 hover:border-blue-400"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt,.tsv"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="font-medium">{d.dropTitle}</p>
        <p className="mt-1 text-sm text-gray-500">{d.dropSub}</p>
      </div>

      {files.length > 0 && (
        <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-800">
          {files.map((f, i) => (
            <li key={`${f.name}-${f.size}`} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span className="min-w-0 truncate">{f.name} <span className="text-gray-400">· {fmtSize(f.size)}</span></span>
              <button
                onClick={() => removeFile(i)}
                disabled={busy}
                className="shrink-0 text-gray-400 hover:text-red-600"
                aria-label={`${d.remove} ${f.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={generate}
        disabled={files.length === 0 || busy}
        className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700"
      >
        {busy
          ? d.analyzing
          : files.length > 1
            ? d.generateMany.replaceAll("{n}", String(files.length))
            : d.generateOne}
      </button>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 dark:bg-red-950 px-4 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="mt-3 space-y-1">
          {results.map((r) => (
            <li
              key={r.fileName}
              className={`rounded-lg px-4 py-2 text-sm ${
                r.error
                  ? "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
                  : "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
              }`}
            >
              {r.error
                ? `✗ ${r.fileName} — ${r.error}`
                : `✓ ${r.fileName} — ${r.rowCount} ${d.imported}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

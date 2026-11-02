"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAlert } from "@/context/AlertContext";
import { getModuleById, getStepsByModuleId } from "@/lib/firebase/db-operations";
import { parseModule } from "@/lib/importExport/parse";
import { planImport } from "@/lib/importExport/planImport";
import { applyImport } from "@/lib/importExport/applyImport";
import type { ImportPlan, ParsedModule, ParseError } from "@/lib/importExport/types";
import type { Module } from "@/lib/firebase/types";

export interface ImportModuleModalProps {
  moduleId?: string;
  onClose: () => void;
  onImported: (moduleId: string) => void;
}

const imageTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const button = "px-4 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50";
type Preview = { parsed: ParsedModule; plan: ImportPlan; live: Module | null; images: File[] };

export default function ImportModuleModal({ moduleId, onClose, onImported }: ImportModuleModalProps) {
  const [user] = useAuth();
  const { showAlert } = useAlert();
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const locked = useRef(false);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = dialog.current;
    root?.focus();
    return () => previous?.focus();
  }, []);

  async function handlePreview() {
    if (locked.current) return;
    setPreview(null);
    setErrors([]);
    const markdown = files.filter(file => /\.md$/i.test(file.name));
    const validation: ParseError[] = [];
    if (markdown.length !== 1) validation.push({ line: 0, message: "Upload exactly one .md file." });
    const images = files.filter(file => !/\.md$/i.test(file.name));
    const names = new Set<string>();
    for (const file of images) {
      if (!imageTypes.has(file.type)) validation.push({ line: 0, message: `Unsupported image: ${file.name}. Use PNG, JPEG, WebP or GIF.` });
      if (file.size > 5 * 1024 * 1024) validation.push({ line: 0, message: `Image ${file.name} must be 5 MB or smaller.` });
      if (names.has(file.name)) validation.push({ line: 0, message: `Duplicate image filename: ${file.name}. Upload only one image with this name.` });
      names.add(file.name);
    }
    if (validation.length) { setErrors(validation); return; }
    locked.current = true;
    setBusy("preview");
    try {
      const result = parseModule(await markdown[0].text());
      if (result.errors.length || !result.module) {
        setErrors(result.errors.length ? result.errors : [{ line: 0, message: "The file could not be parsed." }]);
        return;
      }
      const parsed = result.module;
      const missing = parsed.imageFilenames.filter(name => !names.has(name));
      if (missing.length) {
        setErrors(missing.map(name => ({ line: 0, message: `Missing image: ${name}. Upload this image alongside the markdown file.` })));
        return;
      }
      if (moduleId && parsed.id !== moduleId) {
        setErrors([{ line: 1, message: "The file must contain the ID of this module. Export this module before editing and importing it." }]);
        return;
      }
      const [live, steps] = moduleId
        ? await Promise.all([getModuleById(moduleId), getStepsByModuleId(moduleId)])
        : [null, []] as const;
      const plan = planImport(parsed, live, [...steps]);
      if (plan.errors.length) { setErrors(plan.errors); return; }
      setPreview({ parsed, plan, live, images: images.filter(file => parsed.imageFilenames.includes(file.name)) });
    } catch {
      void showAlert("Import preview failed", "Could not read the file or load the module. Please try again.", "error");
    } finally {
      locked.current = false;
      setBusy(null);
    }
  }

  async function handleImport() {
    if (!preview || locked.current) return;
    if (!user) {
      void showAlert("Sign in required", "Please sign in again before importing a module.", "error");
      return;
    }
    locked.current = true;
    setBusy("import");
    let importedId: string;
    try {
      const result = await applyImport(preview.plan, preview.parsed, preview.images, user.uid);
      importedId = result.moduleId;
    } catch {
      // A failed apply may have completed some writes. Require a fresh preview.
      setPreview(null);
      void showAlert("Import failed", "The import could not be completed. Some changes may have been saved. Review a fresh preview before trying again.", "error");
      locked.current = false;
      setBusy(null);
      return;
    }
    toast.success("Module imported successfully.");
    onImported(importedId);
  }

  const destructive = !!preview && (preview.plan.deletes.length > 0 || preview.plan.removedPollOptions.length > 0);
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="import-module-title" aria-busy={!!busy} tabIndex={-1}
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col text-gray-900"
        onKeyDown={event => {
          if (event.key === "Escape") { event.stopPropagation(); if (!locked.current) onClose(); }
          if (event.key === "Tab") {
            const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') ?? []);
            const first = controls[0], last = controls[controls.length - 1];
            if (!first) { event.preventDefault(); return; }
            if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
          }
        }}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 id="import-module-title" className="text-2xl font-bold">{moduleId ? "Import into Module" : "Import Module"}</h2>
          <button aria-label="Close import dialog" disabled={!!busy} onClick={onClose} className={`${button} text-gray-500 hover:bg-gray-100`}>✕</button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div>
            <label htmlFor="module-import-files" className="block text-sm font-medium mb-2">Markdown file and images</label>
            <p id="module-import-help" className="text-sm text-gray-600 mb-3">Choose exactly one .md file and all images it references. Images can be PNG, JPEG, WebP or GIF (up to 5 MB each).</p>
            <input id="module-import-files" type="file" accept=".md,image/png,image/jpeg,image/webp,image/gif" multiple disabled={!!busy}
              aria-describedby="module-import-help" className="block w-full text-sm border border-gray-300 rounded-lg p-3 disabled:bg-gray-100"
              onChange={event => { setFiles(Array.from(event.target.files ?? [])); setErrors([]); setPreview(null); }} />
            {files.length > 0 && <ul className="mt-2 text-sm text-gray-600">{files.map((file, index) => <li key={index}>{file.name}</li>)}</ul>}
          </div>
          {errors.length > 0 && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Fix these errors before importing</h3>
            <ul className="list-disc pl-5">{errors.map((error, index) => <li key={index}>{error.line > 0 ? `Line ${error.line}: ` : ""}{error.message}</li>)}</ul>
          </div>}
          {preview && <section aria-label="Import preview" className="space-y-4">
            <h3 className="text-lg font-semibold">Preview changes</h3>
            <p className="text-sm text-gray-600">{preview.plan.isNewModule ? "A new module will be created." : "The following changes will be applied to this module."}</p>
            <dl className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-sm">
              {([['Title', 'title'], ['Description', 'description'], ['Tags', 'tags'], ['Visibility', 'isPublic']] as const).map(([label, key]) => {
                const format = (value: unknown) => key === 'isPublic' ? (value ? 'Public' : 'Private') : Array.isArray(value) ? value.join(', ') || 'None' : String(value || 'None');
                const before = preview.live && format(preview.live[key]);
                const after = format(preview.parsed[key]);
                return <div key={key}><dt className="font-medium">{label}</dt><dd className="whitespace-pre-wrap break-words">{before !== null && before !== after && <><span className="text-gray-500">{before}</span> → </>}{after}</dd></div>;
              })}
            </dl>
            {preview.plan.isStale && <p role="alert" className="bg-yellow-50 text-yellow-900 border border-yellow-200 rounded-lg p-4">This module was changed after this file was exported. Importing will overwrite those changes.</p>}
            {preview.plan.deletes.length > 0 && <p role="alert" className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-4">These steps will be deleted, along with student progress on them.</p>}
            {([
              ["New steps", preview.plan.creates],
              ["Updated steps", preview.plan.updates.map(update => update.parsed)],
              ["Deleted steps", preview.plan.deletes],
            ] as const).map(([label, steps]) => <div key={label}>
              <h4 className="font-semibold">{label} ({steps.length})</h4>
              {steps.length ? <ul className="list-disc pl-5 break-words">{steps.map((step, index) => <li key={index}>{step.title}</li>)}</ul> : <p className="text-sm text-gray-500">None</p>}
            </div>)}
            {preview.plan.removedPollOptions.length > 0 && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-4">
              <h4 className="font-semibold">Poll options and votes to be deleted</h4>
              <ul className="list-disc pl-5">{preview.plan.removedPollOptions.map((option, index) => <li key={index}>{option.stepTitle}: {option.optionText} ({option.votes} {option.votes === 1 ? "vote" : "votes"})</li>)}</ul>
            </div>}
          </section>}
          {busy && <p role="status" className="text-sm text-gray-600">{busy === "import" ? "Importing module…" : "Preparing preview…"}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button disabled={!!busy} onClick={onClose} className={`${button} text-gray-700 bg-gray-100 hover:bg-gray-200`}>Cancel</button>
          {preview
            ? <button disabled={!!busy} onClick={handleImport} className={`${button} text-white ${destructive ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}>{busy === "import" ? "Importing…" : "Import"}</button>
            : <button disabled={!!busy || !files.length} onClick={handlePreview} className={`${button} bg-blue-600 hover:bg-blue-700 text-white`}>{busy === "preview" ? "Preparing…" : "Preview Import"}</button>}
        </div>
      </div>
    </div>
  );
}

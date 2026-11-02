import { moduleFilename, serializeModule } from './module-markdown';
import type { ExportModule } from './module-markdown';

export async function createModuleDownload(modules: ExportModule[]) {
  if (!modules.length) throw new Error('Select at least one module to export.');
  const files = modules.map((module) => ({ name: moduleFilename(module), content: serializeModule(module) }));
  if (new Set(files.map((file) => file.name)).size !== files.length) {
    throw new Error('Selected modules have duplicate export filenames.');
  }
  if (files.length === 1) {
    return { filename: files[0].name, blob: new Blob([files[0].content], { type: 'text/markdown;charset=utf-8' }) };
  }
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const file of files) zip.file(file.name, file.content);
  const content = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  return {
    filename: `modules-${new Date().toISOString().slice(0, 10)}.zip`,
    blob: new Blob([content], { type: 'application/zip' }),
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Give the browser time to start reading the download before releasing the URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

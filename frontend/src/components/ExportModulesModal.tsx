'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, Stack, Typography,
} from '@mui/material';
import type { Module } from '@/lib/firebase/types';
import { getExportModules, getModuleForExport } from '@/lib/module-export-data';
import { createModuleDownload, downloadBlob } from '@/lib/module-download';

export default function ExportModulesModal({ onClose }: { onClose: () => void }) {
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getExportModules().then((result) => {
      if (active) setModules(result);
    }).catch((cause: unknown) => {
      if (active) setError(`Could not load modules. ${cause instanceof Error ? cause.message : 'Please try again.'}`);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [loadAttempt]);

  const allSelected = modules.length > 0 && selectedIds.size === modules.length;
  const toggleModule = (id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExport = async () => {
    if (exporting || !selectedIds.size) return;
    setExporting(true);
    setError(null);
    try {
      const selected = modules.filter((module) => selectedIds.has(module.id));
      const content = await Promise.all(selected.map(async (module) => {
        try {
          return await getModuleForExport(module.id);
        } catch (cause) {
          throw new Error(`Could not read "${module.title}". ${cause instanceof Error ? cause.message : 'Please try again.'}`);
        }
      }));
      const download = await createModuleDownload(content);
      if (!mounted.current) return;
      downloadBlob(download.blob, download.filename);
      onClose();
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Export failed. Please try again.');
    } finally {
      if (mounted.current) setExporting(false);
    }
  };

  return (
    <Dialog open onClose={exporting ? undefined : onClose} fullWidth maxWidth="sm"
      disableEscapeKeyDown={exporting} aria-labelledby="export-modules-title">
      <DialogTitle id="export-modules-title">Export modules</DialogTitle>
      <DialogContent dividers aria-busy={loading || exporting}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select public or private modules. One module downloads as Markdown; multiple modules download as a ZIP containing one Markdown file each.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {loading ? (
          <Stack direction="row" alignItems="center" spacing={2} role="status">
            <CircularProgress size={24} /><Typography>Loading modules…</Typography>
          </Stack>
        ) : modules.length === 0 ? (
          error ? <Button onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Retry loading modules</Button>
            : <Typography>No modules available to export.</Typography>
        ) : (
          <>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <FormControlLabel label={allSelected ? 'Select none' : 'Select all'} control={
                <Checkbox checked={allSelected} indeterminate={selectedIds.size > 0 && !allSelected}
                  disabled={exporting} onChange={() => setSelectedIds(allSelected ? new Set() : new Set(modules.map((module) => module.id)))} />
              } />
              <Typography variant="body2" aria-live="polite">{selectedIds.size} of {modules.length} selected</Typography>
            </Stack>
            <Box sx={{ maxHeight: 360, overflowY: 'auto', mt: 1 }}>
              {modules.map((module) => (
                <FormControlLabel key={module.id} sx={{ display: 'flex', m: 0, py: 0.5, alignItems: 'flex-start' }}
                  control={<Checkbox checked={selectedIds.has(module.id)} disabled={exporting} onChange={() => toggleModule(module.id)} />}
                  label={<Box sx={{ py: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography sx={{ overflowWrap: 'anywhere' }}>{module.title}</Typography>
                      <Chip label={module.isPublic ? 'Public' : 'Private'} size="small" />
                    </Stack>
                    {module.description && <Typography variant="body2" color="text.secondary">{module.description}</Typography>}
                  </Box>} />
              ))}
            </Box>
          </>
        )}
        {exporting && <Typography role="status" variant="body2" sx={{ mt: 2 }}>Preparing your download…</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={exporting}>Cancel</Button>
        <Button variant="contained" onClick={handleExport} disabled={loading || exporting || selectedIds.size === 0}
          startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : undefined}>
          {exporting ? 'Exporting…' : `Export${selectedIds.size ? ` (${selectedIds.size})` : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

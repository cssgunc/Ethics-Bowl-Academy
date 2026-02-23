'use client';

import { useJournal } from '@/hooks/useJournal';
import { formatRelative } from '@/utils/formatDate';
import {
  Box,
  Button,
  Card,
  Divider,
  Grid,
  IconButton,
  Input,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { useState, useEffect, useCallback } from 'react';
import { useAlert } from '@/context/AlertContext';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LockIcon from '@mui/icons-material/Lock';
import { Tooltip } from '@mui/material';

interface JournalUIState {
  sortMode: 'updated' | 'created';
  lastSearch?: string;
}

export function Journal() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));


  const {
    entries,
    activeId,
    setActiveId,
    createEntry,
    updateEntry,
    deleteEntry,
    isLoading,
    error,
    isAuthenticated
  } = useJournal();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'updated' | 'created'>('updated');
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState<'saved' | 'edited'>('saved');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { showConfirm } = useAlert();

  // Load UI preferences
  useEffect(() => {
    const savedUI = localStorage.getItem(`journal:ui`);
    if (savedUI) {
      try {
        const parsedUI: JournalUIState = JSON.parse(savedUI);
        setSortMode(parsedUI.sortMode || 'updated');
        setSearchQuery(parsedUI.lastSearch || '');
      } catch (e) {
        console.error('Failed to parse UI preferences', e);
      }
    }
  }, []);


  // Save UI preferences
  useEffect(() => {
    const uiState: JournalUIState = {
      sortMode,
      lastSearch: searchQuery
    };
    localStorage.setItem(`journal:ui`, JSON.stringify(uiState));
  }, [sortMode, searchQuery]);

  const getEntryBodyText = (entry: any): string => {
    const body = entry.body;

    if (!body) return '';

    // Normal journal entry: body is a plain string
    if (typeof body === 'string') {
      return body;
    }

    // Module-linked entry: body is a map { [stepId]: [prompt, answer] }
    if (typeof body === 'object') {
      try {
        const sections = Object.values(body) as [string, string][];

        return sections
          .map(([prompt, answer]) => {
            const promptLine = `${prompt.trim()}:`;
            const answerLine = `- ${answer.trim()}`;
            return `${promptLine}\n${answerLine}`;
          })
          .join('\n\n');
      } catch {
        return '';
      }
    }


    return '';
  };


  // Filter and sort entries
  const filteredEntries = entries
    .filter(entry => {
      const q = searchQuery.toLowerCase();
      const bodyText = getEntryBodyText(entry).toLowerCase();

      return (
        entry.title.toLowerCase().includes(q) ||
        bodyText.includes(q)
      );
    })
    .sort((a, b) => {
      const rawDateA = sortMode === 'updated' ? a.updatedAt : a.createdAt;
      const rawDateB = sortMode === 'updated' ? b.updatedAt : b.createdAt;

      const dateA = rawDateA instanceof Date
        ? rawDateA
        : (rawDateA && typeof rawDateA === 'object' && 'toDate' in rawDateA && typeof rawDateA.toDate === 'function')
          ? rawDateA.toDate()
          : new Date();

      const dateB = rawDateB instanceof Date
        ? rawDateB
        : (rawDateB && typeof rawDateB === 'object' && 'toDate' in rawDateB && typeof rawDateB.toDate === 'function')
          ? rawDateB.toDate()
          : new Date();

      return dateB.getTime() - dateA.getTime();
    });


  const activeEntry = entries.find(entry => entry.id === activeId);
  const isLocked = !!activeEntry?.moduleId;

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      createEntry();
      if (isMobile) setIsEditing(true);
    } else if ((e.ctrlKey || e.metaKey) && e.key === 's' && activeId) {
      e.preventDefault();
      updateEntry(activeId, {
        title: activeEntry?.title || '',
        body: activeEntry?.body || ''
      });
      setStatus('saved');
    } else if (e.key === 'Delete' && activeId) {
      e.preventDefault();
      // We can't await here easily in the callback, but showConfirm returns a promise.
      // For the shortcut, checking the promise result inside an async wrapper or just using it is needed.
      showConfirm('Delete Note', 'Delete this note?').then((confirmed) => {
        if (confirmed) {
          deleteEntry(activeId);
          if (isMobile) setIsEditing(false);
        }
      });
    }
  }, [activeId, activeEntry, createEntry, updateEntry, deleteEntry, isMobile]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Auto-save status
  useEffect(() => {
    if (activeId) {
      setStatus('edited');
      const timer = setTimeout(() => {
        setStatus('saved');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [activeEntry?.title, activeEntry?.body]);

  // Authentication check
  if (!isAuthenticated) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height="100vh">
        <Typography variant="h6" color="text.secondary">
          Please log in to access your journal
        </Typography>
      </Box>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height="100vh">
        <Typography variant="h6" color="text.secondary">
          Loading journal...
        </Typography>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height="100vh">
        <Typography variant="h6" color="error">
          {error}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', border: `1px solid ${theme.palette.grey[300]}`, borderRadius: '16px', overflow: 'hidden' }}>
      {/* Left Sidebar - List View */}
      <Box sx={{
        width: isMobile ? '100%' : '30%',
        minWidth: 300,
        display: isMobile && isEditing ? 'none' : 'block',
        height: '100%',
      }}>
        <Card square elevation={0} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Stack spacing={1} p={2}>
            <Button
              variant="contained"
              onClick={() => {
                createEntry();
                if (isMobile) setIsEditing(true);
              }}
              fullWidth
            >
              New Note
            </Button>

            <Input
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              fullWidth
              aria-label="Search journal entries"
            />

            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">
                {filteredEntries.length} notes
              </Typography>
              <Button
                onClick={(e) => setAnchorEl(e.currentTarget)}
                aria-label="Sort options"
              >
                Sort: {sortMode === 'updated' ? 'Updated' : 'Created'}
              </Button>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
              >
                <MenuItem onClick={() => { setSortMode('updated'); setAnchorEl(null); }}>
                  Updated (newest first)
                </MenuItem>
                <MenuItem onClick={() => { setSortMode('created'); setAnchorEl(null); }}>
                  Created (newest first)
                </MenuItem>
              </Menu>
            </Box>
          </Stack>

          <Divider />

          <Box sx={{ overflowY: 'auto', flex: 1 }} role="list">
            {filteredEntries.length === 0 ? (
              <Box p={2} textAlign="center">
                <Typography color="text.secondary">
                  {searchQuery ? 'No matching notes' : 'No notes yet'}
                </Typography>
              </Box>
            ) : (
              filteredEntries.map(entry => (
                <Card
                  key={entry.id}
                  onClick={() => {
                    setActiveId(entry.id);
                    if (isMobile) setIsEditing(true);
                  }}
                  aria-selected={activeId === entry.id}
                  role="listitem"
                  square
                  elevation={0}
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    borderBottom: 1,
                    borderColor: 'divider',
                    bgcolor: activeId === entry.id ? 'action.selected' : 'background.default',
                    '&:hover': {
                      bgcolor: 'action.hover'
                    }
                  }}
                >
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <Typography
                      variant="subtitle1"
                      fontWeight={activeId === entry.id ? 'bold' : 'normal'}
                      noWrap
                    >
                      {entry.title || 'Untitled'}
                    </Typography>
                    {entry.moduleId && (
                      <Tooltip title="Linked to a module – read-only">
                        <LockIcon fontSize="small" />
                      </Tooltip>
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {getEntryBodyText(entry).substring(0, 100)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatRelative(entry.updatedAt)}
                  </Typography>
                </Card>
              ))
            )}
          </Box>
        </Card>
      </Box>

      {/* Right Side - Editor */}
      <Box sx={{
        flex: 1,
        display: isMobile && !isEditing ? 'none' : 'block',
        height: '100%'
      }}>
        <Card square elevation={0} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {activeEntry ? (
            <>
              <Stack direction="row" spacing={1} p={1} alignItems="center" sx={{ position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                {isMobile && (
                  <IconButton onClick={() => setIsEditing(false)} aria-label="Back to notes">
                    <ArrowBackIcon />
                  </IconButton>
                )}
                <Input
                  value={activeEntry.title}
                  onChange={(e) => {
                    if (!isLocked) {
                      updateEntry(activeId!, { title: e.target.value });
                    }
                  }}
                  placeholder={isLocked ? 'Title (locked – linked to a module)' : 'Title'}
                  fullWidth
                  inputProps={{ readOnly: isLocked }}
                  sx={{
                    fontSize: '1.25rem',
                    fontWeight: 'bold',
                    '& input': { py: 1 }
                  }}
                  aria-label={isLocked ? 'Locked note title' : 'Note title'}
                />
                <Button
                  variant="outlined"
                  color="error"
                  onClick={async () => {
                    const confirmed = await showConfirm('Delete Note', 'Delete this note?');
                    if (confirmed) {
                      deleteEntry(activeId!);
                      if (isMobile) setIsEditing(false);
                    }
                  }}
                  aria-label="Delete note"
                >
                  Delete
                </Button>
                <Typography variant="caption" color="text.secondary" ml="auto">
                  {status === 'saved' ? 'Saved' : 'Edited'}
                </Typography>
              </Stack>

              <Divider />

              <TextField
                value={getEntryBodyText(activeEntry)}
                onChange={(e) => {
                  if (!isLocked) {
                    updateEntry(activeId!, { body: e.target.value });
                  }
                }}
                placeholder={
                  isLocked
                    ? 'This note is locked because it is linked to a module.'
                    : 'Start writing...'
                }
                multiline
                fullWidth
                inputProps={{ readOnly: isLocked }}
                minRows={10}
                sx={{
                  flex: 1,
                  width: '100%',
                  '& .MuiInputBase-root': {
                    height: '100%',
                    alignItems: 'flex-start'
                  },
                  '& textarea': {
                    height: '100% !important',
                    resize: 'none',
                    width: '100%'
                  }
                }}
              />
            </>
          ) : (
            <Box display="flex" alignItems="center" justifyContent="center" height="100%">
              <Typography variant="h6" color="text.secondary">
                Select or create a note to begin
              </Typography>
            </Box>
          )}
        </Card>
      </Box>
    </Box>
  );
}

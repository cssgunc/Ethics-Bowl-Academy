'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, TextField, Typography } from '@mui/material';
import { DebateStep } from '@/lib/firebase/types';
import { sendDebateMessage } from '@/lib/firebase/debate';

interface Props {
  step: DebateStep;
  onReadyChange: (ready: boolean) => void;
}

export default function DebateStepView({ step, onReadyChange }: Props) {
  const [messages, setMessages] = useState<{ student: string; ai: string }[]>([]);
  const [sessionId, setSessionId] = useState<string>();
  const [input, setInput] = useState('');
  const [pendingMessage, setPendingMessage] = useState<string>();
  const [turnCount, setTurnCount] = useState(0);
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    onReadyChange(turnCount >= 3 || turnCount >= step.maxStudentTurns);
  }, [turnCount, step.maxStudentTurns, onReadyChange]);

  const send = async (message: string) => {
    if (busy.current || complete || turnCount >= step.maxStudentTurns) return;
    if (!message.trim() || message.length > 2000) {
      setError('Enter a message of 1–2,000 characters.'); return;
    }
    busy.current = true;
    setLoading(true);
    setError('');
    setPendingMessage(message);
    try {
      const result = await sendDebateMessage({ moduleId: step.moduleId, stepId: step.id, ...(sessionId ? { sessionId } : {}), message });
      if (!mounted.current) return;
      setSessionId(result.sessionId);
      setMessages(previous => [...previous, { student: message, ai: result.reply }]);
      setTurnCount(result.studentTurnCount);
      setComplete(result.isComplete);
      setPendingMessage(undefined);
      setInput('');
    } catch {
      if (mounted.current) setError('Unable to get an AI response. Please retry your message.');
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>{step.title}</Typography>
      <Typography color="text.secondary" gutterBottom>This is an AI reasoning partner and may make mistakes.</Typography>
      <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', my: 3 }}>{step.startQuestion}</Typography>
      <Typography role="status">Turn {turnCount} of {step.maxStudentTurns}</Typography>
      <Box role="log" aria-label="Debate conversation" aria-live="polite" sx={{ my: 2 }}>
        {messages.map((message, index) => <Box key={index} sx={{ mb: 3 }}>
          <Typography fontWeight="bold">Student</Typography>
          <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.student}</Typography>
          <Typography fontWeight="bold" sx={{ mt: 2 }}>AI</Typography>
          <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.ai}</Typography>
        </Box>)}
        {pendingMessage && <Box><Typography fontWeight="bold">Student</Typography><Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{pendingMessage}</Typography></Box>}
      </Box>
      {loading && <Box role="status" sx={{ display: 'flex', gap: 2, alignItems: 'center', my: 2 }}><CircularProgress size={20} />Waiting for the AI…</Box>}
      {error && <Alert severity="error" action={pendingMessage ? <Button disabled={loading} onClick={() => void send(pendingMessage)}>Retry</Button> : undefined}>{error}</Alert>}
      {complete || turnCount >= step.maxStudentTurns ? <Typography sx={{ my: 2 }}>This debate is complete.</Typography> : <Box component="form" onSubmit={event => { event.preventDefault(); void send(input); }} sx={{ my: 2 }}>
        <TextField label="Your message" multiline minRows={3} fullWidth value={input} onChange={event => setInput(event.target.value)} disabled={loading || !!pendingMessage} inputProps={{ maxLength: 2000 }} helperText={`${input.length}/2,000 characters`} />
        <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={loading || !!pendingMessage || !input.trim() || input.length > 2000}>Send</Button>
      </Box>}
      <Button disabled={loading} onClick={() => {
        if (!window.confirm('Start over? This will clear your current debate conversation.')) return;
        setMessages([]); setSessionId(undefined); setInput(''); setPendingMessage(undefined);
        setTurnCount(0); setComplete(false); setError('');
        onReadyChange(false);
      }}>Start over</Button>
    </Box>
  );
}

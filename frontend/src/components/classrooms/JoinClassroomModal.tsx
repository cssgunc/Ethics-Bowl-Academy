"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import { joinClassroom } from "../../lib/firebase/db-operations";
import type { User } from "../../lib/firebase/types";

const JOIN_CODE_CHARACTERS = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]$/;

export const normalizeJoinCodeInput = (value: string): string =>
  value
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .split("")
    .filter((character) => JOIN_CODE_CHARACTERS.test(character))
    .join("")
    .slice(0, 6);

function getFriendlyError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  const message = (error as { message?: string })?.message;
  if (message === "You cannot join a classroom you own") {
    return "You cannot join a classroom you own.";
  }
  if (message === "Invalid or expired classroom code") {
    return "That code is invalid or has expired. Check with your teacher and try again.";
  }
  if (message === "Authentication required" || code === "auth/user-token-expired" || code === "unauthenticated") {
    return "Your sign-in has expired. Please sign in again and retry.";
  }
  if (code === "unavailable" || code === "deadline-exceeded" || code === "network-request-failed") {
    return "We couldn’t connect. Check your internet connection and try again.";
  }
  return "We couldn’t join this classroom right now. Please try again.";
}

interface JoinClassroomModalProps {
  user: User;
  onClose: () => void;
}

export default function JoinClassroomModal({ user, onClose }: JoinClassroomModalProps) {
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [joinedClassroom, setJoinedClassroom] = useState<{
    classroomName: string;
    teacherDisplayName: string;
  } | null>(null);

  const handleJoin = async () => {
    if (joinCode.length !== 6) {
      setError("Enter the complete 6-character join code.");
      return;
    }
    if (joining) return;
    setJoining(true);
    setError("");
    try {
      const result = await joinClassroom(user.id, user.displayName, user.email, joinCode);
      setJoinedClassroom(result);
    } catch (joinError) {
      setError(getFriendlyError(joinError));
    } finally {
      setJoining(false);
    }
  };

  return (
    <Dialog open onClose={joining ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="join-classroom-title">
      <DialogTitle id="join-classroom-title">
        {joinedClassroom ? "Successfully joined!" : "Join a classroom"}
      </DialogTitle>
      <DialogContent>
        {joinedClassroom ? (
          <>
            <Typography variant="h6" sx={{ mb: 1 }}>{joinedClassroom.classroomName}</Typography>
            {joinedClassroom.teacherDisplayName && (
              <Typography sx={{ mb: 1 }}>Teacher: {joinedClassroom.teacherDisplayName}</Typography>
            )}
            <Typography>Your teacher can now see your module progress for this classroom.</Typography>
          </>
        ) : (
          <>
            <Typography sx={{ mb: 2 }}>Enter the join code provided by your teacher.</Typography>
            <TextField
              autoFocus
              fullWidth
              label="Join code"
              value={joinCode}
              onChange={(event) => {
                setJoinCode(normalizeJoinCodeInput(event.target.value));
                setError("");
              }}
              inputProps={{ maxLength: 6, "aria-label": "Join code" }}
              disabled={joining}
            />
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </>
        )}
      </DialogContent>
      <DialogActions>
        {joinedClassroom ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={joining}>Cancel</Button>
            <Button variant="contained" onClick={handleJoin} disabled={joining || joinCode.length !== 6}>
              {joining ? "Joining…" : "Join Classroom"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

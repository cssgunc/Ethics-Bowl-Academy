"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  useTheme,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";
import { FreeResponseStep } from "@/lib/firebase/types";
import { saveFreeResponseToJournal } from "@/lib/firebase/db-operations";
import StepContent from "@/components/StepContent";

interface FreeResponseProps {
  step: FreeResponseStep;
  stepId: string;
  userId: string;
  moduleId: string;
  moduleTitle: string;
  response: string;
  onChangeResponse: (value: string) => void;
}

/**
 * JournalEntry Component
 *
 * Displays a free response journal entry form matching the design specification.
 * Allows users to write and save journal entries for module reflection.
 */
export default function FreeResponseStepView({
  step,
  stepId,
  userId,
  moduleId,
  moduleTitle,
  response,
  onChangeResponse,
}: FreeResponseProps) {
  const theme = useTheme();
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);


  const handleSave = async () => {
    setSaveError(null);
    setIsSaving(true);
    try {
      await saveFreeResponseToJournal(
        userId,
        moduleId,
        moduleTitle,
        step.prompt,
        response,
        stepId
      );
      setSaveSuccess(true);
    } catch (err: any) {
      console.error("Failed to save journal entry:", err);
      setSaveError(err?.message ?? "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        width: "80%",
        bgcolor: "background.default",
        position: "relative",
        borderRadius: "16px",
        my: 4,
        border: `1px solid ${theme.palette.grey[300]}`,
      }}
    >
      {/* Main Content Container */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          p: 3,
        }}
      >
        {/* Journal Entry Title */}
        <Typography
          variant="h4"
          component={"h1"}
          sx={{
            fontSize: "2rem",
            fontWeight: "bold",
            fontFamily: "var(--font-primary)",
            color: theme.palette.common.black,
            width: "100%",
            maxWidth: "1200px",
            borderBottom: `1px solid ${theme.palette.grey[200]}`,
            pb: 3,
            mb: 3,
          }}
        >
          {step.title}
        </Typography>

        {/* Prompt Text */}
        <Typography
          component="div"
          sx={{
            fontSize: "1rem",
            color: theme.palette.common.black,
            mb: 3,
            textAlign: "left",
            width: "100%",
            maxWidth: "1200px",
            lineHeight: 1.6,
          }}
        >
          <StepContent content={step.prompt} />
        </Typography>

        {/* Text Input Area */}
        <TextField
          multiline
          rows={12}
          value={response}
          onChange={(e) => onChangeResponse(e.target.value)}
          placeholder="Type your answer here...."
          sx={{
            width: "100%",
            maxWidth: "1200px",
            mb: 2,
            "& .MuiOutlinedInput-root": {
              borderRadius: "8px",
              bgcolor: "background.paper",
              "& fieldset": {
                borderColor: theme.palette.grey[300],
              },
              "&:hover fieldset": {
                borderColor: theme.palette.grey[400],
              },
              "&.Mui-focused fieldset": {
                borderColor: "#003366",
                borderWidth: 2,
              },
            },
          }}
          slotProps={{
            htmlInput: {
              maxLength: step.maxLength,
              "aria-label": "Journal entry response",
            },
          }}
        />

        {/* Estimated Time Subtext */}
        {step.estimatedMinutes && (
          <Typography
            sx={{
              fontSize: "0.875rem",
              color: theme.palette.text.secondary,
              mb: 3,
              textAlign: "left",
              width: "100%",
              maxWidth: "1200px",
            }}
          >
            This free response should take {step.estimatedMinutes} minutes.
          </Typography>
        )}

        {/* Buttons Container - Save and Continue */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            maxWidth: "1200px",
            mb: 4,
          }}
        >
          {/* Save Button */}
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={isSaving}
            sx={{
              py: 1.5,
              px: 4,
              borderRadius: "8px",
              bgcolor: "#003366",
              color: "white",
              fontWeight: "bold",
              fontSize: "1rem",
              textTransform: "none",
              "&:hover": {
                bgcolor: theme.palette.primary.dark,
              },
              display: "inline-flex",
              alignItems: "center",
              gap: 1,
            }}
            aria-label={
              isSaving ? "Saving journal entry" : "Save journal entry"
            }
          >
            {isSaving ? (
              <>
                <CircularProgress size={18} color="inherit" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>

          {/* Continue Button - Right Aligned
          <Button
            onClick={handleContinue}
            variant="contained"
            sx={{
              py: 1.5,
              px: 4,
              borderRadius: "8px",
              bgcolor: "#003366",
              color: "white",
              fontWeight: "bold",
              fontSize: "1rem",
              textTransform: "none",
              "&:hover": {
                bgcolor: "#002244",
              },
            }}
            aria-label="Continue to next step"
          >
            Continue
          </Button> */}
        </Box>
      </Box>
      {/* Success / Error Snackbars */}
      <Snackbar
        open={saveSuccess}
        autoHideDuration={3000}
        onClose={() => setSaveSuccess(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSaveSuccess(false)}
          severity="success"
          sx={{ width: "100%" }}
        >
          Saved
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!saveError}
        autoHideDuration={4000}
        onClose={() => setSaveError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSaveError(null)}
          severity="error"
          sx={{ width: "100%" }}
        >
          {saveError}
        </Alert>
      </Snackbar>
    </Box>
  );
}

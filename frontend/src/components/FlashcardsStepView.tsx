"use client";

import React, { useState, useEffect } from "react";
import { Box, Typography, Button, Paper, useTheme } from "@mui/material";
import { FlashcardsStep } from "@/lib/firebase/types";
import StepContent from "@/components/StepContent";

interface FlashcardStepProps {
  step: FlashcardsStep;
}

export default function FlashcardsStepView({ step }: FlashcardStepProps) {
  const theme = useTheme();

  // State management
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [suppressFlipAnimation, setSuppressFlipAnimation] = useState(false);

  // Use cards from the step
  const flashcardsArray = step.cards || [];
  const currentFlashcard = flashcardsArray[currentFlashcardIndex] ?? null;

  // Reset state when step changes
  useEffect(() => {
    setCurrentFlashcardIndex(0);
    setIsFlipped(false);
  }, [step.id]);

  useEffect(() => {
    if (flashcardsArray.length === 0) {
      setCurrentFlashcardIndex(0);
      return;
    }
    if (currentFlashcardIndex >= flashcardsArray.length) {
      setCurrentFlashcardIndex(0);
    }
  }, [flashcardsArray, currentFlashcardIndex]);

  return (
    <Box
      sx={{
        width: "80%",
        height: "90vh",
        mx: "auto",
        display: "flex",
        flexDirection: "column",
        bgcolor: "white",
        borderRadius: "16px",
        border: `1px solid ${theme.palette.grey[300]}`,
        overflow: "hidden",
        my: 4,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 3,
          borderBottom: `1px solid ${theme.palette.grey[200]}`,
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          sx={{
            flex: 1,
            fontSize: "2rem",
            fontWeight: "bold",
            fontFamily: "var(--font-primary)",
            color: theme.palette.common.black,
          }}
        >
          {step.title}
        </Typography>
      </Box>

      {/* Subtitle section */}
      <Box sx={{ px: 3, pt: 2, pb: 1 }}>
        <Typography
          variant="h6"
          component="h2"
          sx={{
            fontWeight: "bold",
            fontSize: "1.25rem",
            color: theme.palette.common.black,
          }}
        >
          Flashcards
        </Typography>
      </Box>

      {/* Content area - Flashcards single-card view */}
      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          px: 3,
          pb: 3,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {flashcardsArray.length === 0 ? (
          <Typography
            sx={{
              color: theme.palette.grey[600],
              textAlign: "center",
              py: 4,
            }}
          >
            No flashcards available for this step.
          </Typography>
        ) : (
          <>
            <Paper
              elevation={0}
              role="button"
              tabIndex={0}
              aria-pressed={isFlipped}
              onClick={() => {
                if (!currentFlashcard) return;
                setIsFlipped((f) => !f);
              }}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  if (!currentFlashcard) return;
                  setIsFlipped((f) => !f);
                }
              }}
              sx={{
                borderRadius: "16px",
                p: 0,
                flex: 1,
                display: "flex",
                cursor: "pointer",
                userSelect: "none",
                perspective: "1000px",
                minHeight: 0,
                "&:hover": {
                  boxShadow: `0 2px 8px rgba(0, 0, 0, 0.1)`,
                },
              }}
            >
              <Box
                sx={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  transformStyle: "preserve-3d",
                  transition: suppressFlipAnimation
                    ? "none"
                    : "transform 0.6s ease",
                  transform: isFlipped ? "rotateX(180deg)" : "none",
                  "@media (prefers-reduced-motion: reduce)": {
                    transition: "none",
                  },
                }}
              >
                {/* Front face */}
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    borderRadius: "16px",
                    p: 4,
                    bgcolor: theme.palette.info.light,
                    border: `1px solid ${theme.palette.info.main}`,
                    "&:hover": {
                      borderColor: theme.palette.info.main,
                    },
                  }}
                >
                  <Typography
                    component="div"
                    sx={{
                      fontSize: "2rem",
                      color: theme.palette.common.black,
                      lineHeight: 1.6,
                      textAlign: "center",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    <StepContent content={currentFlashcard?.front || ""} />
                  </Typography>
                </Box>
                {/* Back face */}
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "rotateX(180deg)",
                    borderRadius: "16px",
                    p: 4,
                    bgcolor: theme.palette.info.light,
                    border: `1px solid ${theme.palette.info.main}`,
                    "&:hover": {
                      borderColor: theme.palette.info.main,
                    },
                  }}
                >
                  <Typography
                    component="div"
                    sx={{
                      fontSize: "2rem",
                      color: theme.palette.common.black,
                      lineHeight: 1.6,
                      textAlign: "center",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    <StepContent content={currentFlashcard?.back || ""} />
                  </Typography>
                </Box>
              </Box>
            </Paper>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mt: 1,
              }}
            >
              <Button
                variant="outlined"
                disabled={currentFlashcardIndex === 0}
                onClick={() => {
                  if (
                    flashcardsArray.length === 0 ||
                    currentFlashcardIndex === 0
                  )
                    return;
                  setSuppressFlipAnimation(true);
                  setIsFlipped(false);
                  setCurrentFlashcardIndex((i) => i - 1);
                  setTimeout(() => {
                    setSuppressFlipAnimation(false);
                  }, 0);
                }}
                sx={{
                  borderRadius: "16px",
                  color: theme.palette.common.black,
                  borderColor: theme.palette.common.black,
                  px: 3,
                  py: 1,
                  fontWeight: "bold",
                  "&:hover": {
                    borderColor: theme.palette.common.black,
                  },
                  "&:disabled": {
                    color: theme.palette.grey[400],
                    borderColor: theme.palette.grey[300],
                  },
                }}
              >
                Previous
              </Button>
              <Typography
                sx={{
                  fontWeight: "bold",
                  fontSize: "0.95rem",
                  color: theme.palette.common.black,
                }}
              >
                {currentFlashcardIndex + 1}/{flashcardsArray.length}
              </Typography>
              <Button
                variant="contained"
                disabled={currentFlashcardIndex === flashcardsArray.length - 1}
                onClick={() => {
                  if (
                    flashcardsArray.length === 0 ||
                    currentFlashcardIndex === flashcardsArray.length - 1
                  )
                    return;
                  setSuppressFlipAnimation(true);
                  setIsFlipped(false);
                  setCurrentFlashcardIndex((i) => i + 1);
                  setTimeout(() => {
                    setSuppressFlipAnimation(false);
                  }, 0);
                }}
                sx={{
                  borderRadius: "16px",
                  bgcolor: theme.palette.common.black,
                  color: "white",
                  px: 3,
                  py: 1,
                  fontWeight: "bold",
                  "&:hover": {
                    bgcolor: theme.palette.common.black,
                  },
                  "&:disabled": {
                    bgcolor: theme.palette.grey[300],
                    color: theme.palette.grey[500],
                  },
                }}
              >
                Next
              </Button>
            </Box>
          </>
        )}
      </Box>

      {/* Action Buttons - Bottom Right
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 2,
          mt: "auto",
        }}
      >
        <Button
          variant="contained"
          sx={{
            py: 1.5,
            px: 3,
            borderRadius: "16px",
            bgcolor: (t) => t.palette.common.black,
            fontWeight: "bold",
            color: "white",
            fontSize: "1.25rem",
            minWidth: "150px",
            "&:hover": {
              bgcolor: (t) => t.palette.common.black,
            },
          }}
        >
          Continue
        </Button>
      </Box> */}
    </Box>
  );
}

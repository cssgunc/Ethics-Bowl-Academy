"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Box, Typography, Paper, Stack, Button, Chip, Divider } from "@mui/material";
import type { SortingStep } from "@/lib/firebase/types";

type ContainerId = "bank" | string; // "bank" or bucketId
type Placements = Record<string /*cardId*/, ContainerId>;

interface SortingStepViewProps {
  step: SortingStep;

  // parent uses this to gate Next
  onSubmittedChange?: (submitted: boolean) => void;

  // optional for future persistence
  onPlacementsChange?: (placements: Placements) => void;

  // if true: after submit, user cannot move cards
  lockAfterSubmit?: boolean;
}

function buildInitialPlacements(step: SortingStep): Placements {
  const placements: Placements = {};
  for (const c of step.cards) placements[c.id] = "bank";
  return placements;
}

function groupCards(step: SortingStep, placements: Placements) {
  const bank: SortingStep["cards"] = [];
  const byBucket: Record<string, SortingStep["cards"]> = {};
  for (const b of step.buckets) byBucket[b.id] = [];

  for (const card of step.cards) {
    const where = placements[card.id] ?? "bank";
    if (where === "bank") bank.push(card);
    else if (byBucket[where]) byBucket[where].push(card);
    else bank.push(card);
  }

  return { bank, byBucket };
}

function cardCountInContainer(placements: Placements, containerId: ContainerId) {
  let count = 0;
  for (const cardId of Object.keys(placements)) {
    if ((placements[cardId] ?? "bank") === containerId) count++;
  }
  return count;
}

function cleanAnswerKey(
  answerKey: Record<string, string>,
  cards: { id: string }[],
  buckets: { id: string }[]
) {
  const cardIds = new Set(cards.map(c => c.id));
  const bucketIds = new Set(buckets.map(b => b.id));

  const cleaned: Record<string, string> = {};
  for (const [cardId, bucketId] of Object.entries(answerKey ?? {})) {
    if (cardIds.has(cardId) && bucketIds.has(bucketId)) {
      cleaned[cardId] = bucketId;
    }
  }
  return cleaned;
}

export default function SortingStepView({
  step,
  onSubmittedChange,
  onPlacementsChange,
  lockAfterSubmit = false,
}: SortingStepViewProps) {
  const [placements, setPlacements] = useState<Placements>(() => buildInitialPlacements(step));
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<ContainerId | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Reset when step changes
  useEffect(() => {
    setPlacements(buildInitialPlacements(step));
    setDraggingCardId(null);
    setDragOverZone(null);
    setSubmitted(false);
    onSubmittedChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  useEffect(() => {
    onPlacementsChange?.(placements);
  }, [placements, onPlacementsChange]);

  const { bank, byBucket } = useMemo(() => groupCards(step, placements), [step, placements]);

  const containerIds: ContainerId[] = useMemo(
    () => ["bank", ...step.buckets.map((b) => b.id)],
    [step.buckets]
  );

  const canInteract = !(lockAfterSubmit && submitted);

  // Gate criteria: all cards must be placed (none left in bank)
  const allCardsPlaced = bank.length === 0;

  // If user changes placements after submit (and not locking), we unsubmit and re-gate Next.
  useEffect(() => {
    if (!submitted) return;
    if (!lockAfterSubmit) {
      // If they move anything, treat it as not submitted anymore (simple + clear UX)
      // We detect this by allowing changes to trigger this effect.
      // But we only force "unsubmit" if they have a card back in bank (so they can't game the gate).
      if (!allCardsPlaced) {
        setSubmitted(false);
        onSubmittedChange?.(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placements, allCardsPlaced, lockAfterSubmit]);

  // Correctness helpers (only after submit + if answerKey exists)
  const cleanedAnswerKey = useMemo(
    () => cleanAnswerKey(step.answerKey ?? {}, step.cards ?? [], step.buckets ?? []),
    [step.answerKey, step.cards, step.buckets]
  );

  const hasAnswerKey = Object.keys(cleanedAnswerKey).length > 0;

  const isCardCorrect = (cardId: string): boolean | null => {
    if (!submitted) return null;
    if (!hasAnswerKey) return null;

    const correctBucketId = cleanedAnswerKey[cardId];
    if (!correctBucketId) return null; // unknown key for this card

    const placed = placements[cardId] ?? "bank";
    if (placed === "bank") return false;
    return placed === correctBucketId;
  };

  const moveCardTo = (cardId: string, to: ContainerId) => {
    setPlacements((prev) => ({ ...prev, [cardId]: to }));
  };

  const handleReset = () => {
    if (!canInteract) return;
    setPlacements(buildInitialPlacements(step));
    setSubmitted(false);
    onSubmittedChange?.(false);
  };

  const handleSubmit = () => {
    if (!allCardsPlaced) return;
    setSubmitted(true);
    onSubmittedChange?.(true);
  };

  // -------- DnD handlers (more reliable) --------
  const onCardDragStart = (e: React.DragEvent, cardId: string) => {
    if (!canInteract) {
      e.preventDefault();
      return;
    }
    setDraggingCardId(cardId);

    // Put cardId in multiple formats for browser reliability
    e.dataTransfer.setData("text/plain", cardId);
    e.dataTransfer.setData("application/x-ethicsbowl-card", cardId);
    e.dataTransfer.effectAllowed = "move";
  };

  const onCardDragEnd = () => {
    setDraggingCardId(null);
    setDragOverZone(null);
  };

  // IMPORTANT: dragenter + dragover with preventDefault -> consistent first-drop
  const onZoneDragEnter = (e: React.DragEvent, zoneId: ContainerId) => {
    if (!canInteract) return;
    e.preventDefault();
    if (dragOverZone !== zoneId) setDragOverZone(zoneId);
  };

  const onZoneDragOver = (e: React.DragEvent, zoneId: ContainerId) => {
    if (!canInteract) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverZone !== zoneId) setDragOverZone(zoneId);
  };

  const onZoneDragLeave = (_e: React.DragEvent, zoneId: ContainerId) => {
    if (dragOverZone === zoneId) setDragOverZone(null);
  };

  const onZoneDrop = (e: React.DragEvent, zoneId: ContainerId) => {
    if (!canInteract) return;
    e.preventDefault();

    const cardId =
      e.dataTransfer.getData("application/x-ethicsbowl-card") ||
      e.dataTransfer.getData("text/plain");

    if (!cardId) return;
    if (!containerIds.includes(zoneId)) return;

    moveCardTo(cardId, zoneId);

    setDragOverZone(null);
    setDraggingCardId(null);

    // If they had submitted and interaction isn't locked, any move means "not submitted" anymore.
    if (submitted && !lockAfterSubmit) {
      setSubmitted(false);
      onSubmittedChange?.(false);
    }
  };

  // -------- UI components --------
  const Zone = ({
    id,
    title,
    hint,
    children,
    minHeight = 160,
    correctnessBorder,
  }: {
    id: ContainerId;
    title: string;
    hint?: string;
    children: React.ReactNode;
    minHeight?: number;
    correctnessBorder?: "success" | "error" | "none";
  }) => {
    const isOver = dragOverZone === id;

    const borderColor =
      correctnessBorder === "success"
        ? "success.main"
        : correctnessBorder === "error"
        ? "error.main"
        : isOver
        ? "primary.main"
        : "grey.300";

    const bg =
      correctnessBorder === "success"
        ? "rgba(46, 125, 50, 0.06)"
        : correctnessBorder === "error"
        ? "rgba(211, 47, 47, 0.06)"
        : isOver
        ? "primary.50"
        : "transparent";

    return (
      <Paper
        elevation={0}
        sx={{
          borderRadius: "18px",
          border: "2px dashed",
          borderColor,
          bgcolor: bg,
          p: 2,
          minHeight,
          transition: "all 120ms ease",
        }}
      >
        {/* Header */}
        <Stack
          direction="row"
          alignItems="baseline"
          justifyContent="space-between"
          mb={1}
        >
          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: "1rem" }}>
              {title}
            </Typography>
            {hint && (
              <Typography sx={{ color: "grey.600", fontSize: "0.85rem" }}>
                {hint}
              </Typography>
            )}
          </Box>

          <Chip
            size="small"
            label={`${cardCountInContainer(placements, id)} card${
              cardCountInContainer(placements, id) === 1 ? "" : "s"
            }`}
            variant="outlined"
            sx={{ fontWeight: 700 }}
          />
        </Stack>

        {/* ✅ FULL DROP SURFACE (fixes 2-drag issue) */}
        <Box
          onDragEnter={(e) => {
            if (!canInteract) return;
            e.preventDefault(); // REQUIRED
            setDragOverZone(id);
          }}
          onDragOver={(e) => {
            if (!canInteract) return;
            e.preventDefault(); // REQUIRED for drop to work
            e.dataTransfer.dropEffect = "move";
            setDragOverZone(id);
          }}
          onDragLeave={(e) => {
            // Only clear highlight if truly leaving the zone
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setDragOverZone(null);
            }
          }}
          onDrop={(e) => {
            if (!canInteract) return;
            e.preventDefault(); // REQUIRED

            const cardId =
              e.dataTransfer.getData("application/x-ethicsbowl-card") ||
              e.dataTransfer.getData("text/plain");

            if (!cardId) return;

            moveCardTo(cardId, id);

            setDragOverZone(null);
            setDraggingCardId(null);

            // If allowing re-edit after submit
            if (submitted && !lockAfterSubmit) {
              setSubmitted(false);
              onSubmittedChange?.(false);
            }
          }}
          sx={{
            minHeight: minHeight - 56,
            borderRadius: "14px",
          }}
        >
          <Stack spacing={1.25}>{children}</Stack>
        </Box>
      </Paper>
    );
  };

  const Card = ({ card }: { card: SortingStep["cards"][number] }) => {
    const isDragging = draggingCardId === card.id;

    const correctness = isCardCorrect(card.id); // true/false/null
    const showCorrectness = submitted && hasAnswerKey && correctness !== null;

    const cardBorder = showCorrectness
      ? correctness
        ? "success.main"
        : "error.main"
      : "grey.300";

    const cardBg = showCorrectness
      ? correctness
        ? "rgba(46, 125, 50, 0.08)"
        : "rgba(211, 47, 47, 0.08)"
      : "grey.50";

    return (
      <Paper
        draggable={canInteract}
        onDragStart={(e) => onCardDragStart(e, card.id)}
        onDragEnd={onCardDragEnd}
        elevation={0}
        sx={{
          px: 1.5,
          py: 1.25,
          borderRadius: "14px",
          border: "2px solid",
          borderColor: cardBorder,
          bgcolor: cardBg,
          opacity: isDragging ? 0.35 : 1,
          cursor: canInteract ? "grab" : "default",
          userSelect: "none",
          transition: "transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease",
          "&:hover": canInteract
            ? {
                boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
                transform: "translateY(-1px)",
              }
            : {},
        }}
      >
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 700 }}>{card.text}</Typography>
      </Paper>
    );
  };

  // Optional bucket correctness borders after submit:
  // If answerKey exists, mark a bucket green only if all cards inside it are correct and no missing.
  const bucketBorderStatus = (bucketId: string): "success" | "error" | "none" => {
    if (!submitted || !hasAnswerKey) return "none";

    // Get cards currently in bucket
    const cardsInBucket = (byBucket[bucketId] ?? []).map((c) => c.id);

    // If any card in this bucket is incorrect, mark error
    for (const cardId of cardsInBucket) {
      const correct = isCardCorrect(cardId);
      if (correct === false) return "error";
    }

    // If bucket has any cards and all are correct, success; otherwise none
    if (cardsInBucket.length > 0) return "success";
    return "none";
  };

  return (
    <Box sx={{ width: "100%", maxWidth: "1200px", p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5 }}>
          Sorting Question
        </Typography>
        <Typography sx={{ color: "grey.700", fontSize: "1.05rem" }}>
          {step.prompt}
        </Typography>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Controls */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center" flexWrap="wrap">
        <Chip
          label={submitted ? "Submitted" : "Not submitted"}
          color={submitted ? "success" : "default"}
          variant={submitted ? "filled" : "outlined"}
          sx={{ fontWeight: 700 }}
        />

        {!submitted && !allCardsPlaced && (
          <Chip
            label={`Place ${bank.length} more card${bank.length === 1 ? "" : "s"} to submit`}
            color="warning"
            variant="outlined"
            sx={{ fontWeight: 700 }}
          />
        )}

        {submitted && !hasAnswerKey && (
          <Chip
            label="No answer key set (showing completion only)"
            color="info"
            variant="outlined"
            sx={{ fontWeight: 700 }}
          />
        )}

        {submitted && hasAnswerKey && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 1 }}>
            <Chip label="Correct" color="success" variant="outlined" />
            <Chip label="Incorrect" color="error" variant="outlined" />
          </Stack>
        )}

        <Box sx={{ flex: 1 }} />

        <Button
          variant="outlined"
          onClick={handleReset}
          disabled={!canInteract}
          sx={{ borderRadius: "14px" }}
        >
          Reset
        </Button>

        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!allCardsPlaced || submitted}
          sx={{
            borderRadius: "14px",
            bgcolor: (t) => t.palette.common.black,
            "&:hover": { bgcolor: (t) => t.palette.grey[800] },
            "&.Mui-disabled": {
              bgcolor: "grey.300",
              color: "grey.600",
            },
          }}
        >
          Submit
        </Button>
      </Stack>

      {/* Layout */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "0.9fr 1.1fr" },
          gap: 2,
          alignItems: "start",
        }}
      >
        {/* Bank */}
        <Zone
          id="bank"
          title="Card Bank"
          hint="Drag cards into the buckets on the right."
          minHeight={280}
          correctnessBorder={submitted && hasAnswerKey ? (bank.length === 0 ? "success" : "error") : "none"}
        >
          {bank.length === 0 ? (
            <Typography sx={{ color: "grey.500", fontStyle: "italic" }}>
              No cards left in the bank.
            </Typography>
          ) : (
            bank.map((c) => <Card key={c.id} card={c} />)
          )}
        </Zone>

        {/* Buckets */}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 2 }}>
          {step.buckets.map((bucket) => {
            const bucketCards = byBucket[bucket.id] ?? [];
            return (
              <Zone
                key={bucket.id}
                id={bucket.id}
                title={bucket.label}
                hint="Drop cards here"
                minHeight={160}
                correctnessBorder={bucketBorderStatus(bucket.id)}
              >
                {bucketCards.length === 0 ? (
                  <Typography sx={{ color: "grey.500", fontStyle: "italic" }}>
                    Drop cards into this bucket.
                  </Typography>
                ) : (
                  bucketCards.map((c) => <Card key={c.id} card={c} />)
                )}
              </Zone>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
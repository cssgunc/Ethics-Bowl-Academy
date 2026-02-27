"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  Chip,
  Divider,
} from "@mui/material";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverlay,
  useDroppable,
  useDraggable,
  pointerWithin,
} from "@dnd-kit/core";
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

function cleanAnswerKey(
  answerKey: Record<string, string>,
  cards: { id: string }[],
  buckets: { id: string }[],
) {
  const cardIds = new Set(cards.map((c) => c.id));
  const bucketIds = new Set(buckets.map((b) => b.id));

  const cleaned: Record<string, string> = {};
  for (const [cardId, bucketId] of Object.entries(answerKey ?? {})) {
    if (cardIds.has(cardId) && bucketIds.has(bucketId)) {
      cleaned[cardId] = bucketId;
    }
  }
  return cleaned;
}

// -------- @dnd-kit sub-components --------

function DroppableZone({
  id,
  title,
  hint,
  children,
  minHeight = 160,
  correctnessBorder,
  cardCount,
}: {
  id: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
  minHeight?: number;
  correctnessBorder?: "success" | "error" | "none";
  cardCount: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const borderColor =
    correctnessBorder === "success"
      ? "success.main"
      : correctnessBorder === "error"
        ? "error.main"
        : isOver
          ? "primary.main"
          : "grey.600";

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
      ref={setNodeRef}
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
          label={`${cardCount} card${cardCount === 1 ? "" : "s"}`}
          variant="outlined"
          sx={{ fontWeight: 700 }}
        />
      </Stack>

      <Stack spacing={1.25}>{children}</Stack>
    </Paper>
  );
}

function DraggableCard({
  card,
  canInteract,
  showCorrectness,
  correctness,
}: {
  card: { id: string; text: string };
  canInteract: boolean;
  showCorrectness: boolean;
  correctness: boolean | null;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    disabled: !canInteract,
  });

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
      ref={setNodeRef}
      {...attributes}
      {...listeners}
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
        transition:
          "transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease",
        "&:hover": canInteract
          ? {
              boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
              transform: "translateY(-1px)",
            }
          : {},
      }}
    >
      <Typography sx={{ fontSize: "0.95rem", fontWeight: 700 }}>
        {card.text}
      </Typography>
    </Paper>
  );
}

// -------- Main component --------

export default function SortingStepView({
  step,
  onSubmittedChange,
  onPlacementsChange,
  lockAfterSubmit = false,
}: SortingStepViewProps) {
  const [placements, setPlacements] = useState<Placements>(() =>
    buildInitialPlacements(step),
  );
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // DnD sensors (same pattern as ModulesPage)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  // Reset when step changes
  useEffect(() => {
    setPlacements(buildInitialPlacements(step));
    setActiveDragId(null);
    setSubmitted(false);
    onSubmittedChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  useEffect(() => {
    onPlacementsChange?.(placements);
  }, [placements, onPlacementsChange]);

  const { bank, byBucket } = useMemo(
    () => groupCards(step, placements),
    [step, placements],
  );

  const containerIds: ContainerId[] = useMemo(
    () => ["bank", ...step.buckets.map((b) => b.id)],
    [step.buckets],
  );

  const canInteract = !(lockAfterSubmit && submitted);

  // Gate criteria: all cards must be placed (none left in bank)
  const allCardsPlaced = bank.length === 0;

  // If user changes placements after submit (and not locking), we unsubmit and re-gate Next.
  useEffect(() => {
    if (!submitted) return;
    if (!lockAfterSubmit) {
      if (!allCardsPlaced) {
        setSubmitted(false);
        onSubmittedChange?.(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placements, allCardsPlaced, lockAfterSubmit]);

  // Correctness helpers (only after submit + if answerKey exists)
  const cleanedAnswerKey = useMemo(
    () =>
      cleanAnswerKey(
        step.answerKey ?? {},
        step.cards ?? [],
        step.buckets ?? [],
      ),
    [step.answerKey, step.cards, step.buckets],
  );

  const hasAnswerKey = Object.keys(cleanedAnswerKey).length > 0;

  const isCardCorrect = (cardId: string): boolean | null => {
    if (!submitted) return null;
    if (!hasAnswerKey) return null;

    const correctBucketId = cleanedAnswerKey[cardId];
    if (!correctBucketId) return null;

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

  // -------- @dnd-kit handlers --------
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;

    const cardId = active.id as string;
    const targetZone = over.id as ContainerId;

    if (!containerIds.includes(targetZone)) return;

    const currentContainer = placements[cardId] ?? "bank";
    if (currentContainer === targetZone) return;

    moveCardTo(cardId, targetZone);

    if (submitted && !lockAfterSubmit) {
      setSubmitted(false);
      onSubmittedChange?.(false);
    }
  };

  // Find the active card for DragOverlay
  const activeCard = activeDragId
    ? step.cards.find((c) => c.id === activeDragId)
    : null;

  // Bucket correctness borders after submit
  const bucketBorderStatus = (
    bucketId: string,
  ): "success" | "error" | "none" => {
    if (!submitted || !hasAnswerKey) return "none";

    const cardsInBucket = (byBucket[bucketId] ?? []).map((c) => c.id);

    for (const cardId of cardsInBucket) {
      const correct = isCardCorrect(cardId);
      if (correct === false) return "error";
    }

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
      <Stack
        direction="row"
        spacing={1}
        sx={{ mb: 2 }}
        alignItems="center"
        flexWrap="wrap"
      >
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

      {/* Layout with @dnd-kit */}
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "0.9fr 1.1fr" },
            gap: 2,
            alignItems: "start",
          }}
        >
          {/* Bank */}
          <DroppableZone
            id="bank"
            title="Card Bank"
            hint="Drag cards into the buckets on the right."
            minHeight={280}
            cardCount={bank.length}
            correctnessBorder={
              submitted && hasAnswerKey
                ? bank.length === 0
                  ? "success"
                  : "error"
                : "none"
            }
          >
            {bank.length === 0 ? (
              <Typography sx={{ color: "grey.500", fontStyle: "italic" }}>
                No cards left in the bank.
              </Typography>
            ) : (
              bank.map((c) => {
                const correctness = isCardCorrect(c.id);
                return (
                  <DraggableCard
                    key={c.id}
                    card={c}
                    canInteract={canInteract}
                    showCorrectness={
                      submitted && hasAnswerKey && correctness !== null
                    }
                    correctness={correctness}
                  />
                );
              })
            )}
          </DroppableZone>

          {/* Buckets */}
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 2 }}>
            {step.buckets.map((bucket) => {
              const bucketCards = byBucket[bucket.id] ?? [];
              return (
                <DroppableZone
                  key={bucket.id}
                  id={bucket.id}
                  title={bucket.label}
                  hint="Drop cards here"
                  minHeight={160}
                  cardCount={bucketCards.length}
                  correctnessBorder={bucketBorderStatus(bucket.id)}
                >
                  {bucketCards.length === 0 ? (
                    <Typography sx={{ color: "grey.500", fontStyle: "italic" }}>
                      Drop cards into this bucket.
                    </Typography>
                  ) : (
                    bucketCards.map((c) => {
                      const correctness = isCardCorrect(c.id);
                      return (
                        <DraggableCard
                          key={c.id}
                          card={c}
                          canInteract={canInteract}
                          showCorrectness={
                            submitted && hasAnswerKey && correctness !== null
                          }
                          correctness={correctness}
                        />
                      );
                    })
                  )}
                </DroppableZone>
              );
            })}
          </Box>
        </Box>

        {/* Drag overlay — floating card that follows the cursor */}
        <DragOverlay>
          {activeCard ? (
            <Paper
              elevation={4}
              sx={{
                px: 1.5,
                py: 1.25,
                borderRadius: "14px",
                border: "2px solid",
                borderColor: "primary.main",
                bgcolor: "grey.50",
                cursor: "grabbing",
                userSelect: "none",
              }}
            >
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 700 }}>
                {activeCard.text}
              </Typography>
            </Paper>
          ) : null}
        </DragOverlay>
      </DndContext>
    </Box>
  );
}

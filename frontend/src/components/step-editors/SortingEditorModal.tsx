"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Stack,
  TextField,
  Typography,
  Divider,
  IconButton,
  MenuItem,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";

import type { Step, SortingStep } from "@/lib/firebase/types";

interface SortingEditorModalProps {
  moduleId: string;
  step?: SortingStep; // ✅ supports edit mode
  onClose: () => void;
  onBack: () => void;
  onSave: (step: Step) => void; // matches AddStepModal / StepEditorModal
}

// Helpers
function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;
}

type BucketDraft = { id: string; label: string };
type CardDraft = { id: string; text: string };

function hasDuplicates(values: string[]) {
  const cleaned = values.map((v) => v.trim().toLowerCase()).filter(Boolean);
  return new Set(cleaned).size !== cleaned.length;
}

export default function SortingEditorModal({
  moduleId,
  step,
  onClose,
  onBack,
  onSave,
}: SortingEditorModalProps) {
  const isEdit = Boolean(step);

  const [title, setTitle] = useState(step?.title ?? "Sorting Question");
  const [prompt, setPrompt] = useState(step?.prompt ?? "");
  const [isOptional, setIsOptional] = useState(step?.isOptional ?? false);

  const [buckets, setBuckets] = useState<BucketDraft[]>(
    step?.buckets?.length
      ? step.buckets.map((b) => ({ id: b.id, label: b.label }))
      : [{ id: makeId("bucket"), label: "" }]
  );
  const [cards, setCards] = useState<CardDraft[]>(
    step?.cards?.length
      ? step.cards.map((c) => ({ id: c.id, text: c.text }))
      : [{ id: makeId("card"), text: "" }]
  );

  // ✅ answer key (cardId -> bucketId)
  const [answerKey, setAnswerKey] = useState<Record<string, string>>(
    step?.answerKey ?? {}
  );

  const [touched, setTouched] = useState(false);

  // ✅ Prefill when editing
  useEffect(() => {
    if (!step) return;

    setTitle(step.title ?? "Sorting Question");
    setPrompt(step.prompt ?? "");
    setIsOptional(step.isOptional ?? false);

    setBuckets(
      (step.buckets ?? []).map((b) => ({
        id: b.id,
        label: b.label,
      }))
    );
    setCards(
      (step.cards ?? []).map((c) => ({
        id: c.id,
        text: c.text,
      }))
    );

    setAnswerKey(step.answerKey ?? {});
  }, [step]);

  // ✅ Keep answerKey consistent if cards/buckets are added/removed
  useEffect(() => {
    const bucketIds = new Set(buckets.map((b) => b.id));

    setAnswerKey((prev) => {
      const next: Record<string, string> = {};

      for (const c of cards) {
        const chosen = prev[c.id];
        if (chosen && bucketIds.has(chosen)) {
          next[c.id] = chosen;
        }
      }

      return next;
    });
  }, [cards, buckets]);

  // Validation
  const errors = useMemo(() => {
    const promptEmpty = prompt.trim().length === 0;
    const titleEmpty = title.trim().length === 0;

    const bucketEmpty = buckets.some((b) => b.label.trim().length === 0);
    const cardEmpty = cards.some((c) => c.text.trim().length === 0);

    const bucketDupes = hasDuplicates(buckets.map((b) => b.label));
    const cardDupes = hasDuplicates(cards.map((c) => c.text));

    const tooFewBuckets = buckets.length < 2;
    const tooFewCards = cards.length < 2;

    // ✅ recommended: require an answer for each card
    const missingAnswerKey = cards.some((c) => !answerKey[c.id]);

    return {
      titleEmpty,
      promptEmpty,
      bucketEmpty,
      cardEmpty,
      bucketDupes,
      cardDupes,
      tooFewBuckets,
      tooFewCards,
      missingAnswerKey,
      hasAny:
        titleEmpty ||
        promptEmpty ||
        bucketEmpty ||
        cardEmpty ||
        bucketDupes ||
        cardDupes ||
        tooFewBuckets ||
        tooFewCards ||
        missingAnswerKey,
    };
  }, [title, prompt, buckets, cards, answerKey]);

  const addBucket = () => {
    setTouched(true);
    setBuckets((prev) => [...prev, { id: makeId("bucket"), label: "" }]);
  };

  const removeBucket = (bucketId: string) => {
    setTouched(true);
    setBuckets((prev) => prev.filter((b) => b.id !== bucketId));
    // answerKey cleanup handled by useEffect([cards,buckets])
  };

  const updateBucket = (bucketId: string, label: string) => {
    setTouched(true);
    setBuckets((prev) =>
      prev.map((b) => (b.id === bucketId ? { ...b, label } : b))
    );
  };

  const addCard = () => {
    setTouched(true);
    const id = makeId("card");
    setCards((prev) => [...prev, { id, text: "" }]);
  };

  const removeCard = (cardId: string) => {
    setTouched(true);
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    setAnswerKey((prev) => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
  };

  const updateCard = (cardId: string, text: string) => {
    setTouched(true);
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, text } : c))
    );
  };

  const handleSave = () => {
    setTouched(true);
    if (errors.hasAny) return;

    const now = new Date();

    const cardIds = new Set(cards.map(c => c.id));
    const bucketIds = new Set(buckets.map(b => b.id));

    const cleanedAnswerKey: Record<string, string> = {};
    for (const [cardId, bucketId] of Object.entries(answerKey)) {
      if (cardIds.has(cardId) && bucketIds.has(bucketId)) {
        cleanedAnswerKey[cardId] = bucketId;
      }
    }

    const out: SortingStep = step
      ? {
          ...step,
          title: title.trim(),
          isOptional,
          updatedAt: now,
          prompt: prompt.trim(),
          buckets: buckets.map((b) => ({ id: b.id, label: b.label.trim() })),
          cards: cards.map((c) => ({ id: c.id, text: c.text.trim() })),
          answerKey: cleanedAnswerKey,
        }
      : {
          id: `temp-${Date.now()}`,
          moduleId,
          type: "sorting",
          title: title.trim(),
          order: 0,
          isOptional,
          createdBy: "unknown", // TODO: replace with actual userId if your other modals do that
          createdAt: now,
          updatedAt: now,
          prompt: prompt.trim(),
          buckets: buckets.map((b) => ({ id: b.id, label: b.label.trim() })),
          cards: cards.map((c) => ({ id: c.id, text: c.text.trim() })),
          answerKey: cleanedAnswerKey,
        };

    onSave(out);
    onClose();
  };

  const noUsableBuckets = buckets.every((b) => !b.label.trim());

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {isEdit ? "Edit Sorting Question" : "Sorting Question"}
            </h2>
            <p className="text-gray-600 text-sm">
              Configure buckets, cards, and the answer key.
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <Stack spacing={2}>
            <TextField
              label="Step Title"
              value={title}
              onChange={(e) => {
                setTouched(true);
                setTitle(e.target.value);
              }}
              error={touched && errors.titleEmpty}
              helperText={touched && errors.titleEmpty ? "Title is required." : " "}
              fullWidth
            />

            <TextField
              label="Prompt"
              value={prompt}
              onChange={(e) => {
                setTouched(true);
                setPrompt(e.target.value);
              }}
              error={touched && errors.promptEmpty}
              helperText={touched && errors.promptEmpty ? "Prompt is required." : " "}
              fullWidth
              multiline
              minRows={2}
            />

            <Divider />

            {/* Buckets */}
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ fontWeight: 900 }}>Buckets</Typography>
              <Button startIcon={<AddIcon />} onClick={addBucket}>
                Add bucket
              </Button>
            </Stack>

            {touched && errors.bucketDupes && (
              <Typography sx={{ color: "error.main" }}>
                Bucket labels must be unique.
              </Typography>
            )}

            <Stack spacing={1}>
              {buckets.map((b, idx) => (
                <Box
                  key={b.id}
                  sx={{
                    border: "1px solid",
                    borderColor: "grey.200",
                    borderRadius: "12px",
                    p: 2,
                    bgcolor: "grey.50",
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    mb={1}
                  >
                    <Typography sx={{ fontWeight: 800, color: "grey.700" }}>
                      Bucket {idx + 1}
                    </Typography>
                    {buckets.length > 1 && (
                      <IconButton onClick={() => removeBucket(b.id)} size="small">
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>

                  <TextField
                    value={b.label}
                    onChange={(e) => updateBucket(b.id, e.target.value)}
                    placeholder="e.g., Utilitarian"
                    fullWidth
                    error={touched && b.label.trim().length === 0}
                    helperText={
                      touched && b.label.trim().length === 0
                        ? "Bucket label is required."
                        : " "
                    }
                  />
                </Box>
              ))}
            </Stack>

            <Divider />

            {/* Cards */}
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ fontWeight: 900 }}>Cards</Typography>
              <Button startIcon={<AddIcon />} onClick={addCard}>
                Add card
              </Button>
            </Stack>

            {touched && errors.cardDupes && (
              <Typography sx={{ color: "error.main" }}>
                Card text should be unique.
              </Typography>
            )}

            {touched && errors.missingAnswerKey && (
              <Typography sx={{ color: "error.main" }}>
                Please select a correct bucket for every card (answer key).
              </Typography>
            )}

            <Stack spacing={1}>
              {cards.map((c, idx) => (
                <Box
                  key={c.id}
                  sx={{
                    border: "1px solid",
                    borderColor: "grey.200",
                    borderRadius: "12px",
                    p: 2,
                    bgcolor: "grey.50",
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    mb={1}
                  >
                    <Typography sx={{ fontWeight: 800, color: "grey.700" }}>
                      Card {idx + 1}
                    </Typography>
                    {cards.length > 1 && (
                      <IconButton onClick={() => removeCard(c.id)} size="small">
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>

                  <TextField
                    value={c.text}
                    onChange={(e) => updateCard(c.id, e.target.value)}
                    placeholder="e.g., Choose the action that maximizes total happiness."
                    fullWidth
                    multiline
                    minRows={2}
                    error={touched && c.text.trim().length === 0}
                    helperText={
                      touched && c.text.trim().length === 0 ? "Card text is required." : " "
                    }
                  />

                  {/* ✅ Answer key selector */}
                  <TextField
                    select
                    label="Correct bucket (answer key)"
                    value={answerKey[c.id] ?? ""}
                    onChange={(e) => {
                      setTouched(true);
                      const bucketId = e.target.value;
                      setAnswerKey((prev) => ({
                        ...prev,
                        [c.id]: bucketId,
                      }));
                    }}
                    fullWidth
                    sx={{ mt: 2 }}
                    disabled={noUsableBuckets}
                    error={touched && !answerKey[c.id]}
                    helperText={
                      noUsableBuckets
                        ? "Add at least one bucket label first."
                        : touched && !answerKey[c.id]
                        ? "Choose the correct bucket for this card."
                        : "Pick which bucket is considered correct for grading after submit."
                    }
                  >
                    <MenuItem value="">
                      <em>(Select a bucket)</em>
                    </MenuItem>
                    {buckets.map((b) => (
                      <MenuItem key={b.id} value={b.id} disabled={!b.label.trim()}>
                        {b.label.trim() || "(Unnamed bucket)"}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
              ))}
            </Stack>
          </Stack>
        </div>

        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onBack}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors duration-200"
          >
            Back
          </button>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors duration-200"
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              disabled={errors.hasAny}
              className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                errors.hasAny
                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                  : "bg-black text-white hover:bg-gray-800"
              }`}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
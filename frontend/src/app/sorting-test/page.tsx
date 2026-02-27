"use client";

import React from "react";
import { Box } from "@mui/material";
import SortingStepView from "@/components/SortingStepView";

// If you already moved SortingStep into "@/lib/firebase/types", import it from there instead.
const demoStep = {
  id: "demo-sorting-step",
  moduleId: "demo-module",
  type: "sorting" as const,
  title: "Ethics Sorting Demo",
  order: 1,
  estimatedMinutes: 5,
  isOptional: false,
  createdBy: "demo",
  createdAt: new Date(),
  updatedAt: new Date(),
  prompt: "Drag each card into the bucket where it best fits.",
  buckets: [
    { id: "b1", label: "Utilitarian" },
    { id: "b2", label: "Deontological" },
    { id: "b3", label: "Virtue Ethics" },
  ],
  cards: [
    { id: "c1", text: "Choose the action that maximizes total happiness." },
    { id: "c2", text: "Never lie, even if it would help." },
    { id: "c3", text: "Ask: what would a good person do?" },
    { id: "c4", text: "Save the most lives, even if one person is harmed." },
    { id: "c5", text: "Follow duties and rules, not outcomes." },
  ],
};

export default function SortingTestPage() {
  return (
    <Box sx={{ p: 3 }}>
      <SortingStepView step={demoStep} lockAfterSubmit={false} />
    </Box>
  );
}
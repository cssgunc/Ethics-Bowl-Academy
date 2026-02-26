import React, { useState, useEffect } from "react";
import { Box, Typography, Button, useTheme } from "@mui/material";
import {
  getModuleById,
  getUserProgress,
  startUserProgress,
  getStepsByModuleId,
  completeModule,
  markStepCompleted,
  updateQuizScore,
  getJournalEntryByStepId,
} from "@/lib/firebase/db-operations";
import {
  Module,
  Step,
  VideoStep,
  QuizStep,
  FlashcardsStep,
  FreeResponseStep,
  SortingStep,
  PollStep,
  AdditionalResourcesStep,
  UserProgress,
} from "@/lib/firebase/types";
import FreeResponseStepView from "./FreeResponseStepView";
import VideoStepView from "./VideoStepView";
import FlashcardsStepView from "./FlashcardsStepView";
import QuizStepView from "./QuizStepView";
import SortingStepView from "./SortingStepView";
import PollStepView from "./PollStepView";
import AdditionalResourcesStepView from "./AdditionalResourcesStepView";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import confetti from "canvas-confetti";

interface ModuleContentProps {
  moduleId: string;
  index: number;
  userId: string;
}

export default function ModuleContentMUI({
  moduleId,
  index,
  userId,
}: ModuleContentProps) {
  const [content, setContent] = useState<Module | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [freeResponsesByStepId, setFreeResponsesByStepId] = useState<
    Record<string, string>
  >({});
  const [nextEnabled, setNextEnabled] = useState(true);
  const theme = useTheme();

  const handleStartModule = async () => {
    if (!userId || !moduleId) return;
    if (!userProgress) {
      await startUserProgress(userId, moduleId);
      const newProgress = await getUserProgress(userId, moduleId);
      setUserProgress(newProgress);
    }
    // Show steps view
    setShowSteps(true);
    setCurrentStepIndex(0);
  };

  const handleNavigateToStep = async (stepIndex: number) => {
    if (!userId || !moduleId) return;

    // Check if step is navigable (completed or next)
    const completedCount = userProgress?.completedStepIds.length || 0;
    if (stepIndex > completedCount) return;

    if (!userProgress) {
      await startUserProgress(userId, moduleId);
      const newProgress = await getUserProgress(userId, moduleId);
      setUserProgress(newProgress);
    }

    setShowSteps(true);
    setCurrentStepIndex(stepIndex);
  };

  useEffect(() => {
    if (!moduleId) return;

    // Reset only view state when module changes
    // Keep all data (content, steps, userProgress) to avoid any flashing
    setNextEnabled(true); // Reset next button
    setShowSteps(false); // Exit step view
    setCurrentStepIndex(0); // Reset step navigation

    const fetchContent = async () => {
      // Always fetch module content and steps
      const [content, moduleSteps] = await Promise.all([
        getModuleById(moduleId),
        getStepsByModuleId(moduleId),
      ]);

      // Only fetch user progress if userId is available
      let progress = null;
      if (userId) {
        progress = await getUserProgress(userId, moduleId);
      }

      // Update all state at once - React will batch these updates
      setContent(content);
      setSteps(moduleSteps);
      setUserProgress(progress);
      // Reset free response map when module changes/steps reload
      setFreeResponsesByStepId({});
    };

    fetchContent();
  }, [moduleId, userId]);

  useEffect(() => {
    if (!showSteps || steps.length === 0 || !userId) return;

    const currentStep = steps[currentStepIndex];
    if (currentStep.type !== "freeResponse") return;

    const stepId = currentStep.id;

    // Already have a value for this step? Don't refetch from Firestore.
    if (freeResponsesByStepId[stepId] !== undefined) return;

    const fetchFreeResponse = async () => {
      try {
        const journalEntry = await getJournalEntryByStepId(userId, stepId);
        if (!journalEntry) return;

        // body is a map: { [stepId]: [prompt, answer] }
        const body = journalEntry.body as unknown as
          | Record<string, [string, string]>
          | undefined;
        if (!body) return;

        const entryForStep = body[stepId];
        if (!entryForStep) return;

        const [, answer] = entryForStep;

        setFreeResponsesByStepId((prev) => ({
          ...prev,
          [stepId]: answer,
        }));
      } catch (err) {
        console.error("Failed to sync free response from journal:", err);
      }
    };

    fetchFreeResponse();
  }, [showSteps, steps, currentStepIndex, userId, freeResponsesByStepId]);

  useEffect(() => {
    if (!showSteps || steps.length === 0) return;

    const s = steps[currentStepIndex];

    if (s.type === "sorting") {
      setNextEnabled(false); // require submit
    } else if (s.type !== "quiz") {
      setNextEnabled(true);  // allow next for others
    }
  }, [showSteps, steps, currentStepIndex]);

  // Keep user progress updated
  const refreshProgress = () => {
    if (!userId || !moduleId) return;
    getUserProgress(userId, moduleId).then((progress) => {
      setUserProgress(progress);
    });
  };

  const handleFreeResponseChange = (stepId: string, value: string) => {
    setFreeResponsesByStepId((prev) => ({
      ...prev,
      [stepId]: value,
    }));
  };

  const handleQuizPassedChange = (score: number) => {
    if (score > 0) {
      setNextEnabled(true);
      updateQuizScore(userId, moduleId, steps[currentStepIndex].id, score);
    } else {
      !userProgress?.quizScores[steps[currentStepIndex].id] &&
        setNextEnabled(false);
    }
  };

  // Step View with Navigation
  if (showSteps && steps.length > 0) {
    const currentStep = steps[currentStepIndex];

    const handlePrevious = async () => {
      setNextEnabled(true);
      if (currentStepIndex > 0) {
        setCurrentStepIndex(currentStepIndex - 1);
        refreshProgress();
      } else {
        await refreshProgress();
        setShowSteps(false);
      }
    };

    const handleNext = async () => {
      await markStepCompleted(userId, moduleId, currentStep.id);
      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
        refreshProgress();
      } else {
        await completeModule(userId, moduleId);
        await refreshProgress();
        confetti({
          particleCount: 300,
          spread: 120,
          startVelocity: 40,
          origin: { y: 0.6 },
        });
        setShowSteps(false);
      }
    };

    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {/* Navigation Controls - Top */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            p: { xs: 1.5, md: 2 },
            bgcolor: "white",
            borderTopRightRadius: { xs: 0, md: "16px" },
            border: `1px solid ${theme.palette.grey[300]}`,
            borderLeft: { xs: "none", md: "none" },
          }}
        >
          {currentStepIndex === 0 ? (
            <Button
              variant="outlined"
              onClick={handlePrevious}
              sx={{
                borderRadius: "16px",
                px: 3,
                py: 1,
                transition: "all 0.3s ease",
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: "0 4px 8px rgba(0, 0, 0, 0.15)",
                },
              }}
            >
              Back
            </Button>
          ) : (
            <Button
              variant="outlined"
              onClick={handlePrevious}
              sx={{
                borderRadius: "16px",
                px: 3,
                py: 1,
                transition: "all 0.3s ease",
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: "0 4px 8px rgba(0, 0, 0, 0.15)",
                },
              }}
            >
              Previous
            </Button>
          )}

          <Typography sx={{ fontWeight: "bold" }}>
            Step {currentStepIndex + 1} of {steps.length}
          </Typography>
          {currentStepIndex === steps.length - 1 ? (
            nextEnabled ? (
              <Button
                variant="contained"
                onClick={handleNext}
                sx={{
                  borderRadius: "16px",
                  px: 3,
                  py: 1,
                  bgcolor: (t) => t.palette.common.black,
                  transition: "all 0.3s ease",
                  "&:hover": {
                    bgcolor: (t) => t.palette.grey[800],
                    transform: "translateY(-2px)",
                    boxShadow: "0 6px 16px rgba(0, 0, 0, 0.3)",
                  },
                }}
              >
                Finish
              </Button>
            ) : (
              <Button
                variant="contained"
                disabled={true}
                sx={{
                  borderRadius: "16px",
                  px: 3,
                  py: 1,
                  bgcolor: (t) => t.palette.common.black,
                }}
              >
                Finish
              </Button>
            )
          ) : nextEnabled ? (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={currentStepIndex === steps.length - 1}
              sx={{
                borderRadius: "16px",
                px: 3,
                py: 1,
                bgcolor: (t) => t.palette.common.black,
                transition: "all 0.3s ease",
                "&:hover": {
                  bgcolor: (t) => t.palette.grey[800],
                  transform: "translateY(-2px)",
                  boxShadow: "0 6px 16px rgba(0, 0, 0, 0.3)",
                },
              }}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="contained"
              disabled={true}
              sx={{
                borderRadius: "16px",
                px: 3,
                py: 1,
                bgcolor: (t) => t.palette.common.black,
              }}
            >
              Next
            </Button>
          )}
        </Box>

        {/* Step Content - Full Height */}
        <Box
          sx={{
            flex: 1,
            overflow: "auto",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            height: "100%",
          }}
        >
          <Box
            sx={{
              width: "100%",
              maxWidth: "1400px",
              height: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {currentStep.type === "video" && (
              <VideoStepView step={currentStep as VideoStep} />
            )}
            {currentStep.type === "quiz" && (
              <QuizStepView
                step={currentStep as QuizStep}
                quizPassed={nextEnabled}
                onPassedChange={(value) => handleQuizPassedChange(value)}
              />
            )}
            {currentStep.type === "flashcards" && (
              <FlashcardsStepView step={currentStep as FlashcardsStep} />
            )}
            {currentStep.type === "freeResponse" && (
              <FreeResponseStepView
                step={currentStep as FreeResponseStep}
                stepId={currentStep.id}
                userId={userId}
                moduleId={moduleId}
                moduleTitle={content?.title || ""}
                response={freeResponsesByStepId[currentStep.id] ?? ""}
                onChangeResponse={(value) =>
                  handleFreeResponseChange(currentStep.id, value)
                }
              />
            )}
            {currentStep.type === "sorting" && (
              <SortingStepView
                step={currentStep as SortingStep}
                onSubmittedChange={(ok) => setNextEnabled(ok)}
              />
            )}
            {currentStep.type === "poll" && (
              <PollStepView
                step={currentStep as PollStep}
                stepId={currentStep.id}
                userId={userId}
                moduleId={moduleId}
              />
            )}
            {currentStep.type === "additionalResources" && (
              <AdditionalResourcesStepView
                step={currentStep as AdditionalResourcesStep}
              />
            )}
          </Box>
        </Box>
      </Box>
    );
  }

  // Overview View
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        px: { xs: 2, md: "4vw" },
        pt: { xs: 2, md: "2vw" },
      }}
    >
      {/* Decorative Header Section */}
      <Box
        sx={{
          position: "relative",
          mb: { xs: 2, md: 2 },
          pb: { xs: 0, md: 1 },
        }}
      >
        {/* Decorative background shape - more visible */}
        <Box
          sx={{
            position: "absolute",
            top: -40,
            left: -40,
            width: "200px",
            height: "200px",
            background:
              "linear-gradient(135deg, rgba(171, 216, 255, 0.5) 0%, rgba(171, 216, 255, 0.25) 100%)",
            borderRadius: "50%",
            filter: "blur(40px)",
            zIndex: 0,
          }}
        />
        <Box
          sx={{
            position: "absolute",
            top: 20,
            right: -20,
            width: "150px",
            height: "150px",
            background:
              "linear-gradient(135deg, rgba(171, 216, 255, 0.4) 0%, rgba(171, 216, 255, 0.15) 100%)",
            borderRadius: "50%",
            filter: "blur(30px)",
            zIndex: 0,
          }}
        />

        <Box sx={{ position: "relative", zIndex: 1 }}>
          <Typography
            variant="h3"
            component="h1"
            sx={{
              fontSize: { xs: "1.5rem", md: "2.5rem" },
              fontWeight: 300,
              fontFamily: "Georgia, 'Times New Roman', Times, serif",
              color: "#2c3e50",
              mb: 0.5,
              letterSpacing: "0.02em",
              lineHeight: 1.2,
            }}
          >
            Welcome to Module {index + 1}
          </Typography>

          <Typography
            variant="h3"
            component="h2"
            sx={{
              fontSize: { xs: "2.5rem", md: "3.5rem" },
              fontWeight: 400,
              fontFamily: "Georgia, 'Times New Roman', Times, serif",
              color: "#2c3e50",
              mb: { xs: 0.5, md: 1 },
              letterSpacing: "-0.01em",
              lineHeight: 1.1,
              fontStyle: "italic",
            }}
          >
            {content?.title}
          </Typography>

          {/* Decorative divider line */}
          <Box
            sx={{
              width: "80px",
              height: "4px",
              background:
                "linear-gradient(90deg, rgba(171, 216, 255, 0.8) 0%, rgba(171, 216, 255, 0.2) 100%)",
              borderRadius: "2px",
              mt: { xs: 1, md: 2 },
            }}
          />
        </Box>
      </Box>

      {/* Card-based layout with shadows and gradient overlay */}
      <Box
        sx={{
          background:
            "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.9) 100%)",
          borderRadius: "24px",
          boxShadow:
            "0 8px 32px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05)",
          p: { xs: 2.5, md: 4 },
          mb: { xs: 2, md: 4 },
          position: "relative",
          overflow: "hidden",
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background:
              "linear-gradient(90deg, rgba(171, 216, 255, 0.6) 0%, rgba(171, 216, 255, 0.2) 50%, rgba(171, 216, 255, 0.6) 100%)",
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            gap: 1,
            mb: 4,
          }}
        >
          <Button
            onClick={() => handleStartModule()}
            variant="contained"
            sx={{
              py: 1.5,
              px: 3,
              borderRadius: "16px",
              bgcolor: (t) => t.palette.common.black,
              fontWeight: "bold",
              color: "white",
              fontSize: "1.25rem",
              transition: "all 0.3s ease",
              transform: "translateY(0)",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
              "&:hover": {
                bgcolor: (t) => t.palette.grey[800],
                transform: "translateY(-2px)",
                boxShadow: "0 6px 16px rgba(0, 0, 0, 0.2)",
              },
              "&:active": {
                transform: "translateY(0)",
              },
            }}
          >
            {userProgress ? "Continue Module" : "Start Module"}
          </Button>
        </Box>

        <Box
          sx={{
            mb: 4,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: "1.125rem",
                position: "relative",
                "&::after": {
                  content: '""',
                  position: "absolute",
                  bottom: -4,
                  left: 0,
                  width: "40px",
                  height: "2px",
                  background:
                    "linear-gradient(90deg, rgba(171, 216, 255, 0.8) 0%, transparent 100%)",
                  borderRadius: "1px",
                },
              }}
            >
              Current Progress
            </Typography>
          </Box>
          <Box className="flex flex-row gap-5 mt-5 flex-wrap">
            {Array.from({ length: steps.length }, (_, i) => i + 1).map(
              (step, idx) => {
                const isCompleted =
                  userProgress && step <= userProgress.completedStepIds.length;
                const isNext = userProgress
                  ? step === userProgress.completedStepIds.length + 1
                  : step === 1;
                const navigable = isCompleted || isNext;

                return (
                  <Box
                    key={step}
                    onClick={() => navigable && handleNavigateToStep(idx)}
                    sx={{
                      transition: "all 0.3s ease",
                      cursor: navigable ? "pointer" : "default",
                      "&:hover": navigable
                        ? {
                            transform: "translateY(-4px) scale(1.05)",
                          }
                        : {},
                    }}
                  >
                    {isCompleted ? (
                      <div
                        className="w-[36px] h-[36px] md:w-[50px] md:h-[50px] rounded-full border border-gray-300 flex items-center justify-center font-bold text-white min-w-[32px] p-0 bg-green-600 transition-all duration-300 shadow-md hover:shadow-lg text-sm md:text-base"
                        style={{
                          transition: "all 0.3s ease",
                        }}
                      >
                        {step}
                      </div>
                    ) : (
                      <div
                        className={`w-[36px] h-[36px] md:w-[50px] md:h-[50px] rounded-full border border-gray-300 flex items-center justify-center font-bold min-w-[32px] p-0 transition-all duration-300 text-sm md:text-base ${
                          navigable
                            ? "text-gray-800 bg-gray-100 hover:border-blue-300 hover:bg-blue-50"
                            : "text-gray-400 bg-gray-50 opacity-60"
                        }`}
                        style={{
                          transition: "all 0.3s ease",
                        }}
                      >
                        {step}
                      </div>
                    )}
                  </Box>
                );
              },
            )}
            {steps.length > 0 &&
              userProgress?.completedStepIds.length === steps.length && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    transition: "all 0.3s ease",
                    "&:hover": {
                      transform: "scale(1.1)",
                    },
                  }}
                >
                  <CheckCircleIcon
                    sx={{
                      color: (t) => t.palette.success.main,
                      fontSize: "2rem",
                      alignSelf: "center",
                      filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))",
                    }}
                  />
                </Box>
              )}
          </Box>
        </Box>

        <Box
          sx={{
            position: "relative",
            "&::before": {
              content: '""',
              position: "absolute",
              top: -16,
              left: 0,
              width: "100%",
              height: "1px",
              background:
                "linear-gradient(90deg, transparent 0%, rgba(171, 216, 255, 0.3) 50%, transparent 100%)",
            },
          }}
        >
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, mt: 3 }}
          >
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: "1.125rem",
                position: "relative",
                "&::after": {
                  content: '""',
                  position: "absolute",
                  bottom: -4,
                  left: 0,
                  width: "40px",
                  height: "2px",
                  background:
                    "linear-gradient(90deg, rgba(171, 216, 255, 0.8) 0%, transparent 100%)",
                  borderRadius: "1px",
                },
              }}
            >
              Module Overview
            </Typography>
          </Box>
          <Typography
            sx={{
              color: (t) => t.palette.common.black,
              lineHeight: "1.6",
              fontSize: "1rem",
            }}
          >
            {content?.description}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

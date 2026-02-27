"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  LinearProgress,
  useTheme,
  Alert,
  Checkbox,
} from "@mui/material";
import { PollStep, PollOption } from "@/lib/firebase/types";
import { submitPollVote, getUserPollVote, getPollResults } from "@/lib/firebase/db-operations";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface PollStepViewProps {
  step: PollStep;
  stepId: string;
  userId: string;
  moduleId: string;
}

export default function PollStepView({ step, stepId, userId, moduleId }: PollStepViewProps) {
  const theme = useTheme();
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [currentVotes, setCurrentVotes] = useState<PollOption[]>(step.options);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCheckIcon, setShowCheckIcon] = useState(false);

  useEffect(() => {
    const checkUserVote = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        const userVote = await getUserPollVote(moduleId, stepId, userId);
        if (userVote) {
          const freshPollData = await getPollResults(moduleId, stepId);
          setCurrentVotes(freshPollData.options);

          setHasVoted(true);
          setShowResults(true);
          setShowCheckIcon(true);
          if (step.allowMultipleChoice) {
            setSelectedOptions(userVote.optionIds);
          } else {
            setSelectedOption(userVote.optionIds[0] || "");
          }
        }
      } catch (err) {
        console.error("Error checking user vote:", err);
      } finally {
        setIsLoading(false);
      }
    };

    checkUserVote();
  }, [userId, moduleId, stepId, step.allowMultipleChoice]);

  // Calculate total votes and percentages
  const totalVotes = currentVotes.reduce((sum, option) => sum + option.votes, 0);
  const getPercentage = (votes: number) => (totalVotes > 0 ? (votes / totalVotes) * 100 : 0);

  // Handle option selection
  const handleOptionSelect = (optionId: string) => {
    if (hasVoted) return;
    
    if (step.allowMultipleChoice) {
      setSelectedOptions(prev => 
        prev.includes(optionId) 
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      );
    } else {
      setSelectedOption(optionId);
    }
  };

  // Handle vote submission
  const handleVote = async () => {
    if (!userId) {
      setError("You must be logged in to vote");
      return;
    }

    const selectedIds = step.allowMultipleChoice ? selectedOptions : [selectedOption];
    
    if (selectedIds.length === 0) {
      setError("Please select at least one option");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await submitPollVote(moduleId, stepId, userId, selectedIds);
      
      // Fetch fresh poll data to get accurate vote counts
      const updatedPollData = await getPollResults(moduleId, stepId);
      setCurrentVotes(updatedPollData.options);
      
      setHasVoted(true);
      setShowResults(true);
      setShowCheckIcon(true);
      setSuccess(hasVoted ? "Your vote has been updated!" : "Your vote has been recorded!");
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err: any) {
      setError(err.message || "Failed to submit vote. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form to allow changing vote
  const handleChangeVote = () => {
    setHasVoted(false);
    setShowResults(false);
    setShowCheckIcon(false);
    setError(null);
  };

  if (isLoading) {
    return (
      <Box sx={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Typography>Loading poll...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "80%", maxWidth: "1400px", my: 4, bgcolor: "background.paper", p: 3, border: `1px solid ${theme.palette.grey[300]}`, borderRadius: "16px" }}>
      {/* Header */}
      <div className="flex items-center space-x-2 mb-4 border-b pb-6">
        <Typography
          variant="h4"
          component={"h1"}
          sx={{
            fontSize: "2rem",
            fontWeight: "bold",
            fontFamily: "var(--font-primary)",
            color: theme.palette.common.black,
          }}
        >
          {step.title || "Poll"}
        </Typography>
        {showCheckIcon &&
          <CheckCircleIcon 
            sx={{
              color: (t) => t.palette.success.main,
              fontSize: '1.5rem',
            }}
          />}
      </div>

      {/* Question */}
      <FormControl component="fieldset" fullWidth>
        <FormLabel>
          <Typography sx={{ fontWeight: 600, mb: 2 }}>
            {step.question}
          </Typography>
        </FormLabel>

        {step.allowMultipleChoice && (
          <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
            You may select multiple options
          </Typography>
        )}

        {/* Error/Success Messages */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert 
            severity="success" 
            sx={{ mb: 3 }}
            icon={<CheckCircleIcon />}
          >
            {success}
          </Alert>
        )}

        {/* Voting Options */}
        {!hasVoted ? (
          <Box>
            {step.allowMultipleChoice ? (
              // Multiple choice checkboxes
              <Box>
                {currentVotes.map((option) => (
                  <Box
                    key={option.id}
                    sx={{
                      mb: 1,
                      p: 1,
                      borderRadius: 1,
                      border: `1px solid ${
                        selectedOptions.includes(option.id)
                          ? theme.palette.primary.main
                          : theme.palette.grey[300]
                      }`,
                      bgcolor: selectedOptions.includes(option.id)
                        ? theme.palette.action.hover
                        : "transparent",
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedOptions.includes(option.id)}
                          onChange={() => handleOptionSelect(option.id)}
                          color="primary"
                        />
                      }
                      label={<Typography>{option.text}</Typography>}
                    />
                  </Box>
                ))}
              </Box>
            ) : (
              // Single choice radio buttons
              <RadioGroup
                value={selectedOption}
                onChange={(e) => handleOptionSelect(e.target.value)}
              >
                {currentVotes.map((option) => (
                  <Box
                    key={option.id}
                    sx={{
                      mb: 1,
                      p: 1,
                      borderRadius: 1,
                      border: `1px solid ${
                        selectedOption === option.id
                          ? theme.palette.primary.main
                          : theme.palette.grey[300]
                      }`,
                      bgcolor: selectedOption === option.id
                        ? theme.palette.action.hover
                        : "transparent",
                    }}
                  >
                    <FormControlLabel
                      value={option.id}
                      control={<Radio />}
                      label={<Typography>{option.text}</Typography>}
                    />
                  </Box>
                ))}
              </RadioGroup>
            )}
          </Box>
        ) : (
          // Results view
          <Box>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Results
            </Typography>
            {currentVotes.map((option) => {
              const percentage = getPercentage(option.votes);
              return (
                <Box key={option.id} sx={{ mb: 2 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                    <Typography variant="body1" fontWeight="medium">
                      {option.text}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {option.votes} votes ({percentage.toFixed(1)}%)
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={percentage}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: theme.palette.grey[200],
                      "& .MuiLinearProgress-bar": {
                        backgroundColor: theme.palette.primary.main,
                        borderRadius: 4,
                      },
                    }}
                  />
                </Box>
              );
            })}
            <Typography variant="body2" sx={{ mt: 2, textAlign: "center" }}>
              Total votes: {totalVotes}
            </Typography>
          </Box>
        )}
      </FormControl>

      {/* Action Buttons */}
      <Box sx={{ display: "flex", gap: 2, mt: 4, alignItems: "center" }}>
        {!hasVoted ? (
          <>
            <Button
              variant="contained"
              color="primary"
              onClick={handleVote}
              disabled={isSubmitting || (!step.allowMultipleChoice && !selectedOption) || (step.allowMultipleChoice && selectedOptions.length === 0)}
            >
              {isSubmitting ? "Submitting..." : "Submit Vote"}
            </Button>
            <Typography sx={{ color: (t) => t.palette.text.secondary }}>
              {currentVotes.length} option{currentVotes.length !== 1 ? "s" : ""}
            </Typography>
          </>
        ) : (
          <>
            <Box sx={{ flex: 1 }}>
              <Alert severity="success">
                <strong>Vote submitted</strong> — Thank you for participating!
              </Alert>
            </Box>
            <Button variant="contained" onClick={handleChangeVote}>
              Change Vote
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
}

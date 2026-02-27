import React, { useMemo, useState, useEffect } from "react";
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Typography,
  Alert,
  useTheme,
} from "@mui/material";
import { QuizStep } from "@/lib/firebase/types";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StepContent from "@/components/StepContent";


interface QuizStepViewProps {
  step: QuizStep;
  quizPassed: boolean;
  onPassedChange: (score: number) => void;
}

export default function QuizStepView({ step, quizPassed, onPassedChange }: QuizStepViewProps) {
  const [answers, setAnswers] = useState<number[]>(() =>
    step.questions.map(() => -1)
  );
  const [graded, setGraded] = useState(false);
  const questions = step.questions;
  const [showCheckIcon, setShowCheckIcon] = useState(false);
  const allAnswered = useMemo(() => answers.every((a) => a >= 0), [answers]);
  const theme = useTheme();

  const handleSelect = (qIndex: number, choiceIndex: number) => {
    setAnswers((prev) => {
      const copy = [...prev];
      copy[qIndex] = choiceIndex;
      return copy;
    });
  };

  const grade = () => {
    setGraded(true);
  };

  const reset = () => {
    setAnswers(questions.map(() => -1));
    setGraded(false);
  };

  const results = useMemo(() => {
    const correctCount = questions.reduce(
      (acc, q, i) => (answers[i] === q.correctIndex ? acc + 1 : acc),
      0
    );
    const percent =
      questions.length > 0
        ? Math.round((correctCount / questions.length) * 100)
        : 0;
    const passed = percent >= step.passingScore;
    return { correctCount, percent, passed };
  }, [answers, questions, step.passingScore]);

  // Initialize passed score to 0 (fail) on mount
  useEffect(() => {
    onPassedChange(0);
  }, []);

  useEffect(() => {
    quizPassed ? setShowCheckIcon(true) : setShowCheckIcon(false);
  }, [quizPassed]);

  useEffect(() => {
    if (graded) {
      results.passed && onPassedChange(results.percent);
    } else {
      onPassedChange(0);
    }
  }, [graded, results.passed, onPassedChange]);

  return (
    <Box sx={{ width: "80%", maxWidth: "1400px", my: 4, bgcolor: "background.paper", p: 3, border: `1px solid ${theme.palette.grey[300]}`, borderRadius: "16px" }}>
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
        {step.title || "Quiz"}
      </Typography>
      {showCheckIcon &&
      <CheckCircleIcon 
        sx={{
          color: (t) => t.palette.success.main,
          fontSize: '1.5rem',
        }}
      />}
      </div>

      {questions.map((q, qi) => {
        const userAnswer = answers[qi];
        const isCorrect = graded && userAnswer === q.correctIndex;
        const isIncorrect = graded && userAnswer !== q.correctIndex;

        return (
          <Box
            key={qi}
            component="section"
            sx={{ mb: 2 }}
            aria-labelledby={`q-${qi}-label`}
          >
            <FormControl component="fieldset" fullWidth>
              <FormLabel id={`q-${qi}-label`}>
                <Typography component="div" sx={{ fontWeight: 600 }}>
                  {qi + 1}.{' '}<StepContent content={q.prompt} inline />
                </Typography>
              </FormLabel>

              <RadioGroup
                aria-labelledby={`q-${qi}-label`}
                name={`question-${qi}`}
                value={String(userAnswer)}
                onChange={(e) => handleSelect(qi, Number(e.target.value))}
              >
                {q.choices.map((choice, ci) => {
                  const showCorrect = graded && ci === q.correctIndex;
                  const userPicked = answers[qi] === ci;
                  const explanation = q.choiceExplanations?.[ci];

                  return (
                    <Box
                      key={ci}
                      sx={{
                        mb: 1,
                        p: 1,
                        borderRadius: 1,
                        border: (t) =>
                          showCorrect
                            ? `1px solid ${t.palette.success.main}`
                            : userPicked && isIncorrect
                            ? `1px solid ${t.palette.error.main}`
                            : "1px solid transparent",
                        bgcolor: showCorrect
                          ? (t) => t.palette.action.hover
                          : "transparent",
                      }}
                    >
                      <FormControlLabel
                        value={String(ci)}
                        control={<Radio disabled={graded} />}
                        label={<Typography>{choice}</Typography>}
                      />
                      {graded && explanation && (
                        <Typography
                          variant="body2"
                          sx={{
                            mt: 0.5,
                            ml: 4.5,
                            color: (t) => t.palette.text.secondary,
                            fontStyle: 'italic',
                          }}
                        >
                          {explanation}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </RadioGroup>

              {graded && isIncorrect && (
                <Box sx={{ mt: 1 }}>
                  <Alert severity="info">
                    <strong>Correct answer:</strong> {q.choices[q.correctIndex]}
                    {/* Show legacy explanation if no choiceExplanations exist */}
                    {!q.choiceExplanations && q.explanation && (
                      <div style={{ marginTop: 8 }}>{q.explanation}</div>
                    )}
                  </Alert>
                </Box>
              )}

              {graded && isCorrect && (
                <Box sx={{ mt: 1 }}>
                  <Alert severity="success">Correct!</Alert>
                </Box>
              )}
            </FormControl>
          </Box>
        );
      })}

      <Box sx={{ display: "flex", gap: 2, mt: 2, alignItems: "center" }}>
        {!graded ? (
          <>
            <Button
              variant="contained"
              color="primary"
              onClick={grade}
              disabled={!allAnswered}
            >
              Check Answers
            </Button>
            <Button variant="outlined" onClick={reset}>
              Reset
            </Button>
            <Typography sx={{ color: (t) => t.palette.text.secondary }}>
              {questions.length} question{questions.length !== 1 ? "s" : ""}
            </Typography>
          </>
        ) : (
          <>
            <Box sx={{ flex: 1 }}>
              <Alert severity={results.passed ? "success" : "error"}>
                {results.passed ? (
                  <div>
                    <strong>Passed</strong> — You scored {results.percent}% (
                    {results.correctCount}/{questions.length})
                  </div>
                ) : (
                  <div>
                    <strong>Not passing</strong> — You scored {results.percent}%
                    ({results.correctCount}/{questions.length})
                  </div>
                )}
              </Alert>
            </Box>

            <Button variant="contained" onClick={reset}>
              Retake
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
}

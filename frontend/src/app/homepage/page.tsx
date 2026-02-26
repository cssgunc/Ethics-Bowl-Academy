"use client";

import { Box, Button, Container, Typography, IconButton } from "@mui/material";
import {
  ChevronLeft,
  ChevronRight,
  ArrowForward,
  OpenInNew,
} from "@mui/icons-material";
import { useState } from "react";
import AuthGate from "@/components/AuthGate";

export const dynamic = "force-dynamic";

export default function HomepagePage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Placeholder images - replace with actual images later
  const carouselImages = [
    "https://via.placeholder.com/800x400/4A90E2/FFFFFF?text=Ethics+in+Action",
    "https://via.placeholder.com/800x400/7B68EE/FFFFFF?text=Moral+Reasoning",
    "https://via.placeholder.com/800x400/50C878/FFFFFF?text=Ethical+Dilemmas",
    "https://via.placeholder.com/800x400/FF6B6B/FFFFFF?text=Philosophy+Practice",
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % carouselImages.length);
  };

  const prevSlide = () => {
    setCurrentSlide(
      (prev) => (prev - 1 + carouselImages.length) % carouselImages.length,
    );
  };

  return (
    <Container
      maxWidth="lg"
      sx={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        background:
          "linear-gradient(to bottom, white 0%, white 15%, rgba(255, 255, 255, 0.95) 20%, rgba(255, 255, 255, 0.8) 30%, rgba(255, 255, 255, 0.5) 50%, #abd8ff 100%)",
      }}
    >
      <AuthGate>
        <Box sx={{ py: 6, textAlign: "center", position: "relative" }}>
          {/* Background dot grid pattern over white-to-light-blue gradient - matches Modules Page */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              backgroundImage:
                "radial-gradient(circle at 2px 2px, rgba(171, 216, 255, 0.7) 2px, transparent 0)",
              backgroundSize: "30px 30px",
              maskImage:
                "radial-gradient(ellipse 100% 100% at center, black 40%, rgba(0, 0, 0, 0.8) 50%, rgba(0, 0, 0, 0.4) 65%, rgba(0, 0, 0, 0.1) 80%, transparent 100%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 100% 100% at center, black 40%, rgba(0, 0, 0, 0.8) 50%, rgba(0, 0, 0, 0.4) 65%, rgba(0, 0, 0, 0.1) 80%, transparent 100%)",
              zIndex: 0,
            }}
          />

          <Box
            sx={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: 4,
              px: 2,
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
              }}
            >
              {/* Welcome message */}
              <Typography
                variant="h3"
                component="h1"
                sx={{
                  fontSize: "3.5rem",
                  fontWeight: 400,
                  fontFamily: "Georgia, 'Times New Roman', Times, serif",
                  color: "#2c3e50",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.2,
                }}
              >
                Ethics Bowl Academy
              </Typography>

              <Typography
                variant="h6"
                component="p"
                sx={{
                  fontSize: "1.15rem",
                  fontWeight: 300,
                  fontFamily: "Georgia, 'Times New Roman', Times, serif",
                  color: "#4a5568",
                  letterSpacing: "0.01em",
                  lineHeight: 1.3,
                }}
              >
                Built by the Parr Center for Ethics in collaboration with TED-Ed
              </Typography>
            </Box>

            {/* Motivation and value blurb */}
            <Typography
              variant="body1"
              sx={{
                color: "#1a202c",
                lineHeight: 1.6,
                fontSize: "1.05rem",
                fontFamily: "var(--font-secondary)",
                fontWeight: 600,
                textShadow: "0 1px 2px rgba(255, 255, 255, 0.8)",
              }}
            >
              Develop critical thinking and ethical reasoning skills through
              interactive learning modules, structured debate preparation, and
              reflective philosophical discourse.
            </Typography>

            <Button
              variant="contained"
              href="/student"
              endIcon={<ArrowForward sx={{ fontSize: 16, color: "inherit" }} />}
            >
              Start Learning Here
            </Button>

            {/* Image Carousel */}
            <Box
              sx={{
                position: "relative",
                maxWidth: "800px",
                width: "100%",
                borderRadius: "12px",
                overflow: "hidden",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
              }}
            >
              <Box
                component="img"
                src={carouselImages[currentSlide]}
                alt={`Slide ${currentSlide + 1}`}
                sx={{
                  width: "100%",
                  height: "400px",
                  objectFit: "cover",
                  transition: "opacity 0.3s ease-in-out",
                }}
              />

              {/* Previous Button */}
              <IconButton
                onClick={prevSlide}
                sx={{
                  position: "absolute",
                  left: 16,
                  top: "50%",
                  transform: "translateY(-50%)",
                  backgroundColor: "rgba(255, 255, 255, 0.9)",
                  color: "#2c3e50",
                  width: 48,
                  height: 48,
                  "&:hover": {
                    backgroundColor: "rgba(255, 255, 255, 1)",
                    transform: "translateY(-50%) scale(1.1)",
                  },
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                  transition: "all 0.2s ease",
                }}
              >
                <ChevronLeft sx={{ fontSize: 28 }} />
              </IconButton>

              {/* Next Button */}
              <IconButton
                onClick={nextSlide}
                sx={{
                  position: "absolute",
                  right: 16,
                  top: "50%",
                  transform: "translateY(-50%)",
                  backgroundColor: "rgba(255, 255, 255, 0.9)",
                  color: "#2c3e50",
                  width: 48,
                  height: 48,
                  "&:hover": {
                    backgroundColor: "rgba(255, 255, 255, 1)",
                    transform: "translateY(-50%) scale(1.1)",
                  },
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                  transition: "all 0.2s ease",
                }}
              >
                <ChevronRight sx={{ fontSize: 28 }} />
              </IconButton>

              {/* Dot Indicators */}
              <Box
                sx={{
                  position: "absolute",
                  bottom: 16,
                  left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex",
                  gap: 1,
                }}
              >
                {carouselImages.map((_, index) => (
                  <Box
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      backgroundColor:
                        index === currentSlide
                          ? "rgba(255, 255, 255, 0.9)"
                          : "rgba(255, 255, 255, 0.5)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        backgroundColor: "rgba(255, 255, 255, 0.8)",
                        transform: "scale(1.2)",
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>

            {/* Two horizontally aligned sections */}
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", md: "row" },
                gap: 3,
                justifyContent: "center",
                alignItems: "stretch",
              }}
            >
              {/* Section 1: Module Features */}
              <Box
                sx={{
                  flex: 1,
                  maxWidth: 360,
                  p: 3,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  alignItems: "center",
                }}
              >
                <Typography
                  variant="h5"
                  component="h2"
                  sx={{
                    fontSize: "1.50rem",
                    fontWeight: 500,
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    color: "#2c3e50",
                    letterSpacing: "0.01em",
                  }}
                >
                  Module Features
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: "#4a5568",
                    textAlign: "center",
                    lineHeight: 1.5,
                    mb: 2,
                  }}
                >
                  Interactive videos, knowledge quizzes, digital flashcards, and
                  reflective writing prompts.
                </Typography>

                {/* TED-Ed Partnership */}
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color: "#4a5568",
                      fontStyle: "italic",
                      fontSize: "0.875rem",
                    }}
                  >
                    Powered by
                  </Typography>
                  <Box
                    component="img"
                    src="/teded.png"
                    alt="TED-Ed"
                    sx={{
                      height: "32px",
                      width: "auto",
                      opacity: 0.8,
                      transition: "opacity 0.2s ease",
                      "&:hover": {
                        opacity: 1,
                      },
                    }}
                  />
                </Box>
              </Box>

              {/* Section 2: Ethics Bowl */}
              <Box
                sx={{
                  flex: 1,
                  maxWidth: 360,
                  p: 3,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  alignItems: "center",
                }}
              >
                <Typography
                  variant="h5"
                  component="h2"
                  sx={{
                    fontSize: "1.50rem",
                    fontWeight: 500,
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    color: "#2c3e50",
                    letterSpacing: "0.01em",
                  }}
                >
                  NC High School Ethics Bowl
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  The North Carolina High School Ethics Bowl, headquartered at
                  the Parr Center for Ethics at UNC Chapel Hill, brings students
                  together to discuss complex ethical dilemmas through regional
                  and national competitions.
                </Typography>
                <Button
                  variant="outlined"
                  href="https://parrcenter.unc.edu/nchseb/"
                  target="_blank"
                  endIcon={
                    <OpenInNew sx={{ fontSize: 16, color: "inherit" }} />
                  }
                >
                  Learn More About the Ethics Bowl
                </Button>
              </Box>
            </Box>
          </Box>
        </Box>
      </AuthGate>
    </Container>
  );
}

"use client";

import { Box, Button, Container, Typography, IconButton } from "@mui/material";
import {
  ChevronLeft,
  ChevronRight,
  ArrowForward,
  OpenInNew,
} from "@mui/icons-material";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export const dynamic = "force-dynamic";

export default function HomepagePage() {
  const [user] = useAuth();
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Placeholder images - replace with actual images later
  const carouselImages = [
    "/save-one.jpg",
    "/animal-rescue.jpg",
    "/living.jpg",
    "/believe.jpg",
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
      maxWidth={false}
      disableGutters
      sx={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        background:
          "linear-gradient(to bottom, white 0%, white 15%, rgba(255, 255, 255, 0.95) 20%, rgba(255, 255, 255, 0.8) 30%, rgba(255, 255, 255, 0.5) 50%, #abd8ff 100%)",
      }}
    >
        <Box sx={{ py: { xs: 3, md: 6 }, textAlign: "center", position: "relative" }}>
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
                gap: 2,
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

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: { xs: 1.5, md: 2 },
                }}
              >
                <Box
                  component="img"
                  src="/philosophy_logo_white_horizontal.png"
                  alt="Parr Center for Ethics"
                  sx={{
                    height: { xs: "28px", md: "36px" },
                    width: "auto",
                    filter: "invert(1) brightness(0.3)",
                  }}
                />
                <Typography
                  sx={{
                    fontSize: { xs: "1.2rem", md: "1.5rem" },
                    fontWeight: 300,
                    color: "#4a5568",
                    lineHeight: 1,
                  }}
                >
                  ×
                </Typography>
                <Box
                  component="img"
                  src="/teded.png"
                  alt="TED-Ed"
                  sx={{
                    height: { xs: "24px", md: "30px" },
                    width: "auto",
                  }}
                />
              </Box>
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
              Build critical thinking and ethical reasoning skills through
              interactive modules and structured debate preparation
            </Typography>

            <Button
              variant="contained"
              onClick={() => router.push(user ? "/student" : "/login")}
              endIcon={<ArrowForward sx={{ fontSize: 20, color: "inherit" }} />}
              sx={{
                fontSize: { xs: "1rem", md: "1.1rem" },
                px: { xs: 3, md: 4 },
                py: { xs: 1.2, md: 1.5 },
                borderRadius: "16px",
              }}
            >
              Start Learning
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
                  height: { xs: "200px", md: "400px" },
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
                    fontSize: "1.25rem",
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
                    fontSize: "1.25rem",
                    fontWeight: 500,
                    fontFamily: "Georgia, 'Times New Roman', Times, serif",
                    color: "#2c3e50",
                    letterSpacing: "0.01em",
                  }}
                >
                  National High School Ethics Bowl
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
    </Container>
  );
}

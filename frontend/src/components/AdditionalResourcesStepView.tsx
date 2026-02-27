import React from "react";
import { AdditionalResourcesStep } from "@/lib/firebase/types";
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Chip,
} from "@mui/material";
import LinkIcon from "@mui/icons-material/Link";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

interface AdditionalResourcesStepViewProps {
  step: AdditionalResourcesStep;
}

interface Resource {
  id: string;
  name: string;
  url: string;
  type: "link" | "pdf";
}

export default function AdditionalResourcesStepView({
  step,
}: AdditionalResourcesStepViewProps) {
  // Parse resources - handle both old format and new format
  const getResources = (): Resource[] => {
    const resources: Resource[] = [];

    // Check if new format exists (array of resources)
    if (step.resources?.all && Array.isArray(step.resources.all)) {
      return step.resources.all as Resource[];
    }

    // Fall back to old format (single link and single pdf)
    if (step.resources?.link) {
      resources.push({
        id: "link-1",
        name: "External Link",
        url: step.resources.link,
        type: "link",
      });
    }

    if (step.resources?.pdf) {
      resources.push({
        id: "pdf-1",
        name: "PDF Document",
        url: step.resources.pdf,
        type: "pdf",
      });
    }

    return resources;
  };

  const resources = getResources();

  const handleOpenResource = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const getResourceIcon = (type: "link" | "pdf") => {
    return type === "pdf" ? (
      <InsertDriveFileIcon sx={{ fontSize: 40, color: "#ef4444" }} />
    ) : (
      <LinkIcon sx={{ fontSize: 40, color: "#3b82f6" }} />
    );
  };

  const getResourceColor = (type: "link" | "pdf") => {
    return type === "pdf" ? "#fee2e2" : "#dbeafe";
  };

  const getResourceBorderColor = (type: "link" | "pdf") => {
    return type === "pdf" ? "#fca5a5" : "#93c5fd";
  };

  if (resources.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="body1" color="text.secondary">
          No resources available for this step.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", maxWidth: "800px", mx: "auto", p: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontSize: "2rem",
            fontWeight: "bold",
            textAlign: "center",
            mb: 3,
          }}
        >
          Additional Resources
        </Typography>
        <Typography
          variant="h5"
          component="h2"
          sx={{
            fontWeight: "bold",
            textAlign: "center",
            mb: 3,
          }}
        >
          {resources.length} resource{resources.length !== 1 ? "s" : ""}{" "}
          available
        </Typography>
      </Box>

      {/* Resources Grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
          },
          gap: 3,
        }}
      >
        {resources.map((resource, index) => (
          <Card
            key={resource.id}
            elevation={2}
            sx={{
              backgroundColor: getResourceColor(resource.type),
              border: `2px solid ${getResourceBorderColor(resource.type)}`,
              transition: "all 0.2s ease-in-out",
              "&:hover": {
                transform: "translateY(-4px)",
                boxShadow: 6,
              },
            }}
          >
            <CardContent sx={{ p: 3 }}>
              {/* Icon and Type Badge */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 2,
                }}
              >
                {getResourceIcon(resource.type)}
                <Chip
                  label={resource.type === "pdf" ? "PDF" : "Link"}
                  size="small"
                  sx={{
                    backgroundColor:
                      resource.type === "pdf" ? "#dc2626" : "#2563eb",
                    color: "white",
                    fontWeight: "bold",
                    fontSize: "0.75rem",
                  }}
                />
              </Box>

              {/* Resource Name */}
              <Typography
                variant="h6"
                component="h3"
                gutterBottom
                sx={{
                  fontWeight: 600,
                  color: "text.primary",
                  minHeight: "48px",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  mb: 2,
                }}
              >
                {resource.name}
              </Typography>

              {/* Resource Number */}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 2, display: "block" }}
              >
                Resource {index + 1} of {resources.length}
              </Typography>

              {/* Open Button */}
              <Button
                variant="contained"
                fullWidth
                endIcon={<OpenInNewIcon />}
                onClick={() => handleOpenResource(resource.url)}
                sx={{
                  backgroundColor:
                    resource.type === "pdf" ? "#dc2626" : "#2563eb",
                  "&:hover": {
                    backgroundColor:
                      resource.type === "pdf" ? "#b91c1c" : "#1d4ed8",
                  },
                  textTransform: "none",
                  fontWeight: 600,
                  py: 1.5,
                }}
              >
                {resource.type === "pdf" ? "View PDF" : "Open Link"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Helper Tip */}
      <Box
        sx={{
          mt: 4,
          p: 2,
          backgroundColor: "#f0f9ff",
          borderRadius: 1,
          border: "1px solid #bfdbfe",
        }}
      >
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ display: "flex", alignItems: "center", gap: 1 }}
        >
          <span style={{ fontSize: "1.2rem" }}>💡</span>
          <span>
            Click on any resource card to open it in a new tab. PDFs will open
            in your browser's PDF viewer.
          </span>
        </Typography>
      </Box>
    </Box>
  );
}

"use client";

import Image from 'next/image';
import { Box, Typography, Link as MuiLink, Divider } from '@mui/material';

export default function Footer() {
  const links = [
    { label: 'Parr Center Homepage', href: 'https://parrcenter.unc.edu/' },
    { label: 'National High School Ethics Bowl', href: 'https://nhseb.org/' },
  ];

  return (
    <Box
      component="footer"
      sx={{
        bgcolor: 'info.main',
        color: 'common.white',
        py: { xs: 2, md: 3 },
        px: { xs: 2, md: 6 },
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.15)',
      }}
    >
      <Box
        sx={{
          maxWidth: '1280px',
          mx: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 3, md: 6 },
          flexWrap: 'wrap',
        }}
      >
        <Image
          src="/philosophy_logo_white.png"
          alt="UNC Philosophy Logo"
          width={100}
          height={114}
          style={{ flexShrink: 0 }}
        />

        <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.25)' }} />

        <Box sx={{ textAlign: 'left' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Quick Links</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            {links.map((link) => (
              <MuiLink
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                variant="caption"
                sx={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }}
              >
                {link.label}
              </MuiLink>
            ))}
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, mt: 0.5, fontWeight: 600 }}>
              Contact
            </Typography>
            <MuiLink
              href="mailto:michael.vazquez@unc.edu"
              underline="hover"
              variant="caption"
              sx={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }}
            >
              michael.vazquez@unc.edu
            </MuiLink>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

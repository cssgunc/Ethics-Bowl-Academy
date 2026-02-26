"use client";

import Image from 'next/image';
import { Box, Typography, Link as MuiLink, Divider } from '@mui/material';

export default function Footer() {
  const links = [
    { label: 'Parr Center Events', href: 'https://parrcenter.unc.edu/events/' },
    { label: 'Ethics Studio (TED-Ed)', href: 'https://parrcenter.unc.edu/ted-ed/' },
    { label: 'Parr Center Homepage', href: 'https://parrcenter.unc.edu/' },
    { label: 'Mission & Vision', href: 'https://parrcenter.unc.edu/mission/' },
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
        }}
      >
        {/* Mobile: logo + links side by side, contact below */}
        {/* Desktop: logo | contact | links in a row */}

        {/* Desktop layout */}
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            alignItems: 'center',
            gap: 6,
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
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Contact</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, display: 'block' }}>
              Philosophy Department, UNC Chapel Hill<br />
              Caldwell Hall, CB# 3125, 240 East Cameron Ave.<br />
              Chapel Hill, NC 27599-3125<br />
              Phone: (919) 962-7291 &middot; Email: philosophy@unc.edu
            </Typography>
          </Box>

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
            </Box>
          </Box>
        </Box>

        {/* Mobile layout */}
        <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1.5 }}>
          {/* Top row: logo + quick links side by side */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <Image
              src="/philosophy_logo_white.png"
              alt="UNC Philosophy Logo"
              width={70}
              height={80}
              style={{ flexShrink: 0 }}
            />
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.25 }}>Quick Links</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {links.map((link) => (
                  <MuiLink
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    underline="hover"
                    variant="caption"
                    sx={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, fontSize: '0.7rem' }}
                  >
                    {link.label}
                  </MuiLink>
                ))}
              </Box>
            </Box>
          </Box>

          {/* Contact */}
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.25 }}>Contact</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, display: 'block', fontSize: '0.7rem' }}>
              Philosophy Department, UNC Chapel Hill<br />
              Caldwell Hall, CB# 3125, 240 East Cameron Ave.<br />
              Chapel Hill, NC 27599-3125<br />
              Phone: (919) 962-7291 &middot; Email: philosophy@unc.edu
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

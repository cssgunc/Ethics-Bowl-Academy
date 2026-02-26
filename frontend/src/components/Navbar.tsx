"use client";

import * as React from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Container from "@mui/material/Container";
import Button from "@mui/material/Button";
import AccountCircle from "@mui/icons-material/AccountCircle";
import Home from "@mui/icons-material/Home";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getUserRole } from "@/lib/firebase/Authentication/GetUserRole";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const [user] = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let isMounted = true;

    const checkAdminStatus = async () => {
      if (!user) {
        if (isMounted) {
          setIsAdmin(false);
        }
        return;
      }

      try {
        const adminStatus = await getUserRole(user.uid);
        if (isMounted) {
          setIsAdmin(Boolean(adminStatus));
        }
      } catch (error) {
        if (isMounted) {
          setIsAdmin(false);
        }
      }
    };

    checkAdminStatus();

    return () => {
      isMounted = false;
    };
  }, [user]);

  return (
    <AppBar
      position="static"
      sx={{
        backgroundColor: "info.main",
        boxShadow: "none",
      }}
    >
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ justifyContent: "space-between" }}>
          <Box
            component={Link}
            href="/"
            sx={{
              display: "flex",
              alignItems: "center",
              textDecoration: "none",
              py: 2,
            }}
          >
            <Image
              src="/philosophy_logo_white_horizontal.png"
              alt="UNC Parr Center for Ethics"
              width={650}
              height={300}
              priority
              style={{ width: "auto", maxHeight: "60px" }}
            />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            {user && (
              <>
              <IconButton
                component={Link}
                href="/homepage"
                sx={{
                  color: pathname === "/homepage" ? "primary.main" : "white",
                }}
              >
                <Home sx={{ fontSize: 40 }} />
              </IconButton>
              <Button
              component={Link}
              href="/student"
              variant={pathname === "/student" ? "contained" : "outlined"}
              sx={{
                color: "white",
                backgroundColor: pathname === "/student" ? "primary.main" : "transparent",
                borderColor: pathname === "/student" ? "primary.main" : "outlined",
                textTransform: "none",
                fontSize: "16px",
                borderRadius: "16px",
                px: 3,
                py: 1,
              }}
              >
                Modules
              </Button>
              <Button
                component={Link}
                href="/journal"
                variant={pathname === "/journal" ? "contained" : "outlined"}
                sx={{
                  color: "white",
                  backgroundColor: pathname === "/journal" ? "primary.main" : "transparent",
                  borderColor: pathname === "/journal" ? "primary.main" : "outlined",
                  textTransform: "none",
                  fontSize: "16px",
                  borderRadius: "16px",
                  px: 3,
                  py: 1,
                }}
              >
                Journal
              </Button>
              </>
            )}

            {isAdmin && (
              <Button
                component={Link}
                href="/admin"
                variant={pathname === "/admin" ? "contained" : "outlined"}
                sx={{
                  color: "white",
                  backgroundColor: pathname === "/admin" ? "primary.main" : "transparent",
                  borderColor: pathname === "/admin" ? "primary.main" : "outlined",
                  textTransform: "none",
                  fontSize: "16px",
                  borderRadius: "16px",
                  px: 3,
                  py: 1,
                }}
              >
                Admin Dashboard
              </Button>
            )}

            <IconButton
              component={Link}
              href="/profile"
              sx={{
                color: "primary.main",
              }}
            >
              <AccountCircle sx={{ fontSize: 40 }} />
            </IconButton>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}

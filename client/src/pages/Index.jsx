import React, { useState, useEffect } from "react";
import { Container, Box, AppBar, Toolbar, Typography, Button, Grid, Paper } from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import VideocamIcon from "@mui/icons-material/Videocam";
import CameraStream from "../components/CameraStream";
import CameraControls from "../components/CameraControls";
import { fetchStatus } from "../services/api";
import { useErrorSnackbar } from "../context/ErrorSnackbarContext";

const Index = ({ onLogout }) => {
  const { showError } = useErrorSnackbar();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const data = await fetchStatus();
        setStatus(data);
        setLoading(false);
      } catch (err) {
        console.error("Status fetch error:", err);
        showError("Kamera durumu yüklenemedi");
        setLoading(false);
      }
    };

    loadStatus();

    const interval = setInterval(loadStatus, 500);
    return () => clearInterval(interval);
  }, [showError]);

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="fixed">
        <Toolbar>
          <VideocamIcon sx={{ mr: 1 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Home Camera System
          </Typography>
          <Button color="inherit" onClick={onLogout} startIcon={<LogoutIcon />}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>
      <Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 9 }}>
            <CameraStream />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <CameraControls status={status} />
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default Index;

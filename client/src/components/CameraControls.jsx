import { useState } from "react";
import { Box, Button, Grid, Switch, FormControlLabel, Typography, Paper, Card, Divider, Stack, IconButton } from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import HomeIcon from "@mui/icons-material/Home";
import { movePanTilt, resetSystem, setLedStatus } from "../services/api";
import { useErrorSnackbar } from "../context/ErrorSnackbarContext";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

const CameraControls = ({ status }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState(10);
  const { showError, showSuccess } = useErrorSnackbar();

  const handleLedToggle = (flag) => {
    if (flag !== status.ledStatus) {
      setIsProcessing(true);
      setLedStatus(flag)
        .then((response) => {
          console.log("LED status updated:", response);
        })
        .catch((error) => {
          console.error("Error updating LED status:", error);
        })
        .finally(() => {
          setTimeout(() => {
            setIsProcessing(false);
          }, 500);
        });
    }
  };

  const handleSystemReset = () => {
    setIsProcessing(true);
    resetSystem();
    setTimeout(() => {
      setIsProcessing(false);
      window.location.reload();
    }, 2000);
    showSuccess("System reset successfully. Please wait for the camera to reboot.");
  };

  const handlePanTilt = (direction) => {
    setIsProcessing(true);
    let targetPanTilt = { pan: status?.servo?.pan, tilt: status?.servo?.tilt };
    switch (direction) {
      case "down":
        targetPanTilt.tilt += step;
        break;
      case "up":
        targetPanTilt.tilt -= step;
        break;
      case "right":
        targetPanTilt.pan -= step;
        break;
      case "left":
        targetPanTilt.pan += step;
        break;
      default:
        console.error("Invalid direction:", direction);
        setIsProcessing(false);
        return;
    }
    if (targetPanTilt.pan < 0 || targetPanTilt.pan > 180 || targetPanTilt.tilt < 0 || targetPanTilt.tilt > 180) {
      showError("Pan/Tilt values must be between 0 and 180 degrees.");
      setIsProcessing(false);
      return;
    }
    movePanTilt(targetPanTilt)
      .then((response) => {
        console.log("Pan/Tilt movement successful:", response);
      })
      .catch((error) => {
        console.error("Error moving Pan/Tilt:", error);
      })
      .finally(() => {
        setTimeout(() => {
          setIsProcessing(false);
        }, 500);
      });
  };

  const handleStepClick = () => {
    let newStep = prompt("Enter step size in degrees (0-180):", step);
    if (newStep !== null) {
      newStep = parseInt(newStep, 10);
      if (!isNaN(newStep) && newStep >= 0 && newStep <= 180) {
        setStep(newStep);
      } else {
        showError("Invalid step size. Please enter a number between 0 and 180.");
      }
    }
  };

  const directionButtonStyle = {
    backgroundColor: "primary.main",
    color: "white",
    "&:hover": {
      backgroundColor: "primary.dark",
    },
    width: 56,
    height: 56,
    m: 0.5,
  };

  return (
    <Box sx={{ padding: 2 }}>
      <Stack direction="column" spacing={2} justifyContent="space-between" alignItems="center">
        <Paper variant="outlined" sx={{ width: "100%", p: 2 }}>
          <Typography variant="h6">Pantilt Controls</Typography>
          <Grid container spacing={2} justifyContent="center" alignItems="center">
            <Grid size={9}>
              <Stack direction="column" spacing={0} justifyContent="center" alignItems="center">
                <IconButton sx={directionButtonStyle} onClick={() => handlePanTilt("up")} disabled={isProcessing}>
                  <ArrowUpwardIcon />
                </IconButton>
                <Box>
                  <IconButton sx={directionButtonStyle} onClick={() => handlePanTilt("left")} disabled={isProcessing}>
                    <ArrowBackIcon />
                  </IconButton>
                  <Button variant="outlined" size="small" onClick={handleStepClick} disabled={isProcessing} sx={{ height: "auto", py: 1 }}>
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <Typography variant="caption">Step:</Typography>
                      <Typography variant="body2">{step}°</Typography>
                    </Box>
                  </Button>
                  <IconButton sx={directionButtonStyle} onClick={() => handlePanTilt("right")} disabled={isProcessing}>
                    <ArrowForwardIcon />
                  </IconButton>
                </Box>
                <IconButton sx={directionButtonStyle} onClick={() => handlePanTilt("down")} disabled={isProcessing}>
                  <ArrowDownwardIcon />
                </IconButton>
              </Stack>
            </Grid>
            <Grid size={3}>
              <Card variant="elevation" sx={{ height: "100%", p: 1, textAlign: "center" }}>
                <Typography variant="body2">Pan: {status?.servo?.pan}°</Typography>
                <Typography variant="body2">Tilt: {status?.servo?.tilt}°</Typography>
              </Card>
            </Grid>
          </Grid>
        </Paper>
        <Paper variant="outlined" sx={{ width: "100%", p: 2 }}>
          <Grid container alignItems="center">
            <Grid size={2}>
              <LightbulbIcon color={status?.led === 1 ? "warning" : "disabled"} sx={{ fontSize: 28 }} />
            </Grid>
            <Grid size={10}>
              <FormControlLabel control={<Switch checked={status?.led === 1} onChange={(e) => handleLedToggle(e.target.checked)} color="warning" disabled={isProcessing} />} label={isProcessing ? "Processing..." : status?.led === 1 ? "LED On" : "LED Off"} />
            </Grid>
            <Grid size={12} sx={{ textAlign: "center", mt: 1 }}>
              <Button variant="contained" color="primary" startIcon={<RestartAltIcon />} onClick={handleSystemReset} disabled={isProcessing}>
                Reset System
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Stack>
    </Box>
  );
};

export default CameraControls;

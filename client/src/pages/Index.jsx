import { Grid } from "@mui/material";
import CameraStream from "../components/CameraStream";
import CameraControls from "../components/CameraControls";
import { useEffect, useState } from "react";

const Index = () => {
  const [status, setStatus] = useState({
    streaming: false,
    ledStatus: false,
    position: { pan: -1, tilt: -1, panTarget: -1, tiltTarget: -1 },
  });

  const fetchCameraStatus = async () => {
    try {
      const response = await fetch("/api/status");
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      const data = await response.json();
      setStatus({
        streaming: !!data?.camera,
        ledStatus: data?.led === 0 ? false : true,
        position: {
          pan: !!data?.servo?.pan ? data.servo.pan : -1,
          tilt: !!data?.servo?.tilt ? data.servo.tilt : -1,
          panTarget: !!data?.servo?.panTarget ? data.servo.panTarget : -1,
          tiltTarget: !!data?.servo?.panTarget ? data.servo.panTarget : -1,
        },
      });
    } catch (error) {
      console.error("Error fetching camera status:", error);
    }
  };

  useEffect(() => {
    fetchCameraStatus();

    const interval = setInterval(fetchCameraStatus, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <Grid container spacing={2} sx={{ padding: 2 }}>
      <Grid size={{ xs: 12, md: 9 }}>
        <CameraStream streaming={true} />
      </Grid>
      <Grid size={{ xs: 12, md: 3 }}>
        <CameraControls status={status} />
      </Grid>
    </Grid>
  );
};

export default Index;

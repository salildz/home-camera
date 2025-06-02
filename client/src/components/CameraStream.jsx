import { useRef, useEffect, useState } from "react";
import { Box, Typography, Stack, IconButton } from "@mui/material";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import { getStreamUrl } from "../services/api";

const CameraStream = () => {
  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [connectionFailed, setConnectionFailed] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const streamRequestRef = useRef(null);

  // Handle stream connections and errors
  useEffect(() => {
    const connectStream = () => {
      if (imgRef.current) {
        const timestamp = new Date().getTime();
        imgRef.current.src = `${getStreamUrl()}&t=${timestamp}`;
        setConnectionFailed(false);
      }
    };

    const handleStreamError = () => {
      console.log("Stream connection failed, attempting reconnect...");
      setConnectionFailed(true);
      setReconnectAttempts((prev) => prev + 1);

      // Try to reconnect with increasing delays (up to 5 seconds)
      const delay = Math.min(5000, 1000 + reconnectAttempts * 500);
      setTimeout(connectStream, delay);
    };

    const handleStreamLoad = () => {
      console.log("Stream connected successfully");
      setConnectionFailed(false);
      setReconnectAttempts(0);
    };

    // Set up handlers
    if (imgRef.current) {
      imgRef.current.onerror = handleStreamError;
      imgRef.current.onload = handleStreamLoad;

      connectStream();
    }

    return () => {
      if (imgRef.current) {
        imgRef.current.onerror = null;
        imgRef.current.onload = null;
      }

      // Cleanup XHR request
      if (streamRequestRef.current) {
        streamRequestRef.current.abort();
      }
    };
  }, [reconnectAttempts]);

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  if (connectionFailed) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          width: "100%",
          bgcolor: "background.paper",
          borderRadius: 1,
        }}
      >
        <VideocamOffIcon sx={{ fontSize: 80, color: "text.secondary", mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          {connectionFailed ? "Connection failed" : "Camera offline"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {connectionFailed ? `Reconnecting... (Attempt ${reconnectAttempts})` : "Waiting for connection..."}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        backgroundColor: "black",
        ...(fullscreen
          ? {
              width: "100vw",
              height: "100vh",
            }
          : {
              aspectRatio: "4/3",
              maxHeight: "calc(100vh - 32px)",
              margin: "0 auto",
            }),
      }}
    >
      {/* Image container with preserved aspect ratio */}
      <Box
        sx={{
          position: "relative",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: fullscreen ? "100%" : "auto",
          width: fullscreen ? "auto" : "100%",
          maxWidth: "100%",
          maxHeight: "100%",
          aspectRatio: "4/3",
        }}
      >
        <img
          ref={imgRef}
          alt="Camera Stream"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      </Box>

      {/* Controls */}
      <Stack
        direction="row"
        spacing={1}
        sx={{
          position: "absolute",
          bottom: 10,
          right: 10,
          backgroundColor: "rgba(0,0,0,0.5)",
          borderRadius: 1,
          p: 0.5,
          opacity: 0.7,
          "&:hover": {
            opacity: 1,
          },
        }}
      >
        <IconButton size="small" onClick={toggleFullscreen} sx={{ color: "white" }} title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
          {fullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
        </IconButton>
      </Stack>
    </Box>
  );
};

export default CameraStream;

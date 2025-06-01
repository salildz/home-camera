import { useState, useEffect } from "react";
import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, CircularProgress } from "@mui/material";
import VideoFileIcon from "@mui/icons-material/VideoFile";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const VideoRecordings = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true);
        const response = await fetch("http://localhost:5000/api/videos");
        if (!response.ok) {
          throw new Error(`Failed to fetch videos: ${response.status}`);
        }
        const data = await response.json();
        setVideos(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching videos:", err);
        setError("Failed to load recordings");
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
    // Refresh the list every minute
    const interval = setInterval(fetchVideos, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <CircularProgress size={40} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <ErrorOutlineIcon color="error" sx={{ fontSize: 40, mb: 2 }} />
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (videos.length === 0) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <Typography color="text.secondary">No recordings found</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100%", overflow: "auto" }}>
      <List dense sx={{ maxHeight: "100%" }}>
        {videos.map((video) => (
          <ListItem key={video.name} disablePadding>
            <ListItemButton component="a" href={`http://localhost:5000${video.url}`} target="_blank" rel="noopener noreferrer">
              <ListItemIcon>
                <VideoFileIcon />
              </ListItemIcon>
              <ListItemText primary={video.name} secondary={video.ctime ? formatDate(video.ctime) : "Unknown date"} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default VideoRecordings;

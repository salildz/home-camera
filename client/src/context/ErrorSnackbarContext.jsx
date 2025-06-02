import { createContext, useState, useContext } from "react";
import { Snackbar, Alert } from "@mui/material";

const ErrorSnackbarContext = createContext();

// Custom hook to use the error snackbar context
export const useErrorSnackbar = () => {
  const context = useContext(ErrorSnackbarContext);
  if (!context) {
    throw new Error("useErrorSnackbar must be used within an ErrorSnackbarProvider");
  }
  return context;
};

// Provider component
export const ErrorSnackbarProvider = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState("error");
  const [autoHideDuration, setAutoHideDuration] = useState(6000);

  // Show error message
  const showError = (errorMessage, duration = 6000) => {
    setMessage(errorMessage);
    setSeverity("error");
    setAutoHideDuration(duration);
    setOpen(true);
  };

  // Show success message
  const showSuccess = (successMessage, duration = 3000) => {
    setMessage(successMessage);
    setSeverity("success");
    setAutoHideDuration(duration);
    setOpen(true);
  };

  // Hide snackbar
  const hideSnackbar = () => {
    setOpen(false);
  };

  // Handle close event
  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    hideSnackbar();
  };

  return (
    <ErrorSnackbarContext.Provider
      value={{
        showError,
        showSuccess,
        hideSnackbar,
      }}
    >
      {children}
      <Snackbar open={open} autoHideDuration={autoHideDuration} onClose={handleClose} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert onClose={handleClose} severity={severity} variant="filled" sx={{ width: "100%" }}>
          {message}
        </Alert>
      </Snackbar>
    </ErrorSnackbarContext.Provider>
  );
};

export default ErrorSnackbarContext;

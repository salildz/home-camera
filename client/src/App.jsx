import { ThemeProvider } from "@emotion/react";
import { createTheme, CssBaseline } from "@mui/material";
import Index from "./pages/Index";
import { ErrorSnackbarProvider } from "./context/ErrorSnackbarContext";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#90caf9",
    },
    secondary: {
      main: "#f48fb1",
    },
    background: {
      default: "#121212",
      paper: "#1e1e1e",
    },
  },
});
function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <ErrorSnackbarProvider>
        <Index />
      </ErrorSnackbarProvider>
    </ThemeProvider>
  );
}

export default App;

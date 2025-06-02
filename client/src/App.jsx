import { useState } from "react";
import { ThemeProvider } from "@emotion/react";
import { createTheme, CssBaseline } from "@mui/material";
import Index from "./pages/Index";
import Login from "./pages/Login";
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
  const [isAuth, setIsAuth] = useState(!!localStorage.getItem("token"));

  const handleLogin = () => setIsAuth(true);
  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsAuth(false);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <ErrorSnackbarProvider>{isAuth ? <Index onLogout={handleLogout} /> : <Login onLogin={handleLogin} />}</ErrorSnackbarProvider>
    </ThemeProvider>
  );
}

export default App;

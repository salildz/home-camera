import { useState } from "react";
import { TextField, Button, Box, Typography, Paper } from "@mui/material";
import { loginUser } from "../services/api";
import { useErrorSnackbar } from "../context/ErrorSnackbarContext";

const Login = ({ onLogin }) => {
  const { showError } = useErrorSnackbar();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await loginUser(username, password);
      if (res.success && res.token) {
        localStorage.setItem("token", res.token);
        onLogin();
      } else {
        showError("Kullanıcı adı veya şifre hatalı");
      }
    } catch (err) {
      console.error("Login error:", err);
      showError("Giriş yapılırken bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
      <Paper sx={{ p: 4, maxWidth: 400, width: "100%" }}>
        <Typography variant="h4" align="center" gutterBottom>
          Ev Kamera Sistemi
        </Typography>
        <Typography variant="body1" align="center" sx={{ mb: 3 }}>
          Lütfen giriş yapınız
        </Typography>

        <form onSubmit={handleSubmit}>
          <TextField label="Kullanıcı Adı" value={username} onChange={(e) => setUsername(e.target.value)} fullWidth margin="normal" variant="outlined" required autoFocus />

          <TextField label="Şifre" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth margin="normal" variant="outlined" required />

          <Button type="submit" variant="contained" fullWidth size="large" disabled={loading} sx={{ mt: 3 }}>
            {loading ? "Giriş Yapılıyor..." : "Giriş Yap"}
          </Button>
        </form>
      </Paper>
    </Box>
  );
};

export default Login;

import { FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { confirmPasswordReset } from "../api/users";

const inputStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #E6EEF6",
  boxSizing: "border-box" as const,
};

export default function ResetPassword() {
  const { uid = "", token = "" } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await confirmPasswordReset({
        uid,
        token,
        new_password: password,
        new_password_confirm: passwordConfirm,
      });
      setMessage(response.detail);
      setPassword("");
      setPasswordConfirm("");
      window.setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось изменить пароль.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", display: "grid", gap: 16 }}>
      <div>
        <h2 style={{ margin: "0 0 8px" }}>Новый пароль</h2>
        <p style={{ margin: 0, color: "#64748B" }}>Введите новый пароль два раза. После успешной смены можно будет войти заново.</p>
      </div>

      <form
        onSubmit={onSubmit}
        style={{ background: "white", border: "1px solid #E6EEF6", borderRadius: 14, padding: 18, display: "grid", gap: 14 }}
      >
        {error && (
          <div style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", borderRadius: 10, padding: 12 }}>
            {error}
          </div>
        )}

        {message && (
          <div style={{ background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0", borderRadius: 10, padding: 12 }}>
            {message}
          </div>
        )}

        <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
          Новый пароль
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={3}
            autoComplete="new-password"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
          Повторите новый пароль
          <input
            type="password"
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            required
            minLength={3}
            autoComplete="new-password"
            style={inputStyle}
          />
        </label>

        <button type="submit" disabled={loading} style={{ background: "#2563EB", color: "white", padding: "11px 14px", borderRadius: 9, border: "none", cursor: "pointer" }}>
          {loading ? "Сохраняем..." : "Сменить пароль"}
        </button>
      </form>

      <p style={{ margin: 0 }}>
        <Link to="/login">Вернуться ко входу</Link>
      </p>
    </div>
  );
}

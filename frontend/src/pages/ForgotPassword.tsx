import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../api/users";

const inputStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #E6EEF6",
  boxSizing: "border-box" as const,
};

export default function ForgotPassword() {
  const [loginValue, setLoginValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [debugLink, setDebugLink] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setDebugLink(null);

    try {
      const response = await requestPasswordReset(loginValue.trim());
      setMessage(response.detail);
      setDebugLink(response.debug_reset_link ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить ссылку для сброса пароля.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", display: "grid", gap: 16 }}>
      <div>
        <h2 style={{ margin: "0 0 8px" }}>Сброс пароля</h2>
        <p style={{ margin: 0, color: "#64748B" }}>
          Введите email или логин. Если такой пользователь существует, мы сформируем одноразовую ссылку для смены пароля.
        </p>
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

        {debugLink && (
          <div style={{ background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", borderRadius: 10, padding: 12, display: "grid", gap: 8 }}>
            <strong>Dev-ссылка для локальной демонстрации</strong>
            <span style={{ color: "#475569" }}>
              В production она отправляется на почту. Локально Django также выводит письмо в логи backend-контейнера.
            </span>
            <Link to={new URL(debugLink).pathname} style={{ overflowWrap: "anywhere" }}>
              Открыть страницу смены пароля
            </Link>
          </div>
        )}

        <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
          Email или логин
          <input
            value={loginValue}
            onChange={(event) => setLoginValue(event.target.value)}
            required
            autoComplete="username"
            placeholder="teacher или teacher@quizcraft.local"
            style={inputStyle}
          />
        </label>

        <button type="submit" disabled={loading} style={{ background: "#2563EB", color: "white", padding: "11px 14px", borderRadius: 9, border: "none", cursor: "pointer" }}>
          {loading ? "Отправляем..." : "Отправить ссылку для сброса"}
        </button>
      </form>

      <p style={{ margin: 0 }}>
        Вспомнили пароль? <Link to="/login">Вернуться ко входу</Link>
      </p>
    </div>
  );
}

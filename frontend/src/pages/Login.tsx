import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      setError(null);
      await login(loginValue, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto" }}>
      <h2>Вход в аккаунт</h2>

      <form
        onSubmit={onSubmit}
        autoComplete="off"
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        {/* Ловушки для браузерного автозаполнения */}
        <input
          type="text"
          name="fake-login"
          autoComplete="username"
          tabIndex={-1}
          aria-hidden="true"
          style={{
            position: "absolute",
            opacity: 0,
            height: 0,
            width: 0,
            pointerEvents: "none",
          }}
        />
        <input
          type="password"
          name="fake-password"
          autoComplete="current-password"
          tabIndex={-1}
          aria-hidden="true"
          style={{
            position: "absolute",
            opacity: 0,
            height: 0,
            width: 0,
            pointerEvents: "none",
          }}
        />

        {error && (
          <div
            style={{
              background: "#FEF2F2",
              color: "#B91C1C",
              border: "1px solid #FECACA",
              borderRadius: 8,
              padding: 10,
            }}
          >
            {error}
          </div>
        )}

        <label>
          Email или логин
          <input
            type="text"
            name="quizcraft-login-identifier"
            value={loginValue}
            onChange={(e) => setLoginValue(e.target.value)}
            required
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="admin или admin@quizcraft.local"
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 4,
              border: "1px solid #E6EEF6",
            }}
          />
        </label>

        <label>
          Пароль
          <input
            type="password"
            name="quizcraft-login-secret"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 4,
              border: "1px solid #E6EEF6",
            }}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            background: "#2563EB",
            color: "white",
            padding: "10px 12px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
          }}
        >
          {loading ? "Входим..." : "Войти"}
        </button>
      </form>

      <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
        <p style={{ margin: 0 }}>
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </p>
        <p style={{ margin: 0 }}>
          Забыли пароль? <Link to="/forgot-password">Сбросить пароль</Link>
        </p>
      </div>
    </div>
  );
}
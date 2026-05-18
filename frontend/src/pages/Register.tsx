import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuth();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      setError(null);
      await register(name.trim(), username.trim(), email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось зарегистрироваться.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto" }}>
      <h2>Создать аккаунт</h2>

      <form
        onSubmit={onSubmit}
        autoComplete="off"
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        {/* Ловушки для браузерного автозаполнения */}
        <input
          type="text"
          name="fake-register-login"
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
          name="fake-register-password"
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
          Имя
          <input
            type="text"
            name="quizcraft-register-display-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="off"
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

        <label>
          Логин
          <input
            type="text"
            name="quizcraft-register-username-custom"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Например: ivan"
            autoComplete="off"
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
          <span style={{ color: "#64748B", fontSize: 13 }}>
            Можно оставить пустым — логин будет создан из email.
          </span>
        </label>

        <label>
          Email
          <input
            type="email"
            name="quizcraft-register-email-custom"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="off"
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

        <label>
          Пароль
          <input
            type="password"
            name="quizcraft-register-secret"
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
            background: "#06B6D4",
            color: "white",
            padding: "10px 12px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
          }}
        >
          {loading ? "Создаём..." : "Зарегистрироваться"}
        </button>
      </form>

      <p style={{ marginTop: 12 }}>
        Уже есть аккаунт? <Link to="/login">Войти</Link>
      </p>
    </div>
  );
}
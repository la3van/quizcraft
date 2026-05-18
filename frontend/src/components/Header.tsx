import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type Props = {
  onToggleMenu?: () => void;
};

export default function Header({ onToggleMenu }: Props) {
  const { isLoggedIn, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <header
      style={{
        height: 64,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "0 16px",
        background: "white",
        boxShadow: "0 1px 4px rgba(2,6,23,0.06)",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <button
        aria-label="Toggle sidebar"
        onClick={onToggleMenu}
        style={{ fontSize: 20, padding: "6px 10px", borderRadius: 8, background: "#f0f0f0", border: "1px solid #ccc", cursor: "pointer" }}
      >
        ☰
      </button>

      <img
        src="/logo.jpg"
        alt="Логотип QuizCraft"
        style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", cursor: "default" }}
        onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
      />

      <strong style={{ cursor: "default" }}>QuizCraft</strong>

      <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
        {isLoggedIn ? (
          <>
            {user?.avatarUrl && <img src={user.avatarUrl} alt="Аватар" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />}
            <span>{user?.name}</span>
            <Link to="/profile" style={{ textDecoration: "none", color: "#2563EB" }}>
              Профиль
            </Link>
            <button
              onClick={handleLogout}
              style={{
                background: "#DC2626",
                color: "white",
                padding: "8px 12px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Выйти
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              style={{
                background: "#2563EB",
                color: "white",
                padding: "8px 12px",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              Войти
            </Link>
            <Link
              to="/register"
              style={{
                background: "#06B6D4",
                color: "white",
                padding: "8px 12px",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              Зарегистрироваться
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

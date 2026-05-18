import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function SideBar({ open, onClose }: Props) {
  const { isLoggedIn } = useAuth();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: open ? "rgba(0,0,0,0.35)" : "transparent",
          pointerEvents: open ? "auto" : "none",
          transition: "background 200ms",
          zIndex: 30,
        }}
      />

      <aside
        style={{
          position: "fixed",
          left: 0,
          top: 64,
          bottom: 0,
          width: 280,
          background: "#fff",
          boxShadow: "2px 0 8px rgba(0,0,0,0.08)",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 220ms",
          padding: 16,
          overflowY: "auto",
          zIndex: 35,
        }}
        aria-hidden={!open}
      >
        <nav>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {isLoggedIn && (
              <>
                <li>
                  <Link to="/dashboard" onClick={onClose} style={{ textDecoration: "none", color: "#0F172A", fontWeight: 500 }}>
                    Панель управления
                  </Link>
                </li>
                <li>
                  <Link to="/quizzes" onClick={onClose} style={{ textDecoration: "none", color: "#0F172A" }}>
                    Все квизы
                  </Link>
                </li>
                <li>
                  <Link to="/quizzes?owner=me" onClick={onClose} style={{ textDecoration: "none", color: "#0F172A" }}>
                    Мои квизы
                  </Link>
                </li>
                <li>
                  <Link to="/questions" onClick={onClose} style={{ textDecoration: "none", color: "#0F172A" }}>
                    Банк вопросов
                  </Link>
                </li>
                <li>
                  <Link to="/attempts" onClick={onClose} style={{ textDecoration: "none", color: "#0F172A" }}>
                    Мои попытки
                  </Link>
                </li>
                <li>
                  <Link to="/join" onClick={onClose} style={{ textDecoration: "none", color: "#0F172A" }}>
                    Войти по коду
                  </Link>
                </li>
                <li style={{ borderTop: "1px solid #E6EEF6", paddingTop: 12, marginTop: 12 }}>
                  <Link
                    to="/quizzes/create"
                    onClick={onClose}
                    style={{ textDecoration: "none", color: "white", background: "#06B6D4", padding: "8px 12px", borderRadius: 8, display: "block", textAlign: "center", fontWeight: 600 }}
                  >
                    ✎ Создать квиз
                  </Link>
                </li>
              </>
            )}
            {!isLoggedIn && (
              <>
                <li>
                  <Link to="/" onClick={onClose} style={{ textDecoration: "none", color: "#0F172A", fontWeight: 500 }}>
                    О проекте
                  </Link>
                </li>
                <li style={{ borderTop: "1px solid #E6EEF6", paddingTop: 12, marginTop: 12 }}>
                  <Link
                    to="/login"
                    onClick={onClose}
                    style={{ textDecoration: "none", color: "white", background: "#2563EB", padding: "8px 12px", borderRadius: 8, display: "block", textAlign: "center", fontWeight: 600 }}
                  >
                    Войти
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      </aside>
    </>
  );
}

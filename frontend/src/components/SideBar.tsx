import { useEffect } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type Props = {
  open: boolean;
  onClose: () => void;
};

type MenuLinkProps = {
  to: string;
  children: string;
  onClick: () => void;
  primary?: boolean;
};

function MenuLink({ to, children, onClick, primary = false }: MenuLinkProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      style={{
        textDecoration: "none",
        color: primary ? "white" : "#0F172A",
        background: primary ? "#06B6D4" : "#F8FAFC",
        border: primary ? "1px solid #06B6D4" : "1px solid #E6EEF6",
        padding: "9px 12px",
        borderRadius: 10,
        display: "block",
        fontWeight: 600,
      }}
    >
      {children}
    </Link>
  );
}

function MenuSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li style={{ display: "grid", gap: 8 }}>
      <div style={{ color: "#64748B", fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {title}
      </div>
      <div style={{ display: "grid", gap: 8, paddingLeft: 10, borderLeft: "2px solid #E6EEF6" }}>
        {children}
      </div>
    </li>
  );
}

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
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 16 }}>
            {isLoggedIn && (
              <>
                <MenuSection title="Общее">
                  <MenuLink to="/dashboard" onClick={onClose}>Панель управления</MenuLink>
                  <MenuLink to="/join" onClick={onClose}>Войти по коду</MenuLink>
                </MenuSection>

                <MenuSection title="Банк вопросов">
                  <MenuLink to="/questions" onClick={onClose}>Общий банк вопросов</MenuLink>
                </MenuSection>

                <MenuSection title="Квизы">
                  <MenuLink to="/quizzes" onClick={onClose}>Квизы</MenuLink>
                  <MenuLink to="/quiz-attempts" onClick={onClose}>Мои попытки по квизам</MenuLink>
                  <MenuLink to="/quizzes/create" onClick={onClose} primary>✎ Создать квиз</MenuLink>
                </MenuSection>

                <MenuSection title="Викторины">
                  <MenuLink to="/trivia" onClick={onClose}>Викторины</MenuLink>
                  <MenuLink to="/trivia-attempts" onClick={onClose}>Мои попытки по викторинам</MenuLink>
                  <MenuLink to="/trivia/create" onClick={onClose}>✎ Создать викторину</MenuLink>
                </MenuSection>
              </>
            )}
            {!isLoggedIn && (
              <>
                <MenuSection title="Навигация">
                  <MenuLink to="/" onClick={onClose}>О проекте</MenuLink>
                  <MenuLink to="/login" onClick={onClose} primary>Войти</MenuLink>
                </MenuSection>
              </>
            )}
          </ul>
        </nav>
      </aside>
    </>
  );
}

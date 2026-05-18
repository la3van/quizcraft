import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function NotFound() {
  const { isLoggedIn } = useAuth();
  const target = isLoggedIn ? "/dashboard" : "/";

  return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <h1>404</h1>
      <p>Страница не найдена</p>
      <Link to={target}>{isLoggedIn ? "Вернуться в панель управления" : "Вернуться на главную"}</Link>
    </div>
  );
}

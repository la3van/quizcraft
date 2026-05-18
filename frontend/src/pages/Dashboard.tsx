import { Link } from "react-router-dom";

export default function Dashboard() {
  return (
    <div style={{ minHeight: "calc(100vh - 88px)" }}>
      {/* Hero Section */}
      <section
        style={{
          background: "linear-gradient(135deg, #2563EB 0%, #06B6D4 100%)",
          color: "white",
          padding: "80px 40px",
          borderRadius: 16,
          textAlign: "center",
          marginBottom: 60,
        }}
      >
        <h1 style={{ fontSize: 48, fontWeight: 700, margin: "0 0 16px 0" }}>
          Добро пожаловать в QuizCraft!
        </h1>
        <p style={{ fontSize: 18, margin: "0 0 32px 0", maxWidth: 800, marginLeft: "auto", marginRight: "auto" }}>
          QuizCraft — это современная веб-платформа для создания и проведения викторин и тестов. 
          Платформа предназначена для преподавателей, тренеров и образовательных учреждений, 
          позволяя легко создавать интерактивные тесты с различными типами вопросов, 
          проводить их в режиме реального времени или как домашние задания, 
          автоматически оценивать ответы и анализировать результаты. 
          С QuizCraft вы можете управлять банком вопросов, настраивать таймеры, 
          обеспечивать безопасность прохождения и экспортировать отчёты для дальнейшего анализа.
        </p>
      </section>

      {/* Features Section */}
      <section style={{ marginBottom: 60 }}>
        <h2 style={{ textAlign: "center", marginBottom: 40, fontSize: 32 }}>Особенности</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          <div style={{ background: "white", padding: 24, borderRadius: 12, boxShadow: "0 2px 8px rgba(2,6,23,0.08)", textAlign: "center" }}>
            <h3 style={{ marginTop: 0, color: "#0F172A" }}>Конструктор квизов</h3>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#64748B", textAlign: "left" }}>
              <li>Типы заданий: одиночный/множественный выбор, соответствие и пр.</li>
              <li>Поддержка формул (LaTeX) и медиа-вложений</li>
              <li>Банк вопросов с тегами и целями</li>
            </ul>
          </div>

          <div style={{ background: "white", padding: 24, borderRadius: 12, boxShadow: "0 2px 8px rgba(2,6,23,0.08)", textAlign: "center" }}>
            <h3 style={{ marginTop: 0, color: "#0F172A" }}>Проведение</h3>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#64748B", textAlign: "left" }}>
              <li>Режимы Live и Домашняя работа, таймеры</li>
              <li>Рандомизация порядка вопросов/вариантов</li>
              <li>Настраиваемая политика обратной связи</li>
            </ul>
          </div>

          <div style={{ background: "white", padding: 24, borderRadius: 12, boxShadow: "0 2px 8px rgba(2,6,23,0.08)", textAlign: "center" }}>
            <h3 style={{ marginTop: 0, color: "#0F172A" }}>Оценивание и аналитика</h3>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#64748B", textAlign: "left" }}>
              <li>Автопроверка закрытых типов, ручная проверка открытых</li>
              <li>Отчёты по попыткам, тепловые карты ошибок</li>
              <li>Экспорт CSV/XLSX и PDF</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Action Section */}
      <section style={{ marginBottom: 60, textAlign: "center" }}>
        <h2 style={{ fontSize: 32, marginBottom: 40 }}>Начните прямо сейчас</h2>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            to="/quizzes"
            style={{
              background: "#2563EB",
              color: "white",
              padding: "12px 28px",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 16,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              transition: "background 0.3s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#1D4ED8")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#2563EB")}
          >
            Список квизов
          </Link>
          <Link
            to="/questions"
            style={{
              background: "white",
              color: "#0F172A",
              padding: "12px 28px",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 16,
              fontWeight: 600,
              border: "1px solid #E6EEF6",
              cursor: "pointer",
            }}
          >
            Банк вопросов
          </Link>
          <Link
            to="/quizzes/create"
            style={{
              background: "#06B6D4",
              color: "white",
              padding: "12px 28px",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 16,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              transition: "background 0.3s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#0891B2")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#06B6D4")}
          >
            Создать новый квиз
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ textAlign: "center", paddingTop: 40, borderTop: "1px solid #E6EEF6", color: "#64748B" }}>
        <h3 style={{ marginBottom: 20, fontSize: 24, color: "#0F172A" }}>Создатель сайта</h3>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <img
            src="/author.jpg"
            alt="Фото создателя"
            style={{ width: 100, height: 100, objectFit: "cover", borderRadius: "50%" }}
            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
          />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#0F172A" }}>Латышев Иван</div>
            <div style={{ opacity: 0.8, marginBottom: 8 }}>Студент НИУ ВШЭ</div>
            <div style={{ fontSize: 14 }}>
              <div>Telegram: @ivan_latysh</div>
              <div>Телефон: 89689580786</div>
              <div>Email: ivanlatysev2896@gmail.com</div>
            </div>
          </div>
        </div>
        <p>&copy; 2026 QuizCraft. Все права защищены.</p>
      </footer>
    </div>
  );
}

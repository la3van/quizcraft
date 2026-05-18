import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { changePassword, getProfileStats, updateProfile } from "../api/users";
import type { MonthlyProfileActivity, ProfileStats, YearlyProfileActivity } from "../api/types";
import { useAuth } from "../context/AuthContext";

const card = {
  background: "white",
  padding: 18,
  borderRadius: 14,
  boxShadow: "0 1px 8px rgba(2,6,23,0.07)",
};

const chartColors = {
  quizzes: "#2563EB",
  questions: "#06B6D4",
  passed: "#22C55E",
};

export default function Profile() {
  const { user, setAuthUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setUsername(user.username);
    setEmail(user.email);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getProfileStats();
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Не удалось загрузить статистику.");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxCreatedActivity = useMemo(() => {
    if (!stats) return 1;
    return Math.max(1, ...stats.activity.map((item) => item.created));
  }, [stats]);

  const maxPassedActivity = useMemo(() => {
    if (!stats) return 1;
    return Math.max(1, ...stats.activity.map((item) => item.passed));
  }, [stats]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      const formData = new FormData();
      formData.append("name", name);
      formData.append("username", username);
      formData.append("email", email);
      if (avatarFile) formData.append("avatar", avatarFile);
      const updated = await updateProfile(formData);
      setAuthUser(updated);
      setAvatarFile(null);
      setMessage("Профиль обновлён.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить профиль.");
    } finally {
      setLoading(false);
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      const result = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirm: newPasswordConfirm,
      });
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
      setMessage(result.detail || "Пароль изменён.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось изменить пароль.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gap: 18 }}>
      <div>
        <h2 style={{ marginBottom: 6 }}>Профиль</h2>
        <p style={{ margin: 0, color: "#64748B" }}>Управление аккаунтом, аватаром, паролем и статистикой по квизам.</p>
      </div>

      {message && <div style={{ background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0", borderRadius: 10, padding: 12 }}>{message}</div>}
      {error && <div style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", borderRadius: 10, padding: 12 }}>{error}</div>}

      <section style={{ display: "grid", gridTemplateColumns: "340px minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
        <div style={{ ...card, display: "grid", gap: 14, justifyItems: "center", textAlign: "center" }}>
          <div
            style={{
              width: 112,
              height: 112,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #2563EB, #06B6D4)",
              display: "grid",
              placeItems: "center",
              color: "white",
              overflow: "hidden",
              fontSize: 36,
              fontWeight: 800,
            }}
          >
            {user?.avatarUrl ? <img src={user.avatarUrl} alt="Аватар" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : user?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 22 }}>{user?.name}</div>
            <div style={{ color: "#64748B" }}>@{user?.username}</div>
            <div style={{ color: "#64748B" }}>{user?.email}</div>
          </div>
        </div>

        <form onSubmit={saveProfile} style={{ ...card, display: "grid", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Данные аккаунта</h3>
          <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
            Имя
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
              Логин
              <input value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
          </div>
          <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
            Аватар
            <input type="file" accept="image/*" onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)} />
          </label>
          <button type="submit" disabled={loading} style={{ justifySelf: "end", background: "#2563EB", color: "white" }}>
            {loading ? "Сохраняем..." : "Сохранить профиль"}
          </button>
        </form>
      </section>

      <section style={{ ...card, display: "grid", gap: 18 }}>
        <h3 style={{ margin: 0 }}>Статистика</h3>
        {stats ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <Metric title="Создано квизов" value={stats.created_quizzes} />
              <Metric title="Вопросов в банке" value={stats.created_questions} />
              <Metric title="Всего прохождений" value={stats.total_attempts} />
              <Metric title="Завершено" value={stats.completed_attempts} />
              <Metric title="Средний результат" value={`${stats.average_result}%`} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <Metric title="Квизов в месяц за последний год" value={stats.monthly_averages_last_12.quizzes} />
              <Metric title="Вопросов в месяц за последний год" value={stats.monthly_averages_last_12.questions} />
              <Metric title="Прохождений в месяц за последний год" value={stats.monthly_averages_last_12.passed} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <DailyChart
                title="Созданные квизы за 14 дней"
                color={chartColors.quizzes}
                maxValue={maxCreatedActivity}
                items={stats.activity.map((item) => ({ date: item.date, value: item.created }))}
              />
              <DailyChart
                title="Завершённые прохождения за 14 дней"
                color={chartColors.passed}
                maxValue={maxPassedActivity}
                items={stats.activity.map((item) => ({ date: item.date, value: item.passed }))}
              />
            </div>

            <MonthlyChart items={stats.monthly_activity} />
            <YearlyStats items={stats.yearly_activity} />
          </>
        ) : (
          <div>Загрузка статистики...</div>
        )}
      </section>

      <form onSubmit={savePassword} style={{ ...card, display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Изменение пароля</h3>
        <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
          Текущий пароль
          <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
            Новый пароль
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
          </label>
          <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
            Повтор нового пароля
            <input type="password" value={newPasswordConfirm} onChange={(event) => setNewPasswordConfirm(event.target.value)} required />
          </label>
        </div>
        <button type="submit" disabled={loading} style={{ justifySelf: "end", background: "#06B6D4", color: "white" }}>
          Изменить пароль
        </button>
      </form>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: number | string }) {
  return (
    <div style={{ border: "1px solid #E6EEF6", borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
      <div style={{ color: "#64748B" }}>{title}</div>
    </div>
  );
}

function DailyChart({ title, items, maxValue, color }: { title: string; items: Array<{ date: string; value: number }>; maxValue: number; color: string }) {
  return (
    <div style={{ border: "1px solid #E6EEF6", borderRadius: 12, padding: 14 }}>
      <h4 style={{ margin: "0 0 12px" }}>{title}</h4>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 8, alignItems: "end", minHeight: 150 }}>
        {items.map((item) => {
          const height = item.value ? Math.max(12, (item.value / maxValue) * 125) : 8;
          return (
            <div key={item.date} style={{ display: "grid", gap: 6, justifyItems: "center" }} title={`${item.date}: ${item.value}`}>
              <div style={{ height, width: "100%", maxWidth: 30, borderRadius: 8, background: color, opacity: item.value ? 1 : 0.22 }} />
              <div style={{ fontSize: 11, color: "#64748B", transform: "rotate(-35deg)", transformOrigin: "center" }}>{item.date.slice(5)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthlyChart({ items }: { items: MonthlyProfileActivity[] }) {
  const maxValue = Math.max(1, ...items.map((item) => item.quizzes + item.questions + item.passed));
  return (
    <div style={{ border: "1px solid #E6EEF6", borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <h4 style={{ margin: 0 }}>Активность по месяцам за последний год</h4>
        <Legend />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 10, alignItems: "end", minHeight: 210 }}>
        {items.map((item) => {
          const total = item.quizzes + item.questions + item.passed;
          const height = total ? Math.max(18, (total / maxValue) * 170) : 10;
          return (
            <div key={item.month} style={{ display: "grid", gap: 8, justifyItems: "center" }} title={`${item.month}: квизы ${item.quizzes}, вопросы ${item.questions}, прохождения ${item.passed}`}>
              <div style={{ height, width: "100%", maxWidth: 42, display: "flex", flexDirection: "column-reverse", borderRadius: 10, overflow: "hidden", background: "#E6EEF6", opacity: total ? 1 : 0.55 }}>
                <StackPart value={item.quizzes} total={total} color={chartColors.quizzes} />
                <StackPart value={item.questions} total={total} color={chartColors.questions} />
                <StackPart value={item.passed} total={total} color={chartColors.passed} />
              </div>
              <div style={{ fontSize: 11, color: "#64748B", transform: "rotate(-35deg)", transformOrigin: "center" }}>{item.month.slice(5)}</div>
            </div>
          );
        })}
      </div>
      <p style={{ margin: "10px 0 0", color: "#64748B", fontSize: 13 }}>Столбец показывает сумму действий за месяц, цветные части — вклад квизов, вопросов и завершённых прохождений.</p>
    </div>
  );
}

function YearlyStats({ items }: { items: YearlyProfileActivity[] }) {
  return (
    <div style={{ border: "1px solid #E6EEF6", borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <h4 style={{ margin: 0 }}>Сводка по годам</h4>
        <Legend />
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {items.map((item) => {
          const total = item.quizzes + item.questions + item.passed;
          return (
            <div key={item.year} style={{ border: "1px solid #EEF2F7", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong>{item.year}</strong>
                <span style={{ color: "#64748B" }}>Всего действий: {total}</span>
              </div>
              <div style={{ height: 18, borderRadius: 999, overflow: "hidden", display: "flex", background: "#E6EEF6" }}>
                <PercentPart percent={item.quiz_percent} color={chartColors.quizzes} />
                <PercentPart percent={item.question_percent} color={chartColors.questions} />
                <PercentPart percent={item.passed_percent} color={chartColors.passed} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, color: "#334155", fontSize: 13 }}>
                <span>Квизы: {item.quizzes} / {item.avg_quizzes_per_month} в мес.</span>
                <span>Вопросы: {item.questions} / {item.avg_questions_per_month} в мес.</span>
                <span>Прохождения: {item.passed} / {item.avg_passed_per_month} в мес.</span>
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ margin: "10px 0 0", color: "#64748B", fontSize: 13 }}>Для текущего года среднее считается по уже прошедшим месяцам года, для прошлых лет — по 12 месяцам.</p>
    </div>
  );
}

function StackPart({ value, total, color }: { value: number; total: number; color: string }) {
  if (!value || !total) return null;
  return <div style={{ height: `${Math.max(7, (value / total) * 100)}%`, background: color }} />;
}

function PercentPart({ percent, color }: { percent: number; color: string }) {
  if (percent <= 0) return null;
  return <div style={{ width: `${percent}%`, background: color }} title={`${percent}%`} />;
}

function Legend() {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", color: "#64748B", fontSize: 13 }}>
      <LegendItem color={chartColors.quizzes} title="Квизы" />
      <LegendItem color={chartColors.questions} title="Вопросы" />
      <LegendItem color={chartColors.passed} title="Прохождения" />
    </div>
  );
}

function LegendItem({ color, title }: { color: string; title: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
      {title}
    </span>
  );
}

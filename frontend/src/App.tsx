import { useState } from "react";
import type { ReactElement } from "react";
import { Navigate, Routes, Route } from "react-router-dom";
import SideBar from "./components/SideBar";
import Header from "./components/Header";
import { useAuth } from "./context/AuthContext";

import HomePage from "./pages/HomePage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import QuizzesList from "./pages/QuizzesList";
import QuizAnalytics from "./pages/QuizAnalytics";
import QuizPage from "./pages/QuizPage";
import QuizResult from "./pages/QuizResult";
import JoinQuiz from "./pages/JoinQuiz";
import AttemptsPage from "./pages/AttemptsPage";
import CreateEditQuiz from "./pages/CreateEditQuiz";
import QuestionBank from "./pages/QuestionBank";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

function HomeRoute() {
  const { isLoggedIn, isAuthChecked } = useAuth();

  if (!isAuthChecked) return <div>Загрузка...</div>;
  return isLoggedIn ? <Navigate to="/dashboard" replace /> : <HomePage />;
}

function PrivateRoute({ children }: { children: ReactElement }) {
  const { isLoggedIn, isAuthChecked } = useAuth();

  if (!isAuthChecked) return <div>Загрузка...</div>;
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }: { children: ReactElement }) {
  const { isLoggedIn, isAuthChecked } = useAuth();

  if (!isAuthChecked) return <div>Загрузка...</div>;
  return isLoggedIn ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", color: "#0F172A", display: "flex", flexDirection: "column" }}>
      <SideBar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Header onToggleMenu={() => setSidebarOpen((s) => !s)} />

      <main style={{ flex: 1, width: "100%", boxSizing: "border-box", padding: "24px 16px", overflow: "auto" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
          <Routes>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/home" element={<HomeRoute />} />
            <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
            <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
            <Route path="/reset-password/:uid/:token" element={<GuestRoute><ResetPassword /></GuestRoute>} />
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/quizzes" element={<PrivateRoute><QuizzesList /></PrivateRoute>} />
            <Route path="/quizzes/create" element={<PrivateRoute><CreateEditQuiz /></PrivateRoute>} />
            <Route path="/quizzes/:id/edit" element={<PrivateRoute><CreateEditQuiz /></PrivateRoute>} />
            <Route path="/quizzes/:id/analytics" element={<PrivateRoute><QuizAnalytics /></PrivateRoute>} />
            <Route path="/questions" element={<PrivateRoute><QuestionBank /></PrivateRoute>} />
            <Route path="/join" element={<PrivateRoute><JoinQuiz /></PrivateRoute>} />
            <Route path="/join/:code" element={<PrivateRoute><JoinQuiz /></PrivateRoute>} />
            <Route path="/quizzes/:id" element={<PrivateRoute><QuizPage /></PrivateRoute>} />
            <Route path="/attempts/:attemptId/result" element={<PrivateRoute><QuizResult /></PrivateRoute>} />
            <Route path="/attempts" element={<PrivateRoute><AttemptsPage /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./app/providers/AuthProvider";
import { QuestionsProvider } from "./app/providers/QuestionsProvider";
import { NotificationsProvider } from "./app/providers/NotificationsProvider";
import { ReputationProvider } from "./app/providers/ReputationProvider";
import { UserDataProvider } from "./app/providers/UserDataProvider";
import { ReportsProvider } from "./app/providers/ReportsProvider";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { PublicOnlyRoute } from "./routes/PublicOnlyRoute";
import { PrivateLayout } from "./layouts/PrivateLayout";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { WelcomePage } from "./pages/WelcomePage";
import { HomePage } from "./pages/HomePage";
import { ExplorePage } from "./pages/ExplorePage";
import { AskPage } from "./pages/AskPage";
import { QuestionDetailPage } from "./pages/QuestionDetailPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AdminPage } from "./pages/AdminPage";
import { HelpPage } from "./pages/HelpPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { AdminRoute } from "./routes/AdminRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
      <ReputationProvider>
        <UserDataProvider>
          <ReportsProvider>
            <QuestionsProvider>
              <NotificationsProvider>
          <Routes>
            {/* Públicas */}
            <Route path="/" element={<LandingPage />} />
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route path="/welcome" element={<WelcomePage />} />
            </Route>

            {/* Privadas */}
            <Route element={<ProtectedRoute />}>
              <Route element={<PrivateLayout />}>
                <Route path="/home" element={<HomePage />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/ask" element={<AskPage />} />
                <Route path="/question/:id" element={<QuestionDetailPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/help" element={<HelpPage />} />
              </Route>
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<AdminPage />} />
              </Route>
            </Route>

            <Route path="/404" element={<NotFoundPage />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
              </NotificationsProvider>
            </QuestionsProvider>
          </ReportsProvider>
        </UserDataProvider>
      </ReputationProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}

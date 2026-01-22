import { useEffect } from "react";
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
import { PublicProfilePage } from "./pages/PublicProfilePage";
import { AdminPage } from "./pages/AdminPage";
import { HelpPage } from "./pages/HelpPage";
import { SavedQuestionsPage } from "./pages/SavedQuestionsPage";
import { FollowedQuestionsPage } from "./pages/FollowedQuestionsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { AdminRoute } from "./routes/AdminRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initializeFirestore } from "./firebase/initFirestore";

export default function App() {
  useEffect(() => {
    initializeFirestore().catch((error) => {
      console.error("Error inicializando Firestore:", error);
    });
  }, []);

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

                    {/* ✅ Detalle de pregunta PUBLICO (para evitar "no encontrada" por auth/refresh) */}
                    <Route path="/question/:id" element={<QuestionDetailPage />} />
                    {/* ✅ Perfil público (accesible sin autenticación) */}
                    <Route path="/profile/:userId" element={<PublicProfilePage />} />

                    <Route element={<PublicOnlyRoute />}>
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/register" element={<RegisterPage />} />
                    </Route>

                    <Route element={<ProtectedRoute />}>
                      <Route path="/welcome" element={<WelcomePage />} />

                      {/* Privadas */}
                      <Route element={<PrivateLayout />}>
                        <Route path="/home" element={<HomePage />} />
                        <Route path="/explore" element={<ExplorePage />} />
                        <Route path="/ask" element={<AskPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/saved" element={<SavedQuestionsPage />} />
                        <Route path="/followed" element={<FollowedQuestionsPage />} />
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

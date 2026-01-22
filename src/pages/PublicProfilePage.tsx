import { useEffect, useState } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { collection, getDocs, orderBy, query, where, doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase/firebase";
import type { PublicProfile } from "../services/publicProfiles/PublicProfilesRepository";

function tsToIso(v: any): string {
  if (v?.toDate) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}

export function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Array<{ id: string; title: string; createdAt: string }>>([]);

  // ✅ Obtener questionId del estado de navegación si viene de una pregunta
  const fromQuestionId = (location.state as any)?.fromQuestionId;

  // ✅ SINGLE SOURCE OF TRUTH: Leer directamente de users/{userId} con onSnapshot
  useEffect(() => {
    if (!userId) {
      setError("ID de usuario inválido");
      setLoading(false);
      return;
    }

    const userRef = doc(db, "users", userId);
    
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setError("Este usuario no existe");
          setLoading(false);
          setProfile(null);
          return;
        }

        const data = snapshot.data();
        
        // ✅ Proyección de users/{userId} a PublicProfile
        const publicProfile: PublicProfile = {
          uid: userId,
          displayName: data.name || data.displayName || "Usuario",
          photoURL: auth.currentUser?.photoURL || undefined,
          level: data.level ?? 1,
          rank: data.rank ?? "Novato",
          xp: data.xp ?? 0,
          questionsCount: data.questionsCount ?? 0,
          answersCount: data.answersCount ?? 0,
          avgRating: data.avgRating ?? 0,
          createdAt: data.createdAt ? tsToIso(data.createdAt) : new Date().toISOString(),
          updatedAt: data.updatedAt ? tsToIso(data.updatedAt) : new Date().toISOString(),
        };

        setProfile(publicProfile);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error(`[PublicProfilePage] Error en onSnapshot de users/${userId}:`, error);
        setError("Error al cargar el perfil");
        setLoading(false);
        setProfile(null);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [userId]);

  // ✅ Cargar preguntas del usuario
  useEffect(() => {
    if (!userId) return;

    (async () => {
      try {
        const questionsRef = collection(db, "questions");
        let snap;

        try {
          snap = await getDocs(query(questionsRef, where("authorId", "==", userId), orderBy("createdAt", "desc")));
        } catch (e) {
          // fallback por índices/ordenamiento
          snap = await getDocs(query(questionsRef, where("authorId", "==", userId)));
        }

        const qs = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: data?.title || "Sin título",
            createdAt: tsToIso(data?.createdAt),
          };
        });

        qs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        setQuestions(qs);
      } catch (qError: any) {
        console.warn(`[PublicProfilePage] No se pudieron cargar preguntas: ${qError?.message || qError}`);
      }
    })();
  }, [userId]);

  if (loading) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
        <div style={{ padding: "40px", background: "#f9f9f9", borderRadius: "8px", textAlign: "center" }}>
          <p style={{ fontSize: "18px", color: "#666" }}>Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
        <div style={{ padding: "40px", background: "#f9f9f9", borderRadius: "8px", textAlign: "center" }}>
          <p style={{ fontSize: "18px", color: "#666" }}>{error || "Este usuario aún no tiene perfil público"}</p>
          <Link
            to="/home"
            style={{
              display: "inline-block",
              marginTop: "20px",
              padding: "10px 20px",
              background: "#007bff",
              color: "white",
              textDecoration: "none",
              borderRadius: "6px"
            }}
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  // ✅ Función para manejar el botón "Volver"
  const handleBack = () => {
    if (fromQuestionId) {
      navigate(`/question/${fromQuestionId}`);
    } else {
      navigate("/home");
    }
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
      <button
        onClick={handleBack}
        style={{
          display: "inline-block",
          marginBottom: "20px",
          background: "none",
          border: "none",
          color: "#007bff",
          textDecoration: "none",
          fontSize: "14px",
          fontWeight: "500",
          cursor: "pointer",
          padding: 0
        }}
        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
      >
        ← Volver
      </button>

      <div style={{ padding: "24px", background: "#f9f9f9", borderRadius: "8px", marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "20px", alignItems: "center", marginBottom: "20px" }}>
          {profile.photoURL ? (
            <img
              src={profile.photoURL}
              alt={profile.displayName}
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                objectFit: "cover"
              }}
            />
          ) : (
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                background: "#007bff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "32px",
                fontWeight: "bold"
              }}
            >
              {profile.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "bold" }}>{profile.displayName}</h1>
            <p style={{ margin: "8px 0 0 0", fontSize: "16px", color: "#666" }}>
              Nivel {profile.level} · {profile.rank}
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "20px" }}>
          <div style={{ padding: "16px", background: "#fff", borderRadius: "8px", border: "1px solid #ddd" }}>
            <div style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>XP</div>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#007bff" }}>{profile.xp}</div>
          </div>
          <div style={{ padding: "16px", background: "#fff", borderRadius: "8px", border: "1px solid #ddd" }}>
            <div style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>Preguntas</div>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#28a745" }}>{profile.questionsCount}</div>
          </div>
          <div style={{ padding: "16px", background: "#fff", borderRadius: "8px", border: "1px solid #ddd" }}>
            <div style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>Respuestas</div>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#ffc107" }}>{profile.answersCount}</div>
          </div>
          <div style={{ padding: "16px", background: "#fff", borderRadius: "8px", border: "1px solid #ddd" }}>
            <div style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>Calificación promedio</div>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#dc3545" }}>
              {profile.avgRating > 0 ? profile.avgRating.toFixed(1) : "N/A"}
            </div>
          </div>
        </div>
      </div>

      {questions.length > 0 && (
        <div style={{ padding: "24px", background: "#f9f9f9", borderRadius: "8px" }}>
          <h2 style={{ marginTop: 0, marginBottom: "20px", fontSize: "22px", fontWeight: "bold" }}>
            Preguntas ({questions.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {questions.map((q) => (
              <Link
                key={q.id}
                to={`/question/${q.id}`}
                style={{
                  display: "block",
                  padding: "16px",
                  background: "#fff",
                  borderRadius: "8px",
                  border: "1px solid #ddd",
                  textDecoration: "none",
                  color: "inherit",
                  transition: "border-color 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#007bff";
                  e.currentTarget.style.cursor = "pointer";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#ddd";
                }}
              >
                <h3 style={{ margin: 0, marginBottom: "8px", fontSize: "18px", fontWeight: "bold", color: "#333" }}>
                  {q.title}
                </h3>
                <p style={{ margin: 0, fontSize: "12px", color: "#999" }}>
                  {new Date(q.createdAt).toLocaleDateString("es-CO", {
                    day: "numeric",
                    month: "short",
                    year: "numeric"
                  })}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

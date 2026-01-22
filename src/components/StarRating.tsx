import { useState, useEffect } from "react";

type StarRatingProps = {
  value: number; // 0-5 (0 = no calificado)
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: "small" | "medium" | "large";
  showAverage?: boolean;
  average?: number;
  count?: number;
  showUserRating?: boolean; // Si true, muestra "Tu calificación" separado del promedio
  onSave?: () => void; // Callback cuando se guarda la calificación
};

export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = "medium",
  showAverage = false,
  average = 0,
  count = 0,
  showUserRating = false
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0);
  const [displayValue, setDisplayValue] = useState(value);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDisplayValue(value);
    setSaved(false);
  }, [value]);

  const sizeStyles = {
    small: { fontSize: "16px", gap: "4px" },
    medium: { fontSize: "24px", gap: "6px" },
    large: { fontSize: "32px", gap: "8px" }
  };

  const currentStyle = sizeStyles[size];

  const handleClick = (starValue: number) => {
    if (readOnly || !onChange) return;
    setDisplayValue(starValue);
    setSaved(false);
    onChange(starValue);
  };

  const handleMouseEnter = (starValue: number) => {
    if (readOnly) return;
    setHoverValue(starValue);
  };

  const handleMouseLeave = () => {
    if (readOnly) return;
    setHoverValue(0);
  };

  // Valor efectivo para mostrar: hover > display > average (si readOnly)
  const effectiveValue = hoverValue > 0 
    ? hoverValue 
    : displayValue > 0
      ? displayValue
      : (readOnly && showAverage && average > 0 ? average : 0);

  const renderStars = (val: number, interactive: boolean = true) => {
    return (
      <div
        style={{
          display: "flex",
          gap: currentStyle.gap,
          alignItems: "center",
          cursor: interactive && !readOnly ? "pointer" : "default",
          position: "relative"
        }}
        onMouseLeave={interactive ? handleMouseLeave : undefined}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const isFull = star <= Math.floor(val);
          const isPartial = !isFull && star === Math.ceil(val) && val % 1 > 0;
          const fillPercent = isPartial ? (val % 1) * 100 : isFull ? 100 : 0;
          
          return (
            <span
              key={star}
              onClick={interactive ? () => handleClick(star) : undefined}
              onMouseEnter={interactive ? () => handleMouseEnter(star) : undefined}
              style={{
                fontSize: currentStyle.fontSize,
                color: fillPercent > 0 ? "#ffc107" : "#ddd",
                transition: "color 0.2s",
                userSelect: "none",
                position: "relative",
                display: "inline-block"
              }}
            >
              <span style={{ opacity: fillPercent > 0 && fillPercent < 100 ? fillPercent / 100 : 1 }}>
                ★
              </span>
              {isPartial && (
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: `${fillPercent}%`,
                    overflow: "hidden",
                    color: "#ffc107"
                  }}
                >
                  ★
                </span>
              )}
            </span>
          );
        })}
      </div>
    );
  };

  // Si showUserRating es true, mostrar promedio y tu calificación separados
  if (showUserRating) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Rating promedio */}
        {showAverage && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "14px", fontWeight: "500", color: "#333" }}>Calificación promedio:</span>
            {renderStars(average, false)}
            <span style={{ fontSize: "14px", fontWeight: "bold", color: "#333" }}>
              {average > 0 ? average.toFixed(1) : "0.0"}
            </span>
            <span style={{ fontSize: "14px", color: "#999" }}>
              ({count} {count === 1 ? "voto" : "votos"})
            </span>
          </div>
        )}

        {/* Tu calificación */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "14px", fontWeight: "500", color: "#333" }}>Tu calificación:</span>
          {renderStars(effectiveValue, true)}
          {saved && (
            <span style={{ fontSize: "14px", color: "#28a745", fontWeight: "500" }}>
              ✓ Calificación guardada
            </span>
          )}
        </div>
      </div>
    );
  }

  // Modo normal: mostrar estrellas con promedio opcional
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
      {renderStars(effectiveValue, !readOnly)}
      
      {showAverage && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#666" }}>
          <span style={{ fontWeight: "bold", color: "#333" }}>
            {average > 0 ? average.toFixed(1) : "0.0"}
          </span>
          <span style={{ color: "#999" }}>
            ({count} {count === 1 ? "voto" : "votos"})
          </span>
        </div>
      )}
    </div>
  );
}

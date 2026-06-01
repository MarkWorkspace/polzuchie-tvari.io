import React from "react";

interface Skin {
  id: string;
  name: string;
  bg: string;
}

interface LoginScreenProps {
  nickname: string;
  setNickname: (name: string) => void;
  onJoin: () => void;
  selectedSkin: string;
  setSelectedSkin: (skinId: string) => void;
  skins: Skin[];
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  nickname,
  setNickname,
  onJoin,
  selectedSkin,
  setSelectedSkin,
  skins,
}) => {
  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      justifyContent: "center",
      width: "100%",
      maxWidth: "380px",
      padding: "32px 28px",
      background: "rgba(20, 22, 28, 0.75)", 
      border: "1px solid rgba(255, 255, 255, 0.08)", 
      borderRadius: "24px", 
      boxShadow: "0 16px 48px rgba(0, 0, 0, 0.5)",
      backdropFilter: "blur(16px)"
    }}>
      {/* Title */}
      <h1 style={{ 
        fontSize: "30px", 
        fontWeight: 900,
        margin: "0 0 24px 0", 
        background: "linear-gradient(135deg, #fafafa 30%, #a1a1aa 100%)", 
        WebkitBackgroundClip: "text", 
        WebkitTextFillColor: "transparent",
        textAlign: "center"
      }}>
        Polzuchie-tvari.io
      </h1>

      {/* Skin Selection Section */}
      <div style={{ width: "100%", marginBottom: "24px", textAlign: "center" }}>
        <h3 style={{ 
          fontSize: "13px", 
          fontWeight: 700, 
          color: "rgba(255, 255, 255, 0.7)", 
          marginBottom: "12px"
        }}>
          Выберите скин
        </h3>
        <div style={{ 
          display: "flex", 
          gap: "8px", 
          flexWrap: "wrap", 
          justifyContent: "center",
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          borderRadius: "16px",
          padding: "12px"
        }}>
          {skins.map((skin) => {
            const isSelected = selectedSkin === skin.id;
            return (
              <button
                key={skin.id}
                onClick={() => setSelectedSkin(skin.id)}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: skin.bg,
                  cursor: "pointer",
                  border: isSelected ? "2px solid #ffffff" : "2px solid rgba(255, 255, 255, 0.15)",
                  boxShadow: isSelected ? "0 0 12px rgba(255, 255, 255, 0.4)" : "none",
                  transform: isSelected ? "scale(1.1)" : "scale(1)",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                }}
                title={skin.name}
              />
            );
          })}
        </div>
      </div>

      {/* Input */}
      <div style={{ width: "100%", marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Ваш никнейм"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onJoin()}
          style={{ 
            width: "100%",
            padding: "12px 16px", 
            fontSize: "14px", 
            fontWeight: 500,
            borderRadius: "12px", 
            border: "1px solid rgba(255, 255, 255, 0.12)", 
            background: "rgba(0, 0, 0, 0.2)", 
            color: "#fafafa",
            textAlign: "center",
            outline: "none",
            transition: "all 0.2s ease"
          }}
          maxLength={12}
          autoFocus
        />
      </div>

      {/* Play Button */}
      <button
        onClick={onJoin}
        style={{ 
          width: "100%",
          padding: "14px 30px", 
          fontSize: "15px", 
          fontWeight: 700,
          cursor: "pointer", 
          borderRadius: "12px", 
          background: "linear-gradient(135deg, #e63946 0%, #c1121f 100%)", 
          border: "none", 
          color: "#ffffff",
          boxShadow: "0 4px 15px rgba(230, 57, 70, 0.35)",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
        }}
      >
        Играть
      </button>
    </div>
  );
};
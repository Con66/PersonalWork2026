// Add useState to the import
import { useState } from "react";

const SUITS = {
  hearts:   { symbol: "♥", color: "#cc0000" },
  diamonds: { symbol: "♦", color: "#cc0000" },
  clubs:    { symbol: "♣", color: "#1a1a1a" },
  spades:   { symbol: "♠", color: "#1a1a1a" },
};

const LABELS = {
  1: "A", 11: "J", 12: "Q", 13: "K",
};

// selected prop is removed — hover replaces it visually.
// We'll re-add selected later for the "card you've committed to playing" highlight.
function Card({ suit, value, onClick, faceDown = false }) {

  // hovered lives inside the card — the parent doesn't need to know
  const [hovered, setHovered] = useState(false);

  const { symbol, color } = SUITS[suit];
  const label = LABELS[value] || value;

  const cardStyle = {
    width: "70px",
    height: "100px",
    borderRadius: "8px",
    border: "1px solid #999",
    backgroundColor: "white",
    cursor: onClick ? "pointer" : "default",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "4px",
    userSelect: "none",
    overflow: "hidden",
    position: "relative",
    boxShadow: hovered
      ? "0 0 0 3px gold"
      : "2px 2px 4px rgba(0,0,0,0.3)",
    transform: hovered ? "translateY(-12px)" : "translateY(0)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  };

  const cornerStyle = {
    color,
    fontSize: "14px",
    fontWeight: "bold",
    lineHeight: 1,
    alignSelf: "flex-start",
    textAlign: "left",
  };

  const centerStyle = {
    color,
    fontSize: "28px",
    textAlign: "center",
  };

  if (faceDown) {
    return (
      <div style={cardStyle}>
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "#2c5f8a",
          backgroundImage: "repeating-linear-gradient(45deg, #1e4d73 0px, #1e4d73 2px, transparent 2px, transparent 10px)",
        }} />
      </div>
    );
  }

  return (
    <div
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={cornerStyle}>
        <div>{label}</div>
        <div>{symbol}</div>
      </div>
      <div style={centerStyle}>{symbol}</div>
      <div style={{ ...cornerStyle, alignSelf: "flex-end", transform: "rotate(180deg)" }}>
        <div>{label}</div>
        <div>{symbol}</div>
      </div>
    </div>
  );
}

export default Card;
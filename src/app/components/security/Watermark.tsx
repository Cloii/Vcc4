import React from "react";
import { useAuth } from "../../context/AuthContext";

export const Watermark: React.FC = () => {
  const { user } = useAuth();
  if (!user) return null;

  const text = `${user.email} | University of Bohol`;
  const items = Array.from({ length: 40 }, (_, i) => i);

  return (
    <div
      className="fixed inset-0 pointer-events-none select-none overflow-hidden"
      style={{ zIndex: 9998 }}
      aria-hidden="true"
    >
      {items.map((i) => (
        <div
          key={i}
          className="absolute text-gray-400 font-medium whitespace-nowrap"
          style={{
            fontSize: "12px",
            opacity: 0.07,
            top: `${(i % 8) * 13 + 5}%`,
            left: `${Math.floor(i / 8) * 25 - 10}%`,
            transform: "rotate(-30deg)",
            letterSpacing: "0.05em",
          }}
        >
          {text}
        </div>
      ))}
    </div>
  );
};

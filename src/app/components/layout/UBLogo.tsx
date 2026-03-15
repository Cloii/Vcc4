import React from "react";

interface UBLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  variant?: "light" | "dark";
}

export const UBLogo: React.FC<UBLogoProps> = ({ size = "md", showText = true, variant = "light" }) => {
  const sizes = {
    sm: { badge: 36, font: "text-xs", nameFont: "text-sm" },
    md: { badge: 48, font: "text-sm", nameFont: "text-base" },
    lg: { badge: 72, font: "text-lg", nameFont: "text-xl" },
  };
  const s = sizes[size];

  return (
    <div className="flex items-center gap-2">
      {/* Shield/Badge Logo */}
      <svg width={s.badge} height={s.badge} viewBox="0 0 72 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Shield shape */}
        <path d="M36 2 L68 14 L68 42 Q68 62 36 78 Q4 62 4 42 L4 14 Z" fill="#1D4ED8" />
        <path d="M36 7 L63 17.5 L63 41 Q63 59 36 73 Q9 59 9 41 L9 17.5 Z" fill="#2563EB" />
        {/* Yellow banner */}
        <path d="M12 32 L60 32 L60 48 L12 48 Z" fill="#F59E0B" />
        {/* UB Text */}
        <text x="36" y="44.5" textAnchor="middle" fill="#1D4ED8" fontSize="13" fontWeight="900" fontFamily="Arial,sans-serif">UB</text>
        {/* Stars top */}
        <text x="20" y="26" textAnchor="middle" fill="#F59E0B" fontSize="9">★</text>
        <text x="36" y="23" textAnchor="middle" fill="#F59E0B" fontSize="9">★</text>
        <text x="52" y="26" textAnchor="middle" fill="#F59E0B" fontSize="9">★</text>
        {/* Bottom text in shield */}
        <text x="36" y="62" textAnchor="middle" fill="#FDE68A" fontSize="6" fontFamily="Arial,sans-serif" letterSpacing="0.5">BOHOL</text>
      </svg>

      {showText && (
        <div className="flex flex-col leading-tight">
          <span className={`font-black tracking-wide ${s.nameFont} ${variant === "light" ? "text-white" : "text-blue-800"}`}>
            University of Bohol
          </span>
          <span className={`${s.font} font-medium ${variant === "light" ? "text-yellow-300" : "text-yellow-600"}`}>
            Virtual Campus Companion
          </span>
        </div>
      )}
    </div>
  );
};

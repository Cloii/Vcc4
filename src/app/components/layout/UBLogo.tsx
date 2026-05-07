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
      <img
        src="/logo.png"
        alt="UB Logo"
        width={s.badge}
        height={s.badge}
        className="object-contain"
      />

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

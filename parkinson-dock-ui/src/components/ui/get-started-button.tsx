import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

export interface GetStartedButtonProps {
  children?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  color?: "blue" | "green" | "purple" | "orange" | "red";
}

export function GetStartedButton({
  children = "Get Started",
  onClick,
  disabled,
  className,
  size = "lg",
  variant = "default",
  color,
  ...props
}: GetStartedButtonProps) {
  // 根據顏色主題生成樣式
  const getColorClasses = () => {
    if (color) {
      switch (color) {
        case "blue":
          return "bg-blue-600 hover:bg-blue-700 text-white";
        case "green":
          return "bg-green-600 hover:bg-green-700 text-white";
        case "purple":
          return "bg-purple-600 hover:bg-purple-700 text-white";
        case "orange":
          return "bg-orange-600 hover:bg-orange-700 text-white";
        case "red":
          return "bg-red-600 hover:bg-red-700 text-white";
        default:
          return "";
      }
    }
    return "";
  };

  const colorClasses = getColorClasses();
  const finalClassName = colorClasses
    ? `group relative overflow-hidden ${colorClasses} ${className || ""}`.replace(/bg-\w+-\d+|hover:bg-\w+-\d+/g, "").trim() + ` ${colorClasses}`
    : `group relative overflow-hidden ${className || ""}`;

  return (
    <Button
      className={finalClassName}
      size={size}
      variant={variant}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      <span className="mr-8 transition-opacity duration-500 group-hover:opacity-0">
        {children}
      </span>
      <i className="absolute right-1 top-1 bottom-1 rounded-sm z-10 grid w-1/4 place-items-center transition-all duration-500 bg-white/15 group-hover:w-[calc(100%-0.5rem)] group-active:scale-95 text-white">
        <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
      </i>
    </Button>
  );
}

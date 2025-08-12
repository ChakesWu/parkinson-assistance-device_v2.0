"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface HeroSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  topHref?: string;
  subtitle?: {
    regular: string;
    gradient: string;
  };
  description?: string;
  ctaText?: string;
  ctaHref?: string;
  /**
   * Optional URL (relative to Next.js `public/`) for the hero background image.
   * Example: "/images/hero-medical.jpg"
   */
  backgroundImageUrl?: string;
  bottomImage?: {
    light: string;
    dark: string;
  };
  bottomComponent?: React.ReactNode;
  gridOptions?: {
    angle?: number;
    cellSize?: number;
    opacity?: number;
    lightLineColor?: string;
    darkLineColor?: string;
  };
}

interface RetroGridProps {
  angle?: number;
  cellSize?: number;
  opacity?: number;
  lightLineColor?: string;
  darkLineColor?: string;
}

const RetroGrid: React.FC<RetroGridProps> = ({
  angle = 65,
  cellSize = 60,
  opacity = 0.5,
  lightLineColor = "gray",
  darkLineColor = "gray",
}) => {
  const gridStyles = {
    "--grid-angle": `${angle}deg`,
    "--cell-size": `${cellSize}px`,
    "--opacity": opacity,
    "--light-line": lightLineColor,
    "--dark-line": darkLineColor,
  } as React.CSSProperties;

  return (
    <div
      className={cn(
        "pointer-events-none absolute size-full overflow-hidden [perspective:200px]",
        `opacity-[var(--opacity)]`,
      )}
      style={gridStyles}
    >
      <div className="absolute inset-0 [transform:rotateX(var(--grid-angle))]">
        <div className="animate-grid [background-image:linear-gradient(to_right,var(--light-line)_1px,transparent_0),linear-gradient(to_bottom,var(--light-line)_1px,transparent_0)] [background-repeat:repeat] [background-size:var(--cell-size)_var(--cell-size)] [height:300vh] [inset:0%_0px] [margin-left:-200%] [transform-origin:100%_0_0] [width:600vw] dark:[background-image:linear-gradient(to_right,var(--dark-line)_1px,transparent_0),linear-gradient(to_bottom,var(--dark-line)_1px,transparent_0)]" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent to-90% dark:from-black" />
      <style jsx global>{`
        @keyframes grid {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(calc(-1 * var(--cell-size)));
          }
        }
        .animate-grid {
          animation: grid 20s linear infinite;
        }
      `}</style>
    </div>
  );
};

const HeroSection = React.forwardRef<HTMLDivElement, HeroSectionProps>(
  (
    {
      className,
      title = "Build products for everyone",
      topHref,
      subtitle = {
        regular: "Designing your projects faster with ",
        gradient: "the largest figma UI kit.",
      },
      description = "Sed ut perspiciatis unde omnis iste natus voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae.",
      ctaText = "Browse courses",
      ctaHref = "#",
      backgroundImageUrl = "/images/hero-medical.jpg",
      bottomImage,
      bottomComponent,
      gridOptions,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        className={cn(
          "relative min-w-[1280px] min-h-[720px] w-screen h-screen",
          className,
        )}
        ref={ref}
        {...props}
      >
        {/* Background image */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div
            className="absolute inset-0 bg-center bg-cover"
            style={{ backgroundImage: `url(${backgroundImageUrl})` }}
            aria-hidden="true"
          />
          {/* Bottom blue gradient overlay to top */}
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(30,64,175,0.70)] from-5% to-transparent to-60%" aria-hidden="true" />
          {/* Soft white fade at the very bottom to blend into page background */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 md:h-40 bg-gradient-to-b from-transparent via-white/70 to-white" aria-hidden="true" />
        </div>

        {/* Top-left tiny label removed as requested */}

        {/* Content grid: center-right focus */}
        <section className="relative size-full grid grid-cols-[1fr_minmax(640px,52%)] items-center gap-[2vw] px-[clamp(32px,4.5vw,96px)] py-[clamp(32px,4.5vw,96px)]">
          <div />
          <div className="flex flex-col items-start justify-center -translate-y-[1%] md:-translate-y-[2%] pr-6">
            {/* Headline two lines, extra bold, tight line-height */}
            <h2
              className="m-0 mb-5 font-black tracking-tight text-[#0B0B0B] break-words max-w-full"
              style={{
                fontSize: "clamp(60px, 4.2vw, 80px)",
                lineHeight: 1.25,
                fontFamily: "'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Source Han Sans SC','Noto Sans CJK SC','WenQuanYi Micro Hei',sans-serif",
                textShadow: "0 4px 8px rgba(0,0,0,0.10)",
              }}
            >
              {(() => {
                const full = `${subtitle?.regular ?? ""}${subtitle?.gradient ?? ""}`.trim();
                const lines = full.includes("\n") ? full.split("\n") : [full];
                return (
                  <>
                    {lines.map((line, idx) => (
                      <span
                        key={idx}
                        className={cn("block text-left whitespace-nowrap")}
                      >
                        {line}
                      </span>
                    ))}
                  </>
                );
              })()}
            </h2>

            {/* CTA and subcaption */}
            <div className="flex flex-col items-start gap-3">
              <a
                href={ctaHref}
                className="inline-flex items-center gap-3 px-[clamp(36px,2.2vw,44px)] py-[clamp(18px,1.1vw,22px)] rounded-full bg-[#1E40AF] text-white font-extrabold text-[clamp(22px,1.2vw,24px)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.05),0_6px_16px_rgba(30,64,175,0.35)] transition-colors duration-200 hover:bg-[#1A3A9E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B82F6]/40"
                aria-label={ctaText}
              >
                <span>{ctaText}</span>
                {/* Inline arrow icon */}
                <svg viewBox="0 0 24 24" aria-hidden="true" className="w-[1.15em] h-[1.15em]">
                  <path d="M5 12h12" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  <path d="M13 6l6 6-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <p className="m-0 ml-3 text-[clamp(16px,1vw,18px)] text-[#6B7280] leading-snug">智能康复训练系统</p>
            </div>
          </div>
        </section>

        {/* Bottom navigation overlay removed as requested */}

        {/* Lower preview area removed per request */}
      </div>
    );
  },
);
HeroSection.displayName = "HeroSection";

export default HeroSection;
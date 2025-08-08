import { HeroSection } from "@/components/ui/hero-section-dark";

export function HeroSectionDemo() {
  return (
    <HeroSection
      title="帕金森輔助裝置控制中心"
      subtitle={{
        regular: "即時監控與分析您的 ",
        gradient: "健康數據",
      }}
      description="先進的AI技術幫助您監測震顫症狀，提供個性化建議，改善生活品質。"
      ctaText="開始使用"
      ctaHref="/dashboard"
      bottomImage={{
        light: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&q=80",
        dark: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&q=80",
      }}
      gridOptions={{
        angle: 65,
        opacity: 0.4,
        cellSize: 50,
        lightLineColor: "#4a4a4a",
        darkLineColor: "#2a2a2a",
      }}
    />
  );
}
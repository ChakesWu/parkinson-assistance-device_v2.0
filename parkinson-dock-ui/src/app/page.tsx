import { FooterDemo } from "@/components/ui/footer-demo";
import HeroSection from "@/components/ui/hero-section";
import { AnimatedDock } from "@/components/ui/animated-dock";
import AnimatedCardDemo from "@/components/ui/animated-card-demo";
import ParkinsonTestimonials from "@/components/ui/parkinson-testimonials";
import { Home, Activity, Book, Settings, Brain } from 'lucide-react';

export default function HomePage() {
  const dockItems = [
    {
      link: "/",
      Icon: <Home size={22} />,
    },
    {
      link: "/device",
      Icon: <Activity size={22} />,
    },
    {
      link: "/records",
      Icon: <Book size={22} />,
    },
    {
      link: "/ai-analysis",
      Icon: <Brain size={22} />,
    },
    {
      link: "/settings",
      Icon: <Settings size={22} />,
    }
  ];

  return (
    <div className="relative">
      <div className="min-h-screen">
        <HeroSection
          title="欢迎使用帕金森辅助系统"
          subtitle={{
            regular: "",
            gradient: "基于LSTM和CNN的混合模型的帕金森手部训练设计",
          }}
          description="利用我们全面的开发工具和资源，帮助您更好地管理和治疗帕金森病。"
          ctaText="开始使用"
          ctaHref="/device"
          bottomComponent={<AnimatedCardDemo />}
          gridOptions={{
            angle: 65,
            opacity: 0.4,
            cellSize: 60,
            lightLineColor: "#4a4a4a",
            darkLineColor: "#2a2a2a",
          }}
        />
        
        {/* 使用新的动画 Dock */}
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <AnimatedDock items={dockItems} />
        </div>
      </div>

      {/* 患者見證欄位 */}
      <ParkinsonTestimonials />

      {/* Footer */}
      <FooterDemo />
    </div>
  );
}

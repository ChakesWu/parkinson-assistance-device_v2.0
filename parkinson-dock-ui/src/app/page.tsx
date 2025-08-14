import { FooterDemo } from "@/components/ui/footer-demo";
import HeroSection from "@/components/ui/hero-section";
import HeroSectionOld from "@/components/ui/hero-section-old";
import { AnimatedDock } from "@/components/ui/animated-dock";
import AnimatedCardDemo from "@/components/ui/animated-card-demo";
import ParkinsonTestimonials from "@/components/ui/parkinson-testimonials";
import SimpleLightweightIndicator from "@/components/device/SimpleLightweightIndicator";
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
      {/* 轻量级连接状态指示器 */}
      <div className="fixed top-4 right-4 z-50 bg-white dark:bg-neutral-800 rounded-lg p-3 shadow-lg">
        <SimpleLightweightIndicator />
      </div>

      <div className="min-h-screen">
        <HeroSection
          title=""
          topHref="/about"
          subtitle={{
            regular: "基于LSTM和CNN的\n混合模型的帕金森手部\n训练设计",
            gradient: "",
          }}
          description=""
          ctaText="开始使用"
          ctaHref="/device"
          backgroundImageUrl="/ai_model/Replicate-Web-Page.png"
          gridOptions={{ angle: 65, opacity: 0.0, cellSize: 60 }}
          className=""
        />


        {/* 年度帕金森趋势分析（上移与蓝色区域轻微重合，不遮挡患者心声） */}
        <section className="relative z-10 -mt-16 md:-mt-24 max-w-[80vw] mx-auto px-6 md:px-10 pb-12 md:pb-16">
          {/* 动态树状图（使用 AnimatedCardDemo，不遮挡患者心声） */}
          <div className="w-full flex items-center justify-center">
            <AnimatedCardDemo />
          </div>
        </section>
        
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

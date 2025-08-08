import { Footer } from "./footer";
import { Github, Twitter, Linkedin } from "lucide-react";

export function FooterDemo() {
  return (
    <div className="w-full">
      <Footer
        logo={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 11a9 9 0 0 1 9 9" />
            <path d="M4 4a16 16 0 0 1 16 16" />
            <circle cx="5" cy="19" r="1" />
          </svg>
        }
        brandName="ParkinsonAssist"
        socialLinks={[
          {
            icon: <Github className="h-5 w-5" />,
            href: "https://github.com",
            label: "GitHub",
          },
          {
            icon: <Twitter className="h-5 w-5" />,
            href: "https://twitter.com",
            label: "Twitter",
          },
          {
            icon: <Linkedin className="h-5 w-5" />,
            href: "https://linkedin.com",
            label: "LinkedIn",
          },
        ]}
        mainLinks={[
          { href: "#", label: "首页" },
          { href: "#", label: "设备连接" },
          { href: "#", label: "记录分析" },
          { href: "#", label: "AI分析" },
          { href: "#", label: "3D手部模型" },
          { href: "#", label: "设置" },
        ]}
        legalLinks={[
          { href: "#", label: "隐私政策" },
          { href: "#", label: "服务条款" },
          { href: "#", label: "使用协议" },
        ]}
        copyright={{
          text: "© 2025 ParkinsonAssist. 保留所有权利。",
        }}
      />
    </div>
  );
}
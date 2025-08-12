import { Github, Twitter, Youtube, Flower } from 'lucide-react';
import { AnimatedDock } from "@/components/ui/animated-dock";

export const DockDemo = () => {
  return (
    <AnimatedDock
      items={[
        {
          link: "https://github.com/ChakesWu",
          target: "_blank",
          Icon: <Github size={22} />,
        },
        {
          link: "https://x.com",
          target: "_blank",
          Icon: <Twitter size={22} />,
        },
        {
          link: "https://www.youtube.com",
          target: "_blank",
          Icon: <Youtube size={22} />,
        },
        {
          link: "https://github.com/ChakesWu",
          target: "_blank",
          Icon: <Flower size={22} />,
        },
      ]}
    />
  );
};
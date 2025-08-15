"use client";
import { TestimonialsColumn } from "@/components/ui/testimonials-columns-1";
import { motion } from "motion/react";

const testimonials = [
  {
    text: "未来如果能用上这个系统，那么我们能更好地了解他的病情变化。每天的数据记录也会让我们安心，也让医生能给出更精准的治疗建议。",
    image: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face",
    name: "Sarah Johnson",
    role: "患者家屬",
  },
  {
    text: "我希望有一天能重新拿起画笔，画出美丽的风景。这个系统让我看到了感觉离梦想更近一步。",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
    name: "Michael Thompson",
    role: "帕金森患者",
  },
  {
    text: "妈妈最大的愿望就是能再次为我们包饺子。看到她每天坚持训练，我们全家都很感动。这个系统给了我们全家希望。",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
    name: "Emily Rodriguez",
    role: "患者女儿",
  },
  {
    text: "我梦想着能再次和老伴一起跳舞，就像年轻时那样。每天的康复训练让我相信，这个梦想不再遥远。",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
    name: "David Anderson",
    role: "帕金森患者",
  },
  {
    text: "看到爸爸的手部功能在慢慢改善，我们全家都很欣慰。这个系统不仅帮助了爸爸，也让我们学会了如何更好地照顾他。",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face",
    name: "Jessica Williams",
    role: "患者家属",
  },
  {
    text: "我最想做的就是能够自己写字，给孙子写一封信。虽然现在还有困难，但我相信通过持续的训练，一定能实现这个愿望。",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face",
    name: "Robert Miller",
    role: "帕金森患者",
  },
  {
    text: "这个系统让我们能够24小时关注妈妈的状况，即使我们不在身边也能安心。科技真的改变了我们的生活。",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face",
    name: "Nanse Brown",
    role: "患者女儿 ",
  },
  {
    text: "我希望能重新拿起针线，为家人缝制衣服。每一次的训练都让我感到手指更加灵活，我相信这个梦想会实现。",
    image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop&crop=face",
    name: "Grace Davis",
    role: "帕金森患者",
  },
  {
    text: "爷爷说他想再次下棋，和老朋友们一起度过美好时光。看到他每天努力训练，我们都被他的坚强感动。",
    image: "https://images.unsplash.com/photo-1507101105822-7472b28e22ac?w=150&h=150&fit=crop&crop=face",
    name: "Alex Martinez",
    role: "患者孙子",
  },
];

const firstColumn = testimonials.slice(0, 3);
const secondColumn = testimonials.slice(3, 6);
const thirdColumn = testimonials.slice(6, 9);

const ParkinsonTestimonials = () => {
  return (
    <section className="bg-background my-20 relative">
      <div className="container z-10 mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="flex flex-col items-center justify-center max-w-[540px] mx-auto"
        >
          <div className="flex justify-center">
            <div className="border py-1 px-4 rounded-lg text-sm bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
              患者心声
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tighter mt-5 text-center">
            希望與愛的見證
          </h2>
          <p className="text-center mt-5 opacity-75 text-gray-600 dark:text-gray-300">
            來自帕金森患者和家屬的真實心聲，每一個故事都充滿希望與勇氣
          </p>
        </motion.div>

        <div className="flex justify-center gap-6 mt-10 [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)] max-h-[740px] overflow-hidden">
          <TestimonialsColumn testimonials={firstColumn} duration={15} />
          <TestimonialsColumn testimonials={secondColumn} className="hidden md:block" duration={19} />
          <TestimonialsColumn testimonials={thirdColumn} className="hidden lg:block" duration={17} />
        </div>
      </div>
    </section>
  );
};

export default ParkinsonTestimonials;

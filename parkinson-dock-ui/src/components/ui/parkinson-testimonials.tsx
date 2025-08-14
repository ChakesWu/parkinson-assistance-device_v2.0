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
    text: "我希望有一天能重新拿起畫筆，畫出美麗的風景。這個系統讓我看到了感覺離夢想更近一步。",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
    name: "Michael Thompson",
    role: "帕金森患者",
  },
  {
    text: "媽媽最大的願望就是能再次為我們包餃子。看到她每天堅持訓練，我們全家都很感動。這個系統給了我們全家希望。",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
    name: "Emily Rodriguez",
    role: "患者女兒",
  },
  {
    text: "我夢想著能再次和老伴一起跳舞，就像年輕時那樣。每天的康復訓練讓我相信，這個夢想不再遙遠。",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
    name: "David Anderson",
    role: "帕金森患者",
  },
  {
    text: "看到爸爸的手部功能在慢慢改善，我們全家都很欣慰。這個系統不僅幫助了爸爸，也讓我們學會了如何更好地照顧他。",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face",
    name: "Jessica Williams",
    role: "患者家屬",
  },
  {
    text: "我最想做的就是能夠自己寫字，給孫子寫一封信。雖然現在還有困難，但我相信通過持續的訓練，一定能實現這個願望。",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face",
    name: "Robert Miller",
    role: "帕金森患者",
  },
  {
    text: "這個系統讓我們能夠24小時關注媽媽的狀況，即使我們不在身邊也能安心。科技真的改變了我們的生活。",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face",
    name: "Nanse Brown",
    role: "患者女兒 ",
  },
  {
    text: "我希望能重新拿起針線，為家人縫製衣服。每一次的訓練都讓我感到手指更加靈活，我相信這個夢想會實現。",
    image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop&crop=face",
    name: "Grace Davis",
    role: "帕金森患者",
  },
  {
    text: "爺爺說他想再次下棋，和老朋友們一起度過美好時光。看到他每天努力訓練，我們都被他的堅強感動。",
    image: "https://images.unsplash.com/photo-1507101105822-7472b28e22ac?w=150&h=150&fit=crop&crop=face",
    name: "Alex Martinez",
    role: "患者孫子",
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
              患者心聲
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

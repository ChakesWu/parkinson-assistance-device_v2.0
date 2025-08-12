import {
  AnimatedCard,
  CardBody,
  CardDescription,
  CardTitle,
  CardVisual,
  Visual1,
} from "@/components/ui/animated-card";

export default function AnimatedCardDemo() {
  return (
    <div className="flex justify-center items-center w-full">
      <AnimatedCard className="w-[550px] scale-125">
        <CardVisual className="h-[280px] w-[550px]">
          <Visual1 mainColor="#6366f1" secondaryColor="#f59e0b" />
        </CardVisual>
        <CardBody>
          <CardTitle>今年关于帕金森患者的数据</CardTitle>
          <CardDescription>
            展示帕金森患者与年轻化趋势的相关统计信息
          </CardDescription>
        </CardBody>
      </AnimatedCard>
    </div>
  );
}

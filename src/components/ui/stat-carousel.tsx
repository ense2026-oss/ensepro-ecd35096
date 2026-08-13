import React from "react";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { useIsMobile } from "@/hooks/use-mobile";

interface StatCarouselProps {
  children: React.ReactNode;
  /** grid classes used on desktop */
  className?: string;
  /** width of each card on mobile */
  basis?: string;
}

/** Mobile: horizontal swipeable cards (Dashboard style). Desktop: grid. */
const StatCarousel = ({
  children,
  className = "grid grid-cols-2 lg:grid-cols-4 gap-4",
  basis = "basis-[70%]",
}: StatCarouselProps) => {
  const isMobile = useIsMobile();
  const items = React.Children.toArray(children);

  if (!isMobile) {
    return <div className={className}>{children}</div>;
  }

  return (
    <Carousel opts={{ align: "start", dragFree: true }} className="-mx-4 px-4">
      <CarouselContent className="-ml-3">
        {items.map((child, i) => (
          <CarouselItem key={i} className={`pl-3 ${basis}`}>
            {child}
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
};

export default StatCarousel;
export { StatCarousel };

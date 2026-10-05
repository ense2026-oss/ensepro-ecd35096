import React from "react";

interface StatCarouselProps {
  children: React.ReactNode;
  /** grid classes (applies on every breakpoint; base is 2 columns on mobile) */
  className?: string;
  /** deprecated — kept for backward compatibility, no longer used */
  basis?: string;
}

/**
 * Responsive stat-card grid.
 *
 * Previously this rendered a horizontal swipeable carousel on mobile (one card
 * at a time). Per request the mobile layout now shows 2 cards per row like the
 * dashboard — so we always render the grid, whose base `grid-cols-2` gives two
 * boxes per row on phones and the wider columns on desktop.
 */
const StatCarousel = ({
  children,
  className = "grid grid-cols-2 lg:grid-cols-4 gap-4",
}: StatCarouselProps) => {
  return <div className={className}>{children}</div>;
};

export default StatCarousel;
export { StatCarousel };

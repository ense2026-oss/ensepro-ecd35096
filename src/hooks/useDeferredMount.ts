import { useEffect, useState } from "react";

// Returns false on the first paint and true one frame later. Used to keep a
// route change instant: the page shell (title, filters, sidebar highlight)
// commits immediately, and an expensive block — e.g. the employees × days
// calendar grid — renders on the next frame instead of blocking the
// navigation itself. Measured on the shift/OT/day-off calendars the grid
// alone cost 650–850 ms of main-thread time per navigation.
export function useDeferredMount(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);
  return ready;
}

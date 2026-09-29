import { useEffect, useState } from "react";
import { useLoadProgress } from "@/lib/loadProgress";
import { FullScreenLoader } from "@/components/ui/dots-loader";

// Mounted once in App: shows the centered dots preloader whenever any page's
// initial data load is in flight, with a percentage driven by how many of the
// current episode's queries have finished. The displayed number eases toward the
// real value (never backwards) and always lands on 100% before disappearing.
export function GlobalLoader() {
  const { loading, percent } = useLoadProgress();
  const [shown, setShown] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (loading) {
      setVisible(true);
      const t = setInterval(() => {
        setShown((p) => {
          const target = Math.max(8, Math.min(95, percent));
          const next = p + Math.max(0.4, (target - p) * 0.18);
          return Math.min(next, target > p ? target : Math.min(95, p + 0.4));
        });
      }, 80);
      return () => clearInterval(t);
    }
    if (visible) {
      setShown(100);
      const t = setTimeout(() => {
        setVisible(false);
        setShown(0);
      }, 260);
      return () => clearTimeout(t);
    }
  }, [loading, percent, visible]);

  if (!visible) return null;
  return <FullScreenLoader percent={shown} label="กำลังโหลดข้อมูล..." />;
}

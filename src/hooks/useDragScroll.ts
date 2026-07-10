import { useCallback, useEffect, useRef } from "react";

/**
 * Enables drag-to-scroll (horizontal + vertical) on a scrollable container.
 * - Touch: relies on native momentum scrolling (works out of the box).
 * - Mouse/pointer: click-and-drag to pan the content in any direction.
 *
 * Attach the returned ref to the element that has `overflow-auto`.
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const state = useRef({
    down: false,
    dragging: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  const onPointerDown = useCallback((e: PointerEvent) => {
    // Only handle mouse / pen. Touch keeps native scrolling.
    if (e.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    state.current.down = true;
    state.current.dragging = false;
    state.current.startX = e.clientX;
    state.current.startY = e.clientY;
    state.current.scrollLeft = el.scrollLeft;
    state.current.scrollTop = el.scrollTop;
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const el = ref.current;
    if (!el || !state.current.down) return;
    const dx = e.clientX - state.current.startX;
    const dy = e.clientY - state.current.startY;
    if (!state.current.dragging && Math.hypot(dx, dy) < 4) return;
    if (!state.current.dragging) {
      state.current.dragging = true;
      el.setPointerCapture?.(e.pointerId);
      el.style.cursor = "grabbing";
      el.style.userSelect = "none";
    }
    e.preventDefault();
    el.scrollLeft = state.current.scrollLeft - dx;
    el.scrollTop = state.current.scrollTop - dy;
  }, []);

  const endDrag = useCallback((e?: PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    if (e && state.current.dragging) {
      el.releasePointerCapture?.(e.pointerId);
    }
    state.current.down = false;
    state.current.dragging = false;
    el.style.cursor = "";
    el.style.userSelect = "";
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointerleave", endDrag);
    el.addEventListener("pointercancel", endDrag);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointerleave", endDrag);
      el.removeEventListener("pointercancel", endDrag);
    };
  }, [onPointerDown, onPointerMove, endDrag]);

  return ref;
}

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Enables drag-to-scroll (horizontal + vertical) on a scrollable container.
 * - Mouse/pen: click-and-drag to pan the content in any direction.
 * - Touch: explicit finger-drag panning so swiping always works, even when
 *   native momentum scrolling is blocked by parent elements or touch-action.
 *
 * Attach the returned callback ref to the element that has `overflow-auto`.
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [node, setNode] = useState<T | null>(null);
  const state = useRef({
    down: false,
    dragging: false,
    blockClick: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  const setScrollRef = useCallback((el: T | null) => {
    ref.current = el;
    setNode(el);
  }, []);

  // ---- Pointer (mouse / pen) ----
  const onPointerDown = useCallback((e: PointerEvent) => {
    if (e.pointerType === "touch") return; // touch handled separately
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
    state.current.blockClick = true;
    e.preventDefault();
    el.scrollLeft = state.current.scrollLeft - dx;
    el.scrollTop = state.current.scrollTop - dy;
  }, []);

  const endPointer = useCallback((e?: PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    if (e && state.current.dragging) el.releasePointerCapture?.(e.pointerId);
    state.current.down = false;
    state.current.dragging = false;
    el.style.cursor = "";
    el.style.userSelect = "";
  }, []);

  // ---- Touch ----
  const onTouchStart = useCallback((e: TouchEvent) => {
    const el = ref.current;
    if (!el || e.touches.length !== 1) return;
    const t = e.touches[0];
    state.current.down = true;
    state.current.dragging = false;
    state.current.startX = t.clientX;
    state.current.startY = t.clientY;
    state.current.scrollLeft = el.scrollLeft;
    state.current.scrollTop = el.scrollTop;
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    const el = ref.current;
    if (!el || !state.current.down || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - state.current.startX;
    const dy = t.clientY - state.current.startY;
    if (!state.current.dragging && Math.hypot(dx, dy) < 6) return;
    state.current.dragging = true;
    state.current.blockClick = true;
    // Prevent the page from scrolling / rubber-banding while we pan the grid.
    if (e.cancelable) e.preventDefault();
    el.scrollLeft = state.current.scrollLeft - dx;
    el.scrollTop = state.current.scrollTop - dy;
  }, []);

  const endTouch = useCallback(() => {
    state.current.down = false;
    state.current.dragging = false;
  }, []);

  const onClickCapture = useCallback((e: MouseEvent) => {
    if (!state.current.blockClick) return;
    state.current.blockClick = false;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  useEffect(() => {
    const el = node;
    if (!el) return;
    el.style.touchAction = "none";
    el.style.setProperty("-webkit-overflow-scrolling", "touch");
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endPointer);
    el.addEventListener("pointerleave", endPointer);
    el.addEventListener("pointercancel", endPointer);

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", endTouch);
    el.addEventListener("touchcancel", endTouch);
    el.addEventListener("click", onClickCapture, true);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endPointer);
      el.removeEventListener("pointerleave", endPointer);
      el.removeEventListener("pointercancel", endPointer);

      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", endTouch);
      el.removeEventListener("touchcancel", endTouch);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, [node, onPointerDown, onPointerMove, endPointer, onTouchStart, onTouchMove, endTouch, onClickCapture]);

  return setScrollRef;
}

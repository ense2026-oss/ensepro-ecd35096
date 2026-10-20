import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Enables drag-to-scroll (horizontal + vertical) with the mouse/pen on a scrollable container.
 * Touch is deliberately NOT handled here: native finger scrolling (momentum, flick, diagonal,
 * chaining to the page at the edges) is far smoother than any JS emulation, so we leave
 * touch-action at its default and only add desktop click-and-drag panning.
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
    if (e.pointerType === "touch") return; // นิ้วใช้การเลื่อนของเบราว์เซอร์เอง
    const el = ref.current;
    if (!el) return;
    state.current.blockClick = false;
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

  const onClickCapture = useCallback((e: MouseEvent) => {
    if (!state.current.blockClick) return;
    state.current.blockClick = false;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  useEffect(() => {
    const el = node;
    if (!el) return;
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endPointer);
    el.addEventListener("pointerleave", endPointer);
    el.addEventListener("pointercancel", endPointer);

    el.addEventListener("click", onClickCapture, true);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endPointer);
      el.removeEventListener("pointerleave", endPointer);
      el.removeEventListener("pointercancel", endPointer);

      el.removeEventListener("click", onClickCapture, true);
    };
  }, [node, onPointerDown, onPointerMove, endPointer, onClickCapture]);

  return setScrollRef;
}

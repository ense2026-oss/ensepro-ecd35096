import { useSyncExternalStore } from "react";

// Tiny global store that page queries report into so one centered preloader
// can show real progress: "loading" while any initial page load is in flight,
// and a percentage = queries finished / queries started in the current
// loading episode. An episode starts when the first load begins and ends when
// the last one finishes, so the number always climbs to 100% before hiding.

type State = { active: number; total: number; done: number };

let state: State = { active: 0, total: 0, done: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function beginLoad() {
  if (state.active === 0) state = { active: 0, total: 0, done: 0 }; // new episode
  state = { ...state, active: state.active + 1, total: state.total + 1 };
  emit();
}

export function endLoad() {
  if (state.active === 0) return;
  state = { ...state, active: state.active - 1, done: state.done + 1 };
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => state;

export function useLoadProgress() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const loading = s.active > 0;
  const percent = s.total === 0 ? 0 : (s.done / s.total) * 100;
  return { loading, percent, total: s.total, done: s.done };
}

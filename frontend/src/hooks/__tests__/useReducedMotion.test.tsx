import { renderHook, act } from '@testing-library/react';
import { useReducedMotion } from '../useReducedMotion';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

type MediaQueryCallback = (event: MediaQueryListEvent) => void;

function makeMockMql(matches: boolean) {
  const listeners: MediaQueryCallback[] = [];
  return {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: vi.fn((_: string, cb: MediaQueryCallback) => { listeners.push(cb); }),
    removeEventListener: vi.fn((_: string, cb: MediaQueryCallback) => {
      const idx = listeners.indexOf(cb);
      if (idx !== -1) listeners.splice(idx, 1);
    }),
    dispatchEvent: vi.fn(),
    /** Test helper — fire a change event to all registered listeners. */
    _fire(nextMatches: boolean) {
      listeners.forEach((cb) => cb({ matches: nextMatches } as MediaQueryListEvent));
    },
    _listenerCount() {
      return listeners.length;
    },
  };
}

describe('useReducedMotion', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      value: originalMatchMedia,
      writable: true,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  // ── initial state ────────────────────────────────────────────────────────

  it('returns false when prefers-reduced-motion is not set', () => {
    const mql = makeMockMql(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when prefers-reduced-motion: reduce is active', () => {
    const mql = makeMockMql(true);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  // ── live updates ─────────────────────────────────────────────────────────

  it('updates when the media query changes to reduced', () => {
    const mql = makeMockMql(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => { mql._fire(true); });
    expect(result.current).toBe(true);
  });

  it('updates when the media query changes back to no preference', () => {
    const mql = makeMockMql(true);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);

    act(() => { mql._fire(false); });
    expect(result.current).toBe(false);
  });

  it('handles multiple rapid change events and settles on the last value', () => {
    const mql = makeMockMql(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { result } = renderHook(() => useReducedMotion());

    act(() => {
      mql._fire(true);
      mql._fire(false);
      mql._fire(true);
    });
    expect(result.current).toBe(true);
  });

  // ── listener lifecycle ───────────────────────────────────────────────────

  it('removes the event listener on unmount', () => {
    const mql = makeMockMql(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { unmount } = renderHook(() => useReducedMotion());
    unmount();

    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('registers addEventListener with the "change" event name', () => {
    const mql = makeMockMql(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    renderHook(() => useReducedMotion());

    expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    const [eventName] = mql.addEventListener.mock.calls[0];
    expect(eventName).toBe('change');
  });

  it('passes the same function reference to addEventListener and removeEventListener', () => {
    const mql = makeMockMql(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { unmount } = renderHook(() => useReducedMotion());
    unmount();

    const addedFn = mql.addEventListener.mock.calls[0][1];
    const removedFn = mql.removeEventListener.mock.calls[0][1];
    expect(addedFn).toBe(removedFn);
  });

  it('does not add extra listeners on re-renders with the same props', () => {
    const mql = makeMockMql(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { rerender } = renderHook(() => useReducedMotion());

    rerender();
    rerender();

    // useEffect with [] deps runs only once — one listener total
    expect(mql.addEventListener).toHaveBeenCalledTimes(1);
  });

  it('no change events are delivered after unmount', () => {
    const mql = makeMockMql(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { result, unmount } = renderHook(() => useReducedMotion());
    unmount();

    // firing after unmount should not update state (listener was removed)
    act(() => { mql._fire(true); });
    expect(result.current).toBe(false);
  });

  // ── two independent instances ─────────────────────────────────────────────

  it('two hook instances maintain independent state', () => {
    const mqlA = makeMockMql(false);
    const mqlB = makeMockMql(true);

    // Mount A with its own mql, then swap before mounting B so each instance
    // gets a stable mql for both its state-init call and its effect call.
    window.matchMedia = vi.fn().mockReturnValue(mqlA);
    const { result: resultA } = renderHook(() => useReducedMotion());

    window.matchMedia = vi.fn().mockReturnValue(mqlB);
    const { result: resultB } = renderHook(() => useReducedMotion());

    expect(resultA.current).toBe(false);
    expect(resultB.current).toBe(true);

    // Firing A's mql should update A but leave B unchanged.
    act(() => { mqlA._fire(true); });
    expect(resultA.current).toBe(true);
    expect(resultB.current).toBe(true);
  });

  // ── SSR / matchMedia unavailable ─────────────────────────────────────────

  it('uses the provided defaultValue when matchMedia is unavailable', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useReducedMotion(true));
    expect(result.current).toBe(true);
  });

  it('defaults to false when matchMedia is unavailable and no defaultValue given', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('falls back to defaultValue when matchMedia is defined but not callable', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: { matches: true },  // object, not a function
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useReducedMotion(true));
    expect(result.current).toBe(true);
  });

  it('falls back gracefully when matchMedia is null', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: null,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useReducedMotion(false));
    expect(result.current).toBe(false);
  });

  // ── defaultValue behaviour ────────────────────────────────────────────────

  it('ignores changes to defaultValue after initial render (lazy init)', () => {
    // defaultValue only sets the initial state; re-renders with a different
    // defaultValue should not override the live media query result.
    const mql = makeMockMql(true);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { result, rerender } = renderHook(
      ({ dv }) => useReducedMotion(dv),
      { initialProps: { dv: false } },
    );

    expect(result.current).toBe(true); // matchMedia wins

    rerender({ dv: true });
    expect(result.current).toBe(true); // still driven by matchMedia, not dv
  });
});

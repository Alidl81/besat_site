import { useRef, useState, type MouseEventHandler, type PointerEventHandler } from "react";

type HorizontalCarouselGestureOptions = {
  onPrevious: () => void;
  onNext: () => void;
  threshold?: number;
};

type HorizontalCarouselGestureHandlers = {
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  onPointerCancel: PointerEventHandler<HTMLDivElement>;
  onPointerLeave: PointerEventHandler<HTMLDivElement>;
  onClickCapture: MouseEventHandler<HTMLDivElement>;
};

/**
 * Shared horizontal interaction used by the home unit coverflow and the
 * compact Contact unit carousel. It follows the established Home behavior:
 * a 50px RTL swipe threshold, no pointer capture, and click suppression only
 * after a meaningful drag. Keeping the gesture boundary here prevents links
 * and phone actions inside a card from becoming collateral drag targets.
 */
export function useHorizontalCarouselGesture({
  onPrevious,
  onNext,
  threshold = 50,
}: HorizontalCarouselGestureOptions): {
  dragOffset: number;
  handlers: HorizontalCarouselGestureHandlers;
} {
  const [dragOffset, setDragOffset] = useState(0);
  const pointerRef = useRef<{ id: number; startX: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);

  function start(event: { pointerId: number; pointerType: string; button: number; clientX: number }) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointerRef.current = { id: event.pointerId, startX: event.clientX, moved: false };
  }

  function move(event: { pointerId: number; clientX: number; preventDefault: () => void }) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;

    const offset = event.clientX - pointer.startX;
    if (Math.abs(offset) <= threshold) return;

    pointer.moved = true;
    event.preventDefault();
    setDragOffset(offset);
  }

  function end(event: { pointerId: number; clientX: number }) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;

    pointerRef.current = null;
    const offset = event.clientX - pointer.startX;
    setDragOffset(0);

    if (!pointer.moved) return;

    suppressClickRef.current = true;
    if (offset > threshold) onPrevious();
    else if (offset < -threshold) onNext();
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  const handlers: HorizontalCarouselGestureHandlers = {
    onPointerDown: (event) => start(event),
    onPointerMove: (event) => move(event),
    onPointerUp: (event) => end(event),
    onPointerCancel: (event) => end(event),
    onPointerLeave: (event) => end(event),
    onClickCapture: (event) => {
      if (!suppressClickRef.current) return;
      event.preventDefault();
      event.stopPropagation();
    },
  };

  return { dragOffset, handlers };
}

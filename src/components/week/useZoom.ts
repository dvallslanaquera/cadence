"use client";

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  DEFAULT_SCROLL_HOUR,
  fitHourHeight,
  HOUR_HEIGHT_PX,
  MAX_HOUR_HEIGHT_PX,
  MIN_HOUR_HEIGHT_PX,
} from "@/lib/constants";

/**
 * Grid zoom: fits the working day on screen at any viewport, then hands off to
 * the user once they pick a height. The ResizeObserver re-fits until the first
 * manual change; after that a window resize leaves the chosen height alone.
 */
export function useZoom(scrollRef: RefObject<HTMLDivElement | null>) {
  const [hourHeight, setHourHeight] = useState(HOUR_HEIGHT_PX);
  const pxPerMinute = hourHeight / 60;
  const lastHourHeight = useRef<number | null>(null);
  const userZoomed = useRef(false);

  const applyZoom = useCallback((next: number) => {
    userZoomed.current = true;
    setHourHeight(Math.min(MAX_HOUR_HEIGHT_PX, Math.max(MIN_HOUR_HEIGHT_PX, next)));
  }, []);

  // Live delta so the once-attached wheel handler reads the current height, not the mount-time closure.
  const zoomBy = useCallback((delta: number) => {
    userZoomed.current = true;
    setHourHeight((h) =>
      Math.min(MAX_HOUR_HEIGHT_PX, Math.max(MIN_HOUR_HEIGHT_PX, h + delta)),
    );
  }, []);

  const resetFit = useCallback(() => {
    userZoomed.current = false;
    const element = scrollRef.current;
    if (element && element.clientHeight > 0) setHourHeight(fitHourHeight(element.clientHeight));
  }, [scrollRef]);

  // Fit before first paint, then re-fit on resize until the user takes over.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const measure = (height: number) => {
      if (height > 0) setHourHeight(fitHourHeight(height));
    };
    if (!userZoomed.current) measure(element.clientHeight);

    const observer = new ResizeObserver((entries) => {
      if (!userZoomed.current) measure(entries[0].contentRect.height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [scrollRef]);

  // Ctrl+scroll zooms. React onWheel is passive so preventDefault is ignored; a native non-passive listener swallows the scroll.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    function onWheel(event: WheelEvent) {
      if (!event.ctrlKey) return;
      event.preventDefault();
      zoomBy((event.deltaY < 0 ? 1 : -1) * 4);
    }
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [scrollRef, zoomBy]);

  // Open at 09:00; on zoom changes keep the minute at the viewport top so resizing doesn't snap back. Paging weeks doesn't run this.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const previous = lastHourHeight.current;
    element.scrollTop =
      previous === null
        ? DEFAULT_SCROLL_HOUR * hourHeight
        : element.scrollTop * (hourHeight / previous);
    lastHourHeight.current = hourHeight;
  }, [scrollRef, hourHeight]);

  return { hourHeight, pxPerMinute, applyZoom, zoomBy, resetFit };
}
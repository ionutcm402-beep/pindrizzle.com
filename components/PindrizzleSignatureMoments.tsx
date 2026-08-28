"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

export function PindrizzleDropletMark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      className={`pd-droplet-mark${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path d="M12 2.8c3.1 4.1 6 7.5 6 11.3A6 6 0 0 1 6 14.1C6 10.3 8.9 6.9 12 2.8Z" fill="currentColor" />
      <path d="M9.1 14.6c.35 1.55 1.45 2.45 3.1 2.65" stroke="white" strokeWidth="1.35" strokeLinecap="round" opacity=".82" />
    </svg>
  );
}

export function PindrizzleEmptyDroplet({ size = 54 }: { size?: number }) {
  return (
    <div className="pd-empty-droplet" aria-hidden="true" style={{ "--pd-empty-size": `${size}px` } as CSSProperties}>
      <span className="pd-empty-droplet-soft" />
      <PindrizzleDropletMark size={Math.round(size * 0.55)} />
    </div>
  );
}

export function PindrizzleSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setVisible(false), reduced ? 180 : 780);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="pd-open-moment" aria-hidden="true">
      <div className="pd-open-moment-stage">
        <span className="pd-open-ripple" />
        <span className="pd-open-pin"><i /></span>
      </div>
      <div className="pd-open-wordmark">pindrizzle</div>
    </div>
  );
}

type PullToRefreshOptions = {
  scrollRef: RefObject<HTMLElement | null>;
  onRefresh: () => void | Promise<void>;
  enabled?: boolean;
  edgeOnly?: boolean;
};

export function usePindrizzlePullToRefresh({ scrollRef, onRefresh, enabled = true, edgeOnly = false }: PullToRefreshOptions) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const gestureRef = useRef({ active: false, startX: 0, startY: 0, pull: 0 });
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const triggerRefresh = useCallback(async () => {
    if (!enabled || refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setPull(48);
    const started = performance.now();
    try {
      await onRefreshRef.current();
    } finally {
      const elapsed = performance.now() - started;
      if (elapsed < 460) await new Promise((resolve) => window.setTimeout(resolve, 460 - elapsed));
      setPull(0);
      setRefreshing(false);
      refreshingRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !enabled) return;

    const atTop = () => {
      const localTop = Number(node.scrollTop || 0);
      const documentTop = Number(document.scrollingElement?.scrollTop || 0);
      return localTop <= 1 && documentTop <= 1;
    };

    const touchStart = (event: TouchEvent) => {
      if (refreshingRef.current || event.touches.length !== 1 || !atTop()) return;
      const target = event.target as Element | null;
      if (target?.closest("button,a,input,textarea,select,[role='dialog']")) return;
      const touch = event.touches[0];
      if (edgeOnly && touch.clientY > 145) return;
      gestureRef.current = { active: true, startX: touch.clientX, startY: touch.clientY, pull: 0 };
    };

    const touchMove = (event: TouchEvent) => {
      const gesture = gestureRef.current;
      if (!gesture.active || event.touches.length !== 1 || refreshingRef.current) return;
      const touch = event.touches[0];
      const dx = touch.clientX - gesture.startX;
      const dy = touch.clientY - gesture.startY;
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy) * 0.85) {
        if (dy < -8) gesture.active = false;
        return;
      }
      const next = Math.min(68, Math.max(0, dy * 0.46));
      gesture.pull = next;
      setPull(next);
      if (next > 5) event.preventDefault();
    };

    const touchEnd = () => {
      const gesture = gestureRef.current;
      if (!gesture.active) return;
      const shouldRefresh = gesture.pull >= 46;
      gestureRef.current = { active: false, startX: 0, startY: 0, pull: 0 };
      if (shouldRefresh) void triggerRefresh();
      else setPull(0);
    };

    node.addEventListener("touchstart", touchStart, { passive: true, capture: true });
    node.addEventListener("touchmove", touchMove, { passive: false, capture: true });
    node.addEventListener("touchend", touchEnd, { passive: true, capture: true });
    node.addEventListener("touchcancel", touchEnd, { passive: true, capture: true });
    return () => {
      node.removeEventListener("touchstart", touchStart, true);
      node.removeEventListener("touchmove", touchMove, true);
      node.removeEventListener("touchend", touchEnd, true);
      node.removeEventListener("touchcancel", touchEnd, true);
    };
  }, [enabled, edgeOnly, scrollRef, triggerRefresh]);

  return { pull, refreshing, triggerRefresh };
}

export function PindrizzleRefreshIndicator({ pull, refreshing }: { pull: number; refreshing: boolean }) {
  const visible = refreshing || pull > 3;
  const progress = Math.max(0, Math.min(1, pull / 48));
  return (
    <div
      className={`pd-refresh-indicator${visible ? " visible" : ""}${refreshing ? " refreshing" : ""}`}
      aria-hidden="true"
      style={{ "--pd-refresh-progress": progress } as CSSProperties}
    >
      <span className="pd-refresh-ripple" />
      <PindrizzleDropletMark size={17} />
    </div>
  );
}

export type PinDropMoment = { key: number; x: number; y: number };

export function PindrizzlePinDropMoment({ moment }: { moment: PinDropMoment | null }) {
  if (!moment) return null;
  return (
    <div key={moment.key} className="pd-pin-drop-moment" aria-hidden="true" style={{ left: moment.x, top: moment.y }}>
      <span className="pd-pin-drop-ripple" />
      <span className="pd-pin-drop-pin"><i /></span>
    </div>
  );
}

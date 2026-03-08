"use client";

import { useRef, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const THRESHOLD = 80;
const MAX_PULL = 120;

export function PullToRefresh({ children }: { children: ReactNode }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullingRef = useRef(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (refreshing) return;
      // Only activate when scrolled to top
      const el = containerRef.current;
      if (!el || el.scrollTop > 0) return;
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    },
    [refreshing]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!pullingRef.current || refreshing) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy < 0) {
        setPullDistance(0);
        return;
      }
      // Dampen pull
      const dampened = Math.min(dy * 0.5, MAX_PULL);
      setPullDistance(dampened);
    },
    [refreshing]
  );

  const handleTouchEnd = useCallback(() => {
    if (!pullingRef.current) return;
    pullingRef.current = false;

    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(THRESHOLD * 0.5);
      // Use router.refresh() to re-run the server component and get fresh data
      router.refresh();
      // Give time for the server to respond
      setTimeout(() => {
        setRefreshing(false);
        setPullDistance(0);
      }, 1000);
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, router]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-0 flex-1 flex-col overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="pointer-events-none flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
        style={{ height: pullDistance > 0 ? pullDistance : 0 }}
      >
        <div
          className={`flex items-center gap-2 text-sm text-muted-foreground ${
            refreshing ? "animate-pulse" : ""
          }`}
        >
          <svg
            className="h-5 w-5"
            style={{
              transform: `rotate(${progress * 360}deg)`,
              transition: pullingRef.current ? "none" : "transform 0.3s",
            }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {refreshing ? "Actualizando…" : progress >= 1 ? "Suelta para refrescar" : "Tira para refrescar"}
        </div>
      </div>

      {children}
    </div>
  );
}

import { useCallback, useRef } from "react";

const MIN_WIDTH = 50;
const MAX_WIDTH = 800;
const RESIZE_GUIDE_ATTR = "data-column-resize-guide";

interface UseColumnResizeOptions {
  onResize: (columnId: string, width: number) => void;
  onResizeEnd: (columnId: string, width: number) => void;
}

interface ResizeSession {
  columnId: string;
  startX: number;
  startWidth: number;
  currentWidth: number;
  guideLine: HTMLDivElement;
  cleanup: () => void;
}

const clampWidth = (width: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));

function createResizeGuide(frame: DOMRect, left: number) {
  const guideLine = document.createElement("div");
  guideLine.setAttribute(RESIZE_GUIDE_ATTR, "true");
  guideLine.style.position = "fixed";
  guideLine.style.top = `${frame.top}px`;
  guideLine.style.left = `${left}px`;
  guideLine.style.height = `${Math.max(frame.height, 1)}px`;
  guideLine.style.borderLeft = "2px solid hsl(var(--primary))";
  guideLine.style.pointerEvents = "none";
  guideLine.style.zIndex = "9999";
  guideLine.style.boxShadow = "0 0 0 1px hsl(var(--background))";
  document.body.appendChild(guideLine);
  return guideLine;
}

export function useColumnResize({ onResize, onResizeEnd }: UseColumnResizeOptions) {
  const resizeRef = useRef<ResizeSession | null>(null);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, columnId: string, currentWidth: number) => {
      e.preventDefault();
      e.stopPropagation();

      const grid = (e.currentTarget as HTMLElement).closest('[role="grid"]');
      const frame = grid?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
      const startX = e.clientX;
      const startWidth = clampWidth(currentWidth);
      const guideLine = createResizeGuide(frame, startX);
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const cleanup = () => {
        guideLine.remove();
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
      };

      resizeRef.current = {
        columnId,
        startX,
        startWidth,
        currentWidth: startWidth,
        guideLine,
        cleanup,
      };

      onResize(columnId, startWidth);

      const onMouseMove = (moveEvent: MouseEvent) => {
        const session = resizeRef.current;
        if (!session) return;

        const delta = moveEvent.clientX - session.startX;
        session.currentWidth = clampWidth(session.startWidth + delta);
        const nextGuideLeft =
          session.startX + (session.currentWidth - session.startWidth);
        session.guideLine.style.left = `${nextGuideLeft}px`;
        onResize(session.columnId, session.currentWidth);
      };

      const finishResize = () => {
        const session = resizeRef.current;
        resizeRef.current = null;
        if (!session) return;

        session.cleanup();
        onResizeEnd(session.columnId, session.currentWidth);
      };

      const onMouseUp = (upEvent: MouseEvent) => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("blur", onWindowBlur);
        const session = resizeRef.current;
        if (session) {
          const delta = upEvent.clientX - session.startX;
          session.currentWidth = clampWidth(session.startWidth + delta);
        }
        finishResize();
      };

      const onWindowBlur = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("blur", onWindowBlur);
        finishResize();
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      window.addEventListener("blur", onWindowBlur);
    },
    [onResize, onResizeEnd],
  );

  const handleAutoFit = useCallback(
    (columnId: string, scrollContainer: HTMLElement | null) => {
      if (!scrollContainer) return;

      const cells = scrollContainer.querySelectorAll(`[data-col-id="${columnId}"]`);
      if (cells.length === 0) return;

      const measurer = document.createElement("span");
      measurer.style.cssText =
        "position:absolute;visibility:hidden;white-space:nowrap;font:inherit;padding:0 8px;";
      document.body.appendChild(measurer);

      let maxWidth = MIN_WIDTH;
      cells.forEach((cell) => {
        measurer.textContent = cell.textContent ?? "";
        const element = cell as HTMLElement;
        const isHeaderCell = element.getAttribute("role") === "columnheader";
        const chromeWidth = isHeaderCell ? 56 : 16;
        maxWidth = Math.max(maxWidth, measurer.offsetWidth + chromeWidth);
      });

      document.body.removeChild(measurer);
      onResizeEnd(columnId, clampWidth(maxWidth));
    },
    [onResizeEnd],
  );

  return { handleResizeStart, handleAutoFit };
}

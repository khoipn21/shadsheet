import { useCallback, useRef } from "react";

const MIN_WIDTH = 50;
const MAX_WIDTH = 800;

/** Sanitize column ID for safe use as a CSS custom property name */
const safeCssId = (id: string) => id.replace(/[^a-zA-Z0-9-_]/g, "_");

interface UseColumnResizeOptions {
  onResizeEnd: (columnId: string, width: number) => void;
}

/**
 * Column resize via mouse drag on handle.
 * Updates CSS variable during drag (no React re-render) and persists on mouseup.
 */
export function useColumnResize({ onResizeEnd }: UseColumnResizeOptions) {
  const draggingRef = useRef<{ columnId: string; startX: number; startWidth: number } | null>(null);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, columnId: string, currentWidth: number) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startWidth = currentWidth;
      draggingRef.current = { columnId, startX, startWidth };

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!draggingRef.current) return;
        const delta = moveEvent.clientX - startX;
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
        // Update CSS variable for instant visual feedback — no React re-render
        document.documentElement.style.setProperty(`--col-${safeCssId(columnId)}-width`, `${newWidth}px`);
      };

      const onMouseUp = (upEvent: MouseEvent) => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        if (!draggingRef.current) return;

        const delta = upEvent.clientX - startX;
        const finalWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
        draggingRef.current = null;
        onResizeEnd(columnId, finalWidth);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [onResizeEnd],
  );

  /** Double-click to auto-fit: measures widest cell content via off-screen element */
  const handleAutoFit = useCallback(
    (columnId: string, scrollContainer: HTMLElement | null) => {
      if (!scrollContainer) return;

      const cells = scrollContainer.querySelectorAll(`[data-col-id="${columnId}"]`);
      if (cells.length === 0) return;

      // Measure max content width using an off-screen element
      const measurer = document.createElement("span");
      measurer.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font:inherit;padding:0 8px;";
      document.body.appendChild(measurer);

      let maxWidth = MIN_WIDTH;
      cells.forEach((cell) => {
        measurer.textContent = cell.textContent ?? "";
        maxWidth = Math.max(maxWidth, measurer.offsetWidth + 16); // +16 for px-2 padding
      });

      document.body.removeChild(measurer);
      const clampedWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, maxWidth));

      document.documentElement.style.setProperty(`--col-${safeCssId(columnId)}-width`, `${clampedWidth}px`);
      onResizeEnd(columnId, clampedWidth);
    },
    [onResizeEnd],
  );

  return { handleResizeStart, handleAutoFit };
}

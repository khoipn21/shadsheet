import {
  forwardRef,
  useCallback,
  useMemo,
  useState,
  type InputHTMLAttributes,
  type UIEvent,
} from "react";
import { cn } from "@/lib/utils";
import { getFormulaReferenceSegments } from "@/utils/formula-reference-utils";

interface FormulaReferenceInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value"> {
  value: string;
  contentClassName?: string;
  overlayClassName?: string;
  inputClassName?: string;
}

export const FormulaReferenceInput = forwardRef<
  HTMLInputElement,
  FormulaReferenceInputProps
>(function FormulaReferenceInput(
  {
    value,
    className,
    contentClassName,
    overlayClassName,
    inputClassName,
    onScroll,
    style,
    ...props
  },
  ref,
) {
  const [scrollLeft, setScrollLeft] = useState(0);
  const segments = useMemo(
    () => getFormulaReferenceSegments(value),
    [value],
  );

  const handleScroll = useCallback(
    (event: UIEvent<HTMLInputElement>) => {
      setScrollLeft(event.currentTarget.scrollLeft);
      onScroll?.(event);
    },
    [onScroll],
  );

  return (
    <div className={cn("relative", className)}>
      {value.length > 0 && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 overflow-hidden whitespace-pre",
            contentClassName,
            overlayClassName,
          )}
        >
          <div style={{ transform: `translateX(${-scrollLeft}px)` }}>
            {segments.map((segment, index) => (
              <span
                key={`${segment.text}-${index}`}
                style={segment.color ? { color: segment.color } : undefined}
              >
                {segment.text}
              </span>
            ))}
          </div>
        </div>
      )}

      <input
        {...props}
        ref={ref}
        value={value}
        onScroll={handleScroll}
        className={cn(
          "relative z-[1] bg-transparent text-transparent caret-foreground outline-none",
          contentClassName,
          inputClassName,
        )}
        style={{
          ...style,
          WebkitTextFillColor: "transparent",
        }}
      />
    </div>
  );
});

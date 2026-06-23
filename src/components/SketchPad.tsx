import { useEffect, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";

/**
 * Finger/stylus drawing pad backed by react-signature-canvas. Unlike
 * `SignaturePad` (approval signatures, captured to storage at decision time),
 * this is a form field: it seeds from a PNG data URL `value` and emits the new
 * data URL after each stroke. Used for the in-form site sketch, stored inline in
 * `formValues` so it is autosaved/restored like any other field.
 */
export function SketchPad({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (dataUrl: string | undefined) => void;
}) {
  const sigRef = useRef<SignatureCanvas | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  // Keep the latest value reachable from the resize handler without re-binding.
  const valueRef = useRef(value);
  valueRef.current = value;

  // Match the canvas bitmap to its displayed width so pointer coordinates map
  // 1:1, re-applying the saved drawing afterwards — setting canvas.width clears
  // the bitmap (this is why SignaturePad blanks itself on resize; here we must
  // not lose the sketch).
  useEffect(() => {
    function fit() {
      const canvas = sigRef.current?.getCanvas();
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      canvas.width = wrap.clientWidth;
      canvas.height = 220;
      if (valueRef.current) sigRef.current?.fromDataURL(valueRef.current);
      else sigRef.current?.clear();
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  function handleEnd() {
    const sig = sigRef.current;
    if (!sig) return;
    onChange(sig.isEmpty() ? undefined : sig.toDataURL("image/png"));
  }

  function clear() {
    sigRef.current?.clear();
    onChange(undefined);
  }

  return (
    <div className="space-y-2">
      <div ref={wrapRef} className="border-2 border-dashed border-stone-300 rounded-xl bg-white overflow-hidden">
        <SignatureCanvas
          ref={sigRef}
          penColor="#1c1917"
          onEnd={handleEnd}
          clearOnResize={false}
          canvasProps={{ className: "block rounded-xl", style: { touchAction: "none" } }}
        />
      </div>
      <button type="button" className="text-sm text-rebar underline" onClick={clear}>
        Clear sketch
      </button>
    </div>
  );
}

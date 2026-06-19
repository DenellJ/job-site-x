import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  toBlob: () => Promise<Blob | null>;
  clear: () => void;
}

export const SignaturePad = forwardRef<SignaturePadHandle>((_props, ref) => {
  const sigRef = useRef<SignatureCanvas | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useImperativeHandle(ref, () => ({
    isEmpty: () => sigRef.current?.isEmpty() ?? true,
    clear: () => sigRef.current?.clear(),
    toBlob: async () => {
      const canvas = sigRef.current?.getCanvas();
      if (!canvas) return null;
      return await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/png"));
    },
  }));

  // Match the canvas bitmap to its displayed width so pointer coordinates map
  // 1:1 — otherwise only part of the pad responds to strokes.
  useEffect(() => {
    function resize() {
      const canvas = sigRef.current?.getCanvas();
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      canvas.width = wrap.clientWidth;
      canvas.height = 180;
      sigRef.current?.clear();
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <div className="space-y-2">
      <div ref={wrapRef} className="border-2 border-dashed border-stone-300 rounded-xl bg-white overflow-hidden">
        <SignatureCanvas
          ref={sigRef}
          penColor="#1c1917"
          canvasProps={{ className: "block rounded-xl", style: { touchAction: "none" } }}
        />
      </div>
      <button type="button" className="text-sm text-rebar underline" onClick={() => sigRef.current?.clear()}>
        Clear signature
      </button>
    </div>
  );
});
SignaturePad.displayName = "SignaturePad";

import { forwardRef, useImperativeHandle, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  toBlob: () => Promise<Blob | null>;
  clear: () => void;
}

export const SignaturePad = forwardRef<SignaturePadHandle>((_props, ref) => {
  const sigRef = useRef<SignatureCanvas | null>(null);

  useImperativeHandle(ref, () => ({
    isEmpty: () => sigRef.current?.isEmpty() ?? true,
    clear: () => sigRef.current?.clear(),
    toBlob: async () => {
      const canvas = sigRef.current?.getCanvas();
      if (!canvas) return null;
      return await new Promise<Blob | null>((res) =>
        canvas.toBlob((b) => res(b), "image/png")
      );
    }
  }));

  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed border-slate-300 rounded-xl bg-white">
        <SignatureCanvas
          ref={sigRef}
          penColor="#0f172a"
          canvasProps={{
            className: "w-full h-44 rounded-xl",
            width: 600,
            height: 176
          }}
        />
      </div>
      <button
        type="button"
        className="text-sm text-slate-600 underline"
        onClick={() => sigRef.current?.clear()}
      >
        Clear signature
      </button>
    </div>
  );
});
SignaturePad.displayName = "SignaturePad";

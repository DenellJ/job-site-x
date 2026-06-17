import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App";
import "./index.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

const root = ReactDOM.createRoot(document.getElementById("root")!);

if (!convexUrl) {
  root.render(
    <div className="min-h-full flex items-center justify-center p-6 bg-stone-100">
      <div className="card max-w-lg">
        <h1 className="text-xl font-bold mb-2">Convex not configured</h1>
        <p className="text-slate-700 text-sm">
          <code className="bg-slate-100 px-1 rounded">VITE_CONVEX_URL</code> is not set. Run{" "}
          <code className="bg-slate-100 px-1 rounded">npx convex dev</code> to provision a
          deployment (it writes the URL to{" "}
          <code className="bg-slate-100 px-1 rounded">.env.local</code>), then restart the dev
          server.
        </p>
      </div>
    </div>,
  );
} else {
  const convex = new ConvexReactClient(convexUrl);
  root.render(
    <React.StrictMode>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConvexAuthProvider>
    </React.StrictMode>,
  );
}

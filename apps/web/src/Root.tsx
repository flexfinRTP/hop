import { lazy, Suspense, useEffect, useState } from "react";
import { CommandCenter } from "./CommandCenter";
import { Docs } from "./Docs";
import { Landing } from "./Landing";
import { VerifyPage } from "./VerifyPage";

const TokenizationStudio = lazy(() =>
  import("./TokenizationStudio").then((module) => ({ default: module.TokenizationStudio })),
);

function pathOf(): string {
  return window.location.pathname.replace(/\/$/, "") || "/";
}

export function Root() {
  const [path, setPath] = useState(pathOf);

  useEffect(() => {
    const onPop = () => setPath(pathOf());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const mode =
      path === "/app" || path === "/desk"
        ? "app"
        : path === "/assets"
          ? "assets"
          : "site";
    document.body.className = `is-${mode}`;
    document.title =
      path === "/app" || path === "/desk"
        ? "Hop · Decision room"
        : path === "/assets"
          ? "Hop · ATS"
          : path === "/docs" || path.startsWith("/docs/")
            ? "Hop · Docs"
            : path.startsWith("/verify/")
              ? "Hop · Verify"
              : "Hop";
  }, [path]);

  useEffect(() => {
    if (path !== "/desk") return;
    history.replaceState({}, "", "/app");
    setPath("/app");
  }, [path]);

  if (path === "/docs" || path.startsWith("/docs/")) return <Docs />;
  if (path.startsWith("/verify/")) return <VerifyPage />;
  if (path === "/app" || path === "/desk") return <CommandCenter />;
  if (path === "/assets") {
    return (
      <Suspense fallback={<div className="asset-loading">ATS / LOADING</div>}>
        <TokenizationStudio />
      </Suspense>
    );
  }
  return <Landing />;
}

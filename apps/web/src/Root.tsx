import { useEffect, useState } from "react";
import { Desk } from "./Desk";
import { Site } from "./Site";
import { Workbench } from "./Workbench";

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
    const mode = path === "/desk" ? "desk" : path === "/app" ? "app" : "site";
    document.body.className = `is-${mode}`;
    document.title = path === "/desk" ? "Hop · Desk" : path === "/app" ? "Hop · Check" : "Hop";
  }, [path]);

  if (path === "/desk") return <Desk />;
  if (path === "/app") return <Workbench variant="app" />;
  return <Site />;
}

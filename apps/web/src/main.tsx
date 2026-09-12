import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Root } from "./Root";
import "./styles.css";

class Gate extends Component<{ children: ReactNode }, { err: string }> {
  state = { err: "" };

  static getDerivedStateFromError(err: Error) {
    return { err: err.message || "error" };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error(err, info.componentStack);
  }

  render() {
    if (this.state.err) {
      return <p className="status">error: {this.state.err}</p>;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Gate>
      <Root />
    </Gate>
  </StrictMode>,
);

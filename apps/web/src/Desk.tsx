import { useState } from "react";
import { Workbench } from "./Workbench";

export function Desk() {
  const [busy, setBusy] = useState(false);
  return (
    <div className="desk">
      <div className={`stage ${busy ? "busy" : ""}`}>
        <img className="plate" src="/desk/desk-empty.png" alt="" />
        <div className="lamp" aria-hidden="true" />
        <div className="window" aria-hidden="true">
          <div className="rain" />
          <div className="rain-b" />
          <div className="rain-glass" />
        </div>
        <div className={`prop ${busy ? "busy" : ""}`} aria-hidden="true">
          <i className="prop-shadow" />
          <div className="prop-wheel">
            <img className="prop-full" src="/desk/wheel.png" alt="" draggable={false} />
            <div className="prop-spinmask">
              <img className="prop-rim" src="/desk/wheel-rim.png" alt="" draggable={false} />
            </div>
          </div>
          <img className="prop-bunny sit" src="/desk/bunny-sit.png" alt="" draggable={false} />
          <img className="prop-bunny run" src="/desk/bunny-run.png" alt="" draggable={false} />
        </div>
        <div className="laptop">
          <Workbench variant="desk" onPending={setBusy} />
        </div>
      </div>
    </div>
  );
}

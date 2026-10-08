"use client";

import { CATALOG, LANE_LABEL, LANES, PORTS, type NodeType } from "@/lib/funnel-graph";
import { NodeIcon } from "./icons";

/** Functions grouped by lane. Drag one onto the canvas, or press Enter to add it. */
export function FunnelPalette({ onAdd }: { onAdd: (type: NodeType) => void }) {
  return (
    <aside aria-label="Functions" className="w-[228px] shrink-0 overflow-y-auto border-r border-[var(--ic-ink)] bg-[var(--ic-pane)]">
      <div className="px-3 pb-1 pt-3 text-[12.5px] font-semibold text-[var(--ic-secondary)]">
        Drag a function onto the canvas, or press Enter to add it. Ports only snap to what they can take.
      </div>
      {LANES.map((lane) => (
        <div key={lane}>
          <h3 className="ic-label px-3 pb-1 pt-3 text-[10.5px] text-[var(--ic-instruction)]">{LANE_LABEL[lane]}</h3>
          {Object.values(CATALOG)
            .filter((def) => def.lane === lane)
            .map((def) => (
              <button
                key={def.type}
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/funnel-node", def.type);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => onAdd(def.type)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--ic-soft)]"
              >
                <NodeIcon name={def.icon} className="h-6 w-6 shrink-0" color={def.hue} />
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-extrabold leading-tight text-[var(--ic-ink)]">{def.title}</span>
                  <span className="ic-label block text-[9px] normal-case tracking-normal text-[var(--ic-instruction)]">
                    {(def.inputs.map((p) => PORTS[p.port].label).join(" + ") || "start")} →{" "}
                    {def.outputs.map((p) => PORTS[p].label).join(", ") || "end"}
                  </span>
                </span>
              </button>
            ))}
        </div>
      ))}
    </aside>
  );
}

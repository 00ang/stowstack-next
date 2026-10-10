"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Node,
  type NodeProps,
  type OnConnectEnd,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import "./canvas.css";
import {
  CATALOG,
  NODE_TYPES,
  PORTS,
  addNode,
  canConnect,
  connect,
  defOf,
  nodeReading,
  readiness,
  type FunnelContext,
  type FunnelGraph,
  type NodeType,
  type PortType,
} from "@/lib/funnel-graph";
import { NodeIcon } from "./icons";
import type { NodeResult, NodeState } from "@/lib/campaign-publish/types";
import { PUBLISH_LABEL, publishMark } from "./use-publish";

export interface FunnelNodeData extends Record<string, unknown> {
  title: string;
  lane: string;
  icon: string;
  hue: string;
  reading: string;
  sample: boolean;
  inputs: { port: PortType; optional: boolean }[];
  outputs: PortType[];
  ready: boolean;
  need: string | null;
  /** Where this function stands after the last publish, when there was one. */
  publish: { state: NodeState; label: string } | null;
  /** Open the picker of functions that can follow this output. */
  onPlus: (outIndex: number) => void;
}

/** Functions whose inputs take `port`, in catalog order (space → reach → convert → respond → prove). */
export function functionsTaking(port: PortType): NodeType[] {
  return NODE_TYPES.filter((type) => defOf(type).inputs.some((input) => input.port === port));
}

const NODE_WIDTH = 220;

function FunnelFlowNode({ data, selected }: NodeProps<Node<FunnelNodeData>>) {
  return (
    <div
      className={`w-[220px] border border-[var(--ic-ink)] bg-[var(--ic-pane)] ${
        selected ? "outline outline-2 outline-offset-1 outline-[var(--ic-selected)]" : ""
      }`}
    >
      <div className="flex gap-2 px-2.5 pb-1 pt-2">
        <NodeIcon name={data.icon} className="h-6 w-6 shrink-0" color={data.hue} />
        <div className="min-w-0">
          <div className="text-[14px] font-extrabold leading-tight text-[var(--ic-ink)]">{data.title}</div>
          <div className="ic-label mt-0.5 text-[9px] text-[var(--ic-instruction)]">{data.lane}</div>
        </div>
      </div>
      <div className="px-2.5 pb-1.5 text-[12px] font-semibold leading-snug text-[var(--ic-secondary)]">
        {data.reading}
        {data.sample && <span className="ic-label ml-1 border border-[var(--ic-instruction)] px-1 text-[9px]">Sample</span>}
      </div>
      {(data.inputs.length > 0 || data.outputs.length > 0) && (
        <div className="flex justify-between gap-2 border-t border-[var(--ic-dither)]/40 py-1">
          <div className="flex flex-col gap-1">
            {data.inputs.map((input, i) => (
              <div key={`in-${i}`} className="ic-label relative flex h-[18px] items-center pl-2.5 text-[9px] text-[var(--ic-secondary)]">
                <Handle id={`in-${i}`} type="target" position={Position.Left} style={{ left: 0, background: PORTS[input.port].hue }} />
                {PORTS[input.port].label}
                {input.optional ? " opt." : ""}
              </div>
            ))}
          </div>
          <div className="flex flex-col items-end gap-1">
            {data.outputs.map((port, i) => (
              <div key={`out-${i}`} className="ic-label relative flex h-[18px] items-center gap-1 pr-2.5 text-[9px] text-[var(--ic-secondary)]">
                {PORTS[port].label}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    data.onPlus(i);
                  }}
                  aria-label={`Add a function that takes this ${PORTS[port].label.toLowerCase()}`}
                  title="Add what comes next"
                  className="nodrag nopan flex h-[16px] w-[16px] items-center justify-center bg-[var(--ic-soft)] font-sans text-[13px] font-extrabold leading-none text-[var(--ic-ink)] hover:bg-[var(--act-1)]"
                >
                  +
                </button>
                <Handle id={`out-${i}`} type="source" position={Position.Right} style={{ right: 0, background: PORTS[port].hue }} />
              </div>
            ))}
          </div>
        </div>
      )}
      {data.publish && data.ready ? (
        <PublishFooter state={data.publish.state} label={data.publish.label} />
      ) : (
        <div className={`flex items-center gap-1.5 border-t border-[var(--ic-ink)] px-2.5 py-1.5 text-[12px] font-extrabold ${data.ready ? "" : "bg-[var(--ic-soft)]"}`}>
          <i
            aria-hidden
            className={`inline-block h-[9px] w-[9px] border-[1.5px] border-[var(--ic-ink)] ${data.ready ? "border-[var(--color-green)] bg-[var(--color-green)]" : ""}`}
          />
          {data.ready ? "Ready" : `Needs · ${data.need}`}
        </div>
      )}
    </div>
  );
}

/** A published function's footer: the state in words, with its mark. */
function PublishFooter({ state, label }: { state: NodeState; label: string }) {
  const mark = publishMark(state);
  const loud = state === "failed" || state === "unknown" || state === "needs";
  return (
    <div
      className={`flex items-center gap-1.5 border-t border-[var(--ic-ink)] px-2.5 py-1.5 text-[12px] font-extrabold ${loud ? "bg-[var(--ic-soft)]" : ""}`}
      style={loud ? { boxShadow: `inset 4px 0 0 ${mark.edge}` } : undefined}
    >
      <i
        aria-hidden
        className={`inline-block h-[9px] w-[9px] border-[1.5px] ${mark.pulse ? "animate-pulse" : ""}`}
        style={{ borderColor: mark.edge, background: mark.fill ?? "transparent" }}
      />
      {label}
    </div>
  );
}

const nodeTypes = { funnel: FunnelFlowNode };

/** Title is 14px. Zoom 1 keeps it at 14px; Fit will not go below this, so it stays about 12px. */
const READABLE_ZOOM = 1;
const FIT_MIN_ZOOM = 0.85;

/** Where the picker of next functions opens, and what it would connect from. */
interface PickerState {
  fromId: string;
  fromPort: number;
  port: PortType;
  /** Flow coordinates for the new function's top-left. */
  flow: { x: number; y: number };
  /** Pixel position inside the canvas, for the picker itself. */
  screen: { x: number; y: number };
}

function FunctionPicker({
  picker,
  suggested,
  bounds,
  onPick,
  onClose,
}: {
  picker: PickerState;
  suggested: NodeType | null;
  bounds: { width: number; height: number };
  onPick: (type: NodeType) => void;
  onClose: () => void;
}) {
  const types = useMemo(() => {
    const all = functionsTaking(picker.port);
    return suggested && all.includes(suggested) ? [suggested, ...all.filter((t) => t !== suggested)] : all;
  }, [picker.port, suggested]);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    listRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, []);

  const width = 290;
  const left = Math.max(8, Math.min(picker.screen.x, bounds.width - width - 8));
  const top = Math.max(8, Math.min(picker.screen.y, bounds.height - 320));

  return (
    <div
      role="dialog"
      aria-label={`Functions that take ${PORTS[picker.port].phrase}`}
      className="absolute z-20 border border-[var(--ic-ink)] bg-[var(--ic-pane)]"
      style={{ left, top, width }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const next = (active + (e.key === "ArrowDown" ? 1 : types.length - 1)) % types.length;
          setActive(next);
          listRef.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
        }
      }}
    >
      <div className="flex items-center justify-between border-b border-[var(--ic-ink)] px-3 py-2">
        <span className="ic-label text-[10px] text-[var(--ic-instruction)]">Takes {PORTS[picker.port].label}</span>
        <button type="button" onClick={onClose} className="text-[12px] font-extrabold underline underline-offset-4">
          Close
        </button>
      </div>
      <ul ref={listRef} className="max-h-[260px] overflow-y-auto">
        {types.map((type, i) => {
          const def = CATALOG[type];
          return (
            <li key={type}>
              <button
                type="button"
                onClick={() => onPick(type)}
                onFocus={() => setActive(i)}
                className="flex w-full items-start gap-2 border-b border-[var(--ic-ink)]/10 px-3 py-2 text-left hover:bg-[var(--ic-soft)] focus:bg-[var(--ic-soft)] focus:outline-none"
              >
                <NodeIcon name={def.icon} className="mt-0.5 h-5 w-5 shrink-0" color={def.hue} />
                <span className="min-w-0">
                  <span className="block text-[14px] font-extrabold leading-tight text-[var(--ic-ink)]">
                    {def.title}
                    {type === suggested && (
                      <span className="ic-label ml-2 text-[9.5px] text-[var(--ic-selected)]">Suggested</span>
                    )}
                  </span>
                  <span className="ic-label block text-[9.5px] text-[var(--ic-secondary)]">
                    {def.inputs.map((p) => PORTS[p.port].label).join(" + ") || "start"} →{" "}
                    {def.outputs.map((p) => PORTS[p].label).join(", ") || "end"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function nodeData(
  graph: FunnelGraph,
  ctx: FunnelContext,
  onPlus: (nodeId: string, outIndex: number) => void,
  published?: Record<string, NodeResult>,
): Node<FunnelNodeData>[] {
  return graph.nodes.map((n) => {
    const def = defOf(n.type);
    const state = readiness(graph, n);
    return {
      id: n.id,
      type: "funnel",
      position: { x: n.x, y: n.y },
      data: {
        title: def.title,
        lane: def.lane,
        icon: def.icon,
        hue: def.hue,
        reading: nodeReading(n, ctx),
        sample: !!ctx.sample,
        inputs: def.inputs.map((input) => ({ port: input.port, optional: !input.required && !def.anyInput })),
        outputs: def.outputs,
        ready: state.state === "ready",
        need: state.need,
        publish: published?.[n.id] ? { state: published[n.id].state, label: PUBLISH_LABEL[published[n.id].state] } : null,
        onPlus: (outIndex: number) => onPlus(n.id, outIndex),
      },
    };
  });
}

interface CanvasProps {
  graph: FunnelGraph;
  ctx: FunnelContext;
  focusKey: number;
  onMove: (id: string, x: number, y: number) => void;
  onConnectPorts: (fromId: string, fromPort: number, toId: string, toPort: number) => string | null;
  onSelect: (id: string | null) => void;
  onDropType: (type: NodeType, x: number, y: number) => void;
  /** Add a function at (x, y) wired from one output. */
  onAddFrom: (type: NodeType, x: number, y: number, fromId: string, fromPort: number) => void;
  onRefuse: (reason: string) => void;
  /** The function the next move would add after `fromId`, if any. */
  suggestFor: (fromId: string) => NodeType | null;
  /** Live counts per wire (edge id → "240 visits"), when the campaign has any. */
  edgeLabels?: Record<string, string>;
  /** Each function's result from the last publish. */
  published?: Record<string, NodeResult>;
  /** Sample-portal mock: cloud dither behind the nodes. Nodes stay white. */
  sky?: boolean;
}

function CanvasInner({
  graph,
  ctx,
  focusKey,
  onMove,
  onConnectPorts,
  onSelect,
  onDropType,
  onAddFrom,
  onRefuse,
  suggestFor,
  edgeLabels,
  published,
  sky,
  wrapper,
}: CanvasProps & { wrapper: HTMLDivElement | null }) {
  const flow = useReactFlow();
  const nodesRef = useRef(graph.nodes);
  const [picker, setPicker] = useState<PickerState | null>(null);

  useEffect(() => {
    nodesRef.current = graph.nodes;
  });

  const frameStart = useCallback(() => {
    const nodes = nodesRef.current;
    if (!nodes.length) return;
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    // Zoom 1, with the start of the path in the top-left. Fit can pull back later.
    void flow.setViewport({ x: 28 - minX, y: 20 - minY, zoom: READABLE_ZOOM });
  }, [flow]);

  useEffect(() => {
    const handle = requestAnimationFrame(() => frameStart());
    return () => cancelAnimationFrame(handle);
  }, [focusKey, frameStart]);

  const toLocal = useCallback(
    (clientX: number, clientY: number) => {
      const rect = wrapper?.getBoundingClientRect();
      return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
    },
    [wrapper],
  );

  const openPlus = useCallback(
    (nodeId: string, outIndex: number) => {
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const port = defOf(node.type).outputs[outIndex];
      if (!port) return;
      const at = { x: node.x + NODE_WIDTH + 56, y: node.y + outIndex * 40 };
      const screen = flow.flowToScreenPosition({ x: node.x + NODE_WIDTH + 8, y: node.y });
      setPicker({ fromId: nodeId, fromPort: outIndex, port, flow: at, screen: toLocal(screen.x, screen.y) });
    },
    [graph.nodes, flow, toLocal],
  );

  const nodes = useMemo(() => nodeData(graph, ctx, openPlus, published), [graph, ctx, openPlus, published]);
  const edges = useMemo(
    () =>
      graph.edges.map((e) => {
        const label = edgeLabels?.[e.id];
        return {
          id: e.id,
          source: e.from,
          target: e.to,
          sourceHandle: `out-${e.fromPort}`,
          targetHandle: `in-${e.toPort}`,
          // What flowed along this wire in the window, on a white tab so it reads over the grid.
          ...(label
            ? {
                label,
                labelStyle: { fontFamily: "var(--font-plex-mono), ui-monospace, monospace", fontSize: 11, fontWeight: 600, fill: "#121214" },
                labelBgStyle: { fill: "#FFFFFF", stroke: "#121214", strokeWidth: 1 },
                labelBgPadding: [6, 3] as [number, number],
                labelShowBg: true,
              }
            : {}),
        };
      }),
    [graph.edges, edgeLabels],
  );

  const isValid = useCallback(
    (c: Connection | { source: string | null; target: string | null; sourceHandle?: string | null; targetHandle?: string | null }) => {
      if (!c.source || !c.target) return false;
      const fromPort = Number(String(c.sourceHandle ?? "out-0").replace("out-", ""));
      const toPort = Number(String(c.targetHandle ?? "in-0").replace("in-", ""));
      return canConnect(graph, c.source, fromPort, c.target, toPort).ok;
    },
    [graph],
  );

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, state) => {
      if (!state.fromHandle || state.isValid) return;
      const fromId = state.fromNode?.id;
      if (!fromId) return;
      const fromPort = Number(String(state.fromHandle.id ?? "out-0").replace("out-", ""));
      const toId = state.toNode?.id;
      if (toId) {
        const toHandle = state.toHandle?.id;
        const toPort = toHandle ? Number(String(toHandle).replace("in-", "")) : 0;
        const refused = canConnect(graph, fromId, fromPort, toId, toPort);
        if (!refused.ok) onRefuse(refused.reason);
        return;
      }
      // Dropped on empty canvas from an output: offer what can take it, right there.
      if (state.fromHandle.type !== "source") return;
      const source = graph.nodes.find((n) => n.id === fromId);
      const port = source ? defOf(source.type).outputs[fromPort] : undefined;
      if (!port) return;
      const point = "changedTouches" in event ? event.changedTouches[0] : event;
      if (!point) return;
      const at = flow.screenToFlowPosition({ x: point.clientX, y: point.clientY });
      setPicker({ fromId, fromPort, port, flow: { x: at.x, y: at.y - 40 }, screen: toLocal(point.clientX, point.clientY) });
    },
    [graph, onRefuse, flow, toLocal],
  );

  const bounds = { width: wrapper?.clientWidth ?? 800, height: wrapper?.clientHeight ?? 600 };

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeDragStop={(_, node) => onMove(node.id, node.position.x, node.position.y)}
        onNodeClick={(_, node) => onSelect(node.id)}
        onPaneClick={() => {
          setPicker(null);
          onSelect(null);
        }}
        onConnect={(c) => {
          if (!c.source || !c.target) return;
          const fromPort = Number(String(c.sourceHandle ?? "out-0").replace("out-", ""));
          const toPort = Number(String(c.targetHandle ?? "in-0").replace("in-", ""));
          const reason = onConnectPorts(c.source, fromPort, c.target, toPort);
          if (reason) onRefuse(reason);
        }}
        onConnectEnd={onConnectEnd}
        isValidConnection={isValid}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          e.preventDefault();
          const type = e.dataTransfer.getData("application/funnel-node");
          if (!(NODE_TYPES as readonly string[]).includes(type)) return;
          const pos = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
          onDropType(type as NodeType, pos.x - 110, pos.y - 40);
        }}
        defaultViewport={{ x: 24, y: 24, zoom: READABLE_ZOOM }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        deleteKeyCode={null}
        minZoom={FIT_MIN_ZOOM}
        maxZoom={1.6}
        onInit={() => frameStart()}
        style={sky ? { background: "transparent" } : undefined}
      >
        {sky ? null : <Background gap={24} size={1.2} color="#C3C5CF" />}
      </ReactFlow>
      {picker && (
        <FunctionPicker
          picker={picker}
          suggested={suggestFor(picker.fromId)}
          bounds={bounds}
          onClose={() => setPicker(null)}
          onPick={(type) => {
            onAddFrom(type, picker.flow.x, picker.flow.y, picker.fromId, picker.fromPort);
            setPicker(null);
          }}
        />
      )}
    </>
  );
}

export function FunnelCanvas(props: CanvasProps) {
  // The element itself, held in state (a callback ref), so its size can be read while rendering the picker.
  const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setWrapper} className={`funnel-canvas relative h-full min-h-0 w-full ${props.sky ? "d3-canvas-sky" : "bg-[var(--ic-ground)]"}`}>
      <ReactFlowProvider>
        <CanvasInner {...props} wrapper={wrapper} />
        <CanvasTools />
      </ReactFlowProvider>
      {props.graph.nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="pointer-events-auto max-w-sm border border-[var(--ic-ink)] bg-[var(--ic-pane)] p-4">
            <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">Empty campaign</div>
            <h3 className="mt-1 text-[16px] font-extrabold">Start from what you want to happen.</h3>
            <div className="mt-1 text-[13px] font-semibold text-[var(--ic-secondary)]">
              Drag a function in from the left, or follow the next move below.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CanvasTools() {
  const flow = useReactFlow();
  const cls = "act-fill flex h-8 min-w-8 items-center justify-center px-2 text-[13px] font-extrabold";
  return (
    <div className="absolute bottom-3 left-3 z-10 flex gap-1" role="group" aria-label="Zoom">
      <button type="button" data-fill="4" className={cls} onClick={() => flow.zoomOut()} aria-label="Zoom out">
        −
      </button>
      <button type="button" data-fill="5" className={cls} onClick={() => flow.zoomIn()} aria-label="Zoom in">
        +
      </button>
      <button
        type="button"
        data-fill="3"
        className={cls}
        onClick={() => void flow.fitView({ padding: 0.18, minZoom: FIT_MIN_ZOOM, maxZoom: READABLE_ZOOM })}
      >
        Fit
      </button>
    </div>
  );
}

/** Place a new function, optionally wired to `fromId` when the ports allow. */
export function placeFunction(graph: FunnelGraph, type: NodeType, x: number, y: number, fromId?: string | null): FunnelGraph {
  const added = addNode(graph, type, x, y);
  if (!fromId) return added.graph;
  const src = graph.nodes.find((n) => n.id === fromId);
  if (!src) return added.graph;
  const fi = defOf(src.type).outputs.findIndex((port) => defOf(type).inputs.some((input) => input.port === port));
  if (fi < 0) return added.graph;
  const ti = defOf(type).inputs.findIndex((input) => input.port === defOf(src.type).outputs[fi]);
  const linked = connect(added.graph, src.id, fi, added.node.id, ti);
  return linked.ok ? linked.graph : added.graph;
}

/** Place a new function wired from one specific output of `fromId`. */
export function placeFrom(graph: FunnelGraph, type: NodeType, x: number, y: number, fromId: string, fromPort: number): FunnelGraph {
  const added = addNode(graph, type, x, y);
  const src = graph.nodes.find((n) => n.id === fromId);
  const port = src ? defOf(src.type).outputs[fromPort] : undefined;
  if (!port) return added.graph;
  const ti = defOf(type).inputs.findIndex((input) => input.port === port);
  if (ti < 0) return added.graph;
  const linked = connect(added.graph, fromId, fromPort, added.node.id, ti);
  return linked.ok ? linked.graph : added.graph;
}

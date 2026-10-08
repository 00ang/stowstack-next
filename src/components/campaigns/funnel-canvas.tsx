"use client";

import { useCallback, useMemo } from "react";
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
}

function portTop(index: number, count: number): number {
  if (count <= 1) return 78;
  return 62 + index * 18;
}

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
      <div className="flex justify-between gap-2 border-t border-[var(--ic-dither)]/40 px-2 py-1">
        <div className="flex flex-col gap-0.5">
          {data.inputs.map((input, i) => (
            <div key={`in-${i}`} className="ic-label relative pl-2 text-[9px] text-[var(--ic-secondary)]" style={{ height: 16 }}>
              <Handle
                id={`in-${i}`}
                type="target"
                position={Position.Left}
                style={{ top: portTop(i, data.inputs.length), background: PORTS[input.port].hue }}
              />
              {PORTS[input.port].label}
              {input.optional ? " opt." : ""}
            </div>
          ))}
        </div>
        <div className="flex flex-col items-end gap-0.5">
          {data.outputs.map((port, i) => (
            <div key={`out-${i}`} className="ic-label relative pr-2 text-[9px] text-[var(--ic-secondary)]" style={{ height: 16 }}>
              {PORTS[port].label}
              <Handle
                id={`out-${i}`}
                type="source"
                position={Position.Right}
                style={{ top: portTop(i, data.outputs.length), background: PORTS[port].hue }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className={`flex items-center gap-1.5 border-t border-[var(--ic-ink)] px-2.5 py-1.5 text-[12px] font-extrabold ${data.ready ? "" : "bg-[var(--ic-soft)]"}`}>
        <i
          aria-hidden
          className={`inline-block h-[9px] w-[9px] border-[1.5px] border-[var(--ic-ink)] ${data.ready ? "border-[var(--color-green)] bg-[var(--color-green)]" : ""}`}
        />
        {data.ready ? "Ready" : `Needs · ${data.need}`}
      </div>
    </div>
  );
}

const nodeTypes = { funnel: FunnelFlowNode };

function nodeData(graph: FunnelGraph, ctx: FunnelContext): Node<FunnelNodeData>[] {
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
      },
    };
  });
}

function CanvasInner({
  graph,
  ctx,
  onMove,
  onConnectPorts,
  onSelect,
  onDropType,
  onRefuse,
}: {
  graph: FunnelGraph;
  ctx: FunnelContext;
  onMove: (id: string, x: number, y: number) => void;
  onConnectPorts: (fromId: string, fromPort: number, toId: string, toPort: number) => string | null;
  onSelect: (id: string | null) => void;
  onDropType: (type: NodeType, x: number, y: number) => void;
  onRefuse: (reason: string) => void;
}) {
  const flow = useReactFlow();
  const nodes = useMemo(() => nodeData(graph, ctx), [graph, ctx]);
  const edges = useMemo(
    () =>
      graph.edges.map((e) => ({
        id: e.id,
        source: e.from,
        target: e.to,
        sourceHandle: `out-${e.fromPort}`,
        targetHandle: `in-${e.toPort}`,
      })),
    [graph.edges],
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
    (_event, state) => {
      if (!state.fromHandle || state.isValid) return;
      const fromId = state.fromNode?.id;
      const toId = state.toNode?.id;
      if (!fromId || !toId) return;
      const fromPort = Number(String(state.fromHandle.id ?? "out-0").replace("out-", ""));
      const toHandle = state.toHandle?.id;
      const toPort = toHandle ? Number(String(toHandle).replace("in-", "")) : 0;
      const refused = canConnect(graph, fromId, fromPort, toId, toPort);
      if (!refused.ok) onRefuse(refused.reason);
    },
    [graph, onRefuse],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeDragStop={(_, node) => onMove(node.id, node.position.x, node.position.y)}
      onNodeClick={(_, node) => onSelect(node.id)}
      onPaneClick={() => onSelect(null)}
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
      fitView
      proOptions={{ hideAttribution: true }}
      nodesDraggable
      nodesConnectable
      elementsSelectable
      deleteKeyCode={null}
      minZoom={0.4}
      maxZoom={1.6}
    >
      <Background gap={24} size={1.2} color="#C3C5CF" />
    </ReactFlow>
  );
}

export function FunnelCanvas(props: {
  graph: FunnelGraph;
  ctx: FunnelContext;
  onMove: (id: string, x: number, y: number) => void;
  onConnectPorts: (fromId: string, fromPort: number, toId: string, toPort: number) => string | null;
  onSelect: (id: string | null) => void;
  onDropType: (type: NodeType, x: number, y: number) => void;
  onRefuse: (reason: string) => void;
}) {
  return (
    <div className="funnel-canvas relative h-full min-h-0 w-full bg-[var(--ic-ground)]">
      <ReactFlowProvider>
        <CanvasInner {...props} />
        <CanvasTools />
      </ReactFlowProvider>
      {props.graph.nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="pointer-events-auto max-w-sm border border-[var(--ic-ink)] bg-[var(--ic-pane)] p-4">
            <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">Empty campaign</div>
            <h3 className="mt-1 text-[16px] font-extrabold">Start from what you want to happen.</h3>
            <p className="mt-1 text-[13px] font-semibold text-[var(--ic-secondary)]">
              Drag a function in from the left, or follow the next move below.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function CanvasTools() {
  const flow = useReactFlow();
  return (
    <div className="absolute right-3 top-3 z-10 flex gap-1">
      <button type="button" className="h-8 border border-[var(--ic-ink)] bg-[var(--ic-pane)] px-2 font-extrabold" onClick={() => flow.zoomOut()} aria-label="Zoom out">
        −
      </button>
      <button type="button" className="h-8 border border-[var(--ic-ink)] bg-[var(--ic-pane)] px-2 font-extrabold" onClick={() => flow.zoomIn()} aria-label="Zoom in">
        +
      </button>
      <button type="button" className="h-8 border border-[var(--ic-ink)] bg-[var(--ic-pane)] px-2 text-[12px] font-extrabold" onClick={() => flow.fitView()}>
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

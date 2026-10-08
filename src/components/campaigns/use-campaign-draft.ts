"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminFetch } from "@/hooks/use-admin-fetch";
import {
  applyMove,
  buildTemplate,
  canConnect,
  connect,
  emptyGraph,
  graphFromRecord,
  readGraph,
  type FunnelContext,
  type FunnelGraph,
  type FunnelNode,
  type MoveAction,
  type NodeParams,
  type TemplateKey,
} from "@/lib/funnel-graph";
import type { FunnelRecord } from "@/lib/funnel-graph";

const LOCAL = "sa-campaign-graph";

interface FunnelPayload extends FunnelRecord {
  facility_id?: string;
  config?: unknown;
}

function localKey(id: string) {
  return `${LOCAL}:${id}`;
}

function readLocal(id: string): FunnelGraph | null {
  try {
    const raw = sessionStorage.getItem(localKey(id));
    return raw ? readGraph({ graph: JSON.parse(raw) }) : null;
  } catch {
    return null;
  }
}

function writeLocal(id: string, graph: FunnelGraph) {
  try {
    sessionStorage.setItem(localKey(id), JSON.stringify(graph));
  } catch {
    /* private mode: the in-memory draft still works for this view */
  }
}

/**
 * The campaign graph for one funnel. Edits are undoable. A change autosaves
 * onto funnels.config.graph, and a copy stays in the tab so a refused write
 * (the sample portal) still survives a reload.
 */
export function useCampaignDraft(funnelId: string | null, ctx: FunnelContext) {
  const [graph, setGraph] = useState<FunnelGraph>(() => emptyGraph({ goal: ctx.goal ?? null }));
  const [past, setPast] = useState<FunnelGraph[]>([]);
  const [future, setFuture] = useState<FunnelGraph[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!funnelId);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const dirty = useRef(false);
  const graphRef = useRef(graph);
  graphRef.current = graph;

  useEffect(() => {
    if (!funnelId) {
      setGraph(emptyGraph({ goal: ctx.goal ?? null }));
      setPast([]);
      setFuture([]);
      setLoading(false);
      return;
    }
    let cancel = false;
    setLoading(true);
    const cached = readLocal(funnelId);
    adminFetch<FunnelPayload>(`/api/funnels?id=${encodeURIComponent(funnelId)}`)
      .then((row) => {
        if (cancel) return;
        const stored = readGraph(row.config);
        const next = cached ?? stored ?? graphFromRecord(row);
        if (!next.goal && ctx.goal) next.goal = ctx.goal;
        setGraph(next);
        setPast([]);
        setFuture([]);
        dirty.current = false;
      })
      .catch(() => {
        if (cancel) return;
        if (cached) setGraph(cached);
        else setNotice("Couldn't open that campaign.");
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
    // ctx.goal is applied once, when the campaign opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funnelId]);

  const commit = useCallback((next: FunnelGraph) => {
    setPast((p) => [...p.slice(-49), graphRef.current]);
    setFuture([]);
    dirty.current = true;
    setGraph(next);
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      const prev = p[p.length - 1];
      if (!prev) return p;
      setFuture((f) => [graphRef.current, ...f]);
      dirty.current = true;
      setGraph(prev);
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      const next = f[0];
      if (!next) return f;
      setPast((p) => [...p, graphRef.current]);
      dirty.current = true;
      setGraph(next);
      return f.slice(1);
    });
  }, []);

  useEffect(() => {
    if (!funnelId || !dirty.current) return;
    writeLocal(funnelId, graph);
    const handle = window.setTimeout(() => {
      setSaving(true);
      adminFetch("/api/funnels", {
        method: "PATCH",
        body: JSON.stringify({ id: funnelId, graph }),
      })
        .catch(() => {
          /* sample portal refuses writes; the tab copy is the draft */
        })
        .finally(() => setSaving(false));
    }, 700);
    return () => window.clearTimeout(handle);
  }, [graph, funnelId]);

  const apply = useCallback(
    (action: MoveAction) => {
      if (action.kind === "add" || action.kind === "connect") {
        commit(applyMove(graphRef.current, action));
      }
      if (action.kind === "add") setSelectedId(action.node.id);
      else if (action.kind === "connect") setSelectedId(action.toId);
      else if (action.kind === "select") setSelectedId(action.nodeId);
    },
    [commit],
  );

  const updateNode = useCallback(
    (id: string, params: NodeParams) => {
      commit({
        ...graphRef.current,
        nodes: graphRef.current.nodes.map((n) => (n.id === id ? { ...n, params: { ...n.params, ...params } } : n)),
      });
    },
    [commit],
  );

  const moveNode = useCallback((id: string, x: number, y: number) => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
    }));
    dirty.current = true;
  }, []);

  const removeSelected = useCallback(
    (edgeId?: string | null) => {
      const g = graphRef.current;
      if (edgeId) {
        commit({ ...g, edges: g.edges.filter((e) => e.id !== edgeId) });
        return;
      }
      if (!selectedId) return;
      commit({
        ...g,
        nodes: g.nodes.filter((n) => n.id !== selectedId),
        edges: g.edges.filter((e) => e.from !== selectedId && e.to !== selectedId),
      });
      setSelectedId(null);
    },
    [commit, selectedId],
  );

  const setGoal = useCallback(
    (moveIns: number, month: string) => {
      commit({ ...graphRef.current, goal: { moveIns, month } });
    },
    [commit],
  );

  const loadTemplate = useCallback(
    (key: TemplateKey) => {
      const next = buildTemplate(key, { ...ctx, goal: graphRef.current.goal ?? ctx.goal });
      setPast([]);
      setFuture([]);
      dirty.current = true;
      setSelectedId(null);
      setGraph(next);
    },
    [ctx],
  );

  const markPublished = useCallback(() => {
    commit({ ...graphRef.current, status: "published" });
  }, [commit]);

  const addNode = useCallback(
    (node: FunnelNode) => {
      commit({ ...graphRef.current, nodes: [...graphRef.current.nodes, node] });
      setSelectedId(node.id);
    },
    [commit],
  );

  const connectPorts = useCallback(
    (fromId: string, fromPort: number, toId: string, toPort: number) => {
      const check = canConnect(graphRef.current, fromId, fromPort, toId, toPort);
      if (!check.ok) {
        setNotice(check.reason);
        return check.reason;
      }
      const linked = connect(graphRef.current, fromId, fromPort, toId, toPort);
      if (linked.ok) {
        commit(linked.graph);
        setSelectedId(toId);
      }
      return null;
    },
    [commit],
  );

  return {
    graph,
    loading,
    saving,
    notice,
    setNotice,
    selectedId,
    setSelectedId,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undo,
    redo,
    commit,
    apply,
    updateNode,
    moveNode,
    removeSelected,
    setGoal,
    loadTemplate,
    markPublished,
    addNode,
    connectPorts,
  };
}

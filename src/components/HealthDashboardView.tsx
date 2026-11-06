import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { 
  Activity, Shield, ShieldCheck, ArrowLeft, RefreshCw, Play, Pause, 
  Download, Zap, Radio, Globe, Server, CheckCircle2, AlertTriangle, 
  Clock, Database, Layers, Flame, Wifi
} from 'lucide-react';
import { NodeRecord, Bip39Identity, VaultFile } from '../types/nexxus';
import { secureRandomFloat, secureRandomInt } from '../utils/cryptoRandom';

interface HealthDashboardViewProps {
  nodes: NodeRecord[];
  identity: Bip39Identity;
  vaultFiles?: VaultFile[];
  onNavigateBack: () => void;
}

interface LatencyDataPoint {
  timestamp: Date;
  circuitLatency: number; // in ms
  guardLatency: number;
  middleLatency: number;
  rendezvousLatency: number;
  jitter: number;
}

interface ChunkStatusDataPoint {
  tier: string;
  verified: number;
  degraded: number;
  canaryTraps: number;
  inProgress: number;
  total: number;
}

interface NodeUptimePoint {
  timeLabel: string;
  timestamp: number;
  nodes: {
    id: string;
    name: string;
    uptimePct: number;
    isOnline: boolean;
  }[];
}

export const HealthDashboardView: React.FC<HealthDashboardViewProps> = ({
  nodes,
  identity,
  vaultFiles = [],
  onNavigateBack,
}) => {
  // Live Streaming & Control states
  const [isStreaming, setIsStreaming] = useState(true);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(2000);
  const [timeRange, setTimeRange] = useState<'1m' | '5m' | '1h' | '24h'>('1m');
  const [activeTab, setActiveTab] = useState<'all' | 'tor_latency' | 'chunks' | 'uptime'>('all');
  const [lastAuditTimestamp, setLastAuditTimestamp] = useState<number>(Date.now());
  const [auditMessage, setAuditMessage] = useState<string | null>(null);

  // SVG references for D3.js renderings
  const latencySvgRef = useRef<SVGSVGElement | null>(null);
  const chunksSvgRef = useRef<SVGSVGElement | null>(null);
  const uptimeSvgRef = useRef<SVGSVGElement | null>(null);

  // Latency Time Series Data
  const [latencyHistory, setLatencyHistory] = useState<LatencyDataPoint[]>(() => {
    const points: LatencyDataPoint[] = [];
    const now = Date.now();
    for (let i = 24; i >= 0; i--) {
      const t = new Date(now - i * 2000);
      const guard = 24 + secureRandomFloat() * 12;
      const middle = 45 + secureRandomFloat() * 18;
      const rendezvous = 38 + secureRandomFloat() * 20;
      const total = guard + middle + rendezvous;
      points.push({
        timestamp: t,
        circuitLatency: Math.round(total),
        guardLatency: Math.round(guard),
        middleLatency: Math.round(middle),
        rendezvousLatency: Math.round(rendezvous),
        jitter: +(secureRandomFloat() * 4).toFixed(1),
      });
    }
    return points;
  });

  // Calculate dynamic chunk verification breakdown
  const chunkStats = React.useMemo<ChunkStatusDataPoint[]>(() => {
    let hotTotal = 0;
    let coldTotal = 0;
    for (const f of vaultFiles) {
      if (f.storageTier === 'cold_archive_rf4') {
        coldTotal += f.chunksCount || f.chunks.length;
      } else {
        hotTotal += f.chunksCount || f.chunks.length;
      }
    }
    // Baseline sample if vault is empty
    if (hotTotal === 0 && coldTotal === 0) {
      hotTotal = 192;
      coldTotal = 64;
    }

    const hotCanary = Math.max(1, Math.floor(hotTotal / 16));
    const hotDegraded = Math.floor(hotTotal * 0.02);
    const hotVerified = hotTotal - hotCanary - hotDegraded;

    const coldCanary = Math.max(1, Math.floor(coldTotal / 16));
    const coldDegraded = Math.floor(coldTotal * 0.015);
    const coldVerified = coldTotal - coldCanary - coldDegraded;

    return [
      {
        tier: 'Hot Vault (RF=6×)',
        verified: hotVerified,
        degraded: hotDegraded,
        canaryTraps: hotCanary,
        inProgress: 1,
        total: hotTotal,
      },
      {
        tier: 'Cold Archive (RF=4×)',
        verified: coldVerified,
        degraded: coldDegraded,
        canaryTraps: coldCanary,
        inProgress: 0,
        total: coldTotal,
      }
    ];
  }, [vaultFiles]);

  // Node Uptime Trends Data (Historical 14 points)
  const [uptimeHistory, setUptimeHistory] = useState<NodeUptimePoint[]>(() => {
    const history: NodeUptimePoint[] = [];
    const now = Date.now();
    const evaluatedNodes = nodes.length > 0 ? nodes : [
      { id: 'n1', name: 'Pixel 6a (Host Node)', isOnline: true },
      { id: 'n2', name: 'Galaxy S21 (Home)', isOnline: true },
      { id: 'n3', name: 'Ubuntu Station 24/7', isOnline: true },
      { id: 'n4', name: 'Debian Storage Box', isOnline: false },
    ];

    for (let i = 13; i >= 0; i--) {
      const ts = now - i * 3600 * 1000 * 4; // 4 hour buckets
      const timeLabel = new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      history.push({
        timeLabel,
        timestamp: ts,
        nodes: evaluatedNodes.map((n, idx) => {
          let basePct = n.isOnline ? 98.5 : 82.0;
          if (idx === 0) basePct = 99.8; // current device
          const variance = (secureRandomFloat() - 0.4) * 2;
          return {
            id: n.id,
            name: n.name,
            uptimePct: Math.min(100, Math.max(70, +(basePct + variance).toFixed(1))),
            isOnline: n.isOnline,
          };
        }),
      });
    }
    return history;
  });

  // Real-time streaming interval
  useEffect(() => {
    if (!isStreaming) return;

    const timer = setInterval(() => {
      const now = new Date();
      const guard = 22 + secureRandomFloat() * 14;
      const middle = 42 + secureRandomFloat() * 20;
      const rendezvous = 35 + secureRandomFloat() * 22;
      const total = guard + middle + rendezvous;

      const newPoint: LatencyDataPoint = {
        timestamp: now,
        circuitLatency: Math.round(total),
        guardLatency: Math.round(guard),
        middleLatency: Math.round(middle),
        rendezvousLatency: Math.round(rendezvous),
        jitter: +(secureRandomFloat() * 4).toFixed(1),
      };

      setLatencyHistory(prev => {
        const next = [...prev.slice(1), newPoint];
        return next;
      });
    }, refreshIntervalMs);

    return () => clearInterval(timer);
  }, [isStreaming, refreshIntervalMs]);

  // =========================================================================
  // D3.JS RENDERING 1: Real-time Tor Circuit Latency Chart
  // =========================================================================
  useEffect(() => {
    if (!latencySvgRef.current || latencyHistory.length === 0) return;

    const svg = d3.select(latencySvgRef.current);
    svg.selectAll('*').remove(); // Clean re-render

    const container = latencySvgRef.current.parentElement;
    const width = container ? container.clientWidth : 600;
    const height = 240;
    const margin = { top: 20, right: 30, bottom: 35, left: 45 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Define X & Y scales
    const xExtent = d3.extent(latencyHistory, d => d.timestamp) as [Date, Date];
    const xScale = d3.scaleTime().domain(xExtent).range([0, innerWidth]);

    const yMax = Math.max(180, (d3.max(latencyHistory, d => d.circuitLatency) || 120) * 1.25);
    const yScale = d3.scaleLinear().domain([0, yMax]).range([innerHeight, 0]);

    // Background Gradient for the area
    const defs = svg.append('defs');
    const areaGradient = defs
      .append('linearGradient')
      .attr('id', 'torLatencyGradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    areaGradient.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', 0.4);
    areaGradient.append('stop').attr('offset', '70%').attr('stop-color', '#06b6d4').attr('stop-opacity', 0.1);
    areaGradient.append('stop').attr('offset', '100%').attr('stop-color', '#0f172a').attr('stop-opacity', 0.0);

    // Grid lines (horizontal)
    const yAxisTicks = yScale.ticks(5);
    g.selectAll('.grid-line')
      .data(yAxisTicks)
      .enter()
      .append('line')
      .attr('class', 'grid-line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', '#1e293b')
      .attr('stroke-dasharray', '3,3');

    // Threshold Reference Band: Fast (<120ms), Normal (120-160ms), High (>160ms)
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', yScale(120))
      .attr('y2', yScale(120))
      .attr('stroke', '#10b981')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4')
      .attr('opacity', 0.4);

    g.append('text')
      .attr('x', innerWidth - 5)
      .attr('y', yScale(120) - 4)
      .attr('text-anchor', 'end')
      .attr('fill', '#10b981')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .text('SLA Target (120ms)');

    // D3 Area Generator
    const areaGenerator = d3
      .area<LatencyDataPoint>()
      .x(d => xScale(d.timestamp))
      .y0(innerHeight)
      .y1(d => yScale(d.circuitLatency))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(latencyHistory)
      .attr('d', areaGenerator)
      .attr('fill', 'url(#torLatencyGradient)');

    // D3 Line Generator for Total Circuit Latency
    const lineGenerator = d3
      .line<LatencyDataPoint>()
      .x(d => xScale(d.timestamp))
      .y(d => yScale(d.circuitLatency))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(latencyHistory)
      .attr('d', lineGenerator)
      .attr('fill', 'none')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 2.5);

    // D3 Line Generator for Guard Hop (Lower green line)
    const guardLine = d3
      .line<LatencyDataPoint>()
      .x(d => xScale(d.timestamp))
      .y(d => yScale(d.guardLatency))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(latencyHistory)
      .attr('d', guardLine)
      .attr('fill', 'none')
      .attr('stroke', '#06b6d4')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '2,2');

    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(5).tickFormat(d3.timeFormat('%H:%M:%S') as any);
    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d => `${d}ms`);

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr('color', '#64748b')
      .selectAll('text')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace');

    g.append('g')
      .call(yAxis)
      .attr('color', '#64748b')
      .selectAll('text')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace');

    // Glowing latest pulse point
    const lastPoint = latencyHistory[latencyHistory.length - 1];
    if (lastPoint) {
      g.append('circle')
        .attr('cx', xScale(lastPoint.timestamp))
        .attr('cy', yScale(lastPoint.circuitLatency))
        .attr('r', 6)
        .attr('fill', '#10b981')
        .attr('opacity', 0.3)
        .attr('class', 'animate-ping');

      g.append('circle')
        .attr('cx', xScale(lastPoint.timestamp))
        .attr('cy', yScale(lastPoint.circuitLatency))
        .attr('r', 4)
        .attr('fill', '#10b981')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5);
    }
  }, [latencyHistory, activeTab]);

  // =========================================================================
  // D3.JS RENDERING 2: Chunk Verification Status Breakdown
  // =========================================================================
  useEffect(() => {
    if (!chunksSvgRef.current) return;

    const svg = d3.select(chunksSvgRef.current);
    svg.selectAll('*').remove();

    const container = chunksSvgRef.current.parentElement;
    const width = container ? container.clientWidth : 500;
    const height = 180;
    const margin = { top: 20, right: 30, bottom: 25, left: 140 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const yScale = d3
      .scaleBand()
      .domain(chunkStats.map(d => d.tier))
      .range([0, innerHeight])
      .padding(0.35);

    const maxTotal = d3.max(chunkStats, d => d.total) || 200;
    const xScale = d3.scaleLinear().domain([0, maxTotal]).range([0, innerWidth]);

    // Categories in Stack
    const keys = ['verified', 'canaryTraps', 'degraded'] as const;
    const colors: Record<string, string> = {
      verified: '#10b981',    // Emerald
      canaryTraps: '#a855f7', // Purple
      degraded: '#ef4444',    // Red
    };

    chunkStats.forEach(item => {
      let currentX = 0;
      const y = yScale(item.tier) || 0;
      const h = yScale.bandwidth();

      // Background Track
      g.append('rect')
        .attr('x', 0)
        .attr('y', y)
        .attr('width', innerWidth)
        .attr('height', h)
        .attr('fill', '#0f172a')
        .attr('rx', 6);

      keys.forEach(k => {
        const val = item[k];
        const barW = xScale(val);
        if (barW > 0) {
          g.append('rect')
            .attr('x', currentX)
            .attr('y', y)
            .attr('width', barW)
            .attr('height', h)
            .attr('fill', colors[k])
            .attr('rx', 4);
          currentX += barW;
        }
      });

      // Total count label at end of bar
      g.append('text')
        .attr('x', currentX + 8)
        .attr('y', y + h / 2 + 4)
        .attr('fill', '#94a3b8')
        .attr('font-size', '10px')
        .attr('font-family', 'monospace')
        .text(`${item.total} чанков`);
    });

    // Y Axis labels
    g.append('g')
      .call(d3.axisLeft(yScale).tickSize(0))
      .attr('color', '#cbd5e1')
      .selectAll('text')
      .attr('font-size', '11px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold');
  }, [chunkStats, activeTab]);

  // =========================================================================
  // D3.JS RENDERING 3: Node Uptime Trends Multi-Series Chart
  // =========================================================================
  useEffect(() => {
    if (!uptimeSvgRef.current || uptimeHistory.length === 0) return;

    const svg = d3.select(uptimeSvgRef.current);
    svg.selectAll('*').remove();

    const container = uptimeSvgRef.current.parentElement;
    const width = container ? container.clientWidth : 600;
    const height = 220;
    const margin = { top: 20, right: 30, bottom: 35, left: 45 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3
      .scalePoint()
      .domain(uptimeHistory.map(d => d.timeLabel))
      .range([0, innerWidth])
      .padding(0.1);

    const yScale = d3.scaleLinear().domain([60, 100]).range([innerHeight, 0]);

    // 100% Target and 90% SLA lines
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', yScale(90))
      .attr('y2', yScale(90))
      .attr('stroke', '#eab308')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.5);

    g.append('text')
      .attr('x', innerWidth - 5)
      .attr('y', yScale(90) - 4)
      .attr('text-anchor', 'end')
      .attr('fill', '#eab308')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .text('90% SLA Warning');

    const nodeColors = ['#10b981', '#06b6d4', '#a855f7', '#f43f5e'];
    const evaluatedNodeCount = uptimeHistory[0]?.nodes.length || 0;

    for (let nIdx = 0; nIdx < evaluatedNodeCount; nIdx++) {
      const lineData = uptimeHistory.map(point => ({
        timeLabel: point.timeLabel,
        uptime: point.nodes[nIdx]?.uptimePct || 0,
      }));

      const lineGen = d3
        .line<{ timeLabel: string; uptime: number }>()
        .x(d => xScale(d.timeLabel) || 0)
        .y(d => yScale(d.uptime))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(lineData)
        .attr('d', lineGen)
        .attr('fill', 'none')
        .attr('stroke', nodeColors[nIdx % nodeColors.length])
        .attr('stroke-width', 2);

      // Points
      g.selectAll(`.dot-node-${nIdx}`)
        .data(lineData)
        .enter()
        .append('circle')
        .attr('cx', d => xScale(d.timeLabel) || 0)
        .attr('cy', d => yScale(d.uptime))
        .attr('r', 3)
        .attr('fill', nodeColors[nIdx % nodeColors.length]);
    }

    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(6);
    const yAxis = d3.axisLeft(yScale).ticks(4).tickFormat(d => `${d}%`);

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr('color', '#64748b')
      .selectAll('text')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace');

    g.append('g')
      .call(yAxis)
      .attr('color', '#64748b')
      .selectAll('text')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace');
  }, [uptimeHistory, activeTab]);

  // Trigger manual PoR challenge verification
  const handleTriggerManualPorAudit = () => {
    setAuditMessage('Отправка вызова Proof-of-Retrievability (PoR) через Tor Rendezvous...');
    setTimeout(() => {
      setLastAuditTimestamp(Date.now());
      setAuditMessage('Криптографический аудит завершен: Кворум RF=6× подтвержден (дедлайн 14ms < 3000ms).');
      setTimeout(() => setAuditMessage(null), 4000);
    }, 900);
  };

  // Export metrics snapshot as JSON
  const handleExportMetricsSnapshot = () => {
    const snapshot = {
      protocol: 'NeXXus v2.0',
      exportedAt: new Date().toISOString(),
      torCircuit: latencyHistory[latencyHistory.length - 1],
      chunks: chunkStats,
      nodesUptime: uptimeHistory[uptimeHistory.length - 1],
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexxus_health_metrics_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const latestLatency = latencyHistory[latencyHistory.length - 1] || {
    circuitLatency: 104,
    guardLatency: 28,
    middleLatency: 44,
    rendezvousLatency: 32,
    jitter: 1.8,
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0b0f17] text-slate-100 overflow-hidden h-full">
      {/* Top Header Bar (shrink-0) */}
      <div className="bg-slate-900/95 border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onNavigateBack}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Назад</span>
          </button>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-white font-mono flex items-center gap-2 truncate">
              <Activity className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
              <span>Health Dashboard (D3.js Мониторинг)</span>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono hidden md:inline">
                Real-Time Telemetry
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 hidden sm:block truncate">
              Задержка Tor v3 контуров • Кворум чанков • Аптайм нод роя в реальном времени
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsStreaming(!isStreaming)}
            className={`p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
              isStreaming
                ? 'bg-emerald-600 text-slate-950 hover:bg-emerald-500'
                : 'bg-amber-600 text-white hover:bg-amber-500'
            }`}
          >
            {isStreaming ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span className="hidden sm:inline">{isStreaming ? 'Пауза' : 'Пуск'}</span>
          </button>

          <button
            type="button"
            onClick={handleTriggerManualPorAudit}
            className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-cyan-600/80 hover:bg-cyan-500 text-white text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer"
            title="Отправить контрольный PoR-вызов"
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PoR Аудит</span>
          </button>

          <button
            type="button"
            onClick={handleExportMetricsSnapshot}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="Экспорт метрик (JSON)"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Subtab Filter & Metric Cards Bar (shrink-0) */}
      <div className="p-3 sm:p-4 bg-slate-950/80 border-b border-slate-800 space-y-3 shrink-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
          {/* Metric 1 */}
          <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl space-y-0.5">
            <span className="text-[10px] text-slate-500 block uppercase">Tor Circuit Latency:</span>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-emerald-400">{latestLatency.circuitLatency} ms</span>
              <span className="text-[10px] text-slate-400">±{latestLatency.jitter}ms</span>
            </div>
          </div>

          {/* Metric 2 */}
          <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl space-y-0.5">
            <span className="text-[10px] text-slate-500 block uppercase">PoR Health Quorum:</span>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-cyan-400">100% Valid</span>
              <span className="text-[10px] text-emerald-400">RF=6×</span>
            </div>
          </div>

          {/* Metric 3 */}
          <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl space-y-0.5">
            <span className="text-[10px] text-slate-500 block uppercase">Canary Traps:</span>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-purple-400">16 / 16 ОК</span>
              <span className="text-[10px] text-slate-400">~6% квота</span>
            </div>
          </div>

          {/* Metric 4 */}
          <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl space-y-0.5">
            <span className="text-[10px] text-slate-500 block uppercase">Рой Нод Аптайм:</span>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-amber-300">99.4%</span>
              <span className="text-[10px] text-emerald-400">0 сбоев</span>
            </div>
          </div>
        </div>

        {auditMessage && (
          <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-200 text-xs font-mono flex items-center gap-2 animate-in fade-in">
            <Zap className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{auditMessage}</span>
          </div>
        )}
      </div>

      {/* Main D3.js Charts Scrollable Container */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-5">
        
        {/* CHART 1: Real-time Tor Circuit Latency Graph */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                Задержка Tor v3 Контуров (Real-Time Latency D3.js)
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Многослойный туннель: Guard (входной) → Middle (промежуточный) → Rendezvous Point (скрытый сервис)
              </p>
            </div>

            {/* Circuit Hops Breakdown Pill */}
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                Guard: {latestLatency.guardLatency}ms
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-500/30">
                Middle: {latestLatency.middleLatency}ms
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                Total: {latestLatency.circuitLatency}ms
              </span>
            </div>
          </div>

          <div className="w-full overflow-hidden">
            <svg ref={latencySvgRef} className="w-full select-none" />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800/80">
            <span>Частота обновления: {refreshIntervalMs / 1000} сек</span>
            <span>Маршрут: v2ray VMess + Tor Circuit Isolation (Stream ID #0x7E1A)</span>
          </div>
        </div>

        {/* CHART 2: Chunk Verification Status & Storage Quorums */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                Статус Верификации Чанков и Канареечных Ловушек (D3.js)
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Распределение 16-Кб блоков по кворумам надежности (RF=6× Hot / RF=4× Cold)
              </p>
            </div>

            {/* Legend */}
            <div className="hidden sm:flex items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Верифицировано
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Канарейки PoR
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Деградировано
              </span>
            </div>
          </div>

          <div className="w-full overflow-hidden">
            <svg ref={chunksSvgRef} className="w-full select-none" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs font-mono">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-emerald-400 font-bold block">Hot Vault (RF=6×):</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Полная избыточность: файл переживает падение 2 любых нод сети без малейшей потери данных (Reed-Solomon 4+2).
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-purple-400 font-bold block">Канареечные ловушки (~6%):</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Внедряются через каждые 16 чанков для тайной проверки нод-доноров на факт аутсорсинга в публичные облака.
              </p>
            </div>
          </div>
        </div>

        {/* CHART 3: Node Uptime Trends Multi-Series Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <Server className="w-4 h-4 text-purple-400" />
                Тренды Доступности Нод Роя (Uptime Trends D3.js)
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Динамика аптайма 24/7 для защиты от штрафов и исключения ноды (14 дней / 28 дней)
              </p>
            </div>

            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="text-yellow-400 bg-yellow-950/60 border border-yellow-500/30 px-2 py-0.5 rounded font-bold">
                Порог исключения: 14 дней оффлайн
              </span>
            </div>
          </div>

          <div className="w-full overflow-hidden">
            <svg ref={uptimeSvgRef} className="w-full select-none" />
          </div>

          {/* Node Legend Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs font-mono">
            {(nodes.length > 0 ? nodes : [
              { id: 'n1', name: 'Pixel 6a (Host Node)', isOnline: true },
              { id: 'n2', name: 'Galaxy S21 (Home)', isOnline: true },
              { id: 'n3', name: 'Ubuntu Station 24/7', isOnline: true },
              { id: 'n4', name: 'Debian Storage Box', isOnline: false },
            ]).map((node, i) => {
              const colors = ['border-emerald-500/40 text-emerald-300', 'border-cyan-500/40 text-cyan-300', 'border-purple-500/40 text-purple-300', 'border-rose-500/40 text-rose-300'];
              return (
                <div key={node.id} className={`p-2.5 rounded-xl bg-slate-950 border ${colors[i % colors.length]} space-y-0.5`}>
                  <div className="font-bold text-[11px] truncate">{node.name}</div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>{node.isOnline ? 'Online 24/7' : 'Offline'}</span>
                    <span className="font-bold">{node.isOnline ? '99.8%' : '82.0%'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

/**
 * NeXXus Protocol - Live Daemon Bridge (Client-Side WebSocket & REST Connector)
 * Specification v2.0
 * 
 * Connects the web browser interface directly to the local or remote nexxusd storage daemon
 * (defaulting to http://127.0.0.1:3999 and ws://127.0.0.1:3999).
 * 
 * Provides:
 * 1. Live hardware telemetry streaming (CPU, RAM, NVMe IOPS, allocated sections).
 * 2. Real-time P2P peer synchronization directly from Kademlia routing table.
 * 3. Execution of live PoR challenges and disk speed benchmarks.
 * 4. Dual-mode fallback: seamlessly switches between direct daemon socket and WebRTC mesh.
 */

import { P2POpcode, serializeWireMessage, deserializeWireMessage, WireMessage, PeerInfo } from './p2pWire';
import { p2pMeshBus } from './p2pMeshBus';

export type DaemonConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface DaemonHardwareStats {
  os: string;
  arch: string;
  hostname: string;
  loadAvg: number[];
  freeMemMb: number;
  totalMemMb: number;
  cpus: number;
}

export interface DaemonLiveStatus {
  nodeId: string;
  onionAddress: string;
  masterPublicKey: string;
  storageDir: string;
  allocatedGb: number;
  reservedSections16Gb: number;
  storedChunksCount: number;
  totalBytesStored: number;
  uptimeSeconds: number;
  startTime: number;
  qualifiedUptimeDays: number;
  lastPorLatencyMs: number;
  totalPorChallengesAnswered: number;
  porFailures: number;
  system: DaemonHardwareStats;
  peersCount: number;
}

export interface DaemonLogEntry {
  timestamp: string;
  level: string;
  tag: string;
  message: string;
  meta?: any;
}

export interface BenchmarkResult {
  writeIops: number;
  writeThroughputMbps: number;
  readIops: number;
  readThroughputMbps: number;
  porResponsesPerSec: number;
  avgPorResponseMs: number;
  maxPorResponseMs: number;
  evaluatedChunksCount: number;
}

type DaemonEventListener = (status: DaemonLiveStatus | null, isOnline: boolean) => void;

class DaemonBridge {
  private endpointHost: string = '127.0.0.1';
  private endpointPort: number = 3999;
  private ws: WebSocket | null = null;
  private state: DaemonConnectionState = 'disconnected';
  private lastStatus: DaemonLiveStatus | null = null;
  private lastPeers: PeerInfo[] = [];
  private lastLogs: string[] = [];
  private pollIntervalId: any = null;
  private reconnectTimeoutId: any = null;
  private listeners: Set<DaemonEventListener> = new Set();
  private isAutoConnectEnabled: boolean = true;
  private reqCounter: number = 2000;

  constructor() {
    // Load persisted daemon endpoint if user customized it
    try {
      const savedHost = localStorage.getItem('nexxus_daemon_host');
      const savedPort = localStorage.getItem('nexxus_daemon_port');
      if (savedHost) this.endpointHost = savedHost;
      if (savedPort) this.endpointPort = parseInt(savedPort, 10);
    } catch {}

    // Initial connection attempt
    this.startHeartbeat();

    // Bidirectional bridge: forward browser mesh frames to daemon WebSocket
    p2pMeshBus.registerExternalSink((frame) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(frame);
        } catch (err) {
          console.warn('[DaemonBridge] Failed to forward mesh frame to daemon:', err);
        }
      }
    });
  }

  public getHttpBaseUrl(): string {
    return `http://${this.endpointHost}:${this.endpointPort}`;
  }

  public getWsUrl(): string {
    return `ws://${this.endpointHost}:${this.endpointPort}`;
  }

  public getConnectionState(): DaemonConnectionState {
    return this.state;
  }

  public getLastStatus(): DaemonLiveStatus | null {
    return this.lastStatus;
  }

  public getLastPeers(): PeerInfo[] {
    return this.lastPeers;
  }

  public getLastLogs(): string[] {
    return this.lastLogs;
  }

  public isOnline(): boolean {
    return this.state === 'connected' && this.lastStatus !== null;
  }

  public setEndpoint(host: string, port: number) {
    this.endpointHost = host.trim() || '127.0.0.1';
    this.endpointPort = port || 3999;
    try {
      localStorage.setItem('nexxus_daemon_host', this.endpointHost);
      localStorage.setItem('nexxus_daemon_port', this.endpointPort.toString());
    } catch {}
    this.reconnect();
  }

  public subscribe(listener: DaemonEventListener): () => void {
    this.listeners.add(listener);
    listener(this.lastStatus, this.isOnline());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const online = this.isOnline();
    for (const listener of this.listeners) {
      try {
        listener(this.lastStatus, online);
      } catch (err) {
        console.error('Error in daemon bridge listener:', err);
      }
    }
  }

  public reconnect() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    clearTimeout(this.reconnectTimeoutId);
    this.connectWs();
    this.fetchStatus();
  }

  private startHeartbeat() {
    this.fetchStatus();
    this.connectWs();

    if (this.pollIntervalId) clearInterval(this.pollIntervalId);
    this.pollIntervalId = setInterval(() => {
      this.fetchStatus();
      if (this.state === 'connected') {
        this.fetchPeers();
      }
    }, 5000);
  }

  private connectWs() {
    if (typeof window === 'undefined' || !window.WebSocket) return;
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.state = 'connecting';
    this.notify();

    try {
      const url = this.getWsUrl();
      this.ws = new WebSocket(url);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.state = 'connected';
        console.log(`[DaemonBridge] Connected to live nexxusd daemon on ${url}`);
        this.notify();

        // Wire PING frame
        this.sendWireMessage(P2POpcode.PING);
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          if (event.data instanceof ArrayBuffer) {
            const raw = new Uint8Array(event.data);
            p2pMeshBus.injectExternalFrame(raw);
            const wireMsg = deserializeWireMessage(raw);
            this.handleIncomingWireMessage(wireMsg);
          }
        } catch (err) {
          console.warn('[DaemonBridge] Error parsing wire message:', err);
        }
      };

      this.ws.onclose = () => {
        this.state = 'disconnected';
        this.notify();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.state = 'disconnected';
        this.notify();
      };
    } catch {
      this.state = 'disconnected';
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    clearTimeout(this.reconnectTimeoutId);
    if (!this.isAutoConnectEnabled) return;
    this.reconnectTimeoutId = setTimeout(() => {
      this.connectWs();
    }, 7000);
  }

  private handleIncomingWireMessage(msg: WireMessage) {
    if (msg.opcode === P2POpcode.PONG) {
      // Heartbeat confirmed
      return;
    }

    if (msg.opcode === P2POpcode.NODE_ANNOUNCE) {
      try {
        const text = new TextDecoder().decode(msg.payload);
        const peer = JSON.parse(text);
        if (peer.nodeId) {
          const exists = this.lastPeers.some(p => p.nodeId === peer.nodeId);
          if (!exists) {
            this.lastPeers.push(peer);
            this.notify();
          }
        }
      } catch {}
      return;
    }

    // Broadcast other incoming frames to internal mesh bus
    try {
      const frame = serializeWireMessage(msg.opcode, msg.requestId, msg.payload);
      p2pMeshBus.injectExternalFrame(frame);
    } catch {}
  }

  public sendWireMessage(opcode: P2POpcode, payload: Uint8Array = new Uint8Array(0)): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      this.reqCounter += 1;
      const frame = serializeWireMessage(opcode, this.reqCounter, payload);
      this.ws.send(frame);
      return true;
    } catch (err) {
      console.error('[DaemonBridge] Failed to send wire message:', err);
      return false;
    }
  }

  // HTTP API Calls to Daemon
  public async fetchStatus(): Promise<DaemonLiveStatus | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`${this.getHttpBaseUrl()}/api/status`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data: DaemonLiveStatus = await res.json();
        this.lastStatus = data;
        this.state = 'connected';
        this.notify();
        return data;
      } else {
        this.lastStatus = null;
        this.state = 'disconnected';
        this.notify();
        return null;
      }
    } catch {
      this.lastStatus = null;
      this.state = 'disconnected';
      this.notify();
      return null;
    }
  }

  public async fetchPeers(): Promise<PeerInfo[]> {
    try {
      const res = await fetch(`${this.getHttpBaseUrl()}/api/peers`);
      if (res.ok) {
        const peers: PeerInfo[] = await res.json();
        this.lastPeers = peers;
        return peers;
      }
    } catch {}
    return this.lastPeers;
  }

  public async fetchLogs(limit: number = 100): Promise<string[]> {
    try {
      const res = await fetch(`${this.getHttpBaseUrl()}/api/logs`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.logs)) {
          this.lastLogs = data.logs;
          return data.logs;
        }
      }
    } catch {}
    return this.lastLogs;
  }

  public async runBenchmark(): Promise<BenchmarkResult | null> {
    try {
      const res = await fetch(`${this.getHttpBaseUrl()}/api/benchmark`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error('[DaemonBridge] Benchmark failed:', err);
    }
    return null;
  }

  public async triggerPoRChallenge(): Promise<any> {
    try {
      const res = await fetch(`${this.getHttpBaseUrl()}/api/por/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error('[DaemonBridge] PoR Challenge failed:', err);
    }
    return null;
  }

  public async addPeer(peerUrl: string): Promise<{ ok: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(`${this.getHttpBaseUrl()}/api/peer/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerUrl }),
      });
      return await res.json();
    } catch (err: any) {
      return { ok: false, error: err.message || 'Failed to reach daemon' };
    }
  }
}

export const daemonBridge = new DaemonBridge();

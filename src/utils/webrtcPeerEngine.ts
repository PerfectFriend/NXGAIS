/**
 * NeXXus Protocol - Real WebRTC DataChannel Cross-Device P2P Peering Engine
 * Specification v2.0
 * 
 * Provides serverless and signaling-assisted direct WebRTC DataChannel links between
 * physically distinct devices (e.g. Android phone <-> Desktop PC, or Peer-to-Peer over WAN).
 * 
 * Flow:
 * 1. Initiator creates an SDP Offer with ICE candidates bundled into a compact ticket.
 * 2. Receiver scans or pastes the ticket, sets Remote Description, generates an SDP Answer.
 * 3. Initiator applies Answer; direct encrypted SCTP DataChannel opens across NAT.
 * 4. Binary wire frames (NEXX Magic 0x4e455858, ChaCha20-Poly1305) flow bidirectionally.
 */

import { p2pMeshBus } from './p2pMeshBus';

export type WebRTCConnectionState = 
  | 'idle' 
  | 'gathering' 
  | 'offer_ready' 
  | 'answer_ready' 
  | 'connecting' 
  | 'connected' 
  | 'disconnected' 
  | 'failed';

export interface WebRTCSignalingTicket {
  version: 2;
  type: 'offer' | 'answer';
  nodeId: string;
  nodeName: string;
  sdp: string;
  timestamp: number;
}

export interface PeerSessionStats {
  peerNodeId: string;
  peerNodeName: string;
  state: WebRTCConnectionState;
  rttMs: number;
  bytesSent: number;
  bytesReceived: number;
  connectedAt: number | null;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export class WebRTCPeerEngine {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private localNodeId: string = 'local_webrtc_node';
  private localNodeName: string = 'Current Device';
  private currentState: WebRTCConnectionState = 'idle';
  private remotePeerId: string = '';
  private remotePeerName: string = '';
  private unregisterMeshSink: (() => void) | null = null;
  private stateListeners: Set<(state: WebRTCConnectionState, stats: PeerSessionStats) => void> = new Set();
  private stats: PeerSessionStats = {
    peerNodeId: '',
    peerNodeName: '',
    state: 'idle',
    rttMs: 0,
    bytesSent: 0,
    bytesReceived: 0,
    connectedAt: null,
  };

  public configure(nodeId: string, nodeName: string) {
    this.localNodeId = nodeId;
    this.localNodeName = nodeName;
  }

  public getState(): WebRTCConnectionState {
    return this.currentState;
  }

  public getStats(): PeerSessionStats {
    return { ...this.stats };
  }

  public subscribe(listener: (state: WebRTCConnectionState, stats: PeerSessionStats) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.currentState, this.stats);
    return () => this.stateListeners.delete(listener);
  }

  private updateState(newState: WebRTCConnectionState) {
    this.currentState = newState;
    this.stats.state = newState;
    for (const listener of this.stateListeners) {
      listener(newState, { ...this.stats });
    }
  }

  /**
   * Step 1 (Initiator): Create an SDP Offer ticket.
   * Gathers all local ICE candidates before resolving so the ticket is self-contained.
   */
  public async createOfferTicket(): Promise<string> {
    this.cleanup();
    this.updateState('gathering');

    if (typeof RTCPeerConnection === 'undefined') {
      this.updateState('failed');
      throw new Error('WebRTC RTCPeerConnection is not supported in this browser.');
    }

    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Create reliable binary data channel
    this.dataChannel = this.pc.createDataChannel('nexxus-p2p-wire', {
      ordered: true,
    });
    this.setupDataChannel(this.dataChannel);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // Wait until ICE gathering completes so all candidate information is baked into SDP
    await this.waitForIceGatheringComplete(this.pc);

    const ticket: WebRTCSignalingTicket = {
      version: 2,
      type: 'offer',
      nodeId: this.localNodeId,
      nodeName: this.localNodeName,
      sdp: this.pc.localDescription?.sdp || '',
      timestamp: Date.now(),
    };

    this.updateState('offer_ready');
    return this.encodeTicket(ticket);
  }

  /**
   * Step 2 (Receiver): Accept an SDP Offer ticket and create an SDP Answer ticket.
   */
  public async acceptOfferAndCreateAnswer(offerTicketString: string): Promise<string> {
    this.cleanup();
    this.updateState('gathering');

    const offerTicket = this.decodeTicket(offerTicketString);
    if (offerTicket.type !== 'offer') {
      this.updateState('failed');
      throw new Error('Invalid ticket type: expected "offer"');
    }

    this.remotePeerId = offerTicket.nodeId;
    this.remotePeerName = offerTicket.nodeName;
    this.stats.peerNodeId = offerTicket.nodeId;
    this.stats.peerNodeName = offerTicket.nodeName;

    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Listen for incoming data channel
    this.pc.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel(event.channel);
    };

    await this.pc.setRemoteDescription(new RTCSessionDescription({
      type: 'offer',
      sdp: offerTicket.sdp,
    }));

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    await this.waitForIceGatheringComplete(this.pc);

    const answerTicket: WebRTCSignalingTicket = {
      version: 2,
      type: 'answer',
      nodeId: this.localNodeId,
      nodeName: this.localNodeName,
      sdp: this.pc.localDescription?.sdp || '',
      timestamp: Date.now(),
    };

    this.updateState('answer_ready');
    return this.encodeTicket(answerTicket);
  }

  /**
   * Step 3 (Initiator): Accept the SDP Answer ticket to complete the connection handshake.
   */
  public async acceptAnswerTicket(answerTicketString: string): Promise<void> {
    if (!this.pc) {
      throw new Error('No active WebRTC peer connection to accept answer.');
    }

    const answerTicket = this.decodeTicket(answerTicketString);
    if (answerTicket.type !== 'answer') {
      throw new Error('Invalid ticket type: expected "answer"');
    }

    this.remotePeerId = answerTicket.nodeId;
    this.remotePeerName = answerTicket.nodeName;
    this.stats.peerNodeId = answerTicket.nodeId;
    this.stats.peerNodeName = answerTicket.nodeName;

    this.updateState('connecting');
    await this.pc.setRemoteDescription(new RTCSessionDescription({
      type: 'answer',
      sdp: answerTicket.sdp,
    }));
  }

  private setupDataChannel(channel: RTCDataChannel) {
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      this.stats.connectedAt = Date.now();
      this.updateState('connected');

      // Hook into p2pMeshBus to forward outgoing wire frames to this WebRTC peer
      this.unregisterMeshSink = p2pMeshBus.registerExternalSink((frame) => {
        if (channel.readyState === 'open') {
          try {
            channel.send(frame as any);
            this.stats.bytesSent += frame.byteLength;
          } catch (err) {
            console.warn('WebRTC DataChannel send error:', err);
          }
        }
      });

      // Announce node presence over the new channel
      p2pMeshBus.announceNode();
    };

    channel.onclose = () => {
      this.updateState('disconnected');
      if (this.unregisterMeshSink) {
        this.unregisterMeshSink();
        this.unregisterMeshSink = null;
      }
    };

    channel.onerror = (err) => {
      console.error('WebRTC DataChannel error:', err);
      this.updateState('failed');
    };

    channel.onmessage = (event) => {
      let rawBytes: Uint8Array;
      if (event.data instanceof ArrayBuffer) {
        rawBytes = new Uint8Array(event.data);
      } else if (event.data instanceof Uint8Array) {
        rawBytes = event.data;
      } else if (typeof event.data === 'string') {
        rawBytes = new TextEncoder().encode(event.data);
      } else {
        return;
      }

      this.stats.bytesReceived += rawBytes.byteLength;
      // Inject frame into P2P Wire Mesh Bus
      p2pMeshBus.injectExternalFrame(rawBytes);
    };
  }

  private waitForIceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
    if (pc.iceGatheringState === 'complete') {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const checkState = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', checkState);

      // Safety fallback timeout in case a candidate takes too long
      setTimeout(() => {
        pc.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }, 2500);
    });
  }

  public encodeTicket(ticket: WebRTCSignalingTicket): string {
    const jsonStr = JSON.stringify(ticket);
    if (typeof btoa !== 'undefined') {
      return `NEXX_RTC_${btoa(unescape(encodeURIComponent(jsonStr)))}`;
    }
    return `NEXX_RTC_${Buffer.from(jsonStr).toString('base64')}`;
  }

  public decodeTicket(ticketString: string): WebRTCSignalingTicket {
    const clean = ticketString.trim();
    const raw = clean.startsWith('NEXX_RTC_') ? clean.replace('NEXX_RTC_', '') : clean;
    let jsonStr: string;
    if (typeof atob !== 'undefined') {
      jsonStr = decodeURIComponent(escape(atob(raw)));
    } else {
      jsonStr = Buffer.from(raw, 'base64').toString('utf-8');
    }
    return JSON.parse(jsonStr);
  }

  public close() {
    this.cleanup();
    this.updateState('idle');
  }

  private cleanup() {
    if (this.unregisterMeshSink) {
      this.unregisterMeshSink();
      this.unregisterMeshSink = null;
    }
    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch {}
      this.dataChannel = null;
    }
    if (this.pc) {
      try { this.pc.close(); } catch {}
      this.pc = null;
    }
  }
}

export const webrtcPeerEngine = new WebRTCPeerEngine();

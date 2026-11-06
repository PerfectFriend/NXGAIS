/**
 * NeXXUs Protocol - Real Autonomous System Number (ASN) & BGP Topology Resolver
 * 
 * Resolves connecting peer IP addresses to real ASNs using:
 * 1. RFC1918 / Loopback local detection (LAN mesh nodes)
 * 2. Real-time Team Cymru BGP DNS TXT queries (origin.asn.cymru.com)
 * 3. In-memory and persistent disk caching
 */

import dns from 'dns';
import fs from 'fs';
import path from 'path';

export interface AsnInfo {
  ip: string;
  asn: string;
  ispName: string;
  country: string;
  isPrivate: boolean;
  resolvedAt: string;
}

// Well-known ASN name mapping for clean UI / Logging
const WELL_KNOWN_ASNS: Record<string, string> = {
  'AS13335': 'Cloudflare Edge',
  'AS24940': 'Hetzner Sovereign Cloud',
  'AS16276': 'OVHcloud Relay',
  'AS15169': 'Google Cloud / Fiber',
  'AS16509': 'Amazon Web Services',
  'AS8075': 'Microsoft Azure',
  'AS14061': 'DigitalOcean Droplet',
  'AS31898': 'Oracle Cloud Direct',
  'AS20473': 'The Constant Company / Vultr',
  'AS9009': 'M247 Autonomous',
  'AS2516': 'KDDI / Japan Autonomous',
  'AS3301': 'Telia Company AB',
  'AS852': 'TELUS Communications',
  'AS3209': 'Vodafone GmbH',
  'AS12389': 'Rostelecom Public Backbone',
  'AS28573': 'Claro Telecom',
};

const memoryCache = new Map<string, AsnInfo>();

function isPrivateIp(ip: string): boolean {
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('169.254.')) return true;
  if (ip.startsWith('172.')) {
    const parts = ip.split('.');
    if (parts.length >= 2) {
      const secondOctet = parseInt(parts[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) return true;
    }
  }
  return false;
}

function cleanIp(rawIp: string): string {
  let ip = rawIp.trim();
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  return ip;
}

/**
 * Resolves an IPv4 address to its real BGP Autonomous System Number (ASN)
 */
export async function resolveIpAsn(rawIp: string, cacheFilePath?: string): Promise<AsnInfo> {
  const ip = cleanIp(rawIp);

  if (memoryCache.has(ip)) {
    return memoryCache.get(ip)!;
  }

  // Check persistent disk cache if provided
  if (cacheFilePath && fs.existsSync(cacheFilePath)) {
    try {
      const diskData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
      if (diskData[ip]) {
        memoryCache.set(ip, diskData[ip]);
        return diskData[ip];
      }
    } catch (e) {
      // ignore
    }
  }

  // 1. Private / Local IPs (Host A and Host B on local network or VPN)
  if (isPrivateIp(ip)) {
    const info: AsnInfo = {
      ip,
      asn: ip === '127.0.0.1' || ip === '::1' ? 'AS-LOOPBACK' : 'AS-LAN-PRIVATE',
      ispName: ip === '127.0.0.1' ? 'Local Loopback' : 'Private Subnet / LAN Peer',
      country: 'LOCAL',
      isPrivate: true,
      resolvedAt: new Date().toISOString(),
    };
    memoryCache.set(ip, info);
    return info;
  }

  // 2. Public IP: Team Cymru DNS TXT query
  // Reverse octets: 1.2.3.4 -> 4.3.2.1.origin.asn.cymru.com
  const octets = ip.split('.');
  if (octets.length === 4) {
    const reversed = `${octets[3]}.${octets[2]}.${octets[1]}.${octets[0]}.origin.asn.cymru.com`;
    try {
      const records = await dns.promises.resolveTxt(reversed);
      // Example record: "13335 | 1.1.1.0/24 | AU | ripencc | 2011-08-11"
      if (records && records.length > 0) {
        const txt = records[0].join(' ');
        const parts = txt.split('|').map(p => p.trim());
        const asnNum = parts[0] ? `AS${parts[0]}` : 'AS-UNKNOWN';
        const country = parts[2] || 'GLOBAL';
        const ispName = WELL_KNOWN_ASNS[asnNum] || `Autonomous System ${asnNum}`;

        const info: AsnInfo = {
          ip,
          asn: asnNum,
          ispName,
          country,
          isPrivate: false,
          resolvedAt: new Date().toISOString(),
        };

        memoryCache.set(ip, info);

        // Update persistent cache
        if (cacheFilePath) {
          try {
            let diskData: Record<string, AsnInfo> = {};
            if (fs.existsSync(cacheFilePath)) {
              diskData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
            }
            diskData[ip] = info;
            fs.writeFileSync(cacheFilePath, JSON.stringify(diskData, null, 2), 'utf8');
          } catch (e) {
            // ignore
          }
        }

        return info;
      }
    } catch (dnsErr) {
      // DNS resolution failed or host is offline
    }
  }

  // Fallback if DNS query timed out
  const fallbackInfo: AsnInfo = {
    ip,
    asn: 'AS-EXTERNAL',
    ispName: 'External Peer Node',
    country: 'GLOBAL',
    isPrivate: false,
    resolvedAt: new Date().toISOString(),
  };
  memoryCache.set(ip, fallbackInfo);
  return fallbackInfo;
}

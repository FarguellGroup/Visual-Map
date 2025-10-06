
import { create } from 'zustand';
import type { Host, Port, Script, Service, CveData, CveInfo } from '@/types/nmap';
import type { ExplainVulnerabilityRiskOutput, PentestingNextStepsOutput, NseScriptsSummaryOutput, CveDetailsOutput, CveDetailsInput, ExplainVulnerabilityRiskInput, PentestingNextStepsInput, NseScriptsSummaryInput } from '@/ai/types';
import { calculateRiskScores } from '@/lib/risk-scorer';
import { GoogleGenerativeAI } from "@google/generative-ai";

export const AI_MODEL_NAME = 'gemini-2.5-flash-lite';

export type RiskWeights = {
  criticalPorts: number;
  vulnScripts: number;
  serviceVersions: number;
  openPortsCount: number;
  cveScore: number;
};

const defaultRiskWeights: RiskWeights = {
  criticalPorts: 80,
  vulnScripts: 90,
  serviceVersions: 60,
  openPortsCount: 70,
  cveScore: 100,
};

type AiCacheEntry<T> = {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  data?: T;
  error?: string;
  promise?: Promise<void>;
};

export type CveCacheEntry = AiCacheEntry<CveData[]>;

type CveScanProgress = {
    processed: number;
    total: number;
    isComplete: boolean;
};

export type ApiStatus = 'idle' | 'loading' | 'success' | 'error';

export type ScanResult = {
  fileName: string;
  hosts: Host[];
  originalHosts: Host[]; // Store the unmodified hosts
  summary: {
    hostCount: number;
    openPorts: number;
    uniqueServices: number;
  };
};

type AiCache<T> = Map<string, AiCacheEntry<T>>;

type ScanState = {
  scanResult: ScanResult | null;
  selectedHost: Host | null;
  apiStatus: ApiStatus;
  aiModel: string;
  explanationCache: AiCache<ExplainVulnerabilityRiskOutput>;
  pentestingStepsCache: AiCache<PentestingNextStepsOutput>;
  nseSummaryCache: AiCache<NseScriptsSummaryOutput>;
  cveCache: AiCache<CveData[]>;
  riskWeights: RiskWeights;
  cveScanProgress: CveScanProgress;
  isCveScanRunning: boolean;
  setScanResult: (fileName: string, hosts: Host[], weights?: RiskWeights, resetCache?: boolean) => void;
  clearScanResult: () => void;
  setSelectedHost: (host: Host | null) => void;
  clearExplanationCache: () => void;
  clearPentestingStepsCache: () => void;
  clearNseSummaryCache: () => void;
  setRiskWeights: (weights: RiskWeights) => void;
  setAiModel: (model: string) => void;
  fetchCvesForHost: (hosts: Host | Host[], locale: string) => Promise<void>;
  fetchVulnerabilityExplanation: (host: Host, locale: string) => Promise<void>;
  fetchPentestingNextSteps: (host: Host, locale: string) => Promise<void>;
  fetchNseSummary: (host: Host, locale: string) => Promise<void>;
  hostHasNseScripts: (hostIp: string) => boolean;
  setApiStatus: (status: ApiStatus) => void;
};

// --- API Call Functions ---
const getGenAI = () => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_GENAI_API_KEY;
    if (!apiKey) throw new Error("API key not configured");
    return new GoogleGenerativeAI(apiKey);
};

const getGenerativeModel = (genAI: GoogleGenerativeAI, modelName: string) => {
    return genAI.getGenerativeModel({
        model: modelName,
        safetySettings: [
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        ],
        generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
        },
    });
};

async function callGemini<T_in, T_out>(prompt: string): Promise<T_out> {
    try {
        const modelName = useScanStore.getState().aiModel;
        const genAI = getGenAI();
        const model = getGenerativeModel(genAI, modelName);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return JSON.parse(text);
    } catch (error) {
        console.error("Error fetching data from Gemini API:", error);
        if (error instanceof Error && (error.message.includes('429') || error.message.toLowerCase().includes('rate limit'))) {
            throw new Error('Rate limit exceeded. Please wait and try again.');
        }
        throw error;
    }
}

// --- Store Definition ---

const calculateSummary = (hosts: Host[]) => {
  const hostCount = hosts.length;
  let openPorts = 0;
  const services = new Set<string>();

  hosts.forEach(host => {
    if (host.ports && host.ports.port) {
      const ports = Array.isArray(host.ports.port) ? host.ports.port : [host.ports.port];
      ports.forEach(port => {
        if (port.state.state === 'open') {
          openPorts++;
          if (port.service?.name) {
            services.add(port.service.name);
          }
        }
      });
    }
  });

  return { hostCount, openPorts, uniqueServices: services.size };
};

const getOpenPortsWithServices = (host: Host): Port[] => {
    if (!host || !host.ports || !host.ports.port) return [];
    const ports = Array.isArray(host.ports.port) ? host.ports.port : [host.ports.port];
    // A service is scannable if it has a name and version.
    return ports.filter(p => p.state.state === 'open' && p.service?.name && p.service?.version);
}

const getScripts = (item: Port | Host): Script[] => {
    const scriptsSource = 'hostscript' in item ? item.hostscript : item.script;
    if (!scriptsSource) return [];
    const scripts: Script[] = [];
    const potentialScripts = Array.isArray(scriptsSource) ? scriptsSource : [scriptsSource];
    potentialScripts.forEach(potential => {
        if (potential) {
            if ('script'in potential) { 
                const nested = (potential as any).script;
                if (Array.isArray(nested)) {
                    scripts.push(...nested);
                } else if (nested) {
                    scripts.push(nested);
                }
            } else if ('id' in potential) { 
                scripts.push(potential as Script);
            }
        }
    });
    return scripts;
};


export const useScanStore = create<ScanState>((set, get) => ({
  scanResult: null,
  selectedHost: null,
  apiStatus: 'idle',
  aiModel: AI_MODEL_NAME,
  explanationCache: new Map(),
  pentestingStepsCache: new Map(),
  nseSummaryCache: new Map(),
  cveCache: new Map(),
  riskWeights: defaultRiskWeights,
  cveScanProgress: { processed: 0, total: 0, isComplete: false },
  isCveScanRunning: false,

  setScanResult: (fileName, hosts, weights, resetCache = true) => {
    const finalWeights = weights || get().riskWeights;
    const hostsToScore = resetCache ? hosts : (get().scanResult?.originalHosts || hosts);
    
    const cveCache = get().cveCache;
    // When calculating scores, also embed the found CVEs into the host object
    const hostsWithCves = hostsToScore.map(host => ({
        ...host,
        cves: cveCache.get(host.address[0].addr)?.data || [],
    }));

    const scoredHosts = calculateRiskScores(hostsWithCves, finalWeights);
    scoredHosts.sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
    const summary = calculateSummary(scoredHosts);
    
    const newState: Partial<ScanState> = {
      scanResult: {
        fileName: get().scanResult?.fileName || fileName,
        hosts: scoredHosts,
        originalHosts: resetCache ? hosts : get().scanResult!.originalHosts,
        summary
      },
      riskWeights: finalWeights,
    };
    if (resetCache) {
      newState.explanationCache = new Map();
      newState.pentestingStepsCache = new Map();
      newState.nseSummaryCache = new Map();
      newState.cveCache = new Map();
      newState.isCveScanRunning = false;
      newState.cveScanProgress = { processed: 0, total: 0, isComplete: false };
      newState.apiStatus = 'idle';
    }
    set(newState);
  },
  
  clearScanResult: () => set({ 
    scanResult: null, 
    selectedHost: null, 
    explanationCache: new Map(), 
    pentestingStepsCache: new Map(), 
    nseSummaryCache: new Map(), 
    cveCache: new Map(),
    riskWeights: defaultRiskWeights,
    cveScanProgress: { processed: 0, total: 0, isComplete: false },
    isCveScanRunning: false,
    apiStatus: 'idle',
  }),

  setSelectedHost: (host) => set({ selectedHost: host }),
  clearExplanationCache: () => set({ explanationCache: new Map() }),
  clearPentestingStepsCache: () => set({ pentestingStepsCache: new Map() }),
  clearNseSummaryCache: () => set({ nseSummaryCache: new Map() }),
  setRiskWeights: (weights: RiskWeights) => set({ riskWeights: weights }),
  setAiModel: (model: string) => {
    const { scanResult, riskWeights } = get();
    
    set({ 
      aiModel: model,
      explanationCache: new Map(),
      pentestingStepsCache: new Map(),
      nseSummaryCache: new Map(),
      cveCache: new Map(),
      isCveScanRunning: false, 
      cveScanProgress: { processed: 0, total: 0, isComplete: false },
    });

    if (scanResult) {
      get().setScanResult(scanResult.fileName, scanResult.originalHosts, riskWeights, false);
    }
  },
  setApiStatus: (status: ApiStatus) => set({ apiStatus: status }),

  hostHasNseScripts: (hostIp: string) => {
    const host = get().scanResult?.hosts.find(h => h.address[0].addr === hostIp);
    if (!host) return false;
    const hostScripts = getScripts(host);
    const portScripts: Script[] = [];
    if (host.ports && host.ports.port) {
        const ports = Array.isArray(host.ports.port) ? host.ports.port : [host.ports.port];
        ports.forEach(port => portScripts.push(...getScripts(port)));
    }
    return (hostScripts.length + portScripts.length) > 0;
  },

  fetchCvesForHost: async (hosts: Host | Host[], locale: string) => {
    const hostsArray = Array.isArray(hosts) ? hosts : [hosts];
    const { cveCache, isCveScanRunning } = get();

    // Prevent starting a new scan if one is already in progress
    if (isCveScanRunning) return;

    const hostsToScan = hostsArray.filter(host => {
        const hasScannablePorts = getOpenPortsWithServices(host).length > 0;
        const cacheEntry = cveCache.get(host.address[0].addr);
        // Scan if it has ports and is not already loaded or loading
        return hasScannablePorts && (!cacheEntry || cacheEntry.status === 'idle' || cacheEntry.status === 'error');
    });

    if (hostsToScan.length === 0) return;
    
    set({ isCveScanRunning: true, cveScanProgress: { processed: 0, total: hostsToScan.length, isComplete: false } });

    const BATCH_SIZE = 5;
    const DELAY_BETWEEN_BATCHES = 4000; // 4 seconds

    for (let i = 0; i < hostsToScan.length; i += BATCH_SIZE) {
        const batch = hostsToScan.slice(i, i + BATCH_SIZE);

        const batchPromises = batch.map(async (host) => {
            const hostIp = host.address[0].addr;
            
            set(state => ({ cveCache: new Map(state.cveCache).set(hostIp, { status: 'loading' }) }));

            try {
                const portsToScan = getOpenPortsWithServices(host);
                let hostCves: CveData[] = [];

                for (const port of portsToScan) {
                    try {
                        const portInfoForPrompt = { port: port.portid, protocol: port.protocol, service: port.service!.name, product: port.service!.product || '', version: port.service!.version || '' };
                        const input: CveDetailsInput = { hostInfo: JSON.stringify({ os: host.os?.osmatch?.[0]?.name || 'unknown' }), portInfo: JSON.stringify(portInfoForPrompt), locale: locale as 'en' | 'es' };
                        const outputSchema = { cves: [{ cveId: "CVE-...", description: "...", cvssScore: 0.0 }] };
                        const prompt = `You are a cybersecurity expert. Identify potential CVEs based on the provided service info. Respond in ${input.locale}. The output must be a single, valid JSON object that strictly adheres to this Zod schema, with no extra text: \`\`\`json\n${JSON.stringify(outputSchema)}\`\`\` Based on the service, list the top 3 most critical CVEs. If none are found, return an empty array. \nHost Info: \`\`\`json\n${input.hostInfo}\`\`\`\nService Info:\`\`\`json\n${input.portInfo}\`\`\``;
                        
                        const result = await callGemini<CveDetailsInput, CveDetailsOutput>(prompt);

                        if (result.cves && result.cves.length > 0) {
                            hostCves.push(...result.cves.map(cve => ({ service: port.service!, portId: port.portid, cve })));
                        }
                    } catch (error) {
                        console.error(`[CVE Fetch] Failed for port ${port.portid} on host ${hostIp}:`, error);
                        // Do not fail the entire host scan for a single port error
                    }
                }
                
                set(state => ({
                    cveCache: new Map(state.cveCache).set(hostIp, { status: 'loaded', data: hostCves })
                }));

            } catch (error) {
                 set(state => ({
                    cveCache: new Map(state.cveCache).set(hostIp, { status: 'error', error: error instanceof Error ? error.message : "Unknown CVE scan error" })
                }));
            } finally {
                set(state => ({
                    cveScanProgress: { ...state.cveScanProgress, processed: state.cveScanProgress.processed + 1 }
                }));
            }
        });

        await Promise.all(batchPromises);

        if (i + BATCH_SIZE < hostsToScan.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
    }
    
    // Final state update after all batches are processed
    set(state => ({ 
        cveScanProgress: { ...state.cveScanProgress, isComplete: true },
        isCveScanRunning: false 
    }));
    
    // Trigger a final risk score recalculation
    const { scanResult, riskWeights } = get();
    if (scanResult) {
      get().setScanResult(scanResult.fileName, scanResult.originalHosts, riskWeights, false);
    }
},


  fetchVulnerabilityExplanation: async (host, locale) => {
    const cacheKey = `${host.address[0].addr}-${locale}`;
    const cache = get().explanationCache;
    if (cache.get(cacheKey)?.promise) return cache.get(cacheKey)!.promise;

    const promise = (async () => {
      try {
        const hostDetails = JSON.stringify({ ip: host.address[0].addr, status: host.status.state, ports: host.ports, hostscript: host.hostscript }, null, 2);
        const input: ExplainVulnerabilityRiskInput = { hostDetails, rankingFactors: host.riskFactors || [], riskScore: host.riskScore || 0, locale: locale as 'en' | 'es' };
        
        const outputSchema = { explanation: "...", translatedRiskFactors: ["..."] };
        const prompt = `You are a senior security analyst. Explain concisely why the host has its risk ranking. Respond in ${input.locale}. The output must be a single, valid JSON object that strictly adheres to this Zod schema: \`\`\`json\n${JSON.stringify(outputSchema)}\`\`\`\nHost details:\n${input.hostDetails}\nRanking factors:\n- ${input.rankingFactors.join('\n- ')}\nRisk score: ${input.riskScore}`;

        const result = await callGemini<ExplainVulnerabilityRiskInput, ExplainVulnerabilityRiskOutput>(prompt);
        set(state => ({ explanationCache: new Map(state.explanationCache).set(cacheKey, { status: 'loaded', data: result }) }));
      } catch (err) {
        set(state => ({ explanationCache: new Map(state.explanationCache).set(cacheKey, { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' }) }));
      }
    })();
    
    set(state => ({ explanationCache: new Map(state.explanationCache).set(cacheKey, { status: 'loading', promise }) }));
    await promise;
  },

  fetchPentestingNextSteps: async (host, locale) => {
    const cacheKey = `${host.address[0].addr}-${locale}`;
    const cache = get().pentestingStepsCache;
    if (cache.get(cacheKey)?.promise) return cache.get(cacheKey)!.promise;

    const promise = (async () => {
      try {
        const hostDetails = JSON.stringify({ ip: host.address[0].addr, status: host.status.state, ports: host.ports, hostscript: host.hostscript }, null, 2);
        const input: PentestingNextStepsInput = { hostDetails, locale: locale as 'en' | 'es' };

        const outputSchema = { steps: [{ title: "...", description: "...", command: "..." }] };
        const prompt = `You are a world-class penetration tester. Provide actionable next steps for a penetration test based on the Nmap scan results. Respond in ${input.locale}. The output must be a single, valid JSON object that strictly adheres to this Zod schema. Replace any placeholders like IP addresses in commands with the actual IP: \`\`\`json\n${JSON.stringify(outputSchema)}\`\`\`\nHost Details:\n\`\`\`json\n${input.hostDetails}\`\`\``;

        const result = await callGemini<PentestingNextStepsInput, PentestingNextStepsOutput>(prompt);
        set(state => ({ pentestingStepsCache: new Map(state.pentestingStepsCache).set(cacheKey, { status: 'loaded', data: result }) }));
      } catch (err) {
        set(state => ({ pentestingStepsCache: new Map(state.pentestingStepsCache).set(cacheKey, { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' }) }));
      }
    })();
    set(state => ({ pentestingStepsCache: new Map(state.pentestingStepsCache).set(cacheKey, { status: 'loading', promise }) }));
    await promise;
  },

  fetchNseSummary: async (host, locale) => {
    const cacheKey = `${host.address[0].addr}-${locale}`;
    const cache = get().nseSummaryCache;
    if (cache.get(cacheKey)?.promise) return cache.get(cacheKey)!.promise;

    const hostScripts = getScripts(host);
    const portScripts: Script[] = [];
    if (host.ports && host.ports.port) {
        const ports = Array.isArray(host.ports.port) ? host.ports.port : [host.ports.port];
        ports.forEach(port => portScripts.push(...getScripts(port)));
    }
    const rawScriptOutput = [...hostScripts, ...portScripts].map(s => `Script: ${s.id}\nOutput:\n${s.output}`).join('\n\n---\n\n');

    if (!rawScriptOutput.trim()) {
        set(state => ({ nseSummaryCache: new Map(state.nseSummaryCache).set(cacheKey, { status: 'loaded', data: { summary: '' } }) }));
        return;
    }

    const promise = (async () => {
      try {
        const input: NseScriptsSummaryInput = { rawScriptOutput, locale: locale as 'en' | 'es' };
        
        const outputSchema = { summary: "A concise, easy-to-read summary of the key findings from the NSE scripts, formatted in Markdown." };
        const prompt = `You are a cybersecurity expert. Summarize the following NSE script outputs. Respond in ${input.locale}. The output must be a single, valid JSON object that strictly adheres to this Zod schema: \`\`\`json\n${JSON.stringify(outputSchema)}\`\`\`\nNSE Output:\n\`\`\`\n${input.rawScriptOutput}\`\`\``;

        const result = await callGemini<NseScriptsSummaryInput, NseScriptsSummaryOutput>(prompt);
        set(state => ({ nseSummaryCache: new Map(state.nseSummaryCache).set(cacheKey, { status: 'loaded', data: result }) }));
      } catch (err) {
        set(state => ({ nseSummaryCache: new Map(state.nseSummaryCache).set(cacheKey, { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' }) }));
      }
    })();
    set(state => ({ nseSummaryCache: new Map(state.nseSummaryCache).set(cacheKey, { status: 'loading', promise }) }));
    await promise;
  },

}));

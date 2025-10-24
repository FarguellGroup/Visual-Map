
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Host, Port, Script, Service, CveData, CveInfo } from '@/types/nmap';
import type { ExplainVulnerabilityRiskOutput, PentestingNextStepsOutput, NseScriptsSummaryOutput, CveDetailsOutput, CveDetailsInput, ExplainVulnerabilityRiskInput, PentestingNextStepsInput, NseScriptsSummaryInput, RemediationInput, RemediationOutput } from '@/ai/types';
import { calculateRiskScores } from '@/lib/risk-scorer';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getOsName } from '@/lib/nmap-parser';

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
export type RemediationCacheEntry = AiCacheEntry<RemediationOutput>;

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

// Define a type for the AbortController instance.
type AbortableScan = {
  controller: AbortController;
};

type ScanState = {
  scanResult: ScanResult | null;
  selectedHost: Host | null;
  apiStatus: ApiStatus;
  apiError: string | null;
  aiModel: string;
  apiKey: string | null;
  explanationCache: AiCache<ExplainVulnerabilityRiskOutput>;
  pentestingStepsCache: AiCache<PentestingNextStepsOutput>;
  nseSummaryCache: AiCache<NseScriptsSummaryOutput>;
  cveCache: AiCache<CveData[]>;
  remediationCache: AiCache<RemediationOutput>;
  riskWeights: RiskWeights;
  cveScanProgress: CveScanProgress;
  isCveScanRunning: boolean;
  isCveScanPaused: boolean;
  isUsingEnvVar: boolean;
  remainingHostsToScan: Host[];
  abortableCveScan: AbortableScan | null;
  setScanResult: (fileName: string, hosts: Host[], weights?: RiskWeights, resetCache?: boolean) => void;
  clearScanResult: () => void;
  setSelectedHost: (host: Host | null) => void;
  clearExplanationCache: () => void;
  clearPentestingStepsCache: () => void;
  clearNseSummaryCache: () => void;
  setRiskWeights: (weights: RiskWeights) => void;
  setAiModel: (model: string) => void;
  setApiKey: (key: string | null) => void;
  setApiError: (error: string | null) => void;
  fetchCvesForHost: (hosts: Host | Host[], locale: string) => Promise<void>;
  fetchRemediation: (cveData: { cve: CveInfo, service: Service, osName: string }, locale: string) => Promise<void>;
  fetchAllRemediations: (cveItems: { cve: CveInfo, service: Service, osName: string }[], locale: string) => Promise<void>;
  pauseCveScan: () => void;
  fetchVulnerabilityExplanation: (host: Host, locale: string) => Promise<void>;
  fetchPentestingNextSteps: (host: Host, locale: string) => Promise<void>;
  fetchNseSummary: (host: Host, locale: string) => Promise<void>;
  hostHasNseScripts: (hostIp: string) => boolean;
  setApiStatus: (status: ApiStatus) => void;
  _hydrated: boolean;
  setHydrated: (hydrated: boolean) => void;
};

// --- API Call Functions ---
const getGenAI = (apiKey?: string | null) => {
    const key = apiKey || useScanStore.getState().apiKey;
    if (!key) throw new Error("API key not configured");
    return new GoogleGenerativeAI(key);
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

async function callGemini<T_in, T_out>(prompt: string, signal: AbortSignal): Promise<T_out | { error: string } | { aborted: true }> {
    const { aiModel, apiKey, setApiError } = useScanStore.getState();
    
    try {
        const genAI = getGenAI(apiKey);
        const model = getGenerativeModel(genAI, aiModel);
        
        if (signal.aborted) {
            return { aborted: true };
        }
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        if (text.trim().startsWith('{') && text.trim().endsWith('}')) {
          return JSON.parse(text) as T_out;
        } else {
           let errorMessage = 'Invalid JSON response from API.';
           if (text.toLowerCase().includes('rate limit') || text.toLowerCase().includes('quota')) {
                errorMessage = 'Rate limit exceeded';
           }
           setApiError(errorMessage);
           return { error: errorMessage };
        }

    } catch (error: any) {
        if (error.name === 'AbortError') {
            return { aborted: true };
        }

        let errorMessage = 'An unknown API error occurred';
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'object' && error !== null && 'message' in error) {
            errorMessage = String(error.message);
        }

        if (errorMessage.toLowerCase().includes('429') || errorMessage.toLowerCase().includes('rate limit') || errorMessage.toLowerCase().includes('quota')) {
            setApiError('Rate limit exceeded');
        } else if (errorMessage.toLowerCase().includes('api key not valid')) {
            setApiError('API Key not valid. Please check the key.');
        } else {
            setApiError(errorMessage);
        }
        return { error: errorMessage };
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
            if ('script' in potential) { 
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

export const useScanStore = create<ScanState>()(
  persist(
    (set, get) => ({
      scanResult: null,
      selectedHost: null,
      apiStatus: 'idle',
      apiError: null,
      aiModel: AI_MODEL_NAME,
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_GENAI_API_KEY || null,
      isUsingEnvVar: !!process.env.NEXT_PUBLIC_GOOGLE_GENAI_API_KEY,
      explanationCache: new Map(),
      pentestingStepsCache: new Map(),
      nseSummaryCache: new Map(),
      cveCache: new Map(),
      remediationCache: new Map(),
      riskWeights: defaultRiskWeights,
      cveScanProgress: { processed: 0, total: 0, isComplete: false },
      isCveScanRunning: false,
      isCveScanPaused: false,
      remainingHostsToScan: [],
      abortableCveScan: null,
      _hydrated: false,
      setHydrated: (hydrated) => set({ _hydrated: hydrated }),

      setScanResult: (fileName, hosts, weights, resetCache = true) => {
        const finalWeights = weights || get().riskWeights;
        const hostsToProcess = get().scanResult?.originalHosts || hosts;

        const cveCache = get().cveCache;
        const hostsWithCves = (resetCache ? hosts : hostsToProcess).map(host => {
            const cachedCves = cveCache.get(host.address[0].addr);
            const cachedData = cachedCves?.status === 'loaded' ? cachedCves.data : [];
            return { ...host, cves: cachedData };
        });

        const scoredHosts = calculateRiskScores(hostsWithCves, finalWeights);
        scoredHosts.sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
        const summary = calculateSummary(scoredHosts);
        
        const newState: Partial<ScanState> = {
          scanResult: {
            fileName: get().scanResult?.fileName || fileName,
            hosts: scoredHosts,
            originalHosts: hosts,
            summary
          },
          riskWeights: finalWeights,
        };

        if (resetCache) {
          newState.explanationCache = new Map();
          newState.pentestingStepsCache = new Map();
          newState.nseSummaryCache = new Map();
          newState.cveCache = new Map();
          newState.remediationCache = new Map();
          newState.isCveScanRunning = false;
          newState.cveScanProgress = { processed: 0, total: 0, isComplete: false };
          newState.isCveScanPaused = false;
          newState.remainingHostsToScan = [];
        }
        set(newState);
      },
      
      clearScanResult: () => {
        get().pauseCveScan();
        set({ 
          scanResult: null, 
          selectedHost: null, 
          explanationCache: new Map(), 
          pentestingStepsCache: new Map(), 
          nseSummaryCache: new Map(), 
          cveCache: new Map(),
          remediationCache: new Map(),
          riskWeights: defaultRiskWeights,
          cveScanProgress: { processed: 0, total: 0, isComplete: false },
          isCveScanRunning: false,
          apiStatus: 'idle',
          apiError: null,
          isCveScanPaused: false,
          remainingHostsToScan: [],
        });
      },

      setSelectedHost: (host) => set({ selectedHost: host }),
      clearExplanationCache: () => set({ explanationCache: new Map() }),
      clearPentestingStepsCache: () => set({ pentestingStepsCache: new Map() }),
      clearNseSummaryCache: () => set({ nseSummaryCache: new Map() }),
      
      setRiskWeights: (weights: RiskWeights) => {
          const { scanResult } = get();
          if(scanResult) {
              get().setScanResult(scanResult.fileName, scanResult.originalHosts, weights, false);
          }
      },
      
      setAiModel: (model: string) => {
        set({ 
          aiModel: model,
          explanationCache: new Map(),
          pentestingStepsCache: new Map(),
          nseSummaryCache: new Map(),
        });
      },

      setApiKey: (key: string | null) => {
        // Don't allow overwriting the env var key
        if(get().isUsingEnvVar) return;
        set({ apiKey: key });
      },

      setApiError: (error: string | null) => set({ apiError: error }),
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

      pauseCveScan: () => {
        const { abortableCveScan } = get();
        if (abortableCveScan) {
          abortableCveScan.controller.abort();
          set({ 
            isCveScanRunning: false, 
            isCveScanPaused: true, 
            abortableCveScan: null 
          });
        }
      },

      fetchCvesForHost: async (hosts: Host | Host[], locale: string) => {
        if (!get().apiKey) {
          set({ apiError: 'API key not configured' });
          return;
        }
        
        if (get().isCveScanRunning && !get().isCveScanPaused) return;
        if (get().apiError) set({ apiError: null });

        const hostsToProcess = Array.isArray(hosts) ? hosts : [hosts];
        
        let hostsForScan: Host[];
        if (get().isCveScanPaused && get().remainingHostsToScan.length > 0) {
            hostsForScan = get().remainingHostsToScan;
        } else {
            hostsForScan = hostsToProcess.filter(host => {
                const hasScannablePorts = getOpenPortsWithServices(host).length > 0;
                const cacheEntry = get().cveCache.get(host.address[0].addr);
                return hasScannablePorts && (!cacheEntry || cacheEntry.status === 'idle' || cacheEntry.status === 'error');
            });
            const totalServicesToScan = hostsForScan.reduce((acc, host) => {
                const ports = getOpenPortsWithServices(host);
                return acc + ports.length;
            }, 0);
            set({ cveScanProgress: { processed: 0, total: totalServicesToScan, isComplete: false } });
        }

        if (hostsForScan.length === 0) {
            set({ isCveScanRunning: false, isCveScanPaused: false, cveScanProgress: { ...get().cveScanProgress, isComplete: true } });
            return;
        }
        
        const controller = new AbortController();
        const signal = controller.signal;
        
        set({ 
            isCveScanRunning: true, 
            isCveScanPaused: false, 
            remainingHostsToScan: hostsForScan,
            abortableCveScan: { controller },
        });
        
        const BATCH_DELAY = 1000;

        for (let i = 0; i < hostsForScan.length; i++) {
            const host = hostsForScan[i];
            const hostIp = host.address[0].addr;

            const currentCacheEntry = get().cveCache.get(hostIp);
            if (!currentCacheEntry || currentCacheEntry.status !== 'loaded') {
              set(state => ({ cveCache: new Map(state.cveCache).set(hostIp, { status: 'loading' }) }));
            }

            const portsToScan = getOpenPortsWithServices(host);
            let hostCves: CveData[] = get().cveCache.get(hostIp)?.data || [];

            for (const port of portsToScan) {
                if (signal.aborted) {
                  console.log("CVE scan aborted by user.");
                  return;
                }

                const portInfoForPrompt = { port: port.portid, protocol: port.protocol, service: port.service!.name, product: port.service!.product || '', version: port.service!.version || '' };
                const input: CveDetailsInput = { hostInfo: JSON.stringify({ os: host.os?.osmatch?.[0]?.name || 'unknown' }), portInfo: JSON.stringify(portInfoForPrompt), locale: locale as 'en' | 'es' };
                const outputSchema = { cves: [{ cveId: "CVE-...", description: "...", cvssScore: 0.0 }] };
                const prompt = `You are a cybersecurity expert. Identify potential CVEs based on the provided service info. Respond in ${input.locale}. The output must be a single, valid JSON object that strictly adheres to this Zod schema, with no extra text: \`\`\`json\n${JSON.stringify(outputSchema)}\`\`\` Based on the service, list the top 3 most critical CVEs. If none are found, return an empty array. \nHost Info: \`\`\`json\n${input.hostInfo}\`\`\`\nService Info:\`\`\`json\n${input.portInfo}\`\`\``;
                
                const result = await callGemini<CveDetailsInput, CveDetailsOutput>(prompt, signal);

                 if ('aborted' in result && result.aborted) {
                  return;
                }

                if ('error' in result && result.error) {
                  const remainingHosts = hostsForScan.slice(i);
                  set({
                    isCveScanRunning: false,
                    isCveScanPaused: true,
                    remainingHostsToScan: remainingHosts,
                    abortableCveScan: null,
                  });
                  return;
                }

                if (result.cves && result.cves.length > 0) {
                    hostCves.push(...result.cves.map(cve => ({ service: port.service!, portId: port.portid, cve })));
                }

                set(state => ({
                    cveScanProgress: { ...state.cveScanProgress, processed: state.cveScanProgress.processed + 1 }
                }));
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
            }
            
            set(state => ({
                cveCache: new Map(state.cveCache).set(hostIp, { status: 'loaded', data: hostCves }),
                remainingHostsToScan: state.remainingHostsToScan.slice(1),
            }));
        }
        
        set({ 
            cveScanProgress: { ...get().cveScanProgress, isComplete: true },
            isCveScanRunning: false,
            isCveScanPaused: false,
            remainingHostsToScan: [],
            abortableCveScan: null,
        });
        
        if (!get().apiError) {
            const { scanResult, riskWeights } = get();
            if (scanResult) {
              get().setScanResult(scanResult.fileName, scanResult.originalHosts, riskWeights, false);
            }
        }
      },

      fetchRemediation: async (cveData, locale) => {
        const cacheKey = `${cveData.cve.cveId}-${locale}`;
        const cache = get().remediationCache;
        if (cache.get(cacheKey)?.status === 'loading' || cache.get(cacheKey)?.status === 'loaded') return;

        const controller = new AbortController();
        const promise = (async () => {
            try {
                const input: RemediationInput = {
                    cveId: cveData.cve.cveId,
                    cveDescription: cveData.cve.description,
                    serviceName: cveData.service.product || cveData.service.name,
                    serviceVersion: cveData.service.version || 'unknown',
                    osName: cveData.osName,
                    locale: locale as 'en' | 'es',
                };

                const outputSchema = { remediation: "A step-by-step guide..." };
                const prompt = `You are a cybersecurity remediation expert. Provide a detailed, step-by-step guide to remediate the following vulnerability. Be specific and include ALL relevant commands in markdown code blocks. Always provide commands where applicable. Respond in ${input.locale}. The output must be a single, valid JSON object that strictly adheres to this Zod schema: \`\`\`json\n${JSON.stringify(outputSchema)}\`\`\`\nDetails:\n\`\`\`json\n${JSON.stringify(input)}\`\`\``;

                const result = await callGemini<RemediationInput, RemediationOutput>(prompt, controller.signal);
                if ('error' in result) { throw new Error(result.error); }
                if ('aborted' in result) { return; }

                set(state => ({
                    remediationCache: new Map(state.remediationCache).set(cacheKey, { status: 'loaded', data: result as RemediationOutput })
                }));

            } catch (err) {
                 set(state => ({
                    remediationCache: new Map(state.remediationCache).set(cacheKey, { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' })
                }));
            }
        })();

        set(state => ({
            remediationCache: new Map(state.remediationCache).set(cacheKey, { status: 'loading', promise })
        }));
        await promise;
      },
      
      fetchAllRemediations: async (cveItems, locale) => {
        const { fetchRemediation } = get();
        // Do not await each call, let them run in parallel up to a limit
        const CONCURRENCY_LIMIT = 5;
        const promises: Promise<void>[] = [];

        for (const cveItem of cveItems) {
            const promise = fetchRemediation(cveItem, locale);
            promises.push(promise);
            if (promises.length >= CONCURRENCY_LIMIT) {
                await Promise.all(promises);
                promises.length = 0;
            }
        }
        await Promise.all(promises);
      },


      fetchVulnerabilityExplanation: async (host, locale) => {
        const cacheKey = `${host.address[0].addr}-${locale}`;
        const cache = get().explanationCache;
        if (cache.get(cacheKey)?.promise) return cache.get(cacheKey)!.promise;
        const controller = new AbortController();

        const promise = (async () => {
          try {
            const hostDetails = JSON.stringify({ ip: host.address[0].addr, status: host.status.state, ports: host.ports, hostscript: host.hostscript }, null, 2);
            const input: ExplainVulnerabilityRiskInput = { hostDetails, rankingFactors: host.riskFactors || [], riskScore: host.riskScore || 0, locale: locale as 'en' | 'es' };
            
            const outputSchema = { explanation: "...", translatedRiskFactors: ["..."] };
            const prompt = `You are a senior security analyst. Explain concisely why the host has its risk ranking. Respond in ${input.locale}. The output must be a single, valid JSON object that strictly adheres to this Zod schema: \`\`\`json\n${JSON.stringify(outputSchema)}\`\`\`\nHost details:\n${input.hostDetails}\nRanking factors:\n- ${input.rankingFactors.join('\n- ')}\nRisk score: ${input.riskScore}`;

            const result = await callGemini<ExplainVulnerabilityRiskInput, ExplainVulnerabilityRiskOutput>(prompt, controller.signal);
            if ('error' in result) { throw new Error(result.error); }
            if ('aborted' in result) { return; }
            set(state => ({ explanationCache: new Map(state.explanationCache).set(cacheKey, { status: 'loaded', data: result as ExplainVulnerabilityRiskOutput }) }));
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
        const controller = new AbortController();

        const promise = (async () => {
          try {
            const hostDetails = JSON.stringify({ ip: host.address[0].addr, status: host.status.state, ports: host.ports, hostscript: host.hostscript }, null, 2);
            const input: PentestingNextStepsInput = { hostDetails, locale: locale as 'en' | 'es' };

            const outputSchema = { steps: [{ title: "...", description: "...", command: "..." }] };
            const prompt = `You are a world-class penetration tester. Provide actionable next steps for a penetration test based on the Nmap scan results. Respond in ${input.locale}. The output must be a single, valid JSON object that strictly adheres to this Zod schema. Replace any placeholders like IP addresses in commands with the actual IP: \`\`\`json\n${JSON.stringify(outputSchema)}\`\`\`\nHost Details:\n\`\`\`json\n${input.hostDetails}\`\`\``;

            const result = await callGemini<PentestingNextStepsInput, PentestingNextStepsOutput>(prompt, controller.signal);
            if ('error' in result) { throw new Error(result.error); }
            if ('aborted' in result) { return; }
            set(state => ({ pentestingStepsCache: new Map(state.pentestingStepsCache).set(cacheKey, { status: 'loaded', data: result as PentestingNextStepsOutput }) }));
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
        const controller = new AbortController();

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
            const prompt = `You are a cybersecurity expert. Summarize the following NSE script outputs. Respond in ${input.locale}. The output must be a single, valid JSON object that strictly adheres to this Zod schema: \`\`\`json\n${JSON.stringify(outputSchema)}\`\`\`\nNSE Output:\n\`\`\`\n${rawScriptOutput}\`\`\``;

            const result = await callGemini<NseScriptsSummaryInput, NseScriptsSummaryOutput>(prompt, controller.signal);
            if ('error' in result) { throw new Error(result.error); }
            if ('aborted' in result) { return; }
            set(state => ({ nseSummaryCache: new Map(state.nseSummaryCache).set(cacheKey, { status: 'loaded', data: result as NseScriptsSummaryOutput }) }));
          } catch (err) {
            set(state => ({ nseSummaryCache: new Map(state.nseSummaryCache).set(cacheKey, { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' }) }));
          }
        })();
        set(state => ({ nseSummaryCache: new Map(state.nseSummaryCache).set(cacheKey, { status: 'loading', promise }) }));
        await promise;
      },
    }),
    {
      name: 'visual-map-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        apiKey: state.isUsingEnvVar ? null : state.apiKey, // Don't persist API key if it's from env var
        aiModel: state.aiModel,
        riskWeights: state.riskWeights
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHydrated(true);
        }
      }
    }
  )
);


import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Host, Port, Script, Service, CveData, CveInfo } from '@/types/nmap';
import type { ExplainVulnerabilityRiskOutput, PentestingNextStepsOutput, NseScriptsSummaryOutput, CveDetailsOutput, CveDetailsInput, ExplainVulnerabilityRiskInput, PentestingNextStepsInput, NseScriptsSummaryInput, RemediationInput, RemediationOutput, ExecutiveSummaryInput, ExecutiveSummaryOutput, AttackPathsInput, AttackPathsOutput } from '@/ai/types';
import { calculateRiskScores } from '@/lib/risk-scorer';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getOsName } from '@/lib/nmap-parser';

export const AI_MODEL_NAME = 'gemini-1.5-flash';

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

type ScannableService = {
  host: Host;
  port: Port;
};

type ScanState = {
  scanResult: ScanResult | null;
  selectedHost: Host | null;
  hostFilter: string | null;
  apiStatus: ApiStatus;
  apiError: string | null;
  aiModel: string;
  apiKey: string | null;
  explanationCache: AiCache<ExplainVulnerabilityRiskOutput>;
  pentestingStepsCache: AiCache<PentestingNextStepsOutput>;
  nseSummaryCache: AiCache<NseScriptsSummaryOutput>;
  cveCache: AiCache<CveData[]>;
  remediationCache: AiCache<RemediationOutput>;
  executiveSummaryCache: AiCache<ExecutiveSummaryOutput>;
  attackPathsCache: AiCache<AttackPathsOutput>;
  riskWeights: RiskWeights;
  cveScanProgress: CveScanProgress;
  isCveScanRunning: boolean;
  isCveScanPaused: boolean;
  isUsingEnvVar: boolean;
  remainingServicesToScan: ScannableService[];
  abortableCveScan: AbortableScan | null;
  setScanResult: (fileName: string, hosts: Host[], weights?: RiskWeights, resetCaches?: boolean) => void;
  clearScanResult: () => void;
  setSelectedHost: (host: Host | null) => void;
  setHostFilter: (hostIp: string | null) => void;
  clearExplanationCache: () => void;
  clearPentestingStepsCache: () => void;
  clearNseSummaryCache: () => void;
  setRiskWeights: (weights: RiskWeights) => void;
  setAiModel: (model: string) => void;
  setApiKey: (key: string | null) => void;
  setApiError: (error: string | null) => void;
  fetchCves: (locale: string) => Promise<void>;
  fetchRemediation: (cveData: { cve: CveInfo, service: Service, osName: string }, locale: string) => Promise<void>;
  fetchAllRemediations: (cveItems: { cve: CveInfo, service: Service, osName: string }[], locale: string) => Promise<void>;
  pauseCveScan: () => void;
  fetchVulnerabilityExplanation: (host: Host, locale: string) => Promise<void>;
  fetchPentestingNextSteps: (host: Host, locale: string) => Promise<void>;
  fetchNseSummary: (host: Host, locale: string) => Promise<void>;
  fetchExecutiveSummary: (scanResult: ScanResult, locale: string) => Promise<void>;
  fetchAttackPaths: (hosts: Host[], locale: string) => Promise<void>;
  hostHasNseScripts: (hostIp: string) => boolean;
  setApiStatus: (status: ApiStatus) => void;
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
        
        if (signal.aborted) {
            return { aborted: true };
        }

        const response = await result.response;
        let text = response.text();
        
        // Find the first '{' and the last '}' that form a balanced pair to extract the JSON object.
        let firstBrace = -1;
        let lastBrace = -1;
        let balance = 0;
        let startIndex = text.indexOf('{');

        if (startIndex !== -1) {
            firstBrace = startIndex;
            for (let i = startIndex; i < text.length; i++) {
                if (text[i] === '{') {
                    balance++;
                } else if (text[i] === '}') {
                    balance--;
                    if (balance === 0) {
                        lastBrace = i;
                        break; // Found a complete JSON object
                    }
                }
            }
        }

        if (firstBrace !== -1 && lastBrace > firstBrace) {
            text = text.substring(firstBrace, lastBrace + 1);
        } else {
             let errorMessage = 'Invalid JSON response from API. No JSON object found.';
            if (response.text().toLowerCase().includes('rate limit') || response.text().toLowerCase().includes('quota')) {
                 errorMessage = 'Rate limit exceeded';
            } else if (response.text().toLowerCase().includes('api key not valid')) {
                errorMessage = 'API Key not valid. Please check the key.';
            }
            setApiError(errorMessage);
            return { error: errorMessage };
        }

        try {
            return JSON.parse(text) as T_out;
        } catch(parseError: any) {
            console.error("JSON Parse Error:", parseError);
            console.error("Raw text from API:", response.text());
            const errorMessage = `Failed to parse API response: ${parseError.message}`;
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
            errorMessage = 'Rate limit exceeded';
        } else if (errorMessage.toLowerCase().includes('api key not valid')) {
            errorMessage = 'API Key not valid. Please check the key.';
        }
        
        setApiError(errorMessage);
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

const getScannableServices = (hosts: Host[]): ScannableService[] => {
    const services: ScannableService[] = [];
    hosts.forEach(host => {
        if (host.ports && host.ports.port) {
            const ports = Array.isArray(host.ports.port) ? host.ports.port : [host.ports.port];
            ports
                .filter(p => p.state.state === 'open' && p.service?.name && p.service?.version)
                .forEach(port => {
                    services.push({ host, port });
                });
        }
    });
    return services;
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
      hostFilter: null,
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
      executiveSummaryCache: new Map(),
      attackPathsCache: new Map(),
      riskWeights: defaultRiskWeights,
      cveScanProgress: { processed: 0, total: 0, isComplete: false },
      isCveScanRunning: false,
      isCveScanPaused: false,
      remainingServicesToScan: [],
      abortableCveScan: null,

      setScanResult: (fileName, hosts, weights, resetCaches = false) => {
        const finalWeights = weights || get().riskWeights;
        const hostsToProcess = get().scanResult?.originalHosts || hosts;

        const cveCache = get().cveCache;
        const hostsWithCves = hostsToProcess.map(host => {
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
            originalHosts: hostsToProcess, 
            hosts: scoredHosts,
            summary
          },
          riskWeights: finalWeights,
        };

        if (resetCaches) {
          newState.explanationCache = new Map();
          newState.pentestingStepsCache = new Map();
          newState.nseSummaryCache = new Map();
          newState.cveCache = new Map();
          newState.remediationCache = new Map();
          newState.executiveSummaryCache = new Map();
          newState.attackPathsCache = new Map();
          newState.isCveScanRunning = false;
          newState.cveScanProgress = { processed: 0, total: 0, isComplete: false };
          newState.isCveScanPaused = false;
          newState.remainingServicesToScan = [];
          newState.hostFilter = null;
        } else {
            newState.explanationCache = get().explanationCache;
            newState.pentestingStepsCache = get().pentestingStepsCache;
            newState.nseSummaryCache = get().nseSummaryCache;
            newState.cveCache = get().cveCache;
            newState.remediationCache = get().remediationCache;
            newState.executiveSummaryCache = get().executiveSummaryCache;
            newState.attackPathsCache = get().attackPathsCache;
        }
        set(newState);
      },
      
      clearScanResult: () => {
        get().pauseCveScan();
        set({ 
          scanResult: null, 
          selectedHost: null, 
          hostFilter: null,
          explanationCache: new Map(), 
          pentestingStepsCache: new Map(), 
          nseSummaryCache: new Map(), 
          cveCache: new Map(),
          remediationCache: new Map(),
          executiveSummaryCache: new Map(),
          attackPathsCache: new Map(),
          riskWeights: defaultRiskWeights,
          cveScanProgress: { processed: 0, total: 0, isComplete: false },
          isCveScanRunning: false,
          apiStatus: 'idle',
          apiError: null,
          isCveScanPaused: false,
          remainingServicesToScan: [],
        });
      },

      setSelectedHost: (host) => set({ selectedHost: host }),
      setHostFilter: (hostIp) => set({ hostFilter: hostIp }),
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
        set({ aiModel: model });
      },

      setApiKey: (key: string | null) => {
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
        const { abortableCveScan, isCveScanRunning } = get();
        if (isCveScanRunning && abortableCveScan) {
            abortableCveScan.controller.abort();
            set({
                isCveScanRunning: false,
                isCveScanPaused: true,
                abortableCveScan: null,
            });
        }
      },

      fetchCves: async (locale) => {
        const { apiKey, isCveScanRunning, scanResult } = get();
        if (!apiKey) {
            set({ apiError: 'API key not configured' });
            return;
        }
        if (isCveScanRunning) return;
        if (!scanResult) return;

        set({ apiError: null });

        let servicesToScan: ScannableService[] = [];
        if (get().isCveScanPaused && get().remainingServicesToScan.length > 0) {
            servicesToScan = get().remainingServicesToScan;
        } else {
            servicesToScan = getScannableServices(scanResult.hosts);
            set({ 
                cveCache: new Map(), // Clear previous results before a new full scan
                cveScanProgress: { processed: 0, total: servicesToScan.length, isComplete: false } 
            });
        }

        if (servicesToScan.length === 0) {
            set({ isCveScanRunning: false, isCveScanPaused: false, cveScanProgress: { ...get().cveScanProgress, isComplete: true } });
            return;
        }
        
        const controller = new AbortController();
        
        set({
            isCveScanRunning: true,
            isCveScanPaused: false,
            abortableCveScan: { controller },
            remainingServicesToScan: servicesToScan,
        });

        for (let i = 0; i < servicesToScan.length; i++) {
            if (controller.signal.aborted) {
                set(state => ({ remainingServicesToScan: servicesToScan.slice(i) }));
                return;
            }

            const { host, port } = servicesToScan[i];
            const hostIp = host.address[0].addr;
            
            const servicesPayload = [{
                port: port.portid,
                protocol: port.protocol,
                service: port.service!.name,
                product: port.service!.product || '',
                version: port.service!.version || '',
            }];
            
            const input: CveDetailsInput = {
                hostInfo: JSON.stringify({ os: getOsName(host) }),
                portInfo: JSON.stringify(servicesPayload),
                locale: locale as 'en' | 'es',
            };

            const outputSchema = { cves: [{ portId: "port", service: "service name", cves: [{ cveId: "CVE-...", description: "...", cvssScore: 0.0 }] }] };
            const prompt = `You are a cybersecurity expert. For the single service in the provided list, identify potential CVEs. Respond in ${input.locale}. Ensure all text in the output, especially the 'description' field, is in the specified locale (${input.locale}). The output must be a single, valid JSON object that strictly adheres to this Zod schema, with no extra text: \`\`\`json\n${JSON.stringify(outputSchema)}\`\`\` For the service, list the top 3 most critical CVEs. If no CVEs are found, return an empty 'cves' array. Host Info: \`\`\`json\n${input.hostInfo}\`\`\`\nServices Info:\`\`\`json\n${input.portInfo}\`\`\``;
            
            const result = await callGemini<CveDetailsInput, CveDetailsOutput>(prompt, controller.signal);
            
            if (controller.signal.aborted) {
                set(state => ({ remainingServicesToScan: servicesToScan.slice(i) }));
                return;
            }

            if ('error' in result) {
                // Any error should pause the scan
                get().pauseCveScan();
                set({ apiError: result.error, remainingServicesToScan: servicesToScan.slice(i) });
                return; // Exit the loop on any API error
            } 
            
            if (result && result.cves) {
                const newCvesForHost: CveData[] = result.cves.flatMap(serviceCves => {
                    return serviceCves.cves.map(cve => ({
                        service: port.service!,
                        portId: port.portid,
                        cve: cve
                    }));
                });

                if (newCvesForHost.length > 0) {
                  set(state => {
                    const existingCache = state.cveCache.get(hostIp);
                    const existingData = existingCache?.status === 'loaded' ? existingCache.data : [];
                    const combinedData = [...(existingData || []), ...newCvesForHost];
                    return {
                        cveCache: new Map(state.cveCache).set(hostIp, { status: 'loaded', data: combinedData })
                    };
                  });
                } else {
                   // Even if no CVEs are found, mark the host as 'loaded' to prevent re-scanning.
                    set(state => {
                      if (!state.cveCache.has(hostIp)) {
                         return { cveCache: new Map(state.cveCache).set(hostIp, { status: 'loaded', data: [] }) };
                      }
                      return state;
                    });
                }
            }
            
            set(state => ({
                cveScanProgress: { ...state.cveScanProgress, processed: state.cveScanProgress.processed + 1 }
            }));
        }
        
        set({
            isCveScanRunning: false,
            isCveScanPaused: false,
            remainingServicesToScan: [],
            abortableCveScan: null,
            cveScanProgress: { ...get().cveScanProgress, isComplete: true },
        });

        const { scanResult: currentScanResult, riskWeights } = get();
        if (currentScanResult) {
            get().setScanResult(currentScanResult.fileName, currentScanResult.originalHosts, riskWeights, false);
        }
      },
      
      fetchRemediation: async (cveData, locale) => {
        const cacheKey = `${cveData.cve.cveId}-${locale}`;
        const cache = get().remediationCache;
        if (cache?.get(cacheKey)?.status === 'loading' || cache?.get(cacheKey)?.status === 'loaded') return;

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
                const prompt = `You are a cybersecurity remediation expert. Provide a detailed, step-by-step guide to remediate the following vulnerability. Use markdown for formatting: headings (#, ##), bullet points (-), bold text (**text**), and code blocks (\`\`\`lang\ncode\`\`\`). Do not use numbered lists. Respond in ${input.locale}. The output must be a single, valid JSON object that strictly adheres to this Zod schema: \`\`\`json\n${JSON.stringify(outputSchema)}\`\`\`\nDetails:\n\`\`\`json\n${JSON.stringify(input)}\`\`\``;

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

      fetchExecutiveSummary: async (scanResult, locale) => {
          const cacheKey = `summary-${locale}`;
          const cache = get().executiveSummaryCache;
          if (cache.get(cacheKey)?.promise) return cache.get(cacheKey)!.promise;

          const controller = new AbortController();
          const promise = (async () => {
              try {
                  const scanData = JSON.stringify(scanResult);
                  const input: ExecutiveSummaryInput = { scanData, locale: locale as 'en' | 'es' };
                  const outputSchema = { overallAssessment: "...", criticalFindings: ["..."], strategicRecommendations: ["..."] };
                  
                  const allCves = Array.from(get().cveCache.values())
                    .filter(entry => entry.status === 'loaded' && entry.data)
                    .flatMap(entry => entry.data!);
                  const cveDataString = allCves.length > 0 ? `\n\nDiscovered CVEs:\n${JSON.stringify(allCves.map(c => c.cve), null, 2)}` : '';
                  
                  const prompt = `You are a CISO. Provide a high-level executive summary of the provided Nmap scan results. Focus on overall security posture, critical findings, and strategic recommendations. If CVE data is available, incorporate the most critical findings into your summary. Respond in ${input.locale}. The output must be a single, valid JSON object adhering to this schema: \`\`\`json\n${JSON.stringify(outputSchema)}\`\`\`\nScan Data:\n${input.scanData}${cveDataString}`;

                  const result = await callGemini<ExecutiveSummaryInput, ExecutiveSummaryOutput>(prompt, controller.signal);
                  if ('error' in result) { throw new Error(result.error); }
                  if ('aborted' in result) { return; }
                  set(state => ({ executiveSummaryCache: new Map(state.executiveSummaryCache).set(cacheKey, { status: 'loaded', data: result as ExecutiveSummaryOutput }) }));
              } catch (err) {
                  set(state => ({ executiveSummaryCache: new Map(state.executiveSummaryCache).set(cacheKey, { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' }) }));
              }
          })();
          set(state => ({ executiveSummaryCache: new Map(state.executiveSummaryCache).set(cacheKey, { status: 'loading', promise }) }));
          await promise;
      },
      
      fetchAttackPaths: async (hosts, locale) => {
          const cacheKey = `attack-path-${locale}`;
          const cache = get().attackPathsCache;
          if (cache.get(cacheKey)?.promise) return cache.get(cacheKey)!.promise;

          const controller = new AbortController();
          const promise = (async () => {
              try {
                  // Filter for high-risk hosts to optimize the prompt
                  const vulnerableHosts = hosts
                    .filter(h => (h.riskScore ?? 0) >= 60)
                    .map(h => ({ ip: h.address[0].addr, ports: h.ports, riskScore: h.riskScore }));

                  if (vulnerableHosts.length === 0) {
                      set(state => ({ attackPathsCache: new Map(state.attackPathsCache).set(cacheKey, { status: 'loaded', data: { paths: [] } }) }));
                      return;
                  }
                  
                  const hostsData = JSON.stringify(vulnerableHosts);
                  const input: AttackPathsInput = { hosts: hostsData, locale: locale as 'en' | 'es' };
                  const outputSchema = { paths: [{ source: "ip_address", target: "ip_address", description: "A detailed step-by-step explanation...", command: "nmap -p..." }] };
                  const prompt = `You are a security strategist. Analyze the provided network hosts (only high-risk hosts with risk score >= 60 are included) to identify potential attack paths where a compromise of one host could lead to another. Consider open ports, services, and risk scores. Provide a list of the most plausible paths. For each path, provide a detailed step-by-step explanation of how an attacker might move from the source to the target, including specific services, ports, and potential exploits. Also include a relevant, copy-pasteable command if applicable. Respond in ${input.locale}. The output must be a single, valid JSON object adhering to this schema: \`\`\`json\n${JSON.stringify(outputSchema)}\`\`\`\nHosts Data:\n${input.hosts}`;

                  const result = await callGemini<AttackPathsInput, AttackPathsOutput>(prompt, controller.signal);
                  if ('error' in result) { throw new Error(result.error); }
                  if ('aborted' in result) { return; }
                  set(state => ({ attackPathsCache: new Map(state.attackPathsCache).set(cacheKey, { status: 'loaded', data: result as AttackPathsOutput }) }));
              } catch (err) {
                  set(state => ({ attackPathsCache: new Map(state.attackPathsCache).set(cacheKey, { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' }) }));
              }
          })();
          set(state => ({ attackPathsCache: new Map(state.attackPathsCache).set(cacheKey, { status: 'loading', promise }) }));
          await promise;
      },
    }),
    {
      name: 'visual-map-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => {
        const serializeCache = (cache: any) => {
            if (cache instanceof Map) {
                return Array.from(cache.entries());
            }
            return cache; // Already an array or not a Map, return as is.
        };
        return {
            apiKey: state.isUsingEnvVar ? undefined : state.apiKey,
            aiModel: state.aiModel,
            riskWeights: state.riskWeights,
            cveCache: serializeCache(state.cveCache),
            remediationCache: serializeCache(state.remediationCache),
            executiveSummaryCache: serializeCache(state.executiveSummaryCache),
            attackPathsCache: serializeCache(state.attackPathsCache),
        }
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          const rehydrateCache = (cacheData: any) => {
              if (Array.isArray(cacheData) && cacheData.every(item => Array.isArray(item) && item.length === 2)) {
                  return new Map(cacheData);
              }
              return cacheData instanceof Map ? cacheData : new Map();
          };

          state.explanationCache = new Map();
          state.pentestingStepsCache = new Map();
          state.nseSummaryCache = new Map();
          state.cveCache = rehydrateCache(state.cveCache);
          state.remediationCache = rehydrateCache(state.remediationCache);
          state.executiveSummaryCache = rehydrateCache(state.executiveSummaryCache);
          state.attackPathsCache = rehydrateCache(state.attackPathsCache);
          
          state.isCveScanRunning = false;
          state.isCveScanPaused = false;
          state.remainingServicesToScan = [];
          state.cveScanProgress = { processed: 0, total: 0, isComplete: get().cveScanProgress?.isComplete || false };
          state.isUsingEnvVar = !!process.env.NEXT_PUBLIC_GOOGLE_GENAI_API_KEY;
          state.apiKey = state.isUsingEnvVar ? process.env.NEXT_PUBLIC_GOOGLE_GENAI_API_KEY : state.apiKey;
        }
      }
    }
  )
);

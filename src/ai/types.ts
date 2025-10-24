
import {z} from 'zod';

export const ExplainVulnerabilityRiskInputSchema = z.object({
  hostDetails: z
    .string()
    .describe('Detailed information about the host, including open ports, services, versions, and NSE script results.'),
  rankingFactors: z
    .array(z.string())
    .describe('A list of factors contributing to the host vulnerability ranking, such as number of open ports and critical ports.'),
  riskScore: z.number().describe('The calculated risk score for the host, on a scale of 0 to 100.'),
  locale: z.string().describe('The language to use for the explanation. Can be "en" or "es".'),
});
export type ExplainVulnerabilityRiskInput = z.infer<typeof ExplainVulnerabilityRiskInputSchema>;

export const ExplainVulnerabilityRiskOutputSchema = z.object({
  explanation: z
    .string()
    .describe('A detailed explanation of why the host has its given risk score, based on the provided host details, ranking factors, and score.'),
  translatedRiskFactors: z.array(z.string()).describe('The rankingFactors translated into the requested locale.'),
});
export type ExplainVulnerabilityRiskOutput = z.infer<typeof ExplainVulnerabilityRiskOutputSchema>;

export const PentestingNextStepsInputSchema = z.object({
  hostDetails: z
    .string()
    .describe(
      'Detailed information about the host, including open ports, services, versions, and NSE script results.'
    ),
  locale: z
    .string()
    .describe('The language to use for the explanation. Can be "en" or "es".'),
});
export type PentestingNextStepsInput = z.infer<
  typeof PentestingNextStepsInputSchema
>;

const StepSchema = z.object({
  title: z.string().describe('A descriptive title for the pentesting step.'),
  description: z
    .string()
    .describe('A clear explanation of what the step is and why it is useful.'),
  command: z
    .string()
    .optional()
    .describe(
      "A specific, copy-pasteable command to execute the step."
    ),
});

export const PentestingNextStepsOutputSchema = z.object({
  steps: z
    .array(StepSchema)
    .describe('An array of suggested pentesting steps.'),
});
export type PentestingNextStepsOutput = z.infer<
  typeof PentestingNextStepsOutputSchema
>;

export const NseScriptsSummaryInputSchema = z.object({
  rawScriptOutput: z
    .string()
    .describe(
      'The combined raw output from all NSE scripts (host and port scripts) for a single host.'
    ),
  locale: z
    .string()
    .describe('The language to use for the summary. Can be "en" or "es".'),
});
export type NseScriptsSummaryInput = z.infer<
  typeof NseScriptsSummaryInputSchema
>;

export const NseScriptsSummaryOutputSchema = z.object({
  summary: z
    .string()
    .describe('A concise, easy-to-read summary of the key findings from the NSE scripts. It should be formatted in Markdown, using paragraphs and bullet points for clarity.'),
});
export type NseScriptsSummaryOutput = z.infer<
  typeof NseScriptsSummaryOutputSchema
>;


export const CveDetailsInputSchema = z.object({
  hostInfo: z
    .string()
    .describe('JSON string with host information like OS.'),
  portInfo: z
    .string()
    .describe('JSON string with port information like port number, protocol, service name, version, and NSE script outputs.'),
  locale: z
    .string()
    .describe('The language for the response ("en" or "es").'),
});
export type CveDetailsInput = z.infer<typeof CveDetailsInputSchema>;


const CveInfoSchema = z.object({
  cveId: z.string().describe('The CVE identifier (e.g., "CVE-2021-44228").'),
  description: z.string().describe('A brief, clear description of the vulnerability.'),
  cvssScore: z.number().nullable().describe('The CVSS v3.x base score, if available.'),
});

export const CveDetailsOutputSchema = z.object({
  cves: z.array(CveInfoSchema).describe('A list of CVEs found for the specified service and version. The list should contain a maximum of the 3 most critical CVEs.'),
});
export type CveDetailsOutput = z.infer<typeof CveDetailsOutputSchema>;


export const RemediationInputSchema = z.object({
  cveId: z.string().describe('The CVE identifier (e.g., "CVE-2021-44228").'),
  cveDescription: z.string().describe('A brief, clear description of the vulnerability.'),
  serviceName: z.string().describe('The name of the vulnerable service (e.g., "Apache httpd").'),
  serviceVersion: z.string().describe('The version of the vulnerable service (e.g., "2.4.49").'),
  osName: z.string().describe('The operating system of the host (e.g., "Linux 3.10 - 4.11").'),
  locale: z.string().describe('The language for the response ("en" or "es").'),
});
export type RemediationInput = z.infer<typeof RemediationInputSchema>;

export const RemediationOutputSchema = z.object({
  remediation: z.string().describe('A step-by-step guide in Markdown on how to remediate the vulnerability. Include commands if applicable.'),
});
export type RemediationOutput = z.infer<typeof RemediationOutputSchema>;

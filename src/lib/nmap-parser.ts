
import { XMLParser } from 'fast-xml-parser';
import type { Host, Script, Port } from '@/types/nmap';

const options = {
  ignoreAttributes: false,
  attributeNamePrefix: '',
  allowBooleanAttributes: true,
  parseNodeValue: true,
  parseAttributeValue: true,
  trimValues: true,
  // This is crucial for handling cases where an element can appear once or multiple times
  isArray: (name: string, jpath: string) => {
    const arrayPaths = [
      'nmaprun.host',
      'nmaprun.host.address',
      'nmaprun.host.ports.port',
      'nmaprun.host.hostnames.hostname',
      'nmaprun.host.ports.port.script',
      'nmaprun.host.hostscript.script',
      'nmaprun.host.os.osmatch',
    ];
    return arrayPaths.indexOf(jpath) !== -1;
  },
};

export async function parseNmapXml(xmlData: string): Promise<Host[]> {
  try {
    const parser = new XMLParser(options);
    const jsonObj = parser.parse(xmlData);

    if (!jsonObj.nmaprun || !jsonObj.nmaprun.host) {
      return [];
    }

    // The isArray option ensures `jsonObj.nmaprun.host` is always an array
    return jsonObj.nmaprun.host as Host[];
  } catch (error) {
    console.error('XML Parsing Error:', error);
    throw new Error('Failed to parse Nmap XML. Please check the file format.');
  }
}


export function getScripts(item: Host | Port): Script[] {
    const scriptsSource = 'hostscript' in item ? item.hostscript : ('script' in item ? item.script : undefined);
    if (!scriptsSource) return [];

    const scripts: Script[] = [];
    
    const potentialScripts = Array.isArray(scriptsSource) ? scriptsSource : [scriptsSource];

    potentialScripts.forEach(potential => {
        if (potential) {
            // This handles the case where script is an object like { script: [...] }
            if ('script' in potential && potential.script) { 
                const nested = potential.script;
                if (Array.isArray(nested)) {
                    scripts.push(...nested);
                } else {
                    scripts.push(nested);
                }
            } else if ('id' in potential) { // This handles the case where it's a direct Script object or array
                scripts.push(potential as Script);
            }
        }
    });
    
    return scripts.filter(s => s && s.id && s.output);
};


export function getHostname(host: Host | null): string {
  if (!host) {
    return 'N/A';
  }

  // 1. Try to get from hostnames array
  if (host.hostnames) {
      const hostnamesArray = Array.isArray(host.hostnames) ? host.hostnames : [host.hostnames];
      for (const hostnamesEntry of hostnamesArray) {
        if (hostnamesEntry && hostnamesEntry.hostname) {
          const hostnameArray = Array.isArray(hostnamesEntry.hostname) ? hostnamesEntry.hostname : [hostnamesEntry.hostname];
          const primaryHostname = hostnameArray.find(h => h.type === 'user' || h.type === 'PTR');
          if (primaryHostname && primaryHostname.name) {
            return primaryHostname.name;
          }
        }
      }
  }


  // 2. If not found, try to get from smb-os-discovery script
  const hostScripts = getScripts(host);
  const smbScript = hostScripts.find(s => s.id === 'smb-os-discovery');
  if (smbScript) {
    const output = smbScript.output;
    const computerNameMatch = output.match(/Computer name: ([\w-]+)/);
    if (computerNameMatch && computerNameMatch[1]) {
      return computerNameMatch[1];
    }
  }

  return 'N/A';
};

export function getOsName(host: Host | null): string {
    if (!host || !host.os || !host.os.osmatch) {
        return 'N/A';
    }
    const osMatches = Array.isArray(host.os.osmatch) ? host.os.osmatch : [host.os.osmatch];
    if (osMatches.length > 0) {
        // Find the one with the highest accuracy
        const bestMatch = osMatches.reduce((prev, current) => (parseInt(prev.accuracy) > parseInt(current.accuracy)) ? prev : current);
        if (bestMatch && bestMatch.name) {
          return bestMatch.name;
        }
    }
    return 'N/A';
};

'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import ReactFlow, {
  Controls,
  Background,
  addEdge,
  Node,
  Edge,
  Position,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  getConnectedEdges,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { Host } from '@/types/nmap';
import { Card, CardContent } from '@/components/ui/card';
import {
  Server,
  Smartphone,
  Router,
  Monitor,
  Laptop,
  ChevronDown,
  Printer
} from 'lucide-react';
import CustomNode from '@/components/details/custom-node';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';
import { Checkbox } from '../ui/checkbox';
import { useLocale } from 'next-intl';
import { Button } from '../ui/button';
import { useDebounce } from 'use-debounce';
import { getOsName } from '@/lib/nmap-parser';

const nodeTypes = {
  custom: CustomNode,
};

const getDeviceType = (osName: string = ''): string => {
    const os = osName.toLowerCase();
    if (os.includes('linux')) return 'Server';
    if (os.includes('windows server')) return 'Server';
    if (os.includes('windows')) return 'Desktop';
    if (os.includes('ios') || os.includes('android')) return 'Mobile';
    if (os.includes('printer')) return 'Printer';
    if (os.includes('router') || os.includes('firewall') || os.includes('cisco') || os.includes('mikrotik')) return 'Router';
    return 'Other';
};


const getServiceIcon = (osName: string = '') => {
    const deviceType = getDeviceType(osName);
    switch (deviceType) {
        case 'Server': return Server;
        case 'Desktop': return Laptop;
        case 'Mobile': return Smartphone;
        case 'Printer': return Printer;
        case 'Router': return Router;
        default: return Monitor;
    }
};

const ipToNumber = (ip: string) => {
  return ip.split('.').reduce((acc, octet, index) => acc + parseInt(octet) * Math.pow(256, 3 - index), 0);
};

const defaultViewport = { x: 250, y: 100, zoom: 0.75 };

const Graph = ({ hosts }: { hosts: Host[] }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView, getNodes, getEdges } = useReactFlow();
  
  const [riskFilter, setRiskFilter] = useState(0);
  const [debouncedRiskFilter] = useDebounce(riskFilter, 500);

  const [osFilters, setOsFilters] = useState<string[]>([]);
  const [deviceTypeFilters, setDeviceTypeFilters] = useState<string[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  const locale = useLocale();

  const hostData = useMemo(() => {
    if (!hosts) {
      return [];
    }
    return hosts.map(host => ({
      ...host,
      osName: getOsName(host),
    }));
  }, [hosts]);

  const allDeviceTypes = useMemo(() => [
    { id: 'Server', icon: Server, label: locale === 'es' ? 'Servidor' : 'Server' },
    { id: 'Desktop', icon: Laptop, label: locale === 'es' ? 'Equipo' : 'Desktop' },
    { id: 'Router', icon: Router, label: 'Router' },
    { id: 'Mobile', icon: Smartphone, label: locale === 'es' ? 'Móvil' : 'Mobile' },
    { id: 'Printer', icon: Printer, label: locale === 'es' ? 'Impresora' : 'Printer' },
    { id: 'Other', icon: Monitor, label: locale === 'es' ? 'Otro' : 'Other' },
  ], [locale]);

  const detectedDeviceTypes = useMemo(() => {
    const detected = new Set<string>();
    hostData.forEach(host => {
        detected.add(getDeviceType(host.osName));
    });
    return allDeviceTypes.filter(dt => detected.has(dt.id));
  }, [hostData, allDeviceTypes]);


  const uniqueOsTypes = useMemo(() => {
    const osTypes = new Set<string>();
    hostData.forEach(host => {
        if (host.osName !== 'Unknown' && host.osName !== 'N/A') {
            osTypes.add(host.osName);
        }
    });
    return Array.from(osTypes);
  }, [hostData]);

  const onConnect = useCallback((params: any) => setEdges(eds => addEdge(params, eds)), [setEdges]);

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    const allNodes = getNodes();
    const allEdges = getEdges();
    const connectedEdges = getConnectedEdges([node], allEdges);
    
    const nodesToFit = new Set<Node>([node]);
    connectedEdges.forEach((edge) => {
        const sourceNode = allNodes.find(n => n.id === edge.source);
        const targetNode = allNodes.find(n => n.id === edge.target);
        if(sourceNode) nodesToFit.add(sourceNode);
        if(targetNode) nodesToFit.add(targetNode);
    });

    fitView({
        nodes: Array.from(nodesToFit),
        padding: 0.2,
        duration: 800,
    });
  }, [fitView, getNodes, getEdges]);
  
  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const { filteredNodes, filteredEdges } = useMemo(() => {
    const filteredHosts = hostData.filter(host => {
        const riskScore = host.riskScore ?? 0;
        if (riskScore < debouncedRiskFilter) return false;

        const osName = host.osName;
        if (osFilters.length > 0 && !osFilters.includes(osName)) return false;
        
        const deviceType = getDeviceType(osName);
        if (deviceTypeFilters.length > 0 && !deviceTypeFilters.includes(deviceType)) return false;

        return true;
    });

    const subnets: { [key: string]: { nodes: Node[], count: number } } = {};

    const calculatedNodes: Node[] = filteredHosts.map(host => {
      const ip = host.address[0].addr;
      const subnetId = `subnet-${ip.substring(0, ip.lastIndexOf('.'))}`;
      const openPorts = (host.ports?.port && (Array.isArray(host.ports.port) ? host.ports.port : [host.ports.port]).filter(p => p?.state.state === 'open')) || [];
      const osName = host.osName;

      if (!subnets[subnetId]) {
          subnets[subnetId] = { nodes: [], count: 0 };
      }
      subnets[subnetId].count++;
      
      return {
        id: ip,
        type: 'custom',
        data: {
          ip: ip,
          osName: osName,
          riskScore: host.riskScore ?? 0,
          Icon: getServiceIcon(osName),
          openPorts: openPorts,
        },
        position: { x: 0, y: 0 },
        parentNode: subnetId,
        extent: 'parent',
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    });

    const subnetNodes: Node[] = Object.keys(subnets).map((subnetId, i) => ({
      id: subnetId,
      data: { label: `${subnetId.replace('subnet-', '')}.0/24` },
      position: { x: (i % 2) * 950, y: Math.floor(i / 2) * 500 },
      className: 'light-bg !bg-muted/50',
      style: {
        width: 900,
        height: Math.ceil(subnets[subnetId].count / 4) * 150 + 50,
      },
      type: 'group',
    }));

    const positionedNodes = calculatedNodes.map(node => {
        const subnetId = node.parentNode!;
        const indexInSubnet = subnets[subnetId].nodes.length;
        subnets[subnetId].nodes.push(node);
        return {
            ...node,
            position: {
                x: (indexInSubnet % 4) * 220 + 25,
                y: Math.floor(indexInSubnet / 4) * 150 + 50,
            },
        };
    });

    const highRiskHosts = filteredHosts
      .filter(h => (h.riskScore ?? 0) >= 75)
      .sort((a,b) => ipToNumber(a.address[0].addr) - ipToNumber(b.address[0].addr));
      
    const initialEdges: Edge[] = [];
    for (let i = 0; i < highRiskHosts.length - 1; i++) {
        const sourceSubnet = `subnet-${highRiskHosts[i].address[0].addr.substring(0, highRiskHosts[i].address[0].addr.lastIndexOf('.'))}`;
        const targetSubnet = `subnet-${highRiskHosts[i+1].address[0].addr.substring(0, highRiskHosts[i+1].address[0].addr.lastIndexOf('.'))}`;
        if (sourceSubnet !== targetSubnet) continue;
        
        initialEdges.push({
            id: `e-${highRiskHosts[i].address[0].addr}-${highRiskHosts[i+1].address[0].addr}`,
            source: highRiskHosts[i].address[0].addr,
            target: highRiskHosts[i+1].address[0].addr,
            animated: true,
            style: { stroke: '#EF4444', strokeWidth: 2 }
        });
    }
    
    return {
        filteredNodes: [...subnetNodes, ...positionedNodes],
        filteredEdges: initialEdges,
    }

  }, [hostData, debouncedRiskFilter, osFilters, deviceTypeFilters]);

  useEffect(() => {
      const allGraphNodes = getNodes();
      
      const finalNodes = filteredNodes.map(node => {
        const isSelected = node.id === selectedNodeId;
        
        let isRelated = false;
        if (selectedNodeId) {
            const selected = allGraphNodes.find(n => n.id === selectedNodeId);
            if (selected) {
                 const connectedEdges = getConnectedEdges([selected], filteredEdges);
                 isRelated = connectedEdges.some(e => e.source === node.id || e.target === node.id);
            }
        }

        return {
          ...node,
          data: {
            ...node.data,
            dimmed: selectedNodeId ? !isSelected && !isRelated : false,
          }
        };
      });
      setNodes(finalNodes);
      setEdges(filteredEdges);
  }, [filteredNodes, filteredEdges, selectedNodeId, setNodes, setEdges, getNodes]);
  
  const handleOsFilterChange = (os: string, checked: boolean) => {
    setOsFilters(prev => checked ? [...prev, os] : prev.filter(o => o !== os));
  };
  
  const handleDeviceTypeFilterChange = (deviceType: string, checked: boolean) => {
    setDeviceTypeFilters(prev => checked ? [...prev, deviceType] : prev.filter(dt => dt !== deviceType));
  };
  
  const osFilterLabel = locale === 'es' ? 'SO' : 'OS';
  const riskScoreLabel = locale === 'es' ? 'Puntuación de Riesgo' : 'Risk Score';
  const deviceTypeLabel = locale === 'es' ? 'Tipo de Dispositivo' : 'Device Type';
  const filtersTitle = locale === 'es' ? 'Filtros' : 'Filters';

  const reactFlowStyles = `
    .react-flow__controls button {
        background-color: hsl(var(--card));
        border-bottom-color: hsl(var(--border));
    }
    .dark .react-flow__controls button svg {
        fill: hsl(var(--foreground));
    }
    .react-flow__controls button:hover {
        background-color: hsl(var(--muted));
    }
  `;

  return (
    <>
        <style>{reactFlowStyles}</style>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          fitView
          panOnDrag
          zoomOnScroll
          defaultViewport={defaultViewport}
          className="bg-background"
          nodeTypes={nodeTypes}
        >
          <Controls />
          <Background gap={12} size={1} />
           <Panel position="top-left" className="p-4 bg-card border rounded-lg shadow-md space-y-4 max-w-xs max-h-[80vh] overflow-y-auto">
               <div className="flex justify-between items-center">
                 <h3 className="font-semibold text-lg">{filtersTitle}</h3>
                 <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}>
                    <ChevronDown className={`h-5 w-5 transition-transform ${isPanelCollapsed ? '-rotate-90' : ''}`} />
                 </Button>
               </div>

                {!isPanelCollapsed && (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="risk-slider">{riskScoreLabel} &gt;= {riskFilter}</Label>
                            <Slider 
                                id="risk-slider"
                                min={0}
                                max={100}
                                step={10}
                                value={[riskFilter]}
                                onValueChange={(value) => setRiskFilter(value[0])}
                            />
                        </div>
                        
                        {detectedDeviceTypes.length > 0 && (
                          <div className="space-y-2">
                              <Label>{deviceTypeLabel}</Label>
                              <div className="space-y-1 pr-2">
                                  {detectedDeviceTypes.map(dt => (
                                      <div key={dt.id} className="flex items-center space-x-2">
                                          <Checkbox 
                                              id={`dt-${dt.id}`} 
                                              onCheckedChange={(checked) => handleDeviceTypeFilterChange(dt.id, !!checked)} 
                                              checked={deviceTypeFilters.includes(dt.id)}
                                          />
                                          <dt.icon className="h-4 w-4" />
                                          <label htmlFor={`dt-${dt.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 truncate">{dt.label}</label>
                                      </div>
                                  ))}
                              </div>
                          </div>
                        )}

                        <div className="space-y-2">
                            <Label>{osFilterLabel}</Label>
                            <div className="space-y-1 max-h-32 overflow-y-auto pr-2">
                                {uniqueOsTypes.map(os => (
                                    <div key={os} className="flex items-center space-x-2">
                                        <Checkbox 
                                          id={`os-${os}`} 
                                          onCheckedChange={(checked) => handleOsFilterChange(os, !!checked)} 
                                          checked={osFilters.includes(os)}
                                        />
                                        <label htmlFor={`os-${os}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 truncate">{os}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </Panel>
        </ReactFlow>
    </>
  );
}

export default function NetworkGraphView({ hosts, pdfMode = false }: { hosts: Host[]; pdfMode?: boolean }) {
  if (pdfMode) {
    return (
      <div id="pdf-network-graph" className="w-[800px] h-[600px] bg-background">
        <p>Network Graph visualization is not available in PDF export.</p>
      </div>
    );
  }

  return (
    <div className='w-full h-full'>
      <Card className="h-full flex flex-col">
        <CardContent className="p-0 relative flex-1">
          <ReactFlowProvider>
            <Graph hosts={hosts} />
          </ReactFlowProvider>
        </CardContent>
      </Card>
    </div>
  );
}

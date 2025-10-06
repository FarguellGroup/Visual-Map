
'use client';

import React, { useMemo } from 'react';
import ReactFlow, { MiniMap, Controls, Background, Node, Edge, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import type { Host } from '@/types/nmap';
import { Card, CardContent } from '@/components/ui/card';
import { useRouter } from '@/navigation';

const getRiskColor = (score: number) => {
    if (score >= 75) return '#EF4444'; // red-500
    if (score >= 40) return '#F97316'; // orange-500
    if (score > 0) return '#FBBF24'; // yellow-400
    return '#6B7280'; // gray-500
};

const ipToNumber = (ip: string) => {
    return ip.split('.').reduce((acc, octet, index) => acc + parseInt(octet) * Math.pow(256, 3 - index), 0);
};

export default function NetworkGraphView({ hosts, pdfMode = false }: { hosts: Host[], pdfMode?: boolean }) {
  const router = useRouter();

  const { nodes, edges } = useMemo(() => {
    if (!hosts) return { nodes: [], edges: [] };

    const initialNodes: Node[] = [];
    const subnets: { [key: string]: Node } = {};

    // Create subnet nodes
    hosts.forEach(host => {
        const ip = host.address[0].addr;
        const subnetId = ip.substring(0, ip.lastIndexOf('.'));
        if (!subnets[subnetId]) {
            subnets[subnetId] = {
                id: `subnet-${subnetId}`,
                data: { label: `${subnetId}.0/24` },
                position: { x: 0, y: 0 },
                type: 'group',
                style: {
                    backgroundColor: 'rgba(128, 128, 128, 0.1)',
                    width: 300,
                    height: 300,
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                },
            };
        }
    });

    initialNodes.push(...Object.values(subnets));

    // Create host nodes
    hosts.forEach((host, index) => {
      const ip = host.address[0].addr;
      const subnetId = ip.substring(0, ip.lastIndexOf('.'));
      const riskScore = host.riskScore ?? 0;
      const color = getRiskColor(riskScore);
      
      initialNodes.push({
        id: ip,
        data: { label: ip },
        position: { x: (index % 5) * 150 + 25, y: Math.floor(index / 5) * 100 + 50 },
        style: {
          background: color,
          color: riskScore >= 40 ? 'white' : 'black',
          border: `2px solid ${color}`,
          width: 100,
          textAlign: 'center',
        },
        parentNode: `subnet-${subnetId}`,
        extent: 'parent',
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });
    });

    // Position subnet groups
    Object.keys(subnets).forEach((subnetId, index) => {
      const node = initialNodes.find(n => n.id === `subnet-${subnetId}`);
      if (node) {
        node.position = { x: (index % 2) * 400, y: Math.floor(index / 2) * 400 };
      }
    });
    
    // Sort hosts by IP to have a deterministic layout
    const sortedHosts = [...hosts].sort((a,b) => ipToNumber(a.address[0].addr) - ipToNumber(b.address[0].addr));
    
    const initialEdges: Edge[] = [];
    // Example edge: connect hosts with high-risk scores
    const highRiskHosts = sortedHosts.filter(h => (h.riskScore ?? 0) >= 75);
    for (let i = 0; i < highRiskHosts.length - 1; i++) {
        initialEdges.push({
            id: `e-${highRiskHosts[i].address[0].addr}-${highRiskHosts[i+1].address[0].addr}`,
            source: highRiskHosts[i].address[0].addr,
            target: highRiskHosts[i+1].address[0].addr,
            animated: true,
            style: { stroke: '#EF4444' }
        });
    }


    return { nodes: initialNodes, edges: initialEdges };
  }, [hosts]);

  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    router.push(`/details/host/${node.id}`);
  };
  
  if (pdfMode) {
      return (
          <div id="pdf-network-graph" className="w-[800px] h-[600px] bg-background">
             {/* PDF export for this is complex, render a placeholder */}
             <p>Network graph visualization is not available in PDF export.</p>
          </div>
      )
  }

  return (
    <Card>
      <CardContent className="p-0" style={{ height: 'calc(100vh - 12rem)' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={onNodeClick}
          fitView
          className="bg-background"
        >
          <Controls />
          <MiniMap />
          <Background gap={12} size={1} />
        </ReactFlow>
      </CardContent>
    </Card>
  );
}

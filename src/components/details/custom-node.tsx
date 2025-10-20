
'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';

const getRiskColor = (score: number): string => {
  if (score >= 75) return 'bg-red-500 text-white';
  if (score >= 40) return 'bg-orange-500 text-white';
  if (score > 0) return 'bg-yellow-400 text-black';
  return 'bg-gray-500 text-white';
};

const CustomNode = ({ data }: NodeProps) => {
  const { Icon, ip, riskScore, osName, openPorts, dimmed } = data;

  return (
    <div className="relative group">
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 hidden group-hover:block" style={{ zIndex: 100 }}>
          <Card className='shadow-lg'>
            <CardHeader className='p-3'>
              <CardTitle className='text-sm font-mono'>{ip}</CardTitle>
              <CardDescription className='text-xs'>{osName}</CardDescription>
            </CardHeader>
            <CardContent className='p-3 pt-0'>
              <h4 className='text-xs font-semibold mb-2'>Open Ports</h4>
              <div className='max-h-24 overflow-y-auto text-xs space-y-1'>
                {openPorts && openPorts.length > 0 ? openPorts.map((port: any) => (
                  <div key={port.portid} className='flex justify-between'>
                      <span>{port.portid}/{port.protocol}</span>
                      <span className='text-muted-foreground truncate'>{port.service?.name}</span>
                  </div>
                )) : (
                  <p className='text-muted-foreground text-xs'>No open ports</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      
      <div
        className={`p-3 border-2 rounded-lg shadow-md flex flex-col items-center justify-center transition-opacity ${
          dimmed ? 'opacity-30' : 'opacity-100'
        }`}
        style={{
          backgroundColor: 'hsl(var(--card))',
          borderColor: `hsl(var(--ring))`,
        }}
      >
        <div className='flex items-center gap-2'>
            {Icon && <Icon className="h-5 w-5" />}
            <Badge className={getRiskColor(riskScore)}>{riskScore}</Badge>
        </div>
        <div className="font-mono text-xs mt-2">{ip}</div>
        <Handle type="target" position={Position.Top} className="w-16 !bg-primary" />
        <Handle type="source" position={Position.Bottom} className="w-16 !bg-primary" />
      </div>
    </div>
  );
};

export default memo(CustomNode);

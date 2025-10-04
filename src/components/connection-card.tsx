import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import React from 'react';

interface ConnectionCardProps {
  name: string;
  status: 'connected' | 'disconnected';
  email?: string;
  href: string;
  children?: React.ReactNode;
}

export function ConnectionCard({ name, status, email, href, children }: ConnectionCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Badge variant={status === 'connected' ? 'default' : 'secondary'}>
            {status}
          </Badge>
          <div>
            <p className="text-sm font-medium">{name}</p>
            {email && <p className="text-sm text-muted-foreground">{email}</p>}
            {status === 'disconnected' && (
              <p className="text-sm text-muted-foreground">Not connected</p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={href}>
            {status === 'connected' ? 'Manage' : 'Connect'}
          </Link>
        </Button>
      </CardContent>
      {children}
    </Card>
  );
}

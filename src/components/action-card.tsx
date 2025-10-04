import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ActionCardProps {
  title: string;
  description: string;
  href: string;
  icon?: React.ReactNode;
  className?: string;
}

export function ActionCard({ title, description, href, icon, className }: ActionCardProps) {
  return (
    <Link href={href}>
      <Card className={cn('hover:bg-accent transition-colors cursor-pointer h-full', className)}>
        <CardHeader>
          {icon && <div className="mb-2 text-primary">{icon}</div>}
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}

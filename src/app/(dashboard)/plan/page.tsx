'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function PlanPage() {
  const handleComingSoon = () => {
    toast.info('Coming Soon', {
      description: 'This feature is currently under development.',
    });
  };

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Weekly Plan
        </h1>
        <p className="text-muted-foreground text-lg">
          Plan your training week with AI assistance
        </p>
      </div>

      {/* Plan Section - Placeholder */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Training Plan</CardTitle>
              <CardDescription>
                AI-powered weekly training schedule
              </CardDescription>
            </div>
            <Button onClick={handleComingSoon} className="cursor-pointer">
              <Calendar className="mr-2 h-4 w-4" />
              Generate Plan
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No plan yet</h3>
            <p className="text-muted-foreground mb-4 max-w-sm">
              Generate your first AI-powered training plan based on your goals and schedule.
            </p>
            <Button onClick={handleComingSoon} className="cursor-pointer">Generate Your First Plan</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

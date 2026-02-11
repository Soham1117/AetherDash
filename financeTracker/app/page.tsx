import { Dashboard } from '@/components/dashboard/dashboard';
import { TrendingUp } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Finance Tracker</h1>
              <p className="text-muted-foreground">
                Track your expenses with smart duplicate detection
              </p>
            </div>
          </div>
        </header>

        {/* Dashboard */}
        <Dashboard />
      </div>
    </main>
  );
}

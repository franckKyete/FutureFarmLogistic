import { createFileRoute, redirect } from '@tanstack/react-router';
import { authStore } from '@/features/auth/store/auth.store';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (!authStore.state.isAuthenticated) {
      throw redirect({ to: '/auth/login' });
    }
  },
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-gray-500">Welcome to Future Farm Logistic.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Placeholder stat cards — replace with real data */}
        {[
          { label: 'Active Routes', value: '—', color: 'bg-brand-50 text-brand-700' },
          { label: 'Total Users', value: '—', color: 'bg-blue-50 text-blue-700' },
          { label: 'Pending Tasks', value: '—', color: 'bg-amber-50 text-amber-700' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
            <p className={`mt-2 text-4xl font-bold ${stat.color} rounded-md px-2 py-0.5 inline-block`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

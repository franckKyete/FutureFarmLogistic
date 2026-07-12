import { createFileRoute } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { useVisits } from '../../features/inspector/api/visits.queries';
import { PlanVisitModal } from '../../features/inspector/components/PlanVisitModal';
import type { VisitDto } from '../../features/inspector/types';

export const Route = createFileRoute('/inspector/planning')({
  component: PlanningPage,
});

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

const REASON_LABELS: Record<string, string> = {
  ROUTINE: 'Routine',
  URGENT: 'Urgence',
  FIRST_INSPECTION: '1ère inspection',
};

const REASON_STYLES: Record<string, string> = {
  ROUTINE: 'bg-blue-100 text-blue-800',
  URGENT: 'bg-red-100 text-red-800',
  FIRST_INSPECTION: 'bg-purple-100 text-purple-800',
};

const STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planifiée',
  COMPLETED: 'Effectuée',
  CANCELLED: 'Annulée',
  MISSED: 'Manquée',
};

const STATUS_STYLES: Record<string, string> = {
  PLANNED: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETED: 'bg-green-50 text-green-700 border-green-200',
  CANCELLED: 'bg-gray-100 text-gray-500 border-gray-200',
  MISSED: 'bg-red-50 text-red-700 border-red-200',
};

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDayColumn(jsDay: number): number {
  // JS getDay(): 0=Sun, 1=Mon … 6=Sat
  // Map to: Mon=0, Tue=1 … Sun=6
  return jsDay === 0 ? 6 : jsDay - 1;
}

function isToday(dateStr: string): boolean {
  return dateStr === formatDateKey(new Date());
}

function isTomorrow(dateStr: string): boolean {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return dateStr === formatDateKey(d);
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTodayDate(): string {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function Header({
  viewMode,
  onToggle,
}: {
  viewMode: 'calendar' | 'list';
  onToggle: (mode: 'calendar' | 'list') => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-xl font-bold text-[#1a5c35]">Planning des visites</h1>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onToggle('calendar')}
          className={`p-2 rounded-lg transition-colors cursor-pointer ${
            viewMode === 'calendar'
              ? 'text-[#1a5c35] bg-[#1a5c35]/10'
              : 'text-gray-400 hover:text-gray-600'
          }`}
          title="Vue calendrier"
        >
          <span className="material-symbols-outlined text-2xl">calendar_month</span>
        </button>
        <button
          onClick={() => onToggle('list')}
          className={`p-2 rounded-lg transition-colors cursor-pointer ${
            viewMode === 'list'
              ? 'text-[#1a5c35] bg-[#1a5c35]/10'
              : 'text-gray-400 hover:text-gray-600'
          }`}
          title="Vue liste"
        >
          <span className="material-symbols-outlined text-2xl">list</span>
        </button>
      </div>
    </div>
  );
}

function SegmentedControl({
  viewMode,
  onToggle,
}: {
  viewMode: 'calendar' | 'list';
  onToggle: (mode: 'calendar' | 'list') => void;
}) {
  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-6 bg-white">
      <button
        onClick={() => onToggle('calendar')}
        className={`flex-1 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
          viewMode === 'calendar'
            ? 'bg-[#1a5c35] text-white'
            : 'bg-white text-gray-600 hover:text-gray-900'
        }`}
      >
        Calendrier
      </button>
      <button
        onClick={() => onToggle('list')}
        className={`flex-1 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
          viewMode === 'list'
            ? 'bg-[#1a5c35] text-white'
            : 'bg-white text-gray-600 hover:text-gray-900'
        }`}
      >
        Liste
      </button>
    </div>
  );
}

function CalendarView({
  currentMonth,
  days,
  startCol,
  onPrev,
  onNext,
}: {
  currentMonth: Date;
  days: { day: number; dateStr: string; hasVisit: boolean }[];
  startCol: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const monthTitle = `${MONTHS_FR[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onPrev}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          aria-label="Mois précédent"
        >
          <span className="material-symbols-outlined text-gray-600">chevron_left</span>
        </button>
        <h2 className="text-base font-bold text-gray-800">{monthTitle}</h2>
        <button
          onClick={onNext}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          aria-label="Mois suivant"
        >
          <span className="material-symbols-outlined text-gray-600">chevron_right</span>
        </button>
      </div>

      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-gray-500 py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: startCol }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}
        {days.map((d) => (
          <div
            key={d.day}
            className="aspect-square flex flex-col items-center justify-center relative"
          >
            <span
              className={`text-sm font-medium ${
                d.dateStr === formatDateKey(new Date())
                  ? 'text-[#1a5c35] font-bold'
                  : 'text-gray-700'
              }`}
            >
              {d.day}
            </span>
            {d.hasVisit && (
              <span className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-[#1a5c35]" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function VisitCard({ visit }: { visit: VisitDto }) {
  const timeLabel = visit.plannedTime ?? 'Toute la journée';
  const reasonLabel = REASON_LABELS[visit.reason] ?? visit.reason;
  const reasonStyle = REASON_STYLES[visit.reason] ?? 'bg-gray-100 text-gray-700';
  const statusLabel = STATUS_LABELS[visit.status] ?? visit.status;
  const statusStyle = STATUS_STYLES[visit.status] ?? 'bg-gray-100 text-gray-500 border-gray-200';

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-4">
      <div className="shrink-0 w-16 text-center">
        <span className="inline-block text-[11px] font-bold text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 leading-tight">
          {timeLabel}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 mb-2 truncate">
          {visit.producerName ?? 'Producteur'}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${reasonStyle}`}>
            {reasonLabel}
          </span>
          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusStyle}`}>
            {statusLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

function ListView({ groupedVisits }: { groupedVisits: { date: string; visits: VisitDto[] }[] }) {
  return (
    <div className="space-y-6">
      {groupedVisits.map((group) => {
        let heading: string;
        if (isToday(group.date)) {
          heading = `Aujourd'hui`;
        } else if (isTomorrow(group.date)) {
          heading = 'Demain';
        } else {
          heading = formatDateHeader(group.date);
        }

        return (
          <div key={group.date}>
            <div className="mb-3">
              <h3 className="text-sm font-bold text-gray-800">{heading}</h3>
              {isToday(group.date) && (
                <p className="text-[11px] text-gray-400 mt-0.5">{formatTodayDate()}</p>
              )}
            </div>
            <div className="space-y-3">
              {group.visits.map((visit) => (
                <VisitCard key={visit.id} visit={visit} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-4 animate-pulse">
      <div className="shrink-0 w-16">
        <div className="h-10 bg-gray-200 rounded-md" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 bg-gray-200 rounded" />
        <div className="flex gap-2">
          <div className="h-5 w-16 bg-gray-200 rounded-full" />
          <div className="h-5 w-20 bg-gray-200 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center mt-16 text-center">
      <span className="material-symbols-outlined text-[64px] text-gray-300 mb-4">calendar_month</span>
      <p className="text-gray-500 font-semibold">Aucune visite planifiée</p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center mt-16 text-center">
      <span className="material-symbols-outlined text-[48px] text-red-400 mb-4">error_outline</span>
      <p className="text-gray-700 font-semibold mb-1">Erreur de chargement</p>
      <p className="text-gray-500 text-sm mb-4">Impossible de charger les visites.</p>
      <button
        onClick={onRetry}
        className="px-6 py-2.5 bg-[#1a5c35] text-white rounded-lg font-semibold text-sm cursor-pointer hover:bg-[#004322] transition-colors"
      >
        Réessayer
      </button>
    </div>
  );
}

function FAB({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 right-6 z-40 w-14 h-14 bg-[#1a5c35] text-white rounded-full shadow-lg flex items-center justify-center cursor-pointer hover:bg-[#004322] transition-colors active:scale-95"
      aria-label="Planifier une visite"
    >
      <span className="material-symbols-outlined text-3xl">add</span>
    </button>
  );
}

function PlanningPage() {
  const { data: visits, isLoading, isError, refetch } = useVisits();
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [showPlanModal, setShowPlanModal] = useState(false);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return {
        day,
        dateStr,
        hasVisit: visits?.some((v) => v.plannedDate === dateStr) ?? false,
      };
    });
  }, [year, month, visits]);

  const calendarStartCol = useMemo(() => {
    return getDayColumn(new Date(year, month, 1).getDay());
  }, [year, month]);

  const groupedVisits = useMemo(() => {
    if (!visits) return [];
    const map = new Map<string, VisitDto[]>();

    for (const v of visits) {
      const existing = map.get(v.plannedDate);
      if (existing) existing.push(v);
      else map.set(v.plannedDate, [v]);
    }

    return Array.from(map.entries())
      .map(([date, dateVisits]) => ({ date, visits: dateVisits }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [visits]);

  const navigateMonth = (delta: number) => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const handleToggle = (mode: 'calendar' | 'list') => {
    setViewMode(mode);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50 pb-24">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="h-7 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="flex gap-1">
              <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse" />
            </div>
          </div>
          <div className="h-10 bg-gray-200 rounded-lg animate-pulse mb-6" />
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50/50 pb-24">
        <div className="p-4">
          <Header viewMode={viewMode} onToggle={handleToggle} />
          <SegmentedControl viewMode={viewMode} onToggle={handleToggle} />
          <ErrorState onRetry={() => refetch()} />
        </div>
        <FAB onClick={() => setShowPlanModal(true)} />
        <PlanVisitModal isOpen={showPlanModal} onClose={() => setShowPlanModal(false)} />
      </div>
    );
  }

  if (!visits || visits.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50/50 pb-24">
        <div className="p-4">
          <Header viewMode={viewMode} onToggle={handleToggle} />
          <SegmentedControl viewMode={viewMode} onToggle={handleToggle} />
          <EmptyState />
        </div>
        <FAB onClick={() => setShowPlanModal(true)} />
        <PlanVisitModal isOpen={showPlanModal} onClose={() => setShowPlanModal(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-24">
      <div className="p-4">
        <Header viewMode={viewMode} onToggle={handleToggle} />
        <SegmentedControl viewMode={viewMode} onToggle={handleToggle} />

        {viewMode === 'calendar' ? (
          <CalendarView
            currentMonth={currentMonth}
            days={calendarDays}
            startCol={calendarStartCol}
            onPrev={() => navigateMonth(-1)}
            onNext={() => navigateMonth(1)}
          />
        ) : (
          <ListView groupedVisits={groupedVisits} />
        )}
      </div>

      <FAB onClick={() => setShowPlanModal(true)} />
      <PlanVisitModal isOpen={showPlanModal} onClose={() => setShowPlanModal(false)} />
    </div>
  );
}

import { createFileRoute } from '@tanstack/react-router';
import { useMyCenter } from '@/features/admin/api/inspections.queries';
import { DeliveryMap } from '@/features/shared/components/DeliveryMap';

export const Route = createFileRoute('/inspector/my-center')({
  component: MyCenterPage,
});

function MyCenterPage() {
  const { data: center, isLoading, isError, refetch } = useMyCenter();

  return (
    <div className="flex flex-col min-h-screen bg-[#f8f9ff] font-sans pb-24">
      {/* Header */}
      <header className="bg-white px-4 py-4 border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#1a5c35]">Centre Régional</span>
        <h1 className="text-xl font-bold text-[#0b1c30]">Ma Station d'Inspection</h1>
      </header>

      {/* Main Content */}
      <main className="p-4 space-y-4 flex-1">
        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-40 bg-white rounded-2xl border border-gray-200 p-4" />
            <div className="h-48 bg-white rounded-2xl border border-gray-200 p-4" />
          </div>
        ) : isError ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
            <span className="material-symbols-outlined text-4xl text-rose-500">error_outline</span>
            <p className="text-sm font-bold text-gray-800">Impossible de charger votre centre d'affectation</p>
            <button
              onClick={() => void refetch()}
              className="text-xs bg-[#1a5c35] text-white px-4 py-2 rounded-xl font-bold cursor-pointer"
            >
              Réessayer
            </button>
          </div>
        ) : !center ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 p-6 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl">corporate_fare</span>
            </div>
            <h3 className="text-base font-bold text-gray-800">Aucun centre actuellement assigné</h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              Votre compte inspecteur n'a pas encore été rattaché à une station d'inspection régionale par l'administrateur.
            </p>
          </div>
        ) : (
          <>
            {/* Center Info Card */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {center.code}
                  </span>
                  <h2 className="text-lg font-bold text-[#0b1c30] mt-2">{center.name}</h2>
                  <p className="text-xs font-semibold text-[#1a5c35] flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-sm">location_on</span>
                    Région : {center.regionName}
                  </p>
                </div>

                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                  Station active
                </span>
              </div>

              <div className="pt-3 border-t border-gray-100 space-y-2 text-xs text-gray-600">
                <p className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-base text-gray-400 shrink-0">place</span>
                  <span>{center.address}</span>
                </p>
                {center.latitude != null && center.longitude != null && (
                  <p className="flex items-center gap-2 font-mono text-[11px] text-gray-400">
                    <span className="material-symbols-outlined text-base text-gray-400 shrink-0">my_location</span>
                    <span>{Number(center.latitude).toFixed(4)}° N, {Number(center.longitude).toFixed(4)}° W</span>
                  </p>
                )}
              </div>
            </div>

            {/* Map representation */}
            {center.latitude != null && center.longitude != null && (
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-700 px-1">Localisation géographique</h3>
                <DeliveryMap
                  stops={[
                    {
                      id: center.id,
                      lat: Number(center.latitude),
                      lon: Number(center.longitude),
                      label: center.name,
                      type: 'COLLECTION',
                      status: 'COMPLETED',
                    },
                  ]}
                  className="h-56 w-full rounded-2xl overflow-hidden border border-gray-200 shadow-sm relative z-0"
                />
              </div>
            )}

            {/* Center Missions Info */}
            <div className="bg-[#eff4ff] rounded-2xl p-4 border border-blue-200 text-xs text-blue-900 space-y-2">
              <h4 className="font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-blue-600">assignment</span>
                Zone de couverture & Missions
              </h4>
              <p className="text-[11px] leading-relaxed text-blue-800">
                Ce centre coordonne les visites d'inspection terrain et les audits qualité des parcelles et récoltes dans le secteur <strong>{center.regionName}</strong>.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

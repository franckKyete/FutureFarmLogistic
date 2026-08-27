import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getRunDetailsQuery,
  startRunMutation,
  arriveAtStopMutation,
  completeStopMutation,
  skipStopMutation,
  uploadStopProofMutation,
  pushLocationMutation,
} from '@/features/tracking/api/tracking.queries';
import { useDeliveryMap } from '@/features/shared/hooks/useDeliveryMap';
import { DeliveryMap, MapStop } from '@/features/shared/components/DeliveryMap';
import { DeliveryRunStatus, DeliveryStopStatus, DeliveryStopType } from '@futurefarm/types';
import { addToast } from '@/features/shared/store/toast.store';

export const Route = createFileRoute('/driver/runs/$id')({
  component: DriverRunDetailPage,
});

function DriverRunDetailPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: run, isLoading, isError, refetch } = useQuery(getRunDetailsQuery(id));
  const { location, isConnected } = useDeliveryMap(id);

  // Mutations
  const startRun = useMutation({
    ...startRunMutation(),
    onSuccess: () => {
      addToast('Tournée démarrée ! Bonne route.', 'success');
      void refetch();
      queryClient.invalidateQueries({ queryKey: ['driver', 'my-runs'] });
    },
    onError: () => addToast('Erreur lors du démarrage de la tournée', 'error'),
  });

  const arriveStop = useMutation({
    ...arriveAtStopMutation(),
    onSuccess: () => {
      addToast('Arrivée enregistrée au point de livraison', 'success');
      void refetch();
    },
    onError: () => addToast("Erreur lors de l'enregistrement de l'arrivée", 'error'),
  });

  const completeStop = useMutation({
    ...completeStopMutation(),
    onSuccess: () => {
      addToast('Arrêt validé avec succès !', 'success');
      void refetch();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || "Erreur lors de la finalisation de l'arrêt";
      addToast(Array.isArray(msg) ? msg[0] : msg, 'error');
    },
  });

  const skipStop = useMutation({
    ...skipStopMutation(),
    onSuccess: () => {
      addToast('Arrêt ignoré', 'info');
      setSkippingStopId(null);
      setSkipReason('');
      void refetch();
    },
    onError: () => addToast("Erreur lors de l'action", 'error'),
  });

  const uploadProof = useMutation({
    ...uploadStopProofMutation(),
    onSuccess: () => {
      addToast('Photo justificative enregistrée', 'success');
      void refetch();
    },
    onError: () => addToast('Erreur lors du téléversement de la photo', 'error'),
  });

  const pushLocation = useMutation(pushLocationMutation());

  // State for skip stop modal
  const [skippingStopId, setSkippingStopId] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState('');

  // File input ref for photo upload
  const [uploadingStopId, setUploadingStopId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // GPS Ping broadcasting when run is in progress
  useEffect(() => {
    if (run?.status !== DeliveryRunStatus.IN_PROGRESS) return;

    const sendPing = () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const pingPayload: {
              runId: string;
              lat: number;
              lon: number;
              heading?: number;
              speedKmh?: number;
            } = {
              runId: id,
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
            };
            if (pos.coords.heading != null && !isNaN(pos.coords.heading)) {
              pingPayload.heading = pos.coords.heading;
            }
            if (pos.coords.speed != null && !isNaN(pos.coords.speed)) {
              pingPayload.speedKmh = Math.round(pos.coords.speed * 3.6);
            }
            pushLocation.mutate(pingPayload);
          },
          () => {
            // Geolocation fallback: slight simulated movement near stop
            const firstStop = run.stops?.[0]?.address;
            if (firstStop) {
              pushLocation.mutate({
                runId: id,
                lat: firstStop.lat,
                lon: firstStop.lon,
                speedKmh: 30,
              });
            }
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      }
    };

    sendPing();
    const interval = setInterval(sendPing, 15000);
    return () => clearInterval(interval);
  }, [id, run?.status]);

  const mapStops: MapStop[] = useMemo(() => {
    if (!run?.stops) return [];
    return run.stops.map((s) => ({
      id: s.id,
      lat: s.address.lat,
      lon: s.address.lon,
      label: s.address.city || s.address.street || 'Arrêt',
      type: s.type as 'COLLECTION' | 'DELIVERY',
      status: s.status,
    }));
  }, [run?.stops]);

  const sortedStops = useMemo(() => {
    if (!run?.stops) return [];
    return [...run.stops].sort((a, b) => a.sequence - b.sequence);
  }, [run?.stops]);

  const completedCount = sortedStops.filter(
    (s) => s.status === DeliveryStopStatus.COMPLETED || s.status === DeliveryStopStatus.SKIPPED
  ).length;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadingStopId) {
      uploadProof.mutate({ runId: id, stopId: uploadingStopId, file });
    }
  };

  const handleTriggerUpload = (stopId: string) => {
    setUploadingStopId(stopId);
    fileInputRef.current?.click();
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3" />
        <div className="h-48 bg-gray-200 rounded-xl" />
        <div className="h-32 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  if (isError || !run) {
    return (
      <div className="text-center py-20 p-6 space-y-3">
        <span className="material-symbols-outlined text-4xl text-rose-500">error_outline</span>
        <p className="text-sm font-bold text-gray-800">Tournée introuvable</p>
        <Link to="/driver/runs" className="text-xs bg-[#004322] text-white px-4 py-2 rounded-lg font-bold inline-block">
          Retour aux tournées
        </Link>
      </div>
    );
  }

  const isPlanned = run.status === DeliveryRunStatus.PLANNED;
  const isInProgress = run.status === DeliveryRunStatus.IN_PROGRESS;
  const isCompleted = run.status === DeliveryRunStatus.COMPLETED;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hidden file input for photo proofs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Top App Bar */}
      <header className="bg-white px-4 py-3 border-b border-gray-200 sticky top-0 z-30 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <Link to="/driver/runs" className="p-1 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </Link>
          <div>
            <h1 className="font-mono text-sm font-bold text-[#0b1c30]">
              TRK-{run.id.slice(0, 6).toUpperCase()}
            </h1>
            <p className="text-[10px] text-gray-500">
              {new Date(run.scheduledAt).toLocaleDateString('fr-FR', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>

        {isInProgress ? (
          <span className="flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-full border border-emerald-200 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            En direct
          </span>
        ) : (
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
            {run.status}
          </span>
        )}
      </header>

      {/* Main Body */}
      <main className="p-4 space-y-4 flex-1 pb-12">
        {/* Start Run Action Banner */}
        {isPlanned && (
          <div className="bg-[#eff4ff] rounded-2xl p-4 border border-blue-200 shadow-sm space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#004322] text-white flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-2xl">play_arrow</span>
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#004322]">Prêt à partir ?</h3>
                <p className="text-xs text-gray-600">Démarrez la tournée pour activer le suivi en direct.</p>
              </div>
            </div>

            <button
              onClick={() => startRun.mutate(run.id)}
              disabled={startRun.isPending}
              className="w-full py-3 bg-[#004322] text-white rounded-xl font-bold text-sm shadow-sm active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">local_shipping</span>
              {startRun.isPending ? 'Démarrage...' : 'Démarrer la tournée'}
            </button>
          </div>
        )}

        {/* Live Mini Map */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-bold text-gray-700">Carte de navigation</span>
            {isConnected && (
              <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                GPS actif
              </span>
            )}
          </div>
          <DeliveryMap
            stops={mapStops}
            driverPosition={location ? { lat: location.lat, lon: location.lon, heading: location.heading } : null}
            className="h-56 w-full rounded-2xl overflow-hidden border border-gray-200 shadow-sm relative z-0"
          />
        </div>

        {/* Progress Tracker */}
        <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-gray-700">Progression des arrêts</span>
            <span className="font-mono font-bold text-[#004322]">
              {completedCount} / {sortedStops.length}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-[#004322] h-full transition-all duration-500"
              style={{
                width: `${sortedStops.length > 0 ? (completedCount / sortedStops.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Stops List */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 px-1">
            Étapes de la tournée ({sortedStops.length})
          </h2>

          {sortedStops.map((stop, index) => {
            const isCollection = stop.type === DeliveryStopType.COLLECTION;
            const isStopPending = stop.status === DeliveryStopStatus.PENDING;
            const isStopArrived = stop.status === DeliveryStopStatus.ARRIVED;
            const isStopCompleted = stop.status === DeliveryStopStatus.COMPLETED;
            const isStopSkipped = stop.status === DeliveryStopStatus.SKIPPED;

            return (
              <div
                key={stop.id}
                className={`bg-white rounded-2xl p-4 border transition-all shadow-xs space-y-3 ${
                  isStopArrived
                    ? 'border-[#004322] ring-2 ring-[#004322]/15 bg-emerald-50/20'
                    : isStopCompleted
                      ? 'border-gray-200 opacity-80'
                      : 'border-gray-200'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 font-mono font-bold text-xs flex items-center justify-center">
                      #{index + 1}
                    </span>
                    <div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          isCollection
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isCollection ? '📦 COLLECTE' : '🏠 LIVRAISON'}
                      </span>
                      <h4 className="text-sm font-bold text-[#0b1c30] mt-0.5">
                        {stop.address.city || stop.address.street}
                      </h4>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isStopCompleted
                        ? 'bg-emerald-100 text-emerald-800'
                        : isStopArrived
                          ? 'bg-blue-100 text-blue-800'
                          : isStopSkipped
                            ? 'bg-gray-100 text-gray-500'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {isStopCompleted
                      ? '✅ Terminé'
                      : isStopArrived
                        ? '🔵 Sur place'
                        : isStopSkipped
                          ? '⛔ Ignoré'
                          : '🟡 En attente'}
                  </span>
                </div>

                {/* Details */}
                <p className="text-xs text-gray-600">
                  <span className="font-semibold">{stop.address.street}</span>, {stop.address.city}
                </p>

                {stop.notes && (
                  <p className="text-xs italic text-gray-500 bg-gray-50 p-2 rounded-lg">
                    Note: {stop.notes}
                  </p>
                )}

                {/* Actions per stop */}
                {!isCompleted && !isStopCompleted && !isStopSkipped && (
                  <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-2">
                    {isStopPending && (
                      <button
                        onClick={() => arriveStop.mutate({ runId: id, stopId: stop.id })}
                        disabled={arriveStop.isPending || !isInProgress}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isInProgress
                            ? 'bg-[#004322] text-white hover:bg-[#00331a] active:scale-98 shadow-xs'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">location_on</span>
                        {arriveStop.isPending ? 'Validation...' : "Je suis arrivé"}
                      </button>
                    )}

                    {isStopArrived && (
                      <>
                        <button
                          onClick={() => handleTriggerUpload(stop.id)}
                          disabled={uploadProof.isPending}
                          className="flex-1 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-amber-600 active:scale-98 transition-all cursor-pointer shadow-xs"
                        >
                          <span className="material-symbols-outlined text-sm">photo_camera</span>
                          {uploadProof.isPending ? 'Envoi...' : 'Photo preuve'}
                        </button>

                        <button
                          onClick={() => completeStop.mutate({ runId: id, stopId: stop.id })}
                          disabled={completeStop.isPending}
                          className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-700 active:scale-98 transition-all cursor-pointer shadow-xs"
                        >
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          {completeStop.isPending ? 'Finalisation...' : 'Valider arrêt'}
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => setSkippingStopId(stop.id)}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Passer
                    </button>
                  </div>
                )}

                {isStopCompleted && stop.completedAt && (
                  <p className="text-[10px] text-emerald-700 font-semibold pt-1">
                    Validé le {new Date(stop.completedAt).toLocaleTimeString('fr-FR')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Skip Stop Reason Modal */}
      {skippingStopId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-xl animate-slide-in">
            <h3 className="font-bold text-base text-gray-900">Motif du saut d'arrêt</h3>
            <p className="text-xs text-gray-500">
              Veuillez préciser la raison pour laquelle cet arrêt ne peut être honoré.
            </p>

            <textarea
              rows={3}
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              placeholder="Ex: Destinataire absent, route barrée, incident mécanique..."
              className="w-full border border-gray-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-[#004322] focus:outline-none"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setSkippingStopId(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (skipReason.trim()) {
                    skipStop.mutate({
                      runId: id,
                      stopId: skippingStopId,
                      dto: { reason: skipReason },
                    });
                  }
                }}
                disabled={!skipReason.trim() || skipStop.isPending}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold disabled:opacity-50"
              >
                {skipStop.isPending ? 'Enregistrement...' : "Confirmer le saut"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Icon } from '@/features/shared/components/Icon';
import { addToast } from '@/features/shared/store/toast.store';
import { rejectDispatchMutation } from '@/features/tracking/api/tracking.queries';
import type { RunAssignedPayload } from '@futurefarm/types';

export function DispatchModal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dispatchPayload, setDispatchPayload] = useState<RunAssignedPayload | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(30);

  const rejectMutation = useMutation({
    ...rejectDispatchMutation(),
    onSettled: () => {
      setDispatchPayload(null);
    },
  });

  // Listen for real-time dispatch assignments via WebSocket
  useEffect(() => {
    if (!user?.id) return;

    const apiBase = (import.meta.env['VITE_API_BASE_URL'] as string) || '';
    const wsUrl = apiBase.replace(/\/v1\/?$/, '') || window.location.origin;
    const token = localStorage.getItem('access_token');

    const socket = io(`${wsUrl}/logistics`, {
      ...(token ? { auth: { token: `Bearer ${token}` } } : {}),
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join_driver', { driverId: user.id });
    });

    socket.on('run:assigned', (payload: RunAssignedPayload) => {
      setDispatchPayload(payload);
      setSecondsLeft(30);
    });

    return () => {
      socket.emit('leave_driver', { driverId: user.id });
      socket.disconnect();
    };
  }, [user?.id]);

  // 30-second countdown timer
  useEffect(() => {
    if (!dispatchPayload) return;

    if (secondsLeft <= 0) {
      addToast('Délai dépassé. Tournée réassignée.', 'info');
      rejectMutation.mutate(dispatchPayload.runId);
      return;
    }

    const timer = setTimeout(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [dispatchPayload, secondsLeft]);

  if (!dispatchPayload) return null;

  const handleAccept = () => {
    addToast('Tournée acceptée ! Rendez-vous dans vos courses.', 'success');
    queryClient.invalidateQueries({ queryKey: ['driver', 'my-runs'] });
    setDispatchPayload(null);
  };

  const handleReject = () => {
    addToast('Tournée refusée.', 'info');
    rejectMutation.mutate(dispatchPayload.runId);
  };

  // SVG Circular progress calculation
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (secondsLeft / 30) * circumference;

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-gray-100 text-center space-y-5">
        {/* Animated Countdown Ring */}
        <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
            <circle
              cx="32"
              cy="32"
              r={radius}
              className="stroke-gray-100"
              strokeWidth="5"
              fill="transparent"
            />
            <circle
              cx="32"
              cy="32"
              r={radius}
              className={`transition-all duration-1000 ease-linear ${
                secondsLeft <= 10 ? 'stroke-rose-500' : 'stroke-[#004322]'
              }`}
              strokeWidth="5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={`text-xl font-black ${
                secondsLeft <= 10 ? 'text-rose-600 animate-pulse' : 'text-[#004322]'
              }`}
            >
              {secondsLeft}s
            </span>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-[#004322] text-[10px] font-extrabold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            Nouvelle mission disponible
          </div>
          <h3 className="text-lg font-black text-[#0b1c30] tracking-tight">
            Proposition de livraison
          </h3>
          <p className="text-xs text-gray-500 font-medium">
            Acceptez avant la fin du décompte pour prendre en charge cette course.
          </p>
        </div>

        {/* Run Summary Card */}
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-left space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
              Trajet
            </span>
            {dispatchPayload.totalDistanceKm && (
              <span className="text-xs font-bold text-[#004322]">
                ~{dispatchPayload.totalDistanceKm} km
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <div className="w-0.5 h-6 bg-gray-200" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            </div>
            <div className="flex-1 space-y-2 text-xs">
              <div>
                <p className="font-extrabold text-gray-800">
                  {dispatchPayload.originCity}
                </p>
                <p className="text-[10px] text-gray-400">Collecte producteur</p>
              </div>
              <div>
                <p className="font-extrabold text-gray-800">
                  {dispatchPayload.destinationCity}
                </p>
                <p className="text-[10px] text-gray-400">Livraison acheteur</p>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-[11px] font-semibold text-gray-600">
            <span>Arrêts: <strong className="text-gray-900">{dispatchPayload.stopsCount}</strong></span>
            <span>Départ: <strong className="text-gray-900">{new Date(dispatchPayload.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</strong></span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handleReject}
            disabled={rejectMutation.isPending}
            className="flex-1 py-3 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="flex-2 py-3 bg-[#004322] hover:bg-[#1a5c35] text-white rounded-xl text-xs font-black shadow-md active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Icon name="check" className="text-base" />
            <span>Accepter la tournée</span>
          </button>
        </div>
      </div>
    </div>
  );
}

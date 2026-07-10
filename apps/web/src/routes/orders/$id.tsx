import { useState } from 'react';
import {
  createFileRoute,
  Link,
  Outlet,
  useRouterState,
} from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getOrderDetailsQuery,
  cancelOrderMutation,
  confirmPaymentMutation,
} from '@/features/orders/api/buyer-orders.queries';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { addToast } from '@/features/shared/store/toast.store';
import { OrderStatus } from '@futurefarm/types';
import type { OrderDto } from '@futurefarm/types';

export const Route = createFileRoute('/orders/$id')({
  beforeLoad: () => {
    requireAuth();
  },
  component: OrderDetailPage,
});

const STATUS_BADGE: Record<OrderStatus, { label: string; className: string }> = {
  [OrderStatus.PENDING_PAYMENT]: { label: 'Paiement en attente', className: 'bg-amber-50 text-amber-700' },
  [OrderStatus.AWAITING_CONFIRMATION]: { label: 'À confirmer', className: 'bg-blue-50 text-blue-700' },
  [OrderStatus.CONFIRMED]: { label: 'Confirmée', className: 'bg-emerald-50 text-emerald-700' },
  [OrderStatus.SHIPPED]: { label: 'En transit', className: 'bg-blue-50 text-blue-700' },
  [OrderStatus.DELIVERED]: { label: 'Livrée', className: 'bg-emerald-50 text-emerald-700' },
  [OrderStatus.CANCELLED]: { label: 'Annulée', className: 'bg-rose-50 text-rose-700' },
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente',
  PAID: 'Payé',
  REFUNDED: 'Remboursé',
};

function formatPrice(amount: number): string {
  return `${amount.toLocaleString()} FCFA`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function canCancel(order: OrderDto): boolean {
  return (
    order.status === OrderStatus.PENDING_PAYMENT ||
    order.status === OrderStatus.AWAITING_CONFIRMATION
  );
}

function canConfirmPayment(order: OrderDto): boolean {
  return order.status === OrderStatus.PENDING_PAYMENT;
}

function canTrack(order: OrderDto): boolean {
  return (
    order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.SHIPPED
  );
}

function OrderDetailPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const routerState = useRouterState();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const matches = routerState.matches;
  const isChildRoute = matches.some(
    (m) => m.routeId.startsWith(Route.id + '/'),
  );

  const { data: order, isLoading, isError } = useQuery(getOrderDetailsQuery(id));

  const cancelOrder = useMutation({
    mutationFn: () => cancelOrderMutation().mutationFn(id),
    onSuccess: () => {
      addToast('Commande annulée avec succès.', 'success');
      setShowCancelConfirm(false);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: () => {
      addToast("Erreur lors de l'annulation de la commande.", 'error');
    },
  });

  const confirmPayment = useMutation({
    mutationFn: () => confirmPaymentMutation().mutationFn({ paymentRef: id }),
    onSuccess: () => {
      addToast('Paiement confirmé avec succès.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: () => {
      addToast('Erreur lors de la confirmation du paiement.', 'error');
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-[480px] mx-auto min-h-screen bg-[#f8f9ff]">
        <header className="fixed top-0 w-full z-50 bg-white border-b border-[#E5E7EB] max-w-[480px] mx-auto">
          <div className="flex items-center gap-4 px-4 h-16">
            <Link to="/orders" className="material-symbols-outlined text-[#0b1c30] cursor-pointer">
              arrow_back
            </Link>
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
        </header>
        <main className="pt-20 px-4 flex justify-center">
          <span className="material-symbols-outlined text-[#1a5c35] animate-spin text-2xl mt-8">
            sync
          </span>
        </main>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="max-w-[480px] mx-auto min-h-screen bg-[#f8f9ff]">
        <header className="fixed top-0 w-full z-50 bg-white border-b border-[#E5E7EB] max-w-[480px] mx-auto">
          <div className="flex items-center gap-4 px-4 h-16">
            <Link to="/orders" className="material-symbols-outlined text-[#0b1c30] cursor-pointer">
              arrow_back
            </Link>
            <h1 className="text-sm font-bold text-[#0b1c30]">Commande</h1>
          </div>
        </header>
        <main className="pt-20 px-4">
          <div className="py-16 text-center">
            <span className="material-symbols-outlined text-4xl text-gray-300 mb-3 block">
              error_outline
            </span>
            <p className="text-sm text-gray-500 font-semibold">Commande introuvable</p>
            <Link to="/orders" className="text-xs text-[#1a5c35] font-bold underline mt-2 inline-block">
              Retour aux commandes
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const badge = STATUS_BADGE[order.status];
  const address = order.deliveryAddress;

  if (isChildRoute) {
    return (
      <div className="max-w-[480px] mx-auto min-h-screen bg-[#f8f9ff]">
        <header className="fixed top-0 w-full z-50 bg-white border-b border-[#E5E7EB] max-w-[480px] mx-auto shadow-sm">
          <div className="flex items-center gap-4 px-4 h-16 w-full">
            <Link
              to="/orders/$id"
              params={{ id }}
              className="material-symbols-outlined text-[#0b1c30] cursor-pointer hover:opacity-70"
            >
              arrow_back
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-[#0b1c30] truncate">
                Commande #{order.id.slice(0, 8)}
              </h1>
              <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold mt-0.5 ${badge.className}`}>
                {badge.label}
              </span>
            </div>
          </div>
        </header>
        <main className="pt-20">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="max-w-[480px] mx-auto min-h-screen bg-[#f8f9ff] relative pb-8">
      <header className="fixed top-0 w-full z-50 bg-white border-b border-[#E5E7EB] max-w-[480px] mx-auto">
        <div className="flex items-center gap-4 px-4 h-16">
          <Link to="/orders" className="material-symbols-outlined text-[#0b1c30] cursor-pointer">
            arrow_back
          </Link>
          <h1 className="text-sm font-bold text-[#0b1c30]">Détails commande</h1>
        </div>
      </header>

      <main className="pt-20 px-4 space-y-5">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[#1a5c35] font-bold text-xs">
              #{order.id.slice(0, 8)}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          <div className="h-px bg-[#E5E7EB]" />
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Total</span>
              <span className="font-bold text-[#0b1c30]">{formatPrice(order.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Paiement</span>
              <span className="font-bold text-[#0b1c30]">
                {PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span className="font-bold text-[#0b1c30]">{formatDate(order.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm space-y-2">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Adresse de livraison</h2>
          <p className="text-sm font-semibold text-[#0b1c30]">{address.street}</p>
          <p className="text-xs text-gray-600">{address.postalCode} {address.city}, {address.country}</p>
        </div>

        {order.notes && (
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm space-y-2">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Notes</h2>
            <p className="text-sm text-[#0b1c30] italic">{order.notes}</p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Articles ({order.lines.length})
          </h2>
          <div className="space-y-3">
            {order.lines.map((line) => (
              <div key={line.id} className="flex justify-between items-start border-b border-[#E5E7EB]/50 last:border-b-0 pb-3 last:pb-0">
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#0b1c30] truncate">
                    {line.harvest?.product?.name ?? 'Produit'}
                  </p>
                  <p className="text-xs text-gray-500">{line.quantity} x {formatPrice(line.unitPrice)}</p>
                  {line.status && (
                    <span className="inline-block text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      {line.status}
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-[#0b1c30] ml-4 whitespace-nowrap">
                  {formatPrice(line.totalPrice)}
                </p>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-[#E5E7EB]">
            <span className="text-xs font-bold text-gray-500">Total</span>
            <span className="text-sm font-black text-[#1a5c35]">{formatPrice(order.totalAmount)}</span>
          </div>
        </div>

        {order.cancellationFee > 0 && (
          <div className="bg-rose-50 rounded-xl border border-rose-100 p-4 shadow-sm">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-rose-800">Frais d&apos;annulation</p>
                <p className="text-[10px] text-rose-600">Inclus dans le remboursement</p>
              </div>
              <span className="text-sm font-bold text-rose-800">{formatPrice(order.cancellationFee)}</span>
            </div>
          </div>
        )}

        {order.cancelledReason && (
          <div className="bg-rose-50 rounded-xl border border-rose-100 p-4 shadow-sm">
            <p className="text-xs font-bold text-rose-800">Motif d&apos;annulation</p>
            <p className="text-sm text-rose-700 mt-1 italic">{order.cancelledReason}</p>
          </div>
        )}

        <div className="space-y-3 pt-2">
          {canConfirmPayment(order) && (
            <button
              onClick={() => confirmPayment.mutate()}
              disabled={confirmPayment.isPending}
              className="w-full py-3 bg-[#1a5c35] text-white rounded-xl text-xs font-bold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {confirmPayment.isPending ? 'Confirmation...' : 'Confirmer le paiement'}
            </button>
          )}

          {canCancel(order) && !showCancelConfirm && (
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="w-full py-3 border border-rose-300 text-rose-700 rounded-xl text-xs font-bold hover:bg-rose-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              Annuler la commande
            </button>
          )}

          {showCancelConfirm && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-3">
              <p className="text-xs text-rose-800 font-semibold text-center">
                Êtes-vous sûr de vouloir annuler cette commande ?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs font-bold text-gray-600 cursor-pointer"
                >
                  Retour
                </button>
                <button
                  onClick={() => cancelOrder.mutate()}
                  disabled={cancelOrder.isPending}
                  className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                >
                  {cancelOrder.isPending ? 'Annulation...' : 'Confirmer'}
                </button>
              </div>
            </div>
          )}

          {canTrack(order) && (
            <Link
              to="/orders/$id/tracking"
              params={{ id }}
              className="flex items-center justify-center gap-2 w-full py-3 bg-[#004322] text-white rounded-xl text-xs font-bold hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <span className="material-symbols-outlined text-base">location_on</span>
              Suivre la livraison
            </Link>
          )}
        </div>
      </main>

      <Outlet />
    </div>
  );
}

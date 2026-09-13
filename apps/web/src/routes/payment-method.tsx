import { Icon } from '@/features/shared/components/Icon';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPaymentMethodQuery,
  createSetupSessionMutation,
  confirmSetupSessionMutation,
  detachPaymentMethodMutation,
} from '@/features/auctions/api/auctions.queries';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { addToast } from '@/features/shared/store/toast.store';
import { BuyerHeader } from '@/features/buyer/components/BuyerHeader';

export interface PaymentMethodSearchParams {
  returnUrl?: string;
  auctionId?: string;
  setup_session_id?: string;
}

export const Route = createFileRoute('/payment-method')({
  validateSearch: (search: Record<string, unknown>): PaymentMethodSearchParams => {
    const res: PaymentMethodSearchParams = {};
    if (typeof search['returnUrl'] === 'string' && search['returnUrl']) {
      res.returnUrl = search['returnUrl'];
    }
    if (typeof search['auctionId'] === 'string' && search['auctionId']) {
      res.auctionId = search['auctionId'];
    }
    if (typeof search['setup_session_id'] === 'string' && search['setup_session_id']) {
      res.setup_session_id = search['setup_session_id'];
    }
    return res;
  },
  component: PaymentMethodPage,
});

function PaymentMethodPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: paymentMethod, refetch: refetchPaymentMethod } = useQuery({
    ...getPaymentMethodQuery(),
    enabled: isAuthenticated,
  });

  const createSetupSession = useMutation({
    ...createSetupSessionMutation(),
    onSuccess: (data) => {
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      }
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        'Erreur lors de la redirection vers la page sécurisée Stripe.';
      addToast(msg, 'error');
    },
  });

  const confirmSetupSession = useMutation({
    ...confirmSetupSessionMutation(),
    onSuccess: () => {
      addToast('Carte bancaire enregistrée avec succès sur Stripe !', 'success');
      void queryClient.invalidateQueries({
        queryKey: ['users', 'me', 'payment-method'],
      });
      void refetchPaymentMethod();

      if (search.returnUrl) {
        void navigate({ to: search.returnUrl as any });
      } else {
        void navigate({
          to: '/payment-method',
          search: {},
          replace: true,
        });
      }
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        "Erreur lors de la confirmation de l'enregistrement Stripe.";
      addToast(msg, 'error');
    },
  });

  const detachPaymentMethod = useMutation({
    ...detachPaymentMethodMutation(),
    onSuccess: () => {
      addToast('Carte bancaire supprimée avec succès.', 'success');
      void queryClient.invalidateQueries({
        queryKey: ['users', 'me', 'payment-method'],
      });
      void refetchPaymentMethod();
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        'Erreur lors de la suppression de la carte.';
      addToast(msg, 'error');
    },
  });

  useEffect(() => {
    if (search.setup_session_id) {
      confirmSetupSession.mutate({ sessionId: search.setup_session_id });
    }
  }, [search.setup_session_id]);

  const handleStartStripeSetup = () => {
    const returnUrl = search.returnUrl
      ? `${window.location.origin}${search.returnUrl}`
      : `${window.location.origin}/payment-method`;

    createSetupSession.mutate({
      ...(search.auctionId ? { auctionId: search.auctionId } : {}),
      returnUrl,
    });
  };

  const handleBack = () => {
    if (search.returnUrl) {
      void navigate({ to: search.returnUrl as any });
    } else {
      void navigate({ to: '/profile' });
    }
  };

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen pb-20 font-sans">
      <BuyerHeader
        title="Moyen de paiement"
        showBack
        backTo={search.returnUrl || '/profile'}
      />

      <main className="pt-20 px-4 max-w-[480px] mx-auto">
        {/* Main Card Container */}
        <div className="bg-white border border-[#c0c9be] rounded-3xl p-6 shadow-sm">
          {/* Header Title & Subtitle */}
          <div className="flex items-center gap-3 pb-4 border-b border-[#c0c9be]/50 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-[#004322]/10 flex items-center justify-center text-[#004322]">
              <Icon name="credit_card" className="text-[24px]" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-[#0b1c30]">
                Moyen de paiement
              </h2>
              <p className="text-[12px] text-[#707970]">
                Enregistrez votre carte pour participer aux enchères
              </p>
            </div>
          </div>

          {/* Confirming session loader */}
          {confirmSetupSession.isPending && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-[#404941]">
              <Icon name="progress_activity" className="animate-spin  text-[32px] text-[#004322]" />
              <p className="text-[14px]">
                Validation de votre carte auprès de Stripe...
              </p>
            </div>
          )}

          {/* Current Saved Card (if exists) */}
          {!confirmSetupSession.isPending && paymentMethod?.hasPaymentMethod && (
            <div className="space-y-4">
              <div className="p-4 bg-[#e8f5e9] border border-[#1a5c35]/30 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <Icon name="credit_card" className="text-[#1a5c35] text-[24px]" />
                    <span className="text-[14px] font-bold text-[#0b1c30] capitalize">
                      {paymentMethod.brand || 'Carte bancaire'} ••••{' '}
                      {paymentMethod.last4}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-[#1a5c35] text-white rounded-full text-[10px] font-bold uppercase tracking-wider">
                    Enregistrée
                  </span>
                </div>
                <p className="text-[12px] text-[#404941] mb-1">
                  Expire le {paymentMethod.expMonth}/{paymentMethod.expYear}
                </p>
                <p className="text-[11px] text-[#707970]">
                  Cette carte sera utilisée automatiquement et débitée uniquement si vous remportez une enchère.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleStartStripeSetup}
                  disabled={createSetupSession.isPending}
                  className="flex-1 py-3 bg-[#004322] hover:bg-[#003319] text-white rounded-xl text-[13px] font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {createSetupSession.isPending ? (
                    <>
                      <Icon name="progress_activity" className="animate-spin  text-[18px]" />
                      Redirection...
                    </>
                  ) : (
                    <>
                      <Icon name="sync_alt" className="text-[18px]" />
                      Mettre à jour sur Stripe
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => detachPaymentMethod.mutate()}
                  disabled={detachPaymentMethod.isPending}
                  className="px-4 py-3 border border-[#ba1a1a]/30 text-[#ba1a1a] hover:bg-[#ffdad6]/30 rounded-xl text-[13px] font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Icon name="delete" className="text-[18px]" />
                  Supprimer
                </button>
              </div>

              {search.returnUrl && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="w-full mt-2 py-3 border border-[#c0c9be] rounded-xl text-[14px] font-semibold text-[#404941] hover:bg-[#f8f9ff] active:scale-[0.98] transition-all cursor-pointer"
                >
                  Retourner à l'enchère
                </button>
              )}
            </div>
          )}

          {/* No card saved - Hosted checkout flow */}
          {!confirmSetupSession.isPending && !paymentMethod?.hasPaymentMethod && (
            <div className="space-y-4">
              <div className="text-[13px] text-[#404941] flex items-start gap-2.5 bg-[#eff4ff] p-4 rounded-2xl border border-[#004322]/10 leading-relaxed">
                <Icon name="security" className="text-[#004322] text-[22px] shrink-0 mt-0.5" />
                <span>
                  Pour participer aux enchères, Stripe conserve vos coordonnées bancaires en toute sécurité. Aucun montant n'est débité immédiatement. Votre carte ne sera débitée que si vous remportez l'enchère.
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={createSetupSession.isPending}
                  className="flex-1 py-3.5 border border-[#c0c9be] rounded-xl text-[14px] font-semibold text-[#404941] hover:bg-[#f8f9ff] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleStartStripeSetup}
                  disabled={createSetupSession.isPending}
                  className="flex-1 py-3.5 bg-[#004322] hover:bg-[#003319] text-white rounded-xl text-[14px] font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {createSetupSession.isPending ? (
                    <>
                      <Icon name="progress_activity" className="animate-spin  text-[18px]" />
                      Redirection...
                    </>
                  ) : (
                    <>
                      <Icon name="open_in_new" className="text-[18px]" />
                      Enregistrer sur Stripe
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

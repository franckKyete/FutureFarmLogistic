import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { loginMutation } from '@/features/auth/api/auth.queries';
import { setAuth } from '@/features/auth/store/auth.store';

export const Route = createFileRoute('/auth/login')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const res: { redirect?: string } = {};
    if (typeof search['redirect'] === 'string' && search['redirect']) {
      res.redirect = search['redirect'];
    }
    return res;
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect: redirectPath } = Route.useSearch();
  const [showPassword, setShowPassword] = useState(false);
  const [enable2FA, setEnable2FA] = useState(false);

  const { mutate: login, isPending, error } = useMutation({
    ...loginMutation(),
    onSuccess: (data) => {
      setAuth(data.user, data.tokens);
      void navigate({ to: redirectPath || '/' });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    login({
      email: form.get('email') as string,
      password: form.get('password') as string,
    });
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative px-4 py-8 bg-[#f8f9ff]">
      {/* Background Pattern */}
      <div className="fixed inset-0 z-[-1] opacity-20 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(#707970 0.5px, transparent 0.5px)',
            backgroundSize: '24px 24px',
          }}
        ></div>
      </div>

      {/* Main Container */}
      <main className="w-full max-w-[480px] flex flex-col gap-6">
        {/* Header / Logo */}
        <header className="text-center">
          <h1 className="font-display text-4xl font-semibold text-[#004322] mb-2 tracking-tight">Future Farm</h1>
          <p className="font-body-md text-on-surface-variant text-sm">
            Precision agriculture &amp; fintech excellence.
          </p>
        </header>

        {/* Login Card */}
        <section className="bg-surface-container-lowest rounded-2xl border border-[#c0c9be] p-8 flex flex-col gap-6 shadow-sm transition-all">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold text-on-surface tracking-tight">Welcome Back</h2>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-tertiary-fixed text-on-tertiary-fixed rounded-full text-[10px] font-bold tracking-wider uppercase">
                <span className="material-symbols-outlined text-[14px]">agriculture</span>
                Modern Farmer
              </span>
              <p className="text-[10px] text-on-surface-variant">Role auto-selected from preferences</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email Field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface-variant px-1" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                  mail
                </span>
                <input
                  className="w-full bg-surface-bright border border-outline-variant rounded-lg py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-[#004322] focus:ring-2 focus:ring-[#eae2de]/80 transition-all placeholder:text-outline/40"
                  id="email"
                  name="email"
                  placeholder="farmer@futurefarm.com"
                  type="email"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="text-xs font-semibold text-on-surface-variant" htmlFor="password">
                  Password
                </label>
                <a className="text-xs font-semibold text-[#004322] hover:underline" href="#">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                  lock
                </span>
                <input
                  className="w-full bg-surface-bright border border-outline-variant rounded-lg py-3 pl-10 pr-12 text-sm focus:outline-none focus:border-[#004322] focus:ring-2 focus:ring-[#eae2de]/80 transition-all placeholder:text-outline/40"
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  type={showPassword ? 'text' : 'password'}
                  required
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-[#004322] transition-colors cursor-pointer"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* 2FA Toggle */}
            <div className="flex items-center justify-between bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/30">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-on-surface">Enable 2FA</span>
                <span className="text-[10px] text-on-surface-variant mt-0.5">Added security for transactions</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  className="sr-only peer"
                  type="checkbox"
                  checked={enable2FA}
                  onChange={(e) => setEnable2FA(e.target.checked)}
                />
                <div className="w-11 h-6 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {error && (
              <div className="rounded-lg bg-error-container border border-error px-4 py-3 text-xs text-on-error-container">
                {error instanceof Error ? error.message : 'Login failed. Please try again.'}
              </div>
            )}

            {/* Primary Action */}
            <button
              className="w-full bg-[#004322] text-on-primary font-semibold text-sm py-3.5 rounded-lg active:scale-[0.98] hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              type="submit"
              disabled={isPending}
            >
              {isPending ? 'Logging In...' : 'Log In'}
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center gap-4 my-1">
            <div className="h-[0.5px] bg-outline-variant/50 flex-1"></div>
            <span className="text-[10px] font-semibold text-outline uppercase tracking-widest">or continue with</span>
            <div className="h-[0.5px] bg-outline-variant/50 flex-1"></div>
          </div>

          {/* Social Logins */}
          <div className="grid grid-cols-2 gap-3.5">
            <button
              type="button"
              className="flex items-center justify-center gap-2 py-3 border border-outline-variant rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors active:scale-95 cursor-pointer"
            >
              <img
                alt="Google"
                className="w-4 h-4"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuB4FRvKcpQUTxOhZcyfPsDgaguZfaYm_6PV48arVP6PjA1ijb0GiDTnsaj2e2BNknil-q5s9GYfljHFgs1jKfB0BCaCXdccvZ7e-mdVJuQzF34D3VEm-hTye08m-TUF_c13jwgKFXoWq0645QAyGHCOoXbihOg9P6wUtNrcScR2cIGi2nzjZL5co4tIy1NeQN41wso1kY1ffvW3LfZBI7gv69Uh6HDA_mpL9RjrXinbNXsGPv5BJFjot34p-rAdfKkejlnzFQ4rvHk"
              />
              Google
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-2 py-3 border border-outline-variant rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-outline text-[16px]">phone_iphone</span>
              Phone
            </button>
          </div>
        </section>

        {/* Footer Links */}
        <footer className="text-center flex flex-col gap-4">
          <p className="text-xs text-on-surface-variant">
            Don't have an account?{' '}
            <Link className="text-[#004322] font-bold hover:underline" to="/auth/register">
              Create Account
            </Link>
          </p>
          <div className="flex justify-center gap-6">
            <a className="text-[10px] font-semibold text-outline hover:text-on-surface transition-colors" href="#">
              Privacy Policy
            </a>
            <a className="text-[10px] font-semibold text-outline hover:text-on-surface transition-colors" href="#">
              Terms of Service
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}

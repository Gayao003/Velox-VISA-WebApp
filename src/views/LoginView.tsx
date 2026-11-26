import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Fuel,
  FileSpreadsheet,
  Landmark,
  Truck,
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
} from 'lucide-react';
import { authService } from '../core/auth/authService';
import { isFirebaseConfigured } from '../core/auth/firebase';
import { Button } from '../core/ui/button';
import { Input } from '../core/ui/input';
import { useToast } from '../core/ui/toast';

const VISA_SLIDES = [
  {
    id: 1,
    badge: 'Velox Integrated Station App',
    icon: <FileSpreadsheet className="h-3.5 w-3.5 text-blue-300" />,
    title: 'Unified Daily Sales Report & Cash Accounting',
    description:
      'Real-time shift cash counting, denomination breakdown, cashless payments, and credit sales across all 60+ Velox stations.',
    statValue: '60 Stations',
    statLabel: 'Unified Station Ledger',
  },
  {
    id: 2,
    badge: 'Shift Deposits & Collections',
    icon: <Landmark className="h-3.5 w-3.5 text-cyan-300" />,
    title: 'Shift Deposit, Collection & AR Reconciliation',
    description:
      'Track depository bank slips, customer AR/SOA payments, GCash/Maya references, and check clearances in one place.',
    statValue: '436+ Customers',
    statLabel: 'Pre-loaded Credit LoVs',
  },
  {
    id: 3,
    badge: 'Bank Pickup & VDS Registry',
    icon: <Truck className="h-3.5 w-3.5 text-emerald-300" />,
    title: 'In-Transit Pickup & VDS Settlement Tracking',
    description:
      'Monitor armored bank pickups, counted vs slip amounts, and automated business-day deposit settlement.',
    statValue: 'Cloud Sync',
    statLabel: 'Firebase Firestore + Offline Cache',
  },
];

type AuthMode = 'signin' | 'signup' | 'forgot';

export const LoginView: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [currentSlide, setCurrentSlide] = useState(0);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const firebaseReady = isFirebaseConfigured();

  useEffect(() => {
    if (authService.isAuthenticated()) {
      navigate('/dsr', { replace: true });
    }
    return authService.subscribe((session) => {
      if (session) navigate('/dsr', { replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    const t = setInterval(() => {
      setCurrentSlide((s) => (s + 1) % VISA_SLIDES.length);
    }, 5500);
    return () => clearInterval(t);
  }, []);

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setIsLoading(true);
    try {
      const res = await authService.signInWithGoogle();
      if (res.success) {
        toast('Signed in with Google', 'success');
        navigate('/dsr', { replace: true });
      } else {
        setErrorMessage(res.error || 'Google Sign-In failed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setIsLoading(true);
    try {
      if (authMode === 'forgot') {
        const res = await authService.resetPassword(email);
        if (res.success) {
          setInfoMessage(res.message);
        } else {
          setErrorMessage(res.message);
        }
        return;
      }

      if (authMode === 'signup') {
        const res = await authService.registerWithEmail(email, password, fullName);
        if (res.success) {
          toast('Account created & signed in', 'success');
          navigate('/dsr', { replace: true });
        } else {
          setErrorMessage(res.error || 'Registration failed.');
        }
        return;
      }

      const res = await authService.signInWithEmail(email, password);
      if (res.success) {
        toast('Signed in successfully', 'success');
        navigate('/dsr', { replace: true });
      } else {
        setErrorMessage(res.error || 'Sign-in failed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const slide = VISA_SLIDES[currentSlide];

  return (
    <div className="min-h-screen w-full flex bg-slate-50 font-sans">
      {/* Left Showcase Panel */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[54%] relative bg-slate-950 text-white flex-col justify-between p-10 overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #2563eb 0%, transparent 45%), radial-gradient(circle at 80% 80%, #0ea5e9 0%, transparent 45%)',
          }}
        />

        <div className="relative z-10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
            <Fuel className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-base font-extrabold tracking-tight">VELOX VISA</div>
            <div className="text-[11px] text-slate-400 font-medium">
              Velox Integrated Station App
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-xl space-y-6 my-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-blue-200">
            {slide.icon}
            <span>{slide.badge}</span>
          </div>

          <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight leading-tight">
            {slide.title}
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed">{slide.description}</p>

          <div className="inline-flex items-center gap-4 px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10">
            <div>
              <div className="text-xl font-extrabold text-white">{slide.statValue}</div>
              <div className="text-xs text-slate-400">{slide.statLabel}</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {VISA_SLIDES.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setCurrentSlide(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === currentSlide ? 'w-8 bg-blue-500' : 'w-2 bg-slate-700 hover:bg-slate-600'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setCurrentSlide((s) => (s - 1 + VISA_SLIDES.length) % VISA_SLIDES.length)
              }
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentSlide((s) => (s + 1) % VISA_SLIDES.length)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Login Card */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md space-y-5 bg-white p-8 rounded-2xl border border-slate-200 shadow-card">
          <div className="flex flex-col items-center text-center space-y-2">
            {!logoError ? (
              <img
                src="/visa-logo.png"
                alt="VISA"
                onError={() => setLogoError(true)}
                className="h-11 w-auto object-contain mb-1"
              />
            ) : (
              <div className="h-12 w-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 mb-1">
                <Fuel className="h-6 w-6" />
              </div>
            )}
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
              {authMode === 'signup'
                ? 'Create VISA Account'
                : authMode === 'forgot'
                ? 'Reset Password'
                : 'Sign in to VISA'}
            </h2>
            <p className="text-xs text-slate-500">
              Velox Integrated Station App • DSR, Meter & Registry Portal
            </p>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {infoMessage && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            {authMode === 'signup' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Full Name
                </label>
                <Input
                  icon={<User className="h-4 w-4" />}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Juan Dela Cruz"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Email Address
              </label>
              <Input
                type="email"
                icon={<Mail className="h-4 w-4" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@velox.ph"
                required
              />
            </div>

            {authMode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-500">
                    Password
                  </label>
                  {authMode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('forgot');
                        setErrorMessage(null);
                        setInfoMessage(null);
                      }}
                      className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    icon={<Lock className="h-4 w-4" />}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full justify-center font-bold"
            >
              <span>
                {authMode === 'signup'
                  ? 'Create Account'
                  : authMode === 'forgot'
                  ? 'Send Reset Link'
                  : 'Sign In'}
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          {authMode !== 'forgot' && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold">
                  <span className="bg-white px-2.5 text-slate-400">Or Continue With</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleGoogleLogin}
                isLoading={isLoading}
                className="w-full justify-center gap-3 font-bold border-slate-300 hover:bg-slate-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                <span>Continue with Google</span>
              </Button>
            </>
          )}

          {/* Mode Switcher */}
          <div className="text-center text-xs text-slate-500 pt-1">
            {authMode === 'signin' ? (
              <>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setErrorMessage(null);
                    setInfoMessage(null);
                  }}
                  className="font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setErrorMessage(null);
                    setInfoMessage(null);
                  }}
                  className="font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Back to Sign in
                </button>
              </>
            )}
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <CheckCircle2
              className={`h-3.5 w-3.5 ${firebaseReady ? 'text-emerald-600' : 'text-amber-500'}`}
            />
            <span>
              {firebaseReady
                ? 'Connected to Firebase project: velox-visa'
                : 'Firebase .env not configured'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

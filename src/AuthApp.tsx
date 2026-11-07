import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { frFR } from '@clerk/localizations';
import { shadcn } from '@clerk/themes';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { CockpitApp } from './App';

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

if (!clerkPubKey) {
  throw new Error('VITE_CLERK_PUBLISHABLE_KEY is missing.');
}

function stripBase(path: string) {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#22d3ee',
    colorForeground: '#e2e8f0',
    colorMutedForeground: '#94a3b8',
    colorDanger: '#fb7185',
    colorBackground: '#0d121f',
    colorInput: '#070a12',
    colorInputForeground: '#f8fafc',
    colorNeutral: '#e2e8f0',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    borderRadius: '12px',
  },
  elements: {
    rootBox: 'w-full min-w-0 max-w-[440px] flex justify-center',
    cardBox: '!w-full !max-w-full min-w-0 bg-[#0d121f] rounded-2xl overflow-hidden border border-cyan-400/20',
    card: '!w-full !max-w-full !min-w-0 !shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!w-full !max-w-full !shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-slate-100',
    headerSubtitle: 'text-slate-400',
    socialButtonsBlockButtonText: 'text-slate-200',
    formFieldLabel: 'text-slate-300',
    footerActionLink: 'text-cyan-300 hover:text-cyan-200',
    footerActionText: 'text-slate-400',
    dividerText: 'text-slate-500',
    identityPreviewEditButton: 'text-cyan-300',
    formFieldSuccessText: 'text-emerald-300',
    alertText: 'text-rose-300',
    logoBox: 'h-10',
    logoImage: 'h-10 w-10',
    socialButtonsBlockButton: 'bg-slate-900 border-slate-700 hover:bg-slate-800',
    formButtonPrimary: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950',
    formFieldInput: 'bg-[#070a12] border-slate-700 text-slate-100',
    footerAction: 'bg-transparent',
    dividerLine: 'bg-slate-700',
    alert: 'bg-rose-950/50 border-rose-800',
    otpCodeFieldInput: 'bg-slate-900 border-slate-700 text-white',
    formFieldRow: 'mb-4',
    main: '!w-full !max-w-full bg-[#0d121f]',
  },
};

const clerkLocalization = {
  ...frFR,
  signIn: {
    ...(frFR.signIn ?? {}),
    start: {
      ...(frFR.signIn?.start ?? {}),
      subtitle: 'Connecte-toi pour retrouver ton cockpit.',
    },
  },
  signUp: {
    ...(frFR.signUp ?? {}),
    start: {
      ...(frFR.signUp?.start ?? {}),
      subtitle: 'Crée ton compte pour accéder au cockpit.',
    },
  },
};

function LoadingScreen() {
  return (
    <main className="min-h-screen grid place-items-center bg-[#070a12] text-cyan-200">
      <p className="font-mono text-sm">Chargement sécurisé…</p>
    </main>
  );
}

function PublicLanding() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070a12] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_45%_at_50%_-10%,#162444_0%,#070a12_65%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-7 sm:px-8">
        <header className="flex items-center gap-3">
          <img src={`${basePath}/logo.svg`} alt="" className="h-10 w-10" />
          <div>
            <p className="text-sm font-extrabold tracking-[0.18em] text-cyan-200">BLACKZELDON</p>
            <p className="font-mono text-[10px] tracking-[0.16em] text-slate-500">COCKPIT DE TRADING PAPIER</p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <Link href="/sign-in" className="whitespace-nowrap rounded-xl px-2.5 py-2 text-xs text-slate-300 transition hover:bg-white/5 hover:text-white sm:px-4 sm:text-sm">
              <span className="sm:hidden">Connexion</span>
              <span className="hidden sm:inline">Se connecter</span>
            </Link>
            <Link href="/sign-up" className="whitespace-nowrap rounded-xl border border-cyan-300/40 bg-cyan-400/10 px-2.5 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/20 sm:px-4 sm:text-sm">
              <span className="sm:hidden">S’inscrire</span>
              <span className="hidden sm:inline">Créer un compte</span>
            </Link>
          </div>
        </header>

        <section className="flex flex-1 flex-col justify-center py-20">
          <p className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1 font-mono text-xs text-cyan-200">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
            ANALYSE, PAS D’ORDRES RÉELS
          </p>
          <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
            Un cockpit clair pour lire les marchés.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
            Suis les données de marché disponibles, examine tes configurations et garde ton journal privé dans ton compte.
            Blackzeldon est un outil d’analyse papier, pas un service de courtage.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/sign-up" className="rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.18)] transition hover:bg-cyan-300">
              Créer mon compte
            </Link>
            <Link href="/sign-in" className="rounded-xl border border-slate-700 bg-slate-900/60 px-5 py-3 font-semibold text-slate-200 transition hover:border-cyan-300/40">
              J’ai déjà un compte
            </Link>
          </div>
          <p className="mt-8 max-w-xl text-xs leading-5 text-slate-500">
            Les estimations ne constituent pas un conseil financier. Si aucune source réelle ne répond, l’application affiche les données comme indisponibles plutôt que d’en inventer.
          </p>
        </section>
      </div>
    </main>
  );
}

function HomeRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  return isSignedIn ? <Redirect to="/app" /> : <PublicLanding />;
}

function SignInPage() {
  return (
    <main className="grid min-h-screen min-w-0 place-items-center overflow-x-hidden bg-[#070a12] px-4 py-10">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </main>
  );
}

function SignUpPage() {
  return (
    <main className="grid min-h-screen min-w-0 place-items-center overflow-x-hidden bg-[#070a12] px-4 py-10">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </main>
  );
}

function AppRoute() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { signOut } = useClerk();
  if (!isLoaded) return <LoadingScreen />;
  if (!isSignedIn || !userId) return <Redirect to="/" />;
  return (
    <CockpitApp
      key={userId}
      onSignOut={() => void signOut({ redirectUrl: basePath || '/' })}
    />
  );
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={clerkLocalization}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <Switch>
        <Route path="/" component={HomeRoute} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/app" component={AppRoute} />
        <Route component={() => <Redirect to="/" />} />
      </Switch>
    </ClerkProvider>
  );
}

export default function AuthApp() {
  return (
    <WouterRouter base={basePath}>
      <ClerkRoutes />
    </WouterRouter>
  );
}

import { useToast } from '@/components/ui/Toast';
import { Banner, Button, Field, Input } from '@/components/ui/primitives';
import { authClient, authErrorMessage } from '@/lib/auth';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';

export default function LoginPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result =
        mode === 'register'
          ? await authClient.signUp.email({ email, password, name })
          : await authClient.signIn.email({ email, password });

      if (result.error) {
        setError(authErrorMessage(result.error));
        return;
      }

      toast.success(mode === 'register' ? 'Account created' : 'Welcome back');
      await navigate({ to: '/' });
    } catch (submitError) {
      setError(authErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillDemo = () => {
    setMode('signin');
    setEmail('demo@applyai.dev');
    setPassword('demo1234');
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* left: form */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <div className="mb-5 flex h-11 w-11 items-center justify-center bg-neon text-lg font-black text-black">
              A
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {mode === 'signin' ? 'Sign in to ApplyAI' : 'Create your account'}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {mode === 'signin'
                ? 'Your pipeline, resumes and match scores.'
                : 'One account. Your job search, measured.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' ? (
              <Field label="Name">
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                  autoFocus
                />
              </Field>
            ) : null}

            <Field label="Email" htmlFor="login-email">
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                autoFocus={mode === 'signin'}
              />
            </Field>

            <Field
              label="Password"
              htmlFor="login-password"
              hint={mode === 'register' ? 'At least 8 characters.' : undefined}
            >
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
            </Field>

            {error ? <Banner tone="error">{error}</Banner> : null}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              loading={isSubmitting}
              icon={<ArrowRight size={16} />}
            >
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <div className="mt-6 space-y-3 text-sm">
            <p className="text-zinc-500">
              {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'signin' ? 'register' : 'signin');
                  setError(null);
                }}
                className="text-neon hover:underline"
              >
                {mode === 'signin' ? 'Register' : 'Sign in'}
              </button>
            </p>
            <button
              type="button"
              onClick={fillDemo}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Use the seeded demo account → demo@applyai.dev / demo1234
            </button>
          </div>
        </div>
      </div>

      {/* right: pitch */}
      <div className="relative hidden border-l border-white/8 bg-dark-800/20 lg:block">
        <div className="grid-noise absolute inset-0 opacity-60" />
        <div className="relative flex h-full flex-col justify-center px-14">
          <p className="label-micro mb-6">Job search co-pilot</p>
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight text-white">
            Every application, scored against your resume. No more guessing which ones are worth it.
          </h2>
          <ul className="mt-8 space-y-4 text-sm text-zinc-400">
            {[
              [
                'Match engine',
                'Skill coverage, keyword overlap and semantic similarity — each result explains the gaps.',
              ],
              [
                'Discovery',
                'Search Greenhouse, Lever, Ashby, Remotive, RemoteOK and Arbeitnow from one place.',
              ],
              [
                'Pipeline',
                'Seven stages, real status history, follow-up reminders and analytics that come from the data.',
              ],
              [
                'Cover letters',
                'Grounded in your resume: a local LLM when available, a template engine when not.',
              ],
            ].map(([title, description]) => (
              <li key={title} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-neon" />
                <span>
                  <span className="text-white">{title}</span>
                  <span className="block text-zinc-500">{description}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

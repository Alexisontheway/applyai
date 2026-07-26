import { useState, useRef } from 'react';
import { useRouter } from '@tanstack/react-router';
import { authClient } from '../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function extractError(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (err && typeof err === 'object') {
      const obj = err as Record<string, unknown>;
      if (obj.error && typeof obj.error === 'object') {
        const e = obj.error as Record<string, unknown>;
        if (typeof e.message === 'string') return e.message;
      }
      if (typeof obj.message === 'string') return obj.message;
    }
    return 'Something went wrong';
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (isRegister) {
        if (!name.trim()) {
          setError('Name is required');
          setIsSubmitting(false);
          return;
        }
        const res = await authClient.signUp.email({ email, password, name });
        if (res.error) {
          setError(extractError(res.error));
          setIsSubmitting(false);
          return;
        }
      } else {
        const res = await authClient.signIn.email({ email, password });
        if (res.error) {
          setError(extractError(res.error));
          setIsSubmitting(false);
          return;
        }
      }

      const session = await authClient.getSession();
      if (!session.data?.user) {
        setError('Session not created. Please sign in.');
        setIsSubmitting(false);
        return;
      }

      await router.navigate({ to: '/' });
    } catch (err) {
      setError(extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = () => {
    setIsRegister(!isRegister);
    setError('');
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-14 h-14 bg-neon text-dark-900 flex items-center justify-center font-bold text-xl mx-auto mb-4">
            A
          </div>
          <h1 className="text-2xl font-bold text-white">ApplyAI</h1>
          <p className="text-gray-500 text-sm mt-1">Job Search Co-Pilot</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-sm text-gray-400 mb-1 font-mono">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                className="w-full bg-dark-800 border border-neon/10 text-white px-4 py-2.5 text-sm focus:border-neon/50 focus:outline-none transition-colors"
                required
                autoFocus
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1 font-mono">Email</label>
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              className="w-full bg-dark-800 border border-neon/10 text-white px-4 py-2.5 text-sm focus:border-neon/50 focus:outline-none transition-colors"
              required
              autoFocus={!isRegister}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1 font-mono">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              className="w-full bg-dark-800 border border-neon/10 text-white px-4 py-2.5 text-sm focus:border-neon/50 focus:outline-none transition-colors"
              required
              minLength={8}
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-neon text-dark-900 font-semibold py-2.5 text-sm hover:bg-neon/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting
              ? (isRegister ? 'Creating account...' : 'Signing in...')
              : (isRegister ? 'Create account' : 'Sign in')}
          </button>

          <p className="text-center text-gray-500 text-sm">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={switchMode}
              className="text-neon hover:underline"
            >
              {isRegister ? 'Sign in' : 'Register'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

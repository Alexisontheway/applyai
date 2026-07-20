import { useState } from 'react';
import { useRouter } from '@tanstack/react-router';
import { authClient } from '../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isRegister) {
        await authClient.signUp.email({ email, password, name });
      } else {
        await authClient.signIn.email({ email, password });
      }
      router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
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
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-dark-800 border border-neon/10 text-white px-4 py-2.5 text-sm focus:border-neon/50 focus:outline-none transition-colors"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1 font-mono">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-dark-800 border border-neon/10 text-white px-4 py-2.5 text-sm focus:border-neon/50 focus:outline-none transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1 font-mono">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-dark-800 border border-neon/10 text-white px-4 py-2.5 text-sm focus:border-neon/50 focus:outline-none transition-colors"
              required
              minLength={8}
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full bg-neon text-dark-900 font-semibold py-2.5 text-sm hover:bg-neon/90 transition-colors"
          >
            {isRegister ? 'Create account' : 'Sign in'}
          </button>

          <p className="text-center text-gray-500 text-sm">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
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

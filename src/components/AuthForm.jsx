import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function AuthForm({ onAuthSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) onAuthSuccess(data.session.user);
    };
    checkSession();
  }, [onAuthSuccess]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const { data, error } = isSigningIn
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

      if (error) throw error;

      if (data.session) onAuthSuccess(data.session.user);
      else if (!isSigningIn) alert('Check your email to confirm your account.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <h2>{isSigningIn ? 'Sign In' : 'Create Account'}</h2>
      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit">
          {isSigningIn ? 'Sign In' : 'Sign Up'}
        </button>

        {error && <div className="auth-error">{error}</div>}
      </form>

      <p style={{ marginTop: '1.5rem', color: '#ccc', fontSize: '0.95rem' }}>
        {isSigningIn ? "Don't have an account?" : 'Already have an account?'}
      </p>

      <button className="auth-toggle" onClick={() => setIsSigningIn(!isSigningIn)}>
        {isSigningIn ? 'Sign Up' : 'Back to Sign In'}
      </button>
    </div>
  );
}

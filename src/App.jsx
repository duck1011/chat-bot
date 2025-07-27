import { useEffect, useState } from 'react';
import supabase from './lib/supabase';
import AuthForm from './components/AuthForm';
import ChatBot from './components/ChatBot';
import './App.css';
import './index.css';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Get current session on load
  useEffect(() => {
    const fetchSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      setSession(data.session || null);
      setLoading(false);
    };

    fetchSession();

    // 2. Listen for changes (login/logout)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div>
      {session?.user ? (
        <ChatBot user={session.user} />
      ) : (
        <AuthForm />
      )}
    </div>
  );
}

export default App;

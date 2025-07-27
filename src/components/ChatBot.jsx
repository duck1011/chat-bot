// ChatBot.jsx
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { FaSignOutAlt } from 'react-icons/fa';
import jsPDF from 'jspdf';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function ChatBot({ user }) {
  /* ---------- Chat state ---------- */
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello, I’m Barbershop Virtual Assistant. How may I assist you?' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  /* ---------- Reservation state ---------- */
  const [reservationStep, setReservationStep] = useState(null);
  const [service, setService] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [name, setName] = useState('');
  const [reservationConfirmed, setReservationConfirmed] = useState(false);

  const chatEndRef = useRef(null);
  useEffect(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  /* ---------- Core send handler ---------- */
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = { role: 'user', content: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setLoading(true);

    /* ---------- WIZARD FLOW ---------- */
    if (!reservationStep) {
      if (/reserve|book/i.test(input)) {
        setReservationStep('service');
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: 'What service would you like? (Haircut, Beard Trim, Styling)' },
        ]);
        setLoading(false);
        return;
      }
    }

    if (reservationStep === 'service') {
      setService(capitalize(input.trim()));
      setReservationStep('datetime');
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'What date and time? (YYYY-MM-DD HH:MM or “tomorrow 3pm” etc.)' },
      ]);
      setLoading(false);
      return;
    }

    if (reservationStep === 'datetime') {
      const parsed = parseHumanTime(input.trim());
      if (!parsed) {
        setMessages((m) => [...m, { role: 'assistant', content: 'I didn’t understand that date/time. Please try again.' }]);
        setLoading(false);
        return;
      }
      setDateTime(parsed);
      setReservationStep('name');
      setMessages((m) => [...m, { role: 'assistant', content: 'Your name for the booking?' }]);
      setLoading(false);
      return;
    }

    if (reservationStep === 'name') {
      setName(capitalize(input.trim()));
      await saveReservation();
      return;
    }

    /* ---------- FALLBACK: bot already proposed slot, user says “yes” ---------- */
    if (
      reservationStep !== 'done' &&
      /yes|confirm/i.test(input.trim()) &&
      messages.some((m) => m.role === 'assistant' && /confirmed|booked|reserved|got.*confirmed/i.test(m.content))
    ) {
      const lastBot = [...messages].reverse().find((m) => m.role === 'assistant');
      const svcMatch = lastBot.content.match(/(haircut|beard trim|styling)/i) || ['', 'Haircut'];
      const timeMatch = lastBot.content.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
      const extractedService = capitalize(svcMatch[1]);
      const extractedTime   = parseHumanTime(timeMatch?.[0] || 'today 10am');

      setService(extractedService);
      setDateTime(extractedTime);
      setName(user.user_metadata?.full_name || user.email.split('@')[0]);
      await saveReservation();
      return;
    }

    /* ---------- Generic LLM answer ---------- */
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3-8b-8192',
          messages: [{ role: 'system', content: SYSTEM_PROMPT(user) }, ...messages, userMsg],
        }),
      });
      const data = await res.json();
      const botReply = data.choices?.[0]?.message?.content || 'Sorry, no reply.';
      setMessages((m) => [...m, { role: 'assistant', content: botReply }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Something went wrong, please try again.' }]);
    } finally {
      setLoading(false);
    }

    /* ---------- Helper inside component ---------- */
    async function saveReservation() {
      if (!dateTime) {
        setMessages((m) => [...m, { role: 'assistant', content: 'Please provide a valid date & time.' }]);
        setReservationStep('datetime');
        setLoading(false);
        return;
      }

      const reservationTime = dateTime; // already ISO string
      const { data: clash } = await supabase
        .from('reservations')
        .select('id')
        .eq('reservation_time', reservationTime)
        .single();
      if (clash) {
        setMessages((m) => [...m, { role: 'assistant', content: 'That slot is already booked. Please choose another time.' }]);
        setReservationStep('datetime');
        return;
      }

      const { error } = await supabase.from('reservations').insert({
        user_id: user.id,
        service,
        reservation_time: reservationTime,
        // If your table does NOT have a 'name' column, delete the next line
        name: name || user.user_metadata?.full_name || user.email.split('@')[0],
      });
      if (error) {
        console.error(error);
        setMessages((m) => [...m, { role: 'assistant', content: 'Could not save reservation.' }]);
        return;
      }

      setReservationConfirmed(true);
      setReservationStep('done');
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: `You're all set, ${name || user.email}! Your ${service} is booked for ${new Date(
            reservationTime
          ).toLocaleString()}. You can now download your confirmation PDF.`,
        },
      ]);
      setLoading(false);
    }
  };

  /* ---------- Logout ---------- */
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  /* ---------- Receipt ---------- */
  const printReceipt = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Reservation Receipt', 20, 20);
    doc.setFontSize(12);
    doc.text(`Shop: Barbershop`, 20, 35);
    doc.text(`Customer: ${name || user.email}`, 20, 45);
    doc.text(`Service: ${service}`, 20, 55);
    doc.text(`Time: ${new Date(dateTime).toLocaleString()}`, 20, 65);
    doc.text('Thank you for your reservation!', 20, 85);
    doc.save('reservation_receipt.pdf');
  };

  /* ---------- Render ---------- */
  return (
    <div className="chatbot-outer-center">
      <div className="chatbot">
        <button className="logout-btn" onClick={handleLogout} title="Logout">
          <FaSignOutAlt />
        </button>

        <div className="chat-header">
          <h3>Welcome to Barbershop</h3>
        </div>

        <div className="chat-box">
          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              <strong>{msg.role === 'assistant' ? 'Assistant' : 'You'}:</strong> {msg.content}
            </div>
          ))}
          {loading && <div className="typing-indicator">Assistant is typing…</div>}
          <div ref={chatEndRef} />
        </div>

        <form className="chat-form" onSubmit={handleSend}>
          <input
            type="text"
            placeholder={
              reservationStep === 'service'
                ? 'Haircut / Beard Trim / Styling'
                : reservationStep === 'datetime'
                ? 'YYYY-MM-DD HH:MM or “tomorrow 3pm” etc.'
                : reservationStep === 'name'
                ? 'Your name'
                : 'Type your message…'
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            Send
          </button>
        </form>

        {reservationConfirmed && (
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <button className="download-button" onClick={printReceipt}>
              Download Reservation Receipt
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */
const SYSTEM_PROMPT = (user) => `
You are a helpful assistant for a barbershop.
The user is authenticated (email: ${user.email}, id: ${user.id}).
Keep every reply under 20 words. Ask exactly one piece of info at a time. 
Never list extra options unless the user explicitly requests them.”.
`;
const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

function parseHumanTime(str) {
  str = str.toLowerCase();
  const now = new Date();
  let d = new Date(now);

  if (str.includes('tomorrow')) d.setDate(d.getDate() + 1);

  const m = str.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return now.toISOString();

  let h = parseInt(m[1], 10);
  const min = parseInt(m[2] || 0, 10);
  const ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  d.setHours(h, min, 0, 0);
  return d.toISOString();
}


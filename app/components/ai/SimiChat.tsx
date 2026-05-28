'use client';

import { useEffect, useRef, useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function SimiChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '¡Hola, mano! Soy **Simi**, su asistente virtual de la Alcaldía de Simacota. ¿En qué le puedo colaborar sumercé el día de hoy? Puedo guiarlo sobre cómo radicar su PQRS, qué dependencia debe elegir o qué documentos necesita.',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load chat history from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('simi_chat_history');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {
        console.error('Error reading chat history:', e);
      }
    }
  }, []);

  // Save chat history to sessionStorage on update
  const saveHistory = (newMsgs: Message[]) => {
    setMessages(newMsgs);
    sessionStorage.setItem('simi_chat_history', JSON.stringify(newMsgs));
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim() || isThinking) return;

    const userText = inputValue.trim();
    setInputValue('');

    const updatedMessages = [...messages, { role: 'user', content: userText } as Message];
    saveHistory(updatedMessages);
    setIsThinking(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!response.ok) {
        throw new Error('Error al conectar con Simi.');
      }

      const data = await response.json();
      saveHistory([...updatedMessages, { role: 'assistant', content: data.content }]);
    } catch (error) {
      console.error('Chat error:', error);
      saveHistory([
        ...updatedMessages,
        {
          role: 'assistant',
          content: 'Mano, qué pena con sumercé, pero se me cayó la señal un momentico. Por favor, intente enviarme el mensaje nuevamente.',
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  function cleanHistory() {
    const initial = [
      {
        role: 'assistant',
        content: '¡Hola de nuevo, mano! Listo, empezamos limpitos. ¿En qué le puedo colaborar sumercé el día de hoy?',
      } as Message,
    ];
    setMessages(initial);
    sessionStorage.removeItem('simi_chat_history');
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {/* --- BOTÓN FLOTANTE --- */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Abrir asistente inteligente Simi"
        aria-expanded={isOpen}
        className={[
          'w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 shadow-xl border focus:outline-none',
          isOpen
            ? 'bg-slate-900 border-white/10 hover:bg-slate-800 scale-95'
            : 'bg-gradient-to-tr from-indigo-600 to-violet-500 hover:from-indigo-500 hover:to-violet-400 border-indigo-400/35 hover:shadow-indigo-500/30 scale-100 hover:scale-[1.05]',
        ].join(' ')}
      >
        {isOpen ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6 text-slate-100 animate-fade-in">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <div className="relative flex items-center justify-center animate-success-bounce">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
          </div>
        )}
      </button>

      {/* --- PANEL DE CHAT (GLASSMORPHISM) --- */}
      {isOpen && (
        <div
          className="absolute bottom-18 right-0 w-[350px] sm:w-[380px] h-[500px] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-fade-in-up"
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Cabecera */}
          <div className="bg-slate-950/60 px-4 py-3.5 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center shadow-inner relative">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.904-4.473M9.813 15.904L5.223 3.522a.75.75 0 01.02-.622.75.75 0 01.554-.424L20.25 6.075a.75.75 0 01.354 1.157L9.813 15.904z" />
                </svg>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-slate-950" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-100">Simi</p>
                <p className="text-[10px] text-slate-400">Asistente Municipal de Simacota</p>
              </div>
            </div>
            
            <button
              onClick={cleanHistory}
              title="Limpiar conversación"
              className="text-slate-500 hover:text-slate-300 transition-colors p-1.5 rounded-lg hover:bg-white/[0.04]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          </div>

          {/* Área de Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={[
                  'flex flex-col max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed transition-all duration-300 animate-fade-in-up',
                  msg.role === 'assistant'
                    ? 'self-start bg-slate-800/40 border border-white/[0.05] text-slate-200'
                    : 'self-end bg-indigo-600/90 text-white rounded-br-none ml-auto',
                ].join(' ')}
              >
                {/* Formateador simple de negritas en Markdown */}
                <p
                  dangerouslySetInnerHTML={{
                    __html: msg.content
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em>$1</em>')
                      .replace(/\n/g, '<br />'),
                  }}
                />
              </div>
            ))}

            {isThinking && (
              <div className="self-start bg-slate-800/40 border border-white/[0.05] text-slate-400 rounded-2xl px-4 py-3 text-xs max-w-[85%] animate-pulse">
                <div className="flex items-center gap-1">
                  <span>Simi está pensando</span>
                  <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Barra de Entrada */}
          <form
            onSubmit={handleSend}
            className="p-3 bg-slate-950/40 border-t border-white/5 flex gap-2"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Pregúntele a Simi... (ej. ¿Cómo pido el Sisbén?)"
              className="flex-1 bg-slate-800/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500/50"
              disabled={isThinking}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isThinking}
              aria-label="Enviar mensaje"
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 transition-colors w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// app/page.js
'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { COUNCILS, LLMS, getCouncil } from './config/council';
import { Icon, ArrowRight, ArrowUpRight, ArrowLeft, InfoIcon, CloseIcon, ChatIcon } from './components/Icons';
import { streamPost } from './lib/sse-client';
import { renderMarkdown, calculateDivergence, divergenceLabel } from './lib/utils';

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function LifeBoard() {
  const [screen, setScreen] = useState('home'); // 'home' | 'setup' | 'session'
  const [currentCouncil, setCurrentCouncil] = useState(null);
  const [counselors, setCounselors] = useState([]); // working copy with role/brief from selected council
  const [userQuestion, setUserQuestion] = useState('');

  // Session state
  const [responses, setResponses] = useState([]); // [{ llm, name, role, color, text, citations, isPresident, streaming }]
  const [currentStep, setCurrentStep] = useState(0);
  const [sessionError, setSessionError] = useState(null);
  const [isDone, setIsDone] = useState(false);

  // Debate modal
  const [debateAgent, setDebateAgent] = useState(null); // { counselorId, name, role, color, originalResponse }

  // Select council → setup
  const selectCouncil = (id) => {
    const council = getCouncil(id);
    setCurrentCouncil(council);
    setCounselors(
      LLMS.map((llm) => ({
        ...llm,
        role: council.personas[llm.id].role,
        brief: council.personas[llm.id].brief,
      }))
    );
    setUserQuestion('');
    setScreen('setup');
  };

  const goHome = () => {
    setScreen('home');
    setResponses([]);
    setCurrentStep(0);
    setIsDone(false);
    setSessionError(null);
  };

  // ═══════════════════════════════════════════════════════
  // Start session → orchestrate 7 calls (6 counselors + president)
  // ═══════════════════════════════════════════════════════

  const startSession = async () => {
    if (!userQuestion.trim()) return;
    setScreen('session');
    setResponses([]);
    setCurrentStep(0);
    setIsDone(false);
    setSessionError(null);

    // Placeholder response objects pra UI mostrar os cards desde já
    const initial = counselors.map((c) => ({
      llm: c.id,
      name: c.name,
      role: c.role,
      color: c.color,
      text: '',
      citations: null,
      isPresident: c.isPresident || false,
      streaming: false,
      done: false,
    }));
    setResponses(initial);

    // roda sequencial
    for (let i = 0; i < counselors.length; i++) {
      setCurrentStep(i);
      const c = counselors[i];

      setResponses((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], streaming: true };
        return next;
      });

      // priorResponses = textos já finalizados anteriormente
      const priorResponses = [];
      for (let j = 0; j < i; j++) {
        const r = initial[j];
        priorResponses.push({
          name: r.name,
          role: r.role,
          text: accumulatedText.current[j] || '',
        });
      }

      try {
        await streamPost(
          '/api/council/deliberate',
          {
            councilId: currentCouncil.id,
            counselorId: c.id,
            userQuestion,
            priorResponses,
          },
          {
            onDelta: (_delta, full) => {
              accumulatedText.current[i] = full;
              setResponses((prev) => {
                const next = [...prev];
                next[i] = { ...next[i], text: full };
                return next;
              });
            },
            onCitations: (citations) => {
              setResponses((prev) => {
                const next = [...prev];
                next[i] = { ...next[i], citations };
                return next;
              });
            },
            onDone: () => {
              setResponses((prev) => {
                const next = [...prev];
                next[i] = { ...next[i], streaming: false, done: true };
                return next;
              });
            },
            onError: (err) => {
              setSessionError(`Erro em ${c.name}: ${err.message}`);
            },
          }
        );
      } catch (err) {
        setSessionError(`Falha ao consultar ${c.name}: ${err.message}`);
        setResponses((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], streaming: false, done: true, text: next[i].text + '\n\n_[erro: ' + err.message + ']_' };
          return next;
        });
        // Tenta continuar com os próximos mesmo assim
      }
    }

    setCurrentStep(counselors.length); // step 8: turno do usuário
    setIsDone(true);
  };

  // ref pra textos acumulados (evita closure stale dentro do loop async)
  const accumulatedText = useRef([]);
  useEffect(() => { accumulatedText.current = []; }, [userQuestion]);

  // ═══════════════════════════════════════════════════════
  // Follow-up (step 8)
  // ═══════════════════════════════════════════════════════

  const sendFollowup = async ({ question, targetedIds }) => {
    const targets = targetedIds.length > 0
      ? counselors.filter((c) => targetedIds.includes(c.id))
      : counselors;

    // Append user card
    const userCard = {
      llm: '_user',
      name: 'Você',
      role: 'Pergunta de aprofundamento',
      color: 'var(--accent)',
      text: question,
      isUser: true,
      targets: targets.map((t) => t.name),
      done: true,
    };
    setResponses((prev) => [...prev, userCard]);

    // Para cada target, cria card e roda streaming
    for (const c of targets) {
      setResponses((prev) => [...prev, {
        llm: c.id,
        name: c.name,
        role: c.role,
        color: c.color,
        text: '',
        streaming: true,
        done: false,
      }]);

      // pequena espera pra React re-renderizar
      await new Promise((r) => setTimeout(r, 50));

      // full history = respostas originais acumuladas
      const fullHistory = counselors.map((cc, i) => ({
        name: cc.name,
        role: cc.role,
        text: accumulatedText.current[i] || '',
      }));

      try {
        await streamPost(
          '/api/council/targeted',
          {
            councilId: currentCouncil.id,
            counselorId: c.id,
            followUpQuestion: question,
            fullHistory,
          },
          {
            onDelta: (_delta, full) => {
              setResponses((prev) => {
                const next = [...prev];
                // encontra o último card desse counselor com streaming
                for (let k = next.length - 1; k >= 0; k--) {
                  if (next[k].llm === c.id && next[k].streaming) {
                    next[k] = { ...next[k], text: full };
                    break;
                  }
                }
                return next;
              });
            },
            onCitations: (citations) => {
              setResponses((prev) => {
                const next = [...prev];
                for (let k = next.length - 1; k >= 0; k--) {
                  if (next[k].llm === c.id && next[k].streaming) {
                    next[k] = { ...next[k], citations };
                    break;
                  }
                }
                return next;
              });
            },
            onDone: () => {
              setResponses((prev) => {
                const next = [...prev];
                for (let k = next.length - 1; k >= 0; k--) {
                  if (next[k].llm === c.id && next[k].streaming) {
                    next[k] = { ...next[k], streaming: false, done: true };
                    break;
                  }
                }
                return next;
              });
            },
          }
        );
      } catch (err) {
        setResponses((prev) => {
          const next = [...prev];
          for (let k = next.length - 1; k >= 0; k--) {
            if (next[k].llm === c.id && next[k].streaming) {
              next[k] = { ...next[k], streaming: false, done: true, text: `_[erro: ${err.message}]_` };
              break;
            }
          }
          return next;
        });
      }
    }
  };

  // ═══════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════

  return (
    <>
      {screen === 'home' && <HomeScreen onSelectCouncil={selectCouncil} />}
      {screen === 'setup' && currentCouncil && (
        <SetupScreen
          council={currentCouncil}
          counselors={counselors}
          setCounselors={setCounselors}
          userQuestion={userQuestion}
          setUserQuestion={setUserQuestion}
          onBack={goHome}
          onStart={startSession}
        />
      )}
      {screen === 'session' && currentCouncil && (
        <SessionScreen
          council={currentCouncil}
          counselors={counselors}
          userQuestion={userQuestion}
          responses={responses}
          currentStep={currentStep}
          isDone={isDone}
          error={sessionError}
          onBack={goHome}
          onFollowup={sendFollowup}
          onOpenDebate={(r) => setDebateAgent({ counselorId: r.llm, name: r.name, role: r.role, color: r.color, originalResponse: r.text })}
        />
      )}

      {debateAgent && (
        <DebateModal
          council={currentCouncil}
          agent={debateAgent}
          onClose={() => setDebateAgent(null)}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// HOME SCREEN
// ═══════════════════════════════════════════════════════════

function HomeScreen({ onSelectCouncil }) {
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => {
    if (!filter.trim()) return COUNCILS;
    const q = filter.toLowerCase();
    return COUNCILS.filter((c) =>
      c.title.toLowerCase().includes(q) ||
      c.subtitle.toLowerCase().includes(q) ||
      c.tagline.toLowerCase().includes(q)
    );
  }, [filter]);

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <div className="grid-bg" style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,229,199,0.08), transparent 60%)' }} />

      {/* NAV */}
      <nav style={{ position: 'relative', zIndex: 10, borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--accent)', color: '#001A16', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="serif" style={{ fontSize: 24 }}>Life Board</span>
            <span className="chip" style={{ marginLeft: 8 }}>v3.0 · strategic council</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <span className="hide-mobile" style={{ fontSize: 14, color: 'var(--text-dim)' }}>Sessions</span>
            <span className="hide-mobile" style={{ fontSize: 14, color: 'var(--text-dim)' }}>Archive</span>
            <button className="btn-ghost" style={{ fontSize: 14 }}>R · Dr. Brandão</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero-glow" style={{ position: 'relative', zIndex: 10, maxWidth: 1400, margin: '0 auto', padding: '80px 32px 56px' }}>
        <div className="fade-up" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
          <span className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--accent)' }}>
            Deliberative AI · 6 models in sequence
          </span>
        </div>
        <h1 className="serif fade-up" style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', lineHeight: 1.05, margin: 0, maxWidth: 900, animationDelay: '0.1s' }}>
          Um conselho de <em className="serif" style={{ color: 'var(--accent)', fontStyle: 'italic' }}>seis mentes</em> para toda decisão que importa.
        </h1>
        <p className="fade-up" style={{ marginTop: 24, fontSize: 18, maxWidth: 640, color: 'var(--text-dim)', animationDelay: '0.2s' }}>
          Claude, Perplexity, Gemini, DeepSeek, Grok e GPT deliberam em sequência. Cada um vê o anterior, constrói em cima, e o GPT preside sintetizando. <em style={{ color: 'var(--text)', fontStyle: 'italic' }}>Você decide.</em>
        </p>
        <div className="fade-up" style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', gap: 8, animationDelay: '0.3s' }}>
          <span className="chip"><span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)' }} />6 conselheiros LLM</span>
          <span className="chip">Síntese do presidente</span>
          <span className="chip">Medidor de divergência</span>
          <span className="chip">Perguntas dirigidas · debate 1-on-1</span>
        </div>
      </section>

      {/* GRID OF COUNCILS */}
      <section style={{ position: 'relative', zIndex: 10, maxWidth: 1400, margin: '0 auto', padding: '0 32px 96px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-faint)' }}>
              01 — Escolha o conselho
            </div>
            <h2 className="serif" style={{ fontSize: 30, marginTop: 8, margin: '8px 0 0' }}>
              Em que contexto você precisa deliberar?
            </h2>
          </div>
          <input
            type="text"
            className="input-field"
            placeholder="Filtrar conselhos..."
            style={{ width: 240 }}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectCouncil(c.id)}
              className="glass glass-hover"
              style={{ borderRadius: 16, padding: 24, textAlign: 'left', position: 'relative', overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="icon-wrap">
                  <Icon name={c.icon} size={22} />
                </div>
                <span className="card-arrow"><ArrowUpRight /></span>
              </div>
              <h3 className="serif" style={{ fontSize: 24, marginTop: 20, marginBottom: 0 }}>{c.title}</h3>
              <p style={{ fontSize: 14, marginTop: 8, color: 'var(--text-dim)' }}>{c.subtitle}</p>
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                <span className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-faint)' }}>
                  {c.tagline}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <footer style={{ position: 'relative', zIndex: 10, borderTop: '1px solid var(--line)', padding: '24px 0' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 32px', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-faint)' }}>
          <span className="mono">LIFE.BOARD — 2026</span>
          <span className="mono">DECIDER: DR. RAPHAEL BRANDÃO</span>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SETUP SCREEN
// ═══════════════════════════════════════════════════════════

function SetupScreen({ council, counselors, setCounselors, userQuestion, setUserQuestion, onBack, onStart }) {
  const updateCounselor = (idx, field, value) => {
    const next = [...counselors];
    next[idx] = { ...next[idx], [field]: value };
    setCounselors(next);
  };

  const restoreDefaults = () => {
    setCounselors(
      LLMS.map((llm) => ({
        ...llm,
        role: council.personas[llm.id].role,
        brief: council.personas[llm.id].brief,
      }))
    );
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <div className="grid-bg-fine" style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }} />

      <nav style={{ position: 'relative', zIndex: 10, borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onBack} style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)' }}>
            <ArrowLeft /> Voltar aos conselhos
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>STEP 02</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <div style={{ width: 24, height: 4, borderRadius: 100, background: 'var(--accent)' }} />
              <div style={{ width: 24, height: 4, borderRadius: 100, background: 'var(--accent)' }} />
              <div style={{ width: 24, height: 4, borderRadius: 100, background: 'var(--line-strong)' }} />
            </div>
          </div>
        </div>
      </nav>

      <section style={{ position: 'relative', zIndex: 10, maxWidth: 1400, margin: '0 auto', padding: '48px 32px' }}>
        <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--accent)' }}>
          02 — Configure seu board
        </div>
        <h2 className="serif" style={{ fontSize: 48, marginTop: 12, margin: '12px 0 0' }}>{council.title}</h2>
        <p style={{ marginTop: 12, fontSize: 18, color: 'var(--text-dim)', maxWidth: 720 }}>
          {council.subtitle} · Edite personas, troque conselheiros ou mantenha padrão.
        </p>

        <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: 32 }} className="setup-grid">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="serif" style={{ fontSize: 22, margin: 0 }}>
                Seus conselheiros <span style={{ color: 'var(--text-faint)' }}>· 6 + presidente</span>
              </h3>
              <button className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent)' }} onClick={restoreDefaults}>
                Restaurar padrão
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {counselors.map((c, i) => {
                const isPresident = c.id === 'gpt';
                return (
                  <div key={c.id} className="glass" style={{ borderRadius: 12, padding: 16, borderLeft: isPresident ? '2px solid var(--warn)' : undefined }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                      <div className={`counselor-node${isPresident ? ' president' : ''}`}>
                        {isPresident ? 'P' : i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                          <span className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em', color: c.color }}>
                            {c.name}
                          </span>
                          {isPresident ? (
                            <span className="chip warn">Presidente · síntese</span>
                          ) : (
                            <span className="chip">Conselheiro {i + 1}</span>
                          )}
                          <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>{c.model}</span>
                        </div>
                        <input
                          value={c.role}
                          onChange={(e) => updateCounselor(i, 'role', e.target.value)}
                          className="input-field"
                          style={{ marginBottom: 8, fontSize: 16, fontWeight: 500 }}
                          placeholder="Papel (ex: Mentor Sênior)"
                        />
                        <textarea
                          value={c.brief}
                          onChange={(e) => updateCounselor(i, 'brief', e.target.value)}
                          className="input-field"
                          rows={2}
                          placeholder="Instruções da persona"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SIDEBAR */}
          <aside className="glass" style={{ borderRadius: 16, padding: 24, height: 'fit-content', position: 'sticky', top: 24 }}>
            <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-faint)' }}>
              Contexto da sessão
            </div>
            <h4 className="serif" style={{ fontSize: 22, marginTop: 8, margin: '8px 0 0' }}>Sua pergunta inicial</h4>

            <textarea
              value={userQuestion}
              onChange={(e) => setUserQuestion(e.target.value)}
              placeholder={council.userQuestion}
              className="input-field"
              rows={8}
              style={{ marginTop: 16 }}
            />

            <button onClick={onStart} disabled={!userQuestion.trim()} className="btn-primary" style={{ width: '100%', marginTop: 24, padding: '14px 20px' }}>
              Convocar o conselho <ArrowRight />
            </button>

            <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <InfoIcon />
              Deliberação leva ~2-4 min em sequência
            </div>
          </aside>
        </div>

        <style jsx>{`
          @media (max-width: 1024px) {
            .setup-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SESSION SCREEN
// ═══════════════════════════════════════════════════════════

function SessionScreen({ council, counselors, userQuestion, responses, currentStep, isDone, error, onBack, onFollowup, onOpenDebate }) {
  const originalResponses = responses.slice(0, counselors.length); // primeiros N = deliberação inicial
  const followupResponses = responses.slice(counselors.length);

  // Divergence: só calcula após os 6 primeiros (não conta presidente)
  const divergence = useMemo(() => {
    const sixInitial = originalResponses
      .slice(0, 6)
      .filter((r) => r.done)
      .map((r) => r.text);
    if (sixInitial.length < 6) return null;
    return calculateDivergence(sixInitial);
  }, [originalResponses]);

  const divLabel = divergence !== null ? divergenceLabel(divergence) : null;

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <div className="grid-bg-fine" style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }} />

      <nav style={{ position: 'relative', zIndex: 10, borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1600, margin: '0 auto', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={onBack} style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)' }}>
              <ArrowLeft />
            </button>
            <div className="divider-v" style={{ height: 20 }} />
            <div>
              <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-faint)' }}>
                {council.title}
              </div>
              <div className="serif" style={{ fontSize: 18 }}>{isDone ? 'Deliberação concluída · sua vez' : 'Deliberação em andamento'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!isDone && <span className="chip active"><span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />Deliberando</span>}
            {isDone && <span className="chip warn">Sua decisão</span>}
          </div>
        </div>
      </nav>

      {error && (
        <div style={{ position: 'relative', zIndex: 10, maxWidth: 1600, margin: '12px auto 0', padding: '0 32px' }}>
          <div className="glass" style={{ borderRadius: 12, padding: 12, borderColor: 'rgba(255,92,122,0.3)', background: 'rgba(255,92,122,0.05)' }}>
            <span style={{ fontSize: 13, color: 'var(--danger)' }}>⚠ {error}</span>
          </div>
        </div>
      )}

      <section style={{ position: 'relative', zIndex: 10, maxWidth: 1600, margin: '0 auto', padding: '40px 32px', display: 'grid', gridTemplateColumns: '260px 1fr', gap: 40 }} className="session-grid">
        {/* TIMELINE */}
        <aside style={{ position: 'sticky', top: 24, height: 'fit-content' }} className="hide-mobile">
          <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-faint)', marginBottom: 20 }}>
            Timeline
          </div>
          <Timeline counselors={counselors} currentStep={currentStep} isDone={isDone} />

          {/* DIVERGENCE METER */}
          {divergence !== null && (
            <div className="glass" style={{ marginTop: 24, padding: 16, borderRadius: 12 }}>
              <div className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-faint)', marginBottom: 10 }}>
                Divergência
              </div>
              <div className="divergence-track">
                <div className="divergence-fill" style={{ width: `${divergence}%` }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{divLabel.label}</span>
                <span className="mono" style={{ fontSize: 13, color: 'var(--accent)' }}>{divergence}%</span>
              </div>
              <p style={{ fontSize: 11, marginTop: 6, color: 'var(--text-dim)', margin: '6px 0 0' }}>{divLabel.desc}</p>
            </div>
          )}
        </aside>

        {/* FEED */}
        <main style={{ minWidth: 0 }}>
          {/* User question */}
          <div className="glass fade-up" style={{ borderRadius: 16, padding: 24, marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div className="counselor-node" style={{ width: 28, height: 28, fontSize: 10 }}>R</div>
              <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-faint)' }}>
                Pergunta de Raphael · decisor
              </div>
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.6, margin: 0, color: 'var(--text)' }}>{userQuestion}</p>
          </div>

          {/* Deliberation cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {responses.map((r, i) => (
              <ResponseCard
                key={i}
                index={i}
                response={r}
                onOpenDebate={onOpenDebate}
              />
            ))}
          </div>

          {/* User turn */}
          {isDone && (
            <UserTurn
              counselors={counselors}
              onSend={onFollowup}
              onEnd={onBack}
            />
          )}
        </main>
      </section>

      <style jsx>{`
        @media (max-width: 1024px) {
          .session-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TIMELINE
// ═══════════════════════════════════════════════════════════

function Timeline({ counselors, currentStep, isDone }) {
  const steps = [
    ...counselors.slice(0, 6).map((c, i) => ({
      num: String(i + 1).padStart(2, '0'),
      label: c.name,
      role: c.role,
      type: 'counselor',
      idx: i,
    })),
    { num: '07', label: 'GPT', role: 'Presidente · síntese', type: 'president', idx: 6 },
    { num: '08', label: 'Você', role: 'Decisão ou aprofundar', type: 'user', idx: 7 },
  ];

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {steps.map((s, i) => {
        const isUserStep = s.type === 'user';
        const isCurrentUser = isUserStep && isDone;
        const status =
          currentStep > s.idx || isCurrentUser ? 'done' :
          currentStep === s.idx ? 'active' : '';
        const nodeClass = `counselor-node ${status} ${s.type === 'president' ? 'president' : ''}`.trim();
        return (
          <div key={i} style={{ position: 'relative', display: 'flex', gap: 16 }}>
            {i < steps.length - 1 && <div className="timeline-line" />}
            <div className={nodeClass}>{s.num}</div>
            <div style={{ minWidth: 0, paddingTop: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: status ? 'var(--text)' : 'var(--text-dim)' }}>{s.label}</div>
              <div className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-faint)', marginTop: 2 }}>
                {s.role}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// RESPONSE CARD
// ═══════════════════════════════════════════════════════════

function ResponseCard({ index, response: r, onOpenDebate }) {
  const isPresident = r.isPresident;
  const isUser = r.isUser;

  if (isUser) {
    return (
      <article className="glass fade-up" style={{ borderRadius: 16, padding: 24, background: 'linear-gradient(180deg, rgba(0,229,199,0.04), rgba(255,255,255,0.01))', borderColor: 'rgba(0,229,199,0.2)' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div className="counselor-node done" style={{ width: 32, height: 32, fontSize: 10 }}>R</div>
          <div>
            <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--accent)' }}>
              Raphael · decisor
            </div>
            <div className="serif" style={{ fontSize: 18 }}>{r.role}</div>
          </div>
        </header>
        <div style={{ fontSize: 16, color: 'var(--text)' }}>{r.text}</div>
        {r.targets && r.targets.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {r.targets.map((t) => (
              <span key={t} className="chip active">→ {t}</span>
            ))}
          </div>
        )}
      </article>
    );
  }

  return (
    <article
      className="glass fade-up"
      style={{
        borderRadius: 16,
        padding: 24,
        ...(isPresident
          ? {
              borderColor: 'rgba(255,181,71,0.3)',
              background: 'linear-gradient(180deg, rgba(255,181,71,0.04), rgba(255,255,255,0.01))',
            }
          : {}),
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className={`counselor-node ${r.done ? 'done' : r.streaming ? 'active' : ''} ${isPresident ? 'president' : ''}`}>
            {isPresident ? 'P' : String(index + 1).padStart(2, '0')}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', color: r.color }}>
                {r.name}
              </span>
              {isPresident && <span className="chip warn">Síntese</span>}
              {r.streaming && (
                <span className="typing">
                  <span /><span /><span />
                </span>
              )}
            </div>
            <div className="serif" style={{ fontSize: 18, marginTop: 2 }}>{r.role}</div>
          </div>
        </div>
        {r.done && !isPresident && (
          <button onClick={() => onOpenDebate(r)} className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ChatIcon size={12} /> Debater 1-on-1
          </button>
        )}
      </header>

      <div
        className="markdown-body"
        style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text)' }}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(r.text) || (r.streaming ? '' : '<em style="color:var(--text-faint)">aguardando...</em>') }}
      />

      {r.citations && r.citations.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          <div className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-faint)', marginBottom: 8 }}>
            Fontes · {r.citations.length}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {r.citations.map((c, k) => {
              const url = typeof c === 'string' ? c : c.url || c.href;
              if (!url) return null;
              let domain;
              try { domain = new URL(url).hostname.replace('www.', ''); } catch { domain = url.slice(0, 30); }
              return (
                <a key={k} href={url} target="_blank" rel="noopener noreferrer" className="citation-link">
                  [{k + 1}] {domain}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}

// ═══════════════════════════════════════════════════════════
// USER TURN (step 8)
// ═══════════════════════════════════════════════════════════

function UserTurn({ counselors, onSend, onEnd }) {
  const [question, setQuestion] = useState('');
  const [targets, setTargets] = useState(new Set());

  const toggle = (id) => {
    setTargets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = () => {
    if (!question.trim()) return;
    onSend({ question, targetedIds: Array.from(targets) });
    setQuestion('');
    setTargets(new Set());
  };

  return (
    <div className="glass fade-up" style={{ marginTop: 40, borderRadius: 16, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--accent)', marginBottom: 4 }}>
            08 · Sua vez · você decide
          </div>
          <div className="serif" style={{ fontSize: 20 }}>Aprofunde, questione — ou encerre com sua decisão</div>
        </div>
        <button onClick={onEnd} className="btn-ghost" style={{ fontSize: 12 }}>Encerrar e decidir</button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-faint)', marginBottom: 8 }}>
          Direcione a pergunta (opcional)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {counselors.map((c) => (
            <button
              key={c.id}
              onClick={() => toggle(c.id)}
              className={`chip${targets.has(c.id) ? ' active' : ''}`}
              style={{ cursor: 'pointer' }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color }} />
              {c.name} <span style={{ color: 'var(--text-faint)' }}>· {c.role}</span>
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Faça uma pergunta de aprofundamento ao board todo, ou selecione conselheiros acima..."
        className="input-field"
        rows={4}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          Sem seleção = todo o board responde · Com seleção = apenas conselheiros marcados
        </span>
        <button onClick={submit} disabled={!question.trim()} className="btn-primary" style={{ fontSize: 14 }}>
          Enviar pergunta <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DEBATE MODAL (1-on-1)
// ═══════════════════════════════════════════════════════════

function DebateModal({ council, agent, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const feedRef = useRef(null);

  useEffect(() => {
    // Mensagem de abertura
    setMessages([
      {
        role: 'assistant',
        content: `Olá. Minha contribuição original como ${agent.role}: "${(agent.originalResponse || '').slice(0, 180)}${agent.originalResponse?.length > 180 ? '…' : ''}"\n\nO que você quer aprofundar?`,
      },
    ]);
  }, [agent]);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    const userMsg = input.trim();
    if (!userMsg || isStreaming) return;
    setInput('');

    const newHistory = [...messages, { role: 'user', content: userMsg }];
    setMessages([...newHistory, { role: 'assistant', content: '', streaming: true }]);
    setIsStreaming(true);

    try {
      let fullText = '';
      await streamPost(
        '/api/council/debate',
        {
          councilId: council.id,
          counselorId: agent.counselorId,
          originalResponse: agent.originalResponse,
          chatHistory: messages.slice(1), // exclui abertura
          userMessage: userMsg,
        },
        {
          onDelta: (_delta, full) => {
            fullText = full;
            setMessages([...newHistory, { role: 'assistant', content: full, streaming: true }]);
          },
          onDone: () => {
            setMessages([...newHistory, { role: 'assistant', content: fullText, streaming: false }]);
          },
          onError: (err) => {
            setMessages([...newHistory, { role: 'assistant', content: `_[erro: ${err.message}]_`, streaming: false }]);
          },
        }
      );
    } catch (err) {
      setMessages([...newHistory, { role: 'assistant', content: `_[erro: ${err.message}]_`, streaming: false }]);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass" style={{ borderRadius: 20, width: '100%', maxWidth: 640, padding: 24, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', color: agent.color }}>
              Debate 1-on-1 · {agent.name}
            </div>
            <h3 className="serif" style={{ fontSize: 22, margin: '4px 0 0' }}>{agent.role}</h3>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 8 }}><CloseIcon /></button>
        </header>

        <div ref={feedRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 4px 16px', minHeight: 200, maxHeight: '55vh', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div
                className={m.role === 'assistant' ? 'markdown-body' : ''}
                style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  fontSize: 14,
                  lineHeight: 1.5,
                  background: m.role === 'user' ? 'rgba(0,229,199,0.12)' : 'rgba(255,255,255,0.04)',
                  border: m.role === 'user' ? '1px solid rgba(0,229,199,0.3)' : '1px solid var(--line)',
                }}
                dangerouslySetInnerHTML={{
                  __html: m.role === 'assistant' ? renderMarkdown(m.content) || (m.streaming ? '<span class="typing"><span></span><span></span><span></span></span>' : '') : m.content,
                }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Contra-argumente, aprofunde, peça exemplos..."
            className="input-field"
            disabled={isStreaming}
          />
          <button onClick={send} disabled={!input.trim() || isStreaming} className="btn-primary" style={{ padding: '10px 16px' }}>
            {isStreaming ? '...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}

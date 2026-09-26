'use client'
import { useEffect } from 'react'
import Link from 'next/link'

export default function LandingPage() {
  useEffect(() => {
    const nav = document.getElementById('nav')
    const handleScroll = () => nav?.classList.toggle('scrolled', window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)

    const sl = document.getElementById('speed-lines')
    if (sl) {
      for (let i = 0; i < 14; i++) {
        const d = document.createElement('div')
        d.className = 'sl'
        d.style.top = `${Math.random() * 100}%`
        d.style.width = `${80 + Math.random() * 200}px`
        d.style.opacity = `${0.12 + Math.random() * 0.22}`
        d.style.setProperty('--d', `${2.5 + Math.random() * 2}s`)
        d.style.setProperty('--delay', `${Math.random() * 3}s`)
        sl.appendChild(d)
      }
    }

    const ro = new IntersectionObserver(
      (entries) => entries.forEach(e => e.isIntersecting && e.target.classList.add('on')),
      { threshold: 0.1 }
    )
    document.querySelectorAll('.reveal').forEach(el => ro.observe(el))

    const countUp = (el: Element) => {
      const to = +(el as HTMLElement).dataset.to!
      const sfx = (el as HTMLElement).dataset.sfx || ''
      const step = to / (2000 / 16)
      let v = 0
      const t = setInterval(() => {
        v += step
        if (v >= to) { v = to; clearInterval(t) }
        el.textContent = Math.floor(v).toLocaleString('pt-BR') + sfx
      }, 16)
    }
    const co = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) { countUp(e.target); co.unobserve(e.target) }
      }),
      { threshold: 0.5 }
    )
    document.querySelectorAll('.cnt[data-to]').forEach(el => co.observe(el))

    const bo = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.querySelectorAll<HTMLElement>('.bar').forEach(b => {
            const w = b.dataset.w
            b.style.width = '0'
            requestAnimationFrame(() => { b.style.width = w + '%' })
          })
          bo.unobserve(e.target)
        }
      }),
      { threshold: 0.3 }
    )
    document.querySelectorAll('.glass').forEach(el => bo.observe(el))

    return () => {
      window.removeEventListener('scroll', handleScroll)
      ro.disconnect()
      co.disconnect()
      bo.disconnect()
    }
  }, [])

  return (
    <div className="landing-page">
      {/* NAV */}
      <nav id="nav">
        <div className="nav-in">
          <a href="#" className="logo" aria-label="Kactus">
            <div>
              <img src="/brand/kactus-wordmark.png" alt="Kactus" className="logo-mark" />
              <span className="logo-sub">corrida sem limites</span>
            </div>
          </a>
          <ul className="nav-links">
            <li><a href="#treinar">Treinar</a></li>
            <li><a href="#evolucao">Evolução</a></li>
            <li><a href="#valores">Comunidade</a></li>
            <li><a href="#planos">Planos</a></li>
            <li><Link href="/login" className="nav-cta">Começar Agora</Link></li>
          </ul>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-bg">
          <div id="speed-lines"></div>
        </div>
        <div className="hero-in">
          <div className="hero-left">
            <div className="eyebrow">
              <div className="pulse"></div>
              <span className="eyebrow-txt">Corrida Sem Limites</span>
            </div>
            <h1 className="hero-h1">
              DISCIPLINA<br />HOJE.
              <span className="accent">RESULTADOS</span>
              AMANHÃ.
            </h1>
            <p className="hero-sub">Kactus é a plataforma de performance para atletas sérios. Registre, analise, evolua — com as mesmas métricas que atletas de elite usam.</p>
            <div className="ctas">
              <Link href="/login" className="btn-g">
                Começar Agora{' '}
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 6.5h9M7.5 2.5l4 4-4 4" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <a href="#treinar" className="btn-o">Ver Como Funciona</a>
            </div>
          </div>

          <div className="hero-right">
            <div className="hero-visual">
              <svg width="380" height="380" viewBox="0 0 380 380" fill="none">
                <defs>
                  <radialGradient id="cg" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#00FF66" stopOpacity=".09" />
                    <stop offset="100%" stopColor="#00FF66" stopOpacity="0" />
                  </radialGradient>
                  <linearGradient id="arc1" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#00FF66" stopOpacity="0" />
                    <stop offset="40%" stopColor="#00FF66" stopOpacity=".8" />
                    <stop offset="70%" stopColor="#C6FF00" stopOpacity=".5" />
                    <stop offset="100%" stopColor="#C6FF00" stopOpacity="0" />
                  </linearGradient>
                  <filter id="gr"><feGaussianBlur stdDeviation="3" /></filter>
                  <filter id="gs"><feGaussianBlur stdDeviation="1.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                <circle cx="190" cy="190" r="168" fill="url(#cg)" />
                <circle cx="190" cy="190" r="160" stroke="#192919" strokeWidth="1" fill="none" />
                <circle cx="190" cy="190" r="140" stroke="#192919" strokeWidth="1" fill="none" />
                <circle cx="190" cy="190" r="120" stroke="#192919" strokeWidth="1" fill="none" />
                <circle cx="190" cy="190" r="160" stroke="#00FF66" strokeWidth="2.5" fill="none"
                  strokeDasharray="350 656" strokeLinecap="round"
                  filter="url(#gs)"
                  style={{ transformOrigin: '190px 190px', animation: 'spin 8s linear infinite' }} />
                <circle cx="190" cy="190" r="140" stroke="rgba(198,255,0,.18)" strokeWidth="1.5" fill="none"
                  strokeDasharray="160 720" strokeLinecap="round"
                  style={{ transformOrigin: '190px 190px', animation: 'spin 14s linear infinite reverse' }} />
                <g stroke="rgba(0,255,102,.45)" strokeWidth="2" strokeLinecap="round">
                  <line x1="190" y1="24" x2="190" y2="38" />
                  <line x1="356" y1="190" x2="342" y2="190" />
                  <line x1="190" y1="356" x2="190" y2="342" />
                  <line x1="24" y1="190" x2="38" y2="190" />
                </g>
                <circle cx="190" cy="190" r="4" fill="#00FF66" filter="url(#gs)" />
                <circle cx="222" cy="112" r="13" fill="#fff" opacity=".92" />
                <path d="M222 125 C218 152 208 168 196 194" stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" opacity=".9" />
                <path d="M216 144 C198 143 176 152 160 158" stroke="#00FF66" strokeWidth="5" strokeLinecap="round" fill="none" />
                <path d="M220 148 C234 148 252 138 262 130" stroke="rgba(255,255,255,.45)" strokeWidth="4" strokeLinecap="round" fill="none" />
                <path d="M196 194 C187 220 172 245 150 268" stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" opacity=".9" />
                <path d="M196 194 C207 216 228 242 250 265" stroke="#00FF66" strokeWidth="5" strokeLinecap="round" fill="none" />
                <path d="M150 268 C138 273 127 270 122 261" stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" opacity=".88" />
                <path d="M250 265 C260 270 270 264 272 255" stroke="#00FF66" strokeWidth="4" strokeLinecap="round" fill="none" />
                <line x1="190" y1="158" x2="142" y2="153" stroke="rgba(0,255,102,.5)" strokeWidth="1.5" />
                <line x1="194" y1="172" x2="142" y2="169" stroke="rgba(0,255,102,.28)" strokeWidth="1" />
                <line x1="192" y1="143" x2="148" y2="136" stroke="rgba(198,255,0,.38)" strokeWidth="1" />
              </svg>

              <div className="float-card">
                <div className="fc-label">● Treino de Hoje</div>
                <div className="fc-row">
                  <div><div className="fc-val">21.0</div><div className="fc-lbl">km</div></div>
                  <div><div className="fc-val">1:52</div><div className="fc-lbl">Tempo</div></div>
                  <div><div className="fc-val">5:20</div><div className="fc-lbl">/km</div></div>
                </div>
              </div>

              <div className="hero-badge">
                <div className="badge-dot"></div>
                <span style={{ color: 'var(--lime)', fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: '.7rem' }}>↑ 12%</span>
                <span style={{ color: 'var(--muted)', fontSize: '.7rem' }}> vs semana passada</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="stats-sec">
        <div className="wrap">
          <div className="stats-grid">
            <div className="stat-col reveal"><div className="cnt" data-to="14823" data-sfx="+">0</div><div className="cnt-lbl">km registrados</div></div>
            <div className="stat-col reveal" style={{ transitionDelay: '.1s' }}><div className="cnt" data-to="1247" data-sfx="+">0</div><div className="cnt-lbl">atletas ativos</div></div>
            <div className="stat-col reveal" style={{ transitionDelay: '.2s' }}><div className="cnt" data-to="98" data-sfx="%">0</div><div className="cnt-lbl">taxa de satisfação</div></div>
            <div className="stat-col reveal" style={{ transitionDelay: '.3s' }}><div className="cnt" data-to="5" data-sfx=" anos">0</div><div className="cnt-lbl">desenvolvendo atletas</div></div>
          </div>
        </div>
      </section>

      {/* TRAINING */}
      <section className="training-sec" id="treinar">
        <div className="wrap">
          <div className="reveal">
            <div className="sec-tag">Performance</div>
            <h2 className="sec-h">Cada detalhe do treino,<br />em tempo real</h2>
            <p className="sec-sub">Distância, pace, FC, elevação e carga — tudo calculado automaticamente a cada treino.</p>
          </div>
          <div className="training-grid">
            <div className="glass hi reveal" style={{ transitionDelay: '.05s' }}>
              <div className="card-tag">Hoje · 06:30</div>
              <div className="big-num">21<span className="big-unit">.05</span></div>
              <div className="big-lbl">km percorridos</div>
              <svg width="100%" height="72" viewBox="0 0 400 72" fill="none" preserveAspectRatio="none" style={{ margin: '1rem 0 1.25rem' }}>
                <defs>
                  <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00FF66" stopOpacity=".38" />
                    <stop offset="100%" stopColor="#00FF66" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 58 C50 52 90 38 130 42 C170 46 210 18 250 22 C290 26 330 12 370 6 L400 4 L400 72 L0 72Z" fill="url(#ag)" />
                <path d="M0 58 C50 52 90 38 130 42 C170 46 210 18 250 22 C290 26 330 12 370 6 L400 4" stroke="#00FF66" strokeWidth="2" fill="none" style={{ filter: 'drop-shadow(0 0 5px #00FF66)' }} />
                <circle cx="400" cy="4" r="4" fill="#00FF66" style={{ filter: 'drop-shadow(0 0 7px #00FF66)' }} />
              </svg>
              <div className="sub-grid">
                <div><div className="sub-v">1:52:34</div><div className="sub-l">Tempo</div></div>
                <div><div className="sub-v">5:20</div><div className="sub-l">Pace /km</div></div>
                <div><div className="sub-v">156</div><div className="sub-l">FC Média</div></div>
                <div><div className="sub-v">+245m</div><div className="sub-l">Elevação</div></div>
              </div>
            </div>

            <div className="glass reveal" style={{ transitionDelay: '.12s', display: 'flex', flexDirection: 'column' }}>
              <div className="card-tag">Frequência Cardíaca</div>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
                <svg width="110" height="110" viewBox="0 0 110 110">
                  <defs>
                    <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#00FF66" /><stop offset="100%" stopColor="#C6FF00" />
                    </linearGradient>
                  </defs>
                  <circle cx="55" cy="55" r="46" stroke="#1c2e1c" strokeWidth="9" fill="none" />
                  <circle cx="55" cy="55" r="46" stroke="url(#rg)" strokeWidth="9" fill="none"
                    strokeDasharray="226 289" strokeDashoffset="-72" strokeLinecap="round"
                    style={{ transformOrigin: '55px 55px', transform: 'rotate(-90deg)', filter: 'drop-shadow(0 0 5px #00FF66)' }} />
                  <text x="55" y="49" textAnchor="middle" fontFamily="Poppins" fontWeight="900" fontSize="22" fill="white">156</text>
                  <text x="55" y="63" textAnchor="middle" fontFamily="Inter" fontSize="10" fill="#888">BPM</text>
                </svg>
              </div>
              <div className="mid-lbl" style={{ textAlign: 'center', marginBottom: '.5rem' }}>Zona 3 — Aeróbico</div>
              <div style={{ marginTop: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.68rem', color: 'var(--muted)', marginBottom: '.35rem' }}><span>Z1</span><span>Z5</span></div>
                <div className="bar-wrap"><div className="bar" data-w="62" style={{ background: 'linear-gradient(90deg,var(--green),var(--lime))' }}></div></div>
              </div>
            </div>

            <div className="glass reveal" style={{ transitionDelay: '.2s', display: 'flex', flexDirection: 'column' }}>
              <div className="card-tag">Carga de Treino</div>
              <div className="mid-num neon">78</div>
              <div className="mid-lbl">TSS de hoje</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.55rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.68rem', color: 'var(--muted)', marginBottom: '.32rem' }}><span>CTL</span><span style={{ color: '#fff' }}>72</span></div>
                  <div className="bar-wrap"><div className="bar" data-w="72"></div></div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.68rem', color: 'var(--muted)', marginBottom: '.32rem' }}><span>ATL</span><span style={{ color: '#fff' }}>84</span></div>
                  <div className="bar-wrap"><div className="bar" data-w="84" style={{ background: 'linear-gradient(90deg,#C6FF00,#f90)' }}></div></div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.68rem', color: 'var(--muted)', marginBottom: '.32rem' }}><span>TSB</span><span style={{ color: '#ff7b7b' }}>-12</span></div>
                  <div className="bar-wrap"><div className="bar" data-w="38" style={{ background: 'linear-gradient(90deg,#ff7b7b,#f90)' }}></div></div>
                </div>
              </div>
              <div style={{ background: 'rgba(255,120,120,.07)', border: '1px solid rgba(255,120,120,.14)', borderRadius: '8px', padding: '.55rem .7rem', fontSize: '.68rem', color: '#ffaaaa', marginTop: 'auto' }}>⚡ Treino moderado recomendado</div>
            </div>
          </div>
        </div>
      </section>

      {/* EVOLUTION */}
      <section className="evo-sec" id="evolucao">
        <div className="wrap">
          <div className="evo-in">
            <div className="reveal">
              <div className="sec-tag">Evolução</div>
              <h2 className="evo-q">PEQUENOS AVANÇOS GERAM <span className="acc">GRANDES RESULTADOS.</span></h2>
              <p className="evo-body">Com o Kactus você visualiza sua evolução semana a semana. Forma física (CTL), fadiga (ATL) e balanço (TSB) calculados com as mesmas métricas usadas por atletas profissionais.</p>
              <div className="evo-nums">
                <div className="ev"><span className="ev-v">+23%</span><span className="ev-l">Evolução de pace</span></div>
                <div className="ev"><span className="ev-v">42d</span><span className="ev-l">Janela CTL</span></div>
                <div className="ev"><span className="ev-v">ACWR</span><span className="ev-l">Risco de lesão</span></div>
              </div>
            </div>
            <div className="chart-box reveal" style={{ transitionDelay: '.2s' }}>
              <div className="ch-head">
                <span className="ch-t">Carga Semanal · 12 semanas</span>
                <span className="ch-badge">↑ Em evolução</span>
              </div>
              <svg width="100%" height="180" viewBox="0 0 400 180" fill="none" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00FF66" stopOpacity=".28" />
                    <stop offset="100%" stopColor="#00FF66" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <line x1="0" y1="45" x2="400" y2="45" stroke="#1f1f1f" strokeWidth="1" />
                <line x1="0" y1="90" x2="400" y2="90" stroke="#1f1f1f" strokeWidth="1" />
                <line x1="0" y1="135" x2="400" y2="135" stroke="#1f1f1f" strokeWidth="1" />
                <path d="M0 142 C35 136 65 122 95 112 C125 102 155 88 185 78 C215 68 245 62 275 55 C305 48 335 43 365 38 L400 34 L400 180 L0 180Z" fill="url(#cg2)" />
                <path d="M0 142 C35 136 65 122 95 112 C125 102 155 88 185 78 C215 68 245 62 275 55 C305 48 335 43 365 38 L400 34" stroke="#00FF66" strokeWidth="2.2" fill="none" style={{ filter: 'drop-shadow(0 0 5px #00FF66)' }} />
                <path d="M0 156 C35 150 65 136 95 124 C125 112 155 100 185 90 C215 80 245 74 275 67 C305 60 335 53 365 47 L400 43" stroke="#C6FF00" strokeWidth="1.5" fill="none" strokeDasharray="5 3" opacity=".5" />
                <text x="0" y="175" fill="#333" fontFamily="Inter" fontSize="9">S1</text>
                <text x="100" y="175" fill="#333" fontFamily="Inter" fontSize="9">S4</text>
                <text x="200" y="175" fill="#333" fontFamily="Inter" fontSize="9">S8</text>
                <text x="323" y="175" fill="#555" fontFamily="Inter" fontSize="9">Hoje</text>
                <circle cx="8" cy="12" r="3.5" fill="#00FF66" />
                <text x="16" y="16" fill="#666" fontFamily="Inter" fontSize="9.5">CTL</text>
                <line x1="56" y1="12" x2="72" y2="12" stroke="#C6FF00" strokeWidth="1.5" strokeDasharray="4 2.5" />
                <text x="77" y="16" fill="#666" fontFamily="Inter" fontSize="9.5">ATL</text>
              </svg>
              <div className="ch-foot">
                <div><div className="cf-v" style={{ color: '#00FF66' }}>72</div><div className="cf-l">CTL</div></div>
                <div><div className="cf-v" style={{ color: '#C6FF00' }}>84</div><div className="cf-l">ATL</div></div>
                <div><div className="cf-v" style={{ color: '#ff9999' }}>-12</div><div className="cf-l">TSB</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="values-sec" id="valores">
        <div className="wrap">
          <div className="reveal" style={{ textAlign: 'center' }}>
            <div className="sec-tag" style={{ justifyContent: 'center' }}>Nossos Pilares</div>
            <h2 className="sec-h">O que nos move</h2>
            <p className="sec-sub" style={{ margin: '0 auto' }}>Cinco valores que guiam cada passo, cada treino, cada conquista.</p>
          </div>
          <div className="val-grid">
            <div className="val-card reveal">
              <div className="val-icon"><svg width="42" height="42" viewBox="0 0 42 42" fill="none"><rect x="9" y="9" width="24" height="24" rx="3" stroke="#00FF66" strokeWidth="1.6" /><path d="M15 21 L19 25 L27 17" stroke="#00FF66" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
              <div className="val-name">Disciplina</div>
              <div className="val-desc">Consistência acima de motivação. Treinar quando é difícil é o que separa atletas.</div>
            </div>
            <div className="val-card reveal" style={{ transitionDelay: '.08s' }}>
              <div className="val-icon"><svg width="42" height="42" viewBox="0 0 42 42" fill="none"><polyline points="6,32 14,20 22,25 30,14 36,9" stroke="#00FF66" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="36" cy="9" r="3" fill="#C6FF00" /></svg></div>
              <div className="val-name">Evolução</div>
              <div className="val-desc">Cada treino é uma oportunidade de ser melhor que ontem, sem exceção.</div>
            </div>
            <div className="val-card reveal" style={{ transitionDelay: '.16s' }}>
              <div className="val-icon"><svg width="42" height="42" viewBox="0 0 42 42" fill="none"><path d="M21 34 C21 34 8 25 8 14.5 A8.5 8.5 0 0 1 21 8.5 A8.5 8.5 0 0 1 34 14.5 C34 25 21 34 21 34Z" stroke="#00FF66" strokeWidth="1.6" fill="none" /><polyline points="14,21 18,17 21,23 24,19 28,21" stroke="#00FF66" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
              <div className="val-name">Saúde</div>
              <div className="val-desc">Performance sustentável nasce de respeitar o corpo e treinar com inteligência.</div>
            </div>
            <div className="val-card reveal" style={{ transitionDelay: '.24s' }}>
              <div className="val-icon"><svg width="42" height="42" viewBox="0 0 42 42" fill="none"><circle cx="21" cy="21" r="14" stroke="#00FF66" strokeWidth="1.6" /><polyline points="21,10 21,21 28,26" stroke="#00FF66" strokeWidth="1.8" strokeLinecap="round" /></svg></div>
              <div className="val-name">Longevidade</div>
              <div className="val-desc">Correr aos 20, 40, 60 anos. Construir para durar, não apenas para hoje.</div>
            </div>
            <div className="val-card reveal" style={{ transitionDelay: '.32s' }}>
              <div className="val-icon"><svg width="42" height="42" viewBox="0 0 42 42" fill="none"><circle cx="14" cy="15" r="5" stroke="#00FF66" strokeWidth="1.5" /><circle cx="28" cy="15" r="5" stroke="#00FF66" strokeWidth="1.5" /><circle cx="21" cy="27" r="5" stroke="#C6FF00" strokeWidth="1.5" /><line x1="18.5" y1="19.5" x2="15" y2="21" stroke="#00FF66" strokeWidth="1" opacity=".5" /><line x1="23.5" y1="19.5" x2="27" y2="21" stroke="#00FF66" strokeWidth="1" opacity=".5" /></svg></div>
              <div className="val-name">Comunidade</div>
              <div className="val-desc">Juntos chegamos mais longe. A comunidade amplifica cada conquista individual.</div>
            </div>
          </div>
        </div>
      </section>

      {/* PLANS */}
      <section className="plans-sec" id="planos">
        <div className="wrap">
          <div className="reveal" style={{ textAlign: 'center' }}>
            <div className="sec-tag" style={{ justifyContent: 'center' }}>Planos</div>
            <h2 className="sec-h">Escolha o seu nível</h2>
            <p className="sec-sub" style={{ margin: '0 auto' }}>Comece onde está. Evolua sem limites.</p>
          </div>
          <div className="plans-grid">
            <div className="plan reveal">
              <div className="pl-name">Iniciante</div>
              <div className="pl-price">Free</div>
              <div className="pl-period">Para sempre</div>
              <ul className="pl-feats">
                <li><span className="ck">✓</span> Upload FIT / GPX / TCX</li>
                <li><span className="ck">✓</span> Mapa e splits por km</li>
                <li><span className="ck">✓</span> Recordes pessoais</li>
                <li><span className="ck">✓</span> Dashboard de atividades</li>
                <li><span className="ck off">—</span> CTL / ATL / TSB</li>
                <li><span className="ck off">—</span> Cards para redes sociais</li>
              </ul>
              <Link href="/login" className="pl-btn outline">Começar Free</Link>
            </div>
            <div className="plan feat reveal" style={{ transitionDelay: '.1s' }}>
              <div className="plan-badge">Mais Popular</div>
              <div className="pl-name">Performance</div>
              <div className="pl-price g">R$0</div>
              <div className="pl-period">Custo zero · uso pessoal</div>
              <ul className="pl-feats">
                <li><span className="ck">✓</span> Tudo do Iniciante</li>
                <li><span className="ck">✓</span> CTL / ATL / TSB / ACWR</li>
                <li><span className="ck">✓</span> Previsões de prova (Riegel)</li>
                <li><span className="ck">✓</span> Simulador de forma futura</li>
                <li><span className="ck">✓</span> Importação de FIT, GPX, TCX e CSV</li>
                <li><span className="ck">✓</span> Cards e Stories para redes</li>
              </ul>
              <Link href="/login" className="pl-btn solid">Começar Agora</Link>
            </div>
            <div className="plan reveal" style={{ transitionDelay: '.2s' }}>
              <div className="pl-name">Elite</div>
              <div className="pl-price">Em breve</div>
              <div className="pl-period">Para equipes e coaches</div>
              <ul className="pl-feats">
                <li><span className="ck">✓</span> Tudo do Performance</li>
                <li><span className="ck">✓</span> Análise por coach</li>
                <li><span className="ck">✓</span> Planos de treino com IA</li>
                <li><span className="ck">✓</span> Multi-atleta (equipes)</li>
                <li><span className="ck">✓</span> API aberta</li>
                <li><span className="ck">✓</span> Suporte prioritário</li>
              </ul>
              <button className="pl-btn outline" disabled style={{ opacity: .45, cursor: 'not-allowed' }}>Notificar Lançamento</button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-sec">
        <div className="wrap">
          <div className="reveal">
            <div className="cta-words">
              SONHE. <span className="neon">PLANEJE.</span><br />
              TREINE. <span className="neon">CONQUISTE.</span>
            </div>
            <p className="cta-sub">Não é só sobre correr. É sobre superar seus próprios limites.</p>
            <div className="cta-btns">
              <Link href="/login" className="btn-g">
                Entrar na Plataforma{' '}
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 6.5h9M7.5 2.5l4 4-4 4" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <a href="#valores" className="btn-o">Conhecer Comunidade</a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="wrap">
          <div className="footer-in">
            <a href="#" className="logo" aria-label="Kactus">
              <div>
                <img src="/brand/kactus-wordmark.png" alt="Kactus" className="logo-mark" style={{ height: 20 }} />
                <span className="logo-sub">corrida sem limites</span>
              </div>
            </a>
            <ul className="foot-links">
              <li><a href="#treinar">Treinar</a></li>
              <li><a href="#evolucao">Evolução</a></li>
              <li><a href="#valores">Comunidade</a></li>
              <li><a href="#planos">Planos</a></li>
            </ul>
            <span className="foot-copy">© 2026 Kactus. Corrida Sem Limites.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}


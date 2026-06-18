'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { motion, useInView, type Variants } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import Image from 'next/image';
import { 
  Brain, 
  Zap, 
  Target, 
  Bot, 
  Sliders, 
  RotateCcw, 
  Play, 
  LayoutDashboard, 
  Trophy, 
  Binary, 
  Gamepad2, 
  Lightbulb, 
  Activity 
} from 'lucide-react';

// Dynamically import Three.js board (no SSR)
const ChessBoard3D = dynamic(() => import('../components/ChessBoard3D'), { ssr: false, loading: () => (
  <div className="w-full h-full flex items-center justify-center">
    <div className="w-16 h-16 border-4 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
  </div>
) });

// ─── Animation Variants ───────────────────────────────────────────────────────
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.55, ease: 'backOut' } },
};

// ─── Section Wrapper ──────────────────────────────────────────────────────────
function AnimatedSection({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  // once:false → animasi ulang setiap kali masuk/keluar viewport
  const isInView = useInView(ref, { once: false, margin: '-80px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.7, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Animated Counter ─────────────────────────────────────────────────────────
function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: false, margin: '-40px' });

  useEffect(() => {
    if (!isInView) {
      setCount(0);
      return;
    }
    let start = 0;
    const step = target / 60;
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else { setCount(Math.floor(start)); }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, target]);

  return <span ref={ref}>{count}{suffix}</span>;
}

// ─── Feature Card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, description, accent }: { icon: React.ReactNode; title: string; description: string; accent: string }) {
  return (
    <motion.div
      variants={scaleIn}
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="relative group rounded-2xl border border-white/8 bg-white/4 backdrop-blur-xl p-7 flex flex-col gap-4 overflow-hidden cursor-default"
      style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)' }}
    >
      {/* Gradient orb */}
      <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-20 group-hover:opacity-35 transition-opacity duration-500 ${accent}`} />

      {/* Icon */}
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center border border-white/10 bg-white/6 relative z-10`}>
        {icon}
      </div>

      <div className="relative z-10">
        <h3 className="text-lg font-bold text-white mb-2 font-serif">{title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
      </div>

      {/* Bottom shimmer line */}
      <div className={`absolute bottom-0 left-0 right-0 h-px ${accent} opacity-30 group-hover:opacity-60 transition-opacity duration-300`} />
    </motion.div>
  );
}

// ─── Step Card ────────────────────────────────────────────────────────────────
function StepCard({ number, title, description, delay = 0 }: { number: string; title: string; description: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: false, margin: '-50px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      className="flex gap-6 items-start group"
    >
      <motion.div
        whileHover={{ scale: 1.1, rotate: 5 }}
        className="text-7xl font-black font-serif bg-gradient-to-b from-amber-400/80 to-amber-600/20 bg-clip-text text-transparent leading-none shrink-0 select-none"
        style={{ WebkitTextStroke: '1px rgba(223,183,92,0.2)' }}
      >
        {number}
      </motion.div>
      <div className="pt-3">
        <h3 className="text-xl font-bold text-white font-serif mb-2">{title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ value, label, suffix, icon }: { value: number; label: string; suffix?: string; icon: React.ReactNode }) {
  return (
    <motion.div
      variants={scaleIn}
      whileHover={{ y: -4, scale: 1.03 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="flex flex-col items-center gap-2 p-6 rounded-2xl border border-white/8 bg-white/4 backdrop-blur-xl"
    >
      <span className="text-3xl flex items-center justify-center">{icon}</span>
      <span className="text-4xl font-black font-serif text-amber-400">
        <AnimatedCounter target={value} suffix={suffix} />
      </span>
      <span className="text-xs text-slate-500 font-medium uppercase tracking-wider text-center">{label}</span>
    </motion.div>
  );
}

// ─── Move Label Badge ─────────────────────────────────────────────────────────
function LabelBadge({ label, color, delay }: { label: string; color: string; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: false });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.7, y: 10 }}
      animate={isInView ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.7, y: 10 }}
      transition={{ duration: 0.4, delay, type: 'spring', stiffness: 300 }}
      whileHover={{ scale: 1.1 }}
      className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border ${color} cursor-default`}
    >
      {label}
    </motion.div>
  );
}

// ─── Floating Piece ───────────────────────────────────────────────────────────
function FloatingPiece({ piece, style }: { piece: string; style: React.CSSProperties }) {
  return (
    <motion.div
      className="absolute select-none pointer-events-none text-amber-400/15 font-serif"
      style={style}
      animate={{ y: [0, -20, 0], rotate: [0, 5, -5, 0], opacity: [0.08, 0.18, 0.08] }}
      transition={{ duration: Math.random() * 4 + 5, repeat: Infinity, ease: 'easeInOut', delay: Math.random() * 3 }}
    >
      {piece}
    </motion.div>
  );
}

// ─── Main Landing Page ────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const heroRef = useRef<HTMLDivElement>(null);

  const FLOATING_PIECES = [
    { piece: '♔', style: { top: '10%', left: '5%', fontSize: '5rem' } },
    { piece: '♛', style: { top: '20%', right: '8%', fontSize: '4rem' } },
    { piece: '♜', style: { top: '60%', left: '3%', fontSize: '3.5rem' } },
    { piece: '♝', style: { bottom: '20%', right: '5%', fontSize: '4.5rem' } },
    { piece: '♞', style: { top: '40%', left: '8%', fontSize: '3rem' } },
    { piece: '♟', style: { bottom: '30%', left: '15%', fontSize: '2.5rem' } },
    { piece: '♙', style: { top: '70%', right: '12%', fontSize: '3rem' } },
    { piece: '♕', style: { top: '5%', right: '20%', fontSize: '3.5rem' } },
  ];

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: 'linear-gradient(135deg, #050810 0%, #0a1020 40%, #0d1a10 70%, #050810 100%)' }}>
      {/* Background grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(223,183,92,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(223,183,92,0.03) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* Radial glow center */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% 20%, rgba(223,183,92,0.06) 0%, transparent 70%)',
      }} />

      {/* Floating chess pieces background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {FLOATING_PIECES.map((p, i) => (
          <FloatingPiece key={i} piece={p.piece} style={p.style} />
        ))}
      </div>

      {/* ── HERO SECTION ─────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12 px-6 pt-16 pb-24 max-w-7xl mx-auto">

        {/* Left: Text content */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="flex-1 flex flex-col items-center lg:items-start gap-6 text-center lg:text-left z-10 max-w-lg"
        >

          {/* Logo + Title */}
          <motion.div variants={fadeUp} className="flex flex-col items-center lg:items-start gap-4">
            <div className="flex items-center gap-4">
              <motion.div
                whileHover={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.5 }}
              >
                <Image
                  src="/logos/logo_concept3_arrow_knight.svg"
                  alt="CHEZZY Logo"
                  width={64}
                  height={64}
                  className="object-contain"
                />
              </motion.div>
              <h1 className="text-7xl font-black font-serif tracking-tight" style={{
                background: 'linear-gradient(135deg, #dfb75c 0%, #f5d78e 40%, #dfb75c 70%, #b8860b 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 30px rgba(223,183,92,0.3))',
              }}>
                CHEZZY
              </h1>
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold text-white font-serif leading-tight">
              Chess Analysis{' '}
              <span style={{
                background: 'linear-gradient(135deg, #dfb75c 0%, #f5d78e 50%, #f5a623 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>Powered by AI</span>
            </h2>
          </motion.div>

          <motion.p variants={fadeUp} className="text-slate-400 text-base leading-relaxed max-w-md">
            Elevate your chess tactics and strategy in real-time. Get in-depth move explanations, risk analysis, and Stockfish-backed recommendations for every position.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div variants={fadeUp} className="flex items-center gap-4 w-full sm:w-auto">
            <motion.button
              id="btn-landing-new-game"
              onClick={() => router.push('/game?newgame=true')}
              whileHover={{ scale: 1.05, y: -3 }}
              whileTap={{ scale: 0.96 }}
              className="relative px-8 py-4 rounded-2xl font-serif font-black text-base overflow-hidden group"
              style={{
                background: 'linear-gradient(135deg, #dfb75c, #f5a623)',
                color: '#0a0e1a',
                boxShadow: '0 0 30px rgba(223,183,92,0.4), 0 4px 20px rgba(0,0,0,0.4)',
              }}
            >
              <span className="relative z-10 flex items-center gap-2">
                <Play className="w-4 h-4 fill-current shrink-0" /> New Game
              </span>
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
            </motion.button>
          </motion.div>

          {/* Move Labels Preview */}
          <motion.div variants={fadeUp} className="flex flex-wrap gap-2 justify-center lg:justify-start">
            {[
              { label: 'Brilliant', color: 'bg-purple-500/10 text-purple-300 border-purple-500/30' },
              { label: 'Excellent', color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
              { label: 'Good', color: 'bg-green-500/10 text-green-300 border-green-500/30' },
              { label: 'Inaccuracy', color: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
              { label: 'Mistake', color: 'bg-orange-500/10 text-orange-300 border-orange-500/30' },
              { label: 'Blunder', color: 'bg-rose-500/10 text-rose-300 border-rose-500/30' },
            ].map((l, i) => (
              <LabelBadge key={l.label} label={l.label} color={l.color} delay={i * 0.08} />
            ))}
          </motion.div>
        </motion.div>

        {/* Right: 3D Chess Board */}
        <motion.div
          initial={{ opacity: 0, x: 80 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1.0, ease: 'easeOut', delay: 0.3 }}
          className="flex-1 relative z-10 w-full"
        >
          {/* Glow under board */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-80 h-20 rounded-full blur-3xl" style={{ background: 'radial-gradient(ellipse, rgba(223,183,92,0.25) 0%, transparent 70%)' }} />
          
          <div className="relative w-full max-w-xl mx-auto" style={{ height: 520 }}>
            <ChessBoard3D />
          </div>

          {/* Corner decorations */}
          <motion.div
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute top-4 right-4 text-amber-400/40 text-xs font-mono"
          >
            e4 e5 Nf3 Nc6
          </motion.div>
        </motion.div>


      </section>

      {/* ── FEATURES SECTION ──────────────────────────────────────── */}
      <section className="relative py-24 px-6 max-w-7xl mx-auto">
        <AnimatedSection className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-violet-500/30 bg-violet-500/8 mb-6">
            <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">Features</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black font-serif text-white mb-4">
            Everything you need to{' '}
            <span style={{ background: 'linear-gradient(90deg, #dfb75c, #f5a623)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              master chess
            </span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-base leading-relaxed">
            Built with a heuristic Stockfish engine, Chezzy gives you tournament-level analysis for every move you make.
          </p>
        </AnimatedSection>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, margin: '-60px' }}
          variants={stagger}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <FeatureCard
            icon={<Brain className="w-6 h-6 text-purple-400" />}
            title="Stockfish Heuristic Engine"
            description="Every move is analyzed by Stockfish with custom heuristics that explain tactical and strategic intent — not just raw evaluation scores."
            accent="bg-purple-500"
          />
          <FeatureCard
            icon={<Zap className="w-6 h-6 text-amber-400" />}
            title="Real-time WebSocket Analysis"
            description="Instant move evaluation via WebSocket connection. No page reloads, no delays — analysis streams as you play."
            accent="bg-amber-500"
          />
          <FeatureCard
            icon={<Target className="w-6 h-6 text-indigo-400" />}
            title="6-Tier Move Classification"
            description="Every move is classified as Brilliant, Excellent, Good, Inaccuracy, Mistake, or Blunder — with detailed explanations for each."
            accent="bg-indigo-500"
          />
          <FeatureCard
            icon={<Bot className="w-6 h-6 text-emerald-400" />}
            title="VS Bot Mode"
            description="Play against a random-move bot to practice under real game conditions, then review your full game analysis afterwards."
            accent="bg-emerald-500"
          />
          <FeatureCard
            icon={<Sliders className="w-6 h-6 text-sky-400" />}
            title="Custom FEN Setup"
            description="Load any position via FEN string to analyze specific endgames, openings, or puzzle positions with full engine support."
            accent="bg-sky-500"
          />
          <FeatureCard
            icon={<RotateCcw className="w-6 h-6 text-rose-400" />}
            title="Blunder Practice Mode"
            description="Revisit your worst mistakes from past games. Train specifically on the positions where you blundered to build muscle memory."
            accent="bg-rose-500"
          />
        </motion.div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section className="relative py-24 px-6 max-w-7xl mx-auto">
        {/* Background accent */}
        <div className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(223,183,92,0.04) 0%, transparent 70%)' }} />

        <AnimatedSection className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/30 bg-amber-500/8 mb-6">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">How It Works</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black font-serif text-white">
            Start playing in{' '}
            <span style={{ background: 'linear-gradient(135deg, #dfb75c 0%, #f5d78e 50%, #f5a623 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              3 steps
            </span>
          </h2>
        </AnimatedSection>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="flex flex-col gap-14">
            <StepCard
              number="01"
              title="Choose Your Game Mode"
              description="Pick between VS Bot for competitive practice, or Solo Analysis to deeply study positions. You can load a custom FEN or practice from your past blunders."
              delay={0}
            />
            <StepCard
              number="02"
              title="Play & Get Hints"
              description="As you play, Stockfish analyzes every move in real-time. Get threat warnings, top recommendations, and move quality feedback as you go."
              delay={0.15}
            />
            <StepCard
              number="03"
              title="Review Your Analysis"
              description="After the game, review your full move list with labels and explanations. Track accuracy scores for both players to measure improvement over time."
              delay={0.3}
            />
          </div>

          {/* Right side — visual mockup */}
          <AnimatedSection className="relative w-full max-w-[320px] mx-auto">
            <div className="relative rounded-2xl border border-white/8 bg-white/3 backdrop-blur-xl overflow-hidden p-4" style={{ boxShadow: '0 0 60px rgba(223,183,92,0.08), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
              {/* Mock header */}
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/8">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-[11px] font-bold text-amber-400 font-mono">Status: White's Turn</span>
                </div>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-bold uppercase flex items-center gap-1">
                  <Activity className="w-2.5 h-2.5" /> Analysis
                </span>
              </div>

              {/* Mock eval + board */}
              <div className="flex gap-2 items-stretch mb-3">
                {/* Eval bar */}
                <div className="w-2.5 shrink-0 rounded-md bg-gradient-to-b from-slate-200 to-slate-800 opacity-50" />
                {/* Board — responsive square filling the width */}
                <div
                  className="flex-1 aspect-square"
                  style={{
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: 'repeating-conic-gradient(rgba(240,217,181,0.35) 0% 25%, rgba(61,107,80,0.7) 0% 50%) 0 0 / 25% 25%',
                  }}
                />
              </div>

              {/* Mock move list */}
              <div className="flex flex-col gap-1.5">
                {[
                  { num: '1.', move: 'e4',  label: 'Excellent',  color: 'text-emerald-400' },
                  { num: '1.', move: 'e5',  label: 'Good',       color: 'text-green-400'   },
                  { num: '2.', move: 'Nf3', label: 'Brilliant',  color: 'text-violet-400'  },
                  { num: '2.', move: 'd6',  label: 'Inaccuracy', color: 'text-amber-400'   },
                ].map((m, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-600 font-mono w-4">{m.num}</span>
                    <span className="text-slate-300 font-mono font-bold">{m.move}</span>
                    <span className={`ml-auto px-1.5 py-0.5 rounded-full text-[8px] font-bold ${m.color} border border-current/20`}>{m.label}</span>
                  </div>
                ))}
              </div>

              {/* Mock Engine Insight */}
              <div className="mt-3 pt-3 border-t border-white/8">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[10px] font-bold text-amber-400 font-mono flex items-center gap-1">
                    <Lightbulb className="w-3 h-3 text-amber-400" /> ENGINE INSIGHT
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed font-mono">
                  <span className="text-amber-400 font-bold">Best move:</span> <span className="text-white font-bold">Nf3</span> (Brilliant). Controls center, threatens e5, prepares kingside castle.
                </p>
              </div>
            </div>

            {/* Floating accent */}
            <motion.div
              animate={{ y: [0, -8, 0], rotate: [0, 3, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -bottom-6 -right-6 w-16 h-16 rounded-2xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-xl flex items-center justify-center text-2xl z-10 pointer-events-none"
            >
              ♟
            </motion.div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── STATS SECTION ─────────────────────────────────────────── */}
      <section className="relative py-24 px-6 max-w-7xl mx-auto">
        <AnimatedSection className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/30 bg-amber-500/8 mb-6">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Capabilities</span>
          </div>
          <h2 className="text-4xl font-black font-serif text-white">
            Built for serious analysis
          </h2>
        </AnimatedSection>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <StatCard value={6} label="Move Classification Tiers" icon={<Trophy className="w-7 h-7 text-amber-400" />} />
          <StatCard value={15} suffix="+" label="Stockfish Depth Levels" icon={<Binary className="w-7 h-7 text-amber-400" />} />
          <StatCard value={100} suffix="ms" label="Avg. Analysis Latency" icon={<Zap className="w-7 h-7 text-amber-400" />} />
          <StatCard value={3} label="Game Modes Available" icon={<Gamepad2 className="w-7 h-7 text-amber-400" />} />
        </motion.div>

        {/* Tech stack pills */}
        <AnimatedSection className="mt-12 flex flex-wrap items-center justify-center gap-3" delay={0.2}>
          {['Stockfish Engine', 'FastAPI Backend', 'WebSocket', 'Next.js 14', 'Three.js', 'chess.js'].map((tech) => (
            <motion.span
              key={tech}
              whileHover={{ scale: 1.08, y: -2 }}
              className="px-4 py-2 rounded-full text-xs font-semibold border border-white/10 bg-white/5 text-slate-400 backdrop-blur-xl cursor-default"
            >
              {tech}
            </motion.span>
          ))}
        </AnimatedSection>
      </section>

      {/* ── CTA BOTTOM ────────────────────────────────────────────── */}
      <section className="relative py-32 px-6">
        {/* Background */}
        <div className="absolute inset-0 -z-10" style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(223,183,92,0.07) 0%, rgba(99,102,241,0.04) 50%, transparent 100%)',
        }} />
        <div className="absolute inset-0 -z-10 border-t border-b border-white/5" />

        <AnimatedSection className="max-w-3xl mx-auto text-center flex flex-col items-center gap-8">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="text-5xl"
          >
            ♔
          </motion.div>

          <h2 className="text-5xl sm:text-6xl font-black font-serif text-white leading-tight">
            Ready to elevate<br />
            <span style={{ background: 'linear-gradient(135deg, #dfb75c 0%, #f5d78e 50%, #dfb75c 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              your game?
            </span>
          </h2>

          <p className="text-slate-400 text-lg leading-relaxed max-w-xl">
            Start a new game and get Stockfish-powered analysis on every move you make. No signup required.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <motion.button
              id="btn-cta-new-game"
              onClick={() => router.push('/game?newgame=true')}
              whileHover={{ scale: 1.06, y: -4 }}
              whileTap={{ scale: 0.96 }}
              className="px-10 py-5 rounded-2xl font-serif font-black text-lg relative overflow-hidden group"
              style={{
                background: 'linear-gradient(135deg, #dfb75c, #f5a623)',
                color: '#0a0e1a',
                boxShadow: '0 0 40px rgba(223,183,92,0.35), 0 8px 30px rgba(0,0,0,0.4)',
              }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <Play className="w-5 h-5 fill-current shrink-0" /> Start Playing Now
              </span>
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/15 transition-colors duration-300" />
            </motion.button>

            <motion.button
              onClick={() => router.push('/dashboard')}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="px-8 py-5 rounded-2xl font-semibold text-slate-300 border border-white/12 bg-white/5 backdrop-blur-xl hover:bg-white/10 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <LayoutDashboard className="w-5 h-5 shrink-0" /> View Dashboard
            </motion.button>
          </div>
        </AnimatedSection>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────── */}
      <footer className="relative py-8 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <Image src="/logos/logo_concept3_arrow_knight.svg" alt="CHEZZY" width={20} height={20} className="opacity-40" />
            <span>CHEZZY v1.0.0 &copy; 2026</span>
          </div>
          <span>Powered by Stockfish Engine · Built with Next.js &amp; Three.js</span>
        </div>
      </footer>
    </div>
  );
}

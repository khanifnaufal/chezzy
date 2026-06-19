'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Lock, Compass, Swords, Crown, Lightbulb, Target, TrendingUp, TrendingDown, Minus, Play, Gamepad2, Trophy } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { BASE_URL, getGames } from '../../lib/api';
import ProtectedRoute from '../../components/ProtectedRoute';

interface AnalysisData {
  game_count: number;
  phase_weakness: {
    opening: { accuracy: number; blunders: number; mistakes: number };
    middlegame: { accuracy: number; blunders: number; mistakes: number };
    endgame: { accuracy: number; blunders: number; mistakes: number };
    weakest_phase: string;
    insight: string;
  } | null;
  blunder_patterns: {
    breakdown: {
      hanging_piece: number;
      missed_tactic: number;
      king_safety: number;
      time_trouble: number;
      other: number;
    };
    most_common: string;
    insight: string;
  } | null;
  accuracy_trend: {
    date: string | null;
    game_id: string;
    accuracy: number;
  }[] | null;
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [games, setGames] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const { user, session } = useAuth();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !session) return;

    async function fetchDashboardData() {
      try {
        setIsLoading(true);
        const headers: HeadersInit = {};
        if (session && session.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        
        // Fetch pattern analysis
        const res = await fetch(`${BASE_URL}/api/analysis/patterns`, { headers });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }

        // Fetch games list for summary stats
        try {
          const gamesData = await getGames();
          setGames(gamesData);
        } catch (err) {
          console.error('Error fetching games for dashboard stats:', err);
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err);
        setErrorMsg('Gagal memuat data dashboard. Pastikan backend Anda berjalan.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();
  }, [isMounted, session]);

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
        <p className="mt-4 text-sm font-medium">Memuat dashboard...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center py-8 px-4 sm:px-6">
        <div className="w-full max-w-7xl flex flex-col gap-8 animate-pulse">
          {/* Title skeleton */}
          <div className="space-y-2">
            <div className="h-8 bg-slate-800 rounded w-1/3" />
            <div className="h-4 bg-slate-800 rounded w-1/4" />
          </div>

          {/* Stats skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 min-h-[100px] flex items-center justify-between" />
            ))}
          </div>

          {/* Section 1 skeleton: Phase Cards */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <div className="space-y-2 w-1/3">
                <div className="h-6 bg-slate-800 rounded w-2/3" />
                <div className="h-4 bg-slate-800 rounded w-1/2" />
              </div>
              <div className="h-6 bg-slate-800 rounded w-24" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl p-5 border border-slate-800 bg-slate-950/40 min-h-[160px] flex flex-col justify-between" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center py-16 px-4">
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-6 py-4 rounded-2xl max-w-md text-center shadow-lg">
          <span className="text-xl block mb-2">⚠️</span>
          <p className="text-sm font-medium">{errorMsg}</p>
        </div>
      </div>
    );
  }

  // Calculate Overall Statistics
  const totalGames = games.length;
  let wins = 0;
  let draws = 0;
  let accuracySum = 0;
  let accuracyCount = 0;

  games.forEach(game => {
    let playerColor: 'white' | 'black' = 'white';
    if (game.white.toLowerCase().includes('bot')) {
      playerColor = 'black';
    } else if (game.black.toLowerCase().includes('bot')) {
      playerColor = 'white';
    }

    const acc = playerColor === 'white' ? game.white_accuracy : game.black_accuracy;
    if (acc !== null && acc !== undefined) {
      accuracySum += acc;
      accuracyCount++;
    }

    if (game.result) {
      if (game.result === '1/2-1/2') {
        draws++;
      } else if (
        (playerColor === 'white' && game.result === '1-0') ||
        (playerColor === 'black' && game.result === '0-1')
      ) {
        wins++;
      }
    }
  });

  const avgAccuracy = accuracyCount > 0 ? (accuracySum / accuracyCount) : 0;
  const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;

  // Pattern statistics details
  const gameCount = data?.game_count ?? totalGames;
  const showPatterns = gameCount >= 10 && data && data.phase_weakness;

  const progressPercent = Math.min(100, gameCount * 10);

  // Metric Cards mapping for Phase Weakness
  const phaseList = showPatterns ? [
    {
      key: 'opening',
      name: 'Opening',
      icon: <Compass className="w-6 h-6 text-indigo-400 shrink-0" />,
      accuracy: data!.phase_weakness?.opening.accuracy ?? 100,
      blunders: data!.phase_weakness?.opening.blunders ?? 0,
      mistakes: data!.phase_weakness?.opening.mistakes ?? 0,
    },
    {
      key: 'middlegame',
      name: 'Middlegame',
      icon: <Swords className="w-6 h-6 text-indigo-400 shrink-0" />,
      accuracy: data!.phase_weakness?.middlegame.accuracy ?? 100,
      blunders: data!.phase_weakness?.middlegame.blunders ?? 0,
      mistakes: data!.phase_weakness?.middlegame.mistakes ?? 0,
    },
    {
      key: 'endgame',
      name: 'Endgame',
      icon: <Crown className="w-6 h-6 text-indigo-400 shrink-0" />,
      accuracy: data!.phase_weakness?.endgame.accuracy ?? 100,
      blunders: data!.phase_weakness?.endgame.blunders ?? 0,
      mistakes: data!.phase_weakness?.endgame.mistakes ?? 0,
    },
  ] : [];

  // Bar chart data for Blunder Breakdown
  const blunderData = (showPatterns && data!.blunder_patterns)
    ? [
        { name: 'Gantung Perwira', count: data!.blunder_patterns.breakdown.hanging_piece, fill: '#f43f5e' },
        { name: 'Taktik Terlewat', count: data!.blunder_patterns.breakdown.missed_tactic, fill: '#fb923c' },
        { name: 'Keamanan Raja', count: data!.blunder_patterns.breakdown.king_safety, fill: '#ec4899' },
        { name: 'Krisis Waktu', count: data!.blunder_patterns.breakdown.time_trouble, fill: '#a855f7' },
        { name: 'Lainnya', count: data!.blunder_patterns.breakdown.other, fill: '#64748b' },
      ]
    : [];

  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl shadow-xl">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Frekuensi</p>
          <p className="text-sm font-black font-mono text-indigo-400 mt-0.5">
            {payload[0].value} kali
          </p>
        </div>
      );
    }
    return null;
  };

  // Line chart data for Accuracy Trend
  const enrichedTrendData = (showPatterns && data!.accuracy_trend)
    ? data!.accuracy_trend.map((item, index) => {
        const slice = data!.accuracy_trend!.slice(Math.max(0, index - 2), index + 1);
        const avg = slice.reduce((sum, d) => sum + d.accuracy, 0) / slice.length;

        let formattedDate = `Game ${index + 1}`;
        if (item.date) {
          try {
            const d = new Date(item.date);
            formattedDate = d.toLocaleDateString('id-ID', {
              month: 'short',
              day: 'numeric',
            });
          } catch (e) {}
        }

        return {
          name: formattedDate,
          'Akurasi Game': item.accuracy,
          'Moving Average (3)': parseFloat(avg.toFixed(1)),
        };
      })
    : [];

  const getTrendBadge = () => {
    if (!showPatterns || !data!.accuracy_trend || data!.accuracy_trend.length < 3) return null;
    const n = data!.accuracy_trend.length;
    const recent = data!.accuracy_trend.slice(Math.max(0, n - 3));
    const prior = data!.accuracy_trend.slice(0, Math.max(0, n - 3));

    if (recent.length === 0 || prior.length === 0) return null;

    const avgRecent = recent.reduce((sum, item) => sum + item.accuracy, 0) / recent.length;
    const avgPrior = prior.reduce((sum, item) => sum + item.accuracy, 0) / prior.length;
    const diff = avgRecent - avgPrior;

    if (diff > 1.5) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold">
          <TrendingUp className="w-3.5 h-3.5 shrink-0" /> Improving
        </span>
      );
    } else if (diff < -1.5) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full text-xs font-bold">
          <TrendingDown className="w-3.5 h-3.5 shrink-0" /> Needs Attention
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 border border-slate-700 text-slate-400 rounded-full text-xs font-bold">
          <Minus className="w-3.5 h-3.5 shrink-0" /> Consistent
        </span>
      );
    }
  };

  const CustomLineTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-xl flex flex-col gap-1">
          <p className="text-xs font-bold text-slate-500 uppercase font-mono">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm font-bold font-mono" style={{ color: entry.color }}>
              {entry.name}: {entry.value}%
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center py-8 px-4 sm:px-6">
      <div className="w-full max-w-7xl flex flex-col gap-8">
        
        {/* Welcome Greeting Header */}
        <div className="flex flex-col gap-2 border-b border-slate-800 pb-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            Halo, <span className="bg-gradient-to-r from-amber-400 to-amber-500 bg-clip-text text-transparent">{user?.email || 'Pemain'}</span>
          </h2>
          <p className="text-slate-400 text-sm">
            Selamat datang di dashboard catur personal Anda. Lihat ringkasan performa dan analisis detail.
          </p>
        </div>

        {/* Ringkasan Performa Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Game */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl flex items-center justify-between shadow-lg">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Game Dimainkan</p>
              <h3 className="text-3xl font-black text-slate-100 mt-2 font-serif">{totalGames}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Gamepad2 className="w-6 h-6" />
            </div>
          </div>

          {/* Akurasi Rata-rata */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl flex items-center justify-between shadow-lg">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Akurasi Rata-rata</p>
              <h3 className="text-3xl font-black text-slate-100 mt-2 font-serif">
                {avgAccuracy > 0 ? `${avgAccuracy.toFixed(1)}%` : '-'}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Target className="w-6 h-6" />
            </div>
          </div>

          {/* Win Rate */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl flex items-center justify-between shadow-lg">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Win Rate keseluruhan</p>
              <h3 className="text-3xl font-black text-slate-100 mt-2 font-serif">
                {totalGames > 0 ? `${winRate.toFixed(1)}%` : '-'}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Trophy className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Conditional pattern analysis display */}
        {!showPatterns ? (
          /* Lock Banner Container */
          <div className="w-full bg-slate-900/30 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6 shadow-inner animate-pulse">
              <Lock className="w-8 h-8 text-indigo-400 shrink-0" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight">Analisis Pola Permainan Terkunci</h2>
            <p className="text-slate-400 text-sm mt-3 max-w-md leading-relaxed">
              Mainkan dan simpan minimal <span className="text-indigo-400 font-bold">10 game</span> untuk membuka analisis pola permainan, kelemahan fase, tren akurasi, dan jenis blunder.
            </p>

            {/* Progress bar */}
            <div className="w-full max-w-md bg-slate-950 border border-slate-800/80 rounded-2xl p-5 mt-8 flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs font-bold font-mono text-slate-400">
                <span>PROGRESS GAME</span>
                <span className="text-indigo-400">{gameCount}/10 game untuk unlock pattern</span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <Link
              href="/"
              className="mt-8 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-slate-950 rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition flex items-center gap-1.5"
            >
              <Play className="w-4 h-4 fill-current shrink-0" /> Mulai Main Sekarang
            </Link>
          </div>
        ) : (
          /* Show Deeper Pattern Analysis */
          <>
            {/* SECTION 1 — Phase Weakness */}
            <section className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 shadow-xl flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div>
                  <h3 className="text-lg font-bold text-slate-100">1. Analisis Fase Permainan</h3>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Perbandingan akurasi dan jumlah blunder Anda di fase awal, tengah, dan akhir.
                  </p>
                </div>
                {data!.phase_weakness && (
                  <span className="self-start px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-xs font-bold">
                    Kelemahan: {data!.phase_weakness.weakest_phase.toUpperCase()}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {phaseList.map((phase) => {
                  const isWeakest = data!.phase_weakness?.weakest_phase === phase.key;
                  return (
                    <div
                      key={phase.key}
                      className={`relative overflow-hidden rounded-2xl p-5 border transition duration-300 flex flex-col justify-between min-h-[160px] ${
                        isWeakest
                          ? 'border-rose-500 bg-rose-500/5 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
                          : 'border-slate-800 bg-slate-950/40 hover:border-slate-700/80'
                      }`}
                    >
                      {isWeakest && (
                        <div className="absolute top-3 right-3 px-2.5 py-0.5 bg-rose-500 text-white text-[9px] font-extrabold rounded-full uppercase tracking-wider">
                          Terlemah
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{phase.icon}</span>
                        <span className="font-extrabold text-slate-200">{phase.name}</span>
                      </div>

                      <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-3xl font-serif font-black text-slate-100">
                          {phase.accuracy}%
                        </span>
                        <span className="text-slate-500 text-xs font-medium">Akurasi</span>
                      </div>

                      <div className="mt-4 border-t border-slate-800/60 pt-3 flex gap-4 text-xs font-bold text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          <span>{phase.blunders} Blunder</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-orange-500" />
                          <span>{phase.mistakes} Mistake</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {data!.phase_weakness && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex gap-3.5 items-start">
                  <Lightbulb className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Rekomendasi Analis CHEZZY
                    </span>
                    <p className="text-sm text-slate-300 font-medium leading-relaxed">
                      {data!.phase_weakness.insight}
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* Bottom grid: Section 2 & Section 3 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* SECTION 2 — Blunder Patterns */}
              <section className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 shadow-xl flex flex-col gap-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-100">2. Pola Blunder</h3>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Kategori kesalahan taktis yang paling sering memengaruhi game Anda.
                  </p>
                </div>

                <div className="w-full flex justify-center items-center h-[300px]">
                  {blunderData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={blunderData} layout="vertical" margin={{ left: -10, right: 10, top: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#223c34" horizontal={false} />
                        <XAxis type="number" stroke="#8ea69d" fontSize={11} tickLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" stroke="#cbd8d3" fontSize={11} tickLine={false} width={110} />
                        <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }} />
                        <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={14}>
                          {blunderData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-slate-500 text-sm">Tidak ada data blunder.</div>
                  )}
                </div>

                {data!.blunder_patterns && (
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex gap-3.5 items-start mt-auto">
                    <Target className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Analisis Penyebab
                      </span>
                      <p className="text-sm text-slate-300 font-medium leading-relaxed">
                        {data!.blunder_patterns.insight}
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* SECTION 3 — Accuracy Trend */}
              <section className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 shadow-xl flex flex-col gap-6">
                <div className="flex justify-between items-center gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-slate-100">3. Tren Akurasi</h3>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Grafik akurasi game per game dengan garis moving average 3 game terakhir.
                    </p>
                  </div>
                  <div className="shrink-0">{getTrendBadge()}</div>
                </div>

                <div className="w-full flex justify-center items-center h-[300px]">
                  {enrichedTrendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={enrichedTrendData} margin={{ left: -20, right: 10, top: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#223c34" />
                        <XAxis dataKey="name" stroke="#8ea69d" fontSize={10} tickLine={false} />
                        <YAxis stroke="#8ea69d" fontSize={10} tickLine={false} domain={[0, 100]} />
                        <Tooltip content={<CustomLineTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="Akurasi Game"
                          stroke="rgba(223, 183, 92, 0.4)"
                          strokeWidth={1.5}
                          dot={{ r: 3, strokeWidth: 1, stroke: 'rgba(223, 183, 92, 0.6)' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="Moving Average (3)"
                          stroke="#dfb75c"
                          strokeWidth={3}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-slate-500 text-sm">Tidak ada data tren akurasi.</div>
                  )}
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex gap-4 text-xs font-semibold text-slate-400 justify-around mt-auto">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-indigo-500/40" />
                    <span>Akurasi Game</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-1 bg-indigo-400" />
                    <span>Moving Average (3 Game)</span>
                  </div>
                </div>
              </section>

            </div>
          </>
        )}

      </div>
    </div>
  );
}

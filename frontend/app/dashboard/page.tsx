'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
import { BASE_URL } from '../../lib/api';

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
  const [data, setData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    async function fetchAnalysis() {
      try {
        setIsLoading(true);
        const res = await fetch(`${BASE_URL}/api/analysis/patterns`);
        if (!res.ok) {
          throw new Error(`Failed to fetch analysis: ${res.statusText}`);
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('Error loading pattern analysis:', err);
        setErrorMsg('Gagal memuat data analisis pattern. Pastikan backend Anda berjalan.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalysis();
  }, [isMounted]);

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        <p className="mt-4 text-sm font-medium">Memuat dashboard...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center py-16 text-slate-400">
        <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        <p className="mt-4 text-sm font-semibold">Menganalisis riwayat game Anda...</p>
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

  const gameCount = data?.game_count ?? 0;

  // Render locked banner if game count < 10
  if (gameCount < 10) {
    const progressPercent = Math.min(100, gameCount * 10);
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center py-16 px-4">
        <div className="w-full max-w-xl bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-3xl mb-6 shadow-inner animate-pulse">
            📊
          </div>
          <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight">Dashboard Analisis Terkunci</h2>
          <p className="text-slate-400 text-sm mt-3 max-w-md leading-relaxed">
            Mainkan dan simpan minimal <span className="text-indigo-400 font-bold">10 game</span> untuk membuka analisis pola permainan, kelemahan fase, tren akurasi, dan jenis blunder.
          </p>

          {/* Progress bar */}
          <div className="w-full bg-slate-950 border border-slate-800/80 rounded-2xl p-5 mt-8 flex flex-col gap-3">
            <div className="flex justify-between items-center text-xs font-bold font-mono text-slate-400">
              <span>PROGRESS GAME</span>
              <span className="text-indigo-400">{gameCount} / 10 GAME</span>
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
            className="mt-8 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition"
          >
            ♟️ Mulai Main Sekarang
          </Link>
        </div>
      </div>
    );
  }

  const { phase_weakness, blunder_patterns, accuracy_trend } = data!;

  // 1. Metric Cards mapping for Phase Weakness
  const phaseList = [
    {
      key: 'opening',
      name: 'Opening',
      icon: '♟️',
      accuracy: phase_weakness?.opening.accuracy ?? 100,
      blunders: phase_weakness?.opening.blunders ?? 0,
      mistakes: phase_weakness?.opening.mistakes ?? 0,
    },
    {
      key: 'middlegame',
      name: 'Middlegame',
      icon: '♞',
      accuracy: phase_weakness?.middlegame.accuracy ?? 100,
      blunders: phase_weakness?.middlegame.blunders ?? 0,
      mistakes: phase_weakness?.middlegame.mistakes ?? 0,
    },
    {
      key: 'endgame',
      name: 'Endgame',
      icon: '♚',
      accuracy: phase_weakness?.endgame.accuracy ?? 100,
      blunders: phase_weakness?.endgame.blunders ?? 0,
      mistakes: phase_weakness?.endgame.mistakes ?? 0,
    },
  ];

  // 2. Bar chart data for Blunder Breakdown
  const blunderData = blunder_patterns
    ? [
        { name: 'Gantung Perwira', count: blunder_patterns.breakdown.hanging_piece, fill: '#f43f5e' },
        { name: 'Taktik Terlewat', count: blunder_patterns.breakdown.missed_tactic, fill: '#fb923c' },
        { name: 'Keamanan Raja', count: blunder_patterns.breakdown.king_safety, fill: '#ec4899' },
        { name: 'Krisis Waktu', count: blunder_patterns.breakdown.time_trouble, fill: '#a855f7' },
        { name: 'Lainnya', count: blunder_patterns.breakdown.other, fill: '#64748b' },
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

  // 3. Line chart data for Accuracy Trend
  const enrichedTrendData = accuracy_trend
    ? accuracy_trend.map((item, index) => {
        const slice = accuracy_trend.slice(Math.max(0, index - 2), index + 1);
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
    if (!accuracy_trend || accuracy_trend.length < 3) return null;
    const n = accuracy_trend.length;
    const recent = accuracy_trend.slice(Math.max(0, n - 3));
    const prior = accuracy_trend.slice(0, Math.max(0, n - 3));

    if (recent.length === 0 || prior.length === 0) return null;

    const avgRecent = recent.reduce((sum, item) => sum + item.accuracy, 0) / recent.length;
    const avgPrior = prior.reduce((sum, item) => sum + item.accuracy, 0) / prior.length;
    const diff = avgRecent - avgPrior;

    if (diff > 1.5) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold">
          📈 Improving
        </span>
      );
    } else if (diff < -1.5) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full text-xs font-bold">
          📉 Needs Attention
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 border border-slate-700 text-slate-400 rounded-full text-xs font-bold">
          ➡️ Consistent
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
        
        {/* Title / Header */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            Dashboard Analisis Pattern
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Evaluasi performa Anda secara mendalam berdasarkan {gameCount} game yang dianalisis.
          </p>
        </div>

        {/* SECTION 1 — Phase Weakness */}
        <section className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 shadow-xl flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <h3 className="text-lg font-bold text-slate-100">1. Analisis Fase Permainan</h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Perbandingan akurasi dan jumlah blunder Anda di fase awal, tengah, dan akhir.
              </p>
            </div>
            {phase_weakness && (
              <span className="self-start px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-xs font-bold">
                Kelemahan: {phase_weakness.weakest_phase.toUpperCase()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {phaseList.map((phase) => {
              const isWeakest = phase_weakness?.weakest_phase === phase.key;
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
                    <span className="text-3xl font-black text-slate-100 font-mono">
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

          {phase_weakness && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex gap-3.5 items-start">
              <span className="text-xl shrink-0">💡</span>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Rekomendasi Analis Chezzy
                </span>
                <p className="text-sm text-slate-300 font-medium leading-relaxed">
                  {phase_weakness.insight}
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                    <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} width={110} />
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

            {blunder_patterns && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex gap-3.5 items-start mt-auto">
                <span className="text-xl shrink-0">🎯</span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Analisis Penyebab
                  </span>
                  <p className="text-sm text-slate-300 font-medium leading-relaxed">
                    {blunder_patterns.insight}
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} domain={[0, 100]} />
                    <Tooltip content={<CustomLineTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="Akurasi Game"
                      stroke="rgba(99, 102, 241, 0.4)"
                      strokeWidth={1.5}
                      dot={{ r: 3, strokeWidth: 1, stroke: 'rgba(99, 102, 241, 0.6)' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Moving Average (3)"
                      stroke="#818cf8"
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

      </div>
    </div>
  );
}

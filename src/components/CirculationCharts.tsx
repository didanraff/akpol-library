import { useState } from 'react';
import type { DailyBorrowPoint } from '../types.ts';

interface CirculationChartsProps {
  dailyTrend: DailyBorrowPoint[];
  categoryStats: { category: string; totalBooks: number; borrowCount: number }[];
}

export function CirculationCharts({ dailyTrend, categoryStats }: CirculationChartsProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxVal = Math.max(
    4,
    ...dailyTrend.map((d) => Math.max(d.borrows, d.returns))
  );

  const totalCatBorrows = Math.max(
    1,
    categoryStats.reduce((sum, c) => sum + c.borrowCount, 0)
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* 7-Day Circulation Trend Chart */}
      <div className="lg:col-span-7 border border-slate-200 bg-white p-6 rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Statistik Sirkulasi 7 Hari Terakhir
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Perbandingan transaksi peminjaman dan pengembalian harian
            </p>
          </div>
          <div className="flex items-center gap-5 text-xs text-slate-600">
            <span className="flex items-center gap-2 whitespace-nowrap">
              <span className="inline-block h-2.5 w-2.5 rounded-xs bg-teal-700" />
              Peminjaman
            </span>
            <span className="flex items-center gap-2 whitespace-nowrap">
              <span className="inline-block h-2.5 w-2.5 rounded-xs bg-slate-300" />
              Pengembalian
            </span>
          </div>
        </div>

        <div className="mt-5">
          <div className="relative h-56 w-full">
            <svg
              viewBox="0 0 640 210"
              className="h-full w-full overflow-visible"
              role="img"
              aria-label="Grafik statistik peminjaman dan pengembalian 7 hari terakhir"
            >
              {/* Horizontal Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = 172 - ratio * 145;
                const tickVal = Math.round(maxVal * ratio);
                return (
                  <g key={idx}>
                    <line
                      x1="36"
                      y1={y}
                      x2="628"
                      y2={y}
                      stroke="#E2E8F0"
                      strokeDasharray={ratio === 0 ? undefined : '3 3'}
                    />
                    <text
                      x="26"
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-400 font-mono text-[10px]"
                    >
                      {tickVal}
                    </text>
                  </g>
                );
              })}

              {/* Grouped Bars */}
              {dailyTrend.map((point, idx) => {
                const slotWidth = 580 / Math.max(1, dailyTrend.length);
                const centerX = 44 + idx * slotWidth + slotWidth / 2;
                const borrowH = (point.borrows / maxVal) * 145;
                const returnH = (point.returns / maxVal) * 145;
                const isHovered = hoveredIdx === idx;

                return (
                  <g
                    key={point.date}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="cursor-pointer"
                  >
                    {isHovered && (
                      <rect
                        x={centerX - 30}
                        y={20}
                        width={60}
                        height={152}
                        rx={6}
                        fill="#F1F5F9"
                      />
                    )}
                    <rect
                      x={centerX - 18}
                      y={172 - borrowH}
                      width={16}
                      height={Math.max(2, borrowH)}
                      rx={3}
                      fill={isHovered ? '#0D9488' : '#0F766E'}
                    />
                    <rect
                      x={centerX + 2}
                      y={172 - returnH}
                      width={16}
                      height={Math.max(2, returnH)}
                      rx={3}
                      fill={isHovered ? '#94A3B8' : '#CBD5E1'}
                    />
                    <text
                      x={centerX}
                      y={194}
                      textAnchor="middle"
                      className={`font-sans text-[11px] ${
                        isHovered ? 'fill-slate-900 font-semibold' : 'fill-slate-500'
                      }`}
                    >
                      {point.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="mt-2 flex min-h-7 items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600 tabular-nums">
            {hoveredIdx !== null && dailyTrend[hoveredIdx] ? (
              <div className="flex flex-wrap items-center gap-4">
                <span className="font-medium text-slate-900">
                  {dailyTrend[hoveredIdx].label}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Peminjaman:{' '}
                  <strong className="font-mono text-teal-800">
                    {dailyTrend[hoveredIdx].borrows}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Pengembalian:{' '}
                  <strong className="font-mono text-slate-800">
                    {dailyTrend[hoveredIdx].returns}
                  </strong>
                </span>
              </div>
            ) : (
              <span className="text-slate-400">
                Arahkan kursor pada batang grafik untuk melihat rincian sirkulasi harian
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Category Popularity Breakdown */}
      <div className="lg:col-span-5 border border-slate-200 bg-white p-6 rounded-xl flex flex-col justify-between">
        <div>
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Peminjaman per Kategori
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Distribusi akumulasi transaksi berdasarkan bidang keilmuan
            </p>
          </div>

          <div className="mt-5 space-y-4">
            {categoryStats.map((cat) => {
              const pct = Math.round((cat.borrowCount / totalCatBorrows) * 100);
              return (
                <div key={cat.category}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-800 truncate">{cat.category}</span>
                    <span className="font-mono text-xs text-slate-600 tabular-nums shrink-0">
                      {cat.borrowCount} kali ({pct}%)
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-teal-700 transition-all duration-300"
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-500 tabular-nums">
          <span>Total kategori aktif: {categoryStats.length}</span>
          <span>Total sirkulasi: {totalCatBorrows} transaksi</span>
        </div>
      </div>
    </div>
  );
}

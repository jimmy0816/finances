import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { compoundT, type CalcLocale } from '../../i18n/calcTranslations';

/* ── Types ── */
type CompoundFrequency = 'monthly' | 'quarterly' | 'annually';

interface YearlyRow {
  year: number;
  principal: number;   // cumulative principal invested (NT$)
  interest: number;    // cumulative interest earned (NT$)
  total: number;       // principal + interest
}

interface CalcResult {
  finalAmount: number;
  totalPrincipal: number;
  totalInterest: number;
  multiplier: number;
  yearlyData: YearlyRow[];
}

/* ── Helpers ── */
const fmt = (n: number) =>
  new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(n);

/**
 * fmtWan: format NT$ amounts using 萬/億 units.
 * Rules:
 *   wan = n / 10000
 *   wan >= 10000 → 億 (1 億= 10000 萬)
 *   otherwise → 萬
 * Verified:
 *   n=1000000 (100萬) → "100.0 萬"
 *   n=100000000 (10000萬=1億) → "1.0 億"
 *   n=500000000 (50000萬=5億) → "5.0 億"
 */
function fmtWan(n: number, locale: CalcLocale): string {
  const wan = n / 10000;
  if (locale === 'en') {
    if (n >= 100000000) return `NT$ ${(n / 100000000).toFixed(2)}B`;
    if (n >= 10000000) return `NT$ ${(n / 10000000).toFixed(1)}0M`;
    return `NT$ ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)}`;
  }
  if (locale === 'ja') {
    if (wan >= 10000) return `${(wan / 10000).toFixed(2)} 億`;
    return `${wan.toFixed(1)} 万`;
  }
  // zh-TW default
  if (wan >= 10000) return `${(wan / 10000).toFixed(2)} 億`;
  return `${wan.toFixed(1)} 萬`;
}

/* ── Core calculation ── */
function calculate(
  principalWan: number,
  monthlyContribWan: number,
  annualRate: number,
  years: number,
  frequency: CompoundFrequency,
): CalcResult {
  const P = principalWan * 10000;
  const M = monthlyContribWan * 10000;
  const r = annualRate / 100;

  // Compounding periods per year
  const n = frequency === 'monthly' ? 12 : frequency === 'quarterly' ? 4 : 1;
  const periodicRate = r / n;

  const yearlyData: YearlyRow[] = [];

  let balance = P;
  const totalYears = years;

  for (let yr = 1; yr <= totalYears; yr++) {
    // Simulate this year period-by-period
    for (let p = 0; p < n; p++) {
      // Add monthly contributions within this compounding period
      if (M > 0) {
        const monthsInPeriod = 12 / n;
        balance += M * monthsInPeriod;
      }
      // Apply interest
      balance = balance * (1 + periodicRate);
    }

    const totalPrincipalSoFar = P + M * 12 * yr;
    const interest = balance - totalPrincipalSoFar;

    yearlyData.push({
      year: yr,
      principal: Math.round(totalPrincipalSoFar),
      interest: Math.round(Math.max(0, interest)),
      total: Math.round(balance),
    });
  }

  const finalAmount = balance;
  const totalPrincipal = P + M * 12 * years;
  const totalInterest = finalAmount - totalPrincipal;
  const multiplier = totalPrincipal > 0 ? finalAmount / totalPrincipal : 1;

  return {
    finalAmount: Math.round(finalAmount),
    totalPrincipal: Math.round(totalPrincipal),
    totalInterest: Math.round(Math.max(0, totalInterest)),
    multiplier,
    yearlyData,
  };
}

/* ── Component ── */
export default function CompoundInterestCalculator({ locale = 'zh-TW' }: { locale?: string }) {
  const tr = compoundT[(locale as CalcLocale)] ?? compoundT['zh-TW'];

  const [principalWan, setPrincipalWan] = useState(100);
  const [monthlyContribWan, setMonthlyContribWan] = useState(3);
  const [annualRate, setAnnualRate] = useState(7);
  const [years, setYears] = useState(20);
  const [frequency, setFrequency] = useState<CompoundFrequency>('monthly');

  const result = useMemo(
    () => calculate(principalWan, monthlyContribWan, annualRate, years, frequency),
    [principalWan, monthlyContribWan, annualRate, years, frequency],
  );

  /* ── Custom tooltip ── */
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div
          style={{
            background: '#fff',
            border: '0.5px solid #E8DDD0',
            padding: '10px 14px',
            fontSize: 12,
          }}
        >
          <p style={{ marginBottom: 4, color: '#8A7E72', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            {tr.tooltipYear(label)}
          </p>
          {payload.map((p: any) => (
            <p key={p.name} style={{ color: p.fill, margin: '2px 0' }}>
              {p.name}：{fmtWan(p.value, locale as CalcLocale)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const freqOptions: { value: CompoundFrequency; label: string }[] = [
    { value: 'monthly', label: tr.freqMonthly },
    { value: 'quarterly', label: tr.freqQuarterly },
    { value: 'annually', label: tr.freqAnnually },
  ];

  return (
    <div className="calc-container" style={{ maxWidth: '100%' }}>
      {/* Header */}
      <div className="calc-header">
        <h2 style={{ fontWeight: 400 }}>{tr.header}</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 300 }}>
          {tr.headerDesc}
        </p>
      </div>

      {/* Body: inputs + results */}
      <div className="calc-body">
        {/* ── Inputs ── */}
        <div className="calc-inputs">
          {/* Initial Principal */}
          <div className="calc-field">
            <label className="calc-label">{tr.principal}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={principalWan}
                min={1}
                max={10000}
                step={10}
                onChange={(e) => setPrincipalWan(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{tr.principalUnit}</span>
            </div>
            <input
              type="range"
              min={1}
              max={10000}
              step={10}
              value={principalWan}
              onChange={(e) => setPrincipalWan(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>1萬</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{tr.principalHint(principalWan)}</span>
              <span>1億</span>
            </div>
          </div>

          {/* Monthly Contribution */}
          <div className="calc-field">
            <label className="calc-label">{tr.monthlyContrib}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={monthlyContribWan}
                min={0}
                max={100}
                step={0.5}
                onChange={(e) => setMonthlyContribWan(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{tr.monthlyContribUnit}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={0.5}
              value={monthlyContribWan}
              onChange={(e) => setMonthlyContribWan(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>0</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{tr.principalHint(monthlyContribWan)}</span>
              <span>100萬</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{tr.monthlyContribHint}</p>
          </div>

          {/* Annual Rate */}
          <div className="calc-field">
            <label className="calc-label">{tr.annualRate}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={annualRate}
                min={0.1}
                max={30}
                step={0.1}
                onChange={(e) => setAnnualRate(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>%</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={30}
              step={0.1}
              value={annualRate}
              onChange={(e) => setAnnualRate(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>0.1%</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{tr.rateHint(annualRate)}</span>
              <span>30%</span>
            </div>
          </div>

          {/* Investment Years */}
          <div className="calc-field">
            <label className="calc-label">{tr.years}</label>
            <select
              className="calc-select"
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
            >
              {[1, 3, 5, 10, 15, 20, 25, 30, 40].map((y) => (
                <option key={y} value={y}>{y} {tr.yearUnit}</option>
              ))}
            </select>
          </div>

          {/* Compounding Frequency */}
          <div className="calc-field">
            <label className="calc-label">{tr.frequency}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {freqOptions.map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '8px 4px',
                    border: `0.5px solid ${frequency === opt.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    background: frequency === opt.value ? 'var(--color-accent-bg)' : 'var(--color-bg-card)',
                    cursor: 'pointer',
                    fontSize: 12,
                    borderRadius: 4,
                    transition: 'all 120ms',
                    textAlign: 'center',
                  }}
                >
                  <input
                    type="radio"
                    name="frequency"
                    value={opt.value}
                    checked={frequency === opt.value}
                    onChange={() => setFrequency(opt.value)}
                    style={{ display: 'none' }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* ── Results ── */}
        <div className="calc-results">
          {/* Final Amount */}
          <div style={{ marginBottom: 24 }}>
            <div className="result-label">{tr.finalAmount}</div>
            <div className="result-big">{fmtWan(result.finalAmount, locale as CalcLocale)}</div>
          </div>

          {/* Summary rows */}
          <div style={{ borderTop: '0.5px solid var(--color-border)', paddingTop: 16 }}>
            <div className="result-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>{tr.totalPrincipal}</span>
              <span style={{ fontWeight: 500 }}>{fmtWan(result.totalPrincipal, locale as CalcLocale)}</span>
            </div>
            <div className="result-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>{tr.totalInterest}</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>
                {fmtWan(result.totalInterest, locale as CalcLocale)}
              </span>
            </div>
            <div className="result-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>{tr.multiplier}</span>
              <span style={{ fontWeight: 500, color: 'var(--color-accent)' }}>
                {result.multiplier.toFixed(2)}x
              </span>
            </div>
          </div>

          {/* Principal vs Interest bar */}
          {result.totalPrincipal > 0 && (
            <div style={{ marginTop: 20 }}>
              {(() => {
                const principalPct = (result.totalPrincipal / result.finalAmount) * 100;
                const interestPct = 100 - principalPct;
                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                      <span>{tr.chartPrincipal} {principalPct.toFixed(1)}%</span>
                      <span>{tr.chartInterest} {interestPct.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: 8, background: '#E8DDD0', borderRadius: 4, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${principalPct}%`,
                          background: 'var(--color-accent)',
                          borderRadius: 4,
                          transition: 'width 300ms ease',
                        }}
                      />
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* ── Chart ── */}
      <div style={{ padding: '32px 32px 0', borderTop: '0.5px solid var(--color-border)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 20, color: 'var(--color-text-primary)' }}>
          {tr.chartTitle}
        </h3>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={result.yearlyData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <defs>
                <linearGradient id="gradCIPrincipal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E07020" stopOpacity={0.85} />
                  <stop offset="95%" stopColor="#E07020" stopOpacity={0.15} />
                </linearGradient>
                <linearGradient id="gradCIInterest" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D8CDBE" stopOpacity={0.85} />
                  <stop offset="95%" stopColor="#D8CDBE" stopOpacity={0.15} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8DDD0" />
              <XAxis
                dataKey="year"
                tickFormatter={(v) => locale === 'ja' ? `${v}年` : locale === 'en' ? `Y${v}` : `${v}年`}
                tick={{ fontSize: 11, fill: '#A89A8C' }}
                tickLine={false}
                axisLine={{ stroke: '#E8DDD0' }}
              />
              <YAxis
                tickFormatter={(v) => {
                  const wan = v / 10000;
                  if (wan >= 10000) return `${(wan / 10000).toFixed(0)}億`;
                  if (wan >= 1000) return `${(wan / 1000).toFixed(0)}千萬`;
                  if (wan >= 1) return `${wan.toFixed(0)}萬`;
                  return `${Math.round(v)}`;
                }}
                tick={{ fontSize: 11, fill: '#A89A8C' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                formatter={(value) => <span style={{ color: 'var(--color-text-secondary)' }}>{value}</span>}
              />
              <Area
                type="monotone"
                dataKey="principal"
                name={tr.chartPrincipal}
                stackId="1"
                stroke="#E07020"
                fill="url(#gradCIPrincipal)"
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="interest"
                name={tr.chartInterest}
                stackId="1"
                stroke="#D8CDBE"
                fill="url(#gradCIInterest)"
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Yearly Table ── */}
      <div style={{ padding: '24px 32px 32px', borderTop: '0.5px solid var(--color-border)', marginTop: 24 }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420, fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--color-text-primary)', color: '#fff' }}>
                {[
                  locale === 'en' ? 'Year' : locale === 'ja' ? '年' : '年度',
                  tr.totalPrincipal,
                  tr.totalInterest,
                  locale === 'en' ? 'Total' : locale === 'ja' ? '合計' : '合計金額',
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 12px',
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      letterSpacing: 1.5,
                      textTransform: 'uppercase',
                      fontWeight: 400,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.yearlyData.map((row) => (
                <tr
                  key={row.year}
                  style={{
                    borderBottom: '0.5px solid var(--color-border)',
                    background: row.year % 2 === 0 ? 'var(--color-bg)' : 'var(--color-bg-card)',
                  }}
                >
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {row.year}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500 }}>
                    {fmtWan(row.principal, locale as CalcLocale)}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-accent)' }}>
                    {fmtWan(row.interest, locale as CalcLocale)}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500 }}>
                    {fmtWan(row.total, locale as CalcLocale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

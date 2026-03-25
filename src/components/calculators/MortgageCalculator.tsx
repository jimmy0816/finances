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
import { mortgageT, type CalcLocale } from '../../i18n/calcTranslations';

/* ── Types ── */
type RepaymentMethod = 'equalPayment' | 'equalPrincipal';

interface AmortizationRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

interface CalcResult {
  monthlyPayment: number;          // first month (or equal monthly for 本息均攤)
  graceMonthly: number;            // interest-only during grace period
  postGraceMonthly: number;        // payment after grace period
  totalPayment: number;
  totalInterest: number;
  interestRatio: number;
  schedule: AmortizationRow[];
}

/* ── Helpers ── */
const fmt = (n: number) =>
  new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(n);

const fmtCurrency = (n: number) => `NT$ ${fmt(n)}`;

/* ── Core calculation ── */
function calculate(
  loanWan: number,
  annualRate: number,
  years: number,
  method: RepaymentMethod,
  gracePeriodYears: number,
): CalcResult {
  const P = loanWan * 10000;
  const r = annualRate / 12 / 100;
  const n = years * 12;
  const graceMonths = gracePeriodYears * 12;
  const remainMonths = n - graceMonths;

  const schedule: AmortizationRow[] = [];
  let balance = P;
  let totalPayment = 0;

  // Grace period rows (interest only)
  const graceMonthly = P * r;
  for (let k = 1; k <= graceMonths; k++) {
    const interest = balance * r;
    schedule.push({ month: k, payment: graceMonthly, principal: 0, interest, balance });
    totalPayment += graceMonthly;
  }

  // Post-grace rows
  let postGraceMonthly = 0;

  if (method === 'equalPayment') {
    // 本息均攤
    if (graceMonths === 0) {
      // Standard equal payment
      const M = r === 0 ? P / n : (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      postGraceMonthly = M;
      for (let k = 1; k <= n; k++) {
        const interest = balance * r;
        const principal = M - interest;
        balance -= principal;
        if (balance < 0) balance = 0;
        schedule.push({ month: k, payment: M, principal, interest, balance });
        totalPayment += M;
      }
    } else {
      // After grace period, recalculate equal payment on remaining principal
      const M =
        r === 0
          ? P / remainMonths
          : (P * r * Math.pow(1 + r, remainMonths)) /
            (Math.pow(1 + r, remainMonths) - 1);
      postGraceMonthly = M;
      for (let k = graceMonths + 1; k <= n; k++) {
        const interest = balance * r;
        const principal = M - interest;
        balance -= principal;
        if (balance < 0) balance = 0;
        schedule.push({ month: k, payment: M, principal, interest, balance });
        totalPayment += M;
      }
    }
  } else {
    // 本金均攤
    const monthlyPrincipal = P / n;
    // Grace period: already added above (interest only, balance unchanged)
    // Post-grace: principal = P/n each month
    for (let k = graceMonths + 1; k <= n; k++) {
      const interest = balance * r;
      const payment = monthlyPrincipal + interest;
      balance -= monthlyPrincipal;
      if (balance < 0) balance = 0;
      schedule.push({ month: k, payment, principal: monthlyPrincipal, interest, balance });
      totalPayment += payment;
    }
    // Post-grace monthly = first payment after grace
    postGraceMonthly = schedule.find((r) => r.month === graceMonths + 1)?.payment ?? 0;
  }

  const monthlyPayment = graceMonths > 0 ? postGraceMonthly : schedule[0]?.payment ?? 0;
  const totalInterest = totalPayment - P;
  const interestRatio = (totalInterest / totalPayment) * 100;

  return {
    monthlyPayment,
    graceMonthly,
    postGraceMonthly,
    totalPayment,
    totalInterest,
    interestRatio,
    schedule,
  };
}

/* ── Chart data (sampled monthly) ── */
function buildChartData(schedule: AmortizationRow[], principalKey: string, interestKey: string) {
  // For large schedules, sample every 3 months to keep chart readable
  const step = schedule.length > 120 ? 6 : schedule.length > 60 ? 3 : 1;
  return schedule
    .filter((_, i) => i % step === 0)
    .map((row) => ({
      month: row.month,
      [principalKey]: Math.round(row.principal),
      [interestKey]: Math.round(row.interest),
    }));
}

/* ── Simplified schedule: 1 row per year + last month ── */
function buildSimplifiedSchedule(schedule: AmortizationRow[]) {
  const result: AmortizationRow[] = [];
  schedule.forEach((row, idx) => {
    const isFirstOfYear = row.month % 12 === 1;
    const isLast = idx === schedule.length - 1;
    if (isFirstOfYear || isLast) result.push(row);
  });
  return result;
}

/* ── Component ── */
export default function MortgageCalculator({ locale = 'zh-TW' }: { locale?: string }) {
  const tr = mortgageT[(locale as CalcLocale)] ?? mortgageT['zh-TW'];
  const [loanWan, setLoanWan] = useState(1000);
  const [annualRate, setAnnualRate] = useState(2.1);
  const [years, setYears] = useState(30);
  const [method, setMethod] = useState<RepaymentMethod>('equalPayment');
  const [gracePeriod, setGracePeriod] = useState(0);

  const [showSchedule, setShowSchedule] = useState(false);
  const [showAllMonths, setShowAllMonths] = useState(false);

  const result = useMemo(
    () => calculate(loanWan, annualRate, years, method, gracePeriod),
    [loanWan, annualRate, years, method, gracePeriod],
  );

  const chartData = useMemo(() => buildChartData(result.schedule, tr.chartPrincipal, tr.chartInterest), [result.schedule, tr.chartPrincipal, tr.chartInterest]);
  const simplifiedSchedule = useMemo(
    () => buildSimplifiedSchedule(result.schedule),
    [result.schedule],
  );

  const tableData = showAllMonths ? result.schedule : simplifiedSchedule;

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
            {tr.tooltipMonth(label)}
          </p>
          {payload.map((p: any) => (
            <p key={p.name} style={{ color: p.fill, margin: '2px 0' }}>
              {p.name}：NT$ {fmt(p.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

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
          {/* Loan Amount */}
          <div className="calc-field">
            <label className="calc-label">{tr.loanAmount}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={loanWan}
                min={100}
                max={5000}
                step={10}
                onChange={(e) => setLoanWan(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{tr.loanUnit}</span>
            </div>
            <input
              type="range"
              min={100}
              max={5000}
              step={10}
              value={loanWan}
              onChange={(e) => setLoanWan(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>{tr.loanMin}</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{tr.loanInputHint(loanWan)}</span>
              <span>{tr.loanMax}</span>
            </div>
          </div>

          {/* Annual Rate */}
          <div className="calc-field">
            <label className="calc-label">{tr.annualRate}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={annualRate}
                min={1.0}
                max={5.0}
                step={0.01}
                onChange={(e) => setAnnualRate(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>%</span>
            </div>
            <input
              type="range"
              min={1.0}
              max={5.0}
              step={0.01}
              value={annualRate}
              onChange={(e) => setAnnualRate(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>1.0%</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{tr.rateInputHint(annualRate)}</span>
              <span>5.0%</span>
            </div>
          </div>

          {/* Loan Term */}
          <div className="calc-field">
            <label className="calc-label">{tr.loanTerm}</label>
            <select
              className="calc-select"
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
            >
              {[10, 15, 20, 25, 30, 40].map((y) => (
                <option key={y} value={y}>{y} {tr.yearUnit}</option>
              ))}
            </select>
          </div>

          {/* Repayment Method */}
          <div className="calc-field">
            <label className="calc-label">{tr.repayMethod}</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              {[
                { value: 'equalPayment', label: tr.equalPayment, desc: tr.equalPaymentDesc },
                { value: 'equalPrincipal', label: tr.equalPrincipal, desc: tr.equalPrincipalDesc },
              ].map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 12px',
                    border: `0.5px solid ${method === opt.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    background: method === opt.value ? 'var(--color-accent-bg)' : 'var(--color-bg-card)',
                    cursor: 'pointer',
                    transition: 'all 120ms',
                    borderRadius: 4,
                  }}
                >
                  <input
                    type="radio"
                    name="method"
                    value={opt.value}
                    checked={method === opt.value}
                    onChange={() => setMethod(opt.value as RepaymentMethod)}
                    style={{ marginTop: 2, accentColor: 'var(--color-accent)' }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 400, color: 'var(--color-text-primary)' }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Grace Period */}
          <div className="calc-field">
            <label className="calc-label">{tr.gracePeriod}</label>
            <select
              className="calc-select"
              value={gracePeriod}
              onChange={(e) => setGracePeriod(Number(e.target.value))}
            >
              {[0, 1, 2, 3, 5].map((y) => (
                <option key={y} value={y}>{y === 0 ? tr.noGrace : `${y} ${tr.yearUnit}`}</option>
              ))}
            </select>
            {gracePeriod > 0 && (
              <p style={{ fontSize: 11, color: 'var(--color-warning)', marginTop: 6 }}>
                {tr.graceWarning}
              </p>
            )}
          </div>
        </div>

        {/* ── Results ── */}
        <div className="calc-results">
          {/* Main monthly */}
          {gracePeriod > 0 ? (
            <>
              <div style={{ marginBottom: 24 }}>
                <div className="result-label">{tr.graceMonthly}</div>
                <div className="result-big">{fmtCurrency(Math.round(result.graceMonthly))}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  {tr.graceDuration(gracePeriod)}
                </div>
              </div>
              <div style={{ marginBottom: 24 }}>
                <div className="result-label">{tr.postGraceMonthly}</div>
                <div className="result-big">{fmtCurrency(Math.round(result.postGraceMonthly))}</div>
                {method === 'equalPrincipal' && (
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                    {tr.equalPrincipalNote}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ marginBottom: 24 }}>
              <div className="result-label">{tr.monthlyPayment}</div>
              <div className="result-big">{fmtCurrency(Math.round(result.monthlyPayment))}</div>
              {method === 'equalPrincipal' && (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  {tr.equalPrincipalNote}
                </div>
              )}
            </div>
          )}

          {/* Summary rows */}
          <div style={{ borderTop: '0.5px solid var(--color-border)', paddingTop: 16 }}>
            <div className="result-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>{tr.totalPayment}</span>
              <span style={{ fontWeight: 500 }}>{fmtCurrency(Math.round(result.totalPayment))}</span>
            </div>
            <div className="result-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>{tr.totalInterest}</span>
              <span style={{ color: 'var(--color-warning)', fontWeight: 500 }}>
                {fmtCurrency(Math.round(result.totalInterest))}
              </span>
            </div>
            <div className="result-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>{tr.interestRatio}</span>
              <span style={{ fontWeight: 500 }}>{result.interestRatio.toFixed(1)}%</span>
            </div>
            <div className="result-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>{tr.loanAmountLabel}</span>
              <span>{fmtCurrency(loanWan * 10000)}</span>
            </div>
            <div className="result-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>{tr.rateTermLabel}</span>
              <span>{annualRate}% / {years} {tr.yearUnit}</span>
            </div>
          </div>

          {/* Interest vs Principal bar */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>
              <span>{tr.principalPct((100 - result.interestRatio).toFixed(1) as any)}</span>
              <span>{tr.interestPct(result.interestRatio.toFixed(1) as any)}</span>
            </div>
            <div style={{ height: 8, background: '#E8DDD0', borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${100 - result.interestRatio}%`,
                  background: 'var(--color-accent)',
                  borderRadius: 4,
                  transition: 'width 300ms ease',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Chart ── */}
      <div style={{ padding: '32px 32px 0', borderTop: '0.5px solid var(--color-border)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 20, color: 'var(--color-text-primary)' }}>
          {tr.chartTitle}
        </h3>
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <defs>
                <linearGradient id="gradPrincipal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E07020" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#E07020" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="gradInterest" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D8CDBE" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#D8CDBE" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8DDD0" />
              <XAxis
                dataKey="month"
                tickFormatter={(v) => locale === 'ja' ? `${v}ヶ月` : locale === 'en' ? `M${v}` : `${v}月`}
                tick={{ fontSize: 11, fill: '#A89A8C' }}
                tickLine={false}
                axisLine={{ stroke: '#E8DDD0' }}
              />
              <YAxis
                tickFormatter={(v) => `${Math.round(v / 1000)}K`}
                tick={{ fontSize: 11, fill: '#A89A8C' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                formatter={(value) => <span style={{ color: 'var(--color-text-secondary)' }}>{value}</span>}
              />
              <Area type="monotone" dataKey={tr.chartPrincipal} stackId="1" stroke="#E07020" fill="url(#gradPrincipal)" strokeWidth={1.5} />
              <Area type="monotone" dataKey={tr.chartInterest} stackId="1" stroke="#D8CDBE" fill="url(#gradInterest)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Amortization Table ── */}
      <div style={{ padding: '24px 32px 32px', borderTop: '0.5px solid var(--color-border)', marginTop: 24 }}>
        <button
          className="calc-btn"
          style={{ marginBottom: showSchedule ? 20 : 0, background: showSchedule ? '#1A1714' : 'var(--color-accent)' }}
          onClick={() => {
            setShowSchedule((v) => !v);
            if (showSchedule) setShowAllMonths(false);
          }}
        >
          {showSchedule ? tr.hideSchedule : tr.showSchedule}
        </button>

        {showSchedule && (
          <>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480, fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--color-text-primary)', color: '#fff' }}>
                    {[tr.tableMonth, tr.tablePayment, tr.tablePrincipal, tr.tableInterest, tr.tableBalance].map((h) => (
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
                  {tableData.map((row) => (
                    <tr
                      key={row.month}
                      style={{
                        borderBottom: '0.5px solid var(--color-border)',
                        background: row.month % 2 === 0 ? 'var(--color-bg)' : 'var(--color-bg-card)',
                      }}
                    >
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {row.month}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500 }}>
                        {fmt(Math.round(row.payment))}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-accent)' }}>
                        {fmt(Math.round(row.principal))}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-warning)' }}>
                        {fmt(Math.round(row.interest))}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        {fmt(Math.round(row.balance))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Toggle all months */}
            <button
              onClick={() => setShowAllMonths((v) => !v)}
              style={{
                marginTop: 12,
                background: 'transparent',
                border: '0.5px solid var(--color-border)',
                padding: '8px 16px',
                fontSize: 12,
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: 1,
              }}
            >
              {showAllMonths
                ? tr.showYearly
                : tr.showAllMonths(result.schedule.length)}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

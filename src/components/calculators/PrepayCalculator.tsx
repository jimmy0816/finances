import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

/* ── Helpers ── */
const fmt = (n: number) =>
  new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(n);

const fmtWan = (n: number) => {
  const wan = n / 10000;
  if (wan >= 100) return `${(wan / 100).toFixed(1)} 億`;
  return `${wan.toFixed(1)} 萬`;
};

/* ── Core: equal-payment monthly ── */
function calcMonthly(P: number, r: number, n: number): number {
  if (r === 0) return P / n;
  return (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/* ── Remaining balance after k payments ── */
function remainingBalance(P: number, r: number, n: number, k: number): number {
  if (r === 0) return P * (1 - k / n);
  const M = calcMonthly(P, r, n);
  return M * (1 - Math.pow(1 + r, -(n - k))) / r;
}

/* ── Months to pay off balance B with monthly payment M ── */
function monthsToPayOff(B: number, r: number, M: number): number {
  if (r === 0) return Math.ceil(B / M);
  if (M <= B * r) return Infinity; // payment doesn't cover interest
  return Math.ceil(Math.log(M / (M - B * r)) / Math.log(1 + r));
}

/* ── Total interest for a loan ── */
function totalInterestForSchedule(P: number, r: number, M: number, n: number): number {
  return M * n - P;
}

interface PrepayResult {
  /* Original */
  origMonthly: number;
  origTotalInterest: number;
  origRemainingMonths: number;
  /* Shorten term mode */
  shortenNewMonths: number;
  shortenTotalInterest: number;
  shortenSaved: number;
  /* Lower payment mode */
  lowerNewMonthly: number;
  lowerTotalInterest: number;
  lowerSaved: number;
  /* Remaining balance */
  remainBal: number;
  /* Extra monthly payment */
  extraShortenYears: number;
  extraSaved: number;
}

function calcPrepay(
  loanWan: number,
  years: number,
  annualRate: number,
  paidYears: number,
  prepayWan: number,
  extraMonthly: number,
): PrepayResult {
  const P = loanWan * 10000;
  const r = annualRate / 12 / 100;
  const n = years * 12;
  const paid = paidYears * 12;
  const remaining = n - paid;

  const M = calcMonthly(P, r, n);
  const origTotalPayment = M * n;
  const origTotalInterest = origTotalPayment - P;

  // Remaining balance at current point
  const remainBal = remainingBalance(P, r, n, paid);
  const prepayAmt = Math.min(prepayWan * 10000, remainBal);
  const newPrincipal = remainBal - prepayAmt;

  // Interest already paid
  const alreadyPaidInterest = M * paid - (P - remainBal);

  // ── Mode 1: Shorten term (same monthly M) ──
  const shortenNewMonths = newPrincipal <= 0 ? 0 : monthsToPayOff(newPrincipal, r, M);
  const shortenTotalPayment = M * paid + (prepayAmt) + M * shortenNewMonths;
  const shortenTotalInterest = shortenTotalPayment - P;
  const shortenSaved = origTotalInterest - shortenTotalInterest;

  // ── Mode 2: Lower payment (same remaining months) ──
  const lowerNewMonthly = newPrincipal <= 0 ? 0 : calcMonthly(newPrincipal, r, remaining);
  const lowerTotalPayment = M * paid + prepayAmt + lowerNewMonthly * remaining;
  const lowerTotalInterest = lowerTotalPayment - P;
  const lowerSaved = origTotalInterest - lowerTotalInterest;

  // ── Extra monthly: shorten remaining term ──
  const extraNewMonthly = M + extraMonthly;
  const extraNewMonths = remainBal <= 0 ? 0 : monthsToPayOff(remainBal, r, extraNewMonthly);
  const extraShortenMonths = remaining - extraNewMonths;
  const extraShortenYears = extraShortenMonths / 12;

  // Interest with extra payments
  const extraTotalInterest = alreadyPaidInterest + (extraNewMonthly * extraNewMonths - remainBal);
  const extraSaved = origTotalInterest - extraTotalInterest;

  return {
    origMonthly: M,
    origTotalInterest,
    origRemainingMonths: remaining,
    shortenNewMonths,
    shortenTotalInterest,
    shortenSaved,
    lowerNewMonthly,
    lowerTotalInterest,
    lowerSaved,
    remainBal,
    extraShortenYears: Math.max(0, extraShortenYears),
    extraSaved: Math.max(0, extraSaved),
  };
}

/* ── Chart: balance over time ── */
function buildChartData(
  P: number,
  r: number,
  n: number,
  paid: number,
  prepayAmt: number,
  remainBal: number,
) {
  const M = calcMonthly(P, r, n);
  const newPrincipal = Math.max(0, remainBal - prepayAmt);
  const shortenMonths = newPrincipal <= 0 ? 0 : monthsToPayOff(newPrincipal, r, M);

  const data: { month: number; 不提前還: number; 提前還款: number }[] = [];
  const step = n > 120 ? 6 : 3;

  let origBal = P;
  let prepayBal = P;
  let prepayApplied = false;

  for (let k = 0; k <= n; k++) {
    if (k % step !== 0 && k !== n) continue;

    // Orig balance
    if (k > 0) {
      origBal = remainingBalance(P, r, n, k);
    }

    // Prepay balance
    if (k <= paid) {
      prepayBal = remainingBalance(P, r, n, k);
    } else if (!prepayApplied) {
      prepayBal = newPrincipal;
      prepayApplied = true;
    } else {
      const monthsAfterPrepay = k - paid;
      if (monthsAfterPrepay >= shortenMonths) {
        prepayBal = 0;
      } else {
        prepayBal = remainingBalance(newPrincipal, r, shortenMonths, monthsAfterPrepay);
      }
    }

    data.push({
      month: k,
      不提前還: Math.max(0, Math.round(origBal)),
      提前還款: Math.max(0, Math.round(prepayBal)),
    });
  }

  return data;
}

/* ── Component ── */
export default function PrepayCalculator() {
  const [loanWan, setLoanWan] = useState(1000);
  const [years, setYears] = useState(30);
  const [annualRate, setAnnualRate] = useState(2.1);
  const [paidYears, setPaidYears] = useState(5);
  const [prepayWan, setPrepayWan] = useState(100);
  const [extraMonthly, setExtraMonthly] = useState(5000);

  const result = useMemo(
    () => calcPrepay(loanWan, years, annualRate, paidYears, prepayWan, extraMonthly),
    [loanWan, years, annualRate, paidYears, prepayWan, extraMonthly],
  );

  const chartData = useMemo(
    () =>
      buildChartData(
        loanWan * 10000,
        annualRate / 12 / 100,
        years * 12,
        paidYears * 12,
        prepayWan * 10000,
        result.remainBal,
      ),
    [loanWan, annualRate, years, paidYears, prepayWan, result.remainBal],
  );

  const maxSaved = Math.max(result.shortenSaved, result.lowerSaved);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div style={{ background: '#fff', border: '0.5px solid #E8DDD0', padding: '10px 14px', fontSize: 12 }}>
          <p style={{ color: '#8A7E72', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 4 }}>
            第 {label} 月
          </p>
          {payload.map((p: any) => (
            <p key={p.name} style={{ color: p.stroke, margin: '2px 0' }}>
              {p.name}：{fmtWan(p.value)}
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
        <h2 style={{ fontWeight: 400 }}>⏩ 提前還款效益試算</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 300 }}>
          輸入貸款條件與提前還款金額，即時算出省下多少利息、縮短幾年
        </p>
      </div>

      {/* Body */}
      <div className="calc-body">
        {/* ── Inputs ── */}
        <div className="calc-inputs">
          {/* 貸款金額 */}
          <div className="calc-field">
            <label className="calc-label">原始貸款金額</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={loanWan}
                min={100}
                max={5000}
                step={50}
                onChange={(e) => setLoanWan(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>萬元</span>
            </div>
            <input
              type="range"
              min={100}
              max={5000}
              step={50}
              value={loanWan}
              onChange={(e) => setLoanWan(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>100萬</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{fmt(loanWan)} 萬</span>
              <span>5000萬</span>
            </div>
          </div>

          {/* 年期 */}
          <div className="calc-field">
            <label className="calc-label">原始貸款年期</label>
            <select
              className="calc-select"
              value={years}
              onChange={(e) => {
                const y = Number(e.target.value);
                setYears(y);
                if (paidYears >= y) setPaidYears(Math.max(0, y - 1));
              }}
            >
              {[10, 15, 20, 25, 30, 40].map((y) => (
                <option key={y} value={y}>{y} 年</option>
              ))}
            </select>
          </div>

          {/* 年利率 */}
          <div className="calc-field">
            <label className="calc-label">年利率</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={annualRate}
                min={0.5}
                max={8}
                step={0.01}
                onChange={(e) => setAnnualRate(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>%</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={8}
              step={0.05}
              value={annualRate}
              onChange={(e) => setAnnualRate(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>0.5%</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{annualRate.toFixed(2)}%</span>
              <span>8%</span>
            </div>
          </div>

          {/* 已還年數 */}
          <div className="calc-field">
            <label className="calc-label">已還年數</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={paidYears}
                min={0}
                max={years - 1}
                step={1}
                onChange={(e) => setPaidYears(Math.min(Number(e.target.value), years - 1))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>年</span>
            </div>
            <input
              type="range"
              min={0}
              max={years - 1}
              step={1}
              value={paidYears}
              onChange={(e) => setPaidYears(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>0年</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>已還 {paidYears} 年</span>
              <span>{years - 1}年</span>
            </div>
          </div>

          {/* 提前還款金額 */}
          <div className="calc-field">
            <label className="calc-label">提前還款金額</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={prepayWan}
                min={10}
                max={Math.floor(result.remainBal / 10000) || 1000}
                step={10}
                onChange={(e) => setPrepayWan(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>萬元</span>
            </div>
            <input
              type="range"
              min={10}
              max={Math.max(10, Math.floor(result.remainBal / 10000))}
              step={10}
              value={prepayWan}
              onChange={(e) => setPrepayWan(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              目前剩餘本金：{fmtWan(result.remainBal)}
            </p>
          </div>
        </div>

        {/* ── Results ── */}
        <div className="calc-results">
          {/* Big number */}
          <div style={{ marginBottom: 24 }}>
            <div className="result-label">最多可省下利息（縮短年期）</div>
            <div className="result-big">{fmtWan(Math.max(0, result.shortenSaved))}</div>
          </div>

          {/* Summary */}
          <div style={{ borderTop: '0.5px solid var(--color-border)', paddingTop: 16 }}>
            <div className="result-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>目前每月還款</span>
              <span style={{ fontWeight: 500 }}>NT$ {fmt(Math.round(result.origMonthly))}</span>
            </div>
            <div className="result-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>剩餘月數</span>
              <span>{result.origRemainingMonths} 個月（{(result.origRemainingMonths / 12).toFixed(1)} 年）</span>
            </div>
            <div className="result-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>縮短年期 → 提前結清</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>
                {result.shortenNewMonths > 0
                  ? `剩 ${result.shortenNewMonths} 月（省 ${(result.origRemainingMonths - result.shortenNewMonths)} 月）`
                  : '立即結清'}
              </span>
            </div>
            <div className="result-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>降低月付 → 新月付</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>
                NT$ {fmt(Math.round(result.lowerNewMonthly))}
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 4 }}>
                  (-{fmt(Math.round(result.origMonthly - result.lowerNewMonthly))})
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Comparison Table ── */}
      <div style={{ padding: '24px 32px', borderTop: '0.5px solid var(--color-border)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 16, color: 'var(--color-text-primary)' }}>
          📊 還款方案比較
        </h3>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520, fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--color-text-primary)', color: '#fff' }}>
                {['', '不提前還', '縮短年期', '降低月付'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 14px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      letterSpacing: 1.5,
                      textTransform: 'uppercase',
                      fontWeight: 400,
                      textAlign: h === '' ? 'left' : 'right',
                    } as React.CSSProperties}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                {
                  label: '每月還款',
                  orig: `NT$ ${fmt(Math.round(result.origMonthly))}`,
                  shorten: `NT$ ${fmt(Math.round(result.origMonthly))}`,
                  lower: `NT$ ${fmt(Math.round(result.lowerNewMonthly))}`,
                  lowerHighlight: true,
                },
                {
                  label: '剩餘年期',
                  orig: `${(result.origRemainingMonths / 12).toFixed(1)} 年`,
                  shorten: result.shortenNewMonths > 0 ? `${(result.shortenNewMonths / 12).toFixed(1)} 年` : '結清',
                  lower: `${(result.origRemainingMonths / 12).toFixed(1)} 年`,
                  shortenHighlight: true,
                },
                {
                  label: '剩餘總利息',
                  orig: fmtWan(Math.max(0, result.origTotalInterest)),
                  shorten: fmtWan(Math.max(0, result.shortenTotalInterest)),
                  lower: fmtWan(Math.max(0, result.lowerTotalInterest)),
                },
                {
                  label: '節省利息',
                  orig: '—',
                  shorten: result.shortenSaved > 0 ? `🎉 ${fmtWan(result.shortenSaved)}` : '—',
                  lower: result.lowerSaved > 0 ? `🎉 ${fmtWan(result.lowerSaved)}` : '—',
                  accentShorten: result.shortenSaved > 0,
                  accentLower: result.lowerSaved > 0,
                },
              ].map((row, i) => (
                <tr
                  key={row.label}
                  style={{
                    borderBottom: '0.5px solid var(--color-border)',
                    background: i % 2 === 0 ? 'var(--color-bg)' : 'var(--color-bg-card)',
                  }}
                >
                  <td style={{ padding: '10px 14px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 1 }}>
                    {row.label}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>{row.orig}</td>
                  <td
                    style={{
                      padding: '10px 14px',
                      textAlign: 'right',
                      color: (row as any).accentShorten || (row as any).shortenHighlight ? 'var(--color-accent)' : undefined,
                      fontWeight: (row as any).accentShorten ? 500 : undefined,
                    }}
                  >
                    {row.shorten}
                  </td>
                  <td
                    style={{
                      padding: '10px 14px',
                      textAlign: 'right',
                      color: (row as any).accentLower || (row as any).lowerHighlight ? 'var(--color-accent)' : undefined,
                      fontWeight: (row as any).accentLower ? 500 : undefined,
                    }}
                  >
                    {row.lower}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Chart ── */}
      <div style={{ padding: '24px 32px', borderTop: '0.5px solid var(--color-border)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 20, color: 'var(--color-text-primary)' }}>
          📈 剩餘本金走勢對比
        </h3>
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8DDD0" />
              <XAxis
                dataKey="month"
                tickFormatter={(v) => `${Math.round(v / 12)}年`}
                tick={{ fontSize: 11, fill: '#A89A8C' }}
                tickLine={false}
                axisLine={{ stroke: '#E8DDD0' }}
              />
              <YAxis
                tickFormatter={(v) => `${Math.round(v / 10000)}萬`}
                tick={{ fontSize: 11, fill: '#A89A8C' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                formatter={(value) => <span style={{ color: 'var(--color-text-secondary)' }}>{value}</span>}
              />
              <Line
                type="monotone"
                dataKey="不提前還"
                stroke="#D8CDBE"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="提前還款"
                stroke="#E07020"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Extra Monthly Section ── */}
      <div style={{ padding: '24px 32px 32px', borderTop: '0.5px solid var(--color-border)', background: 'var(--color-accent-bg)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, color: 'var(--color-text-primary)' }}>
          💡 每月多還試算
        </h3>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 20 }}>
          若每個月固定多還一筆，能提前幾年結清？
        </p>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="calc-label" style={{ marginBottom: 8, display: 'block' }}>每月額外多還</label>
            <input
              type="range"
              min={1000}
              max={30000}
              step={1000}
              value={extraMonthly}
              onChange={(e) => setExtraMonthly(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              <span>$1,000</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>NT$ {fmt(extraMonthly)}</span>
              <span>$30,000</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div className="result-label" style={{ marginBottom: 4 }}>提前結清</div>
              <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--color-accent)' }}>
                {result.extraShortenYears >= 0.1
                  ? `${result.extraShortenYears.toFixed(1)} 年`
                  : '< 0.1 年'}
              </div>
            </div>
            <div>
              <div className="result-label" style={{ marginBottom: 4 }}>節省利息</div>
              <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--color-accent)' }}>
                {result.extraSaved > 0 ? fmtWan(result.extraSaved) : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

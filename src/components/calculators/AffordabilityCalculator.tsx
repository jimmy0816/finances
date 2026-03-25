import { useState, useMemo } from 'react';

/* ── Helpers ── */
const fmt = (n: number) =>
  new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(n);

const fmtWan = (n: number) => {
  const wan = n / 10000;
  if (wan >= 10000) return `${(wan / 10000).toFixed(1)} 億`;
  return `${wan.toFixed(1)} 萬`;
};

/* ── Max loan from monthly payment ── */
function maxLoanFromMonthly(M: number, r: number, n: number): number {
  if (r === 0) return M * n;
  // M = P * r * (1+r)^n / ((1+r)^n - 1) → P = M * ((1+r)^n - 1) / (r * (1+r)^n)
  const factor = (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n));
  return M * factor;
}

type SafeLevel = 'safe' | 'caution' | 'danger';

interface AffordResult {
  availableMonthly: number;     // (income - expenses) * ratio
  maxLoan: number;              // reverse calculation
  maxHousePrice: number;        // maxLoan + downpayment
  monthlyPayment: number;       // verify: should equal availableMonthly
  debtRatio: number;            // monthly_payment / income
  safeLevel: SafeLevel;
  totalInterest: number;
}

function calcAffordability(
  monthlyIncome: number,
  monthlyExpenses: number,
  downpayWan: number,
  loanYears: number,
  annualRate: number,
  maxRatio: number,   // 0–1, e.g. 0.33
): AffordResult {
  const r = annualRate / 12 / 100;
  const n = loanYears * 12;
  const downpay = downpayWan * 10000;

  const netIncome = monthlyIncome - monthlyExpenses;
  const availableMonthly = Math.max(0, netIncome * maxRatio);

  const maxLoan = availableMonthly > 0 ? maxLoanFromMonthly(availableMonthly, r, n) : 0;
  const maxHousePrice = maxLoan + downpay;

  const debtRatio = monthlyIncome > 0 ? availableMonthly / monthlyIncome : 0;
  let safeLevel: SafeLevel = 'safe';
  if (debtRatio >= 0.4) safeLevel = 'danger';
  else if (debtRatio >= 0.3) safeLevel = 'caution';

  const totalInterest = availableMonthly * n - maxLoan;

  return {
    availableMonthly,
    maxLoan,
    maxHousePrice,
    monthlyPayment: availableMonthly,
    debtRatio,
    safeLevel,
    totalInterest: Math.max(0, totalInterest),
  };
}

const safeConfig: Record<SafeLevel, { label: string; icon: string; color: string; bg: string }> = {
  safe: { label: '安全範圍', icon: '🟢', color: '#2D6A4F', bg: '#E8F5EE' },
  caution: { label: '建議注意', icon: '🟡', color: '#B45309', bg: '#FEF3C7' },
  danger: { label: '壓力過高', icon: '🔴', color: '#991B1B', bg: '#FEE2E2' },
};

/* ── Component ── */
export default function AffordabilityCalculator() {
  const [monthlyIncome, setMonthlyIncome] = useState(100000);
  const [monthlyExpenses, setMonthlyExpenses] = useState(30000);
  const [downpayWan, setDownpayWan] = useState(300);
  const [loanYears, setLoanYears] = useState(30);
  const [annualRate, setAnnualRate] = useState(2.1);
  const [maxRatio, setMaxRatio] = useState(33); // percent

  const result = useMemo(
    () => calcAffordability(monthlyIncome, monthlyExpenses, downpayWan, loanYears, annualRate, maxRatio / 100),
    [monthlyIncome, monthlyExpenses, downpayWan, loanYears, annualRate, maxRatio],
  );

  const safe = safeConfig[result.safeLevel];

  const ltvRatio = result.maxLoan > 0 && result.maxHousePrice > 0
    ? (result.maxLoan / result.maxHousePrice * 100).toFixed(1)
    : '0';

  return (
    <div className="calc-container" style={{ maxWidth: '100%' }}>
      {/* Header */}
      <div className="calc-header">
        <h2 style={{ fontWeight: 400 }}>🏠 購屋能力評估</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 300 }}>
          根據你的收入與支出，計算可以負擔多少總價的房子
        </p>
      </div>

      {/* Body */}
      <div className="calc-body">
        {/* ── Inputs ── */}
        <div className="calc-inputs">
          {/* 家庭月收入 */}
          <div className="calc-field">
            <label className="calc-label">家庭月收入</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>NT$</span>
              <input
                type="number"
                className="calc-input"
                value={monthlyIncome}
                min={20000}
                max={1000000}
                step={5000}
                onChange={(e) => setMonthlyIncome(Number(e.target.value))}
                style={{ flex: 1 }}
              />
            </div>
            <input
              type="range"
              min={20000}
              max={500000}
              step={5000}
              value={monthlyIncome}
              onChange={(e) => setMonthlyIncome(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>2萬</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>月收 {fmtWan(monthlyIncome)}</span>
              <span>50萬</span>
            </div>
          </div>

          {/* 每月固定支出 */}
          <div className="calc-field">
            <label className="calc-label">每月固定支出（不含房貸）</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>NT$</span>
              <input
                type="number"
                className="calc-input"
                value={monthlyExpenses}
                min={0}
                max={monthlyIncome}
                step={1000}
                onChange={(e) => setMonthlyExpenses(Number(e.target.value))}
                style={{ flex: 1 }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={Math.min(monthlyIncome, 200000)}
              step={1000}
              value={monthlyExpenses}
              onChange={(e) => setMonthlyExpenses(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>0</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>支出 NT$ {fmt(monthlyExpenses)}</span>
              <span>{fmtWan(Math.min(monthlyIncome, 200000))}</span>
            </div>
          </div>

          {/* 自備款 */}
          <div className="calc-field">
            <label className="calc-label">自備款金額</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={downpayWan}
                min={0}
                max={5000}
                step={50}
                onChange={(e) => setDownpayWan(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>萬元</span>
            </div>
            <input
              type="range"
              min={0}
              max={3000}
              step={50}
              value={downpayWan}
              onChange={(e) => setDownpayWan(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>0萬</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>自備 {fmt(downpayWan)} 萬</span>
              <span>3000萬</span>
            </div>
          </div>

          {/* 貸款年期 */}
          <div className="calc-field">
            <label className="calc-label">期望貸款年期</label>
            <select
              className="calc-select"
              value={loanYears}
              onChange={(e) => setLoanYears(Number(e.target.value))}
            >
              {[20, 25, 30, 40].map((y) => (
                <option key={y} value={y}>{y} 年</option>
              ))}
            </select>
          </div>

          {/* 年利率 */}
          <div className="calc-field">
            <label className="calc-label">預估年利率</label>
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
              max={6}
              step={0.05}
              value={annualRate}
              onChange={(e) => setAnnualRate(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>0.5%</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{annualRate.toFixed(2)}%</span>
              <span>6%</span>
            </div>
          </div>

          {/* 月還款上限比例 */}
          <div className="calc-field">
            <label className="calc-label">月還款佔收入上限比例</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={maxRatio}
                min={10}
                max={60}
                step={1}
                onChange={(e) => setMaxRatio(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>%</span>
            </div>
            <input
              type="range"
              min={10}
              max={60}
              step={1}
              value={maxRatio}
              onChange={(e) => setMaxRatio(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>10%</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{maxRatio}%（建議 33%）</span>
              <span>60%</span>
            </div>
          </div>
        </div>

        {/* ── Results ── */}
        <div className="calc-results">
          {/* Big number */}
          <div style={{ marginBottom: 20 }}>
            <div className="result-label">你可以負擔約</div>
            <div className="result-big">
              {result.maxHousePrice > 0 ? fmtWan(result.maxHousePrice) : '—'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>的房子</div>
          </div>

          {/* Safety indicator */}
          <div
            style={{
              background: safe.bg,
              border: `0.5px solid ${safe.color}`,
              borderRadius: 4,
              padding: '10px 14px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 20 }}>{safe.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: safe.color }}>{safe.label}</div>
              <div style={{ fontSize: 11, color: safe.color, opacity: 0.8, marginTop: 2 }}>
                {result.safeLevel === 'safe' && '還款負擔合理，財務壓力可控'}
                {result.safeLevel === 'caution' && '接近上限，建議保留緩衝空間'}
                {result.safeLevel === 'danger' && '負擔過重，建議重新評估購屋條件'}
              </div>
            </div>
          </div>

          {/* Summary rows */}
          <div style={{ borderTop: '0.5px solid var(--color-border)', paddingTop: 16 }}>
            <div className="result-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>建議最大貸款</span>
              <span style={{ fontWeight: 500 }}>{result.maxLoan > 0 ? fmtWan(result.maxLoan) : '—'}</span>
            </div>
            <div className="result-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>每月房貸還款</span>
              <span style={{ fontWeight: 500, color: 'var(--color-accent)' }}>
                {result.monthlyPayment > 0 ? `NT$ ${fmt(Math.round(result.monthlyPayment))}` : '—'}
              </span>
            </div>
            <div className="result-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>還款佔月收入</span>
              <span
                style={{
                  fontWeight: 500,
                  color: result.safeLevel === 'safe' ? '#2D6A4F' : result.safeLevel === 'caution' ? '#B45309' : '#991B1B',
                }}
              >
                {(result.debtRatio * 100).toFixed(1)}%
              </span>
            </div>
            <div className="result-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>自備款 / 總價</span>
              <span>{downpayWan} 萬 / {result.maxHousePrice > 0 ? fmtWan(result.maxHousePrice) : '—'}</span>
            </div>
            <div className="result-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>貸款成數（LTV）</span>
              <span>{ltvRatio}%</span>
            </div>
            <div className="result-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>預估總利息支出</span>
              <span style={{ color: 'var(--color-warning)' }}>
                {result.totalInterest > 0 ? fmtWan(result.totalInterest) : '—'}
              </span>
            </div>
          </div>

          {/* Income breakdown bar */}
          {monthlyIncome > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                月收入分配示意
              </div>
              <div style={{ height: 12, background: '#E8DDD0', borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
                {/* Expenses */}
                <div
                  title={`固定支出 ${((monthlyExpenses / monthlyIncome) * 100).toFixed(0)}%`}
                  style={{
                    width: `${Math.min(100, (monthlyExpenses / monthlyIncome) * 100)}%`,
                    background: '#D8CDBE',
                    transition: 'width 300ms ease',
                  }}
                />
                {/* Mortgage */}
                <div
                  title={`房貸 ${(result.debtRatio * 100).toFixed(0)}%`}
                  style={{
                    width: `${Math.min(100 - (monthlyExpenses / monthlyIncome) * 100, result.debtRatio * 100)}%`,
                    background: 'var(--color-accent)',
                    transition: 'width 300ms ease',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 11, color: 'var(--color-text-muted)' }}>
                <span>■ 固定支出 {((monthlyExpenses / monthlyIncome) * 100).toFixed(0)}%</span>
                <span style={{ color: 'var(--color-accent)' }}>■ 房貸 {(result.debtRatio * 100).toFixed(0)}%</span>
                <span>■ 剩餘 {Math.max(0, 100 - ((monthlyExpenses / monthlyIncome) * 100) - (result.debtRatio * 100)).toFixed(0)}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 安全指標說明 ── */}
      <div style={{ padding: '24px 32px 32px', borderTop: '0.5px solid var(--color-border)', background: 'var(--color-bg)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 16, color: 'var(--color-text-primary)' }}>
          📌 還款負擔安全指標
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { icon: '🟢', range: '< 30%', label: '安全', desc: '財務彈性高，建議區間', color: '#2D6A4F', bg: '#E8F5EE' },
            { icon: '🟡', range: '30–40%', label: '注意', desc: '尚可接受，需保留備用金', color: '#B45309', bg: '#FEF3C7' },
            { icon: '🔴', range: '> 40%', label: '危險', desc: '壓力過大，風險偏高', color: '#991B1B', bg: '#FEE2E2' },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: item.bg,
                border: `0.5px solid ${item.color}`,
                borderRadius: 4,
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 6 }}>{item.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: item.color, marginBottom: 2 }}>
                {item.range} — {item.label}
              </div>
              <div style={{ fontSize: 11, color: item.color, opacity: 0.8 }}>{item.desc}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 16, lineHeight: 1.7 }}>
          * 上述比例為月還款金額佔家庭月收入比例。銀行通常以「月付 ÷ 月收入 ≤ 40%」為授貸上限。建議自行預留緩衝，以 30–33% 為目標較為穩健。
        </p>
      </div>
    </div>
  );
}

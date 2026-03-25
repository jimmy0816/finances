import { useState, useMemo } from 'react';

/* ─── Helpers ─── */
const fmt = (n: number) =>
  new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(n);

const fmtCurrency = (n: number) => `NT$ ${fmt(n)}`;

const fmtWan = (n: number) => {
  const wan = n / 10000;
  if (wan >= 10000) return `${(wan / 10000).toFixed(1)} 億`;
  if (wan >= 1) return `${wan.toFixed(1)} 萬`;
  return fmt(n);
};

/**
 * 勞退新制累積試算
 * 每月提繳: salary × (employerRate + selfRate)
 * 使用複利終值公式: FV = PMT × [(1+r)^n - 1] / r
 */
function calcLaborPension(
  monthlySalary: number,
  employerRate: number,  // 0.06 雇主6%
  selfRate: number,      // 0~0.06 自提
  annualReturn: number,  // 預期投報率 %
  yearsToRetire: number,
  retirementAge: number,
) {
  const monthlyContribution = monthlySalary * (employerRate + selfRate);
  const employerContrib = monthlySalary * employerRate;
  const selfContrib = monthlySalary * selfRate;

  const r = annualReturn / 100 / 12; // 月利率
  const n = yearsToRetire * 12;

  let totalAccumulated: number;
  if (r === 0) {
    totalAccumulated = monthlyContribution * n;
  } else {
    totalAccumulated = monthlyContribution * ((Math.pow(1 + r, n) - 1) / r);
  }

  const totalContributed = monthlyContribution * n;
  const investmentGain = totalAccumulated - totalContributed;

  // 月領試算：分20年(240個月) 或依退休年齡
  // 勞退新制以生命表計算，一般用 "期望餘命" 對應到 annuity factor
  // 退休年齡 60 → 餘命 22年 → 264個月
  // 退休年齡 65 → 餘命 19年 → 228個月
  const lifeExpectancy = retirementAge <= 55 ? 30 : retirementAge <= 60 ? 25 : retirementAge <= 65 ? 20 : 15;
  const annuityMonths = lifeExpectancy * 12;
  const monthlyBenefit = totalAccumulated / annuityMonths;

  // 累積投報率
  const totalReturnRate = totalContributed > 0 ? (investmentGain / totalContributed) * 100 : 0;

  return {
    monthlyContribution,
    employerContrib,
    selfContrib,
    totalAccumulated,
    totalContributed,
    investmentGain,
    monthlyBenefit,
    totalReturnRate,
    annuityMonths,
    lifeExpectancy,
  };
}

/* ─── Component ─── */
export default function LaborPensionCalculator() {
  const [monthlySalary, setMonthlySalary] = useState(50000);
  const [selfRate, setSelfRate] = useState(0);   // 0-6%
  const [annualReturn, setAnnualReturn] = useState(3.0); // %
  const [yearsToRetire, setYearsToRetire] = useState(30);
  const [retirementAge, setRetirementAge] = useState(65);

  const EMPLOYER_RATE = 0.06;

  const result = useMemo(
    () => calcLaborPension(monthlySalary, EMPLOYER_RATE, selfRate / 100, annualReturn, yearsToRetire, retirementAge),
    [monthlySalary, selfRate, annualReturn, yearsToRetire, retirementAge],
  );

  return (
    <div className="calc-container" style={{ maxWidth: '100%' }}>
      {/* Header */}
      <div className="calc-header">
        <h2 style={{ fontWeight: 400 }}>💼 勞退新制退休金試算</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 300 }}>
          試算雇主提繳 6% + 自提比例，預估退休時累積金額與每月可領金額
        </p>
      </div>

      <div className="calc-body">
        {/* ── Inputs ── */}
        <div className="calc-inputs">
          {/* 月薪 */}
          <div className="calc-field">
            <label className="calc-label">每月薪資</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={monthlySalary}
                min={29500}
                max={200000}
                step={1000}
                onChange={(e) => setMonthlySalary(Math.max(29500, Number(e.target.value)))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>元/月</span>
            </div>
            <input
              type="range"
              min={29500}
              max={200000}
              step={500}
              value={monthlySalary}
              onChange={(e) => setMonthlySalary(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>29,500</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{fmt(monthlySalary)} 元</span>
              <span>200,000</span>
            </div>
          </div>

          {/* 自提比例 */}
          <div className="calc-field">
            <label className="calc-label">
              勞退自提比例
              <span style={{ fontSize: 11, color: 'var(--color-accent)', marginLeft: 8 }}>
                （自提享所得稅減除優惠）
              </span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={selfRate}
                min={0}
                max={6}
                step={0.5}
                onChange={(e) => setSelfRate(Math.min(6, Math.max(0, Number(e.target.value))))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>%</span>
            </div>
            <input
              type="range"
              min={0}
              max={6}
              step={0.5}
              value={selfRate}
              onChange={(e) => setSelfRate(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>不自提</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{selfRate}%（每月 {fmt(Math.round(monthlySalary * selfRate / 100))} 元）</span>
              <span>6%（上限）</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: 'var(--color-text-muted)', background: 'var(--color-accent-bg)', padding: '8px 10px', borderRadius: 4 }}>
              <span>💡</span>
              <span>雇主強制提繳 <strong>6%</strong>（{fmt(Math.round(monthlySalary * 0.06))} 元/月），自提部分可抵減個人綜合所得稅</span>
            </div>
          </div>

          {/* 預期投報率 */}
          <div className="calc-field">
            <label className="calc-label">預期年投報率</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={annualReturn}
                min={0}
                max={12}
                step={0.1}
                onChange={(e) => setAnnualReturn(Math.min(12, Math.max(0, Number(e.target.value))))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>%</span>
            </div>
            <input
              type="range"
              min={0}
              max={12}
              step={0.1}
              value={annualReturn}
              onChange={(e) => setAnnualReturn(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>0%</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{annualReturn.toFixed(1)}%</span>
              <span>12%</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              勞退基金近10年平均年報酬約 3-4%；個人投資參考值 6-8%
            </p>
          </div>

          {/* 距退休年數 */}
          <div className="calc-field">
            <label className="calc-label">距退休年數</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={yearsToRetire}
                min={1}
                max={45}
                step={1}
                onChange={(e) => setYearsToRetire(Math.min(45, Math.max(1, Number(e.target.value))))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>年</span>
            </div>
            <input
              type="range"
              min={1}
              max={45}
              step={1}
              value={yearsToRetire}
              onChange={(e) => setYearsToRetire(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>1年</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{yearsToRetire} 年</span>
              <span>45年</span>
            </div>
          </div>

          {/* 退休年齡 */}
          <div className="calc-field">
            <label className="calc-label">預計退休年齡</label>
            <select
              className="calc-select"
              value={retirementAge}
              onChange={(e) => setRetirementAge(Number(e.target.value))}
            >
              {[50, 55, 60, 65, 67, 70].map((a) => (
                <option key={a} value={a}>{a} 歲</option>
              ))}
            </select>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              勞退新制最早請領年齡為 60 歲；影響月領計算的預估餘命
            </p>
          </div>
        </div>

        {/* ── Results ── */}
        <div className="calc-results">
          <div className="result-header">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
              試算結果
            </span>
          </div>

          {/* 每月提繳 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div className="result-card">
              <div className="result-card-label">雇主每月提繳</div>
              <div className="result-card-value">{fmtCurrency(Math.round(result.employerContrib))}</div>
              <div className="result-card-desc">薪資 × 6%</div>
            </div>
            <div className="result-card">
              <div className="result-card-label">自提金額</div>
              <div className="result-card-value">{fmtCurrency(Math.round(result.selfContrib))}</div>
              <div className="result-card-desc">薪資 × {selfRate}%</div>
            </div>
          </div>

          {/* 主結果 */}
          <div className="result-primary">
            <div className="result-label">退休累積總額（{yearsToRetire}年後）</div>
            <div className="result-value">{fmtWan(result.totalAccumulated)}</div>
            <div className="result-sublabel">年投報 {annualReturn}% 複利計算</div>
          </div>

          {/* 每月可領 */}
          <div style={{ marginTop: 16, padding: '16px', background: 'var(--color-accent-bg)', borderRadius: 4, border: '0.5px solid var(--color-accent)' }}>
            <div style={{ fontSize: 12, color: 'var(--color-accent)', marginBottom: 4, fontFamily: 'var(--font-mono)', letterSpacing: '1px', textTransform: 'uppercase' }}>月領金額試算</div>
            <div style={{ fontSize: 28, fontWeight: 300, color: 'var(--color-text-primary)' }}>
              {fmtCurrency(Math.round(result.monthlyBenefit))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              以退休年齡 {retirementAge} 歲、預估餘命 {result.lifeExpectancy} 年（{result.annuityMonths} 個月）計算
            </div>
          </div>

          {/* 明細 */}
          <div style={{ marginTop: 16 }}>
            {[
              { label: '每月總提繳（雇主+自提）', value: fmtCurrency(Math.round(result.monthlyContribution)) },
              { label: `${yearsToRetire}年總提繳本金`, value: fmtCurrency(Math.round(result.totalContributed)) },
              { label: '投資報酬（複利增值）', value: fmtCurrency(Math.round(result.investmentGain)) },
              { label: '總報酬率', value: `${result.totalReturnRate.toFixed(1)}%` },
            ].map((row) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid var(--color-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{row.label}</span>
                <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{row.value}</span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 20, lineHeight: 1.6 }}>
            ⚠️ 本試算採等薪複利計算（不含薪資成長）。實際勞退金額以勞動部勞退基金管理局個人帳戶餘額為準。月領金額係依預估餘命估算，非官方給付保證數字。
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { laborInsuranceT, type CalcLocale } from '../../i18n/calcTranslations';

/* ─── Helpers ─── */
const fmt = (n: number) =>
  new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(n);

const fmtCurrency = (n: number) => `NT$ ${fmt(n)}`;

/* ─── 2026 勞保投保薪資上限 ─── */
const LABOR_INS_MAX_SALARY = 45800; // 普通事故最高投保薪資

/**
 * 勞保老年年金 月領
 * A式: 平均月投保薪資 × 年資 × 0.775% + 3,000
 * B式: 平均月投保薪資 × 年資 × 1.55%
 * 取較高者，上限不得超過平均月投保薪資 × 1.55% × 年資
 */
function calcMonthlyPension(avgSalary: number, years: number): { a: number; b: number; monthly: number } {
  const cappedSalary = Math.min(avgSalary, LABOR_INS_MAX_SALARY);
  const a = cappedSalary * years * 0.00775 + 3000;
  const b = cappedSalary * years * 0.0155;
  const monthly = Math.max(a, b);
  return { a, b, monthly };
}

/**
 * 勞保老年一次給付
 * 年資 1-15年: 每年1個月
 * 年資 16-30年: 超過15年部分每年2個月
 * 年資 31年以上: 超過30年部分每年3個月
 */
function calcLumpSum(avgSalary: number, years: number): number {
  const cappedSalary = Math.min(avgSalary, LABOR_INS_MAX_SALARY);
  let months = 0;
  if (years <= 15) {
    months = years;
  } else if (years <= 30) {
    months = 15 + (years - 15) * 2;
  } else {
    months = 15 + 15 * 2 + (years - 30) * 3;
  }
  return cappedSalary * months;
}

/* ─── Component ─── */
export default function LaborInsurancePensionCalculator({ locale = 'zh-TW' }: { locale?: string }) {
  const tr = laborInsuranceT[(locale as CalcLocale)] ?? laborInsuranceT['zh-TW'];
  const [avgSalary, setAvgSalary] = useState(40000);
  const [years, setYears] = useState(25);
  const [mode, setMode] = useState<'monthly' | 'lump'>('monthly');

  const result = useMemo(() => {
    const pension = calcMonthlyPension(avgSalary, years);
    const lumpSum = calcLumpSum(avgSalary, years);
    // Breakeven: months until monthly pension > lump sum
    const breakeven = pension.monthly > 0 ? Math.ceil(lumpSum / pension.monthly) : 0;
    return { ...pension, lumpSum, breakeven };
  }, [avgSalary, years]);

  /* ── Validation ── */
  const minYears = 15;
  const yearsOk = years >= minYears;

  return (
    <div className="calc-container" style={{ maxWidth: '100%' }}>
      {/* Header */}
      <div className="calc-header">
        <h2 style={{ fontWeight: 400 }}>{tr.header}</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 300 }}>
          {tr.note}
        </p>
        {locale !== 'zh-TW' && (
          <p style={{ fontSize: 11, color: 'var(--color-warning)', marginTop: 4 }}>{tr.laborLawNote}</p>
        )}
      </div>

      <div className="calc-body">
        {/* ── Inputs ── */}
        <div className="calc-inputs">
          {/* Average Salary */}
          <div className="calc-field">
            <label className="calc-label">{tr.avgSalary}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={avgSalary}
                min={29500}
                max={45800}
                step={100}
                onChange={(e) => setAvgSalary(Math.min(45800, Math.max(29500, Number(e.target.value))))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>元/月</span>
            </div>
            <input
              type="range"
              min={29500}
              max={45800}
              step={100}
              value={avgSalary}
              onChange={(e) => setAvgSalary(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>29,500</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{fmt(avgSalary)} 元</span>
              <span>45,800（上限）</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
              {tr.salaryHint}
            </p>
          </div>

          {/* Years */}
          <div className="calc-field">
            <label className="calc-label">{tr.years}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={years}
                min={1}
                max={45}
                step={1}
                onChange={(e) => setYears(Math.min(45, Math.max(1, Number(e.target.value))))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>年</span>
            </div>
            <input
              type="range"
              min={1}
              max={45}
              step={1}
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>1年</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{years} 年</span>
              <span>45年</span>
            </div>
            {!yearsOk && (
              <p style={{ fontSize: 11, color: 'var(--color-warning)', marginTop: 6 }}>
                ⚠️ 月領老年年金最低年資為 15 年，年資不足者僅能申請一次給付
              </p>
            )}
          </div>

          {/* Mode */}
          <div className="calc-field">
            <label className="calc-label">{tr.modeLabel}</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              {[
                {
                  value: 'monthly',
                  label: tr.modeMonthly,
                  desc: locale === 'en' ? 'Monthly for life; requires 15+ years of coverage' : locale === 'ja' ? '終身月額受取；15年以上の加入が必要' : '每月固定領取，活越久領越多；需年資滿15年',
                },
                {
                  value: 'lump',
                  label: tr.modeLump,
                  desc: locale === 'en' ? 'One-time payout; required if coverage < 15 years' : locale === 'ja' ? '一括受取；15年未満の場合はこちらのみ' : '一次領回全部金額；年資未滿15年只能選此項',
                },
              ].map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 12px',
                    border: `0.5px solid ${mode === opt.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    background: mode === opt.value ? 'var(--color-accent-bg)' : 'var(--color-bg-card)',
                    cursor: 'pointer',
                    transition: 'all 120ms',
                    borderRadius: 4,
                  }}
                >
                  <input
                    type="radio"
                    name="pension-mode"
                    value={opt.value}
                    checked={mode === opt.value}
                    onChange={() => setMode(opt.value as 'monthly' | 'lump')}
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
        </div>

        {/* ── Results ── */}
        <div className="calc-results">
          <div className="result-header">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
              試算結果
            </span>
          </div>

          {mode === 'monthly' ? (
            <>
              {!yearsOk && (
                <div style={{ padding: '16px', background: 'var(--color-warning-bg, #FEF3C7)', borderRadius: 4, marginBottom: 16, fontSize: 13, color: '#92400E' }}>
                  年資未滿 15 年，僅能申請老年一次給付，無法月領年金。
                </div>
              )}
              {/* 主要結果 */}
              <div className="result-primary">
                <div className="result-label">{tr.monthlyResult} {tr.takeHigher}</div>
                <div className="result-value">{fmtCurrency(Math.round(result.monthly))}</div>
                <div className="result-sublabel">/ 月，終身領取</div>
              </div>

              {/* A/B式明細 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                <div
                  className="result-card"
                  style={{
                    border: `1px solid ${result.a >= result.b ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    background: result.a >= result.b ? 'var(--color-accent-bg)' : undefined,
                  }}
                >
                  <div className="result-card-label">
                    {tr.aFormula} {result.a >= result.b && <span style={{ color: 'var(--color-accent)', marginLeft: 4 }}>✓</span>}
                  </div>
                  <div className="result-card-value">{fmtCurrency(Math.round(result.a))}</div>
                  <div className="result-card-desc">× {years}{tr.yearUnit} × 0.775% + 3,000</div>
                </div>
                <div
                  className="result-card"
                  style={{
                    border: `1px solid ${result.b > result.a ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    background: result.b > result.a ? 'var(--color-accent-bg)' : undefined,
                  }}
                >
                  <div className="result-card-label">
                    {tr.bFormula} {result.b > result.a && <span style={{ color: 'var(--color-accent)', marginLeft: 4 }}>✓</span>}
                  </div>
                  <div className="result-card-value">{fmtCurrency(Math.round(result.b))}</div>
                  <div className="result-card-desc">× {years}{tr.yearUnit} × 1.55%</div>
                </div>
              </div>

              {/* vs 一次領比較 */}
              <div style={{ marginTop: 24, padding: '16px', background: 'var(--color-bg)', borderRadius: 4, border: '0.5px solid var(--color-border)' }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>{tr.breakeven}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13 }}>{tr.lumpResult}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--color-text-primary)' }}>{fmtCurrency(result.lumpSum)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <span style={{ fontSize: 13 }}>{tr.breakeven}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--color-accent)' }}>
                    {result.breakeven > 0 ? tr.breakevenDesc(result.breakeven) : '—'}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="result-primary">
                <div className="result-label">{tr.lumpResult}</div>
                <div className="result-value">{fmtCurrency(result.lumpSum)}</div>
                <div className="result-sublabel">退休時一次領回</div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid var(--color-border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>平均月投保薪資</span>
                  <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>{fmtCurrency(Math.min(avgSalary, LABOR_INS_MAX_SALARY))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid var(--color-border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>給付月數</span>
                  <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>
                    {years <= 15 ? years : years <= 30 ? `15 + ${(years - 15) * 2} = ${15 + (years - 15) * 2}` : `15 + 30 + ${(years - 30) * 3} = ${15 + 30 + (years - 30) * 3}`} 個月
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>年資計算方式</span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>前15年×1 / 16-30年×2 / 31年+×3</span>
                </div>
              </div>

              {/* 若選月領可領多少 */}
              {yearsOk && (
                <div style={{ marginTop: 16, padding: '16px', background: 'var(--color-bg)', borderRadius: 4, border: '0.5px solid var(--color-border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>若改選月領</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13 }}>每月可領（B式）</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--color-accent)' }}>{fmtCurrency(Math.round(result.monthly))}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <span style={{ fontSize: 13 }}>超過一次給付所需月數</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>{result.breakeven} 個月</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Disclaimer */}
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 20, lineHeight: 1.6 }}>
            {locale === 'zh-TW' ? '⚠️ 本試算僅供參考，以勞保局公告為準。實際給付依申請時條件計算，加保年資以勞保局紀錄為準。' : tr.laborLawNote}
          </p>
        </div>
      </div>
    </div>
  );
}

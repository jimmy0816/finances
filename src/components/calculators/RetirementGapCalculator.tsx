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
 * 退休金缺口計算
 * 
 * 1. 總需求 = 月生活費 × 12 × 退休年數 × 通膨修正
 *    （使用現值法：以 3% 通膨、預期投資報酬率折現）
 * 2. 預計來源 = 勞保月領 × 月數 + 勞退累積
 * 3. 缺口 = 總需求 - 預計來源
 * 4. 每月需存 = 缺口 / 剩餘工作月數（FV公式反推）
 */
function calcRetirementGap(
  currentAge: number,
  retireAge: number,
  lifeExpectancy: number,
  monthlyExpense: number,    // 退休後每月花費（今日幣值）
  monthlyPension: number,    // 預計每月勞保 + 勞退
  currentSavings: number,    // 目前已存積蓄
  inflationRate: number,     // 年通膨 %
  returnRate: number,        // 資金年投報 %
) {
  const yearsToRetire = Math.max(0, retireAge - currentAge);
  const retirementYears = Math.max(0, lifeExpectancy - retireAge);
  const retirementMonths = retirementYears * 12;
  const workingMonths = yearsToRetire * 12;

  // 退休第一年月生活費（通膨調整）
  const firstYearMonthlyExpense = monthlyExpense * Math.pow(1 + inflationRate / 100, yearsToRetire);

  // 退休總需求（考慮通膨的現值法，使用年金現值）
  // 簡化：實質報酬率 = (1 + return) / (1 + inflation) - 1
  const realReturn = (1 + returnRate / 100) / (1 + inflationRate / 100) - 1;
  const realMonthlyReturn = realReturn / 12;

  let totalNeed: number;
  if (Math.abs(realMonthlyReturn) < 0.0001) {
    totalNeed = firstYearMonthlyExpense * retirementMonths;
  } else {
    // PV of annuity: PMT × [1 - (1+r)^-n] / r
    totalNeed = firstYearMonthlyExpense * (1 - Math.pow(1 + realMonthlyReturn, -retirementMonths)) / realMonthlyReturn;
  }

  // 退休資金來源
  // 1. 已有積蓄的未來值
  const savingsFV = currentSavings * Math.pow(1 + returnRate / 100, yearsToRetire);
  // 2. 政府退休金（勞保+勞退）現值（已在退休時折算）
  const pensionPV = monthlyPension * retirementMonths;

  // 缺口
  const gap = Math.max(0, totalNeed - savingsFV - pensionPV);

  // 每月需額外儲蓄（以 return rate 計算 FV）
  const monthlyReturn = returnRate / 100 / 12;
  let monthlyRequired = 0;
  if (gap > 0 && workingMonths > 0) {
    if (monthlyReturn === 0) {
      monthlyRequired = gap / workingMonths;
    } else {
      monthlyRequired = gap * monthlyReturn / (Math.pow(1 + monthlyReturn, workingMonths) - 1);
    }
  }

  // 4% 法則需求（簡單參考）
  const rule4pct = firstYearMonthlyExpense * 12 / 0.04;

  return {
    yearsToRetire,
    retirementYears,
    retirementMonths,
    firstYearMonthlyExpense,
    totalNeed,
    savingsFV,
    pensionPV,
    gap,
    monthlyRequired,
    rule4pct,
    totalAvailable: savingsFV + pensionPV,
    gapPercent: totalNeed > 0 ? (gap / totalNeed) * 100 : 0,
  };
}

/* ─── Component ─── */
export default function RetirementGapCalculator() {
  const [currentAge, setCurrentAge] = useState(35);
  const [retireAge, setRetireAge] = useState(65);
  const [lifeExpectancy, setLifeExpectancy] = useState(85);
  const [monthlyExpense, setMonthlyExpense] = useState(40000);
  const [monthlyPension, setMonthlyPension] = useState(20000);
  const [currentSavings, setCurrentSavings] = useState(500000);
  const [inflationRate, setInflationRate] = useState(2.0);
  const [returnRate, setReturnRate] = useState(5.0);

  const result = useMemo(
    () =>
      calcRetirementGap(
        currentAge, retireAge, lifeExpectancy, monthlyExpense,
        monthlyPension, currentSavings, inflationRate, returnRate,
      ),
    [currentAge, retireAge, lifeExpectancy, monthlyExpense, monthlyPension, currentSavings, inflationRate, returnRate],
  );

  const gapColor =
    result.gap <= 0 ? '#059669' : result.gapPercent > 50 ? '#DC2626' : '#D97706';

  return (
    <div className="calc-container" style={{ maxWidth: '100%' }}>
      {/* Header */}
      <div className="calc-header">
        <h2 style={{ fontWeight: 400 }}>📊 退休金缺口計算</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 300 }}>
          設定退休目標與生活費，計算退休資金需求與每月需儲蓄金額
        </p>
      </div>

      <div className="calc-body">
        {/* ── Inputs ── */}
        <div className="calc-inputs">
          {/* 年齡 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="calc-field">
              <label className="calc-label">目前年齡</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  className="calc-input"
                  value={currentAge}
                  min={20}
                  max={70}
                  onChange={(e) => setCurrentAge(Math.min(70, Math.max(20, Number(e.target.value))))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>歲</span>
              </div>
            </div>
            <div className="calc-field">
              <label className="calc-label">預計退休年齡</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  className="calc-input"
                  value={retireAge}
                  min={currentAge + 1}
                  max={75}
                  onChange={(e) => setRetireAge(Math.min(75, Math.max(currentAge + 1, Number(e.target.value))))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>歲</span>
              </div>
            </div>
          </div>

          {/* 預期壽命 */}
          <div className="calc-field">
            <label className="calc-label">預期壽命</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={lifeExpectancy}
                min={retireAge + 1}
                max={105}
                onChange={(e) => setLifeExpectancy(Math.min(105, Math.max(retireAge + 1, Number(e.target.value))))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>歲</span>
            </div>
            <input
              type="range"
              min={retireAge + 1}
              max={105}
              step={1}
              value={lifeExpectancy}
              onChange={(e) => setLifeExpectancy(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>{retireAge + 1}歲</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{lifeExpectancy} 歲（退休 {result.retirementYears} 年）</span>
              <span>105歲</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              2024 台灣平均壽命：男性 77.4 歲、女性 83.7 歲
            </p>
          </div>

          {/* 退休月花費 */}
          <div className="calc-field">
            <label className="calc-label">退休後每月生活費（今日幣值）</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={monthlyExpense}
                min={10000}
                max={300000}
                step={1000}
                onChange={(e) => setMonthlyExpense(Math.max(10000, Number(e.target.value)))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>元/月</span>
            </div>
            <input
              type="range"
              min={10000}
              max={200000}
              step={1000}
              value={monthlyExpense}
              onChange={(e) => setMonthlyExpense(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>1萬</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{fmt(monthlyExpense)} 元/月</span>
              <span>20萬</span>
            </div>
            {result.yearsToRetire > 0 && (
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                通膨調整後，退休時月花費約 {fmtCurrency(Math.round(result.firstYearMonthlyExpense))}
              </p>
            )}
          </div>

          {/* 預計退休金來源 */}
          <div className="calc-field">
            <label className="calc-label">預計每月退休金（勞保+勞退，今日估算）</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={monthlyPension}
                min={0}
                max={100000}
                step={1000}
                onChange={(e) => setMonthlyPension(Math.max(0, Number(e.target.value)))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>元/月</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
              可用上方兩個計算器估算勞保月領 + 勞退月領後填入
            </p>
          </div>

          {/* 目前積蓄 */}
          <div className="calc-field">
            <label className="calc-label">目前已有積蓄</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={currentSavings}
                min={0}
                max={10000000}
                step={10000}
                onChange={(e) => setCurrentSavings(Math.max(0, Number(e.target.value)))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>元</span>
            </div>
            <input
              type="range"
              min={0}
              max={5000000}
              step={10000}
              value={Math.min(5000000, currentSavings)}
              onChange={(e) => setCurrentSavings(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>0</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{fmtWan(currentSavings)}</span>
              <span>500萬</span>
            </div>
          </div>

          {/* 通膨 & 投報率 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="calc-field">
              <label className="calc-label">年通膨率</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  className="calc-input"
                  value={inflationRate}
                  min={0}
                  max={8}
                  step={0.1}
                  onChange={(e) => setInflationRate(Math.min(8, Math.max(0, Number(e.target.value))))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>%</span>
              </div>
              <p style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>台灣長期均值約 2%</p>
            </div>
            <div className="calc-field">
              <label className="calc-label">年投資報酬率</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  className="calc-input"
                  value={returnRate}
                  min={0}
                  max={15}
                  step={0.1}
                  onChange={(e) => setReturnRate(Math.min(15, Math.max(0, Number(e.target.value))))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>%</span>
              </div>
              <p style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>保守 3% / 積極 7%</p>
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

          {/* 缺口主結果 */}
          <div
            className="result-primary"
            style={{ borderLeft: `4px solid ${gapColor}` }}
          >
            <div className="result-label">
              {result.gap <= 0 ? '✅ 退休金已足夠' : '⚠️ 退休金缺口'}
            </div>
            <div className="result-value" style={{ color: gapColor }}>
              {result.gap <= 0 ? fmtWan(result.totalAvailable - result.totalNeed) + ' 盈餘' : fmtWan(result.gap)}
            </div>
            <div className="result-sublabel">
              {result.gap > 0
                ? `尚缺 ${result.gapPercent.toFixed(0)}%，需額外補足`
                : '目前資源已可支應退休需求'}
            </div>
          </div>

          {/* 每月需存 */}
          {result.gap > 0 && result.yearsToRetire > 0 && (
            <div style={{ marginTop: 16, padding: '16px', background: 'var(--color-accent-bg)', borderRadius: 4, border: `0.5px solid var(--color-accent)` }}>
              <div style={{ fontSize: 12, color: 'var(--color-accent)', marginBottom: 4, fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>每月需額外儲蓄</div>
              <div style={{ fontSize: 28, fontWeight: 300, color: 'var(--color-text-primary)' }}>
                {fmtCurrency(Math.round(result.monthlyRequired))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                以年報酬率 {returnRate}%、工作 {result.yearsToRetire} 年計算
              </div>
            </div>
          )}

          {/* 明細表 */}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12, fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>資金明細</div>
            {[
              { label: '退休總需求', value: fmtWan(result.totalNeed), sub: `${result.retirementYears}年 × 通膨調整` },
              { label: '4% 法則參考需求', value: fmtWan(result.rule4pct), sub: '月花費×12÷4%' },
              { label: '現有積蓄（未來值）', value: fmtWan(result.savingsFV), sub: `${retireAge}歲時` },
              { label: '退休金收入（勞保+勞退）', value: fmtWan(result.pensionPV), sub: `${result.retirementMonths}個月總額` },
              { label: '總可用資源', value: fmtWan(result.totalAvailable), sub: '積蓄+退休金' },
            ].map((row) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '0.5px solid var(--color-border)' }}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{row.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{row.sub}</div>
                </div>
                <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* 時間軸 */}
          <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--color-bg)', borderRadius: 4, border: '0.5px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-muted)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, color: 'var(--color-accent)' }}>今年</div>
                <div>{currentAge} 歲</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, color: 'var(--color-text-primary)' }}>→</div>
                <div style={{ fontSize: 10 }}>工作 {result.yearsToRetire} 年</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, color: 'var(--color-accent)' }}>退休</div>
                <div>{retireAge} 歲</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, color: 'var(--color-text-primary)' }}>→</div>
                <div style={{ fontSize: 10 }}>退休 {result.retirementYears} 年</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, color: 'var(--color-accent)' }}>終點</div>
                <div>{lifeExpectancy} 歲</div>
              </div>
            </div>
          </div>

          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 20, lineHeight: 1.6 }}>
            ⚠️ 本試算僅供退休規劃參考，不構成任何金融建議。實際退休金額、通膨與投資報酬均有不確定性，建議定期重新試算。
          </p>
        </div>
      </div>
    </div>
  );
}

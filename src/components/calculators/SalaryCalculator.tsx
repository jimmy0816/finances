import { useState, useMemo } from 'react';

/* ─── Helpers ─── */
const fmt = (n: number) =>
  new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(n);

const fmtCurrency = (n: number) => `NT$ ${fmt(n)}`;

/* ─── 2026 費率 ─── */
const LABOR_INS_RATE = 0.125;       // 勞保費率 12.5%（含就業保險1%）
const LABOR_INS_EMPLOYEE_RATIO = 0.20; // 員工負擔 20%
const LABOR_INS_MAX = 45800;        // 勞保最高投保薪資
const LABOR_INS_MIN = 29500;        // 勞保最低投保薪資（2026基本工資）

const HEALTH_RATE = 0.0517;         // 健保費率 5.17%
const HEALTH_EMPLOYEE_RATIO = 0.30; // 員工負擔 30%
const HEALTH_MIN = 29500;           // 健保最低投保薪資
const HEALTH_MAX = 219500;          // 健保最高投保薪資

const PENSION_EMPLOYER_RATE = 0.06; // 雇主提繳 6%

/* ─── 勞保投保薪資分級表（2026 常用級距） ─── */
const LABOR_BRACKETS = [
  29500, 30300, 31800, 33300, 34800, 36300, 38200,
  40100, 42000, 43900, 45800,
];

/**
 * 找到對應的投保薪資級距（無條件進位到下一級）
 * 超過最高級距則用最高值
 */
function findBracket(salary: number, brackets: number[], max: number, min: number): number {
  if (salary <= min) return min;
  if (salary >= max) return max;
  return brackets.find((b) => b >= salary) ?? max;
}

/* ─── 2026 所得稅估算（月薪預扣方式）─── */
// 年免稅額: 個人免稅額 97,000 + 標準扣除額 131,000 + 薪資特別扣除額 220,000
// = 448,000（本人無眷屬）; 每增加一個扶養人口加 97,000（免稅額）
// 稅率級距（2026年度）：
//   0 ~ 590,000 → 5%
//   590,001 ~ 1,330,000 → 12%（含差額 41,300）
//   1,330,001 ~ 2,660,000 → 20%（含差額 147,700）
//   2,660,001 ~ 4,980,000 → 30%（含差額 413,700）
//   4,980,001+ → 40%（含差額 911,700）
const TAX_BRACKETS = [
  { limit: 590000, rate: 0.05, progressive: 0 },
  { limit: 1330000, rate: 0.12, progressive: 41300 },
  { limit: 2660000, rate: 0.20, progressive: 147700 },
  { limit: 4980000, rate: 0.30, progressive: 413700 },
  { limit: Infinity, rate: 0.40, progressive: 911700 },
];

const PERSONAL_EXEMPTION = 97000;
const STANDARD_DEDUCTION = 131000;
const SALARY_DEDUCTION = 220000;

function calcAnnualTax(annualIncome: number, dependents: number): number {
  const totalExemption =
    PERSONAL_EXEMPTION * (1 + dependents) + STANDARD_DEDUCTION + SALARY_DEDUCTION;
  const taxableIncome = Math.max(0, annualIncome - totalExemption);

  for (const bracket of TAX_BRACKETS) {
    if (taxableIncome <= bracket.limit) {
      return taxableIncome * bracket.rate - bracket.progressive;
    }
  }
  return 0;
}

/* ─── Main Calculation ─── */
function calcSalary(monthlySalary: number, dependents: number, selfPensionRate: number) {
  // 勞保
  const laborInsBracket = findBracket(monthlySalary, LABOR_BRACKETS, LABOR_INS_MAX, LABOR_INS_MIN);
  const laborInsEmployee = Math.round(laborInsBracket * LABOR_INS_RATE * LABOR_INS_EMPLOYEE_RATIO);
  const laborInsEmployer = Math.round(laborInsBracket * LABOR_INS_RATE * 0.70); // 雇主70%

  // 健保
  const healthBracket = Math.max(HEALTH_MIN, Math.min(HEALTH_MAX, monthlySalary));
  const healthEmployee = Math.round(healthBracket * HEALTH_RATE * HEALTH_EMPLOYEE_RATIO * (1 + dependents));
  const healthEmployer = Math.round(healthBracket * HEALTH_RATE * 0.60);

  // 勞退
  const laborPensionSelf = Math.round(monthlySalary * (selfPensionRate / 100));
  const laborPensionEmployer = Math.round(monthlySalary * PENSION_EMPLOYER_RATE);

  // 所得稅預扣（先扣勞退自提再算稅）
  const taxableMonthly = monthlySalary - laborPensionSelf;
  const annualTax = calcAnnualTax(taxableMonthly * 12, dependents);
  const monthlyTax = Math.max(0, Math.round(annualTax / 12));

  // 實領
  const totalDeduction = laborInsEmployee + healthEmployee + laborPensionSelf + monthlyTax;
  const netPay = monthlySalary - totalDeduction;

  // 年薪計算
  const annualGross = monthlySalary * 12;
  const annualNet = netPay * 12;
  const deductionRate = (totalDeduction / monthlySalary) * 100;

  return {
    laborInsBracket,
    laborInsEmployee,
    laborInsEmployer,
    healthBracket,
    healthEmployee,
    healthEmployer,
    laborPensionSelf,
    laborPensionEmployer,
    monthlyTax,
    totalDeduction,
    netPay,
    annualGross,
    annualNet,
    deductionRate,
    annualTax,
  };
}

/* ─── Component ─── */
export default function SalaryCalculator() {
  const [monthlySalary, setMonthlySalary] = useState(45000);
  const [dependents, setDependents] = useState(0);
  const [selfPensionRate, setSelfPensionRate] = useState(0); // %

  const result = useMemo(
    () => calcSalary(monthlySalary, dependents, selfPensionRate),
    [monthlySalary, dependents, selfPensionRate],
  );

  return (
    <div className="calc-container" style={{ maxWidth: '100%' }}>
      {/* Header */}
      <div className="calc-header">
        <h2 style={{ fontWeight: 400 }}>💰 薪資稅後試算</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 300 }}>
          依 2026 年費率計算勞保費、健保費、所得稅預扣、勞退後的實拿金額
        </p>
      </div>

      <div className="calc-body">
        {/* ── Inputs ── */}
        <div className="calc-inputs">
          {/* 月薪 */}
          <div className="calc-field">
            <label className="calc-label">月薪（稅前）</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={monthlySalary}
                min={29500}
                max={500000}
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
              value={Math.min(200000, monthlySalary)}
              onChange={(e) => setMonthlySalary(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>29,500（最低）</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{fmt(monthlySalary)} 元</span>
              <span>200,000</span>
            </div>
          </div>

          {/* 扶養人數 */}
          <div className="calc-field">
            <label className="calc-label">扶養親屬人數</label>
            <select
              className="calc-select"
              value={dependents}
              onChange={(e) => setDependents(Number(e.target.value))}
            >
              {[0, 1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? '無（單身）' : `${n} 人`}
                </option>
              ))}
            </select>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              影響健保費及所得稅免稅額（每增加 1 人，免稅額增加 97,000 元）
            </p>
          </div>

          {/* 勞退自提 */}
          <div className="calc-field">
            <label className="calc-label">
              勞退自提比例
              <span style={{ fontSize: 11, color: 'var(--color-accent)', marginLeft: 8 }}>
                （抵減所得稅）
              </span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={selfPensionRate}
                min={0}
                max={6}
                step={1}
                onChange={(e) => setSelfPensionRate(Math.min(6, Math.max(0, Number(e.target.value))))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>%</span>
            </div>
            <input
              type="range"
              min={0}
              max={6}
              step={1}
              value={selfPensionRate}
              onChange={(e) => setSelfPensionRate(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>0%</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{selfPensionRate}%（{fmtCurrency(result.laborPensionSelf)}/月）</span>
              <span>6%</span>
            </div>
          </div>
        </div>

        {/* ── Results ── */}
        <div className="calc-results">
          <div className="result-header">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
              每月扣項明細（2026年費率）
            </span>
          </div>

          {/* 主結果 */}
          <div className="result-primary">
            <div className="result-label">每月實拿（稅後到手）</div>
            <div className="result-value">{fmtCurrency(result.netPay)}</div>
            <div className="result-sublabel">
              扣除率 {result.deductionRate.toFixed(1)}%，每月扣 {fmtCurrency(result.totalDeduction)}
            </div>
          </div>

          {/* 扣項明細 */}
          <div style={{ marginTop: 20 }}>
            {[
              {
                label: '勞工保險費',
                sub: `投保薪資 ${fmt(result.laborInsBracket)} × 12.5% × 20%`,
                amount: result.laborInsEmployee,
                color: '#6366F1',
              },
              {
                label: '全民健保費',
                sub: `投保金額 ${fmt(result.healthBracket)} × 5.17% × 30%${dependents > 0 ? ` × ${1 + dependents}人` : ''}`,
                amount: result.healthEmployee,
                color: '#0EA5E9',
              },
              ...(selfPensionRate > 0
                ? [{
                    label: '勞退自提',
                    sub: `月薪 × ${selfPensionRate}%（可抵扣所得稅）`,
                    amount: result.laborPensionSelf,
                    color: '#10B981',
                  }]
                : []),
              {
                label: '薪資所得稅預扣',
                sub: `年稅額 ${fmtCurrency(result.annualTax)} ÷ 12`,
                amount: result.monthlyTax,
                color: '#F59E0B',
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  padding: '12px 0',
                  borderBottom: '0.5px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div
                    style={{
                      width: 4,
                      height: 40,
                      background: item.color,
                      borderRadius: 2,
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 400 }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {item.sub}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 14,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-text-primary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  -{fmtCurrency(item.amount)}
                </span>
              </div>
            ))}
          </div>

          {/* 薪資總覽 */}
          <div
            style={{
              marginTop: 20,
              background: 'var(--color-bg)',
              borderRadius: 4,
              overflow: 'hidden',
              border: '0.5px solid var(--color-border)',
            }}
          >
            {[
              { label: '月薪（稅前）', value: fmtCurrency(monthlySalary), bold: false },
              { label: '月薪（實拿）', value: fmtCurrency(result.netPay), bold: true },
              { label: '年薪（稅前）', value: fmtCurrency(result.annualGross), bold: false },
              { label: '年薪（實拿）', value: fmtCurrency(result.annualNet), bold: true },
            ].map((row, i) => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: i < 3 ? '0.5px solid var(--color-border)' : 'none',
                  background: row.bold ? 'var(--color-accent-bg)' : undefined,
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{row.label}</span>
                <span
                  style={{
                    fontSize: row.bold ? 16 : 13,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: row.bold ? 500 : 400,
                    color: row.bold ? 'var(--color-accent)' : 'var(--color-text-primary)',
                  }}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {/* 雇主成本參考 */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8, fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>雇主月增負擔（參考）</div>
            {[
              { label: '勞保費（雇主 70%）', value: fmtCurrency(result.laborInsEmployer) },
              { label: '健保費（雇主 60%）', value: fmtCurrency(result.healthEmployer) },
              { label: '勞退提繳（6%）', value: fmtCurrency(result.laborPensionEmployer) },
              { label: '雇主合計', value: fmtCurrency(result.laborInsEmployer + result.healthEmployer + result.laborPensionEmployer) },
            ].map((row) => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '0.5px solid var(--color-border)',
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{row.label}</span>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{row.value}</span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 20, lineHeight: 1.6 }}>
            ⚠️ 使用 2026 年度費率，含勞保 12.5%、健保 5.17%，所得稅為預扣估算，以五申報為準。實際金額依個人扣除項目、年度薪資調整而有所不同。
          </p>
        </div>
      </div>
    </div>
  );
}

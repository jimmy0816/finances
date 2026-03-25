import { useState, useMemo } from 'react';

/* ─── Helpers ─── */
const fmt = (n: number) =>
  new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(n);

const fmtCurrency = (n: number) => `NT$ ${fmt(n)}`;

/**
 * 時薪計算：月薪 ÷ 240（勞基法標準：30天×8小時）
 * 或: 月薪 ÷ 174（依平均每月工時）
 * 台灣勞基法加班計算使用 240 小時基底
 */
function getHourlyRate(monthlySalary: number): number {
  return monthlySalary / 240;
}

/**
 * 加班費計算（依 2026 勞基法）
 *
 * 平日延長工時（第 24 條）：
 *   前 2 小時：時薪 × 4/3（133.33%）
 *   第 3-4 小時：時薪 × 5/3（166.67%）
 *
 * 休息日加班（第 24 條第 2 項）：
 *   前 2 小時：時薪 × 4/3
 *   第 3-8 小時：時薪 × 5/3
 *   超過 8 小時：時薪 × 8/3（266.67%）
 *   注意：勞基法規定休息日加班，雇主至少給 4 小時工資（即使未滿）
 *
 * 例假日/國定假日（第 39 條）：
 *   出勤：加倍（即當日工資 × 2，已含正常日薪）
 *   → 「加發」的意思是再多給 1 天工資
 *   → 每 8 小時 = 日薪（時薪 × 8），加倍後共時薪 × 8 × 2
 */
function calcOvertime(
  monthlySalary: number,
  weekdayHours: number,
  restDayHours: number,
  holidayDays: number,
  nationalHolidayDays: number,
) {
  const hourly = getHourlyRate(monthlySalary);
  const dailySalary = hourly * 8;

  // 平日加班費
  let weekdayOT = 0;
  if (weekdayHours > 0) {
    const h1 = Math.min(weekdayHours, 2);
    const h2 = Math.max(0, Math.min(weekdayHours - 2, 2));
    weekdayOT = hourly * (h1 * (4 / 3) + h2 * (5 / 3));
  }

  // 休息日加班費
  // 注意：休息日加班不足 2 小時以 2 小時計、第 3-8 小時不足 4 小時以 4 小時計
  let restDayOT = 0;
  if (restDayHours > 0) {
    const billedHours = restDayHours <= 2 ? 2 : restDayHours <= 8 ? restDayHours : 8 + (restDayHours - 8);
    const h1 = Math.min(billedHours, 2);
    const h2 = Math.max(0, Math.min(billedHours - 2, 6));
    const h3 = Math.max(0, billedHours - 8);
    restDayOT = hourly * (h1 * (4 / 3) + h2 * (5 / 3) + h3 * (8 / 3));
  }

  // 例假日出勤（勞基法第 40 條：原則禁止，例外出勤加倍再加）
  // 加發工資：日薪 × 加班小時數 × (5/3) ← 最低標準
  // 保守估算：以 1 天 = 8 小時，加倍給付（共 2倍日薪，但其中1倍已含在月薪）
  // → 額外加發 = 1 倍日薪 × 天數
  const holidayOT = dailySalary * holidayDays;

  // 國定假日出勤（第 39 條：出勤者加倍給付）
  // → 額外加發 = 1 倍日薪 × 天數
  const nationalHolidayOT = dailySalary * nationalHolidayDays;

  const totalOT = weekdayOT + restDayOT + holidayOT + nationalHolidayOT;

  return {
    hourly,
    dailySalary,
    weekdayOT,
    restDayOT,
    holidayOT,
    nationalHolidayOT,
    totalOT,
    // 顯示用的有效時數
    restDayBilledHours: restDayHours > 0 && restDayHours <= 2 ? 2 : restDayHours,
  };
}

/* ─── Component ─── */
export default function OvertimeCalculator() {
  const [monthlySalary, setMonthlySalary] = useState(40000);
  const [weekdayHours, setWeekdayHours] = useState(2);
  const [restDayHours, setRestDayHours] = useState(4);
  const [holidayDays, setHolidayDays] = useState(0);
  const [nationalHolidayDays, setNationalHolidayDays] = useState(0);

  const result = useMemo(
    () => calcOvertime(monthlySalary, weekdayHours, restDayHours, holidayDays, nationalHolidayDays),
    [monthlySalary, weekdayHours, restDayHours, holidayDays, nationalHolidayDays],
  );

  return (
    <div className="calc-container" style={{ maxWidth: '100%' }}>
      {/* Header */}
      <div className="calc-header">
        <h2 style={{ fontWeight: 400 }}>⏰ 加班費計算器</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 300 }}>
          依 2026 勞基法計算平日/休息日/例假日/國定假日加班費
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
              <span>29,500</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{fmt(monthlySalary)} 元</span>
              <span>200,000</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              時薪 = 月薪 ÷ 240 = {fmt(Math.round(result.hourly))} 元 / 小時
            </p>
          </div>

          {/* 平日加班 */}
          <div className="calc-field">
            <label className="calc-label">
              平日延長工時
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>（一天最多 4 小時）</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={weekdayHours}
                min={0}
                max={4}
                step={0.5}
                onChange={(e) => setWeekdayHours(Math.min(4, Math.max(0, Number(e.target.value))))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>小時</span>
            </div>
            <input
              type="range"
              min={0}
              max={4}
              step={0.5}
              value={weekdayHours}
              onChange={(e) => setWeekdayHours(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              前2小時 × 133%；後2小時 × 167%
            </div>
            {weekdayHours > 0 && (
              <div style={{ fontSize: 11, color: 'var(--color-accent)', marginTop: 4 }}>
                加班費：{fmtCurrency(Math.round(result.weekdayOT))}
              </div>
            )}
          </div>

          {/* 休息日加班 */}
          <div className="calc-field">
            <label className="calc-label">
              休息日加班時數
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>（不足2小時以2小時計）</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="calc-input"
                value={restDayHours}
                min={0}
                max={12}
                step={0.5}
                onChange={(e) => setRestDayHours(Math.min(12, Math.max(0, Number(e.target.value))))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>小時</span>
            </div>
            <input
              type="range"
              min={0}
              max={12}
              step={0.5}
              value={restDayHours}
              onChange={(e) => setRestDayHours(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-accent)' }}
            />
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              前2小時 × 133%；第3-8小時 × 167%；超過8小時 × 267%
            </div>
            {restDayHours > 0 && (
              <div style={{ fontSize: 11, color: 'var(--color-accent)', marginTop: 4 }}>
                加班費：{fmtCurrency(Math.round(result.restDayOT))}
                {restDayHours < 2 && restDayHours > 0 && (
                  <span style={{ color: 'var(--color-warning)' }}> （以 2 小時計）</span>
                )}
              </div>
            )}
          </div>

          {/* 例假日 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="calc-field">
              <label className="calc-label">例假日出勤天數</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  className="calc-input"
                  value={holidayDays}
                  min={0}
                  max={20}
                  step={1}
                  onChange={(e) => setHolidayDays(Math.min(20, Math.max(0, Number(e.target.value))))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>天</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>
                加發 1 倍日薪
              </div>
            </div>
            <div className="calc-field">
              <label className="calc-label">國定假日出勤天數</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  className="calc-input"
                  value={nationalHolidayDays}
                  min={0}
                  max={20}
                  step={1}
                  onChange={(e) => setNationalHolidayDays(Math.min(20, Math.max(0, Number(e.target.value))))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>天</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>
                加發 1 倍日薪
              </div>
            </div>
          </div>
        </div>

        {/* ── Results ── */}
        <div className="calc-results">
          <div className="result-header">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
              加班費明細
            </span>
          </div>

          {/* 主結果 */}
          <div className="result-primary">
            <div className="result-label">本期加班費合計</div>
            <div className="result-value">{fmtCurrency(Math.round(result.totalOT))}</div>
            <div className="result-sublabel">時薪 {fmtCurrency(Math.round(result.hourly))} × 加班時數</div>
          </div>

          {/* 明細 */}
          <div style={{ marginTop: 20 }}>
            {[
              {
                label: '平日延長工時',
                sub: weekdayHours > 0 ? `${weekdayHours} 小時（前2h×133% + 後2h×167%）` : '未填寫',
                amount: result.weekdayOT,
                show: true,
              },
              {
                label: '休息日加班',
                sub: restDayHours > 0
                  ? `實際 ${restDayHours}h，計費 ${result.restDayBilledHours}h（前2h×133% / 3-8h×167%）`
                  : '未填寫',
                amount: result.restDayOT,
                show: true,
              },
              {
                label: '例假日出勤',
                sub: holidayDays > 0 ? `${holidayDays} 天 × 日薪（加發）` : '未填寫',
                amount: result.holidayOT,
                show: true,
              },
              {
                label: '國定假日出勤',
                sub: nationalHolidayDays > 0 ? `${nationalHolidayDays} 天 × 日薪（加發）` : '未填寫',
                amount: result.nationalHolidayOT,
                show: true,
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
                  opacity: item.amount === 0 ? 0.5 : 1,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{item.sub}</div>
                </div>
                <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: item.amount > 0 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                  {item.amount > 0 ? fmtCurrency(Math.round(item.amount)) : '—'}
                </span>
              </div>
            ))}
          </div>

          {/* 費率對照表 */}
          <div style={{ marginTop: 20, padding: '16px', background: 'var(--color-bg)', borderRadius: 4, border: '0.5px solid var(--color-border)' }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12, fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
              2026 加班費率速查
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-card)' }}>
                  {['類型', '時段', '費率倍數', '每小時'].map((h) => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500, color: 'var(--color-text-secondary)', borderBottom: '0.5px solid var(--color-border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { type: '平日', period: '前 2 小時', rate: '1.34×', hourly: fmtCurrency(Math.round(result.hourly * 4 / 3)) },
                  { type: '平日', period: '第 3-4 小時', rate: '1.67×', hourly: fmtCurrency(Math.round(result.hourly * 5 / 3)) },
                  { type: '休息日', period: '前 2 小時', rate: '1.34×', hourly: fmtCurrency(Math.round(result.hourly * 4 / 3)) },
                  { type: '休息日', period: '第 3-8 小時', rate: '1.67×', hourly: fmtCurrency(Math.round(result.hourly * 5 / 3)) },
                  { type: '休息日', period: '超過 8 小時', rate: '2.67×', hourly: fmtCurrency(Math.round(result.hourly * 8 / 3)) },
                  { type: '例假/國定', period: '全天', rate: '加發 1 倍', hourly: `日薪 ${fmtCurrency(Math.round(result.dailySalary))}` },
                ].map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'var(--color-bg-card)' : undefined }}>
                    <td style={{ padding: '6px 8px', color: 'var(--color-text-secondary)' }}>{row.type}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--color-text-muted)' }}>{row.period}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>{row.rate}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{row.hourly}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 20, lineHeight: 1.6 }}>
            ⚠️ 依勞基法第 24 條及第 39 條規定計算。例假日出勤原則上禁止，雇主需有正當理由。本試算僅供參考，實際加班費依勞動契約及主管機關解釋為準。
          </p>
        </div>
      </div>
    </div>
  );
}

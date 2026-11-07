// frontend/src/utils/monthUtils.js

export function fillMissingMonths(monthlyData, startMonth) {
  if (!startMonth) return monthlyData;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthNum = now.getMonth() + 1;

  let endYear = currentYear;
  let endMonthNum = currentMonthNum + 3;
  if (endMonthNum > 12) {
    endMonthNum -= 12;
    endYear += 1;
  }
  const endMonth = `${endYear}-${String(endMonthNum).padStart(2, '0')}`;
  const effectiveStart = startMonth;

  const result = [...monthlyData.filter(m => m.month >= effectiveStart && m.month <= endMonth)];

  let [year, month] = effectiveStart.split('-').map(Number);
  const [endY, endM] = endMonth.split('-').map(Number);

  while (year < endY || (year === endY && month <= endM)) {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    if (!result.find(m => m.month === monthStr)) {
      result.push({
        id: `empty-${monthStr}`,
        month: monthStr,
        elevator_fee: 0,
        elevator_power: 0,
        general_power: 0,
        fund_ro: 0,
        intercom: 0,
        manager_fee: 0,
        total_amount: 0,
        status: 'unpaid',
        is_empty: true,
      });
    }
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return result.sort((a, b) => a.month.localeCompare(b.month));
}
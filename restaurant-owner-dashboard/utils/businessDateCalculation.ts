import { subDays, startOfMonth, subMonths, startOfWeek } from 'date-fns';

export function getRecordsDateRange(
  filter: string,
  customRange?: { startDate: Date | null; endDate: Date | null }
) {
  const now = new Date();
  
  // Determine start of current business day (which transitions at 04:00 AM)
  let currentBusinessDayStart = new Date(now);
  if (now.getHours() < 4) {
    currentBusinessDayStart = subDays(now, 1);
  }
  currentBusinessDayStart.setHours(4, 0, 0, 0);

  const filterLower = filter.toLowerCase().replace(/_/g, ' ').trim();

  let startDate = new Date();
  let endDate = new Date();

  if (filterLower === 'today') {
    startDate = new Date(currentBusinessDayStart);
    endDate = new Date(currentBusinessDayStart);
    endDate.setDate(endDate.getDate() + 1);
    endDate.setMilliseconds(-1);
  } else if (filterLower === 'yesterday') {
    startDate = new Date(currentBusinessDayStart);
    startDate.setDate(startDate.getDate() - 1);
    endDate = new Date(currentBusinessDayStart);
    endDate.setMilliseconds(-1);
  } else if (filterLower === 'this week' || filterLower === 'week') {
    const monday = startOfWeek(currentBusinessDayStart, { weekStartsOn: 1 });
    startDate = new Date(monday);
    startDate.setHours(4, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);
    endDate.setMilliseconds(-1);
  } else if (filterLower === 'this month' || filterLower === 'month') {
    const firstOfMonth = startOfMonth(currentBusinessDayStart);
    startDate = new Date(firstOfMonth);
    startDate.setHours(4, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setMilliseconds(-1);
  } else if (filterLower === 'last month') {
    const lastMonthDay = subMonths(currentBusinessDayStart, 1);
    const firstOfLastMonth = startOfMonth(lastMonthDay);
    startDate = new Date(firstOfLastMonth);
    startDate.setHours(4, 0, 0, 0);
    const firstOfThisMonth = startOfMonth(currentBusinessDayStart);
    endDate = new Date(firstOfThisMonth);
    endDate.setHours(4, 0, 0, 0);
    endDate.setMilliseconds(-1);
  } else if (customRange && customRange.startDate) {
    startDate = new Date(customRange.startDate);
    startDate.setHours(4, 0, 0, 0);
    const end = customRange.endDate ? new Date(customRange.endDate) : new Date(customRange.startDate);
    endDate = new Date(end);
    endDate.setDate(endDate.getDate() + 1);
    endDate.setHours(4, 0, 0, 0);
    endDate.setMilliseconds(-1);
  } else {
    // ALL TIME or fallback
    startDate = new Date(0); // Epoch
    endDate = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000); // 10 years in future
  }

  return { startDate, endDate };
}

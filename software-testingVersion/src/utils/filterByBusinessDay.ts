const CUTOFF_HOUR = 4;
const CUTOFF_MINUTE = 0;

export function getBusinessDayFor(timestamp: number): {
  start: number;
  end: number;
} {
  const date = new Date(timestamp);
  
  // Today's cutoff time
  const cutoff = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    CUTOFF_HOUR,
    CUTOFF_MINUTE,
    0,
    0
  );
  
  if (timestamp >= cutoff.getTime()) {
    // After cutoff = this day's business day
    return {
      start: cutoff.getTime(),
      end: new Date(
        cutoff.getFullYear(),
        cutoff.getMonth(),
        cutoff.getDate() + 1,
        CUTOFF_HOUR,
        CUTOFF_MINUTE,
        0,
        0
      ).getTime() - 1
    };
  } else {
    // Before cutoff = previous day's business day
    const prevDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() - 1,
      CUTOFF_HOUR,
      CUTOFF_MINUTE,
      0,
      0
    );
    return {
      start: prevDay.getTime(),
      end: cutoff.getTime() - 1
    };
  }
}

export function filterOrdersByBusinessDay(
  orders: any[],
  period: 'today' | 'yesterday' | 'week' | 'month' | 'last-month' | 'all' | 'custom',
  customStart?: Date | string | null,
  customEnd?: Date | string | null
): any[] {
  if (!orders || orders.length === 0) return [];
  
  const now = new Date();
  const todaysCutoff = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    CUTOFF_HOUR,
    CUTOFF_MINUTE,
    0,
    0
  );
  
  let rangeStart: number;
  let rangeEnd: number;
  
  if (period === 'today') {
    if (now.getTime() >= todaysCutoff.getTime()) {
      // Business day has started
      rangeStart = todaysCutoff.getTime();
      rangeEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        CUTOFF_HOUR,
        CUTOFF_MINUTE,
        0,
        0
      ).getTime() - 1;
    } else {
      // Still in yesterday's business day
      const yesterdaysCutoff = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
        CUTOFF_HOUR,
        CUTOFF_MINUTE,
        0,
        0
      );
      rangeStart = yesterdaysCutoff.getTime();
      rangeEnd = todaysCutoff.getTime() - 1;
    }
  } else if (period === 'yesterday') {
    const yesterdaysCutoff = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1,
      CUTOFF_HOUR,
      CUTOFF_MINUTE,
      0,
      0
    );
    rangeStart = yesterdaysCutoff.getTime();
    rangeEnd = todaysCutoff.getTime() - 1;
  } else if (period === 'week') {
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysToMonday);
    monday.setHours(CUTOFF_HOUR, CUTOFF_MINUTE, 0, 0);
    rangeStart = monday.getTime();
    rangeEnd = now.getTime();
  } else if (period === 'month') {
    const firstDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      CUTOFF_HOUR,
      CUTOFF_MINUTE,
      0,
      0
    );
    rangeStart = firstDay.getTime();
    rangeEnd = now.getTime();
  } else if (period === 'last-month') {
    const firstOfThisMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      CUTOFF_HOUR,
      CUTOFF_MINUTE,
      0,
      0
    );
    const firstOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
      CUTOFF_HOUR,
      CUTOFF_MINUTE,
      0,
      0
    );
    rangeStart = firstOfLastMonth.getTime();
    rangeEnd = firstOfThisMonth.getTime() - 1;
  } else if (period === 'custom' && customStart && customEnd) {
    const from = new Date(customStart);
    const to = new Date(customEnd);
    
    const startDate = new Date(
      from.getFullYear(),
      from.getMonth(),
      from.getDate(),
      CUTOFF_HOUR,
      CUTOFF_MINUTE,
      0,
      0
    );
    const nextDay = new Date(
      to.getFullYear(),
      to.getMonth(),
      to.getDate() + 1,
      CUTOFF_HOUR,
      CUTOFF_MINUTE,
      0,
      0
    );
    rangeStart = startDate.getTime();
    rangeEnd = nextDay.getTime() - 1;
  } else {
    rangeStart = 0;
    rangeEnd = now.getTime();
  }
  
  // Filter by completedAt (or createdAt fallback)
  return orders.filter(order => {
    const timestamp = order.completedAt || order.createdAt;
    if (!timestamp) return false;
    return timestamp >= rangeStart && timestamp <= rangeEnd;
  });
}

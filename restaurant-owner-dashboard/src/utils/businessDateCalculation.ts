export function getRecordsDateRange(period: string) {
  const cutoffTime = "04:00" // Business day cutoff
  const [hours, minutes] = cutoffTime.split(':').map(Number)
  
  const today = new Date()
  const todayAtCutoff = new Date(today)
  todayAtCutoff.setHours(hours, minutes, 0, 0)
  
  const now = new Date()
  
  let startDate: Date
  let endDate: Date
  
  if (period === 'today') {
    if (now >= todayAtCutoff) {
      startDate = todayAtCutoff
      endDate = new Date(todayAtCutoff)
      endDate.setDate(endDate.getDate() + 1)
      endDate.setMilliseconds(-1)
    } else {
      startDate = new Date(todayAtCutoff)
      startDate.setDate(startDate.getDate() - 1)
      endDate = new Date(todayAtCutoff)
      endDate.setMilliseconds(-1)
    }
  } else if (period === 'yesterday') {
    startDate = new Date(todayAtCutoff)
    startDate.setDate(startDate.getDate() - 1)
    endDate = new Date(todayAtCutoff)
    endDate.setMilliseconds(-1)
  } else if (period === 'week') {
    const dayOfWeek = today.getDay()
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    startDate = new Date(today)
    startDate.setDate(today.getDate() - daysToMonday)
    startDate.setHours(hours, minutes, 0, 0)
    endDate = now
  } else if (period === 'month') {
    startDate = new Date(today)
    startDate.setDate(1)
    startDate.setHours(hours, minutes, 0, 0)
    endDate = now
  } else {
    startDate = new Date(0)
    endDate = now
  }
  
  return { startDate, endDate }
}
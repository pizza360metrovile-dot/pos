export function formatTime12Hour(timestamp: number | Date): string {
  // Convert timestamp to 12-hour format with AM/PM
  // Input: timestamp (milliseconds) or Date object
  // Output: "02:30 AM" or "02:30 PM"
  
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  // Convert 24-hour to 12-hour
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  
  // Pad minutes with zero
  const minutesStr = minutes.toString().padStart(2, '0');
  const hoursStr = hours.toString().padStart(2, '0');
  
  return `${hoursStr}:${minutesStr} ${ampm}`;
}

export function formatDateTime12Hour(timestamp: number | Date): string {
  // Format as: "02:30 AM on 25 Jun 26" or similar
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  
  const time = formatTime12Hour(date);
  const day = date.getDate();
  const month = date.toLocaleString('default', { month: 'short' });
  const year = date.getFullYear().toString().slice(-2);
  
  return `${time} on ${day} ${month} ${year}`;
}

export function formatDateTimeCompact(timestamp: number | Date): string {
  // Format as: "02:30 AM\n25 Jun 26" (for tables)
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  
  const time = formatTime12Hour(date);
  const day = date.getDate();
  const month = date.toLocaleString('default', { month: 'short' });
  const year = date.getFullYear().toString().slice(-2);
  
  return `${time}\n${day} ${month} ${year}`;
}

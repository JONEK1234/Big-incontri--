export interface AnniversaryStatus {
  isToday: boolean;
  yearsElapsed: number;
  nextOccurrence: string; // YYYY-MM-DD
  daysRemaining: number;
  yearsToCelebrate: number;
}

export function getAnniversaryStatus(originalDateStr: string, currentDate: Date = new Date()): AnniversaryStatus {
  const orig = new Date(originalDateStr);
  
  // Year, month, day of original date
  const origYear = orig.getFullYear();
  const origMonth = orig.getMonth();
  const origDay = orig.getDate();
  
  // Current year, month, day
  const currYear = currentDate.getFullYear();
  const currMonth = currentDate.getMonth();
  const currDay = currentDate.getDate();
  
  // Create current year's occurrence
  let nextOccurrenceYear = currYear;
  let occurrenceThisYear = new Date(currYear, origMonth, origDay);
  
  // If the occurrence this year has already passed, the next occurrence is next year
  // Compare times at midnight
  const todayMidnight = new Date(currYear, currMonth, currDay);
  const occurrenceMidnight = new Date(currYear, origMonth, origDay);
  
  const isToday = todayMidnight.getTime() === occurrenceMidnight.getTime();
  
  if (occurrenceMidnight.getTime() < todayMidnight.getTime()) {
    nextOccurrenceYear = currYear + 1;
  }
  
  const nextOccurrenceDate = new Date(nextOccurrenceYear, origMonth, origDay);
  const yearsElapsed = currYear - origYear;
  
  // How many years to celebrate at the next occurrence
  const yearsToCelebrate = nextOccurrenceYear - origYear;
  
  // Days remaining
  const diffTime = nextOccurrenceDate.getTime() - todayMidnight.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  
  return {
    isToday,
    yearsElapsed,
    nextOccurrence: `${nextOccurrenceYear}-${String(origMonth + 1).padStart(2, "0")}-${String(origDay).padStart(2, "0")}`,
    daysRemaining: isToday ? 0 : daysRemaining,
    yearsToCelebrate: isToday ? yearsElapsed : yearsToCelebrate
  };
}

/**
 * Returns list of special moments from 1 year ago, 2 years ago etc.
 * e.g., "1 anno fa è successo questo evento importante..."
 */
export function getHistoricMilestones(dateStr: string, title: string, currentDate: Date = new Date()): string | null {
  const orig = new Date(dateStr);
  const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  
  const diffYears = today.getFullYear() - orig.getFullYear();
  
  // Check if same day and month
  if (orig.getMonth() === today.getMonth() && orig.getDate() === today.getDate() && diffYears > 0) {
    return `🎉 Esattamente ${diffYears} ann${diffYears === 1 ? "o" : "i"} fa succedeva questo: "${title}"! Che bel ricordo! 💙`;
  }
  
  return null;
}

"use client";

import { Button } from "@/components/ui/button";
import { formatShortDate, addDays, getTodayGMT1 } from "@/lib/date";

interface DateSelectorProps {
  selectedDate: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
}

export function DateSelector({ selectedDate, onDateChange }: DateSelectorProps) {
  const today = getTodayGMT1();
  const isToday = selectedDate === today;

  const handlePrevious = () => {
    onDateChange(addDays(selectedDate, -1));
  };

  const handleNext = () => {
    onDateChange(addDays(selectedDate, 1));
  };

  const handleToday = () => {
    onDateChange(today);
  };

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handlePrevious}
        className="h-8 w-8 p-0"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        <span className="sr-only">Previous day</span>
      </Button>

      <Button
        variant={isToday ? "secondary" : "outline"}
        size="sm"
        onClick={handleToday}
        className="min-w-[140px] font-medium"
      >
        {isToday ? "Today" : formatShortDate(selectedDate + "T12:00:00+01:00")}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleNext}
        className="h-8 w-8 p-0"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        <span className="sr-only">Next day</span>
      </Button>
    </div>
  );
}

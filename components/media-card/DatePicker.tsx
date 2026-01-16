"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import {
  parseDateInputToTimestamp,
  parseMonthInputToTimestamp,
  formatDateDisplay,
  isMonthOnlyDate,
} from "@/lib/dates";

interface DatePickerProps {
  value?: number;
  onChange: (timestamp?: number | null) => void;
  label: string;
  placeholder: string;
}

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = String(new Date().getMonth() + 1).padStart(2, "0");
const YEARS = Array.from({ length: 100 }, (_, i) => CURRENT_YEAR - 50 + i);

export function DatePicker({
  value,
  onChange,
  label,
  placeholder,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCleared, setIsCleared] = useState(false);
  
  const [isFullDate, setIsFullDate] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    
    if (open) {
      // When opening, sync from external value
      setIsCleared(false);
      if (value !== undefined && value !== null) {
        const date = new Date(value);
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear().toString();
        const day = String(date.getDate()).padStart(2, "0");
        const fullDate = !isMonthOnlyDate(value);
        
        setSelectedMonth(month);
        setSelectedYear(year);
        setSelectedDay(day);
        setIsFullDate(fullDate);
      } else {
        // No value - initialize with defaults
        setSelectedMonth(CURRENT_MONTH);
        setSelectedYear(CURRENT_YEAR.toString());
        setSelectedDay(null);
        setIsFullDate(false);
      }
    }
  };

  const handleApply = () => {
    // If fields are empty or cleared, clear the date (pass null to explicitly clear)
    if (isCleared || !selectedMonth || !selectedYear) {
      onChange(null);
      setIsOpen(false);
      setIsCleared(false);
      return;
    }

    if (isFullDate) {
      // Full date mode
      const day = selectedDay || "01";
      const timestamp = parseDateInputToTimestamp(`${selectedYear}-${selectedMonth}-${day}`);
      onChange(timestamp);
    } else {
      // Month/year only mode
      const timestamp = parseMonthInputToTimestamp(`${selectedYear}-${selectedMonth}`);
      onChange(timestamp);
    }
    setIsOpen(false);
    setIsCleared(false);
  };

  const handleClear = () => {
    // Clear the form inputs but keep popover open
    setSelectedMonth(null);
    setSelectedYear(null);
    setSelectedDay(null);
    setIsFullDate(false);
    setIsCleared(true); // Mark as cleared
  };

  const displayValue = value ? formatDateDisplay(value) : null;

  // Get days in selected month
  const getDaysInMonth = (month: string | null, year: string | null) => {
    if (!month || !year) return [];
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, "0"));
  };

  // Check if form is cleared (empty fields)
  const isFormCleared = isCleared || !selectedMonth || !selectedYear;
  const availableDays = selectedMonth && selectedYear ? getDaysInMonth(selectedMonth, selectedYear) : [];

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 text-xs hover:text-foreground transition-colors cursor-pointer",
            value ? "text-muted-foreground" : "text-muted-foreground/60"
          )}
        >
          <Calendar className="h-3 w-3" />
          {displayValue || placeholder}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{label}</p>
            {(value || isCleared) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2 text-muted-foreground hover:text-destructive"
                onClick={handleClear}
              >
                Clear
              </Button>
            )}
          </div>

          {/* Month and Year Selectors */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Month</label>
              {isCleared ? (
                <Select 
                  key="month-cleared"
                  onValueChange={(val) => {
                    setSelectedMonth(val);
                    setIsCleared(false);
                  }}
                >
                  <SelectTrigger className="h-8 text-sm w-full">
                    <SelectValue placeholder={MONTHS.find(m => m.value === CURRENT_MONTH)?.label || "Month"} />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select 
                  value={selectedMonth || undefined} 
                  onValueChange={(val) => {
                    setSelectedMonth(val);
                    setIsCleared(false);
                  }}
                >
                  <SelectTrigger className="h-8 text-sm w-full">
                    <SelectValue placeholder={MONTHS.find(m => m.value === CURRENT_MONTH)?.label || "Month"} />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Year</label>
              {isCleared ? (
                <Select 
                  key="year-cleared"
                  onValueChange={(val) => {
                    setSelectedYear(val);
                    setIsCleared(false);
                  }}
                >
                  <SelectTrigger className="h-8 text-sm w-full">
                    <SelectValue placeholder={CURRENT_YEAR.toString()} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {YEARS.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select 
                  value={selectedYear || undefined} 
                  onValueChange={(val) => {
                    setSelectedYear(val);
                    setIsCleared(false);
                  }}
                >
                  <SelectTrigger className="h-8 text-sm w-full">
                    <SelectValue placeholder={CURRENT_YEAR.toString()} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {YEARS.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Full Date Toggle */}
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={isFullDate}
              onChange={(e) => {
                setIsFullDate(e.target.checked);
                if (!e.target.checked) {
                  // Switching to month-only, clear day
                  setSelectedDay(null);
                } else if (!selectedDay && selectedMonth && selectedYear) {
                  // Switching to full date, default to 1st
                  setSelectedDay("01");
                }
              }}
              className="rounded cursor-pointer disabled:cursor-not-allowed"
              disabled={isFormCleared}
            />
            Include specific day
          </label>

          {/* Day Selector (only shown in full date mode) */}
          {isFullDate && selectedMonth && selectedYear && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Day</label>
              <Select 
                value={selectedDay || undefined} 
                onValueChange={setSelectedDay}
              >
                <SelectTrigger className="h-8 text-sm w-full">
                  <SelectValue placeholder="Day" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {availableDays.map((day) => (
                    <SelectItem key={day} value={day}>
                      {parseInt(day, 10)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Save Button */}
          <Button
            size="sm"
            className="w-full"
            onClick={handleApply}
          >
            {isFormCleared ? "Clear Date" : "Save"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

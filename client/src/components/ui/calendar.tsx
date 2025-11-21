import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: cn(
          "relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/50 focus-within:ring-offset-1",
          "[&:has([aria-selected].day-range-middle)]:bg-gradient-to-r",
          "[&:has([aria-selected].day-range-middle)]:from-primary/10",
          "[&:has([aria-selected].day-range-middle)]:via-primary/10",
          "[&:has([aria-selected].day-range-middle)]:to-primary/10",
          "[&:has([aria-selected].day-range-start)]:bg-gradient-to-r",
          "[&:has([aria-selected].day-range-start)]:from-primary/20",
          "[&:has([aria-selected].day-range-start)]:to-primary/10",
          "[&:has([aria-selected].day-range-end)]:bg-gradient-to-r",
          "[&:has([aria-selected].day-range-end)]:from-primary/10",
          "[&:has([aria-selected].day-range-end)]:to-primary/20",
          "[&:has([aria-selected].day-range-start)]:rounded-l-full [&:has([aria-selected].day-range-end)]:rounded-r-full",
          "[&:has([aria-selected])]:shadow-[inset_0_0_0_1px_rgba(99,102,241,0.28)]"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-medium text-slate-800 aria-selected:opacity-100 hover:bg-primary/10 hover:text-primary focus-visible:bg-primary/10 focus-visible:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        ),
        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        day_selected:
          "bg-transparent text-primary font-semibold aria-selected:shadow-none",
        day_range_middle:
          "day-range-middle aria-selected:bg-transparent aria-selected:text-primary aria-selected:font-semibold",
        day_today: "bg-accent text-accent-foreground font-semibold",
        day_outside:
          "day-outside text-muted-foreground aria-selected:bg-transparent aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_hidden: "invisible",
        ...classNames,
      }}
      modifiersClassNames={{
        range_start:
          "bg-gradient-to-br from-primary via-primary to-indigo-500 text-white font-semibold rounded-full shadow-sm border border-primary/70",
        range_end:
          "bg-gradient-to-br from-primary via-indigo-500 to-primary text-white font-semibold rounded-full shadow-sm border border-primary/70",
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn("h-4 w-4", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn("h-4 w-4", className)} {...props} />
        ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }

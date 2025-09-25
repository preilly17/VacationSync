import { SharedExpenseForm } from "@/components/shared-expense-form";

export default function SharedExpensePage() {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-6xl flex-col gap-8 px-6 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Shared expenses</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Log a purchase once, let us split the source currency fairly, and send conversion-aware
          requests in your home currency. Rates are locked the moment you save the expense so
          everyone sees the same math.
        </p>
      </div>
      <SharedExpenseForm />
    </div>
  );
}

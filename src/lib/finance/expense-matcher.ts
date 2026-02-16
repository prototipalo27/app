import type { BankTransaction } from "@/lib/bbva-parser";

export interface FixedExpenseRow {
  id: string;
  name: string;
  amount: number;
  bank_vendor_name: string | null;
}

export interface ExpenseMatch {
  expenseId: string;
  expenseName: string;
  expectedAmount: number;
  matched: boolean;
  transaction: BankTransaction | null;
  amountDifference: number | null;
}

export function matchExpensesWithBank(
  expenses: FixedExpenseRow[],
  transactions: BankTransaction[]
): ExpenseMatch[] {
  return expenses.map((expense) => {
    if (!expense.bank_vendor_name) {
      return {
        expenseId: expense.id,
        expenseName: expense.name,
        expectedAmount: expense.amount,
        matched: false,
        transaction: null,
        amountDifference: null,
      };
    }

    const vendorKey = expense.bank_vendor_name.toLowerCase();
    const match = transactions.find(
      (t) => t.vendorName.toLowerCase() === vendorKey
    );

    if (!match) {
      return {
        expenseId: expense.id,
        expenseName: expense.name,
        expectedAmount: expense.amount,
        matched: false,
        transaction: null,
        amountDifference: null,
      };
    }

    return {
      expenseId: expense.id,
      expenseName: expense.name,
      expectedAmount: expense.amount,
      matched: true,
      transaction: match,
      amountDifference: Math.abs(match.amount) - expense.amount,
    };
  });
}

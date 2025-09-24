import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Plus, DollarSign, Clock, CheckCircle, Trash2, Edit } from "lucide-react";
import { AddExpenseModal } from "./add-expense-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ExpenseWithDetails, User } from "@shared/schema";

interface ExpenseTrackerProps {
  tripId: number;
  user?: User;
}

export function ExpenseTracker({ tripId, user }: ExpenseTrackerProps) {
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery<ExpenseWithDetails[]>({
    queryKey: [`/api/trips/${tripId}/expenses`],
  });

  const { data: balances } = useQuery({
    queryKey: [`/api/trips/${tripId}/expenses/balances`],
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: number) => {
      await apiRequest(`/api/expenses/${expenseId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/expenses`] });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/expenses/balances`] });
      toast({
        title: "Success",
        description: "Expense deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete expense",
        variant: "destructive",
      });
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (expenseId: number) => {
      await apiRequest(`/api/expenses/${expenseId}/mark-paid`, {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/expenses`] });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/expenses/balances`] });
      toast({
        title: "Success",
        description: "Expense marked as paid",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark expense as paid",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      food: 'bg-orange-100 text-orange-800',
      transport: 'bg-blue-100 text-blue-800',
      accommodation: 'bg-purple-100 text-purple-800',
      entertainment: 'bg-green-100 text-green-800',
      shopping: 'bg-pink-100 text-pink-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[category as keyof typeof colors] || colors.other;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Expenses</h3>
          <Button disabled>
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.totalAmount, 0);
  const userExpenses = expenses.filter(expense => expense.paidBy.id === user?.id);
  const userTotal = userExpenses.reduce((sum, expense) => sum + expense.totalAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Expenses</h3>
        <Button onClick={() => setIsAddExpenseModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Expense
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalExpenses)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">You Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(userTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">You Owe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency((balances as any)?.owes || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">You're Owed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency((balances as any)?.owed || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expenses List */}
      <div className="space-y-4">
        {expenses.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No expenses yet</p>
              <p className="text-sm">Add your first expense to start tracking costs</p>
            </CardContent>
          </Card>
        ) : (
          expenses.map((expense) => (
            <Card key={expense.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={expense.paidBy.profileImageUrl || undefined} />
                      <AvatarFallback>
                        {expense.paidBy.firstName?.[0] || expense.paidBy.email?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">{expense.description}</CardTitle>
                      <CardDescription className="text-sm">
                        Paid by {expense.paidBy.firstName || expense.paidBy.email} •{' '}
                        {expense.createdAt ? new Date(expense.createdAt).toLocaleDateString() : 'Unknown date'}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getCategoryColor(expense.category)}>
                      {expense.category}
                    </Badge>
                    <div className="text-right">
                      <div className="text-lg font-semibold">{formatCurrency(expense.totalAmount)}</div>
                      <div className="text-sm text-gray-500">
                        {formatCurrency(expense.totalAmount / expense.shares.length)} per person
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex -space-x-2">
                      {expense.shares.slice(0, 4).map((share, index) => (
                        <Avatar key={index} className="w-6 h-6 border-2 border-white">
                          <AvatarImage src={share.user.profileImageUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {share.user.firstName?.[0] || share.user.email?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {expense.shares.length > 4 && (
                        <div className="w-6 h-6 bg-gray-200 rounded-full border-2 border-white flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-600">
                            +{expense.shares.length - 4}
                          </span>
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">
                      {expense.shares.length} participants
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {expense.shares.find(share => share.userId === user?.id) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsPaidMutation.mutate(expense.id)}
                        disabled={markAsPaidMutation.isPending}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Mark Paid
                      </Button>
                    )}
                    {expense.paidBy.id === user?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteExpenseMutation.mutate(expense.id)}
                        disabled={deleteExpenseMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AddExpenseModal
        open={isAddExpenseModalOpen}
        onOpenChange={setIsAddExpenseModalOpen}
        tripId={tripId}
        currentUserId={user?.id}
      />
    </div>
  );
}
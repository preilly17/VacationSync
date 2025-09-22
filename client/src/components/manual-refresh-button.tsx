import React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function ManualRefreshButton() {
  const handleRefresh = async () => {
    localStorage.clear();
    sessionStorage.clear();
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Error refreshing session:', error);
    } finally {
      queryClient.clear();
      window.location.href = '/login';
    }
  };

  return (
    <Button 
      onClick={handleRefresh}
      variant="outline"
      size="sm"
      className="flex items-center gap-2"
    >
      <RefreshCw className="w-4 h-4" />
      Refresh Session
    </Button>
  );
}
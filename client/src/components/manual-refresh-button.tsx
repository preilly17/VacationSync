import React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function ManualRefreshButton() {
  const handleRefresh = () => {
    // Clear all storage and force a complete refresh
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/api/logout';
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
/**
 * Currency Converter Component
 * Provides real-time currency conversion for expenses
 */

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, DollarSign, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Currency {
  code: string;
  name: string;
  symbol: string;
}

interface CurrencyConversion {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  originalAmount: number;
  convertedAmount: number;
  lastUpdated: Date;
}

interface CurrencyConverterProps {
  amount: string;
  onAmountChange: (amount: string) => void;
  currency: string;
  onCurrencyChange: (currency: string) => void;
  tripId?: number;
  showConversion?: boolean;
  className?: string;
  onConversionChange?: (conversion: CurrencyConversion | null) => void;
  targetCurrency?: string;
  portalContainer?: HTMLElement | null;
}

export function CurrencyConverter({
  amount,
  onAmountChange,
  currency,
  onCurrencyChange,
  tripId,
  showConversion = true,
  className = "",
  onConversionChange,
  targetCurrency: propTargetCurrency,
  portalContainer,
}: CurrencyConverterProps) {
  const [targetCurrency, setTargetCurrency] = useState<string>(propTargetCurrency || "USD");
  const [conversionResult, setConversionResult] = useState<CurrencyConversion | null>(null);

  // Available currencies with popular travel destinations
  const currencies: Currency[] = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
    { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
    { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
    { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
    { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
    { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
    { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
    { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
    { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
    { code: 'THB', name: 'Thai Baht', symbol: '฿' },
    { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  ];

  // Update target currency when prop changes
  useEffect(() => {
    if (propTargetCurrency) {
      setTargetCurrency(propTargetCurrency);
    }
  }, [propTargetCurrency]);

  // Perform currency conversion using real exchange rates
  const convertCurrency = async () => {
    if (!amount || !currency || !targetCurrency || currency === targetCurrency) {
      setConversionResult(null);
      return;
    }

    try {
      const inputAmount = parseFloat(amount);
      if (isNaN(inputAmount) || inputAmount <= 0) {
        setConversionResult(null);
        return;
      }

      // Use the @fawazahmed0/currency-api for real exchange rates
      const response = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${currency.toLowerCase()}.json`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch exchange rates");
      }
      
      const data = await response.json();
      const rate = data[currency.toLowerCase()][targetCurrency.toLowerCase()];
      
      if (!rate) {
        throw new Error("Exchange rate not available");
      }
      
      const convertedAmount = inputAmount * rate;
      
      setConversionResult({
        fromCurrency: currency,
        toCurrency: targetCurrency,
        rate: rate,
        originalAmount: inputAmount,
        convertedAmount: convertedAmount,
        lastUpdated: new Date()
      });
      
    } catch (error) {
      console.error('Currency conversion error:', error);
      setConversionResult(null);
    }
  };

  // Notify parent of conversion changes
  useEffect(() => {
    onConversionChange?.(conversionResult);
  }, [conversionResult, onConversionChange]);

  // Auto-convert when values change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (showConversion && amount && parseFloat(amount) > 0) {
        convertCurrency();
      }
    }, 500); // Debounce conversions

    return () => clearTimeout(timer);
  }, [amount, currency, targetCurrency, showConversion]);

  // Format currency display
  const formatCurrency = (amount: number, currencyCode: string): string => {
    const currencyInfo = currencies.find(c => c.code === currencyCode);
    const symbol = currencyInfo?.symbol || currencyCode;
    
    switch (currencyCode) {
      case 'JPY':
      case 'KRW':
        return `${symbol}${Math.round(amount).toLocaleString()}`;
      default:
        return `${symbol}${amount.toFixed(2)}`;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Currency Input */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            className="text-lg font-semibold"
          />
        </div>
        <Select
          value={currency}
          onValueChange={onCurrencyChange}
          modal={false}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent container={portalContainer ?? undefined}>
            {currencies.map((curr) => (
              <SelectItem key={curr.code} value={curr.code}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{curr.symbol}</span>
                  <span className="text-sm text-gray-600">{curr.code}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Popular Currency Quick Switch */}
      {currency === "USD" && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
          <TrendingUp className="w-4 h-4 text-blue-600" />
          <span className="text-sm text-blue-800">Popular travel currencies:</span>
          <div className="flex gap-1 ml-auto">
            {['EUR', 'GBP', 'JPY', 'CAD'].map((curr) => (
              <Button
                key={curr}
                variant="outline"
                size="sm"
                onClick={() => onCurrencyChange(curr)}
                className="text-xs px-2 py-1 h-6"
              >
                {curr}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Currency Conversion Display */}
      {showConversion && amount && parseFloat(amount) > 0 && currency !== targetCurrency && (
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Currency Conversion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Target Currency Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Convert to:</span>
              <Select
                value={targetCurrency}
                onValueChange={setTargetCurrency}
                modal={false}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent container={portalContainer ?? undefined}>
                  {currencies
                    .filter(curr => curr.code !== currency)
                    .map((curr) => (
                      <SelectItem key={curr.code} value={curr.code}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{curr.symbol}</span>
                          <span className="text-sm">{curr.code}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={convertCurrency}
                className="p-1"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>

            {/* Conversion Result */}
            {conversionResult && (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-lg font-semibold text-green-600">
                      {formatCurrency(conversionResult.convertedAmount, conversionResult.toCurrency)}
                    </div>
                    <div className="text-xs text-gray-500">
                      1 {conversionResult.fromCurrency} = {conversionResult.rate.toFixed(4)} {conversionResult.toCurrency}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    Live Rate
                  </Badge>
                </div>
                
                <div className="text-xs text-gray-500 text-center">
                  Last updated: {new Date(conversionResult.lastUpdated).toLocaleTimeString()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Popular Currencies Quick Access */}
      {currency === "USD" && (
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-gray-600 mr-2">Quick select:</span>
          {['EUR', 'GBP', 'JPY', 'CAD', 'AUD'].map((curr) => (
            <Button
              key={curr}
              variant="outline"
              size="sm"
              onClick={() => onCurrencyChange(curr)}
              className="text-xs px-2 py-1 h-6"
            >
              {curr}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
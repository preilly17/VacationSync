import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Calculator, ArrowUpDown, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function CurrencyConverter() {
  const { toast } = useToast();
  const [amount, setAmount] = useState('100');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [conversionResult, setConversionResult] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  const currencies = [
    { code: 'USD', name: 'US Dollar', flag: '🇺🇸' },
    { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
    { code: 'GBP', name: 'British Pound', flag: '🇬🇧' },
    { code: 'JPY', name: 'Japanese Yen', flag: '🇯🇵' },
    { code: 'AUD', name: 'Australian Dollar', flag: '🇦🇺' },
    { code: 'CAD', name: 'Canadian Dollar', flag: '🇨🇦' },
    { code: 'CHF', name: 'Swiss Franc', flag: '🇨🇭' },
    { code: 'CNY', name: 'Chinese Yuan', flag: '🇨🇳' },
    { code: 'SEK', name: 'Swedish Krona', flag: '🇸🇪' },
    { code: 'NOK', name: 'Norwegian Krone', flag: '🇳🇴' },
    { code: 'DKK', name: 'Danish Krone', flag: '🇩🇰' },
    { code: 'PLN', name: 'Polish Zloty', flag: '🇵🇱' },
    { code: 'CZK', name: 'Czech Koruna', flag: '🇨🇿' },
    { code: 'HUF', name: 'Hungarian Forint', flag: '🇭🇺' },
    { code: 'INR', name: 'Indian Rupee', flag: '🇮🇳' },
    { code: 'SGD', name: 'Singapore Dollar', flag: '🇸🇬' },
    { code: 'HKD', name: 'Hong Kong Dollar', flag: '🇭🇰' },
    { code: 'KRW', name: 'South Korean Won', flag: '🇰🇷' },
    { code: 'THB', name: 'Thai Baht', flag: '🇹🇭' },
    { code: 'MXN', name: 'Mexican Peso', flag: '🇲🇽' },
  ];

  const convertCurrency = async () => {
    if (!amount || !fromCurrency || !toCurrency) {
      toast({
        title: "Currency Conversion Error",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    if (fromCurrency === toCurrency) {
      setConversionResult(`${amount} ${fromCurrency}`);
      setExchangeRate(1);
      return;
    }

    setIsConverting(true);
    try {
      const inputAmount = parseFloat(amount);
      if (isNaN(inputAmount)) {
        throw new Error("Invalid amount");
      }

      // Use the @fawazahmed0/currency-api for real exchange rates
      const response = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${fromCurrency.toLowerCase()}.json`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch exchange rates");
      }
      
      const data = await response.json();
      const rate = data[fromCurrency.toLowerCase()][toCurrency.toLowerCase()];
      
      if (!rate) {
        throw new Error("Exchange rate not available");
      }
      
      const convertedAmount = (inputAmount * rate).toFixed(2);
      setConversionResult(`${convertedAmount} ${toCurrency}`);
      setExchangeRate(rate);
      
      toast({
        title: "Currency Converted",
        description: `${inputAmount} ${fromCurrency} = ${convertedAmount} ${toCurrency}`,
      });
      
    } catch (error) {
      console.error("Currency conversion error:", error);
      toast({
        title: "Conversion Error",
        description: "Unable to convert currency. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConverting(false);
    }
  };

  const swapCurrencies = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
    // Clear previous result
    setConversionResult(null);
    setExchangeRate(null);
  };

  return (
    <div className="min-h-screen ocean-gradient">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-md border-b border-gray-200/50 px-4 lg:px-8 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3">
                  <Calculator className="w-8 h-8 text-blue-600" />
                  Currency Converter
                </h1>
                <p className="text-gray-600 mt-1">
                  Convert currencies with live exchange rates for travel planning
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-8">
        <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900 text-2xl">
              <DollarSign className="h-6 w-6" />
              Currency Exchange Calculator
            </CardTitle>
            <p className="text-blue-700">
              Get real-time exchange rates for your travel budget planning and expense management
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm font-medium">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="100"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-xl font-semibold h-12"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">From Currency</Label>
                <Select value={fromCurrency} onValueChange={setFromCurrency}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        <div className="flex items-center gap-2">
                          <span>{currency.flag}</span>
                          <span className="font-medium">{currency.code}</span>
                          <span className="text-sm text-gray-600">{currency.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">To Currency</Label>
                <Select value={toCurrency} onValueChange={setToCurrency}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        <div className="flex items-center gap-2">
                          <span>{currency.flag}</span>
                          <span className="font-medium">{currency.code}</span>
                          <span className="text-sm text-gray-600">{currency.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={swapCurrencies}
                  variant="outline"
                  size="sm"
                  className="p-3 h-12"
                >
                  <ArrowUpDown className="h-5 w-5" />
                </Button>
                <Button 
                  onClick={convertCurrency}
                  disabled={isConverting}
                  className="flex-1 h-12 text-lg"
                >
                  {isConverting ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Converting...
                    </div>
                  ) : (
                    <>
                      <Calculator className="h-5 w-5 mr-2" />
                      Convert
                    </>
                  )}
                </Button>
              </div>
            </div>

            {conversionResult && (
              <div className="bg-white/70 p-6 rounded-lg border border-green-200">
                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center gap-3">
                    <DollarSign className="h-6 w-6 text-green-600" />
                    <span className="text-3xl font-bold text-green-700">
                      {amount} {fromCurrency} = {conversionResult}
                    </span>
                  </div>
                  {exchangeRate && (
                    <div className="text-gray-600">
                      <p className="text-sm">Exchange rate: 1 {fromCurrency} = {exchangeRate.toFixed(4)} {toCurrency}</p>
                      <p className="text-xs mt-1">Live exchange rates • Updated in real-time</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick Currency Selection */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700">Popular Travel Currencies</h3>
              <div className="flex flex-wrap gap-2">
                {['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY'].map((currencyCode) => {
                  const currency = currencies.find(c => c.code === currencyCode);
                  return (
                    <Button
                      key={currencyCode}
                      variant="outline"
                      size="sm"
                      onClick={() => setFromCurrency(currencyCode)}
                      className="text-xs px-3 py-2 h-8"
                    >
                      {currency?.flag} {currencyCode}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Travel Tips */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">💡 Travel Currency Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-600">
            <p>• Exchange rates fluctuate constantly. Check rates regularly before your trip.</p>
            <p>• Consider using this converter when splitting expenses with friends during international travel.</p>
            <p>• Factor in a 2-3% margin for bank fees and exchange rate variations when budgeting.</p>
            <p>• Some countries prefer cash while others are card-friendly - research your destination!</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
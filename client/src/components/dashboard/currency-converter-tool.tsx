import { useEffect, useMemo, useRef, useState, useId, type RefObject } from "react";
import type { ClipboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeftRight,
  Copy,
  Loader2,
  Lock,
  Share2,
  Unlock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LastConversion } from "./converter-types";
import ModalLayout from "@/components/dashboard/modal-layout";

const RECENTS_KEY = "dashboard.converter.recents";
const RATE_CACHE_KEY = "dashboard.converter.rates";

const CURRENCIES = [
  { code: "USD", name: "US Dollar", flag: "🇺🇸" },
  { code: "EUR", name: "Euro", flag: "🇪🇺" },
  { code: "GBP", name: "British Pound", flag: "🇬🇧" },
  { code: "JPY", name: "Japanese Yen", flag: "🇯🇵" },
  { code: "AUD", name: "Australian Dollar", flag: "🇦🇺" },
  { code: "CAD", name: "Canadian Dollar", flag: "🇨🇦" },
  { code: "CHF", name: "Swiss Franc", flag: "🇨🇭" },
  { code: "CNY", name: "Chinese Yuan", flag: "🇨🇳" },
  { code: "SEK", name: "Swedish Krona", flag: "🇸🇪" },
  { code: "NOK", name: "Norwegian Krone", flag: "🇳🇴" },
  { code: "DKK", name: "Danish Krone", flag: "🇩🇰" },
  { code: "PLN", name: "Polish Zloty", flag: "🇵🇱" },
  { code: "CZK", name: "Czech Koruna", flag: "🇨🇿" },
  { code: "HUF", name: "Hungarian Forint", flag: "🇭🇺" },
  { code: "INR", name: "Indian Rupee", flag: "🇮🇳" },
  { code: "SGD", name: "Singapore Dollar", flag: "🇸🇬" },
  { code: "HKD", name: "Hong Kong Dollar", flag: "🇭🇰" },
  { code: "KRW", name: "South Korean Won", flag: "🇰🇷" },
  { code: "THB", name: "Thai Baht", flag: "🇹🇭" },
  { code: "MXN", name: "Mexican Peso", flag: "🇲🇽" },
  { code: "BRL", name: "Brazilian Real", flag: "🇧🇷" },
  { code: "ZAR", name: "South African Rand", flag: "🇿🇦" },
  { code: "NZD", name: "New Zealand Dollar", flag: "🇳🇿" },
  { code: "TRY", name: "Turkish Lira", flag: "🇹🇷" },
  { code: "AED", name: "UAE Dirham", flag: "🇦🇪" },
];

type RateSource = "live" | "cached" | "offline";

type RateCacheEntry = {
  rates: Record<string, number>;
  timestamp: number;
};

type CurrencyConverterToolProps = {
  onClose: () => void;
  lastConversion: LastConversion | null;
  onConversion: (conversion: LastConversion) => void;
  mobile?: boolean;
  autoFocusAmount?: boolean;
  closeButtonRef?: RefObject<HTMLButtonElement>;
};

export default function CurrencyConverterTool({
  onClose,
  lastConversion,
  onConversion,
  mobile = false,
  autoFocusAmount = false,
  closeButtonRef,
}: CurrencyConverterToolProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(() =>
    lastConversion ? String(lastConversion.amount) : "100",
  );
  const [fromCurrency, setFromCurrency] = useState(
    lastConversion?.from ?? "USD",
  );
  const [toCurrency, setToCurrency] = useState(lastConversion?.to ?? "EUR");
  const [result, setResult] = useState<number | null>(lastConversion?.result ?? null);
  const [rate, setRate] = useState<number | null>(lastConversion?.rate ?? null);
  const [rateTimestamp, setRateTimestamp] = useState<number | null>(
    lastConversion?.timestamp ?? null,
  );
  const [rateSource, setRateSource] = useState<RateSource | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFee, setShowFee] = useState(false);
  const [feeBps, setFeeBps] = useState<number | null>(null);
  const [lockedRate, setLockedRate] = useState<number | null>(null);
  const [lockedTimestamp, setLockedTimestamp] = useState<number | null>(null);
  const [recents, setRecents] = useState<LastConversion[]>([]);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const autoConvertedRef = useRef(false);

  useEffect(() => {
    if (!autoFocusAmount) {
      return;
    }
    const input = amountInputRef.current;
    if (!input) {
      return;
    }
    if (typeof window === "undefined") {
      input.focus();
      input.select();
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [autoFocusAmount]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const stored = window.localStorage.getItem(RECENTS_KEY);
      if (!stored) {
        return;
      }
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setRecents(
          parsed
            .filter((item): item is LastConversion =>
              item && typeof item.amount === "number" && typeof item.rate === "number",
            )
            .slice(0, 3),
        );
      }
    } catch (storageError) {
      console.warn("Failed to load converter recents", storageError);
    }
  }, []);

  useEffect(() => {
    if (!autoConvertedRef.current && lastConversion) {
      autoConvertedRef.current = true;
      void performConversion(lastConversion.amount, lastConversion.from, lastConversion.to);
    }
  }, [lastConversion]);

  const formatResult = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [],
  );

  const formatRate = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 4,
        maximumFractionDigits: 6,
      }),
    [],
  );

  const handleAmountPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text");
    if (!text) {
      return;
    }
    const parsed = parseCurrencySnippet(text);
    if (parsed) {
      event.preventDefault();
      setAmount(parsed.amount);
      if (parsed.currency) {
        setFromCurrency(parsed.currency);
      }
    }
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
  };

  const updateRecents = (conversion: LastConversion) => {
    setRecents((prev) => {
      const withoutDuplicate = prev.filter(
        (entry) => !(entry.from === conversion.from && entry.to === conversion.to),
      );
      const updated = [conversion, ...withoutDuplicate].slice(0, 3);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
        } catch (storageError) {
          console.warn("Failed to persist converter recents", storageError);
        }
      }
      return updated;
    });
  };

  const performConversion = async (
    overrideAmount?: number,
    overrideFrom?: string,
    overrideTo?: string,
  ) => {
    setError(null);
    const amountToUse = overrideAmount ?? normalizeAmount(amount);
    if (amountToUse == null) {
      setError("Enter a valid amount");
      return;
    }

    const from = (overrideFrom ?? fromCurrency).toUpperCase();
    const to = (overrideTo ?? toCurrency).toUpperCase();

    if (from === to) {
      const conversion: LastConversion = {
        amount: amountToUse,
        from,
        to,
        rate: 1,
        result: amountToUse,
        timestamp: Date.now(),
      };
      setResult(conversion.result);
      setRate(1);
      setRateSource("live");
      setRateTimestamp(conversion.timestamp);
      onConversion(conversion);
      updateRecents(conversion);
      return;
    }

    setIsConverting(true);

    try {
      let fxRate = lockedRate;
      let source: RateSource = lockedRate ? "cached" : "live";
      let timestamp = lockedTimestamp ?? Date.now();

      if (lockedRate == null) {
        const fetched = await getRatesForBase(from);
        fxRate = fetched.rates[to.toLowerCase()];
        if (fxRate == null) {
          throw new Error(`Rate for ${from}/${to} not available`);
        }
        source = fetched.source;
        timestamp = fetched.timestamp;
      }

      const effectiveRate = applyFee(fxRate!, feeBps);
      const convertedAmount = amountToUse * effectiveRate;

      setResult(convertedAmount);
      setRate(effectiveRate);
      setRateTimestamp(timestamp);
      setRateSource(source);

      const conversion: LastConversion = {
        amount: amountToUse,
        from,
        to,
        rate: effectiveRate,
        result: convertedAmount,
        timestamp,
      };
      onConversion(conversion);
      updateRecents(conversion);
    } catch (conversionError) {
      console.error("Failed to convert currency", conversionError);
      setError(conversionError instanceof Error ? conversionError.message : "Conversion failed");
    } finally {
      setIsConverting(false);
    }
  };

  const handleSwap = async () => {
    const prevFrom = fromCurrency;
    const prevTo = toCurrency;
    setFromCurrency(prevTo);
    setToCurrency(prevFrom);
    await performConversion(undefined, prevTo, prevFrom);
  };

  const handleCopy = async () => {
    if (result == null) {
      return;
    }
    const text = `${formatResult.format(normalizeAmount(amount) ?? 0)} ${fromCurrency} ≈ ${formatResult.format(result)} ${toCurrency}`;
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast({
        title: "Clipboard unavailable",
        description: "Your browser does not allow copying right now.",
        variant: "destructive",
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: "Conversion copied to clipboard." });
    } catch (copyError) {
      console.warn("Failed to copy conversion", copyError);
      toast({
        title: "Copy failed",
        description: "We couldn't copy that. Try again.",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    if (result == null) {
      return;
    }
    const text = `${formatResult.format(normalizeAmount(amount) ?? 0)} ${fromCurrency} ≈ ${formatResult.format(result)} ${toCurrency}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Currency conversion", text });
      } catch (shareError) {
        if ((shareError as DOMException).name !== "AbortError") {
          toast({
            title: "Share failed",
            description: "Unable to open the share sheet.",
            variant: "destructive",
          });
        }
      }
    } else {
      await handleCopy();
    }
  };

  const toggleLockRate = () => {
    if (lockedRate != null) {
      setLockedRate(null);
      setLockedTimestamp(null);
      toast({ title: "Rate unlocked", description: "You’ll now receive fresh updates." });
      return;
    }

    if (rate != null) {
      setLockedRate(rate);
      setLockedTimestamp(rateTimestamp ?? Date.now());
      toast({ title: "Rate locked", description: "We’ll reuse this rate until you unlock." });
    }
  };

  const handleRecentSelect = (recent: LastConversion) => {
    setAmount(String(recent.amount));
    setFromCurrency(recent.from);
    setToCurrency(recent.to);
    void performConversion(recent.amount, recent.from, recent.to);
  };

  const timestampDescriptor = rateTimestamp
    ? new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(rateTimestamp)
    : null;

  useEffect(() => {
    setLockedRate(null);
    setLockedTimestamp(null);
  }, [fromCurrency, toCurrency]);

  return (
    <ModalLayout
      onClose={onClose}
      closeButtonRef={closeButtonRef}
      closeLabel="Close currency converter"
      headerClassName={cn(
        mobile ? "px-5 pt-6 pb-3" : "px-6 py-5",
        "sm:px-8",
      )}
      bodyClassName={cn(
        "px-6 pb-6 pt-2 sm:px-8",
        mobile ? "px-5 sm:px-8" : null,
      )}
      header={
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">Currency converter</h2>
          <p className="text-sm text-slate-500">Live mid-market rates with offline fallbacks.</p>
        </div>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void performConversion();
        }}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="converter-amount">Amount</Label>
            <Input
              id="converter-amount"
              ref={amountInputRef}
              value={amount}
              inputMode="decimal"
              autoComplete="off"
              onFocus={(event) => event.target.select()}
              onChange={(event) => handleAmountChange(event.target.value)}
              onPaste={handleAmountPaste}
              placeholder="100"
              className="h-12 rounded-xl text-lg font-semibold"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <CurrencyCombobox
              label="From"
              value={fromCurrency}
              onChange={(value) => {
                setFromCurrency(value);
                void performConversion(undefined, value, undefined);
              }}
            />
            <CurrencyCombobox
              label="To"
              value={toCurrency}
              onChange={(value) => {
                setToCurrency(value);
                void performConversion(undefined, undefined, value);
              }}
            />
          </div>

          {showFee ? (
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="converter-fee">Fee (bps)</Label>
                <Input
                  id="converter-fee"
                  value={feeBps ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "") {
                      setFeeBps(null);
                      return;
                    }
                  const numeric = Number(value);
                  if (Number.isFinite(numeric)) {
                      setFeeBps(Math.min(10000, Math.max(0, numeric)));
                  }
                }}
                  placeholder="25"
                  inputMode="numeric"
                  className="h-11 rounded-xl"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowFee(false);
                  setFeeBps(null);
                }}
              >
                Remove fee
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="w-fit text-slate-600 hover:text-slate-800"
              onClick={() => setShowFee(true)}
            >
              + Add fee
            </Button>
          )}
        </div>

        {recents.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {recents.map((recent) => (
              <Button
                key={`${recent.from}-${recent.to}`}
                type="button"
                variant="secondary"
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                onClick={() => handleRecentSelect(recent)}
              >
                {recent.from} → {recent.to}
              </Button>
            ))}
          </div>
        ) : null}

        <div className="space-y-3 rounded-2xl bg-slate-50/80 p-4" aria-live="polite">
          <div className="text-2xl font-semibold text-slate-900">
            {result != null
              ? `${formatResult.format(result)} ${toCurrency}`
              : "Conversion pending"}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {rate != null ? (
              <span>
                1 {fromCurrency} = {formatRate.format(rate)} {toCurrency}
              </span>
            ) : (
              <span>Rate updates after conversion</span>
            )}
            {rateSource ? (
              <Badge variant="outline" className="rounded-full border-slate-300 text-slate-600">
                {rateSource === "live"
                  ? "Live rate"
                  : rateSource === "offline"
                    ? "Offline—cached"
                    : "Cached"}
              </Badge>
            ) : null}
            {timestampDescriptor ? <span>as of {timestampDescriptor}</span> : null}
            {lockedRate != null ? (
              <Badge variant="secondary" className="rounded-full bg-slate-900 text-white">
                Rate locked
              </Badge>
            ) : null}
          </div>
        </div>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="rounded-full px-5" disabled={isConverting}>
            {isConverting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Convert
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => void handleSwap()}
          >
            <ArrowLeftRight className="mr-2 h-4 w-4" /> Swap
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => void handleCopy()}
            disabled={result == null}
          >
            <Copy className="mr-2 h-4 w-4" /> Copy
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => void handleShare()}
            disabled={result == null}
          >
            <Share2 className="mr-2 h-4 w-4" /> Share
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={toggleLockRate}
            disabled={rate == null}
          >
            {lockedRate != null ? (
              <>
                <Unlock className="mr-2 h-4 w-4" /> Unlock rate
              </>
            ) : (
              <>
                <Lock className="mr-2 h-4 w-4" /> Lock rate
              </>
            )}
          </Button>
        </div>
      </form>
    </ModalLayout>
  );
}

type CurrencyComboboxProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function CurrencyCombobox({ label, value, onChange }: CurrencyComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = CURRENCIES.find((currency) => currency.code === value);
  const searchInputId = useId();
  const normalizedLabel = label.toLowerCase().replace(/\s+/g, "-");
  const comboboxInputId = `${normalizedLabel}-search-${searchInputId}`;
  const comboboxInputName = `${normalizedLabel}-currency-search`;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            type="button"
            role="combobox"
            aria-expanded={open}
            className="h-12 w-full justify-between rounded-xl border-slate-200 bg-white text-left"
          >
            {selected ? (
              <span className="flex flex-1 items-center gap-3">
                <span className="text-xl">{selected.flag}</span>
                <span className="font-semibold text-slate-900">{selected.code}</span>
                <span className="text-xs text-slate-500">{selected.name}</span>
              </span>
            ) : (
              "Select currency"
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            <CommandInput
              id={comboboxInputId}
              name={comboboxInputName}
              placeholder="Search currency..."
            />
            <CommandEmpty>No currency found.</CommandEmpty>
            <CommandList>
              <CommandGroup>
                {CURRENCIES.map((currency) => (
                  <CommandItem
                    key={currency.code}
                    value={`${currency.code} ${currency.name}`}
                    onSelect={() => {
                      onChange(currency.code);
                      setOpen(false);
                    }}
                  >
                    <span className="mr-3 text-xl">{currency.flag}</span>
                    <span className="font-medium">{currency.code}</span>
                    <span className="ml-2 text-xs text-slate-500">{currency.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

type FetchRatesResult = {
  rates: Record<string, number>;
  timestamp: number;
  source: RateSource;
};

async function getRatesForBase(base: string): Promise<FetchRatesResult> {
  const lowerBase = base.toLowerCase();
  const cached = readRateCache(lowerBase);

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    if (cached) {
      return { ...cached, source: "offline" };
    }
    throw new Error("No cached rates available offline");
  }

  try {
    const response = await fetch(
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${lowerBase}.json`,
    );
    if (!response.ok) {
      throw new Error("Failed to fetch latest rates");
    }
    const data = await response.json();
    const rates = data[lowerBase] as Record<string, number> | undefined;
    if (!rates) {
      throw new Error("Rates not available for this currency");
    }
    const entry: RateCacheEntry = {
      rates,
      timestamp: Date.now(),
    };
    writeRateCache(lowerBase, entry);
    return { ...entry, source: "live" };
  } catch (error) {
    if (cached) {
      return { ...cached, source: "cached" };
    }
    throw error;
  }
}

function readRateCache(base: string): RateCacheEntry | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const store = window.localStorage.getItem(RATE_CACHE_KEY);
    if (!store) {
      return null;
    }
    const parsed = JSON.parse(store);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const entry = parsed[base];
    if (!entry) {
      return null;
    }
    if (typeof entry.timestamp !== "number" || typeof entry.rates !== "object") {
      return null;
    }
    return entry as RateCacheEntry;
  } catch (error) {
    console.warn("Failed to parse rate cache", error);
    return null;
  }
}

function writeRateCache(base: string, entry: RateCacheEntry) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const store = window.localStorage.getItem(RATE_CACHE_KEY);
    const parsed = store ? JSON.parse(store) : {};
    window.localStorage.setItem(
      RATE_CACHE_KEY,
      JSON.stringify({ ...parsed, [base]: entry }),
    );
  } catch (error) {
    console.warn("Failed to write rate cache", error);
  }
}

function normalizeAmount(value: string): number | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const sanitized = trimmed.replace(/[^0-9.,]/g, "");
  const decimalSeparator = sanitized.includes(",") && !sanitized.includes(".") ? "," : ".";
  const normalized =
    decimalSeparator === ","
      ? sanitized.replace(/\./g, "").replace(",", ".")
      : sanitized.replace(/,/g, "");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseCurrencySnippet(value: string): { amount: string; currency?: string } | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const currencyMatch = trimmed.match(/[A-Z]{3}/i);
  const symbolMatch = trimmed.match(/[€$£¥₹₩₽₪₫₴₱₦₲฿]/);
  const amountMatch = trimmed.match(/[0-9]+[0-9.,]*/);
  if (!amountMatch) {
    return null;
  }
  let currency: string | undefined;
  if (currencyMatch) {
    currency = currencyMatch[0].toUpperCase();
  } else if (symbolMatch) {
    currency = symbolToIso(symbolMatch[0]);
  }
  const normalizedAmount = amountMatch[0]
    .replace(/[^0-9.,]/g, "")
    .replace(/\.(?=.*\.)/g, "")
    .replace(/,/g, ".");
  return { amount: normalizedAmount, currency };
}

function symbolToIso(symbol: string): string | undefined {
  const mapping: Record<string, string> = {
    "€": "EUR",
    "$": "USD",
    "£": "GBP",
    "¥": "JPY",
    "₹": "INR",
    "₩": "KRW",
    "₽": "RUB",
    "₪": "ILS",
    "₫": "VND",
    "₴": "UAH",
    "₱": "PHP",
    "₦": "NGN",
    "₲": "PYG",
    "฿": "THB",
  };
  return mapping[symbol];
}

function applyFee(rate: number, feeBps: number | null): number {
  if (feeBps == null || feeBps <= 0) {
    return rate;
  }
  const feeMultiplier = 1 - feeBps / 10000;
  return rate * feeMultiplier;
}


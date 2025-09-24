import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation, Link } from "wouter";
import { Plane, User, Lock, Eye, EyeOff } from "lucide-react";

const loginSchema = z.object({
  usernameOrEmail: z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);

  const searchParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const returnToParam = searchParams.get("returnTo");
  const safeReturnTo =
    returnToParam && returnToParam.startsWith("/") ? returnToParam : null;

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      usernameOrEmail: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
      setLocation(safeReturnTo ?? "/"); // ✅ redirect into app
    },
    onError: (error) => {
      let errorMessage = "Invalid username/email or password.";
      const message = error instanceof Error ? error.message : "";

      if (message.includes("not found")) {
        errorMessage =
          "Account not found. Please check your credentials or create a new account.";
      } else if (message.includes("password")) {
        errorMessage = "Incorrect password. Please try again.";
      }

      toast({
        title: "Login failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-white/15 bg-white/10 shadow-[0_32px_90px_-32px_rgba(2,6,23,0.9)]">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/10 shadow-[0_20px_60px_-30px_rgba(56,189,248,0.6)]">
              <Plane className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-semibold text-white">Welcome back</CardTitle>
          <CardDescription className="text-white/70">
            Sign in to your TripSync account to continue planning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="usernameOrEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username or Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-4 top-3.5 h-4 w-4 text-white/40" />
                        <Input
                          placeholder="john@example.com or johndoe"
                          className="pl-11 bg-white/5 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-primary"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-4 top-3.5 h-4 w-4 text-white/40" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pl-11 pr-11 bg-white/5 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-primary"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1.5 top-1.5 h-7 w-7 rounded-full bg-white/5 text-white/60 hover:bg-white/10"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center">
            <p className="text-sm text-white/70">
              Don't have an account?{" "}
              <Link
                href="/register"
                className="font-medium text-emerald-300 hover:text-emerald-200"
              >
                Create one here
              </Link>
            </p>
          </div>

          <div className="mt-4 text-center">
            <Link
              href="/forgot-password"
              className="text-sm text-white/60 hover:text-white"
            >
              Forgot your password?
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

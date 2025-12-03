import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { Plane, User, Mail, Phone, Lock, Eye, EyeOff } from "lucide-react";

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  phoneNumber: z.string().min(10, "Phone number is required for payment app integration").regex(/^\+?[\d\s\-\(\)]+$/, "Please enter a valid phone number"),
  username: z.string().min(3, "Username must be at least 3 characters").max(20, "Username must be less than 20 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function Register() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      username: "",
      password: "",
      confirmPassword: "",
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFormData) => {
      const response = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phoneNumber: data.phoneNumber,
          username: data.username,
          password: data.password,
        },
      });
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "Account created successfully!",
        description: "You can now log in with your credentials.",
      });
      setLocation('/login');
    },
    onError: (error: any) => {
      let errorMessage = "Failed to create account. Please try again.";
      
      if (error.message.includes("username")) {
        errorMessage = "Username is already taken. Please choose a different one.";
      } else if (error.message.includes("email")) {
        errorMessage = "Email is already registered. Please use a different email or log in.";
      }
      
      toast({
        title: "Registration failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50 px-4 py-12">
      <Card className="w-full max-w-2xl border border-slate-200/80 bg-white/95 text-slate-900 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
        <CardHeader className="space-y-4 text-center">
          <div className="flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 shadow-[0_10px_30px_-12px_rgba(16,185,129,0.45)]">
              <Plane className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
          <CardTitle className="text-3xl font-semibold">Create your account</CardTitle>
          <CardDescription className="text-slate-600">
            Join TripSync to start planning unforgettable group adventures together
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700">First Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John"
                          className="bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700">Last Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Doe"
                          className="bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700">Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="john@example.com"
                          className="pl-11 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary"
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
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700">Phone Number</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                        <Input
                          type="tel"
                          placeholder="+1 (555) 123-4567"
                          className="pl-11 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <p className="mt-1 text-xs text-slate-600">
                      Used for CashApp and Venmo payment integration
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700">Username</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="johndoe"
                          className="pl-11 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary"
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
                    <FormLabel className="text-slate-700">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pl-11 pr-11 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1.5 top-1.5 h-7 w-7 rounded-full text-slate-500 hover:bg-slate-100"
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

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700">Confirm Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pl-11 pr-11 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1.5 top-1.5 h-7 w-7 rounded-full text-slate-500 hover:bg-slate-100"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? (
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

              <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? "Creating Account..." : "Create Account"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-emerald-600 hover:text-emerald-500"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
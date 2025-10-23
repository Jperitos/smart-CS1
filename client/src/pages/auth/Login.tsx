import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Recycle } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";

import { useNavigate } from "react-router-dom";
import api from "@/lib/api";

type LoginProps = {
  onOpenRegister?: () => void;
  onClose?: () => void;
};

const Login = ({ onOpenRegister, onClose }: LoginProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  const { login, loading } = useAuth();
  const handleGoogleSignIn = () => {
    if (!agreeToTerms) {
      alert("Please agree to the terms and conditions to continue.");
      return;
    }
    window.location.href = "http://localhost:8000/auth/google";
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreeToTerms) {
      alert("Please agree to the terms and conditions to continue.");
      return;
    }

    try {
      await login(email, password);
    } catch (error) {
      // Error handling is done in the context
      console.error("Login failed:", error);
    }
  };

  return (
    <Card className="w-full max-w-md relative bg-white dark:bg-slate-900">
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-2xl font-bold text-gray-600 hover:text-black dark:text-gray-300 dark:hover:text-white z-10"
      >
        ×
      </button>

      <CardHeader className="text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <img src="../public/logo-final2.png" alt="EcoBin Logo" className="w-8 h-8 align-middle" />
          <span className="text-xl font-bold text-green-800 dark:text-green-400">ECOBIN</span>
        </div>
        <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">Welcome Back</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <Button
          onClick={handleGoogleSignIn}
          variant="outline"
          className="w-full flex items-center justify-center gap-2 border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-slate-800"
          disabled={!agreeToTerms}
        >
          {/* Google SVG */}
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full dark:bg-gray-600" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white dark:bg-slate-900 px-2 text-muted-foreground dark:text-gray-400">
              Or continue with
            </span>
          </div>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email" className="dark:text-gray-300">
              Email
            </Label>
            <Input
              id="login-email"
              type="email"
              placeholder="Enter your email"
              className="dark:bg-slate-800 dark:text-white dark:border-gray-600"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2 relative">
            <Label htmlFor="password" className="dark:text-gray-300">
              Password
            </Label>
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              className="dark:bg-slate-800 dark:text-white dark:border-gray-600 pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-9 text-gray-500 dark:text-gray-300 hover:text-gray-700"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {/* Terms and Conditions Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="agree-terms"
              checked={agreeToTerms}
              onCheckedChange={(checked) => setAgreeToTerms(checked as boolean)}
              className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 data-[state=checked]:text-white h-4 w-4"
            />
            <label
              htmlFor="agree-terms"
              className="text-xs font-regukar leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-300 cursor-pointer"
            >
              I agree to the{" "}
              <Link
                to="/terms"
                className="text-green-600 hover:underline dark:text-green-400"
                target="_blank"
                rel="noopener noreferrer"
              >
                Terms and Conditions
              </Link>
            </label>
          </div>

          <Button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
            disabled={loading || !agreeToTerms}
          >
            {loading ? "Signing In..." : "Sign In"}
          </Button>
        </form>

        <div className="text-center text-sm">
          <Link to="/forgot-password" className="text-green-600 hover:underline dark:text-green-400">
            Forgot your password?
          </Link>
        </div>

        {/* <div className="text-center text-sm">
          Don’t have an account?{" "}
          <button onClick={onOpenRegister} className="text-green-600 hover:underline dark:text-green-400">
            Sign up
          </button>
        </div> */}
      </CardContent>
    </Card>
  );
};

export default Login;

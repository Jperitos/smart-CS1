import { Button } from "@/components/ui/button";
import { Recycle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import Login from "../auth/Login";
import Register from "../auth/Register";

const Header = () => {
  const navigate = useNavigate();

  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-green-100 dark:border-slate-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img src="/logo-final2.png" alt="EcoBin Logo" className="w-8 h-8 align-middle" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">ECOBIN</span>
            </div>

            <nav className="hidden md:flex space-x-8">
              <a
                href="#features"
                className="text-gray-700 hover:text-green-600 dark:text-gray-300 dark:hover:text-green-400 transition-colors"
              >
                Features
              </a>
              <a
                href="#benefits"
                className="text-gray-700 hover:text-green-600 dark:text-gray-300 dark:hover:text-green-400 transition-colors"
              >
                Benefits
              </a>
              <a
                href="#feedback"
                className="text-gray-700 hover:text-green-600 dark:text-gray-300 dark:hover:text-green-400 transition-colors"
              >
                Feedback
              </a>
              <a
                href="#contact"
                className="text-gray-700 hover:text-green-600 dark:text-gray-300 dark:hover:text-green-400 transition-colors"
              >
                Contact
              </a>
            </nav>
            <div className="flex items-center space-x-4">
              <Button
                className="bg-white text-green-600 border border-green-600 hover:bg-green-50 dark:bg-slate-800 dark:text-green-400 dark:border-green-500 dark:hover:bg-slate-700 px-5 py-2"
                onClick={() => setShowLogin(true)}
              >
                Login
              </Button>
              {/* <Button
                className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-800 px-5 py-2"
                onClick={() => setShowRegister(true)}
              >
                Register
              </Button> */}
            </div>
          </div>
        </div>
      </header>

      {showLogin && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="relative w-full max-w-md bg-white0 p-6 rounded-lg shadow-lg">
            <Login
              onOpenRegister={() => {
                setShowLogin(false);
                setShowRegister(true);
              }}
              onClose={() => setShowLogin(false)}
            />
          </div>
        </div>
      )}

      {showRegister && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="relative w-full max-w-md   p-6 rounded-lg shadow-lg">
            <Register
              onOpenLogin={() => {
                setShowRegister(false);
                setShowLogin(true);
              }}
              onClose={() => setShowRegister(false)}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default Header;

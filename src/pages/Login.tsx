import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/UI/Button';
import { Card } from '../components/UI/Card';
import { LogIn, ArrowLeftRight, Eye, EyeOff, Key, User, Lock, ArrowLeft } from 'lucide-react';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const isRTL = language === 'ar';

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setError('');
    setSuccessMessage('');
  }, [showForgot]);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const success = await login(username, password);
      if (!success) {
        setError(isRTL ? 'اسم مستخدم أو كلمة مرور غير صحيحة' : 'Invalid username or password');
      }
    } catch {
      setError(isRTL ? 'حدث خطأ أثناء تسجيل الدخول' : 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    setTimeout(() => {
      setSuccessMessage(isRTL 
        ? 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني'
        : 'A password reset link has been sent to your email'
      );
      setLoading(false);
    }, 1000);
  };

  const handleBackToLogin = () => {
    setShowForgot(false);
    setEmail('');
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-gradient-to-br from-amber-100 via-orange-100 to-amber-200 flex flex-col items-center justify-center p-4 sm:p-6"
      style={{ fontFamily: 'Alexandria, sans-serif' }}
    >
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-6 items-center flex-1">
        {/* Left Side - Branding */}
        <div
          className={`hidden md:flex flex-col items-center justify-center text-center space-y-6 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-x-0' : (isRTL ? 'opacity-0 translate-x-20' : 'opacity-0 -translate-x-20')
          }`}
        >
          <div className="relative group">
            <img
              src="/logo.png"
              alt={isRTL ? 'الجوديا' : 'Al-Joudia'}
              width={160}
              height={160}
              className="mx-auto drop-shadow-md transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute -inset-3 bg-gradient-to-r from-amber-200/30 to-orange-200/30 rounded-full blur-lg transition-opacity duration-500 group-hover:opacity-100" />
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-amber-800">
              {isRTL ? 'مرحباً بك في نظام الجوديا' : 'Welcome to Al-Joudia System'}
            </h1>
            <p className="text-lg text-amber-700 max-w-sm mx-auto leading-relaxed">
              {isRTL
                ? 'اكتشف تجربة إدارة مبتكرة لمصنع الجوديا مع تتبع ذكي للعمليات الداخلية وتنسيق سلس بين الإنتاج والفروع لتعزيز الكفاءة'
                : 'Discover an innovative management experience for the sweets factory, with smart tracking of internal operations and seamless coordination between production and branches to enhance efficiency'}
            </p>
          </div>
        </div>

        {/* Right Side - Form */}
        <div
          className={`w-full max-w-sm mx-auto transition-all duration-700 ease-out delay-200 ${
            mounted ? 'opacity-100 translate-x-0' : (isRTL ? 'opacity-0 -translate-x-20' : 'opacity-0 translate-x-20')
          }`}
        >
          <Card className="border-amber-100/50 shadow-md bg-white/90 backdrop-blur-sm rounded-xl overflow-hidden p-5 sm:p-6">
            <div className="text-center space-y-3 mb-5">
              <div className="md:hidden relative mx-auto w-fit group">
                <img
                  src="/logo.png"
                  alt="الجوديا"
                  width={70}
                  height={70}
                  className="transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute -inset-2 bg-gradient-to-r from-amber-200/20 to-orange-200/20 rounded-full blur-md transition-opacity duration-500 group-hover:opacity-100" />
              </div>

              <h1 className="text-xl sm:text-2xl font-bold text-amber-800">
                {showForgot 
                  ? (isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Password')
                  : (isRTL ? 'تسجيل الدخول' : 'Login')
                }
              </h1>
              <p className="text-sm sm:text-base text-amber-600">
                {showForgot
                  ? (isRTL ? 'أدخل بريدك الإلكتروني لتلقي رابط الإعادة' : 'Enter your email to receive a reset link')
                  : (isRTL ? 'أدخل بياناتك للوصول إلى لوحة التحكم' : 'Enter your credentials to access the dashboard')
                }
              </p>
            </div>

            <div className="space-y-5">
              {error && (
                <div className="p-3 bg-red-50/70 border border-red-100 rounded-md">
                  <p className="text-red-700 text-xs sm:text-sm">{error}</p>
                </div>
              )}
              {successMessage && (
                <div className="p-3 bg-green-50/70 border border-green-100 rounded-md">
                  <p className="text-green-700 text-xs sm:text-sm">{successMessage}</p>
                </div>
              )}

              {!showForgot ? (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Username Field */}
                  <div>
                    <label className="block text-amber-800 text-sm sm:text-base font-medium mb-2">
                      {isRTL ? 'اسم المستخدم' : 'Username'}
                    </label>
                    <div className="relative group">
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-2.5 bg-white/10 border border-amber-100/50 rounded-md focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20 text-xs sm:text-sm outline-none transition-all duration-300 hover:bg-white/20`}
                        placeholder={isRTL ? 'أدخل اسم المستخدم' : 'Enter username'}
                        required
                      />
                      <div className={`absolute inset-y-0 ${isRTL ? 'right-0' : 'left-0'} flex items-center justify-center w-12 pointer-events-none`}>
                        <User className="h-5 w-5 text-amber-600 group-hover:text-amber-800 transition-colors" />
                      </div>
                    </div>
                  </div>

                  {/* Password Field */}
                  <div>
                    <label className="block text-amber-800 text-sm sm:text-base font-medium mb-2">
                      {isRTL ? 'كلمة المرور' : 'Password'}
                    </label>
                    <div className="relative group">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full ${isRTL ? 'pr-12 pl-12' : 'pl-12 pr-12'} py-2.5 bg-white/10 border border-amber-100/50 rounded-md focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20 text-xs sm:text-sm outline-none transition-all duration-300 hover:bg-white/20`}
                        placeholder="••••••••"
                        required
                      />
                      <div className={`absolute inset-y-0 ${isRTL ? 'right-0' : 'left-0'} flex items-center justify-center w-12 pointer-events-none`}>
                        <Lock className="h-5 w-5 text-amber-600 group-hover:text-amber-800 transition-colors" />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`absolute inset-y-0 ${isRTL ? 'left-0' : 'right-0'} flex items-center justify-center w-12 text-amber-600 hover:text-amber-800 transition-colors`}
                      >
                        {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Links */}
                  <div className="flex justify-between text-xs sm:text-sm">
                    <button
                      type="button"
                      onClick={() => setShowForgot(true)}
                      className="text-amber-600 hover:text-amber-800 font-medium flex items-center gap-1"
                    >
                      <Key className="h-4 w-4" />
                      {isRTL ? 'نسيت كلمة السر ؟' : 'Forgot Password ?'}
                    </button>
                    <button
                      type="button"
                      onClick={toggleLanguage}
                      className="text-amber-600 hover:text-amber-800 font-medium flex items-center gap-1"
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                      {isRTL ? 'EN' : 'AR'}
                    </button>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white py-2.5 rounded-md shadow-sm hover:shadow-md transition-all duration-300 text-sm font-medium"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {isRTL ? 'جاري...' : 'Loading...'}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <LogIn className="h-5 w-5" />
                        {isRTL ? 'تسجيل الدخول' : 'Login'}
                      </div>
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-5">
                  <div>
                    <label className="block text-amber-800 text-sm sm:text-base font-medium mb-2">
                      {isRTL ? 'البريد الإلكتروني' : 'Email'}
                    </label>
                    <div className="relative group">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-2.5 bg-white/10 border border-amber-100/50 rounded-md focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20 text-xs sm:text-sm outline-none transition-all duration-300 hover:bg-white/20`}
                        placeholder="email@company.com"
                        required
                      />
                      <div className={`absolute inset-y-0 ${isRTL ? 'right-0' : 'left-0'} flex items-center justify-center w-12 pointer-events-none`}>
                        <User className="h-5 w-5 text-amber-600 group-hover:text-amber-800 transition-colors" />
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white py-2.5 rounded-md shadow-sm hover:shadow-md transition-all duration-300 text-sm font-medium"
                  >
                    {loading ? 'جاري الإرسال...' : (isRTL ? 'إرسال الرابط' : 'Send Reset Link')}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleBackToLogin}
                    className="w-full text-amber-600 hover:text-amber-800 py-2.5 rounded-md text-sm font-medium hover:bg-amber-50/50 transition-all"
                  >
                    <ArrowLeft className="h-4 w-4 me-2" />
                    {isRTL ? 'العودة' : 'Back to Login'}
                  </Button>
                </form>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* جميع الحقوق محفوظة */}
      <footer className="mt-8 text-center text-amber-700 text-xs sm:text-sm opacity-80">
        <p>
          © {new Date().getFullYear()} 
          <span className="font-medium mx-1">مصنع حلويات الجوديا</span> 
          - جميع الحقوق محفوظة
        </p>
        <p className="mt-1 text-amber-600">
        </p>
      </footer>

    </div>
  );
}
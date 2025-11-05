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
    try {
      const success = await login(username, password);
      if (!success) {
        setError(isRTL ? 'اسم مستخدم أو كلمة مرور غير صحيحة' : 'Invalid username or password');
      }
    } catch {
      setError(isRTL ? 'حدث خطأ أثناء تسجيل الدخول' : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
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
      className="min-h-screen bg-gradient-to-br from-amber-100 via-orange-100 to-amber-200 flex flex-col justify-center p-4 sm:p-6"
      style={{ fontFamily: 'Alexandria, sans-serif' }}
    >
      {/* المحتوى الرئيسي */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-5xl grid md:grid-cols-2 gap-6 items-center">
          {/* الجانب الأيسر - الترحيب */}
          <div
            className={`hidden md:flex flex-col items-center justify-center text-center space-y-6 transition-all duration-700 ease-out ${
              mounted ? 'opacity-100 translate-x-0' : (isRTL ? 'opacity-0 translate-x-32' : 'opacity-0 -translate-x-32')
            }`}
          >
            <div className="relative group">
              <img
                src="/logo.png"
                alt={isRTL ? 'الجوديا' : 'Al-Joudia'}
                width={160}
                height={160}
                className="mx-auto drop-shadow-md"
              />
              <div className="absolute -inset-3 bg-gradient-to-r from-amber-200/30 to-orange-200/30 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold text-amber-800">
                {isRTL ? 'مرحباً بك في نظام الجوديا' : 'Welcome to Al-Joudia System'}
              </h1>
              <p className="text-lg text-amber-700 max-w-sm mx-auto leading-relaxed">
                {isRTL
                  ? 'اكتشف تجربة إدارة مبتكرة لمصنع الجوديا مع تتبع ذكي للعمليات الداخلية'
                  : 'Discover an innovative management experience for the sweets factory'}
              </p>
            </div>
          </div>

          {/* الجانب الأيمن - النموذج */}
          <div
            className={`w-full max-w-sm mx-auto transition-all duration-700 ease-out delay-200 ${
              mounted ? 'opacity-100 translate-x-0' : (isRTL ? 'opacity-0 -translate-x-32' : 'opacity-0 translate-x-32')
            }`}
          >
            <Card className="border-amber-100/50 shadow-md bg-white/90 backdrop-blur-sm rounded-xl p-5 sm:p-6">
              {/* لوجو الموبايل */}
              <div className="md:hidden text-center mb-5">
                <div className="relative inline-block group">
                  <img src="/logo.png" alt="الجوديا" width={70} height={70} />
                  <div className="absolute -inset-2 bg-gradient-to-r from-amber-200/20 to-orange-200/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              <div className="text-center mb-5">
                <h1 className="text-xl sm:text-2xl font-bold text-amber-800">
                  {showForgot 
                    ? (isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Password')
                    : (isRTL ? 'تسجيل الدخول' : 'Login')
                  }
                </h1>
                <p className="text-sm text-amber-600 mt-1">
                  {showForgot
                    ? (isRTL ? 'أدخل بريدك لتلقي رابط الإعادة' : 'Enter email to receive reset link')
                    : (isRTL ? 'أدخل بياناتك للوصول' : 'Enter credentials to access dashboard')
                  }
                </p>
              </div>

              {/* رسائل */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
                  {error}
                </div>
              )}
              {successMessage && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm text-center">
                  {successMessage}
                </div>
              )}

              {/* نموذج تسجيل الدخول */}
              {!showForgot ? (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* اسم المستخدم */}
                  <div className="relative group">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={`w-full ${isRTL ? 'pr-11 pl-4' : 'pl-11 pr-4'} py-3 bg-white/10 border border-amber-100/50 rounded-lg focus:border-amber-400 focus:ring-2 focus:ring-amber-300/30 text-sm outline-none transition-all duration-300 hover:bg-white/20`}
                      placeholder={isRTL ? 'أدخل اسم المستخدم' : 'Enter username'}
                      required
                    />
                    <User className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-4' : 'left-4'} text-amber-600 group-hover:text-amber-800 transition-colors h-5 w-5`} />
                  </div>

                  {/* كلمة المرور */}
                  <div className="relative group">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full ${isRTL ? 'pr-11 pl-11' : 'pl-11 pr-11'} py-3 bg-white/10 border border-amber-100/50 rounded-lg focus:border-amber-400 focus:ring-2 focus:ring-amber-300/30 text-sm outline-none transition-all duration-300 hover:bg-white/20`}
                      placeholder="••••••••"
                      required
                    />
                    <Lock className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-4' : 'left-4'} text-amber-600 group-hover:text-amber-800 transition-colors h-5 w-5`} />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-4' : 'right-4'} text-amber-600 hover:text-amber-800 transition-colors`}
                    >
                      {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                    </button>
                  </div>

                  {/* الروابط */}
                  <div className="flex justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => setShowForgot(true)}
                      className="text-amber-600 hover:text-amber-800 font-medium flex items-center gap-1"
                    >
                      <Key className="h-4 w-4" />
                      {isRTL ? 'نسيت؟' : 'Forgot?'}
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

                  {/* زر الدخول */}
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white py-3 rounded-lg font-medium text-sm shadow-sm hover:shadow-md transition-all duration-300"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {isRTL ? 'جاري...' : 'Logging in...'}
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
                  <div className="relative group">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`w-full ${isRTL ? 'pr-11 pl-4' : 'pl-11 pr-4'} py-3 bg-white/10 border border-amber-100/50 rounded-lg focus:border-amber-400 focus:ring-2 focus:ring-amber-300/30 text-sm outline-none transition-all duration-300 hover:bg-white/20`}
                      placeholder={isRTL ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}
                      required
                    />
                    <User className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-4' : 'left-4'} text-amber-600 group-hover:text-amber-800 transition-colors h-5 w-5`} />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white py-3 rounded-lg font-medium text-sm shadow-sm hover:shadow-md transition-all"
                  >
                    {loading ? 'جاري الإرسال...' : (isRTL ? 'إرسال الرابط' : 'Send Reset Link')}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleBackToLogin}
                    className="w-full text-amber-600 hover:text-amber-800 py-3 rounded-lg text-sm font-medium hover:bg-amber-50/50 transition-all"
                  >
                    <ArrowLeft className="h-4 w-4 me-2" />
                    {isRTL ? 'العودة' : 'Back to Login'}
                  </Button>
                </form>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* جميع الحقوق محفوظة */}
      <footer className="text-center py-6 text-amber-700 text-xs sm:text-sm">
        <p className="font-medium">
          © {new Date().getFullYear()} مصنع حلويات الجوديا - جميع الحقوق محفوظة
        </p>
        <p className="text-amber-600 mt-1">
          {isRTL ? 'تم التطوير بواسطة فريق الجوديا التقني' : 'Developed by Al-Joudia Tech Team'}
        </p>
      </footer>
    </div>
  );
}
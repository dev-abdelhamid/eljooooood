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

  // دخول سلس بدون تخريب
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // تنظيف الرسائل عند تبديل النموذج
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
    } catch (err) {
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

    // Simulate sending reset link
    setTimeout(() => {
      setSuccessMessage(isRTL ? 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني' : 'A password reset link has been sent to your email');
      setLoading(false);
    }, 1000);
  };

  const handleBackToLogin = () => {
    setShowForgot(false);
    setError('');
    setSuccessMessage('');
    setEmail('');
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-gradient-to-br from-amber-100 via-orange-100 to-amber-200 flex items-center justify-center p-4 sm:p-6"
      style={{ fontFamily: 'Alexandria, sans-serif' }}
    >
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-6 items-center">
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
            <h1 className="text-3xl font-bold text-amber-800" style={{ fontFamily: 'Alexandria', fontWeight: 700 }}>
              {isRTL ? 'مرحباً بك في نظام الجوديا' : 'Welcome to Al-Joudia System'}
            </h1>
            <p className="text-lg text-amber-700 max-w-sm mx-auto leading-relaxed" style={{ fontFamily: 'Alexandria', fontWeight: 400 }}>
              {isRTL
                ? 'اكتشف تجربة إدارة مبتكرة لمصنع الجوديا مع تتبع ذكي للعمليات الداخلية وتنسيق سلس بين الإنتاج والفروع لتعزيز الكفاءة'
                : 'Discover an innovative management experience for the sweets factory, with smart tracking of internal operations and seamless coordination between production and branches to enhance efficiency'}
            </p>
          </div>
        </div>

        {/* Right Side - Login/Forgot Form */}
        <div
          className={`w-full max-w-sm mx-auto transition-all duration-700 ease-out delay-200 ${
            mounted ? 'opacity-100 translate-x-0' : (isRTL ? 'opacity-0 -translate-x-20' : 'opacity-0 translate-x-20')
          }`}
        >
          <Card className="border-amber-100/50 shadow-md bg-white/90 backdrop-blur-sm rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl p-5 sm:p-6">
            <div className="text-center space-y-3 mb-4">
              <div className="md:hidden relative mx-auto w-fit group">
                <img
                  src="/logo.png"
                  alt={isRTL ? 'الجوديا' : 'Al-Joudia'}
                  width={70}
                  height={70}
                  className="transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute -inset-2 bg-gradient-to-r from-amber-200/20 to-orange-200/20 rounded-full blur-md transition-opacity duration-500 group-hover:opacity-100" />
              </div>

              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-amber-800" style={{ fontFamily: 'Alexandria', fontWeight: 600 }}>
                  {showForgot ? (isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Password') : (isRTL ? 'تسجيل الدخول' : 'Login')}
                </h1>
                <p className="text-sm sm:text-base text-amber-600" style={{ fontFamily: 'Alexandria', fontWeight: 400 }}>
                  {showForgot
                    ? (isRTL ? 'أدخل بريدك الإلكتروني لتلقي رابط الإعادة' : 'Enter your email to receive a reset link')
                    : (isRTL ? 'أدخل بياناتك للوصول إلى لوحة التحكم' : 'Enter your credentials to access the dashboard')}
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {error && (
                <div className="border-red-100 bg-red-50/70 rounded-md p-2 sm:p-3 transition-all duration-300">
                  <p className="text-red-700 text-xs sm:text-sm" style={{ fontFamily: 'Alexandria', fontWeight: 400 }}>
                    {error}
                  </p>
                </div>
              )}
              {successMessage && (
                <div className="border-green-100 bg-green-50/70 rounded-md p-2 sm:p-3 transition-all duration-300">
                  <p className="text-green-700 text-xs sm:text-sm" style={{ fontFamily: 'Alexandria', fontWeight: 400 }}>
                    {successMessage}
                  </p>
                </div>
              )}

              {!showForgot ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="username" className="text-amber-800 text-sm sm:text-base block" style={{ fontFamily: 'Alexandria', fontWeight: 500 }}>
                      {isRTL ? 'اسم المستخدم' : 'Username'}
                    </label>
                    <div className="relative group">
                      <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={`w-full px-3 py-2.5 border border-amber-100/50 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20 bg-white/10 rounded-md transition-all duration-300 hover:bg-white/20 hover:shadow-sm text-xs sm:text-sm outline-none ${isRTL ? 'text-right' : 'text-left'}`}
                        style={{ fontFamily: 'Alexandria', fontWeight: 400 }}
                        placeholder={isRTL ? 'أدخل اسم المستخدم' : 'Enter username'}
                        required
                      />
                      <div className={`absolute inset-y-0 ${isRTL ? 'right-0' : 'left-0'} flex items-center justify-center w-10 text-amber-600 group-hover:text-amber-800 transition-colors duration-300`}>
                        <User className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="password" className="text-amber-800 text-sm sm:text-base block" style={{ fontFamily: 'Alexandria', fontWeight: 500 }}>
                      {isRTL ? 'كلمة المرور' : 'Password'}
                    </label>
                    <div className="relative group">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full px-3 py-2.5 border border-amber-100/50 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20 bg-white/10 rounded-md transition-all duration-300 hover:bg-white/20 hover:shadow-sm text-xs sm:text-sm outline-none ${isRTL ? 'text-right' : 'text-left'}`}
                        style={{ fontFamily: 'Alexandria', fontWeight: 400 }}
                        placeholder={isRTL ? 'أدخل كلمة المرور' : 'Enter password'}
                        required
                      />
                      <div className={`absolute inset-y-0 ${isRTL ? 'right-0' : 'left-0'} flex items-center justify-center w-10 text-amber-600 group-hover:text-amber-800 transition-colors duration-300`}>
                        <Lock className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      <button
                        type="button"
                        className={`absolute inset-y-0 ${isRTL ? 'left-10' : 'right-10'} flex items-center justify-center w-10 text-amber-600 hover:text-amber-800 transition-colors duration-300`}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <Eye className="h-4 w-4 sm:h-5 sm:w-5" /> : <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-amber-600 hover:text-amber-800 p-0 hover:bg-transparent"
                      style={{ fontFamily: 'Alexandria', fontWeight: 400 }}
                      onClick={() => setShowForgot(true)}
                    >
                      <Key className="h-3 w-3 sm:h-4 sm:w-4 me-1" />
                      {isRTL ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-amber-600 hover:text-amber-800 p-0 hover:bg-transparent"
                      style={{ fontFamily: 'Alexandria', fontWeight: 400 }}
                      onClick={toggleLanguage}
                    >
                      <ArrowLeftRight className="h-3 w-3 sm:h-4 sm:w-4 me-1" />
                      {isRTL ? 'English' : 'العربية'}
                    </Button>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white py-1.5 sm:py-2 rounded-md shadow-sm hover:shadow-md transition-all duration-300 text-xs sm:text-sm"
                    style={{ fontFamily: 'Alexandria', fontWeight: 500 }}
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-1 sm:gap-2">
                        <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        {isRTL ? 'جاري تسجيل الدخول...' : 'Logging in...'}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1 sm:gap-2">
                        <LogIn className="h-3 w-3 sm:h-4 sm:w-4" />
                        {isRTL ? 'تسجيل الدخول' : 'Login'}
                      </div>
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="text-amber-800 text-sm sm:text-base block" style={{ fontFamily: 'Alexandria', fontWeight: 500 }}>
                      {isRTL ? 'البريد الإلكتروني' : 'Email'}
                    </label>
                    <div className="relative group">
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full px-3 py-2.5 border border-amber-100/50 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20 bg-white/10 rounded-md transition-all duration-300 hover:bg-white/20 hover:shadow-sm text-xs sm:text-sm outline-none ${isRTL ? 'text-right' : 'text-left'}`}
                        style={{ fontFamily: 'Alexandria', fontWeight: 400 }}
                        placeholder={isRTL ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}
                        required
                      />
                      <div className={`absolute inset-y-0 ${isRTL ? 'right-0' : 'left-0'} flex items-center justify-center w-10 text-amber-600 group-hover:text-amber-800 transition-colors duration-300`}>
                        <User className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white py-1.5 sm:py-2 rounded-md shadow-sm hover:shadow-md transition-all duration-300 text-xs sm:text-sm"
                    style={{ fontFamily: 'Alexandria', fontWeight: 500 }}
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-1 sm:gap-2">
                        <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        {isRTL ? 'جاري الإرسال...' : 'Sending...'}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1 sm:gap-2">
                        <Key className="h-3 w-3 sm:h-4 sm:w-4" />
                        {isRTL ? 'إرسال رابط الإعادة' : 'Send Reset Link'}
                      </div>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-amber-600 hover:text-amber-800 py-1.5 sm:py-2 rounded-md transition-all duration-300 text-xs sm:text-sm hover:bg-amber-50/50"
                    style={{ fontFamily: 'Alexandria', fontWeight: 400 }}
                    onClick={handleBackToLogin}
                  >
                    <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 me-1" />
                    {isRTL ? 'العودة إلى تسجيل الدخول' : 'Back to Login'}
                  </Button>
                </form>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/UI/Button';
import { Card } from '../components/UI/Card';
import { LogIn, ArrowLeftRight, Eye, EyeOff, Key, User, Lock, ArrowLeft, AlertCircle } from 'lucide-react';

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

  // دخول سلس بدون تشنج
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
      className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center p-4"
      style={{ fontFamily: 'Alexandria, sans-serif' }}
    >
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center">
        {/* الجانب الأيسر - ترحيب */}
        <div
          className={`hidden md:flex flex-col items-center justify-center text-center space-y-6 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'
          }`}
        >
          <div className="relative">
            <img
              src="/logo.png"
              alt={isRTL ? 'الجوديا' : 'Al-Joudia'}
              width={160}
              height={160}
              className="drop-shadow-lg"
            />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-amber-900">
              {isRTL ? 'نظام الجوديا' : 'Al-Joudia System'}
            </h1>
            <p className="text-amber-700 max-w-sm mx-auto text-lg leading-relaxed">
              {isRTL
                ? 'إدارة ذكية لمصنع الحلويات بكفاءة عالية'
                : 'Smart management for your sweets factory'}
            </p>
          </div>
        </div>

        {/* الجانب الأيمن - النموذج */}
        <div
          className={`w-full max-w-md mx-auto transition-all duration-700 delay-200 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          <Card className="bg-white shadow-sm border border-gray-100 rounded-xl p-6">
            {/* لوجو صغير للموبايل */}
            <div className="md:hidden text-center mb-6">
              <img src="/logo.png" alt="الجوديا" width={70} height={70} className="mx-auto" />
            </div>

            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {showForgot
                  ? (isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Password')
                  : (isRTL ? 'تسجيل الدخول' : 'Login')}
              </h2>
              <p className="text-gray-600 text-sm">
                {showForgot
                  ? (isRTL ? 'أدخل بريدك الإلكتروني' : 'Enter your email')
                  : (isRTL ? 'أدخل بياناتك للوصول' : 'Enter your credentials')}
              </p>
            </div>

            {/* رسائل */}
            {error && (
              <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 animate-in slide-in-from-top duration-300">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
            {successMessage && (
              <div className="mb-5 p-4 bg-green-50 border border-green-200 rounded-lg animate-in slide-in-from-top duration-300">
                <p className="text-green-700 text-sm">{successMessage}</p>
              </div>
            )}

            {/* نموذج تسجيل الدخول */}
            {!showForgot ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-gray-900 font-medium text-sm mb-2">
                    {isRTL ? 'اسم المستخدم' : 'Username'}
                  </label>
                  <div className="relative group">
                    <User className={`absolute top-3.5 ${isRTL ? 'right-4' : 'left-4'} text-gray-400 group-focus-within:text-amber-500 h-5 w-5 transition-colors`} />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm transition-all`}
                      placeholder={isRTL ? 'اسم المستخدم' : 'Username'}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-900 font-medium text-sm mb-2">
                    {isRTL ? 'كلمة المرور' : 'Password'}
                  </label>
                  <div className="relative group">
                    <Lock className={`absolute top-3.5 ${isRTL ? 'right-4' : 'left-4'} text-gray-400 group-focus-within:text-amber-500 h-5 w-5 transition-colors`} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full ${isRTL ? 'pr-12 pl-12' : 'pl-12 pr-12'} py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm transition-all`}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute top-3.5 ${isRTL ? 'left-4' : 'right-4'} text-gray-400 hover:text-amber-600 transition-colors`}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => setShowForgot(true)}
                    className="text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
                  >
                    <Key className="h-4 w-4" />
                    {isRTL ? 'نسيت؟' : 'Forgot?'}
                  </button>
                  <button
                    type="button"
                    onClick={toggleLanguage}
                    className="text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    {isRTL ? 'EN' : 'AR'}
                  </button>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {isRTL ? 'جاري...' : 'Loading...'}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <LogIn className="h-5 w-5" />
                      {isRTL ? 'تسجيل الدخول' : 'Login'}
                    </span>
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-6">
                <div>
                  <label className="block text-gray-900 font-medium text-sm mb-2">
                    {isRTL ? 'البريد الإلكتروني' : 'Email'}
                  </label>
                  <div className="relative group">
                    <User className={`absolute top-3.5 ${isRTL ? 'right-4' : 'left-4'} text-gray-400 group-focus-within:text-amber-500 h-5 w-5 transition-colors`} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm transition-all`}
                      placeholder="email@company.com"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium"
                >
                  {loading ? 'جاري الإرسال...' : (isRTL ? 'إرسال الرابط' : 'Send Reset Link')}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBackToLogin}
                  className="w-full py-2.5 text-amber-600 hover:text-amber-700 font-medium"
                >
                  <ArrowLeft className="h-4 w-4 me-2" />
                  {isRTL ? 'العودة' : 'Back'}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
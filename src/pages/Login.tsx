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
      className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden"
      style={{ fontFamily: 'Alexandria, sans-serif' }}
    >
      {/* Subtle Background Overlay for Texture */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Ccircle fill="%23FFF" fill-opacity=".03" cx="10" cy="10" r="10"/%3E%3C/g%3E%3C/svg%3E')] opacity-50" />

      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center flex-1 relative z-10">
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
              width={180}
              height={180}
              className="mx-auto drop-shadow-xl transition-transform duration-500 group-hover:scale-110 animate-pulse-slow"
            />
            <div className="absolute -inset-4 bg-gradient-to-r from-amber-300/20 to-orange-300/20 rounded-full blur-xl transition-opacity duration-500 group-hover:opacity-80" />
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-extrabold text-amber-900 tracking-tight">
              {isRTL ? 'مرحباً بك في نظام الجوديا' : 'Welcome to Al-Joudia System'}
            </h1>
            <p className="text-lg text-amber-800 max-w-md mx-auto leading-relaxed font-medium">
              {isRTL
                ? 'اكتشف تجربة إدارة مبتكرة لمصنع الجوديا مع تتبع ذكي للعمليات الداخلية وتنسيق سلس بين الإنتاج والفروع لتعزيز الكفاءة'
                : 'Discover an innovative management experience for the sweets factory, with smart tracking of internal operations and seamless coordination between production and branches to enhance efficiency'}
            </p>
          </div>
        </div>

        {/* Right Side - Form */}
        <div
          className={`w-full max-w-md mx-auto transition-all duration-700 ease-out delay-200 ${
            mounted ? 'opacity-100 translate-x-0' : (isRTL ? 'opacity-0 -translate-x-20' : 'opacity-0 translate-x-20')
          }`}
        >
          <Card className="border-2 border-amber-200/30 shadow-lg bg-white/80 backdrop-blur-md rounded-2xl overflow-hidden p-6 sm:p-8 relative transition-all duration-500 hover:shadow-2xl hover:border-amber-300/50">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-100/10 to-orange-100/10 rounded-2xl transition-opacity duration-500 hover:opacity-80" />
            <div className="relative text-center space-y-4 mb-6">
              <div className="md:hidden relative mx-auto w-fit group">
                <img
                  src="/logo.png"
                  alt="الجوديا"
                  width={80}
                  height={80}
                  className="transition-transform duration-500 group-hover:scale-110 animate-pulse-slow"
                />
                <div className="absolute -inset-3 bg-gradient-to-r from-amber-200/20 to-orange-200/20 rounded-full blur-lg transition-opacity duration-500 group-hover:opacity-80" />
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-amber-900 tracking-tight">
                {showForgot 
                  ? (isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Password')
                  : (isRTL ? 'تسجيل الدخول' : 'Login')
                }
              </h1>
              <p className="text-base sm:text-lg text-amber-700 font-medium">
                {showForgot
                  ? (isRTL ? 'أدخل بريدك الإلكتروني لتلقي رابط الإعادة' : 'Enter your email to receive a reset link')
                  : (isRTL ? 'أدخل بياناتك للوصول إلى لوحة التحكم' : 'Enter your credentials to access the dashboard')
                }
              </p>
            </div>

            <div className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50/80 border border-red-200/50 rounded-lg shadow-sm transition-all duration-300">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}
              {successMessage && (
                <div className="p-4 bg-green-50/80 border border-green-200/50 rounded-lg shadow-sm transition-all duration-300">
                  <p className="text-green-800 text-sm">{successMessage}</p>
                </div>
              )}

              {!showForgot ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Username Field */}
                  <div>
                    <label className="block text-amber-900 text-sm sm:text-base font-semibold mb-2">
                      {isRTL ? 'اسم المستخدم' : 'Username'}
                    </label>
                    <div className="relative group">
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-white/5 border-b-2 border-amber-200/50 rounded-t-md focus:border-amber-400 focus:ring-0 text-sm sm:text-base outline-none transition-all duration-300 hover:bg-white/10 group-hover:border-amber-300/70 relative after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-amber-400 after:transition-all after:duration-500 group-hover:after:w-full`}
                        placeholder={isRTL ? 'أدخل اسم المستخدم' : 'Enter username'}
                        required
                      />
                      <div className={`absolute inset-y-0 ${isRTL ? 'right-0' : 'left-0'} flex items-center justify-center w-12 pointer-events-none`}>
                        <User className="h-5 w-5 text-amber-700 group-hover:text-amber-900 transition-colors" />
                      </div>
                    </div>
                  </div>

                  {/* Password Field */}
                  <div>
                    <label className="block text-amber-900 text-sm sm:text-base font-semibold mb-2">
                      {isRTL ? 'كلمة المرور' : 'Password'}
                    </label>
                    <div className="relative group">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full ${isRTL ? 'pr-12 pl-12' : 'pl-12 pr-12'} py-3 bg-white/5 border-b-2 border-amber-200/50 rounded-t-md focus:border-amber-400 focus:ring-0 text-sm sm:text-base outline-none transition-all duration-300 hover:bg-white/10 group-hover:border-amber-300/70 relative after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-amber-400 after:transition-all after:duration-500 group-hover:after:w-full`}
                        placeholder="••••••••"
                        required
                      />
                      <div className={`absolute inset-y-0 ${isRTL ? 'right-0' : 'left-0'} flex items-center justify-center w-12 pointer-events-none`}>
                        <Lock className="h-5 w-5 text-amber-700 group-hover:text-amber-900 transition-colors" />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`absolute inset-y-0 ${isRTL ? 'left-0' : 'right-0'} flex items-center justify-center w-12 text-amber-700 hover:text-amber-900 transition-colors`}
                      >
                        {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Links */}
                  <div className="flex justify-between text-sm">
                    <button
                      type="button"
                      onClick={() => setShowForgot(true)}
                      className="text-amber-700 hover:text-amber-900 font-semibold flex items-center gap-1 transition-colors duration-300 hover:underline"
                    >
                      <Key className="h-4 w-4" />
                      {isRTL ? 'نسيت كلمة السر؟' : 'Forgot Password?'}
                    </button>
                    <button
                      type="button"
                      onClick={toggleLanguage}
                      className="text-amber-700 hover:text-amber-900 font-semibold flex items-center gap-1 transition-colors duration-300 hover:underline"
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                      {isRTL ? 'EN' : 'AR'}
                    </button>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 text-base font-semibold"
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
                <form onSubmit={handleForgotSubmit} className="space-y-6">
                  <div>
                    <label className="block text-amber-900 text-sm sm:text-base font-semibold mb-2">
                      {isRTL ? 'البريد الإلكتروني' : 'Email'}
                    </label>
                    <div className="relative group">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-white/5 border-b-2 border-amber-200/50 rounded-t-md focus:border-amber-400 focus:ring-0 text-sm sm:text-base outline-none transition-all duration-300 hover:bg-white/10 group-hover:border-amber-300/70 relative after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-amber-400 after:transition-all after:duration-500 group-hover:after:w-full`}
                        placeholder="email@company.com"
                        required
                      />
                      <div className={`absolute inset-y-0 ${isRTL ? 'right-0' : 'left-0'} flex items-center justify-center w-12 pointer-events-none`}>
                        <User className="h-5 w-5 text-amber-700 group-hover:text-amber-900 transition-colors" />
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 text-base font-semibold"
                  >
                    {loading ? 'جاري الإرسال...' : (isRTL ? 'إرسال الرابط' : 'Send Reset Link')}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleBackToLogin}
                    className="w-full text-amber-700 hover:text-amber-900 py-3 rounded-lg text-base font-semibold hover:bg-amber-50/70 transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {isRTL ? 'العودة' : 'Back to Login'}
                  </Button>
                </form>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-10 text-center text-amber-800 text-sm opacity-90 transition-all duration-300 hover:opacity-100">
        <p className="group">
          © {new Date().getFullYear()} 
          <span className="font-semibold mx-1 transition-colors duration-300 group-hover:text-amber-900">مصنع حلويات الجوديا</span> 
          - {isRTL ? 'جميع الحقوق محفوظة' : 'All Rights Reserved'}
        </p>
      </footer>
    </div>
  );
}
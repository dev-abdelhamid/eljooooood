import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion'; // إضافة framer-motion للحركات
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

  // تأثيرات الحركة للكارد والعناصر
  const cardVariants = {
    hidden: { opacity: 0, x: isRTL ? -50 : 50 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  };

  const brandingVariants = {
    hidden: { opacity: 0, x: isRTL ? 50 : -50 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: 'easeOut' } },
  };

  const errorVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  useEffect(() => {
    setMounted(true);
    // إزالة تأثير الـ opacity-50 عند الخطأ
  }, []);

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
        // تحسين رسائل الخطأ بناءً على استجابة الـ Backend
        setError(
          isRTL
            ? 'اسم المستخدم أو كلمة المرور غير صحيحة'
            : 'Invalid username or password'
        );
      }
    } catch (err: any) {
      // معالجة أخطاء الـ Backend بشكل أكثر دقة
      const errorMessage = err.message || (isRTL ? 'حدث خطأ أثناء تسجيل الدخول' : 'An error occurred during login');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // محاكاة إرسال رابط إعادة تعيين كلمة المرور
      // يمكن استبدال هذا بطلب API حقيقي إذا كان متوفرًا
      setTimeout(() => {
        setSuccessMessage(
          isRTL
            ? 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني'
            : 'A password reset link has been sent to your email'
        );
        setLoading(false);
      }, 1000);
    } catch (err: any) {
      setError(
        isRTL
          ? 'فشل إرسال رابط إعادة تعيين كلمة المرور'
          : 'Failed to send password reset link'
      );
      setLoading(false);
    }
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
      className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 flex items-center justify-center p-4 sm:p-6 md:p-8"
    >
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        {/* Left Side - Branding */}
        <motion.div
          className="hidden md:flex flex-col items-center justify-center text-center space-y-6"
          initial="hidden"
          animate={mounted ? 'visible' : 'hidden'}
          variants={brandingVariants}
        >
          <div className="relative group">
            <img
              src="/logo.png"
              alt={isRTL ? 'الجوديا' : 'Al-Joudia'}
              width={180}
              height={180}
              className="mx-auto drop-shadow-lg transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3"
            />
            <div className="absolute -inset-4 bg-gradient-to-r from-amber-200/20 to-orange-200/20 rounded-full blur-lg transition-opacity duration-500 group-hover:opacity-80 animate-pulse" />
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl font-bold text-amber-900" style={{ fontFamily: 'Alexandria', fontWeight: 700 }}>
              {isRTL ? 'مرحباً بك في نظام الجوديا' : 'Welcome to Al-Joudia System'}
            </h1>
            <p className="text-base sm:text-lg text-amber-800 max-w-md mx-auto leading-relaxed" style={{ fontFamily: 'Alexandria', fontWeight: 400 }}>
              {isRTL
                ? 'اكتشف تجربة إدارة مبتكرة لمصنع الجوديا مع تتبع ذكي للعمليات الداخلية وتنسيق سلس بين الإنتاج والفروع'
                : 'Discover an innovative management experience for the sweets factory with smart tracking and seamless coordination'}
            </p>
          </div>
        </motion.div>

        {/* Right Side - Login/Forgot Form */}
        <motion.div
          className="w-full max-w-md mx-auto"
          initial="hidden"
          animate={mounted ? 'visible' : 'hidden'}
          variants={cardVariants}
        >
          <Card className="border-amber-200/50 shadow-lg bg-white/95 backdrop-blur-md rounded-2xl p-6 sm:p-8 transition-all duration-300 hover:shadow-xl">
            <div className="text-center space-y-4 mb-6">
              <div className="md:hidden relative mx-auto w-fit group">
                <img
                  src="/logo.png"
                  alt={isRTL ? 'الجوديا' : 'Al-Joudia'}
                  width={80}
                  height={80}
                  className="transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3"
                />
                <div className="absolute -inset-3 bg-gradient-to-r from-amber-200/20 to-orange-200/20 rounded-full blur-md transition-opacity duration-500 group-hover:opacity-80" />
              </div>

              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-amber-900" style={{ fontFamily: 'Alexandria', fontWeight: 600 }}>
                  {showForgot ? (isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Password') : (isRTL ? 'تسجيل الدخول' : 'Login')}
                </h1>
                <p className="text-sm sm:text-base text-amber-700" style={{ fontFamily: 'Alexandria', fontWeight: 400 }}>
                  {showForgot
                    ? (isRTL ? 'أدخل بريدك الإلكتروني لتلقي رابط الإعادة' : 'Enter your email to receive a reset link')
                    : (isRTL ? 'أدخل بياناتك للوصول إلى لوحة التحكم' : 'Enter your credentials to access the dashboard')}
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <AnimatePresence>
                {error && (
                  <motion.div
                    className="border-red-200 bg-red-50/80 rounded-lg p-3"
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    variants={errorVariants}
                  >
                    <p className="text-red-800 text-sm" style={{ fontFamily: 'Alexandria', fontWeight: 400 }}>
                      {error}
                    </p>
                  </motion.div>
                )}
                {successMessage && (
                  <motion.div
                    className="border-green-200 bg-green-50/80 rounded-lg p-3"
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    variants={errorVariants}
                  >
                    <p className="text-green-800 text-sm" style={{ fontFamily: 'Alexandria', fontWeight: 400 }}>
                      {successMessage}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {!showForgot ? (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label
                      htmlFor="username"
                      className="text-amber-900 text-sm sm:text-base block"
                      style={{ fontFamily: 'Alexandria', fontWeight: 500 }}
                    >
                      {isRTL ? 'اسم المستخدم' : 'Username'}
                    </label>
                    <div className="relative group">
                      <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={`w-full ps-12 pe-4 border-amber-200/50 focus:border-amber-400 focus:ring-amber-400/20 bg-white/10 rounded-lg py-2.5 px-4 transition-all duration-300 hover:bg-white/20 hover:shadow-sm text-sm outline-none focus:shadow-md ${isRTL ? 'text-right' : 'text-left'}`}
                        style={{ fontFamily: 'Alexandria', fontWeight: 400 }}
                        placeholder={isRTL ? 'أدخل اسم المستخدم' : 'Enter username'}
                        required
                      />
                      <User
                        className={`absolute inset-y-0 ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-amber-600 group-hover:text-amber-900 transition-colors duration-300 h-5 w-5`}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="password"
                      className="text-amber-900 text-sm sm:text-base block"
                      style={{ fontFamily: 'Alexandria', fontWeight: 500 }}
                    >
                      {isRTL ? 'كلمة المرور' : 'Password'}
                    </label>
                    <div className="relative group">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full ps-12 pe-12 border-amber-200/50 focus:border-amber-400 focus:ring-amber-400/20 bg-white/10 rounded-lg py-2.5 px-4 transition-all duration-300 hover:bg-white/20 hover:shadow-sm text-sm outline-none focus:shadow-md ${isRTL ? 'text-right' : 'text-left'}`}
                        style={{ fontFamily: 'Alexandria', fontWeight: 400 }}
                        placeholder={isRTL ? 'أدخل كلمة المرور' : 'Enter password'}
                        required
                      />
                      <Lock
                        className={`absolute inset-y-0 ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-amber-600 group-hover:text-amber-900 transition-colors duration-300 h-5 w-5`}
                      />
                      <button
                        type="button"
                        className={`absolute inset-y-0 ${isRTL ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-amber-600 hover:text-amber-900 p-0 h-full flex items-center transition-colors duration-300`}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-3 text-sm">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-amber-700 hover:text-amber-900 p-0 hover:bg-transparent"
                      style={{ fontFamily: 'Alexandria', fontWeight: 400 }}
                      onClick={() => setShowForgot(true)}
                    >
                      <Key className="h-4 w-4 me-1.5" />
                      {isRTL ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-amber-700 hover:text-amber-900 p-0 hover:bg-transparent"
                      style={{ fontFamily: 'Alexandria', fontWeight: 400 }}
                      onClick={toggleLanguage}
                    >
                      <ArrowLeftRight className="h-4 w-4 me-1.5" />
                      {isRTL ? 'English' : 'العربية'}
                    </Button>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-sm hover:scale-[1.02]"
                    style={{ fontFamily: 'Alexandria', fontWeight: 500 }}
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        {isRTL ? 'جاري تسجيل الدخول...' : 'Logging in...'}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <LogIn className="h-4 w-4" />
                        {isRTL ? 'تسجيل الدخول' : 'Login'}
                      </div>
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label
                      htmlFor="email"
                      className="text-amber-900 text-sm sm:text-base block"
                      style={{ fontFamily: 'Alexandria', fontWeight: 500 }}
                    >
                      {isRTL ? 'البريد الإلكتروني' : 'Email'}
                    </label>
                    <div className="relative group">
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full ps-12 pe-4 border-amber-200/50 focus:border-amber-400 focus:ring-amber-400/20 bg-white/10 rounded-lg py-2.5 px-4 transition-all duration-300 hover:bg-white/20 hover:shadow-sm text-sm outline-none focus:shadow-md ${isRTL ? 'text-right' : 'text-left'}`}
                        style={{ fontFamily: 'Alexandria', fontWeight: 400 }}
                        placeholder={isRTL ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}
                        required
                      />
                      <User
                        className={`absolute inset-y-0 ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-amber-600 group-hover:text-amber-900 transition-colors duration-300 h-5 w-5`}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-sm hover:scale-[1.02]"
                    style={{ fontFamily: 'Alexandria', fontWeight: 500 }}
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        {isRTL ? 'جاري الإرسال...' : 'Sending...'}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <Key className="h-4 w-4" />
                        {isRTL ? 'إرسال رابط الإعادة' : 'Send Reset Link'}
                      </div>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-amber-700 hover:text-amber-900 py-2.5 rounded-lg transition-all duration-300 text-sm hover:bg-amber-100/50"
                    style={{ fontFamily: 'Alexandria', fontWeight: 400 }}
                    onClick={handleBackToLogin}
                  >
                    <ArrowLeft className="h-4 w-4 me-1.5" />
                    {isRTL ? 'العودة إلى تسجيل الدخول' : 'Back to Login'}
                  </Button>
                </form>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
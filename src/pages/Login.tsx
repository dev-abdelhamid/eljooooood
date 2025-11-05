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

  const { login, isAuthenticated } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const isRTL = language === 'ar';

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
    if (!username || !password) return;

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
    if (!email) return;

    setLoading(true);
    setTimeout(() => {
      setSuccessMessage(
        isRTL
          ? 'تم إرسال رابط إعادة التعيين إلى بريدك'
          : 'Reset link sent to your email'
      );
      setLoading(false);
    }, 1000);
  };

  const handleBack = () => {
    setShowForgot(false);
    setEmail('');
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4"
    >
      {/* خلفية بسيطة وثابتة */}
      <div className="absolute inset-0 bg-amber-100/30" />

      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 relative z-10">
        {/* العلامة التجارية - يظهر فقط على الشاشات الكبيرة */}
        <div className="hidden md:flex flex-col items-center justify-center text-center space-y-6">
          <img
            src="/logo.png"
            alt="Al-Joudia"
            width={160}
            height={160}
            className="drop-shadow-md"
          />
          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-amber-900" style={{ fontFamily: 'Alexandria' }}>
              {isRTL ? 'نظام الجوديا' : 'Al-Joudia System'}
            </h1>
            <p className="text-amber-700 max-w-sm mx-auto" style={{ fontFamily: 'Alexandria' }}>
              {isRTL
                ? 'إدارة ذكية لمصنع الحلويات بكفاءة عالية'
                : 'Smart management for your sweets factory'}
            </p>
          </div>
        </div>

        {/* نموذج تسجيل الدخول */}
        <div className="w-full max-w-md mx-auto">
          <Card className="bg-white/95 backdrop-blur-sm border border-amber-100 shadow-xl rounded-2xl p-8">
            {/* لوجو صغير للموبايل */}
            <div className="md:hidden flex justify-center mb-6">
              <img src="/logo.png" alt="Logo" width={70} height={70} className="drop-shadow" />
            </div>

            <h2 className="text-2xl font-bold text-amber-800 text-center mb-2" style={{ fontFamily: 'Alexandria' }}>
              {showForgot
                ? (isRTL ? 'إعادة تعيين' : 'Reset Password')
                : (isRTL ? 'تسجيل الدخول' : 'Login')}
            </h2>
            <p className="text-amber-600 text-center text-sm mb-6" style={{ fontFamily: 'Alexandria' }}>
              {showForgot
                ? (isRTL ? 'أدخل بريدك الإلكتروني' : 'Enter your email')
                : (isRTL ? 'أدخل بياناتك' : 'Enter your credentials')}
            </p>

            {/* رسائل */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-sm mb-4">
                {successMessage}
              </div>
            )}

            {/* نموذج تسجيل الدخول */}
            {!showForgot ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-amber-800 font-medium text-sm mb-1.5">
                    {isRTL ? 'اسم المستخدم' : 'Username'}
                  </label>
                  <div className="relative">
                    <User className={`absolute top-3.5 ${isRTL ? 'right-3' : 'left-3'} text-amber-600 h-5 w-5`} />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={`w-full ${isRTL ? 'pr-11 pl-4' : 'pl-11 pr-4'} py-3 bg-amber-50 border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm`}
                      placeholder={isRTL ? 'اسم المستخدم' : 'Username'}
                      required
                      style={{ fontFamily: 'Alexandria' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-amber-800 font-medium text-sm mb-1.5">
                    {isRTL ? 'كلمة المرور' : 'Password'}
                  </label>
                  <div className="relative">
                    <Lock className={`absolute top-3.5 ${isRTL ? 'right-3' : 'left-3'} text-amber-600 h-5 w-5`} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full ${isRTL ? 'pr-11 pl-12' : 'pl-11 pr-12'} py-3 bg-amber-50 border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm`}
                      placeholder={isRTL ? 'كلمة المرور' : 'Password'}
                      required
                      style={{ fontFamily: 'Alexandria' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute top-3.5 ${isRTL ? 'left-3' : 'right-3'} text-amber-600 hover:text-amber-800`}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between text-sm">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowForgot(true)}
                    className="text-amber-600 hover:text-amber-800 font-medium"
                  >
                    <Key className="h-4 w-4 me-1" />
                    {isRTL ? 'نسيت؟' : 'Forgot?'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={toggleLanguage}
                    className="text-amber-600 hover:text-amber-800 font-medium"
                  >
                    <ArrowLeftRight className="h-4 w-4 me-1" />
                    {isRTL ? 'EN' : 'AR'}
                  </Button>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-3.5 rounded-xl shadow-md transition-all duration-200 disabled:opacity-60"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {isRTL ? 'جاري...' : 'Loading...'}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <LogIn className="h-5 w-5" />
                      {isRTL ? 'دخول' : 'Login'}
                    </span>
                  )}
                </Button>
              </form>
            ) : (
              /* نموذج نسيت كلمة المرور */
              <form onSubmit={handleForgotSubmit} className="space-y-5">
                <div>
                  <label className="block text-amber-800 font-medium text-sm mb-1.5">
                    {isRTL ? 'البريد الإلكتروني' : 'Email'}
                  </label>
                  <div className="relative">
                    <User className={`absolute top-3.5 ${isRTL ? 'right-3' : 'left-3'} text-amber-600 h-5 w-5`} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`w-full ${isRTL ? 'pr-11 pl-4' : 'pl-11 pr-4'} py-3 bg-amber-50 border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm`}
                      placeholder="email@domain.com"
                      required
                      style={{ fontFamily: 'Alexandria' }}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-3.5 rounded-xl shadow-md transition-all duration-200"
                >
                  {loading ? 'جاري الإرسال...' : (isRTL ? 'إرسال الرابط' : 'Send Link')}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  className="w-full text-amber-600 hover:text-amber-800 font-medium"
                >
                  <ArrowLeft className="h-4 w-4 me-1" />
                  {isRTL ? 'رجوع' : 'Back'}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
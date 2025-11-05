import React, { useState } from 'react';
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
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isForgot, setIsForgot] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const isRTL = language === 'ar';

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const ok = await login(username, password);
      if (!ok) setError(isRTL ? 'بيانات غير صحيحة' : 'Invalid credentials');
    } catch {
      setError(isRTL ? 'خطأ في الاتصال' : 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setSuccess(isRTL ? 'تم إرسال الرابط إلى بريدك' : 'Reset link sent');
      setLoading(false);
    }, 800);
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center p-4"
      style={{ fontFamily: 'Alexandria, sans-serif' }}
    >
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-10">
        {/* الجانب الأيسر - ترحيب هادئ */}
        <div className="hidden md:flex flex-col justify-center items-center text-center space-y-6">
          <img src="/logo.png" alt="الجوديا" className="w-40 h-40 drop-shadow-lg" />
          <div>
            <h1 className="text-4xl font-bold text-amber-900">
              {isRTL ? 'مرحباً بك في الجوديا' : 'Welcome to Al-Joudia'}
            </h1>
            <p className="text-amber-700 mt-3 text-lg">
              {isRTL
                ? 'نظام إدارة الحلويات الذكي'
                : 'Smart Sweets Management System'}
            </p>
          </div>
        </div>

        {/* الجانب الأيمن - النموذج */}
        <div className="flex justify-center">
          <Card className="w-full max-w-md bg-white shadow-xl rounded-3xl p-8 border border-amber-100">
            {/* شعار صغير للموبايل */}
            <div className="md:hidden text-center mb-6">
              <img src="/logo.png" alt="الجوديا" className="w-20 h-20 mx-auto" />
            </div>

            <h2 className="text-2xl font-bold text-amber-900 text-center mb-2">
              {isForgot
                ? (isRTL ? 'استعادة كلمة المرور' : 'Reset Password')
                : (isRTL ? 'تسجيل الدخول' : 'Login')}
            </h2>
            <p className="text-amber-600 text-center text-sm mb-6">
              {isForgot
                ? (isRTL ? 'أدخل بريدك الإلكتروني' : 'Enter your email')
                : (isRTL ? 'أ warm welcome awaits you' : 'Welcome back')}
            </p>

            {/* رسائل */}
            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm text-center mb-4">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 text-green-700 p-4 rounded-xl text-sm text-center mb-4">
                {success}
              </div>
            )}

            {/* نموذج تسجيل الدخول */}
            {!isForgot ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-amber-800 font-medium mb-2">
                    {isRTL ? 'اسم المستخدم' : 'Username'}
                  </label>
                  <div className="relative">
                    <User className={`absolute top-3.5 ${isRTL ? 'right-4' : 'left-4'} text-amber-600 h-5 w-5`} />
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 bg-amber-50 border border-amber-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm`}
                      placeholder={isRTL ? 'اسمك هنا' : 'Your username'}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-amber-800 font-medium mb-2">
                    {isRTL ? 'كلمة المرور' : 'Password'}
                  </label>
                  <div className="relative">
                    <Lock className={`absolute top-3.5 ${isRTL ? 'right-4' : 'left-4'} text-amber-600 h-5 w-5`} />
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className={`w-full ${isRTL ? 'pr-12 pl-12' : 'pl-12 pr-12'} py-3.5 bg-amber-50 border border-amber-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm`}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className={`absolute top-3.5 ${isRTL ? 'left-4' : 'right-4'} text-amber-600`}
                    >
                      {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => { setIsForgot(true); setError(''); setSuccess(''); }}
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

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-2xl shadow-lg transition-all duration-200 disabled:opacity-70"
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
              /* نموذج نسيان كلمة المرور */
              <form onSubmit={handleForgot} className="space-y-6">
                <div>
                  <label className="block text-amber-800 font-medium mb-2">
                    {isRTL ? 'البريد الإلكتروني' : 'Email'}
                  </label>
                  <div className="relative">
                    <User className={`absolute top-3.5 ${isRTL ? 'right-4' : 'left-4'} text-amber-600 h-5 w-5`} />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 bg-amber-50 border border-amber-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm`}
                      placeholder="email@company.com"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-2xl shadow-lg"
                >
                  {loading ? 'جاري الإرسال...' : (isRTL ? 'إرسال الرابط' : 'Send Reset Link')}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { setIsForgot(false); setEmail(''); setSuccess(''); }}
                  className="w-full text-amber-600 hover:text-amber-800 font-medium"
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
  );
}
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
  const isRtl = language === 'ar';

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const ok = await login(username, password);
      if (!ok) setError(isRtl ? 'بيانات غير صحيحة' : 'Invalid credentials');
    } catch {
      setError(isRtl ? 'خطأ في الاتصال' : 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setSuccess(isRtl ? 'تم إرسال الرابط إلى بريدك' : 'Reset link sent');
      setLoading(false);
    }, 800);
  };

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center p-4"
      style={{ fontFamily: 'Alexandria, sans-serif' }}
    >
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-10">
        {/* الجانب الأيسر - ترحيب */}
        <div className="hidden md:flex flex-col justify-center items-center text-center space-y-6">
          <img src="/logo.png" alt="الجوديا" className="w-40 h-40 drop-shadow-lg" />
          <div>
            <h1 className="text-4xl font-bold text-amber-900">
              {isRtl ? 'مرحباً بك في الجوديا' : 'Welcome to Al-Joudia'}
            </h1>
            <p className="text-amber-700 mt-3 text-lg">
              {isRtl
                ? 'نظام إدارة الحلويات الذكي'
                : 'Smart Sweets Management System'}
            </p>
          </div>
        </div>

        {/* الجانب الأيمن - النموذج */}
        <div className="flex justify-center">
          <Card className="w-full max-w-md bg-white shadow-sm border border-gray-100 rounded-xl p-6">
            {/* شعار للموبايل */}
            <div className="md:hidden text-center mb-6">
              <img src="/logo.png" alt="الجوديا" className="w-20 h-20 mx-auto" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
              {isForgot
                ? (isRtl ? 'استعادة كلمة المرور' : 'Reset Password')
                : (isRtl ? 'تسجيل الدخول' : 'Login')}
            </h2>
            <p className="text-gray-600 text-center text-sm mb-6">
              {isForgot
                ? (isRtl ? 'أدخل بريدك الإلكتروني' : 'Enter your email')
                : (isRtl ? 'أدخل بياناتك للوصول' : 'Enter your credentials')}
            </p>

            {/* رسائل */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-600 text-sm">{error}</span>
              </div>
            )}
            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <span className="text-green-700 text-sm">{success}</span>
              </div>
            )}

            {/* نموذج تسجيل الدخول */}
            {!isForgot ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-gray-900 font-medium text-sm mb-2">
                    {isRtl ? 'اسم المستخدم' : 'Username'}
                  </label>
                  <div className="relative group">
                    <User className={`absolute top-3.5 ${isRtl ? 'right-4' : 'left-4'} text-gray-400 group-focus-within:text-amber-500 h-5 w-5 transition-colors`} />
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className={`w-full ${isRtl ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white text-sm`}
                      placeholder={isRtl ? 'اسم المستخدم' : 'Username'}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-900 font-medium text-sm mb-2">
                    {isRtl ? 'كلمة المرور' : 'Password'}
                  </label>
                  <div className="relative group">
                    <Lock className={`absolute top-3.5 ${isRtl ? 'right-4' : 'left-4'} text-gray-400 group-focus-within:text-amber-500 h-5 w-5 transition-colors`} />
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className={`w-full ${isRtl ? 'pr-12 pl-12' : 'pl-12 pr-12'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white text-sm`}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className={`absolute top-3.5 ${isRtl ? 'left-4' : 'right-4'} text-gray-400 hover:text-amber-500`}
                    >
                      {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => { setIsForgot(true); setError(''); setSuccess(''); }}
                    className="text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
                  >
                    <Key className="h-4 w-4" />
                    {isRtl ? 'نسيت؟' : 'Forgot?'}
                  </button>
                  <button
                    type="button"
                    onClick={toggleLanguage}
                    className="text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    {isRtl ? 'EN' : 'AR'}
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
                      {isRtl ? 'جاري...' : 'Loading...'}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <LogIn className="h-5 w-5" />
                      {isRtl ? 'تسجيل الدخول' : 'Login'}
                    </span>
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleForgot} className="space-y-6">
                <div>
                  <label className="block text-gray-900 font-medium text-sm mb-2">
                    {isRtl ? 'البريد الإلكتروني' : 'Email'}
                  </label>
                  <div className="relative group">
                    <User className={`absolute top-3.5 ${isRtl ? 'right-4' : 'left-4'} text-gray-400 group-focus-within:text-amber-500 h-5 w-5 transition-colors`} />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className={`w-full ${isRtl ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white text-sm`}
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
                  {loading ? 'جاري الإرسال...' : (isRtl ? 'إرسال الرابط' : 'Send Reset Link')}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { setIsForgot(false); setEmail(''); setSuccess(''); }}
                  className="w-full py-2.5 text-amber-600 hover:text-amber-700 font-medium"
                >
                  <ArrowLeft className="h-4 w-4 me-2" />
                  {isRtl ? 'العودة' : 'Back to Login'}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
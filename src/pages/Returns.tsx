import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { returnsAPI } from '../services/returnsAPI';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { AlertCircle } from 'lucide-react';

export function Returns() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [returns, setReturns] = useState<Return[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || user.role !== 'admin') {
        setError(t('returns.unauthorized') || 'غير مصرح لك بالوصول');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const returnsResponse = await returnsAPI.getAll();
        setReturns(Array.isArray(returnsResponse) ? returnsResponse : []);
        setError('');
      } catch (err: unknown) {
        let errorMessage = t('returns.fetchError') || 'حدث خطأ أثناء جلب البيانات';
        if (typeof err === 'object' && err !== null && 'message' in err) {
          errorMessage = (err as { message: string }).message;
        }
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [t, user]);

  const handleUpdateStatus = async (returnId: string, status: string, reviewNotes?: string) => {
    try {
      await returnsAPI.updateReturnStatus(returnId, { status, reviewNotes });
      setReturns(returns.map((ret) => (ret._id === returnId ? { ...ret, status, reviewNotes } : ret)));
      setError('');
    } catch (err: unknown) {
      let errorMessage = t('returns.updateError') || 'حدث خطأ أثناء تحديث الحالة';
      if (typeof err === 'object' && err !== null && 'message' in err) {
        errorMessage = (err as { message: string }).message;
      }
      setError(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 min-h-screen bg-gray-50" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">{t('returns.adminManage') || 'إدارة المرتجعات (أدمن)'}</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-md flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {returns.length === 0 ? (
          <Card   
className="p-6  text-center bg-white rounded-md shadow-sm">
            <h3 className="text-lg font-medium text-gray-800">{t('returns.noReturns') || 'لا توجد مرتجعات'}</h3>
          </Card>
        ) : (
          returns.map((ret) => (
            <Card key={ret._id} className="bg-white rounded-md shadow-sm hover:shadow-md transition-shadow">
              <div className="p-4">
                <h3 className="font-medium text-gray-800">{ret.returnNumber}</h3>
                <p className="text-sm text-gray-500">{t('returns.order') || 'الطلب'}: {ret.order.orderNumber}</p>
                <p className="text-sm text-gray-500">{t('returns.branch') || 'الفرع'}: {ret.branch.name}</p>
                <p className="text-sm text-gray-500">{t('returns.status') || 'الحالة'}: {t(`returns.status.${ret.status}`) || ret.status}</p>
                <div className="mt-2">
                  <p className="text-sm font-medium text-gray-700">{t('returns.items') || 'العناصر'}:</p>
                  {ret.items.map((item, index) => (
                    <div key={index} className="text-sm text-gray-500">
                      <span>{item.product.name} ({item.quantity})</span> - <span>{item.reason}</span>
                    </div>
                  ))}
                </div>
                {ret.notes && <p className="text-sm text-gray-500">{t('returns.notes') || 'ملاحظات'}: {ret.notes}</p>}
                <p className="text-sm text-gray-500">{t('returns.createdBy') || 'أنشئ بواسطة'}: {ret.createdBy.username}</p>
                {ret.status === 'pending' && (
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="primary"
                      onClick={() => handleUpdateStatus(ret._id, 'approved', 'Approved by admin')}
                      className="bg-green-500 hover:bg-green-600 text-white rounded-md px-4 py-2"
                    >
                      {t('returns.approve') || 'الموافقة'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleUpdateStatus(ret._id, 'rejected', 'Rejected by admin')}
                      className="bg-red-500 hover:bg-red-600 text-white rounded-md px-4 py-2"
                    >
                      {t('returns.reject') || 'الرفض'}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
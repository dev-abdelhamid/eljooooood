import React, { useState, useEffect } from 'react';
import { branchesAPI } from '../services/api';
import { toast } from 'react-toastify';

interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
  code: string;
  address: string;
  city: string;
  phone?: string;
  user: {
    _id: string;
    name: string;
    nameEn?: string;
    username: string;
    email?: string;
    phone?: string;
    isActive: boolean;
  };
}

const Branches: React.FC = () => {
  const isRtl = localStorage.getItem('language') === 'ar';
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    code: '',
    address: '',
    city: '',
    phone: '',
    user: { name: '', nameEn: '', username: '', password: '', email: '', phone: '', isActive: true },
  });

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const response = await branchesAPI.getAll();
      setBranches(response.data || []);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل الفروع');
      toast.error(err.message || 'فشل تحميل الفروع');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name.includes('user.')) {
      const userField = name.split('.')[1];
      setFormData({
        ...formData,
        user: { ...formData.user, [userField]: value },
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editBranch) {
        await branchesAPI.update(editBranch._id, formData);
        toast.success('تم تعديل الفرع بنجاح');
      } else {
        await branchesAPI.create(formData);
        toast.success('تم إنشاء الفرع بنجاح');
      }
      setModalOpen(false);
      setEditBranch(null);
      setFormData({
        name: '',
        nameEn: '',
        code: '',
        address: '',
        city: '',
        phone: '',
        user: { name: '', nameEn: '', username: '', password: '', email: '', phone: '', isActive: true },
      });
      fetchBranches();
    } catch (err: any) {
      toast.error(err.message || 'فشل في حفظ الفرع');
    }
  };

  const handleEdit = (branch: Branch) => {
    setEditBranch(branch);
    setFormData({
      name: branch.name,
      nameEn: branch.nameEn || '',
      code: branch.code,
      address: branch.address,
      city: branch.city,
      phone: branch.phone || '',
      user: {
        name: branch.user.name,
        nameEn: branch.user.nameEn || '',
        username: branch.user.username,
        password: '',
        email: branch.user.email || '',
        phone: branch.user.phone || '',
        isActive: branch.user.isActive,
      },
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الفرع؟')) {
      try {
        await branchesAPI.delete(id);
        toast.success('تم حذف الفرع بنجاح');
        fetchBranches();
      } catch (err: any) {
        toast.error(err.message || 'فشل في حذف الفرع');
      }
    }
  };

  return (
    <div className={`container mx-auto p-4 ${isRtl ? 'text-right' : 'text-left'}`}>
      <h1 className="text-2xl font-bold mb-4">{isRtl ? 'إدارة الفروع' : 'Branches Management'}</h1>
      <button
        className="bg-blue-500 text-white px-4 py-2 rounded mb-4"
        onClick={() => {
          setEditBranch(null);
          setFormData({
            name: '',
            nameEn: '',
            code: '',
            address: '',
            city: '',
            phone: '',
            user: { name: '', nameEn: '', username: '', password: '', email: '', phone: '', isActive: true },
          });
          setModalOpen(true);
        }}
      >
        {isRtl ? 'إضافة فرع جديد' : 'Add New Branch'}
      </button>

      {loading && <p>{isRtl ? 'جاري التحميل...' : 'Loading...'}</p>}
      {error && <p className="text-red-500">{error}</p>}

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr>
              <th className="py-2 px-4 border">{isRtl ? 'اسم الفرع' : 'Branch Name'}</th>
              <th className="py-2 px-4 border">{isRtl ? 'الكود' : 'Code'}</th>
              <th className="py-2 px-4 border">{isRtl ? 'العنوان' : 'Address'}</th>
              <th className="py-2 px-4 border">{isRtl ? 'المدينة' : 'City'}</th>
              <th className="py-2 px-4 border">{isRtl ? 'اسم المستخدم' : 'User Name'}</th>
              <th className="py-2 px-4 border">{isRtl ? 'الإجراءات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((branch) => (
              <tr key={branch._id}>
                <td className="py-2 px-4 border">{isRtl ? branch.name : branch.nameEn || branch.name}</td>
                <td className="py-2 px-4 border">{branch.code}</td>
                <td className="py-2 px-4 border">{branch.address}</td>
                <td className="py-2 px-4 border">{branch.city}</td>
                <td className="py-2 px-4 border">{isRtl ? branch.user.name : branch.user.nameEn || branch.user.name}</td>
                <td className="py-2 px-4 border">
                  <button
                    className="bg-yellow-500 text-white px-2 py-1 rounded mr-2"
                    onClick={() => handleEdit(branch)}
                  >
                    {isRtl ? 'تعديل' : 'Edit'}
                  </button>
                  <button
                    className="bg-red-500 text-white px-2 py-1 rounded"
                    onClick={() => handleDelete(branch._id)}
                  >
                    {isRtl ? 'حذف' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editBranch ? (isRtl ? 'تعديل فرع' : 'Edit Branch') : (isRtl ? 'إضافة فرع' : 'Add Branch')}
            </h2>
            <form onSubmit={handleSubmit} dir={isRtl ? 'rtl' : 'ltr'}>
              <div className="mb-4">
                <label className="block mb-1">{isRtl ? 'اسم الفرع (عربي)' : 'Branch Name (Arabic)'}</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full border px-3 py-2 rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1">{isRtl ? 'اسم الفرع (إنجليزي)' : 'Branch Name (English)'}</label>
                <input
                  type="text"
                  name="nameEn"
                  value={formData.nameEn}
                  onChange={handleInputChange}
                  className="w-full border px-3 py-2 rounded"
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1">{isRtl ? 'الكود' : 'Code'}</label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleInputChange}
                  className="w-full border px-3 py-2 rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1">{isRtl ? 'العنوان' : 'Address'}</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full border px-3 py-2 rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1">{isRtl ? 'المدينة' : 'City'}</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="w-full border px-3 py-2 rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1">{isRtl ? 'الهاتف' : 'Phone'}</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full border px-3 py-2 rounded"
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1">{isRtl ? 'اسم المستخدم (عربي)' : 'User Name (Arabic)'}</label>
                <input
                  type="text"
                  name="user.name"
                  value={formData.user.name}
                  onChange={handleInputChange}
                  className="w-full border px-3 py-2 rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1">{isRtl ? 'اسم المستخدم (إنجليزي)' : 'User Name (English)'}</label>
                <input
                  type="text"
                  name="user.nameEn"
                  value={formData.user.nameEn}
                  onChange={handleInputChange}
                  className="w-full border px-3 py-2 rounded"
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1">{isRtl ? 'اسم المستخدم' : 'Username'}</label>
                <input
                  type="text"
                  name="user.username"
                  value={formData.user.username}
                  onChange={handleInputChange}
                  className="w-full border px-3 py-2 rounded"
                  required
                />
              </div>
              {!editBranch && (
                <div className="mb-4">
                  <label className="block mb-1">{isRtl ? 'كلمة المرور' : 'Password'}</label>
                  <input
                    type="password"
                    name="user.password"
                    value={formData.user.password}
                    onChange={handleInputChange}
                    className="w-full border px-3 py-2 rounded"
                    required
                  />
                </div>
              )}
              <div className="mb-4">
                <label className="block mb-1">{isRtl ? 'البريد الإلكتروني' : 'Email'}</label>
                <input
                  type="email"
                  name="user.email"
                  value={formData.user.email}
                  onChange={handleInputChange}
                  className="w-full border px-3 py-2 rounded"
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1">{isRtl ? 'هاتف المستخدم' : 'User Phone'}</label>
                <input
                  type="text"
                  name="user.phone"
                  value={formData.user.phone}
                  onChange={handleInputChange}
                  className="w-full border px-3 py-2 rounded"
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1">{isRtl ? 'تفعيل المستخدم' : 'User Active'}</label>
                <select
                  name="user.isActive"
                  value={formData.user.isActive.toString()}
                  onChange={handleInputChange}
                  className="w-full border px-3 py-2 rounded"
                >
                  <option value="true">{isRtl ? 'مفعل' : 'Active'}</option>
                  <option value="false">{isRtl ? 'غير مفعل' : 'Inactive'}</option>
                </select>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="bg-gray-500 text-white px-4 py-2 rounded mr-2"
                  onClick={() => setModalOpen(false)}
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
                  {editBranch ? (isRtl ? 'تحديث' : 'Update') : (isRtl ? 'إنشاء' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Branches;
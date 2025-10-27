import React, { useState } from 'react';
import { Shield, ArrowLeft, UserPlus } from 'lucide-react';

const RegisterPage = ({ theme, api, addNotification, onClose, onRegistered }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'staff', // Default role for registration
    practice: ''
  });
  const [registerError, setRegisterError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setRegisterError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setRegisterError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      // Register user
      const userData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        role: formData.role,
        practice: formData.practice || 'New Practice',
        status: 'pending' // New users start as pending until admin approves
      };

      const newUser = await api.createUser(userData);

      await addNotification('success', 'Registration successful! Please wait for admin approval.');

      // Notify parent and close
      if (onRegistered) {
        onRegistered(newUser);
      }

      onClose();
    } catch (error) {
      setRegisterError(error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950' : 'bg-gradient-to-br from-gray-100 via-white to-gray-100'}`}>
      <div className={`max-w-2xl w-full mx-4 rounded-xl border p-8 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
        <div className="mb-6">
          <button
            onClick={onClose}
            className={`flex items-center gap-2 text-sm mb-4 ${theme === 'dark' ? 'text-slate-400 hover:text-slate-300' : 'text-gray-600 hover:text-gray-700'}`}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </button>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <UserPlus className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Create Account</h1>
              <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Register for MedFlow</p>
            </div>
          </div>
        </div>

        {registerError && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg">
            <p className="text-red-400 text-sm">{registerError}</p>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                First Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-purple-500 ${
                  theme === 'dark'
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                required
                placeholder="John"
              />
            </div>

            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Last Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-purple-500 ${
                  theme === 'dark'
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                required
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Email Address <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-purple-500 ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              required
              placeholder="your.email@example.com"
            />
          </div>

          <div>
            <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              Phone Number <span className="text-red-400">*</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-purple-500 ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              required
              placeholder="(555) 123-4567"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Role <span className="text-red-400">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-purple-500 ${
                  theme === 'dark'
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                required
              >
                <option value="staff">Staff</option>
                <option value="doctor">Doctor</option>
                <option value="nurse">Nurse</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Practice Name
              </label>
              <input
                type="text"
                value={formData.practice}
                onChange={(e) => setFormData({ ...formData, practice: e.target.value })}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-purple-500 ${
                  theme === 'dark'
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="Your Medical Practice"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Password <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-purple-500 ${
                  theme === 'dark'
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                required
                minLength={6}
                placeholder="Minimum 6 characters"
              />
            </div>

            <div>
              <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Confirm Password <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-purple-500 ${
                  theme === 'dark'
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                required
                minLength={6}
                placeholder="Re-enter password"
              />
            </div>
          </div>

          <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'}`}>
            <p className={`text-sm ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
              <strong>Note:</strong> Your account will be pending approval by an administrator. You will receive an email once your account is activated.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg font-medium transition-colors text-white flex items-center justify-center gap-2 ${
                loading ? 'opacity-75 cursor-wait' : ''
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Creating Account...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Create Account
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;

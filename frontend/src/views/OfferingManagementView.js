import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import api from '../api/apiService';
import {
  Package,
  FolderTree,
  DollarSign,
  Users,
  Star,
  Tag,
  TrendingUp,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Search,
  Filter,
  X,
  Check,
  Clock,
  AlertCircle,
  Calendar,
  FileText,
  Award,
  BarChart3,
  ShoppingCart,
  Percent,
  ArrowLeft
} from 'lucide-react';

const OfferingManagementView = () => {
  const { user, theme, setCurrentModule } = useApp();
  const [activeTab, setActiveTab] = useState('offerings');
  const [offerings, setOfferings] = useState([]);
  const [packages, setPackages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    fetchData();
  }, [activeTab, selectedCategory, showActiveOnly]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'offerings') {
        const filters = {
          category_id: selectedCategory !== 'all' ? selectedCategory : null,
          is_active: showActiveOnly ? true : null
        };
        const data = await api.getOfferings(filters);
        setOfferings(data);
      } else if (activeTab === 'packages') {
        const filters = {
          category_id: selectedCategory !== 'all' ? selectedCategory : null,
          is_active: showActiveOnly ? true : null
        };
        const data = await api.getOfferingPackages(filters);
        setPackages(data);
      } else if (activeTab === 'categories') {
        const data = await api.getServiceCategories();
        setCategories(data);
      } else if (activeTab === 'promotions') {
        const data = await api.getOfferingPromotions(showActiveOnly ? true : null);
        setPromotions(data);
      } else if (activeTab === 'statistics') {
        const data = await api.getOfferingStatistics();
        setStatistics(data);
      }

      // Always fetch categories for filter dropdown
      if (activeTab !== 'categories') {
        const cats = await api.getServiceCategories();
        setCategories(cats);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    setSelectedItem(item);
    if (item) {
      setFormData(item);
    } else {
      resetFormData(type);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType('');
    setSelectedItem(null);
    setFormData({});
  };

  const resetFormData = (type) => {
    const defaults = {
      offering: {
        name: '',
        description: '',
        category_id: '',
        duration_minutes: 30,
        is_active: true,
        is_featured: false,
        available_online: true,
        requires_referral: false,
        cpt_codes: [],
        allowed_provider_specializations: []
      },
      package: {
        name: '',
        description: '',
        category_id: '',
        package_type: 'bundle',
        validity_days: 365,
        base_price: 0,
        discount_percentage: 0,
        is_active: true,
        is_featured: false,
        benefits: [],
        offerings: []
      },
      category: {
        name: '',
        description: '',
        icon: 'Package',
        color: '#3B82F6',
        display_order: 0,
        is_active: true
      },
      promotion: {
        name: '',
        description: '',
        promo_code: '',
        discount_type: 'percentage',
        discount_value: 0,
        applicable_to: 'all',
        is_active: true,
        max_uses_per_patient: 1
      }
    };
    setFormData(defaults[type] || {});
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      if (modalType === 'offering') {
        if (selectedItem) {
          await api.updateOffering(selectedItem.id, formData);
        } else {
          await api.createOffering({ ...formData, created_by: user.id });
        }
      } else if (modalType === 'package') {
        if (selectedItem) {
          await api.updateOfferingPackage(selectedItem.id, formData);
        } else {
          await api.createOfferingPackage({ ...formData, created_by: user.id });
        }
      } else if (modalType === 'category') {
        if (selectedItem) {
          await api.updateServiceCategory(selectedItem.id, formData);
        } else {
          await api.createServiceCategory(formData);
        }
      } else if (modalType === 'promotion') {
        if (selectedItem) {
          await api.updateOfferingPromotion(selectedItem.id, formData);
        } else {
          await api.createOfferingPromotion({ ...formData, created_by: user.id });
        }
      }

      closeModal();
      fetchData();
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, type) => {
    if (!window.confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      setLoading(true);

      if (type === 'offering') {
        await api.deleteOffering(id);
      } else if (type === 'package') {
        await api.deleteOfferingPackage(id);
      } else if (type === 'category') {
        await api.deleteServiceCategory(id);
      }

      fetchData();
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Failed to delete: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id, type, currentStatus) => {
    try {
      if (type === 'offering') {
        await api.updateOffering(id, { is_active: !currentStatus });
      } else if (type === 'package') {
        await api.updateOfferingPackage(id, { is_active: !currentStatus });
      } else if (type === 'category') {
        await api.updateServiceCategory(id, { is_active: !currentStatus });
      } else if (type === 'promotion') {
        await api.updateOfferingPromotion(id, { is_active: !currentStatus });
      }
      fetchData();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const filteredOfferings = offerings.filter(offering =>
    offering.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    offering.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPackages = packages.filter(pkg =>
    pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pkg.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPromotions = promotions.filter(promo =>
    promo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    promo.promo_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`p-6 ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => setCurrentModule('dashboard')}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-200'
            }`}
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-bold">Healthcare Offering Management</h1>
        </div>
        <p className="text-gray-500 ml-14">Manage your healthcare services, packages, and promotions</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {[
            { id: 'offerings', label: 'Services', icon: Package },
            { id: 'packages', label: 'Packages', icon: ShoppingCart },
            { id: 'categories', label: 'Categories', icon: FolderTree },
            { id: 'promotions', label: 'Promotions', icon: Tag },
            { id: 'statistics', label: 'Statistics', icon: BarChart3 }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Filters and Search */}
      {activeTab !== 'statistics' && (
        <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-10 pr-4 py-2 border rounded-lg ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>

            {(activeTab === 'offerings' || activeTab === 'packages') && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={`px-4 py-2 border rounded-lg ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            )}

            <button
              onClick={() => setShowActiveOnly(!showActiveOnly)}
              className={`px-4 py-2 border rounded-lg flex items-center gap-2 ${
                showActiveOnly
                  ? 'bg-blue-500 text-white border-blue-500'
                  : theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <Filter className="w-4 h-4" />
              {showActiveOnly ? 'Active Only' : 'Show All'}
            </button>
          </div>

          <button
            onClick={() => openModal(
              activeTab === 'offerings' ? 'offering' :
              activeTab === 'packages' ? 'package' :
              activeTab === 'categories' ? 'category' :
              activeTab === 'promotions' ? 'promotion' : ''
            )}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2 hover:bg-blue-600"
          >
            <Plus className="w-5 h-5" />
            Add New {activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(1, -1)}
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {/* Offerings Tab */}
          {activeTab === 'offerings' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOfferings.map(offering => (
                <OfferingCard
                  key={offering.id}
                  offering={offering}
                  theme={theme}
                  onEdit={() => openModal('offering', offering)}
                  onDelete={() => handleDelete(offering.id, 'offering')}
                  onToggleStatus={() => toggleStatus(offering.id, 'offering', offering.is_active)}
                />
              ))}
              {filteredOfferings.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500">
                  No offerings found. Click "Add New" to create one.
                </div>
              )}
            </div>
          )}

          {/* Packages Tab */}
          {activeTab === 'packages' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPackages.map(pkg => (
                <PackageCard
                  key={pkg.id}
                  package={pkg}
                  theme={theme}
                  onEdit={() => openModal('package', pkg)}
                  onDelete={() => handleDelete(pkg.id, 'package')}
                  onToggleStatus={() => toggleStatus(pkg.id, 'package', pkg.is_active)}
                />
              ))}
              {filteredPackages.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500">
                  No packages found. Click "Add New" to create one.
                </div>
              )}
            </div>
          )}

          {/* Categories Tab */}
          {activeTab === 'categories' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredCategories.map(category => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  theme={theme}
                  onEdit={() => openModal('category', category)}
                  onDelete={() => handleDelete(category.id, 'category')}
                  onToggleStatus={() => toggleStatus(category.id, 'category', category.is_active)}
                />
              ))}
              {filteredCategories.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500">
                  No categories found.
                </div>
              )}
            </div>
          )}

          {/* Promotions Tab */}
          {activeTab === 'promotions' && (
            <div className="space-y-4">
              {filteredPromotions.map(promo => (
                <PromotionCard
                  key={promo.id}
                  promotion={promo}
                  theme={theme}
                  onEdit={() => openModal('promotion', promo)}
                  onToggleStatus={() => toggleStatus(promo.id, 'promotion', promo.is_active)}
                />
              ))}
              {filteredPromotions.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No promotions found. Click "Add New" to create one.
                </div>
              )}
            </div>
          )}

          {/* Statistics Tab */}
          {activeTab === 'statistics' && statistics && (
            <StatisticsView statistics={statistics} theme={theme} />
          )}
        </>
      )}

      {/* Modal */}
      {showModal && (
        <FormModal
          type={modalType}
          formData={formData}
          setFormData={setFormData}
          onSave={handleSave}
          onClose={closeModal}
          theme={theme}
          categories={categories}
          offerings={offerings}
        />
      )}
    </div>
  );
};

// Offering Card Component
const OfferingCard = ({ offering, theme, onEdit, onDelete, onToggleStatus }) => (
  <div className={`rounded-lg border p-6 ${
    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
  }`}>
    <div className="flex justify-between items-start mb-4">
      <div className="flex-1">
        <h3 className="text-lg font-semibold mb-1">{offering.name}</h3>
        <div className="flex items-center gap-2 mb-2">
          {offering.category_name && (
            <span
              className="text-xs px-2 py-1 rounded-full"
              style={{
                backgroundColor: offering.category_color + '20',
                color: offering.category_color
              }}
            >
              {offering.category_name}
            </span>
          )}
          {offering.is_featured && (
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onToggleStatus} className="text-gray-400 hover:text-gray-600">
          {offering.is_active ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
        </button>
        <button onClick={onEdit} className="text-blue-500 hover:text-blue-700">
          <Edit2 className="w-5 h-5" />
        </button>
        <button onClick={onDelete} className="text-red-500 hover:text-red-700">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>

    <p className="text-sm text-gray-500 mb-4 line-clamp-2">{offering.description}</p>

    <div className="space-y-2 text-sm">
      {offering.duration_minutes && (
        <div className="flex items-center gap-2 text-gray-600">
          <Clock className="w-4 h-4" />
          <span>{offering.duration_minutes} minutes</span>
        </div>
      )}
      {offering.pricing_options && offering.pricing_options.length > 0 && (
        <div className="flex items-center gap-2 text-gray-600">
          <DollarSign className="w-4 h-4" />
          <span>
            ${Math.min(...offering.pricing_options.map(p => p.final_price))} -
            ${Math.max(...offering.pricing_options.map(p => p.final_price))}
          </span>
        </div>
      )}
      {offering.average_rating > 0 && (
        <div className="flex items-center gap-2 text-gray-600">
          <Star className="w-4 h-4 text-yellow-500" />
          <span>{offering.average_rating.toFixed(1)} ({offering.review_count} reviews)</span>
        </div>
      )}
    </div>

    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between text-xs text-gray-500">
      <span>{offering.view_count} views</span>
      <span>{offering.booking_count} bookings</span>
    </div>
  </div>
);

// Package Card Component
const PackageCard = ({ package: pkg, theme, onEdit, onDelete, onToggleStatus }) => (
  <div className={`rounded-lg border p-6 ${
    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
  }`}>
    <div className="flex justify-between items-start mb-4">
      <div className="flex-1">
        <h3 className="text-lg font-semibold mb-1">{pkg.name}</h3>
        <div className="flex items-center gap-2 mb-2">
          {pkg.category_name && (
            <span
              className="text-xs px-2 py-1 rounded-full"
              style={{
                backgroundColor: pkg.category_color + '20',
                color: pkg.category_color
              }}
            >
              {pkg.category_name}
            </span>
          )}
          {pkg.is_featured && (
            <Award className="w-4 h-4 text-purple-500" />
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onToggleStatus} className="text-gray-400 hover:text-gray-600">
          {pkg.is_active ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
        </button>
        <button onClick={onEdit} className="text-blue-500 hover:text-blue-700">
          <Edit2 className="w-5 h-5" />
        </button>
        <button onClick={onDelete} className="text-red-500 hover:text-red-700">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>

    <p className="text-sm text-gray-500 mb-4 line-clamp-2">{pkg.description}</p>

    <div className="mb-4">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-green-600">${pkg.final_price}</span>
        {pkg.discount_percentage > 0 && (
          <>
            <span className="text-sm line-through text-gray-400">${pkg.base_price}</span>
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
              {pkg.discount_percentage}% OFF
            </span>
          </>
        )}
      </div>
    </div>

    {pkg.included_offerings && pkg.included_offerings.length > 0 && (
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-600 mb-2">Includes:</p>
        <ul className="text-xs text-gray-500 space-y-1">
          {pkg.included_offerings.slice(0, 3).map((offering, idx) => (
            <li key={idx} className="flex items-start gap-1">
              <Check className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
              <span>{offering.offering_name} {offering.quantity > 1 && `(x${offering.quantity})`}</span>
            </li>
          ))}
          {pkg.included_offerings.length > 3 && (
            <li className="text-blue-500">+{pkg.included_offerings.length - 3} more</li>
          )}
        </ul>
      </div>
    )}

    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between text-xs text-gray-500">
      <span className="flex items-center gap-1">
        <Calendar className="w-3 h-3" />
        {pkg.validity_days} days
      </span>
      <span>{pkg.enrollment_count} enrollments</span>
    </div>
  </div>
);

// Category Card Component
const CategoryCard = ({ category, theme, onEdit, onDelete, onToggleStatus }) => (
  <div
    className={`rounded-lg border p-4 ${
      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    }`}
    style={{ borderLeftWidth: '4px', borderLeftColor: category.color }}
  >
    <div className="flex justify-between items-start mb-2">
      <div className="flex items-center gap-2">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: category.color + '20' }}
        >
          <Package className="w-5 h-5" style={{ color: category.color }} />
        </div>
        <div>
          <h3 className="font-semibold">{category.name}</h3>
          <p className="text-xs text-gray-500">{category.offering_count || 0} offerings</p>
        </div>
      </div>
      <div className="flex gap-1">
        <button onClick={onToggleStatus} className="text-gray-400 hover:text-gray-600">
          {category.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
        <button onClick={onEdit} className="text-blue-500 hover:text-blue-700">
          <Edit2 className="w-4 h-4" />
        </button>
        <button onClick={onDelete} className="text-red-500 hover:text-red-700">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
    {category.description && (
      <p className="text-xs text-gray-500 mt-2 line-clamp-2">{category.description}</p>
    )}
  </div>
);

// Promotion Card Component
const PromotionCard = ({ promotion, theme, onEdit, onToggleStatus }) => (
  <div className={`rounded-lg border p-6 ${
    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
  }`}>
    <div className="flex justify-between items-start">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <Tag className="w-6 h-6 text-orange-500" />
          <div>
            <h3 className="text-lg font-semibold">{promotion.name}</h3>
            {promotion.promo_code && (
              <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                {promotion.promo_code}
              </code>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-4">{promotion.description}</p>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Discount:</span>
            <p className="font-semibold">
              {promotion.discount_type === 'percentage'
                ? `${promotion.discount_value}%`
                : `$${promotion.discount_value}`}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Usage:</span>
            <p className="font-semibold">
              {promotion.current_uses || 0}
              {promotion.max_uses && ` / ${promotion.max_uses}`}
            </p>
          </div>
          {promotion.valid_from && (
            <div>
              <span className="text-gray-500">Valid From:</span>
              <p className="font-semibold">
                {new Date(promotion.valid_from).toLocaleDateString()}
              </p>
            </div>
          )}
          {promotion.valid_until && (
            <div>
              <span className="text-gray-500">Valid Until:</span>
              <p className="font-semibold">
                {new Date(promotion.valid_until).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={onToggleStatus} className="text-gray-400 hover:text-gray-600">
          {promotion.is_active ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
        </button>
        <button onClick={onEdit} className="text-blue-500 hover:text-blue-700">
          <Edit2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  </div>
);

// Statistics View Component
const StatisticsView = ({ statistics, theme }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <StatCard
        title="Active Offerings"
        value={statistics.overview.active_offerings}
        icon={Package}
        color="blue"
        theme={theme}
      />
      <StatCard
        title="Active Packages"
        value={statistics.overview.active_packages}
        icon={ShoppingCart}
        color="purple"
        theme={theme}
      />
      <StatCard
        title="Active Enrollments"
        value={statistics.overview.active_enrollments}
        icon={Users}
        color="green"
        theme={theme}
      />
      <StatCard
        title="Total Revenue"
        value={`$${parseFloat(statistics.overview.total_revenue || 0).toLocaleString()}`}
        icon={DollarSign}
        color="emerald"
        theme={theme}
      />
      <StatCard
        title="Total Reviews"
        value={statistics.overview.total_reviews}
        icon={Star}
        color="yellow"
        theme={theme}
      />
      <StatCard
        title="Average Rating"
        value={parseFloat(statistics.overview.average_rating || 0).toFixed(1)}
        icon={Award}
        color="orange"
        theme={theme}
      />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className={`rounded-lg border p-6 ${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Top Offerings
        </h3>
        <div className="space-y-3">
          {statistics.top_offerings.map((offering, idx) => (
            <div key={offering.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-400">#{idx + 1}</span>
                <span className="text-sm">{offering.name}</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{offering.booking_count} bookings</p>
                <p className="text-xs text-gray-500">{offering.view_count} views</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`rounded-lg border p-6 ${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Award className="w-5 h-5" />
          Top Packages
        </h3>
        <div className="space-y-3">
          {statistics.top_packages.map((pkg, idx) => (
            <div key={pkg.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-400">#{idx + 1}</span>
                <span className="text-sm">{pkg.name}</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{pkg.enrollment_count} enrollments</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// Stat Card Component
const StatCard = ({ title, value, icon: Icon, color, theme }) => {
  const colors = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    green: 'bg-green-500',
    emerald: 'bg-emerald-500',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500'
  };

  return (
    <div className={`rounded-lg border p-6 ${
      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg ${colors[color]} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
};

// Form Modal Component
const FormModal = ({ type, formData, setFormData, onSave, onClose, theme, categories, offerings }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto ${
        theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
      }`}>
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold">
            {formData.id ? 'Edit' : 'Create'} {type.charAt(0).toUpperCase() + type.slice(1)}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {type === 'offering' && (
            <OfferingForm formData={formData} setFormData={setFormData} categories={categories} theme={theme} />
          )}
          {type === 'package' && (
            <PackageForm formData={formData} setFormData={setFormData} categories={categories} offerings={offerings} theme={theme} />
          )}
          {type === 'category' && (
            <CategoryForm formData={formData} setFormData={setFormData} theme={theme} />
          )}
          {type === 'promotion' && (
            <PromotionForm formData={formData} setFormData={setFormData} theme={theme} />
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className={`px-4 py-2 border rounded-lg ${
              theme === 'dark'
                ? 'border-gray-700 text-gray-300 hover:bg-gray-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// Offering Form
const OfferingForm = ({ formData, setFormData, categories, theme }) => (
  <>
    <InputField label="Service Name" value={formData.name} onChange={(v) => setFormData({...formData, name: v})} theme={theme} required />
    <TextAreaField label="Description" value={formData.description} onChange={(v) => setFormData({...formData, description: v})} theme={theme} />
    <SelectField label="Category" value={formData.category_id} onChange={(v) => setFormData({...formData, category_id: v})} options={categories.map(c => ({value: c.id, label: c.name}))} theme={theme} />
    <InputField label="Duration (minutes)" type="number" value={formData.duration_minutes} onChange={(v) => setFormData({...formData, duration_minutes: parseInt(v)})} theme={theme} />
    <CheckboxField label="Active" checked={formData.is_active} onChange={(v) => setFormData({...formData, is_active: v})} theme={theme} />
    <CheckboxField label="Featured" checked={formData.is_featured} onChange={(v) => setFormData({...formData, is_featured: v})} theme={theme} />
    <CheckboxField label="Available Online" checked={formData.available_online} onChange={(v) => setFormData({...formData, available_online: v})} theme={theme} />
  </>
);

// Package Form
const PackageForm = ({ formData, setFormData, categories, offerings, theme }) => (
  <>
    <InputField label="Package Name" value={formData.name} onChange={(v) => setFormData({...formData, name: v})} theme={theme} required />
    <TextAreaField label="Description" value={formData.description} onChange={(v) => setFormData({...formData, description: v})} theme={theme} />
    <SelectField label="Category" value={formData.category_id} onChange={(v) => setFormData({...formData, category_id: v})} options={categories.map(c => ({value: c.id, label: c.name}))} theme={theme} />
    <InputField label="Base Price" type="number" step="0.01" value={formData.base_price} onChange={(v) => setFormData({...formData, base_price: parseFloat(v)})} theme={theme} required />
    <InputField label="Discount %" type="number" value={formData.discount_percentage} onChange={(v) => setFormData({...formData, discount_percentage: parseFloat(v)})} theme={theme} />
    <InputField label="Validity (days)" type="number" value={formData.validity_days} onChange={(v) => setFormData({...formData, validity_days: parseInt(v)})} theme={theme} />
    <CheckboxField label="Active" checked={formData.is_active} onChange={(v) => setFormData({...formData, is_active: v})} theme={theme} />
    <CheckboxField label="Featured" checked={formData.is_featured} onChange={(v) => setFormData({...formData, is_featured: v})} theme={theme} />
  </>
);

// Category Form
const CategoryForm = ({ formData, setFormData, theme }) => (
  <>
    <InputField label="Category Name" value={formData.name} onChange={(v) => setFormData({...formData, name: v})} theme={theme} required />
    <TextAreaField label="Description" value={formData.description} onChange={(v) => setFormData({...formData, description: v})} theme={theme} />
    <InputField label="Color" type="color" value={formData.color} onChange={(v) => setFormData({...formData, color: v})} theme={theme} />
    <InputField label="Display Order" type="number" value={formData.display_order} onChange={(v) => setFormData({...formData, display_order: parseInt(v)})} theme={theme} />
    <CheckboxField label="Active" checked={formData.is_active} onChange={(v) => setFormData({...formData, is_active: v})} theme={theme} />
  </>
);

// Promotion Form
const PromotionForm = ({ formData, setFormData, theme }) => (
  <>
    <InputField label="Promotion Name" value={formData.name} onChange={(v) => setFormData({...formData, name: v})} theme={theme} required />
    <InputField label="Promo Code" value={formData.promo_code} onChange={(v) => setFormData({...formData, promo_code: v.toUpperCase()})} theme={theme} />
    <TextAreaField label="Description" value={formData.description} onChange={(v) => setFormData({...formData, description: v})} theme={theme} />
    <SelectField
      label="Discount Type"
      value={formData.discount_type}
      onChange={(v) => setFormData({...formData, discount_type: v})}
      options={[
        {value: 'percentage', label: 'Percentage'},
        {value: 'fixed_amount', label: 'Fixed Amount'}
      ]}
      theme={theme}
    />
    <InputField label="Discount Value" type="number" step="0.01" value={formData.discount_value} onChange={(v) => setFormData({...formData, discount_value: parseFloat(v)})} theme={theme} required />
    <CheckboxField label="Active" checked={formData.is_active} onChange={(v) => setFormData({...formData, is_active: v})} theme={theme} />
  </>
);

// Form Field Components
const InputField = ({ label, value, onChange, type = 'text', theme, required, ...props }) => (
  <div>
    <label className="block text-sm font-medium mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2 border rounded-lg ${
        theme === 'dark'
          ? 'bg-gray-700 border-gray-600 text-white'
          : 'bg-white border-gray-300 text-gray-900'
      }`}
      required={required}
      {...props}
    />
  </div>
);

const TextAreaField = ({ label, value, onChange, theme }) => (
  <div>
    <label className="block text-sm font-medium mb-1">{label}</label>
    <textarea
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      className={`w-full px-3 py-2 border rounded-lg ${
        theme === 'dark'
          ? 'bg-gray-700 border-gray-600 text-white'
          : 'bg-white border-gray-300 text-gray-900'
      }`}
    />
  </div>
);

const SelectField = ({ label, value, onChange, options, theme }) => (
  <div>
    <label className="block text-sm font-medium mb-1">{label}</label>
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2 border rounded-lg ${
        theme === 'dark'
          ? 'bg-gray-700 border-gray-600 text-white'
          : 'bg-white border-gray-300 text-gray-900'
      }`}
    >
      <option value="">Select...</option>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

const CheckboxField = ({ label, checked, onChange, theme }) => (
  <div className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={checked || false}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4"
    />
    <label className="text-sm font-medium">{label}</label>
  </div>
);

export default OfferingManagementView;

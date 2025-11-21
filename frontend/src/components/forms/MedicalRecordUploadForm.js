import React, { useState } from 'react';
import { Upload, X, FileText, Image, File } from 'lucide-react';

const MedicalRecordUploadForm = ({ patientId, onSuccess, onCancel, theme = 'light' }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    classification: 'General',
    file: null
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  const classifications = [
    'General',
    'Lab Results',
    'Imaging',
    'Prescription',
    'Vaccination Record',
    'Insurance',
    'Consultation Notes',
    'Surgery Report',
    'Discharge Summary',
    'Other'
  ];

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf',
                            'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                            'text/plain'];
      if (!allowedTypes.includes(file.type)) {
        setError('Only images (JPEG, PNG), PDFs, and documents (DOC, DOCX, TXT) are allowed');
        return;
      }

      setFormData({ ...formData, file });
      setError('');

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result);
        };
        reader.readAsDataURL(file);
      } else {
        setPreview(null);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.file) {
      setError('Please select a file to upload');
      return;
    }

    if (!formData.title.trim()) {
      setError('Please enter a title for this record');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', formData.file);
      uploadFormData.append('patientId', patientId);
      uploadFormData.append('title', formData.title);
      uploadFormData.append('description', formData.description);
      uploadFormData.append('classification', formData.classification);
      uploadFormData.append('recordDate', new Date().toISOString().split('T')[0]);

      const response = await fetch('/api/medical-records/with-file', {
        method: 'POST',
        body: uploadFormData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();

      // Reset form
      setFormData({
        title: '',
        description: '',
        classification: 'General',
        file: null
      });
      setPreview(null);

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = () => {
    if (!formData.file) return <File className="w-8 h-8" />;

    const type = formData.file.type;
    if (type.startsWith('image/')) {
      return <Image className="w-8 h-8 text-blue-500" />;
    } else if (type === 'application/pdf') {
      return <FileText className="w-8 h-8 text-red-500" />;
    } else {
      return <FileText className="w-8 h-8 text-gray-500" />;
    }
  };

  return (
    <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
      <div className="flex justify-between items-center mb-6">
        <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Upload Medical Record
        </h3>
        {onCancel && (
          <button
            onClick={onCancel}
            className={`p-2 rounded-lg hover:bg-gray-100 ${theme === 'dark' ? 'hover:bg-slate-700' : ''}`}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* File Upload Area */}
        <div>
          <label className={`block text-sm mb-2 font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
            File Upload *
          </label>
          <div className={`border-2 border-dashed rounded-lg p-6 text-center ${
            theme === 'dark' ? 'border-slate-600 bg-slate-700/50' : 'border-gray-300 bg-gray-50'
          }`}>
            {!formData.file ? (
              <div>
                <Upload className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`} />
                <label className="cursor-pointer">
                  <span className="text-cyan-500 hover:text-cyan-600 font-medium">Click to upload</span>
                  <span className={`${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}> or drag and drop</span>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.txt"
                  />
                </label>
                <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                  PNG, JPG, PDF, DOC up to 10MB
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {preview ? (
                  <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded" />
                ) : (
                  <div className="flex items-center justify-center">
                    {getFileIcon()}
                  </div>
                )}
                <div className={`flex items-center justify-center gap-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  <span className="font-medium">{formData.file.name}</span>
                  <span className="text-sm">({(formData.file.size / 1024).toFixed(0)} KB)</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, file: null });
                    setPreview(null);
                  }}
                  className="text-red-500 hover:text-red-600 text-sm font-medium"
                >
                  Remove file
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className={`block text-sm mb-2 font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
            Title *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., Blood Test Results - January 2024"
            className={`w-full px-4 py-2 border rounded-lg ${
              theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
            }`}
            required
          />
        </div>

        {/* Classification */}
        <div>
          <label className={`block text-sm mb-2 font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
            Classification
          </label>
          <select
            value={formData.classification}
            onChange={(e) => setFormData({ ...formData, classification: e.target.value })}
            className={`w-full px-4 py-2 border rounded-lg ${
              theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            {classifications.map((classification) => (
              <option key={classification} value={classification}>
                {classification}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className={`block text-sm mb-2 font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
            Description (Optional)
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Add any additional notes about this record..."
            rows="3"
            className={`w-full px-4 py-2 border rounded-lg ${
              theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
            }`}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-100 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={uploading || !formData.file}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              uploading || !formData.file
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-cyan-500 hover:bg-cyan-600 text-white'
            }`}
          >
            {uploading ? 'Uploading...' : 'Upload Record'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className={`px-6 py-2 rounded-lg font-medium ${
                theme === 'dark'
                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default MedicalRecordUploadForm;

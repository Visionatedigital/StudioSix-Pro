import React, { useState } from 'react';
import {
  DocumentArrowDownIcon,
  XMarkIcon,
  DocumentIcon
} from '@heroicons/react/24/outline';

const SaveDialog = ({ isOpen, onClose, onSave }) => {
  const [fileName, setFileName] = useState('');
  const [fileFormat, setFileFormat] = useState('six.bim');
  const [savePath, setSavePath] = useState('Cloud');

  const supportedFormats = [
    { value: 'six.bim', label: 'StudioSix BIM Project (.six.bim)', description: 'Native StudioSix format with full BIM project data, geometry, and metadata' }
  ];

  const handleSave = () => {
    if (!fileName.trim()) {
      alert('Please enter a file name');
      return;
    }

    const saveData = {
      fileName: fileName.trim(),
      format: fileFormat,
      path: savePath || 'Cloud'
    };

    console.log('💾 SaveDialog: Saving with data:', saveData);
    onSave(saveData);
    onClose(); // Close dialog after save
  };

  const saveLocationOptions = [
    { value: 'Cloud', label: 'Cloud (StudioSix Account)', description: 'Save to your StudioSix cloud storage' },
    { value: 'Downloads', label: 'Downloads (Local Computer)', description: 'Download file to your computer' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-96 max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <DocumentArrowDownIcon className="w-6 h-6 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Save Project</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* File Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              File Name
            </label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="Enter file name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-gray-900 placeholder-gray-500"
              autoFocus
            />
          </div>

          {/* Save Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Save Location
            </label>
            <select
              value={savePath}
              onChange={(e) => setSavePath(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-gray-900"
            >
              {saveLocationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {saveLocationOptions.find(opt => opt.value === savePath) && (
              <p className="text-xs text-gray-500 mt-1">
                {saveLocationOptions.find(opt => opt.value === savePath).description}
              </p>
            )}
          </div>

          {/* File Format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              File Format
            </label>
            <select
              value={fileFormat}
              onChange={(e) => setFileFormat(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-gray-900"
            >
              {supportedFormats.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label}
                </option>
              ))}
            </select>
            {supportedFormats.find(f => f.value === fileFormat) && (
              <p className="text-xs text-gray-500 mt-1">
                {supportedFormats.find(f => f.value === fileFormat).description}
              </p>
            )}
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-md p-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <DocumentIcon className="w-4 h-4" />
              <span>
                {fileName || 'untitled'}.{fileFormat} 
                {savePath && ` in ${savePath}`}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <DocumentArrowDownIcon className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveDialog;
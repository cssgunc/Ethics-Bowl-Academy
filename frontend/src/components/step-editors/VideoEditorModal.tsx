'use client';

import { useState } from 'react';
import { VideoStep } from '@/lib/firebase/types';
import { useModuleStore } from '@/store/moduleStore';
import { useAlert } from '@/context/AlertContext';
import { v4 as uuidv4 } from 'uuid';

interface VideoEditorModalProps {
  moduleId: string;
  onClose: () => void;
  onBack: () => void;
  step?: VideoStep;
  onSave: (step: VideoStep) => void;
}

export default function VideoEditorModal({ moduleId, onClose, onBack, step, onSave }: VideoEditorModalProps) {
  const { userId } = useModuleStore();
  const { showAlert } = useAlert();

  const [formData, setFormData] = useState({
    title: step?.title || '',
    youtubeUrl: step?.youtubeUrl || '',
    estimatedMinutes: step?.estimatedMinutes?.toString() || '',
    isOptional: step?.isOptional || false,
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.title.trim()) {
      await showAlert('Validation Error', 'Please enter a video title', 'error');
      return;
    }

    if (!formData.youtubeUrl.trim()) {
      await showAlert('Validation Error', 'Please enter a YouTube URL', 'error');
      return;
    }

    // Basic URL validation
    try {
      new URL(formData.youtubeUrl);
    } catch {
      await showAlert('Validation Error', 'Please enter a valid URL', 'error');
      return;
    }

    if (!userId) {
      await showAlert('Authentication Error', 'User not authenticated', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const stepData: VideoStep = {
        id: step?.id || uuidv4(),
        moduleId,
        type: 'video',
        title: formData.title.trim(),
        youtubeUrl: formData.youtubeUrl.trim(),
        isOptional: formData.isOptional,
        order: step?.order ?? 0, // Order will be managed by parent
        createdBy: step?.createdBy || userId,
        createdAt: step?.createdAt || new Date(),
        updatedAt: new Date(),
        estimatedMinutes: formData.estimatedMinutes ? parseInt(formData.estimatedMinutes) : undefined,
      };

      onSave(stepData);
      onClose();
    } catch (error: any) {
      console.error('Error saving video step:', error);
      await showAlert('Error', `Failed to save video step: ${error.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              disabled={isSaving}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200 disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-xl font-bold text-gray-900">
              {step ? 'Edit Video' : 'Add Video'}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200 disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Video Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={isSaving}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                placeholder="Enter video title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                YouTube URL *
              </label>
              <input
                type="url"
                value={formData.youtubeUrl}
                onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
                disabled={isSaving}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                placeholder="https://youtube.com/watch?v=..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter a valid YouTube video URL
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estimated Minutes
              </label>
              <input
                type="number"
                value={formData.estimatedMinutes}
                onChange={(e) => setFormData({ ...formData, estimatedMinutes: e.target.value })}
                disabled={isSaving}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                placeholder="0"
                min="0"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isOptional"
                checked={formData.isOptional}
                onChange={(e) => setFormData({ ...formData, isOptional: e.target.checked })}
                disabled={isSaving}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="isOptional" className="text-sm font-medium text-gray-700">
                Optional step
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
          >
            {isSaving && (
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            {isSaving ? 'Saving...' : (step ? 'Update Video' : 'Add Video')}
          </button>
        </div>
      </div>
    </div>
  );
}

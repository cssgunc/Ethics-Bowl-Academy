'use client';

import { useRef, useState } from 'react';
import { FreeResponseStep } from '@/lib/firebase/types';
import { useModuleStore } from '@/store/moduleStore';
import { useAlert } from '@/context/AlertContext';
import { v4 as uuidv4 } from 'uuid';
import { uploadStepImage, getImageFromClipboard } from '@/lib/firebase/uploadStepImage';

interface FreeResponseEditorModalProps {
  moduleId: string;
  onClose: () => void;
  onBack: () => void;
  step?: FreeResponseStep;
  onSave: (step: FreeResponseStep) => void;
}

export default function FreeResponseEditorModal({ moduleId, onClose, onBack, step, onSave }: FreeResponseEditorModalProps) {
  const { userId } = useModuleStore();
  const { showAlert } = useAlert();

  const [formData, setFormData] = useState({
    title: step?.title || '',
    prompt: step?.prompt || '',
    sampleAnswer: step?.sampleAnswer || '',
    maxLength: step?.maxLength?.toString() || '',
    estimatedMinutes: step?.estimatedMinutes?.toString() || '',
    isOptional: step?.isOptional || false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeContextRef = useRef<{
    el: HTMLTextAreaElement;
    field: 'prompt' | 'sampleAnswer';
  } | null>(null);

  const uploadAndInsert = async (file: File) => {
    const ctx = activeContextRef.current;
    if (!ctx || !userId) return;
    setUploadingImage(true);
    try {
      const { url } = await uploadStepImage(file, moduleId, 'freeResponses', userId);
      const { el, field } = ctx;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const imgTag = `<img src="${url}" alt="Image" />`;
      setFormData(prev => ({ ...prev, [field]: el.value.slice(0, start) + imgTag + el.value.slice(end) }));
      setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = start + imgTag.length; }, 0);
    } catch (err: any) {
      await showAlert('Error', err.message ?? 'Failed to upload image', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!activeContextRef.current) {
      await showAlert('Error', 'Click into a text field before uploading an image', 'error');
      return;
    }
    await uploadAndInsert(file);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const image = getImageFromClipboard(e);
    if (!image) return;
    e.preventDefault();
    void uploadAndInsert(image);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      await showAlert('Validation Error', 'Please enter a free response prompt title', 'error');
      return;
    }

    if (!formData.prompt.trim()) {
      await showAlert('Validation Error', 'Please enter a prompt', 'error');
      return;
    }

    if (!userId) {
      await showAlert('Authentication Error', 'User not authenticated', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const stepData: FreeResponseStep = {
        id: step?.id || uuidv4(),
        moduleId,
        type: 'freeResponse',
        title: formData.title.trim(),
        prompt: formData.prompt.trim(),
        sampleAnswer: formData.sampleAnswer.trim() || undefined,
        maxLength: formData.maxLength ? parseInt(formData.maxLength) : undefined,
        estimatedMinutes: formData.estimatedMinutes ? parseInt(formData.estimatedMinutes) : undefined,
        isOptional: formData.isOptional,
        order: step?.order ?? 0, // Assigned by parent
        createdBy: step?.createdBy || userId,
        createdAt: step?.createdAt || new Date(),
        updatedAt: new Date(),
      };

      onSave(stepData);
      onClose();
    } catch (error: any) {
      console.error('Error saving free response step:', error);
      await showAlert('Error', `Failed to save free response step: ${error.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleImageUpload}
      />
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
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
              {step ? 'Edit Free Response' : 'Add Free Response'}
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
                Prompt Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={isSaving}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                placeholder="Enter prompt title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Free Response Prompt *
              </label>
              <textarea
                value={formData.prompt}
                onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                onFocus={(e) => { activeContextRef.current = { el: e.currentTarget, field: 'prompt' }; }}
                onPaste={handlePaste}
                disabled={isSaving}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                rows={4}
                placeholder="Enter your prompt here. This will guide the user's written response."
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage || isSaving}
                className="mt-1 flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors duration-200 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {uploadingImage ? 'Uploading...' : 'Upload image'}
              </button>
              <p className="text-xs text-gray-500 mt-1">
                Write a clear prompt that encourages thoughtful written responses.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sample Answer (Optional)
              </label>
              <textarea
                value={formData.sampleAnswer}
                onChange={(e) => setFormData({ ...formData, sampleAnswer: e.target.value })}
                onFocus={(e) => { activeContextRef.current = { el: e.currentTarget, field: 'sampleAnswer' }; }}
                onPaste={handlePaste}
                disabled={isSaving}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                rows={3}
                placeholder="Provide a sample answer or guidance"
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage || isSaving}
                className="mt-1 flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors duration-200 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {uploadingImage ? 'Uploading...' : 'Upload image'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Length (characters)
                </label>
                <input
                  type="number"
                  value={formData.maxLength}
                  onChange={(e) => setFormData({ ...formData, maxLength: e.target.value })}
                  disabled={isSaving}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  placeholder="No limit"
                  min="0"
                />
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
            {isSaving ? 'Saving...' : (step ? 'Update Free Response' : 'Add Free Response')}
          </button>
        </div>
      </div>
    </div>
  );
}

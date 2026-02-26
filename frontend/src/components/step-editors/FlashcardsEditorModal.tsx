'use client';

import { useRef, useState } from 'react';
import { FlashcardsStep, Flashcard } from '@/lib/firebase/types';
import { useModuleStore } from '@/store/moduleStore';
import { useAlert } from '@/context/AlertContext';
import { v4 as uuidv4 } from 'uuid';
import { uploadStepImage, getImageFromClipboard } from '@/lib/firebase/uploadStepImage';

interface FlashcardsEditorModalProps {
  moduleId: string;
  onClose: () => void;
  onBack: () => void;
  step?: FlashcardsStep;
  onSave: (step: FlashcardsStep) => void;
}

export default function FlashcardsEditorModal({ moduleId, onClose, onBack, step, onSave }: FlashcardsEditorModalProps) {
  const { userId } = useModuleStore();
  const { showAlert } = useAlert();

  const [formData, setFormData] = useState({
    title: step?.title || '',
    cards: step?.cards || [{ front: '', back: '' }],
    studyMode: step?.studyMode || 'random',
    estimatedMinutes: step?.estimatedMinutes?.toString() || '',
    isOptional: step?.isOptional || false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeContextRef = useRef<{
    el: HTMLTextAreaElement;
    cardIndex: number;
    field: 'front' | 'back';
  } | null>(null);

  const addCard = () => {
    setFormData({
      ...formData,
      cards: [...formData.cards, { front: '', back: '' }],
    });
  };

  const removeCard = (index: number) => {
    if (formData.cards.length > 1) {
      setFormData({
        ...formData,
        cards: formData.cards.filter((_, i) => i !== index),
      });
    }
  };

  const updateCard = (index: number, field: 'front' | 'back', value: string) => {
    const newCards = [...formData.cards];
    newCards[index] = { ...newCards[index], [field]: value };
    setFormData({ ...formData, cards: newCards });
  };

  const uploadAndInsert = async (file: File) => {
    const ctx = activeContextRef.current;
    if (!ctx || !userId) return;
    setUploadingImage(true);
    try {
      const { url } = await uploadStepImage(file, moduleId, 'flashcards', userId);
      const { el, cardIndex, field } = ctx;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const imgTag = `<img src="${url}" alt="Image" />`;
      updateCard(cardIndex, field, el.value.slice(0, start) + imgTag + el.value.slice(end));
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
      await showAlert('Validation Error', 'Please enter a flashcard set title', 'error');
      return;
    }

    const validCards = formData.cards.filter(card => card.front.trim() && card.back.trim());
    if (validCards.length === 0) {
      await showAlert('Validation Error', 'Please add at least one flashcard', 'error');
      return;
    }

    if (!userId) {
      await showAlert('Authentication Error', 'User not authenticated', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const stepData: FlashcardsStep = {
        id: step?.id || uuidv4(),
        moduleId,
        type: 'flashcards',
        title: formData.title.trim(),
        cards: validCards.map(card => ({
          front: card.front.trim(),
          back: card.back.trim(),
        })),
        studyMode: formData.studyMode as 'spaced' | 'random',
        isOptional: formData.isOptional,
        order: step?.order ?? 0, // Assigned by parent
        createdBy: step?.createdBy || userId,
        createdAt: step?.createdAt || new Date(),
        updatedAt: new Date(),
        estimatedMinutes: formData.estimatedMinutes ? parseInt(formData.estimatedMinutes) : undefined,
      };

      onSave(stepData);
      onClose();
    } catch (error: any) {
      console.error('Error saving flashcards step:', error);
      await showAlert('Error', `Failed to save flashcards step: ${error.message}`, 'error');
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
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
              {step ? 'Edit Flashcards' : 'Add Flashcards'}
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
        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Flashcard Set Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={isSaving}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                placeholder="Enter flashcard set title"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Study Mode
                </label>
                <select
                  value={formData.studyMode}
                  onChange={(e) => setFormData({ ...formData, studyMode: e.target.value as 'spaced' | 'random' })}
                  disabled={isSaving}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                >
                  <option value="random">Random</option>
                  <option value="spaced">Spaced Repetition</option>
                </select>
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

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Cards</h3>
                <button
                  onClick={addCard}
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Card
                </button>
              </div>

              <div className="space-y-4">
                {formData.cards.map((card, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">Card {index + 1}</span>
                      {formData.cards.length > 1 && (
                        <button
                          onClick={() => removeCard(index)}
                          disabled={isSaving}
                          className="text-red-500 hover:text-red-700 transition-colors duration-200 disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Front
                        </label>
                        <textarea
                          value={card.front}
                          onChange={(e) => updateCard(index, 'front', e.target.value)}
                          onFocus={(e) => { activeContextRef.current = { el: e.currentTarget, cardIndex: index, field: 'front' }; }}
                          onPaste={handlePaste}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                          rows={3}
                          placeholder="Enter front text"
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
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Back
                        </label>
                        <textarea
                          value={card.back}
                          onChange={(e) => updateCard(index, 'back', e.target.value)}
                          onFocus={(e) => { activeContextRef.current = { el: e.currentTarget, cardIndex: index, field: 'back' }; }}
                          onPaste={handlePaste}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                          rows={3}
                          placeholder="Enter back text"
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
                    </div>
                  </div>
                ))}
              </div>
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
            {isSaving ? 'Saving...' : (step ? 'Update Flashcards' : 'Add Flashcards')}
          </button>
        </div>
      </div>
    </div>
  );
}

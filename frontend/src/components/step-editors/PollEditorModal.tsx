'use client';

import { useState } from 'react';
import { PollStep, PollOption } from '@/lib/firebase/types';
import { useModuleStore } from '@/store/moduleStore';
import { useAlert } from '@/context/AlertContext';
import { v4 as uuidv4 } from 'uuid';

interface PollEditorModalProps {
  moduleId: string;
  onClose: () => void;
  onBack: () => void;
  step?: PollStep;
  onSave: (step: PollStep) => void;
}

export default function PollEditorModal({ moduleId, onClose, onBack, step, onSave }: PollEditorModalProps) {
  const { userId } = useModuleStore();
  const { showAlert } = useAlert();

  const [formData, setFormData] = useState({
    title: step?.title || '',
    question: step?.question || '',
    allowMultipleChoice: step?.allowMultipleChoice || false,
    estimatedMinutes: step?.estimatedMinutes?.toString() || '',
    isOptional: step?.isOptional || false,
  });

  const [options, setOptions] = useState<PollOption[]>(
    step?.options || [
      { id: '1', text: '', votes: 0 },
      { id: '2', text: '', votes: 0 }
    ]
  );

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.title.trim()) {
      await showAlert('Validation Error', 'Please enter a poll title', 'error');
      return;
    }

    if (!formData.question.trim()) {
      await showAlert('Validation Error', 'Please enter a question', 'error');
      return;
    }

    const validOptions = options.filter(opt => opt.text.trim());
    if (validOptions.length < 2) {
      await showAlert('Validation Error', 'Please provide at least 2 options', 'error');
      return;
    }

    if (!userId) {
      await showAlert('Authentication Error', 'User not authenticated', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const stepData: PollStep = {
        id: step?.id || uuidv4(),
        type: 'poll',
        title: formData.title.trim(),
        question: formData.question.trim(),
        options: validOptions,
        allowMultipleChoice: formData.allowMultipleChoice,
        isOptional: formData.isOptional,
        order: step?.order ?? 0, // Assigned by parent
        createdBy: step?.createdBy || userId,
        createdAt: step?.createdAt || new Date(),
        updatedAt: new Date(),
        estimatedMinutes: formData.estimatedMinutes ? parseInt(formData.estimatedMinutes) : undefined,
      };

      onSave(stepData);
      onClose();
    } catch (error) {
      console.error('Error saving poll step:', error);
      await showAlert('Error', 'Error saving poll step. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const addOption = () => {
    const newOption: PollOption = {
      id: Date.now().toString(),
      text: '',
      votes: 0
    };
    setOptions([...options, newOption]);
  };

  const removeOption = (id: string) => {
    if (options.length > 2) {
      setOptions(options.filter(opt => opt.id !== id));
    }
  };

  const updateOption = (id: string, text: string) => {
    setOptions(options.map(opt =>
      opt.id === id ? { ...opt, text } : opt
    ));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-xl font-bold text-gray-900">
              {step ? 'Edit Poll' : 'Create New Poll'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Poll Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Ethical Dilemma: Trolley Problem"
            />
          </div>

          {/* Question */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Question *
            </label>
            <textarea
              value={formData.question}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Describe the ethical dilemma or question for students to vote on..."
            />
          </div>

          {/* Options */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Options * (at least 2)
              </label>
              <button
                onClick={addOption}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
              >
                + Add Option
              </button>
            </div>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={option.id} className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 w-8">{index + 1}.</span>
                  <input
                    type="text"
                    value={option.text}
                    onChange={(e) => updateOption(option.id, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={`Option ${index + 1}`}
                  />
                  {options.length > 2 && (
                    <button
                      onClick={() => removeOption(option.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="allowMultipleChoice"
                checked={formData.allowMultipleChoice}
                onChange={(e) => setFormData({ ...formData, allowMultipleChoice: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="allowMultipleChoice" className="ml-2 text-sm text-gray-700">
                Allow multiple selections
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estimated Minutes (optional)
              </label>
              <input
                type="number"
                min="1"
                value={formData.estimatedMinutes}
                onChange={(e) => setFormData({ ...formData, estimatedMinutes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 5"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isOptional"
                checked={formData.isOptional}
                onChange={(e) => setFormData({ ...formData, isOptional: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="isOptional" className="ml-2 text-sm text-gray-700">
                Optional step
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? 'Saving...' : (step ? 'Update Poll' : 'Create Poll')}
          </button>
        </div>
      </div>
    </div>
  );
}

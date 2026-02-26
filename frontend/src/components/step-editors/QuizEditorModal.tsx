'use client';

import { useRef, useState } from 'react';
import { QuizStep, QuizQuestion } from '@/lib/firebase/types';
import { useModuleStore } from '@/store/moduleStore';
import { useAlert } from '@/context/AlertContext';
import { v4 as uuidv4 } from 'uuid';
import { uploadStepImage, getImageFromClipboard } from '@/lib/firebase/uploadStepImage';

interface QuizEditorModalProps {
  moduleId: string;
  onClose: () => void;
  onBack: () => void;
  step?: QuizStep;
  onSave: (step: QuizStep) => void;
}

export default function QuizEditorModal({ moduleId, onClose, onBack, step, onSave }: QuizEditorModalProps) {
  const { userId } = useModuleStore();
  const { showAlert } = useAlert();

  const [formData, setFormData] = useState({
    title: step?.title || '',
    questions: step?.questions.map(q => ({
      ...q,
      choiceExplanations: q.choiceExplanations || q.choices.map(() => ''),
    })) || [
        {
          prompt: '',
          choices: ['', '', '', ''],
          correctIndex: 0,
          choiceExplanations: ['', '', '', ''],
        },
      ],
    shuffle: step?.shuffle || false,
    passingScore: step?.passingScore?.toString() || '70',
    estimatedMinutes: step?.estimatedMinutes?.toString() || '',
    isOptional: step?.isOptional || false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeContextRef = useRef<{
    el: HTMLTextAreaElement;
    questionIndex: number;
  } | null>(null);

  const addQuestion = () => {
    setFormData({
      ...formData,
      questions: [
        ...formData.questions,
        {
          prompt: '',
          choices: ['', '', '', ''],
          correctIndex: 0,
          choiceExplanations: ['', '', '', ''],
        },
      ],
    });
  };

  const removeQuestion = (index: number) => {
    if (formData.questions.length > 1) {
      setFormData({
        ...formData,
        questions: formData.questions.filter((_, i) => i !== index),
      });
    }
  };

  const updateQuestion = (index: number, field: keyof QuizQuestion, value: any) => {
    const newQuestions = [...formData.questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setFormData({ ...formData, questions: newQuestions });
  };

  const addChoice = (questionIndex: number) => {
    const newQuestions = [...formData.questions];
    const question = newQuestions[questionIndex];
    question.choices.push('');
    if (!question.choiceExplanations) {
      question.choiceExplanations = question.choices.map(() => '');
    } else {
      question.choiceExplanations.push('');
    }
    setFormData({ ...formData, questions: newQuestions });
  };

  const removeChoice = (questionIndex: number, choiceIndex: number) => {
    const newQuestions = [...formData.questions];
    const question = newQuestions[questionIndex];

    if (question.choices.length > 2) {
      question.choices.splice(choiceIndex, 1);

      // Remove corresponding explanation
      if (question.choiceExplanations) {
        question.choiceExplanations.splice(choiceIndex, 1);
      }

      // Adjust correct index if necessary
      if (question.correctIndex >= choiceIndex) {
        question.correctIndex = Math.max(0, question.correctIndex - 1);
      }

      setFormData({ ...formData, questions: newQuestions });
    }
  };

  const updateChoice = (questionIndex: number, choiceIndex: number, value: string) => {
    const newQuestions = [...formData.questions];
    newQuestions[questionIndex].choices[choiceIndex] = value;
    setFormData({ ...formData, questions: newQuestions });
  };

  const updateChoiceExplanation = (questionIndex: number, choiceIndex: number, value: string) => {
    const newQuestions = [...formData.questions];
    const question = newQuestions[questionIndex];
    if (!question.choiceExplanations) {
      question.choiceExplanations = question.choices.map(() => '');
    }
    question.choiceExplanations[choiceIndex] = value;
    setFormData({ ...formData, questions: newQuestions });
  };

  const uploadAndInsert = async (file: File) => {
    const ctx = activeContextRef.current;
    if (!ctx || !userId) return;
    setUploadingImage(true);
    try {
      const { url } = await uploadStepImage(file, moduleId, 'quizzes', userId);
      const { el, questionIndex } = ctx;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const imgTag = `<img src="${url}" alt="Image" />`;
      updateQuestion(questionIndex, 'prompt', el.value.slice(0, start) + imgTag + el.value.slice(end));
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
      await showAlert('Error', 'Click into a question field before uploading an image', 'error');
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
      await showAlert('Validation Error', 'Please enter a quiz title', 'error');
      return;
    }

    const validQuestions = formData.questions.filter(
      q => q.prompt.trim() && q.choices.filter(opt => opt.trim()).length >= 2
    );

    if (validQuestions.length === 0) {
      await showAlert('Validation Error', 'Please add at least one valid question', 'error');
      return;
    }

    // Clean up questions - remove empty choices and ensure correct index is valid
    const cleanedQuestions = validQuestions.map(q => {
      const nonEmptyChoices = q.choices.filter(opt => opt.trim());
      const nonEmptyIndices: number[] = [];
      let currentIndex = 0;

      // Track which original indices correspond to non-empty choices
      q.choices.forEach((choice, idx) => {
        if (choice.trim()) {
          nonEmptyIndices.push(idx);
        }
      });

      const question: any = {
        prompt: q.prompt.trim(),
        choices: nonEmptyChoices,
        correctIndex: Math.min(q.correctIndex, nonEmptyChoices.length - 1),
      };

      // Process choiceExplanations - align with non-empty choices
      if (q.choiceExplanations && q.choiceExplanations.length > 0) {
        const cleanedExplanations = nonEmptyIndices.map(origIdx => {
          const explanation = q.choiceExplanations?.[origIdx];
          return explanation?.trim() || null;
        });

        // Only include if at least one explanation exists
        if (cleanedExplanations.some(e => e !== null)) {
          question.choiceExplanations = cleanedExplanations;
        }
      }

      // Keep legacy explanation for backward compatibility
      if (q.explanation) {
        question.explanation = q.explanation;
      }

      return question;
    });

    const passingScore = parseInt(formData.passingScore);
    if (isNaN(passingScore) || passingScore < 0 || passingScore > 100) {
      await showAlert('Validation Error', 'Please enter a valid passing score between 0 and 100', 'error');
      return;
    }

    if (!userId) {
      await showAlert('Authentication Error', 'User not authenticated', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const stepData: QuizStep = {
        id: step?.id || uuidv4(),
        moduleId,
        type: 'quiz',
        title: formData.title.trim(),
        questions: cleanedQuestions,
        shuffle: formData.shuffle,
        passingScore,
        isOptional: formData.isOptional,
        order: step?.order ?? 0, // Managed by parent
        createdBy: step?.createdBy || userId,
        createdAt: step?.createdAt || new Date(),
        updatedAt: new Date(),
        estimatedMinutes: formData.estimatedMinutes ? parseInt(formData.estimatedMinutes) : undefined,
      };

      onSave(stepData);
      onClose();
    } catch (error: any) {
      console.error('Error saving quiz step:', error);
      await showAlert('Error', `Failed to save quiz step: ${error.message}`, 'error');
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
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
              {step ? 'Edit Quiz' : 'Add Quiz'}
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
                Quiz Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={isSaving}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                placeholder="Enter quiz title"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Passing Score (%) *
                </label>
                <input
                  type="number"
                  value={formData.passingScore}
                  onChange={(e) => setFormData({ ...formData, passingScore: e.target.value })}
                  disabled={isSaving}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  placeholder="70"
                  min="0"
                  max="100"
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

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="shuffle"
                  checked={formData.shuffle}
                  onChange={(e) => setFormData({ ...formData, shuffle: e.target.checked })}
                  disabled={isSaving}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="shuffle" className="text-sm font-medium text-gray-700">
                  Shuffle questions
                </label>
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

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Questions</h3>
                <button
                  onClick={addQuestion}
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Question
                </button>
              </div>

              <div className="space-y-6">
                {formData.questions.map((question, questionIndex) => (
                  <div key={questionIndex} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-gray-700">Question {questionIndex + 1}</span>
                      {formData.questions.length > 1 && (
                        <button
                          onClick={() => removeQuestion(questionIndex)}
                          disabled={isSaving}
                          className="text-red-500 hover:text-red-700 transition-colors duration-200 disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Question Text *
                        </label>
                        <textarea
                          value={question.prompt}
                          onChange={(e) => updateQuestion(questionIndex, 'prompt', e.target.value)}
                          onFocus={(e) => { activeContextRef.current = { el: e.currentTarget, questionIndex }; }}
                          onPaste={handlePaste}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                          rows={2}
                          placeholder="Enter question text"
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
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Answer Choices *
                          </label>
                          <button
                            onClick={() => addChoice(questionIndex)}
                            disabled={isSaving}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors duration-200 disabled:opacity-50"
                          >
                            + Add Choice
                          </button>
                        </div>

                        <div className="space-y-3">
                          {question.choices.map((choice, choiceIndex) => (
                            <div key={choiceIndex} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`correct-${questionIndex}`}
                                  checked={question.correctIndex === choiceIndex}
                                  onChange={() => updateQuestion(questionIndex, 'correctIndex', choiceIndex)}
                                  disabled={isSaving}
                                  className="text-blue-600 focus:ring-blue-500"
                                />
                                <input
                                  type="text"
                                  value={choice}
                                  onChange={(e) => updateChoice(questionIndex, choiceIndex, e.target.value)}
                                  disabled={isSaving}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                                  placeholder={`Choice ${choiceIndex + 1}`}
                                />
                                {question.choices.length > 2 && (
                                  <button
                                    onClick={() => removeChoice(questionIndex, choiceIndex)}
                                    disabled={isSaving}
                                    className="text-red-500 hover:text-red-700 transition-colors duration-200 disabled:opacity-50"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                              <div className="ml-7">
                                <input
                                  type="text"
                                  value={question.choiceExplanations?.[choiceIndex] || ''}
                                  onChange={(e) => updateChoiceExplanation(questionIndex, choiceIndex, e.target.value)}
                                  disabled={isSaving}
                                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                                  placeholder="Explanation (optional, shown after submission)"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
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
            {isSaving ? 'Saving...' : (step ? 'Update Quiz' : 'Add Quiz')}
          </button>
        </div>
      </div>
    </div>
  );
}

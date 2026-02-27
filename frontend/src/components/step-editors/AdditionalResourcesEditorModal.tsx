'use client';

import { useState } from 'react';
import { AdditionalResourcesStep } from '@/lib/firebase/types';
import { useModuleStore } from '@/store/moduleStore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '@/lib/firebase/firebaseConfig';
import PdfSearchModal from './PdfSearchModal';

interface AddResourcesModalProps {
  moduleId: string;
  onClose: () => void;
  onBack: () => void;
  onSave: (step: any) => void;
  step?: AdditionalResourcesStep;
}

interface Resource {
  id: string;
  name: string;
  url: string;
  type: 'link' | 'pdf';
}

export default function AdditionalResourcesEditorModal({
  moduleId,
  onClose,
  onBack,
  onSave,
  step
}: AddResourcesModalProps) {
  const { modules, createNewStep, updateStepData, userId } = useModuleStore();
  const module = modules.find(m => m.id === moduleId);

  const [formData, setFormData] = useState({
    title: step?.title || '',
    isOptional: step?.isOptional || false,
  });

  // Convert existing step resources to array format
  const initialResources: Resource[] = [];
  if (step?.resources) {
    // Check if 'all' array exists (new format)
    if (step.resources.all && Array.isArray(step.resources.all)) {
      initialResources.push(...step.resources.all);
    } 
    // Fallback to old format if 'all' doesn't exist
    else {
      if (step.resources.link) {
        initialResources.push({
          id: 'link-1',
          name: 'External Link',
          url: step.resources.link,
          type: 'link',
        });
      }
      if (step.resources.pdf) {
        initialResources.push({
          id: 'pdf-1',
          name: 'PDF Document',
          url: step.resources.pdf,
          type: 'pdf',
        });
      }
    }
  }

  const [resources, setResources] = useState<Resource[]>(initialResources);
  const [isSaving, setIsSaving] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // New resource form
  const [newResource, setNewResource] = useState({
    name: '',
    url: '',
    type: 'link' as 'link' | 'pdf',
  });
  const [uploadingFile, setUploadingFile] = useState(false);

  const getStorageRefFromUrl = (url: string) => {
    if (!storage) return null;
    try {
      const urlObj = new URL(url);
      const pathMatch = urlObj.pathname.match(/\/o\/(.+)/);
      if (pathMatch && pathMatch[1]) {
        const encodedPath = pathMatch[1].split('?')[0];
        const path = decodeURIComponent(encodedPath);
        return ref(storage, path);
      }
    } catch (error) {
      console.error('Error parsing storage URL:', error);
    }
    return null;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('PDF file size must be less than 10MB');
      return;
    }

    setUploadingFile(true);
    try {
      if (!storage) {
        throw new Error('Firebase Storage is not initialized');
      }

      const timestamp = Date.now();
      const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${timestamp}_${sanitizedFilename}`;
      
      const storageRef = ref(storage, `modules/${moduleId}/resources/${filename}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      // Save metadata
      try {
        if (db && userId) {
          await addDoc(collection(db, 'uploadedFiles'), {
            filename: file.name,
            originalName: file.name,
            sanitizedName: sanitizedFilename,
            storagePath: `modules/${moduleId}/resources/${filename}`,
            downloadURL,
            moduleId,
            userId,
            size: file.size,
            type: file.type,
            uploadedAt: serverTimestamp(),
          });
        }
      } catch (metadataError) {
        console.error('Could not save metadata:', metadataError);
      }
      
      setNewResource({
        ...newResource,
        url: downloadURL,
        name: newResource.name || file.name,
      });
      
    } catch (error: any) {
      console.error('Error uploading PDF:', error);
      alert('Failed to upload PDF');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleAddResource = () => {
    if (!newResource.name.trim()) {
      alert('Please enter a resource name');
      return;
    }

    if (!newResource.url.trim()) {
      alert('Please provide a URL');
      return;
    }

    // Validate URL
    try {
      new URL(newResource.url);
    } catch {
      alert('Please enter a valid URL');
      return;
    }

    const resource: Resource = {
      id: `${newResource.type}-${Date.now()}`,
      name: newResource.name,
      url: newResource.url,
      type: newResource.type,
    };

    setResources([...resources, resource]);
    setNewResource({ name: '', url: '', type: 'link' });
  };

  // UPDATED: Just remove from list, delete happens on save
  const handleRemoveResource = (id: string) => {
    setResources(resources.filter(r => r.id !== id));
  };

  // UPDATED: Delete removed PDFs when saving
const handleSave = async () => {
  if (!formData.title.trim()) {
    alert('Please enter a resource title');
    return;
  }

  if (resources.length === 0) {
    alert('Please add at least one resource');
    return;
  }

  if (!userId) {
    alert('User not authenticated');
    return;
  }

  setIsSaving(true);
  try {
    
    // Convert resources array to the format expected by backend
    const resourcesData = {
      link: resources.find(r => r.type === 'link')?.url || '',
      pdf: resources.find(r => r.type === 'pdf')?.url || '',
      all: resources,
    };

    if (step) {
      // Update existing step
      const updates: Partial<AdditionalResourcesStep> = {
        title: formData.title.trim(),
        resources: resourcesData as any,
        isOptional: formData.isOptional,
      };
      await updateStepData(moduleId, step.id, updates);
    } else {
      // Create new step
      const order = module?.steps?.length || 0;
      const stepData = {
        moduleId,
        type: 'additionalResources' as const,
        title: formData.title.trim(),
        resources: resourcesData as any,
        isOptional: formData.isOptional,
        order,
        createdBy: userId,
      };
      await createNewStep(moduleId, stepData);
    }
    onClose();
  } catch (error: any) {
    console.error('Error saving additional resources step:', error);
    alert(`Failed to save resource: ${error.message}`);
  } finally {
    setIsSaving(false);
  }
};

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
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
                {step ? 'Edit Resources' : 'Add Additional Resources'}
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
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              {/* Step Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Step Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  disabled={isSaving}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  placeholder="e.g., Week 1 Readings"
                />
              </div>

              {/* Existing Resources List */}
              {resources.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Resources ({resources.length})
                  </label>
                  <div className="space-y-2">
                    {resources.map((resource) => (
                      <div
                        key={resource.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg"
                      >
                        <div className="flex-shrink-0">
                          {resource.type === 'pdf' ? (
                            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{resource.name}</p>
                          <p className="text-xs text-gray-500 truncate">{resource.url}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveResource(resource.id)}
                          disabled={isSaving}
                          className="text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Resource */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Add New Resource</h3>
                
                <div className="space-y-4">
                  {/* Resource Type */}
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="link"
                        checked={newResource.type === 'link'}
                        onChange={(e) => setNewResource({ ...newResource, type: 'link', url: '' })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm font-medium text-gray-700">External Link</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="pdf"
                        checked={newResource.type === 'pdf'}
                        onChange={(e) => setNewResource({ ...newResource, type: 'pdf', url: '' })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm font-medium text-gray-700">PDF Document</span>
                    </label>
                  </div>

                  {/* Resource Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Resource Name *
                    </label>
                    <input
                      type="text"
                      value={newResource.name}
                      onChange={(e) => setNewResource({ ...newResource, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Chapter 3 Reading"
                    />
                  </div>

                  {/* URL or Upload */}
                  {newResource.type === 'link' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        URL *
                      </label>
                      <input
                        type="url"
                        value={newResource.url}
                        onChange={(e) => setNewResource({ ...newResource, url: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="https://example.com"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        PDF File *
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={handleFileUpload}
                          disabled={uploadingFile}
                          className="hidden"
                          id="new-pdf-upload"
                        />
                        <label
                          htmlFor="new-pdf-upload"
                          className={`px-4 py-2 border border-gray-300 rounded-lg font-medium cursor-pointer transition-colors ${
                            uploadingFile ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {uploadingFile ? 'Uploading...' : 'Choose PDF'}
                        </label>
                        
                        <button
                          type="button"
                          onClick={() => setShowSearchModal(true)}
                          disabled={uploadingFile}
                          className="px-4 py-2 border border-blue-300 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                          🔍 Search
                        </button>
                        
                        {newResource.url && (
                          <span className="text-sm text-green-600 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Selected
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Add Button */}
                  <button
                    onClick={handleAddResource}
                    disabled={uploadingFile || !newResource.name.trim() || !newResource.url.trim()}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
                  >
                    + Add Resource
                  </button>
                </div>
              </div>

              {/* Optional Step */}
              <div className="border-t border-gray-200 pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isOptional}
                    onChange={(e) => setFormData({ ...formData, isOptional: e.target.checked })}
                    disabled={isSaving}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Optional step</span>
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
              disabled={isSaving || uploadingFile || resources.length === 0}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
            >
              {isSaving && (
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              {isSaving ? 'Saving...' : (step ? 'Update Step' : 'Add Step')}
            </button>
          </div>
        </div>
      </div>

      {/* Search Modal */}
      {showSearchModal && (
        <PdfSearchModal
          onSelect={(url, filename) => {
            setNewResource({
              ...newResource,
              url,
              name: newResource.name || filename,
            });
            setShowSearchModal(false);
          }}
          onClose={() => setShowSearchModal(false)}
        />
      )}
    </>
  );
}

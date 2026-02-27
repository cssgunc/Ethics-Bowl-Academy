'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebaseConfig';

interface UploadedFile {
  id: string;
  filename: string;
  downloadURL: string;
  moduleId: string;
  size: number;
  uploadedAt: any;
}

export default function PdfSearchModal({ onSelect, onClose }: { 
  onSelect: (url: string, filename: string) => void;
  onClose: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<UploadedFile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Load all files when modal opens
  useEffect(() => {
    loadAllFiles();
  }, []);

  const loadAllFiles = async () => {
    setIsSearching(true);
    try {
      console.log('Loading all files...'); // Debug
      
      const filesRef = collection(db!, 'uploadedFiles');
      const q = query(filesRef, orderBy('uploadedAt', 'desc'));
      const snapshot = await getDocs(q);
      
      console.log('Found documents:', snapshot.docs.length); // Debug
      
      const allFiles = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Document data:', data); // Debug
        return {
          id: doc.id,
          ...data
        };
      }) as UploadedFile[];
      
      console.log('Loaded files:', allFiles); // Debug
      
      setResults(allFiles);
    } catch (error) {
      console.error('Error loading files:', error);
      console.error('Error code:', (error as any).code);
      console.error('Error message:', (error as any).message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      // If search is empty, show all files
      loadAllFiles();
      return;
    }
    
    setIsSearching(true);
    try {
      const filesRef = collection(db!, 'uploadedFiles');
      const q = query(filesRef, orderBy('uploadedAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const allFiles = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UploadedFile[];
      
      // Client-side filter
      const filtered = allFiles.filter(file => 
        file.filename.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      setResults(filtered);
    } catch (error) {
      console.error('Error searching files:', error);
      alert('Failed to search files');
    } finally {
      setIsSearching(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Search Uploaded PDFs</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex gap-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by filename..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {results.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p>No files found. Try a different search term.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((file) => (
                <button
                  key={file.id}
                  onClick={() => onSelect(file.downloadURL, file.filename)}
                  className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <svg className="w-10 h-10 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate group-hover:text-blue-700">
                        {file.filename}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(file.size)} • {file.uploadedAt?.toDate?.()?.toLocaleDateString() || 'Recently uploaded'}
                      </p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

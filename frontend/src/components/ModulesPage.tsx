/**
 * MODULES PAGE COMPONENT WITH FIREBASE INTEGRATION
 *
 * This is the main admin interface for managing learning modules.
 * It fetches modules from Firestore and provides CRUD operations.
 */

'use client';

import { useEffect, useState } from 'react';
import { useModuleStore, ModuleWithSteps } from '@/store/moduleStore';
import { useAuth } from '@/hooks/useAuth';
import { useAlert } from '@/context/AlertContext';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import ModuleEditor from './ModuleEditor';

// Sortable Module Card Component
function SortableModuleCard({ module, userId, onEdit, onDelete }: {
  module: ModuleWithSteps;
  userId: string | undefined;
  onEdit: (m: ModuleWithSteps) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200 relative ${isDragging ? 'shadow-lg ring-2 ring-blue-500' : ''}`}
    >
      {/* Drag Handle & Order Badge */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <span className="bg-gray-100 text-gray-600 text-xs font-mono px-2 py-1 rounded">
          #{typeof module.order === 'number' ? module.order : '?'}
        </span>
        <div
          {...attributes}
          {...listeners}
          className="cursor-move p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
        >
          <GripVertical size={20} />
        </div>
      </div>

      <div className="mb-4 pr-16">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{module.title}</h3>
        <p className="text-gray-600 text-sm line-clamp-2">{module.description}</p>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span>{module.stepCount} steps</span>
        </div>
        <div className="text-xs text-gray-400 mb-1">
          {module.isPublic ? 'Public' : 'Private'}
        </div>
        <div className="text-xs text-gray-400">
          Owner: {module.createdBy === userId ? 'You' : module.createdBy.slice(0, 8) + '...'}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onEdit(module)}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(module.id)}
          className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function ModulesPage() {
  // ===== FIREBASE AUTH =====
  const [user, authLoading] = useAuth();

  // ===== ZUSTAND STORE =====
  const {
    modules,
    isLoading,
    error,
    fetchModules,
    deleteModuleData,
    setSelectedModule,
    setIsEditing,
    setUserId,
    reorderModules,
  } = useModuleStore();
  const { showConfirm } = useAlert();

  // ===== LOCAL STATE =====
  const [showModuleEditor, setShowModuleEditor] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);

  // ===== DND SENSORS =====
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = modules.findIndex((m) => m.id === active.id);
      const newIndex = modules.findIndex((m) => m.id === over?.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Optimistic UI update can be done here if needed, 
        // but reorderModules updates the store which triggers re-render
        // Calculate new order logic is inside reorderModules action if we passed indices,
        // but reorderModules takes an array of IDs.
        // So we need to construct the new array of IDs.

        const newModules = arrayMove(modules, oldIndex, newIndex);
        const newOrderIds = newModules.map(m => m.id);

        reorderModules(newOrderIds);
      }
    }
  };

  // ===== EFFECTS =====

  /**
   * Set authenticated user ID and fetch modules when user is available
   */
  useEffect(() => {
    if (user) {
      console.log('Setting user ID:', user.uid);
      setUserId(user.uid);
      fetchModules();
    }
  }, [user, fetchModules, setUserId]);

  // ===== EVENT HANDLERS =====

  const handleCreateModule = () => {
    setEditingModuleId(null);
    setShowModuleEditor(true);
  };

  const handleEditModule = (module: ModuleWithSteps) => {
    setEditingModuleId(module.id);
    setSelectedModule(module);
    setIsEditing(true);
    setShowModuleEditor(true);
  };

  const handleDeleteModule = async (moduleId: string) => {
    const confirmed = await showConfirm('Delete Module', 'Are you sure you want to delete this module? This will also delete all its steps.');
    if (confirmed) {
      await deleteModuleData(moduleId);
    }
  };

  const handleCloseEditor = () => {
    setShowModuleEditor(false);
    setEditingModuleId(null);
    setSelectedModule(null);
    setIsEditing(false);
  };

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show message if not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Not Authenticated</h2>
          <p className="text-gray-600 mb-4">Please log in to access the admin dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 rounded-b-xl p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Module Management</h1>
          <p className="text-gray-600">Manage and organize learning modules</p>
          <p className="text-xs text-gray-400 mt-1">Logged in as: {user.email || user.uid}</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            Error: {error}
          </div>
        )}

        {/* Create Module Button */}
        <div className="mb-6">
          <button
            onClick={handleCreateModule}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New Module
          </button>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading modules...</p>
          </div>
        ) : modules.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No modules yet</h3>
            <p className="text-gray-500 mb-4">Get started by creating your first module</p>
            <button
              onClick={handleCreateModule}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
            >
              Create Module
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}

          >
            <SortableContext
              items={modules.map(m => m.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {modules.map((module) => (
                  <SortableModuleCard
                    key={module.id}
                    module={module}
                    userId={user?.uid}
                    onEdit={handleEditModule}
                    onDelete={handleDeleteModule}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Module Editor Modal */}
        {showModuleEditor && (
          <ModuleEditor
            moduleId={editingModuleId}
            onClose={handleCloseEditor}
          />
        )}
      </div>
    </div>
  );
}

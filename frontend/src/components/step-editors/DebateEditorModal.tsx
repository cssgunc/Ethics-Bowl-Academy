'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DebateStep } from '@/lib/firebase/types';
import { useModuleStore } from '@/store/moduleStore';

interface Props {
  moduleId: string;
  step?: DebateStep;
  onClose: () => void;
  onBack: () => void;
  onSave: (step: DebateStep) => void;
}

export default function DebateEditorModal({ moduleId, step, onClose, onBack, onSave }: Props) {
  const { userId } = useModuleStore();
  const [title, setTitle] = useState(step?.title ?? '');
  const [modulePrompt, setModulePrompt] = useState(step?.modulePrompt ?? '');
  const [startQuestion, setStartQuestion] = useState(step?.startQuestion ?? '');
  const [turns, setTurns] = useState(String(step?.maxStudentTurns ?? 8));
  const [error, setError] = useState('');
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <form aria-label="Debate editor" className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onSubmit={(event) => {
        event.preventDefault();
        if (!userId) { setError('Please sign in to save this step.'); return; }
        if (!title.trim() || !modulePrompt.trim() || !startQuestion.trim() || !Number.isInteger(Number(turns)) || Number(turns) < 3 || Number(turns) > 10) {
          setError('Complete all fields and choose a whole number of turns from 3 to 10.'); return;
        }
        onSave({ ...step, id: step?.id ?? uuidv4(), moduleId, type: 'debate', title: title.trim(), modulePrompt: modulePrompt.trim(), startQuestion: startQuestion.trim(), maxStudentTurns: Number(turns), order: step?.order ?? 0, isOptional: step?.isOptional ?? false, createdBy: step?.createdBy ?? userId, createdAt: step?.createdAt ?? new Date(), updatedAt: new Date() });
        onClose();
      }}>
        <h2 className="text-xl font-bold">{step ? 'Edit Debate' : 'Add Debate'}</h2>
        <label className="block">Step title<input required className="block w-full border rounded p-2" value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label className="block">Module-specific prompt/context<textarea required aria-describedby="debate-context-help" rows={5} className="block w-full border rounded p-2" value={modulePrompt} onChange={e => setModulePrompt(e.target.value)} /></label>
        <p id="debate-context-help" className="text-sm text-gray-600">Describe the ethical dilemma, relevant facts, and any arguments or concepts the AI should address. Do not include private student information.</p>
        <label className="block">Starting question<textarea required rows={3} className="block w-full border rounded p-2" value={startQuestion} onChange={e => setStartQuestion(e.target.value)} /></label>
        <label className="block">Maximum student turns<input required type="number" min={3} max={10} step={1} className="block w-full border rounded p-2" value={turns} onChange={e => setTurns(e.target.value)} /></label>
        {error && <p role="alert">{error}</p>}
        <div className="flex justify-end gap-4"><button type="button" onClick={onBack}>Back</button><button type="button" onClick={onClose}>Cancel</button><button className="bg-blue-600 text-white rounded px-4 py-2" type="submit">{step ? 'Done' : 'Add Debate'}</button></div>
      </form>
    </div>
  );
}

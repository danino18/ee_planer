import { useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePlanStore } from '../store/planStore';

const MAX_VERSIONS = 4;

export function VersionTabs({ onCompare }: { onCompare: () => void }) {
  const { versions, activeVersionId, createVersion, switchVersion, renameVersion, deleteVersion } =
    usePlanStore(
      useShallow((s) => ({
        versions: s.versions,
        activeVersionId: s.activeVersionId,
        createVersion: s.createVersion,
        switchVersion: s.switchVersion,
        renameVersion: s.renameVersion,
        deleteVersion: s.deleteVersion,
      })),
    );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  if (!versions || versions.length === 0) return null;

  function startEdit(id: string, currentName: string) {
    setEditingId(id);
    setEditValue(currentName);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commitEdit() {
    if (editingId && editValue.trim()) {
      renameVersion(editingId, editValue.trim());
    }
    setEditingId(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditingId(null);
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (versions.length <= 1) return;
    deleteVersion(id);
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {versions.map((v) => {
        const isActive = v.id === activeVersionId;
        const isEditing = editingId === v.id;
        return (
          <div
            key={v.id}
            onClick={() => !isActive && switchVersion(v.id)}
            onDoubleClick={() => startEdit(v.id, v.name)}
            className={[
              'flex items-center gap-1 px-2 py-1 rounded-lg text-sm cursor-pointer select-none transition-colors border',
              isActive
                ? 'bg-blue-600 text-white border-blue-600 font-medium'
                : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:text-blue-600',
            ].join(' ')}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="w-24 text-sm bg-transparent outline-none text-gray-900"
                maxLength={32}
                autoFocus
              />
            ) : (
              <span className="max-w-32 truncate">{v.name}</span>
            )}

            {!isEditing && (
              <button
                onClick={(e) => { e.stopPropagation(); startEdit(v.id, v.name); }}
                className={[
                  'opacity-60 hover:opacity-100 text-xs leading-none px-0.5 rounded transition-opacity',
                  isActive ? 'text-blue-100 hover:text-white' : 'text-gray-400 hover:text-gray-600',
                ].join(' ')}
                title="שנה שם"
              >
                ✎
              </button>
            )}

            {versions.length > 1 && !isEditing && (
              <button
                onClick={(e) => handleDelete(v.id, e)}
                className={[
                  'opacity-60 hover:opacity-100 text-xs leading-none px-0.5 rounded transition-opacity',
                  isActive ? 'text-blue-100 hover:text-white' : 'text-gray-400 hover:text-red-500',
                ].join(' ')}
                title="מחק גרסה"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}

      {versions.length < MAX_VERSIONS && (
        <button
          onClick={createVersion}
          className="px-2 py-1 rounded-lg text-sm border border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-colors"
          title="שכפל גרסה נוכחית כגרסה חדשה"
        >
          + גרסה
        </button>
      )}

      {versions.length > 1 && (
        <button
          onClick={onCompare}
          className="px-2 py-1 rounded-lg text-sm border border-gray-200 text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors"
          title="השווה גרסאות"
        >
          ⇄ השווה
        </button>
      )}
    </div>
  );
}

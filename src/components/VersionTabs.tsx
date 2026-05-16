import { useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { NORMAL_VERSION_LIMIT, usePlanStore } from '../store/planStore';
import { useShareMode } from '../context/ShareModeContext';

export function VersionTabs({ onCompare }: { onCompare: () => void }) {
  const shareMode = useShareMode();
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

  if (shareMode?.isShareReview) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm select-none border font-semibold" style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}>
          <span className="max-w-40 truncate">גרסת שיתוף לבדיקה</span>
        </div>
      </div>
    );
  }

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
                ? 'font-semibold text-white'
                : 'text-white/60 hover:text-white/90',
            ].join(' ')}
            style={isActive
              ? { background: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.4)' }
              : { background: 'transparent', borderColor: 'rgba(255,255,255,0.15)' }}
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

      {versions.length < NORMAL_VERSION_LIMIT && (
        <button
          onClick={createVersion}
          className="px-2 py-1 rounded-lg text-sm border border-dashed transition-colors text-white/50 hover:text-white/80"
          style={{ borderColor: 'rgba(255,255,255,0.25)' }}
          title="שכפל גרסה נוכחית כגרסה חדשה"
        >
          + גרסה
        </button>
      )}

      {versions.length > 1 && (
        <button
          onClick={onCompare}
          className="px-2 py-1 rounded-lg text-sm border transition-colors text-white/50 hover:text-purple-300"
          style={{ borderColor: 'rgba(255,255,255,0.15)' }}
          title="השווה גרסאות"
        >
          ⇄ השווה
        </button>
      )}
    </div>
  );
}

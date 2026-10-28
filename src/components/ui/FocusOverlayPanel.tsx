import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Plus,
  Sparkles,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { FocusPreferences, TaskItem, TimerPhase } from '../../types';

interface FocusOverlayPanelProps {
  prefs: FocusPreferences;
  isOpen: boolean;
  activePhase: TimerPhase;
  onClose: () => void;
  onChangePrefs: (next: FocusPreferences) => void;
  onSelectPhaseDuration: (phase: TimerPhase, minutes: number) => void;
}

export const FocusOverlayPanel: React.FC<FocusOverlayPanelProps> = ({
  prefs,
  isOpen,
  activePhase,
  onClose,
  onChangePrefs,
  onSelectPhaseDuration,
}) => {
  const [newTaskText, setNewTaskText] = useState('');

  if (!isOpen) return null;

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTaskText.trim();
    if (!trimmed) return;
    const item: TaskItem = {
      id: `task-${Date.now()}`,
      text: trimmed,
      completed: false,
      createdAt: Date.now(),
    };
    const nextGoal = prefs.currentGoal || trimmed;
    onChangePrefs({
      ...prefs,
      currentGoal: nextGoal,
      tasks: [...prefs.tasks, item],
    });
    setNewTaskText('');
  };

  const toggleTask = (id: string) => {
    onChangePrefs({
      ...prefs,
      tasks: prefs.tasks.map((t) =>
        t.id === id ? { ...t, completed: !t.completed } : t
      ),
    });
  };

  const deleteTask = (id: string) => {
    onChangePrefs({
      ...prefs,
      tasks: prefs.tasks.filter((t) => t.id !== id),
    });
  };

  const clearCompleted = () => {
    onChangePrefs({
      ...prefs,
      tasks: prefs.tasks.filter((t) => !t.completed),
    });
  };

  return (
    <div
      className="fixed bottom-20 right-4 sm:right-6 z-40 w-[340px] sm:w-[390px] rounded-2xl bg-[#1A130F]/95 backdrop-blur-xl border border-[#D48C46]/30 shadow-2xl p-4 text-[#F4ECE1] animate-fade-in"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#D48C46]/20">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#D48C46]/20 border border-[#D48C46]/40 flex items-center justify-center">
            <Target className="w-3.5 h-3.5 text-[#F3B664]" />
          </div>
          <div>
            <h3 className="font-serif text-sm font-semibold tracking-wide text-[#F9EFE3]">
              Study Notebook &amp; Focus Timer
            </h3>
            <p className="text-[11px] text-[#C8B6A6]">
              {prefs.completedSessions} sessions completed ({prefs.totalFocusMinutes}m total)
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#C8B6A6] hover:text-[#F4ECE1] hover:bg-white/5 transition-colors"
          aria-label="Close notebook"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Current Focus Goal Input */}
      <div className="mb-4">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#C8B6A6] mb-1.5">
          Current Focus Intention
        </label>
        <input
          type="text"
          value={prefs.currentGoal}
          onChange={(e) =>
            onChangePrefs({ ...prefs, currentGoal: e.target.value })
          }
          placeholder="e.g., Read Chapter 4 or ship API module..."
          className="w-full px-3 py-2 rounded-xl bg-[#241A15] border border-[#D48C46]/30 text-xs text-[#F4ECE1] placeholder-[#8C7A6B] focus:outline-none focus:border-[#F3B664]"
        />
      </div>

      {/* Customizable Focus Duration Presets */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#C8B6A6] flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#F3B664]" /> Focus Duration (Minutes)
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[15, 25, 45, 60].map((mins) => {
            const isSelected = prefs.focusMinutes === mins && activePhase === 'focus';
            return (
              <button
                key={mins}
                onClick={() => {
                  onChangePrefs({ ...prefs, focusMinutes: mins });
                  onSelectPhaseDuration('focus', mins);
                }}
                className={`py-1.5 rounded-lg font-mono text-xs font-semibold border transition-all ${
                  isSelected
                    ? 'bg-[#D48C46]/25 border-[#F3B664] text-[#FFE4B5]'
                    : 'bg-[#241A15] border-white/10 text-[#C8B6A6] hover:text-[#F4ECE1] hover:border-[#D48C46]/40'
                }`}
              >
                {mins}m
              </button>
            );
          })}
        </div>
        {/* Break Mode Quick Switchers */}
        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
          <button
            onClick={() => onSelectPhaseDuration('shortBreak', prefs.shortBreakMinutes)}
            className={`py-1 px-2.5 rounded-lg text-[11px] font-medium border transition-all ${
              activePhase === 'shortBreak'
                ? 'bg-[#68D391]/20 border-[#68D391] text-[#A3E8BE]'
                : 'bg-[#241A15] border-white/5 text-[#C8B6A6] hover:text-[#F4ECE1]'
            }`}
          >
            Short Break ({prefs.shortBreakMinutes}m)
          </button>
          <button
            onClick={() => onSelectPhaseDuration('longBreak', prefs.longBreakMinutes)}
            className={`py-1 px-2.5 rounded-lg text-[11px] font-medium border transition-all ${
              activePhase === 'longBreak'
                ? 'bg-[#68D391]/20 border-[#68D391] text-[#A3E8BE]'
                : 'bg-[#241A15] border-white/5 text-[#C8B6A6] hover:text-[#F4ECE1]'
            }`}
          >
            Long Coffee Break ({prefs.longBreakMinutes}m)
          </button>
        </div>
      </div>

      {/* Task List ("Café Coaster Notes") */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#C8B6A6]">
            Session Tasks ({prefs.tasks.filter((t) => t.completed).length}/{prefs.tasks.length})
          </span>
          {prefs.tasks.some((t) => t.completed) && (
            <button
              onClick={clearCompleted}
              className="text-[10px] text-[#D48C46] hover:underline"
            >
              Clear completed
            </button>
          )}
        </div>

        <form onSubmit={handleAddTask} className="flex gap-1.5 mb-2.5">
          <input
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            placeholder="Jot down a task on your coaster..."
            className="flex-1 px-3 py-1.5 rounded-xl bg-[#241A15] border border-white/10 text-xs text-[#F4ECE1] placeholder-[#8C7A6B] focus:outline-none focus:border-[#F3B664]"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-xl bg-[#D48C46] text-[#1A120E] font-semibold text-xs hover:bg-[#E39B54] transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </form>

        <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
          {prefs.tasks.length === 0 ? (
            <div className="text-center py-4 text-xs text-[#8C7A6B] italic">
              No tasks yet — add a study goal above.
            </div>
          ) : (
            prefs.tasks.map((task) => {
              const isCurrentGoal = prefs.currentGoal === task.text;
              return (
                <div
                  key={task.id}
                  className={`group flex items-center justify-between gap-2 p-2 rounded-xl border transition-all ${
                    task.completed
                      ? 'bg-[#1D1511]/60 border-white/5 opacity-60'
                      : isCurrentGoal
                      ? 'bg-[#2C2019] border-[#D48C46]/50'
                      : 'bg-[#241A15] border-white/5 hover:border-[#D48C46]/30'
                  }`}
                >
                  <button
                    onClick={() => toggleTask(task.id)}
                    className="flex items-center gap-2.5 text-left flex-1 min-w-0"
                  >
                    <span
                      className={`w-4 h-4 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                        task.completed
                          ? 'bg-[#68D391] border-[#68D391] text-[#162019]'
                          : 'border-[#C8B6A6]/50 group-hover:border-[#F3B664]'
                      }`}
                    >
                      {task.completed && <Check className="w-3 h-3 stroke-[3]" />}
                    </span>
                    <span
                      className={`text-xs truncate ${
                        task.completed ? 'line-through text-[#8C7A6B]' : 'text-[#F4ECE1]'
                      }`}
                    >
                      {task.text}
                    </span>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    {!task.completed && (
                      <button
                        onClick={() =>
                          onChangePrefs({ ...prefs, currentGoal: task.text })
                        }
                        title="Set as current focus intention"
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                          isCurrentGoal
                            ? 'bg-[#D48C46]/30 text-[#FFE0B5]'
                            : 'opacity-0 group-hover:opacity-100 bg-white/5 text-[#C8B6A6] hover:text-[#F4ECE1]'
                        }`}
                      >
                        {isCurrentGoal ? (
                          <span className="flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> Active
                          </span>
                        ) : (
                          'Focus'
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#8C7A6B] hover:text-[#E06D53] transition-opacity"
                      aria-label="Delete task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  Check,
  Clock,
  Eye,
  EyeOff,
  History,
  ListTodo,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  FocusPreferences,
  SeatConfig,
  SharedTimerState,
  TaskItem,
  TimerPhase,
} from '../../types';

interface FocusOverlayPanelProps {
  prefs: FocusPreferences;
  isOpen: boolean;
  activePhase: TimerPhase;
  activeSeat: SeatConfig | null;
  sharedTimer: SharedTimerState | null;
  selfUserId: string;
  onClose: () => void;
  onChangePrefs: (next: FocusPreferences) => void;
  onSelectPhaseDuration: (phase: TimerPhase, minutes: number) => void;
  onStartSharedTimer: () => void;
  onJoinSharedTimer: () => void;
  onStopSharedTimer: () => void;
}

export const FocusOverlayPanel: React.FC<FocusOverlayPanelProps> = ({
  prefs,
  isOpen,
  activePhase,
  activeSeat,
  sharedTimer,
  selfUserId,
  onClose,
  onChangePrefs,
  onSelectPhaseDuration,
  onStartSharedTimer,
  onJoinSharedTimer,
  onStopSharedTimer,
}) => {
  const [newTaskText, setNewTaskText] = useState('');
  const [tab, setTab] = useState<'tasks' | 'history'>('tasks');

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

  const isInSharedTimer = Boolean(
    sharedTimer && sharedTimer.participants.includes(selfUserId)
  );

  return (
    <div
      className="fixed bottom-20 right-4 sm:right-6 z-40 w-[350px] sm:w-[405px] max-h-[80vh] overflow-y-auto no-scrollbar rounded-2xl bg-[#1A130F]/95 backdrop-blur-xl border border-[#D48C46]/30 shadow-2xl p-4 text-[#F4ECE1] animate-fade-in"
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

      {/* Current Focus Goal Input + Privacy Share Toggle */}
      <div className="mb-3.5">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[#C8B6A6]">
            Current Focus Intention
          </label>
          <button
            onClick={() =>
              onChangePrefs({
                ...prefs,
                shareFocusGoal: !prefs.shareFocusGoal,
              })
            }
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors ${
              prefs.shareFocusGoal
                ? 'bg-[#68D391]/15 border-[#68D391]/40 text-[#9AE6B4]'
                : 'bg-white/5 border-white/10 text-[#A89686]'
            }`}
            title="Choose whether other visitors can see your focus goal"
          >
            {prefs.shareFocusGoal ? (
              <>
                <Eye className="w-3 h-3" /> Shared with Table
              </>
            ) : (
              <>
                <EyeOff className="w-3 h-3" /> Private Goal
              </>
            )}
          </button>
        </div>
        <input
          type="text"
          value={prefs.currentGoal}
          onChange={(e) =>
            onChangePrefs({ ...prefs, currentGoal: e.target.value })
          }
          placeholder="e.g., Read Chapter 4 or ship Rust module..."
          className="w-full px-3 py-2 rounded-xl bg-[#241A15] border border-[#D48C46]/30 text-xs text-[#F4ECE1] placeholder-[#8C7A6B] focus:outline-none focus:border-[#F3B664]"
        />
      </div>

      {/* Synchronized Table Pomodoro Session Card (when seated) */}
      {activeSeat && (
        <div className="mb-3.5 p-2.5 rounded-xl bg-[#241A15] border border-[#D48C46]/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-[#FFE0B5] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#F3B664]" />
              Shared Table Session ({activeSeat.name})
            </span>
            {sharedTimer?.isRunning && (
              <span className="px-2 py-0.5 rounded-full bg-[#68D391]/20 text-[#9AE6B4] text-[10px] font-semibold">
                {sharedTimer.participants.length} focusing together
              </span>
            )}
          </div>
          {sharedTimer?.isRunning ? (
            <div className="space-y-2">
              <p className="text-[11px] text-[#C8B6A6] truncate">
                Table Goal: <strong className="text-[#F4ECE1]">{sharedTimer.sharedGoal}</strong>
              </p>
              <div className="flex gap-1.5">
                {!isInSharedTimer ? (
                  <button
                    onClick={onJoinSharedTimer}
                    className="flex-1 py-1.5 rounded-lg bg-[#68D391] text-[#142018] text-xs font-semibold hover:bg-[#7CE0A3] transition-colors"
                  >
                    Join Shared Countdown
                  </button>
                ) : (
                  <span className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#68D391]/15 border border-[#68D391]/30 text-[#9AE6B4] text-[11px] font-medium text-center">
                    Synchronized with table timer
                  </span>
                )}
                <button
                  onClick={onStopSharedTimer}
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-[#C8B6A6]"
                >
                  End
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="text-[11px] text-[#A89686]">
                Sync your Pomodoro timer with everyone at this table
              </span>
              <button
                onClick={onStartSharedTimer}
                className="px-3 py-1.5 rounded-lg bg-[#D48C46]/25 hover:bg-[#D48C46]/40 border border-[#F3B664]/50 text-[#FFE0B5] text-[11px] font-semibold shrink-0 transition-colors"
              >
                Start Table Timer
              </button>
            </div>
          )}
        </div>
      )}

      {/* Customizable Focus Duration Presets */}
      <div className="mb-3.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#C8B6A6] flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#F3B664]" /> Focus &amp; Break Durations
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

      {/* Tabs: Tasks vs Session History */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
        <div className="flex gap-1.5">
          <button
            onClick={() => setTab('tasks')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
              tab === 'tasks'
                ? 'bg-[#D48C46]/25 text-[#FFE0B5]'
                : 'text-[#A89686] hover:text-[#F4ECE1]'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" />
            Tasks ({prefs.tasks.filter((t) => !t.completed).length})
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
              tab === 'history'
                ? 'bg-[#D48C46]/25 text-[#FFE0B5]'
                : 'text-[#A89686] hover:text-[#F4ECE1]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            History ({(prefs.history || []).length})
          </button>
        </div>

        {tab === 'tasks' && prefs.tasks.some((t) => t.completed) && (
          <button
            onClick={clearCompleted}
            className="text-[10px] text-[#D48C46] hover:underline"
          >
            Clear completed
          </button>
        )}
      </div>

      {tab === 'tasks' ? (
        <div>
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

          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
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
      ) : (
        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
          {!prefs.history || prefs.history.length === 0 ? (
            <div className="text-center py-6 text-xs text-[#8C7A6B] italic">
              Complete a focus session to record it in your café logbook.
            </div>
          ) : (
            prefs.history.map((entry) => (
              <div
                key={entry.id}
                className="p-2.5 rounded-xl bg-[#241A15] border border-white/5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#F4ECE1] truncate">
                    {entry.goal || 'Focus Session'}
                  </div>
                  <div className="text-[10px] text-[#A89686]">
                    {entry.seatName} • {new Date(entry.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#68D391]/15 text-[#9AE6B4] font-mono text-[10px] font-semibold shrink-0">
                  +{entry.durationMinutes}m
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

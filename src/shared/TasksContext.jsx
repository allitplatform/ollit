// ============================================
// 올잇 Task Context - 두 앱(해피콜/기사)이 같은 task state 공유
// 위치: src/shared/TasksContext.jsx
// ============================================
// 사용법:
//   1. App.jsx에서 <TasksProvider>로 전체 감싸기
//   2. 컴포넌트에서 const { tasks, updateTask } = useTasks();
// ============================================

import { createContext, useContext, useState, useCallback } from "react";
import { INITIAL_TASKS, updateTaskInList } from "./tasks.js";

const TasksContext = createContext(null);

export function TasksProvider({ children }) {
  // V14 Phase 4-F-2-2 — 운영 모드: 빈 배열로 시작 (각 앱 자체 fetchTasks 흐름 사용)
  // INITIAL_TASKS import 보존 — resetTasks(시연/디자인 검증)에서 계속 사용
  const [tasks, setTasks] = useState([]);

  // 작업 업데이트 (부분 업데이트)
  const updateTask = useCallback((id, updates) => {
    setTasks(prev => updateTaskInList(prev, id, updates));
  }, []);

  // 새 작업 추가 (해피콜 신규접수 등)
  const addTask = useCallback((newTask) => {
    setTasks(prev => [newTask, ...prev]);
  }, []);

  // 전체 리셋 (디버깅/시연용)
  const resetTasks = useCallback(() => {
    setTasks(INITIAL_TASKS);
  }, []);

  const value = {
    tasks,
    updateTask,
    addTask,
    resetTasks,
  };

  return (
    <TasksContext.Provider value={value}>
      {children}
    </TasksContext.Provider>
  );
}

// 컴포넌트에서 사용
export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) {
    throw new Error("useTasks는 <TasksProvider> 안에서만 사용 가능합니다.");
  }
  return ctx;
}

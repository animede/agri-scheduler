import { apiDelete, apiGet, apiPost, apiPut } from './client'
import type { Task, TaskCreate, TaskUpdate } from './types'

const BASE = '/api/tasks'

// バックエンドは(plantings.ts等と同様に)タスクを全件フラットに返すのみで、
// planting_idによるクエリフィルタは提供していない。フィルタはクライアント側で行う。
export const listTasks = (): Promise<Task[]> => apiGet<Task[]>(BASE)
export const getTask = (id: number): Promise<Task> => apiGet<Task>(`${BASE}/${id}`)
export const createTask = (data: TaskCreate): Promise<Task> => apiPost<Task>(BASE, data)
export const updateTask = (id: number, data: TaskUpdate): Promise<Task> =>
  apiPut<Task>(`${BASE}/${id}`, data)
export const deleteTask = (id: number): Promise<void> => apiDelete(`${BASE}/${id}`)

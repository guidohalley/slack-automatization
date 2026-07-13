export type TaskStatus = 'pending' | 'agent_running' | 'pr_opened' | 'done' | 'failed';

export interface TaskDto {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  prUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskPortalTheme {
  primaryColor?: string;
  textColor?: string;
  backgroundColor?: string;
  borderRadius?: string;
  fontFamily?: string;
}

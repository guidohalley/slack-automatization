export type TaskStatus = 'pending' | 'agent_running' | 'pr_opened' | 'done' | 'failed';

export interface TaskDto {
  id: string;
  title: string;
  description: string;
  assigneeName: string;
  reporterName: string | null;
  status: TaskStatus;
  prUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// Deliberately minimal: this widget is Misionary's branded support portal,
// meant to look identical everywhere it's embedded. Only structural/host
// concerns are themeable - not brand colors.
export interface TaskPortalTheme {
  backgroundColor?: string;
  fontFamily?: string;
}

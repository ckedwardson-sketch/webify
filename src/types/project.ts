export interface Project {
  id: number;
  dreamId: number;
  name: string;
  goals: string;
  reasoning: string;
  needsDoing: string;
  expectedDateStart?: string;
  expectedDateEnd?: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export type ProjectWidgetType = "journal" | "linkboard";

export interface ProjectWidget {
  id: number;
  projectId: number;
  widgetType: ProjectWidgetType;
  title: string;
  sortOrder: number;
  createdAt?: string;
}

export interface ProjectJournalEntry {
  id: number;
  widgetId: number;
  content: string;
  createdAt: string;
}

export type ProjectBoardItemType = "text" | "link" | "image";

export interface ProjectBoardItem {
  id: number;
  widgetId: number;
  itemType: ProjectBoardItemType;
  textContent?: string;
  linkHref?: string;
  linkLabel?: string;
  imageData?: string;
  sortOrder: number;
  createdAt?: string;
}

export type TodoItem = {
  id: string;
  text: string;
};

export type SubmissionEvent = {
  id: string;
  type: "submission";
  date: string;
  note: string;
  addedBy: string;
  addedAt: string;
};

export type RevisionEvent = {
  id: string;
  type: "revision";
  date: string;
  note: string;
  todos: TodoItem[];
  addedBy: string;
  addedAt: string;
};

export type UpdateEvent = {
  id: string;
  type: "update";
  date: string;
  note: string;
  revisionId: string;
  checkedTodoIds: string[];
  addedBy: string;
  addedAt: string;
};

export type TimelineEvent = SubmissionEvent | RevisionEvent | UpdateEvent;

export type DocumentStatus = "in_progress" | "completed";

export type Document = {
  id: string;
  projectName: string;
  documentName: string;
  status: DocumentStatus;
  completedAt?: string;
  completedBy?: string;
  archived: boolean;
  archivedAt?: string;
  archivedBy?: string;
  createdBy: string;
  createdAt: string;
  timeline: TimelineEvent[];
};

export type ActivityKind =
  | "login"
  | "logout"
  | "document_created"
  | "document_deleted"
  | "event_added"
  | "event_deleted"
  | "batch_added"
  | "status_changed"
  | "archive_changed";

export type Activity = {
  id: string;
  timestamp: string;
  actor: string;
  kind: ActivityKind;
  docId?: string;
  documentName?: string;
  projectName?: string;
  eventType?: "submission" | "revision" | "update";
  eventLabel?: string;
  toStatus?: DocumentStatus;
  archived?: boolean;
  batchCount?: number;
};

export type Database = {
  documents: Document[];
  activities: Activity[];
};

export type SessionPayload = {
  username: string;
  iat?: number;
  exp?: number;
};

export type Revision = {
  id: string;
  tanggalRevisi: string;
  tanggalKirim: string;
  note: string;
  addedBy: string;
  addedAt: string;
};

export type Document = {
  id: string;
  projectName: string;
  documentName: string;
  createdBy: string;
  createdAt: string;
  revisions: Revision[];
};

export type Database = {
  documents: Document[];
};

export type SessionPayload = {
  username: string;
  iat?: number;
  exp?: number;
};

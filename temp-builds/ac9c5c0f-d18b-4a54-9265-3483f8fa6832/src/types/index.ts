export interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
  isPinned: boolean;
}

export interface NoteFormData {
  title: string;
  content: string;
  category: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface SearchFilters {
  query: string;
  category: string;
  sortBy: 'createdAt' | 'updatedAt' | 'title';
  sortOrder: 'asc' | 'desc';
}
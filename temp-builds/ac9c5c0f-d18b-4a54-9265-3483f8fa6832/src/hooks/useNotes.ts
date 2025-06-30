import { useState, useEffect } from 'react';
import { Note, Category, NoteFormData } from '@/types';

export const useNotes = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialize with default categories
  useEffect(() => {
    const defaultCategories: Category[] = [
      { id: '1', name: 'Personal', color: 'blue' },
      { id: '2', name: 'Work', color: 'green' },
      { id: '3', name: 'Ideas', color: 'purple' },
      { id: '4', name: 'Todo', color: 'orange' },
      { id: '5', name: 'Notes', color: 'gray' }
    ];
    setCategories(defaultCategories);
    loadNotes();
  }, []);

  const loadNotes = () => {
    try {
      const savedNotes = localStorage.getItem('notes');
      if (savedNotes) {
        const parsedNotes = JSON.parse(savedNotes).map((note: any) => ({
          ...note,
          createdAt: new Date(note.createdAt),
          updatedAt: new Date(note.updatedAt)
        }));
        setNotes(parsedNotes);
      } else {
        // Initialize with sample notes
        const sampleNotes: Note[] = [
          {
            id: '1',
            title: 'Welcome to NoteTaker',
            content: 'This is your first note! You can create, edit, delete, and organize your notes by categories. Try pinning important notes to keep them at the top.',
            category: 'personal',
            createdAt: new Date(),
            updatedAt: new Date(),
            isPinned: true
          },
          {
            id: '2',
            title: 'Project Ideas',
            content: 'Here are some project ideas:

1. Build a task management app
2. Create a personal blog
3. Develop a weather dashboard
4. Make a recipe organizer',
            category: 'ideas',
            createdAt: new Date(Date.now() - 86400000),
            updatedAt: new Date(Date.now() - 86400000),
            isPinned: false
          },
          {
            id: '3',
            title: 'Meeting Notes',
            content: 'Team meeting discussion points:

- Review quarterly goals
- Discuss new feature requirements
- Plan sprint activities
- Address client feedback',
            category: 'work',
            createdAt: new Date(Date.now() - 172800000),
            updatedAt: new Date(Date.now() - 172800000),
            isPinned: false
          }
        ];
        setNotes(sampleNotes);
        localStorage.setItem('notes', JSON.stringify(sampleNotes));
      }
    } catch (error) {
      console.error('Error loading notes:', error);
      setNotes([]);
    } finally {
      setLoading(false);
    }
  };

  const saveNotesToStorage = (updatedNotes: Note[]) => {
    try {
      localStorage.setItem('notes', JSON.stringify(updatedNotes));
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  };

  const addNote = async (noteData: NoteFormData & { isPinned?: boolean }) => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: noteData.title,
      content: noteData.content,
      category: noteData.category,
      createdAt: new Date(),
      updatedAt: new Date(),
      isPinned: noteData.isPinned || false
    };

    const updatedNotes = [newNote, ...notes];
    setNotes(updatedNotes);
    saveNotesToStorage(updatedNotes);
    return newNote;
  };

  const updateNote = async (noteId: string, noteData: Partial<Note>) => {
    const updatedNotes = notes.map(note => 
      note.id === noteId 
        ? { ...note, ...noteData, updatedAt: new Date() }
        : note
    );
    setNotes(updatedNotes);
    saveNotesToStorage(updatedNotes);
  };

  const deleteNote = async (noteId: string) => {
    const updatedNotes = notes.filter(note => note.id !== noteId);
    setNotes(updatedNotes);
    saveNotesToStorage(updatedNotes);
  };

  return {
    notes,
    categories,
    loading,
    addNote,
    updateNote,
    deleteNote
  };
};
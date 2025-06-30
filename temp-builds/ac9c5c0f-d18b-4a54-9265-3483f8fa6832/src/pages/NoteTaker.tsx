import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Grid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NoteCard } from '@/components/NoteCard';
import { NoteEditor } from '@/components/NoteEditor';
import { CategoryFilter } from '@/components/CategoryFilter';
import { Note, Category, SearchFilters } from '@/types';
import { useNotes } from '@/hooks/useNotes';

const NoteTaker: React.FC = () => {
  const { notes, categories, addNote, updateNote, deleteNote, loading } = useNotes();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    category: 'all',
    sortBy: 'updatedAt',
    sortOrder: 'desc'
  });

  const filteredNotes = notes.filter(note => {
    const matchesQuery = note.title.toLowerCase().includes(filters.query.toLowerCase()) ||
                        note.content.toLowerCase().includes(filters.query.toLowerCase());
    const matchesCategory = filters.category === 'all' || note.category === filters.category;
    return matchesQuery && matchesCategory;
  }).sort((a, b) => {
    const aValue = a[filters.sortBy];
    const bValue = b[filters.sortBy];
    const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    return filters.sortOrder === 'asc' ? comparison : -comparison;
  });

  const pinnedNotes = filteredNotes.filter(note => note.isPinned);
  const regularNotes = filteredNotes.filter(note => !note.isPinned);

  const handleCreateNote = () => {
    setEditingNote(null);
    setIsEditorOpen(true);
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setIsEditorOpen(true);
  };

  const handleSaveNote = async (noteData: any) => {
    try {
      if (editingNote) {
        await updateNote(editingNote.id, noteData);
      } else {
        await addNote(noteData);
      }
      setIsEditorOpen(false);
      setEditingNote(null);
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteNote(noteId);
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const handleTogglePin = async (note: Note) => {
    try {
      await updateNote(note.id, { ...note, isPinned: !note.isPinned });
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                NoteTaker
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                onClick={handleCreateNote}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Note
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search notes..."
                value={filters.query}
                onChange={(e) => setFilters(prev => ({ ...prev, query: e.target.value }))}
                className="pl-10 bg-white/80 backdrop-blur-sm border-gray-200"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <CategoryFilter
            categories={categories}
            selectedCategory={filters.category}
            onCategoryChange={(category) => setFilters(prev => ({ ...prev, category }))}
          />
        </div>

        {/* Notes Display */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Pinned Notes */}
            {pinnedNotes.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  📌 Pinned Notes
                </h2>
                <div className={`grid gap-4 ${
                  viewMode === 'grid' 
                    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                    : 'grid-cols-1'
                }`}>
                  {pinnedNotes.map(note => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      viewMode={viewMode}
                      onEdit={handleEditNote}
                      onDelete={handleDeleteNote}
                      onTogglePin={handleTogglePin}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Regular Notes */}
            {regularNotes.length > 0 ? (
              <div>
                {pinnedNotes.length > 0 && (
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">
                    All Notes
                  </h2>
                )}
                <div className={`grid gap-4 ${
                  viewMode === 'grid' 
                    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                    : 'grid-cols-1'
                }`}>
                  {regularNotes.map(note => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      viewMode={viewMode}
                      onEdit={handleEditNote}
                      onDelete={handleDeleteNote}
                      onTogglePin={handleTogglePin}
                    />
                  ))}
                </div>
              </div>
            ) : (
              !loading && pinnedNotes.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-6xl mb-4">📝</div>
                  <h3 className="text-lg font-medium text-gray-600 mb-2">
                    No notes yet
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Create your first note to get started
                  </p>
                  <Button
                    onClick={handleCreateNote}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Note
                  </Button>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Note Editor Modal */}
      {isEditorOpen && (
        <NoteEditor
          note={editingNote}
          categories={categories}
          onSave={handleSaveNote}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingNote(null);
          }}
        />
      )}
    </div>
  );
};

export default NoteTaker;
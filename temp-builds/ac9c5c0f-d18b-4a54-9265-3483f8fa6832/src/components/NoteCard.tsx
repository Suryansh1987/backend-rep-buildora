import React from 'react';
import { Edit, Trash2, Pin, PinOff, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Note } from '@/types';

interface NoteCardProps {
  note: Note;
  viewMode: 'grid' | 'list';
  onEdit: (note: Note) => void;
  onDelete: (noteId: string) => void;
  onTogglePin: (note: Note) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  viewMode,
  onEdit,
  onDelete,
  onTogglePin
}) => {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'personal': 'bg-blue-100 text-blue-800',
      'work': 'bg-green-100 text-green-800',
      'ideas': 'bg-purple-100 text-purple-800',
      'todo': 'bg-orange-100 text-orange-800',
      'notes': 'bg-gray-100 text-gray-800'
    };
    return colors[category.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  const truncateContent = (content: string, maxLength: number) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  if (viewMode === 'list') {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-gray-200 hover:shadow-md transition-all duration-200 hover:bg-white/90">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-2">
                <h3 className="font-semibold text-gray-900 truncate">{note.title}</h3>
                {note.isPinned && (
                  <Pin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                )}
                <Badge className={getCategoryColor(note.category)}>
                  {note.category}
                </Badge>
              </div>
              <p className="text-gray-600 text-sm mb-2">
                {truncateContent(note.content, 150)}
              </p>
              <div className="flex items-center text-xs text-gray-500">
                <Calendar className="w-3 h-3 mr-1" />
                <span>Updated {formatDate(note.updatedAt)}</span>
              </div>
            </div>
            <div className="flex items-center space-x-1 ml-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onTogglePin(note)}
                className="text-gray-500 hover:text-blue-600"
              >
                {note.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(note)}
                className="text-gray-500 hover:text-blue-600"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(note.id)}
                className="text-gray-500 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-gray-200 hover:shadow-lg transition-all duration-200 hover:bg-white/90 cursor-pointer group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 truncate" onClick={() => onEdit(note)}>
              {note.title}
            </h3>
            {note.isPinned && (
              <Pin className="w-4 h-4 text-blue-600 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(note);
              }}
              className="text-gray-500 hover:text-blue-600 h-8 w-8 p-0"
            >
              {note.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(note);
              }}
              className="text-gray-500 hover:text-blue-600 h-8 w-8 p-0"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(note.id);
              }}
              className="text-gray-500 hover:text-red-600 h-8 w-8 p-0"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <Badge className={`${getCategoryColor(note.category)} w-fit`}>
          {note.category}
        </Badge>
      </CardHeader>
      <CardContent className="pt-0" onClick={() => onEdit(note)}>
        <p className="text-gray-600 text-sm mb-4 line-clamp-4">
          {truncateContent(note.content, 120)}
        </p>
        <div className="flex items-center text-xs text-gray-500">
          <Calendar className="w-3 h-3 mr-1" />
          <span>Updated {formatDate(note.updatedAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
};
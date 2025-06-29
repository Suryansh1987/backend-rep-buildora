import React from 'react';
import { Check, Edit2, Trash2, Calendar, Tag, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Todo } from '@/types';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (id: string) => void;
}

export const TodoItem: React.FC<TodoItemProps> = ({
  todo,
  onToggle,
  onEdit,
  onDelete
}) => {
  const isOverdue = todo.dueDate && new Date(todo.dueDate) < new Date() && !todo.completed;
  const isDueSoon = todo.dueDate && 
    new Date(todo.dueDate).getTime() - new Date().getTime() < 24 * 60 * 60 * 1000 && 
    !todo.completed;

  const priorityColors = {
    low: 'bg-green-100 text-green-800 border-green-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    high: 'bg-red-100 text-red-800 border-red-200'
  };

  const priorityIcons = {
    low: <div className="w-2 h-2 rounded-full bg-green-500" />,
    medium: <div className="w-2 h-2 rounded-full bg-yellow-500" />,
    high: <div className="w-2 h-2 rounded-full bg-red-500" />
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(date));
  };

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${
      todo.completed ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
    } ${isOverdue ? 'border-l-4 border-l-red-500' : ''} ${
      isDueSoon ? 'border-l-4 border-l-yellow-500' : ''
    }`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <div className="flex-shrink-0 mt-1">
            <Checkbox
              checked={todo.completed}
              onCheckedChange={() => onToggle(todo.id)}
              className="w-5 h-5"
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <h3 className={`font-medium text-gray-900 ${
                  todo.completed ? 'line-through text-gray-500' : ''
                }`}>
                  {todo.title}
                </h3>
                
                {todo.description && (
                  <p className={`text-sm mt-1 ${
                    todo.completed ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {todo.description}
                  </p>
                )}

                {/* Meta Information */}
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  {/* Priority */}
                  <Badge variant="outline" className={`text-xs ${priorityColors[todo.priority]}`}>
                    {priorityIcons[todo.priority]}
                    <span className="ml-1 capitalize">{todo.priority}</span>
                  </Badge>

                  {/* Category */}
                  <Badge variant="outline" className="text-xs">
                    <Tag className="w-3 h-3 mr-1" />
                    {todo.category}
                  </Badge>

                  {/* Due Date */}
                  {todo.dueDate && (
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        isOverdue 
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : isDueSoon 
                          ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      {isOverdue ? (
                        <AlertTriangle className="w-3 h-3 mr-1" />
                      ) : (
                        <Calendar className="w-3 h-3 mr-1" />
                      )}
                      {formatDate(todo.dueDate)}
                      {isOverdue && ' (Overdue)'}
                      {isDueSoon && !isOverdue && ' (Due Soon)'}
                    </Badge>
                  )}

                  {/* Created Date */}
                  <span className="text-xs text-gray-400 flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDate(todo.createdAt)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(todo)}
                  className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(todo.id)}
                  className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
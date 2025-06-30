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
    low: 'bg-gray-100 text-gray-800 border-gray-300',
    medium: 'bg-gray-200 text-gray-800 border-gray-400',
    high: 'bg-gray-300 text-gray-800 border-gray-500'
  };

  const priorityIcons = {
    low: <div className="w-2 h-2 rounded-full bg-gray-500" />,
    medium: <div className="w-2 h-2 rounded-full bg-gray-700" />,
    high: <div className="w-2 h-2 rounded-full bg-black" />
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
      todo.completed ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-200'
    } ${isOverdue ? 'border-l-4 border-l-gray-800' : ''} ${
      isDueSoon ? 'border-l-4 border-l-gray-600' : ''
    }`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <Checkbox
              checked={todo.completed}
              onCheckedChange={() => onToggle(todo.id)}
              className="w-5 h-5"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <h3 className={`font-medium text-black ${
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

                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <Badge variant="outline" className={`text-xs ${priorityColors[todo.priority]}`}>
                    {priorityIcons[todo.priority]}
                    <span className="ml-1 capitalize">{todo.priority}</span>
                  </Badge>

                  <Badge variant="outline" className="text-xs bg-gray-100 text-gray-800 border-gray-300">
                    <Tag className="w-3 h-3 mr-1" />
                    {todo.category}
                  </Badge>

                  {todo.dueDate && (
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        isOverdue 
                          ? 'bg-gray-200 text-gray-800 border-gray-400'
                          : isDueSoon 
                          ? 'bg-gray-100 text-gray-800 border-gray-300'
                          : 'bg-white text-gray-800 border-gray-200'
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

                  <span className="text-xs text-gray-500 flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDate(todo.createdAt)}
                  </span>
                </div>
              </div>

<div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(todo)}
                  className="h-8 w-8 p-0 hover:bg-blue-100 hover:text-blue-800"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(todo.id)}
                  className="h-8 w-8 p-0 hover:bg-blue-100 hover:text-blue-800"
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
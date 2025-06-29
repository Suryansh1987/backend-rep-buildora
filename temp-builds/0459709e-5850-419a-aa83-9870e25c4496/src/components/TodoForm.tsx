import React, { useState, useEffect } from 'react';
import { X, Calendar, Tag, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Todo, TodoFormData } from '@/types';

interface TodoFormProps {
  todo?: Todo | null;
  onSubmit: (data: TodoFormData | Todo) => void;
  onClose: () => void;
}

export const TodoForm: React.FC<TodoFormProps> = ({ todo, onSubmit, onClose }) => {
  const [formData, setFormData] = useState<TodoFormData>({
    title: '',
    description: '',
    priority: 'medium',
    category: 'Personal',
    dueDate: ''
  });

  const [errors, setErrors] = useState<Partial<TodoFormData>>({});

  useEffect(() => {
    if (todo) {
      setFormData({
        title: todo.title,
        description: todo.description || '',
        priority: todo.priority,
        category: todo.category,
        dueDate: todo.dueDate ? new Date(todo.dueDate).toISOString().split('T')[0] : ''
      });
    }
  }, [todo]);

  const validateForm = (): boolean => {
    const newErrors: Partial<TodoFormData> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.category.trim()) {
      newErrors.category = 'Category is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const submitData = {
      ...formData,
      dueDate: formData.dueDate || undefined
    };

    if (todo) {
      onSubmit({
        ...todo,
        ...submitData,
        dueDate: submitData.dueDate ? new Date(submitData.dueDate) : undefined,
        updatedAt: new Date()
      });
    } else {
      onSubmit(submitData);
    }

    onClose();
  };

  const handleInputChange = (field: keyof TodoFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const priorityColors = {
    low: 'text-green-600',
    medium: 'text-yellow-600',
    high: 'text-red-600'
  };

  const categories = ['Personal', 'Work', 'Shopping', 'Health', 'Education', 'Finance', 'Other'];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-semibold">
            {todo ? 'Edit Task' : 'Create New Task'}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Enter task title..."
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className={errors.title ? 'border-red-500' : ''}
              />
              {errors.title && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.title}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Add task description..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
              />
            </div>

            {/* Priority and Category */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value: 'low' | 'medium' | 'high') => 
                    handleInputChange('priority', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">
                      <span className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        Low
                      </span>
                    </SelectItem>
                    <SelectItem value="medium">
                      <span className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                        Medium
                      </span>
                    </SelectItem>
                    <SelectItem value="high">
                      <span className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        High
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => handleInputChange('category', value)}
                >
                  <SelectTrigger className={errors.category ? 'border-red-500' : ''}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        <span className="flex items-center gap-2">
                          <Tag className="w-3 h-3" />
                          {category}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.category}
                  </p>
                )}
              </div>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleInputChange('dueDate', e.target.value)}
                  className="pl-10"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {todo ? 'Update Task' : 'Create Task'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
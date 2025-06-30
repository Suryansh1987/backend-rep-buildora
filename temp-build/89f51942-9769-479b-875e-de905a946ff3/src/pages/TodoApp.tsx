import React, { useState, useEffect } from 'react';
import { Plus, Filter, Search, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TodoForm } from '@/components/TodoForm';
import { TodoItem } from '@/components/TodoItem';
import { TodoFilters } from '@/components/TodoFilters';
import { TodoStats } from '@/components/TodoStats';
import { useTodos } from '@/hooks/useTodos';
import { Todo, FilterOptions } from '@/types';

export const TodoApp: React.FC = () => {
  const {
    todos,
    loading,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
    stats
  } = useTodos();

  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    priority: 'all',
    category: 'all'
  });
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  const filteredTodos = todos.filter(todo => {
    const matchesSearch = todo.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (todo.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    const matchesStatus = filters.status === 'all' ||
                         (filters.status === 'completed' && todo.completed) ||
                         (filters.status === 'pending' && !todo.completed);
    
    const matchesPriority = filters.priority === 'all' || todo.priority === filters.priority;
    
    const matchesCategory = filters.category === 'all' || todo.category === filters.category;
    
    return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
  });

  const handleEditTodo = (todo: Todo) => {
    setEditingTodo(todo);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingTodo(null);
  };

  const categories = Array.from(new Set(todos.map(todo => todo.category)));

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-100 to-pink-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-500 to-pink-500 text-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">moww</h1>
                <p className="text-sm text-blue-100">Organize your tasks efficiently</p>
              </div>
            </div>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-pink-500 text-white hover:bg-pink-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats */}
        <TodoStats stats={stats} />

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-blue-300"
              />
            </div>
            <TodoFilters
              filters={filters}
              onFiltersChange={setFilters}
              categories={categories}
            />
          </div>
        </div>

        {/* Todo List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredTodos.length === 0 ? (
            <Card className="text-center py-12 border-blue-300">
              <CardContent>
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-blue-800 mb-2">
                  {searchTerm || filters.status !== 'all' ? 'No tasks found' : 'No tasks yet'}
                </h3>
                <p className="text-blue-600 mb-4">
                  {searchTerm || filters.status !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Create your first task to get started'}
                </p>
                {!searchTerm && filters.status === 'all' && (
                  <Button
                    onClick={() => setShowForm(true)}
                    className="bg-pink-500 text-white hover:bg-pink-600"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Task
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredTodos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onToggle={toggleTodo}
                  onEdit={handleEditTodo}
                  onDelete={deleteTodo}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Todo Form Modal */}
      {showForm && (
        <TodoForm
          todo={editingTodo}
          onSubmit={editingTodo ? updateTodo : addTodo}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
};
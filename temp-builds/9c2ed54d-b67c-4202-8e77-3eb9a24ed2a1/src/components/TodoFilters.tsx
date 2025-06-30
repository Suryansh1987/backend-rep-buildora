import React from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FilterOptions } from '@/types';

interface TodoFiltersProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  categories: string[];
}

export const TodoFilters: React.FC<TodoFiltersProps> = ({
  filters,
  onFiltersChange,
  categories
}) => {
  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      status: 'all',
      priority: 'all',
      category: 'all'
    });
  };

  const hasActiveFilters = filters.status !== 'all' || 
                          filters.priority !== 'all' || 
                          filters.category !== 'all';

  return (
<div className="flex flex-wrap items-center gap-3 bg-white text-black">
      <div className="flex items-center gap-2 text-sm">
        <Filter className="w-4 h-4" />
        <span>Filters:</span>
      </div>

      {/* Status Filter */}
      <Select
        value={filters.status}
        onValueChange={(value: 'all' | 'completed' | 'pending') => 
          handleFilterChange('status', value)
        }
      >
        <SelectTrigger className="w-32 border-black">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-white text-black">
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>

      {/* Priority Filter */}
      <Select
        value={filters.priority}
        onValueChange={(value: 'all' | 'low' | 'medium' | 'high') => 
          handleFilterChange('priority', value)
        }
      >
        <SelectTrigger className="w-32 border-black">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-white text-black">
          <SelectItem value="all">All Priority</SelectItem>
          <SelectItem value="high">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-black"></div>
              High
            </span>
          </SelectItem>
          <SelectItem value="medium">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-500"></div>
              Medium
            </span>
          </SelectItem>
          <SelectItem value="low">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-300"></div>
              Low
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Category Filter */}
      {categories.length > 0 && (
        <Select
          value={filters.category}
          onValueChange={(value) => handleFilterChange('category', value)}
        >
          <SelectTrigger className="w-36 border-black">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white text-black">
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={clearFilters}
          className="text-xs border-blue-500 text-blue-500 hover:bg-blue-100"
        >
          Clear Filters
        </Button>
      )}

      {/* Active Filter Count */}
      {hasActiveFilters && (
        <Badge variant="secondary" className="text-xs bg-blue-500 text-white">
          {[filters.status, filters.priority, filters.category]
            .filter(f => f !== 'all').length} active
        </Badge>
      )}
    </div>
  );
};
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Category } from '@/types';

interface CategoryFilterProps {
  categories: Category[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategory,
  onCategoryChange
}) => {
  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'personal': 'bg-blue-100 text-blue-800 hover:bg-blue-200',
      'work': 'bg-green-100 text-green-800 hover:bg-green-200',
      'ideas': 'bg-purple-100 text-purple-800 hover:bg-purple-200',
      'todo': 'bg-orange-100 text-orange-800 hover:bg-orange-200',
      'notes': 'bg-gray-100 text-gray-800 hover:bg-gray-200'
    };
    return colors[category.toLowerCase()] || 'bg-gray-100 text-gray-800 hover:bg-gray-200';
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={selectedCategory === 'all' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onCategoryChange('all')}
        className={selectedCategory === 'all' ? 'bg-gradient-to-r from-blue-600 to-purple-600' : ''}
      >
        All Notes
      </Button>
      {categories.map(category => (
        <Badge
          key={category.id}
          className={`cursor-pointer transition-colors ${
            selectedCategory === category.name.toLowerCase()
              ? 'ring-2 ring-blue-500 ring-offset-1'
              : ''
          } ${getCategoryColor(category.name)}`}
          onClick={() => onCategoryChange(category.name.toLowerCase())}
        >
          {category.name}
        </Badge>
      ))}
    </div>
  );
};
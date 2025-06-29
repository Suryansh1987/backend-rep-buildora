import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, ListTodo } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { TodoStats as TodoStatsType } from '@/types';

interface TodoStatsProps {
  stats: TodoStatsType;
}

export const TodoStats: React.FC<TodoStatsProps> = ({ stats }) => {
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const statCards = [
    {
      title: 'Total Tasks',
      value: stats.total,
      icon: ListTodo,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700'
    },
    {
      title: 'Completed',
      value: stats.completed,
      icon: CheckCircle2,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700'
    },
    {
      title: 'Pending',
      value: stats.pending,
      icon: Clock,
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-700'
    },
    {
      title: 'Overdue',
      value: stats.overdue,
      icon: AlertTriangle,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      textColor: 'text-red-700'
    }
  ];

  return (
    <div className="mb-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className={`text-2xl font-bold ${stat.textColor}`}>{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 text-white ${stat.color} rounded p-1`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Progress Bar */}
      {stats.total > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Overall Progress</span>
              <span className="text-sm font-semibold text-gray-900">{completionRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${completionRate}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {stats.completed} of {stats.total} tasks completed
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
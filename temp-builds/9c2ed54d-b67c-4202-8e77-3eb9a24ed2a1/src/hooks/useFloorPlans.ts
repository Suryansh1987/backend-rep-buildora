import { useState, useEffect } from 'react';
import { FloorPlan } from '@/types';
import { getFloorPlans } from '@/lib/api';

export const useFloorPlans = () => {
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFloorPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getFloorPlans();
      setFloorPlans(data);
    } catch (err) {
      setError('Failed to fetch floor plans');
      console.error('Error fetching floor plans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFloorPlans();
  }, []);

  const addFloorPlan = (newFloorPlan: FloorPlan) => {
    setFloorPlans(prev => [newFloorPlan, ...prev]);
  };

  const updateFloorPlan = (updatedFloorPlan: FloorPlan) => {
    setFloorPlans(prev => 
      prev.map(fp => fp.id === updatedFloorPlan.id ? updatedFloorPlan : fp)
    );
  };

  return {
    floorPlans,
    loading,
    error,
    refetch: fetchFloorPlans,
    addFloorPlan,
    updateFloorPlan
  };
};
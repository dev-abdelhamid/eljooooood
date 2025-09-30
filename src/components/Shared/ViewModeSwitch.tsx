import React from 'react';
import { Button } from '../../components/UI/Button';
import { Table2, Grid } from 'lucide-react';

interface ViewModeSwitchProps {
  isRtl: boolean;
  viewMode: 'card' | 'table';
  dispatch: React.Dispatch<any>;
}

const ViewModeSwitch: React.FC<ViewModeSwitchProps> = ({ isRtl, viewMode, dispatch }) => {
  return (
    <Button
      variant="secondary"
      onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: viewMode === 'card' ? 'table' : 'card' })}
      className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-3 py-1.5 text-xs shadow transition-all duration-300"
    >
      {viewMode === 'card' ? <Table2 className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
      {viewMode === 'card' ? (isRtl ? 'عرض كجدول' : 'View as Table') : (isRtl ? 'عرض كبطاقات' : 'View as Cards')}
    </Button>
  );
};

export default ViewModeSwitch;
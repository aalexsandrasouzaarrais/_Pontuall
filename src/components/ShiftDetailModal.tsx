import React from 'react';
import { Shift, Employee } from '../types';
import { OrbitShiftModal } from './OrbitShiftModal';

interface ShiftDetailModalProps {
  shift: Shift | null;
  employees: Employee[];
  isOpen: boolean;
  onClose: () => void;
  onSave?: (shiftData: Partial<Shift> & { id?: string }) => void;
  onDelete?: (id: string) => void;
}

export const ShiftDetailModal: React.FC<ShiftDetailModalProps> = ({
  shift,
  employees,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  if (!isOpen || !shift) return null;

  return (
    <OrbitShiftModal
      isOpen={isOpen}
      initialDate={shift.date}
      editingShift={shift}
      employees={employees}
      onSave={(data) => {
        if (onSave) onSave(data);
        onClose();
      }}
      onDelete={(id) => {
        if (onDelete) onDelete(id);
        onClose();
      }}
      onClose={onClose}
    />
  );
};

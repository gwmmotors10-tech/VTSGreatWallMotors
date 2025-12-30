import React from 'react';
import BoxRepair from './BoxRepair';
import { User } from '../types';

interface ParkingProps {
  user: User;
  onBack: () => void;
}

export default function Parking({ user, onBack }: ParkingProps) {
  // Parking logic is identical to Box Repair but points to 'PARKING' area in DB
  return <BoxRepair user={user} onBack={onBack} mode="PARKING" />;
}
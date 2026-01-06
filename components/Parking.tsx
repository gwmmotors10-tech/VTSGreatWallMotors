
import React from 'react';
import BoxRepair from './BoxRepair';
import { User } from '../types';

interface ParkingProps {
  user: User;
  onBack: () => void;
}

export default function Parking({ user, onBack }: ParkingProps) {
  return <BoxRepair user={user} onBack={onBack} mode="PARKING" />;
}

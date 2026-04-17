import React from 'react';
import { ICONS } from '../../constants';

interface ToggleSwitchProps {
  isOn: boolean;
  handleToggle: () => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ isOn, handleToggle }) => {
  return (
    <div className={`toggle-switch ${isOn ? 'dark' : ''}`} onClick={handleToggle}>
      <div className="toggle-knob">
         {isOn 
            ? ICONS.moon('w-3 h-3 text-primary') 
            : ICONS.sun('w-3 h-3 text-text-secondary')
         }
      </div>
    </div>
  );
};

export default ToggleSwitch;
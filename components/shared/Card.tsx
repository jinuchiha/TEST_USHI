import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  isHoverable?: boolean;
}

const Card: React.FC<CardProps> = ({ children, className = '', onClick, isHoverable }) => {
  const baseClasses = "panel";
  const hoverClasses = isHoverable ? 'hover:border-primary transition-colors duration-300' : '';
  
  return (
    <div className={`${baseClasses} ${hoverClasses} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
};

export default Card;
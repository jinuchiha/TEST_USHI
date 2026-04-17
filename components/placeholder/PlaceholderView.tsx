import React from 'react';

interface PlaceholderViewProps {
  title: string;
}

const PlaceholderView: React.FC<PlaceholderViewProps> = ({ title }) => {
  return (
    <div className="flex items-center justify-center h-full text-center text-text-secondary">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">Placeholder View</h2>
        <p className="mt-2">The view for "{title}" is under construction.</p>
      </div>
    </div>
  );
};

export default PlaceholderView;
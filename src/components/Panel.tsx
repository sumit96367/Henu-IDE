import { ReactNode, useState } from 'react';

interface PanelProps {
  title: string;
  children: ReactNode;
  className?: string;
  glowColor?: string;
  isActive?: boolean;
  onClick?: () => void;
  onCollapse?: () => void;
  centerContent?: ReactNode;
}

export const Panel = ({
  title,
  children,
  className = '',
  glowColor = 'red',
  isActive = false,
  onClick,
  onCollapse,
  centerContent
}: PanelProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const glowColors = {
    red: {
      shadow: 'shadow-[0_0_30px_rgba(239,68,68,0.3)]',
      hoverShadow: 'shadow-[0_0_50px_rgba(239,68,68,0.5)]',
    },
    blue: {
      shadow: 'shadow-[0_0_30px_rgba(59,130,246,0.3)]',
      hoverShadow: 'shadow-[0_0_50px_rgba(59,130,246,0.5)]',
    },
    green: {
      shadow: 'shadow-[0_0_30px_rgba(34,197,94,0.3)]',
      hoverShadow: 'shadow-[0_0_50px_rgba(34,197,94,0.5)]',
    },
  };

  const borderColors = {
    red: 'border-red-900/50',
    blue: 'border-blue-900/50',
    green: 'border-green-900/50',
  };

  const selectedGlow = glowColors[glowColor as keyof typeof glowColors] || glowColors.red;
  const selectedBorder = borderColors[glowColor as keyof typeof borderColors] || borderColors.red;

  return (
    <div
      className={`panel-3d backdrop-blur-xl bg-gradient-to-br from-black/90 to-black/70 border ${selectedBorder} rounded-none overflow-hidden transition-all duration-300 ${isHovered || isActive ? selectedGlow.hoverShadow : selectedGlow.shadow
        } ${isActive ? 'ring-1 ring-red-500/50' : ''} ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      style={{
        transform: 'translateZ(0)',
      }}
    >
      <div className="panel-header bg-gradient-to-r from-gray-900/50 to-black/50 border-b border-red-900/30 px-4 py-2.5 flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full animate-pulse transition-all ${isHovered
            ? 'bg-red-400 shadow-[0_0_15px_rgba(239,68,68,1)]'
            : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'
            }`}></div>
          <span className={`text-red-400 font-mono text-sm tracking-wider transition-colors ${isHovered ? 'text-red-300' : ''
            }`}>{title}</span>
        </div>

        {/* Center Content */}
        {centerContent && (
          <div className="flex-1 flex items-center justify-center px-4">
            {centerContent}
          </div>
        )}

        <div className="flex space-x-2">
          <div className="w-3 h-3 rounded-full bg-gray-700 hover:bg-yellow-500 transition-colors cursor-pointer"></div>
          <div className="w-3 h-3 rounded-full bg-gray-700 hover:bg-green-500 transition-colors cursor-pointer"></div>
          <div
            className="w-3 h-3 rounded-full bg-gray-700 hover:bg-red-500 transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onCollapse?.();
            }}
          ></div>
        </div>
      </div>
      <div className="panel-content overflow-auto">{children}</div>
    </div>
  );
};

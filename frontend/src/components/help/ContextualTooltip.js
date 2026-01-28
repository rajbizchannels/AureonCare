import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

const ContextualTooltip = ({
  theme,
  content,
  title,
  placement = 'top',
  articleId,
  onOpenArticle
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const getPlacementClasses = () => {
    switch (placement) {
      case 'top':
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 transform -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 transform -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 transform -translate-y-1/2 ml-2';
      default:
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
    }
  };

  const getArrowClasses = () => {
    switch (placement) {
      case 'top':
        return 'bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full border-t-8 border-x-8 border-x-transparent';
      case 'bottom':
        return 'top-0 left-1/2 transform -translate-x-1/2 -translate-y-full border-b-8 border-x-8 border-x-transparent';
      case 'left':
        return 'right-0 top-1/2 transform translate-x-full -translate-y-1/2 border-l-8 border-y-8 border-y-transparent';
      case 'right':
        return 'left-0 top-1/2 transform -translate-x-full -translate-y-1/2 border-r-8 border-y-8 border-y-transparent';
      default:
        return 'bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full border-t-8 border-x-8 border-x-transparent';
    }
  };

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        className={`p-1 rounded-full transition-colors ${
          theme === 'dark'
            ? 'hover:bg-slate-700 text-slate-400 hover:text-blue-400'
            : 'hover:bg-gray-200 text-gray-500 hover:text-blue-500'
        }`}
        aria-label="Help"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {isVisible && (
        <div
          className={`absolute z-50 w-80 ${getPlacementClasses()}`}
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={() => setIsVisible(false)}
        >
          <div className={`rounded-lg shadow-xl border ${
            theme === 'dark'
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-gray-200'
          }`}>
            {/* Arrow */}
            <div
              className={`absolute w-0 h-0 ${getArrowClasses()} ${
                theme === 'dark' ? 'border-t-slate-800' : 'border-t-white'
              }`}
              style={{
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
              }}
            />

            {/* Content */}
            <div className="p-4">
              {title && (
                <h4 className={`font-semibold mb-2 flex items-center gap-2 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  <span className="text-blue-500">💡</span>
                  {title}
                </h4>
              )}
              <p className={`text-sm leading-relaxed ${
                theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
              }`}>
                {content}
              </p>

              {articleId && onOpenArticle && (
                <button
                  onClick={() => {
                    onOpenArticle(articleId);
                    setIsVisible(false);
                  }}
                  className={`mt-3 text-sm font-medium text-blue-500 hover:text-blue-600 flex items-center gap-1`}
                >
                  Learn more →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContextualTooltip;
